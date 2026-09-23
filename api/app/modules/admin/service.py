"""Super Admin amallari.

Qamrov: o'qituvchilarni tasdiqlash, bloklash, parolini tiklash, zaxira
nusxa olish va o'chirish. O'qituvchining kundalik ishlari (guruh, davomat,
to'lov) bu yerda yo'q — bu mahsulot qarori (talab 3 va 9).
"""

from typing import Any

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import utc_now
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.pagination import PageParams
from app.core.security import generate_temp_password, hash_password
from app.modules.admin import schemas
from app.modules.attendance.models import AttendanceRecord, AttendanceSession
from app.modules.groups.models import Enrollment, Group, GroupStatus
from app.modules.payments.models import MonthlyCharge, Payment
from app.modules.users.models import (
    PasswordResetToken,
    RefreshToken,
    User,
    UserRole,
    UserStatus,
)


def _count_subqueries() -> tuple[Any, Any]:
    """Har bir o'qituvchi uchun faol guruh va o'quvchilar soni."""
    group_count = (
        select(func.count(Group.id))
        .where(Group.teacher_id == User.id, Group.status == GroupStatus.ACTIVE)
        .correlate(User)
        .scalar_subquery()
    )
    # O'quvchilar ham `users` jadvalida — o'zini o'ziga bog'lash uchun alias.
    students = User.__table__.alias("student")
    student_count = (
        select(func.count(students.c.id))
        .where(
            students.c.teacher_id == User.id,
            students.c.role == UserRole.STUDENT.value,
        )
        .correlate(User)
        .scalar_subquery()
    )
    return group_count, student_count


def _to_teacher_out(user: User, groups: int, students: int) -> schemas.TeacherOut:
    return schemas.TeacherOut(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        middle_name=user.middle_name,
        username=user.username,
        email=user.email,
        phone=user.phone,
        avatar_url=user.avatar_url,
        status=user.status,
        created_at=user.created_at,
        approved_at=user.approved_at,
        last_login_at=user.last_login_at,
        active_group_count=groups,
        student_count=students,
    )


async def get_teacher_out(db: AsyncSession, teacher_id: int) -> schemas.TeacherOut:
    """Bitta o'qituvchi — sonlari bilan birga."""
    group_count, student_count = _count_subqueries()
    row = await db.execute(
        select(User, group_count, student_count).where(
            User.id == teacher_id, User.role == UserRole.TEACHER
        )
    )
    result = row.first()
    if result is None:
        raise NotFoundError("O'qituvchi topilmadi")
    return _to_teacher_out(result[0], result[1], result[2])


async def list_teachers(
    db: AsyncSession,
    *,
    search: str | None,
    status: UserStatus | None,
    params: PageParams,
) -> tuple[list[schemas.TeacherOut], int]:
    conditions = [User.role == UserRole.TEACHER]
    if status is not None:
        conditions.append(User.status == status)
    if search:
        pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.username.ilike(pattern),
                User.email.ilike(pattern),
                User.phone.ilike(pattern),
            )
        )

    total = await db.scalar(select(func.count(User.id)).where(*conditions)) or 0

    group_count, student_count = _count_subqueries()

    rows = await db.execute(
        select(User, group_count, student_count)
        .where(*conditions)
        # Tasdiq kutayotganlar birinchi bo'lib chiqadi.
        .order_by(User.status, User.first_name, User.last_name)
        .offset(params.offset)
        .limit(params.size)
    )

    items = [
        _to_teacher_out(user, groups, students_total)
        for user, groups, students_total in rows.all()
    ]
    return items, total


async def pending_count(db: AsyncSession) -> int:
    return (
        await db.scalar(
            select(func.count(User.id)).where(
                User.role == UserRole.TEACHER, User.status == UserStatus.PENDING
            )
        )
        or 0
    )


async def get_teacher(db: AsyncSession, teacher_id: int) -> User:
    teacher = await db.scalar(
        select(User).where(User.id == teacher_id, User.role == UserRole.TEACHER)
    )
    if teacher is None:
        raise NotFoundError("O'qituvchi topilmadi")
    return teacher


async def _revoke_sessions(db: AsyncSession, teacher: User) -> None:
    """O'qituvchining va uning o'quvchilarining sessiyalarini yopadi.

    O'qituvchi bloklansa, o'quvchilari ham tizimdan chiqarilishi kerak —
    ularning kirishi o'qituvchi holatiga bog'liq.
    """
    from app.modules.auth.service import revoke_all_tokens

    await revoke_all_tokens(db, teacher.id)

    student_ids = list(
        await db.scalars(select(User.id).where(User.teacher_id == teacher.id))
    )
    for student_id in student_ids:
        await revoke_all_tokens(db, student_id)


