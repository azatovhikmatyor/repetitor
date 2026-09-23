"""Foydalanuvchi bilan ishlashning umumiy yordamchilari."""

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.users.models import User, UserRole, UserStatus

#: Maydon nomi -> foydalanuvchiga ko'rinadigan nom.
_FIELD_LABELS = {
    "username": "username",
    "phone": "telefon raqami",
    "email": "email",
}


async def get_user(db: AsyncSession, user_id: int) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise NotFoundError("Foydalanuvchi topilmadi")
    return user


async def find_by_login(db: AsyncSession, login: str) -> User | None:
    """Username, email yoki telefon bo'yicha topadi.

    Username va email registrga bog'liq emas; telefon aynan kiritilgandek
    taqqoslanadi.
    """
    value = login.strip()
    if not value:
        return None

    lowered = value.lower()
    stmt = select(User).where(
        or_(
            User.username == lowered,
            User.email == lowered,
            User.phone == value,
        )
    )
    return await db.scalar(stmt)


async def ensure_identifiers_free(
    db: AsyncSession,
    *,
    username: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    exclude_user_id: int | None = None,
) -> None:
    """Har bir identifikator bandligini alohida tekshiradi.

    Xatolik `details` ichida aynan qaysi maydon bandligini qaytaradi —
    forma uni shu maydon ostida ko'rsatadi ("bunday username allaqachon
    bor"). Band identifikator boshqa o'qituvchining o'quvchisiga tegishli
    bo'lishi mumkin, shuning uchun xabarda egasi haqida hech narsa yo'q.
    """
    candidates = {
        "username": username.lower() if username else None,
        "phone": phone,
        "email": email.lower() if email else None,
    }
    taken: list[dict[str, str]] = []

    for field, value in candidates.items():
        if not value:
            continue
        stmt = select(User.id).where(getattr(User, field) == value)
        if exclude_user_id is not None:
            stmt = stmt.where(User.id != exclude_user_id)
        if await db.scalar(stmt.limit(1)) is not None:
            taken.append(
                {
                    "field": field,
                    "message": f"Bu {_FIELD_LABELS[field]} allaqachon band",
                }
            )

    if taken:
        first = taken[0]["message"]
        raise ConflictError(first, details=taken)


async def get_owned_student(
    db: AsyncSession, *, teacher_id: int, student_id: int
) -> User:
    """O'qituvchining o'z o'quvchisini oladi.

    Begona o'quvchi uchun 404 — 403 emas (talab 12).
    """
    stmt = select(User).where(
        User.id == student_id,
        User.role == UserRole.STUDENT,
        User.teacher_id == teacher_id,
    )
    student = await db.scalar(stmt)
    if student is None:
        raise NotFoundError("O'quvchi topilmadi")
    return student


def name_order() -> tuple:
    """Ism bo'yicha tartiblash — `full_name` endi hisoblanadigan maydon."""
    return (User.first_name, User.last_name)


def full_name_of(first_name: str, last_name: str | None) -> str:
    return f"{first_name} {last_name}".strip() if last_name else first_name


async def effective_status(db: AsyncSession, user: User) -> UserStatus:
    """Hisobning amaldagi holati.

    O'quvchining hisobi o'z holatidan tashqari o'qituvchisining holatiga ham
    bog'liq: o'qituvchi bloklansa yoki hali tasdiqlanmagan bo'lsa, uning
    o'quvchilari ham tizimga kira olmaydi.
    """
    if user.role is not UserRole.STUDENT or user.teacher_id is None:
        return user.status

    teacher_status = await db.scalar(
        select(User.status).where(User.id == user.teacher_id)
    )
    if teacher_status is not UserStatus.ACTIVE:
        return UserStatus.BLOCKED
    return user.status
