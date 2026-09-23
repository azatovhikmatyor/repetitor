"""Autentifikatsiya biznes-mantiqi.

Router faqat HTTP bilan ishlaydi; bu yerda hech qanday `Request`/`Response`
yo'q — shu sababli oqimlarni test qilish oson.
"""

from datetime import timedelta

import jwt
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import as_utc, utc_now
from app.core.config import settings
from app.core.exceptions import (
    AuthenticationError,
    ConflictError,
    PermissionDeniedError,
    ValidationError,
)
from app.core.notify import notify_admin_new_teacher, send_password_reset_code
from app.core.rate_limit import check_login_attempt, clear_login_attempts
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_url_token,
    hash_password,
    hash_token,
    needs_rehash,
    verify_password,
)
from app.modules.auth import schemas
from app.modules.users.models import (
    PasswordResetToken,
    RefreshToken,
    User,
    UserRole,
    UserStatus,
)
from app.modules.users.service import (
    effective_status,
    ensure_identifiers_free,
    find_by_login,
)

# Login noto'g'ri bo'lganda sabab oshkor qilinmaydi — hisoblarni sanab
# chiqishning oldini oladi. Holat haqidagi aniq xabar esa faqat parol
# to'g'ri bo'lganda beriladi.
_INVALID_CREDENTIALS = "Login yoki parol noto'g'ri"

_STATUS_MESSAGES = {
    UserStatus.PENDING: (
        "Hisobingiz hali tasdiqlanmagan. Administrator tasdiqlagach kira olasiz."
    ),
    UserStatus.BLOCKED: "Hisobingiz bloklangan. Administratorga murojaat qiling.",
}


async def register_teacher(db: AsyncSession, data: schemas.TeacherRegister) -> User:
    """Yangi o'qituvchi hisobi — tasdiqlashni kutadigan holatda.

    Token qaytarilmaydi: super admin tasdiqlamaguncha tizimga kira olmaydi.
    """
    await ensure_identifiers_free(
        db, username=data.username, phone=data.phone, email=data.email
    )

    user = User(
        role=UserRole.TEACHER,
        status=UserStatus.PENDING,
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        username=data.username,
        email=data.email.lower() if data.email else None,
        phone=data.phone,
        password_hash=hash_password(data.password),
        must_change_password=False,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:  # poyga holati: bir vaqtda ikki ro'yxat
        raise ConflictError("Bu username, email yoki telefon allaqachon band") from exc

    await notify_admin_new_teacher(
        admin_emails=settings.admin_email_list, teacher=user.full_name
    )
    return user


async def authenticate(db: AsyncSession, *, login: str, password: str) -> User:
    check_login_attempt(login.strip().lower())

    user = await find_by_login(db, login)
    if user is None or not verify_password(password, user.password_hash):
        raise AuthenticationError(_INVALID_CREDENTIALS)

    # Parol to'g'ri — endi holatni aniq tushuntirish mumkin, bu hisob
    # mavjudligini oshkor qilmaydi.
    status = await effective_status(db, user)
    if status is not UserStatus.ACTIVE:
        raise PermissionDeniedError(_STATUS_MESSAGES[status])

    # Argon2 parametrlari yangilansa parolni jimgina qayta hashlaymiz.
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    user.last_login_at = utc_now()
    clear_login_attempts(login.strip().lower())
    return user


async def issue_tokens(
    db: AsyncSession, user: User, *, user_agent: str | None = None
) -> schemas.TokenPair:
    access_token, expires_at = create_access_token(
        user.id, role=user.role.value, must_change_password=user.must_change_password
    )
    refresh_token, jti, refresh_expires = create_refresh_token(user.id)

    db.add(
        RefreshToken(
            user_id=user.id,
            jti=jti,
            token_hash=hash_token(refresh_token),
            expires_at=refresh_expires,
            created_at=utc_now(),
            user_agent=(user_agent or "")[:255] or None,
        )
    )
    await db.flush()

    return schemas.TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
        must_change_password=user.must_change_password,
    )