async def set_status(
    db: AsyncSession, *, teacher_id: int, status: UserStatus, actor_id: int
) -> User:
    """Hisob holatini o'zgartiradi: tasdiqlash, bloklash yoki tiklash."""
    if teacher_id == actor_id:
        raise ConflictError("O'z hisobingiz holatini o'zgartira olmaysiz")

    teacher = await get_teacher(db, teacher_id)

    if status is UserStatus.ACTIVE and teacher.approved_at is None:
        teacher.approved_at = utc_now()
    teacher.status = status

    if status is not UserStatus.ACTIVE:
        await _revoke_sessions(db, teacher)

    await db.flush()
    return teacher


async def reset_teacher_password(
    db: AsyncSession, *, teacher_id: int, actor_id: int
) -> str:
    """Email va telefoni yo'q o'qituvchi uchun — admin parolni tiklab beradi.

    O'qituvchi keyingi kirishda uni almashtirishi shart.
    """
    if teacher_id == actor_id:
        raise ConflictError("O'z parolingizni profil orqali o'zgartiring")

    teacher = await get_teacher(db, teacher_id)
    temp_password = generate_temp_password()
    teacher.password_hash = hash_password(temp_password)
    teacher.must_change_password = True
    await _revoke_sessions(db, teacher)
    await db.flush()
    return temp_password


# ------------------------------------------------------ o'chirish va zaxira


async def _teacher_scope(db: AsyncSession, teacher_id: int) -> dict[str, list[int]]:
    """O'qituvchiga tegishli barcha yozuvlarning id'lari."""
    group_ids = list(
        await db.scalars(select(Group.id).where(Group.teacher_id == teacher_id))
    )
    student_ids = list(
        await db.scalars(select(User.id).where(User.teacher_id == teacher_id))
    )
    enrollment_ids = (
        list(
            await db.scalars(
                select(Enrollment.id).where(Enrollment.group_id.in_(group_ids))
            )
        )
        if group_ids
        else []
    )
    session_ids = (
        list(
            await db.scalars(
                select(AttendanceSession.id).where(
                    AttendanceSession.group_id.in_(group_ids)
                )
            )
        )
        if group_ids
        else []
    )
    charge_ids = (
        list(
            await db.scalars(
                select(MonthlyCharge.id).where(
                    MonthlyCharge.enrollment_id.in_(enrollment_ids)
                )
            )
        )
        if enrollment_ids
        else []
    )
    return {
        "groups": group_ids,
        "students": student_ids,
        "enrollments": enrollment_ids,
        "sessions": session_ids,
        "charges": charge_ids,
    }


async def delete_preview(
    db: AsyncSession, teacher_id: int
) -> schemas.TeacherDeletePreview:
    """O'chirishdan oldin nima yo'qolishini ko'rsatadi."""
    teacher = await get_teacher(db, teacher_id)
    scope = await _teacher_scope(db, teacher_id)

    payment_count = 0
    total_collected = 0
    if scope["charges"]:
        row = await db.execute(
            select(
                func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0)
            ).where(Payment.charge_id.in_(scope["charges"]))
        )
        payment_count, total_collected = row.one()

    return schemas.TeacherDeletePreview(
        teacher_id=teacher.id,
        full_name=teacher.full_name,
        group_count=len(scope["groups"]),
        student_count=len(scope["students"]),
        attendance_session_count=len(scope["sessions"]),
        payment_count=payment_count,
        total_collected=total_collected,
    )


def _dump(rows: list[Any], fields: tuple[str, ...]) -> list[dict[str, Any]]:
    """ORM obyektlarini JSON'ga tushadigan lug'atga aylantiradi."""
    result: list[dict[str, Any]] = []
    for row in rows:
        item: dict[str, Any] = {}
        for field in fields:
            value = getattr(row, field)
            item[field] = value.isoformat() if hasattr(value, "isoformat") else value
            if hasattr(value, "value"):  # enum
                item[field] = value.value
        result.append(item)
    return result


