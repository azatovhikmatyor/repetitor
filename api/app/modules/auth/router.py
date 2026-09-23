from typing import Annotated

from fastapi import APIRouter, File, UploadFile, status

from app.api.deps import CurrentUser, DbSession, UserAgent
from app.core.schemas import Message
from app.core.storage import delete_avatar, save_avatar
from app.modules.auth import schemas, service
from app.modules.users.models import User
from app.modules.users.schemas import MeOut, ProfileUpdate
from app.modules.users.service import ensure_identifiers_free

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=schemas.RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="O'qituvchi ro'yxatdan o'tishi",
)
async def register(
    data: schemas.TeacherRegister, db: DbSession
) -> schemas.RegisterResponse:
    """Yangi o'qituvchi hisobini ochadi — tasdiqlashni kutadigan holatda.

    Token qaytarilmaydi: super admin tasdiqlamaguncha tizimga kirib
    bo'lmaydi. Username band bo'lsa 409 qaytadi va `details` ichida aynan
    qaysi maydon bandligi ko'rsatiladi.

    O'quvchi hisobi bu yerdan ochilmaydi — uni o'qituvchi o'z guruhiga
    qo'shganda tizim yaratadi.
    """
    user = await service.register_teacher(db, data)
    return schemas.RegisterResponse(
        user_id=user.id,
        username=user.username or "",
        detail=(
            "Ro'yxatdan o'tdingiz. Hisobingiz administrator tasdiqlagandan "
            "keyin faollashadi."
        ),
    )


@router.post("/login", response_model=schemas.LoginResponse, summary="Tizimga kirish")
async def login(
    data: schemas.LoginRequest, db: DbSession, user_agent: UserAgent
) -> schemas.LoginResponse:
    """Username, email yoki telefon bilan kirish.

    Hisob tasdiqlanmagan yoki bloklangan bo'lsa 403 va sababi qaytadi.
    O'quvchi uchun o'qituvchisining holati ham tekshiriladi: o'qituvchi
    bloklansa, uning o'quvchilari ham kira olmaydi.
    """
    user = await service.authenticate(db, login=data.login, password=data.password)
    tokens = await service.issue_tokens(db, user, user_agent=user_agent)
    return schemas.LoginResponse(**tokens.model_dump(), user=MeOut.model_validate(user))


@router.post(
    "/refresh", response_model=schemas.TokenPair, summary="Tokenlarni yangilash"
)
async def refresh(
    data: schemas.RefreshRequest, db: DbSession, user_agent: UserAgent
) -> schemas.TokenPair:
    """Refresh token rotatsiyasi — eski token darhol bekor qilinadi."""
    _, tokens = await service.refresh_tokens(
        db, data.refresh_token, user_agent=user_agent
    )
    return tokens


@router.post("/logout", response_model=Message, summary="Chiqish")
async def logout(
    data: schemas.LogoutRequest, db: DbSession, user: CurrentUser
) -> Message:
    if data.all_devices:
        await service.revoke_all_tokens(db, user.id)
    elif data.refresh_token:
        await service.revoke_token(db, data.refresh_token)
    return Message(detail="Chiqildi")


@router.get("/me", response_model=MeOut, summary="O'z profilim")
async def me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=MeOut, summary="Profilni tahrirlash")
async def update_me(data: ProfileUpdate, db: DbSession, user: CurrentUser) -> User:
    """Ism, sharif, email, telefon va profil rasmini yangilaydi.

    Username o'zgartirilmaydi — u hisobning barqaror identifikatori.
    """
    payload = data.model_dump(exclude_unset=True)
    if payload:
        await ensure_identifiers_free(
            db,
            phone=payload.get("phone"),
            email=payload.get("email"),
            exclude_user_id=user.id,
        )
    for field, value in payload.items():
        setattr(user, field, value.lower() if field == "email" and value else value)
    await db.flush()
    return user


@router.post(
    "/me/avatar",
    response_model=MeOut,
    summary="Profil rasmini yuklash",
)
async def upload_avatar(
    db: DbSession,
    user: CurrentUser,
    file: Annotated[UploadFile, File(description="JPG, PNG yoki WEBP")],
) -> User:
    """Rasmni yuklaydi, 512×512 gacha kichraytiradi va profilga biriktiradi.

    Fayl turi `Content-Type` ga emas, haqiqiy mazmuniga qarab tekshiriladi.
    Eski rasm diskdan o'chiriladi.
    """
    content = await file.read()
    url = save_avatar(content)

    previous = user.avatar_url
    user.avatar_url = url
    await db.flush()

    # Yangisi saqlangandan keyin eskisini o'chiramiz — xatolik bo'lsa
    # foydalanuvchi rasmsiz qolmaydi.
    delete_avatar(previous)
    return user


@router.delete(
    "/me/avatar",
    response_model=MeOut,
    summary="Profil rasmini o'chirish",
)
async def remove_avatar(db: DbSession, user: CurrentUser) -> User:
    previous = user.avatar_url
    user.avatar_url = None
    await db.flush()
    delete_avatar(previous)
    return user


@router.post(
    "/password/forgot",
    response_model=schemas.ForgotPasswordResponse,
    summary="Parolni unutdim",
)
async def forgot_password(
    data: schemas.ForgotPasswordRequest, db: DbSession
) -> schemas.ForgotPasswordResponse:
    """Email yoki telefon raqamiga bir martalik kod yuboradi.

    Javob hisob mavjudligini oshkor qilmaydi. Hisobda email ham, telefon
    ham qo'yilmagan bo'lsa — parolni faqat administrator tiklay oladi va
    javobda shu aytiladi.
    """
    return await service.request_password_reset(db, data.login)


@router.post(
    "/password/reset", response_model=Message, summary="Kod bilan yangi parol qo'yish"
)
async def reset_password(data: schemas.ResetPasswordRequest, db: DbSession) -> Message:
    await service.reset_password(db, token=data.token, new_password=data.new_password)
    return Message(detail="Parol yangilandi. Endi yangi parol bilan kiring.")


@router.post("/password/change", response_model=Message, summary="Parolni o'zgartirish")
async def change_password(
    data: schemas.ChangePasswordRequest, db: DbSession, user: CurrentUser
) -> Message:
    """Muvaffaqiyatli o'zgartirishdan keyin barcha sessiyalar yopiladi."""
    await service.change_password(
        db,
        user,
        current_password=data.current_password,
        new_password=data.new_password,
    )
    return Message(detail="Parol o'zgartirildi. Qaytadan kiring.")