async def _load_refresh_token(db: AsyncSession, raw_token: str) -> RefreshToken:
    try:
        payload = decode_token(raw_token, expected_type="refresh")
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Refresh token yaroqsiz yoki muddati o'tgan") from exc

    stored = await db.scalar(
        select(RefreshToken).where(RefreshToken.jti == payload["jti"])
    )
    if stored is None or stored.token_hash != hash_token(raw_token):
        raise AuthenticationError("Refresh token yaroqsiz yoki muddati o'tgan")
    if not stored.is_usable:
        # Bekor qilingan token bilan urinish — xavfsizlik nuqtai nazaridan
        # shubhali, shuning uchun foydalanuvchining barcha sessiyalari yopiladi.
        await revoke_all_tokens(db, stored.user_id)
        raise AuthenticationError("Refresh token bekor qilingan")
    return stored


async def refresh_tokens(
    db: AsyncSession, raw_token: str, *, user_agent: str | None = None
) -> tuple[User, schemas.TokenPair]:
    """Rotatsiya: eski refresh token bekor qilinadi, yangi juftlik beriladi."""
    stored = await _load_refresh_token(db, raw_token)
    stored.revoked_at = utc_now()

    user = await db.get(User, stored.user_id)
    if user is None or await effective_status(db, user) is not UserStatus.ACTIVE:
        raise AuthenticationError("Hisob faol emas")

    tokens = await issue_tokens(db, user, user_agent=user_agent)
    return user, tokens


async def revoke_token(db: AsyncSession, raw_token: str) -> None:
    try:
        stored = await _load_refresh_token(db, raw_token)
    except AuthenticationError:
        return  # logout har doim muvaffaqiyatli tugaydi
    stored.revoked_at = utc_now()


async def revoke_all_tokens(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utc_now())
    )


async def request_password_reset(
    db: AsyncSession, login: str
) -> schemas.ForgotPasswordResponse:
    """Parolni tiklashni boshlaydi — email yoki telefon orqali.

    Foydalanuvchi topilmasa ham xatolik qaytarilmaydi: aks holda qaysi
    email/telefon ro'yxatdan o'tganini aniqlash mumkin bo'lib qoladi.
    Email ham, telefon ham qo'yilmagan bo'lsa — parolni faqat admin tiklay
    oladi va javobda shu aytiladi.
    """
    generic = schemas.ForgotPasswordResponse(
        detail=(
            "Agar bunday hisob mavjud bo'lsa, tiklash kodi yuborildi. "
            "Kod 30 daqiqa amal qiladi."
        )
    )

    check_login_attempt(f"reset:{login.strip().lower()}")

    user = await find_by_login(db, login)
    if user is None or user.status is UserStatus.BLOCKED:
        return generic

    if not user.can_reset_password_alone:
        return schemas.ForgotPasswordResponse(
            detail=(
                "Hisobingizda email ham, telefon raqami ham qo'yilmagan. "
                "Parolni tiklash uchun administratorga murojaat qiling."
            )
        )

    # Kiritilgan identifikator bo'yicha kanalni tanlaymiz.
    entered = login.strip().lower()
    if user.phone and entered == user.phone.lower():
        channel, destination = "sms", user.phone
    elif user.email:
        channel, destination = "email", user.email
    else:
        channel, destination = "sms", user.phone or ""

    raw_token = generate_url_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            channel=channel,
            expires_at=utc_now()
            + timedelta(minutes=settings.password_reset_expire_minutes),
            created_at=utc_now(),
        )
    )
    await db.flush()
    await send_password_reset_code(
        to=destination,
        channel=channel,
        token=raw_token,
        minutes=settings.password_reset_expire_minutes,
    )
    return schemas.ForgotPasswordResponse(detail=generic.detail, channel=channel)


async def reset_password(db: AsyncSession, *, token: str, new_password: str) -> None:
    stored = await db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hash_token(token)
        )
    )
    now = utc_now()
    if stored is None or stored.used_at is not None or as_utc(stored.expires_at) <= now:
        raise ValidationError("Kod yaroqsiz yoki muddati o'tgan")

    user = await db.get(User, stored.user_id)
    if user is None or user.status is UserStatus.BLOCKED:
        raise ValidationError("Kod yaroqsiz yoki muddati o'tgan")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    stored.used_at = now
    # Parol o'zgardi — barcha eski sessiyalar yopiladi.
    await revoke_all_tokens(db, user.id)


async def change_password(
    db: AsyncSession, user: User, *, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise AuthenticationError("Joriy parol noto'g'ri")
    if current_password == new_password:
        raise ValidationError("Yangi parol eskisidan farq qilsin")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    await revoke_all_tokens(db, user.id)