async def export_teacher(db: AsyncSession, teacher_id: int) -> schemas.TeacherExport:
    """O'qituvchining butun ma'lumotini zaxira nusxa sifatida yig'adi.

    Parol hash'lari ataylab kiritilmaydi.
    """
    teacher = await get_teacher(db, teacher_id)
    scope = await _teacher_scope(db, teacher_id)

    groups = (
        list(await db.scalars(select(Group).where(Group.id.in_(scope["groups"]))))
        if scope["groups"]
        else []
    )
    students = (
        list(await db.scalars(select(User).where(User.id.in_(scope["students"]))))
        if scope["students"]
        else []
    )
    enrollments = (
        list(
            await db.scalars(
                select(Enrollment).where(Enrollment.id.in_(scope["enrollments"]))
            )
        )
        if scope["enrollments"]
        else []
    )
    sessions = (
        list(
            await db.scalars(
                select(AttendanceSession).where(
                    AttendanceSession.id.in_(scope["sessions"])
                )
            )
        )
        if scope["sessions"]
        else []
    )
    records = (
        list(
            await db.scalars(
                select(AttendanceRecord).where(
                    AttendanceRecord.session_id.in_(scope["sessions"])
                )
            )
        )
        if scope["sessions"]
        else []
    )
    charges = (
        list(
            await db.scalars(
                select(MonthlyCharge).where(MonthlyCharge.id.in_(scope["charges"]))
            )
        )
        if scope["charges"]
        else []
    )
    payments = (
        list(
            await db.scalars(
                select(Payment).where(Payment.charge_id.in_(scope["charges"]))
            )
        )
        if scope["charges"]
        else []
    )

    user_fields = (
        "id",
        "role",
        "status",
        "first_name",
        "last_name",
        "middle_name",
        "username",
        "phone",
        "email",
        "teacher_id",
        "created_at",
    )

    return schemas.TeacherExport(
        exported_at=utc_now(),
        teacher=_dump([teacher], user_fields)[0],
        groups=_dump(
            groups,
            (
                "id",
                "name",
                "description",
                "monthly_fee",
                "schedule",
                "status",
                "created_at",
            ),
        ),
        students=_dump(students, user_fields),
        enrollments=_dump(
            enrollments,
            (
                "id",
                "group_id",
                "student_id",
                "custom_fee",
                "status",
                "joined_on",
                "left_on",
            ),
        ),
        attendance_sessions=_dump(sessions, ("id", "group_id", "session_date", "note")),
        attendance_records=_dump(
            records, ("id", "session_id", "enrollment_id", "status")
        ),
        monthly_charges=_dump(
            charges, ("id", "enrollment_id", "year", "month", "amount_due", "note")
        ),
        payments=_dump(
            payments,
            ("id", "charge_id", "amount", "method", "paid_at", "note", "reverses_id"),
        ),
    )


async def delete_teacher(
    db: AsyncSession, *, teacher_id: int, actor_id: int, confirm: str
) -> None:
    """O'qituvchini va unga tegishli HAMMA narsani o'chiradi.

    Qaytarib bo'lmaydi: guruhlar, o'quvchi hisoblari, davomat va to'lov
    tarixi butunlay yo'qoladi. Shuning uchun `confirm` maydoniga
    o'qituvchining username'i aynan yozilishi shart va o'chirishdan oldin
    `/export` orqali zaxira nusxa olish tavsiya etiladi.

    O'chirish tartibi FK cheklovlariga mos: eng chuqur bog'liq yozuvlardan
    boshlanadi.
    """
    if teacher_id == actor_id:
        raise ConflictError("O'z hisobingizni o'chira olmaysiz")

    teacher = await get_teacher(db, teacher_id)
    if confirm.strip().lower() != (teacher.username or "").lower():
        raise ValidationError(
            "Tasdiqlash uchun o'qituvchining username'ini aynan yozing"
        )

    scope = await _teacher_scope(db, teacher_id)

    if scope["charges"]:
        await db.execute(delete(Payment).where(Payment.charge_id.in_(scope["charges"])))
        await db.execute(
            delete(MonthlyCharge).where(MonthlyCharge.id.in_(scope["charges"]))
        )
    if scope["sessions"]:
        await db.execute(
            delete(AttendanceRecord).where(
                AttendanceRecord.session_id.in_(scope["sessions"])
            )
        )
        await db.execute(
            delete(AttendanceSession).where(AttendanceSession.id.in_(scope["sessions"]))
        )
    if scope["enrollments"]:
        await db.execute(
            delete(Enrollment).where(Enrollment.id.in_(scope["enrollments"]))
        )
    if scope["groups"]:
        await db.execute(delete(Group).where(Group.id.in_(scope["groups"])))

    # O'quvchi hisoblari va ularning tokenlari.
    all_user_ids = [*scope["students"], teacher_id]
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id.in_(all_user_ids)))
    await db.execute(
        delete(PasswordResetToken).where(PasswordResetToken.user_id.in_(all_user_ids))
    )
    if scope["students"]:
        await db.execute(delete(User).where(User.id.in_(scope["students"])))

    await db.execute(delete(User).where(User.id == teacher_id))
    await db.flush()
