from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.modules.users.schemas import (
    MeOut,
    OptionalEmail,
    OptionalText,
    Password,
    Username,
)


class TeacherRegister(BaseModel):
    """O'qituvchining ro'yxatdan o'tishi.

    Ism va familiya alohida: bir xil ismli odamlar bo'lishi mumkin,
    shuning uchun hisobning yagona identifikatori — `username`.
    Email va telefon ixtiyoriy, lekin ularsiz parolni mustaqil tiklab
    bo'lmaydi (o'shanda adminga murojaat qilinadi).
    """

    first_name: str = Field(min_length=2, max_length=80)
    last_name: str = Field(min_length=2, max_length=80)
    username: Username
    password: Password
    password_confirm: str
    email: OptionalEmail = None
    phone: OptionalText = Field(default=None, max_length=32)

    @model_validator(mode="after")
    def passwords_match(self) -> "TeacherRegister":
        if self.password != self.password_confirm:
            raise ValueError("Parollar mos kelmadi")
        return self


class RegisterResponse(BaseModel):
    """Ro'yxatdan o'tish javobi.

    Token qaytarilmaydi: hisob super admin tasdiqlamaguncha faol emas.
    """

    user_id: int
    username: str
    detail: str


class LoginRequest(BaseModel):
    # Username, email yoki telefon — bittasi.
    login: str = Field(min_length=3, max_length=254)
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: datetime
    must_change_password: bool


class LoginResponse(TokenPair):
    user: MeOut


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None
    all_devices: bool = False


class ForgotPasswordRequest(BaseModel):
    """Parolni tiklash so'rovi — email yoki telefon raqami bilan."""

    login: str = Field(min_length=3, max_length=254)


class ForgotPasswordResponse(BaseModel):
    detail: str
    channel: str | None = Field(
        default=None, description="email | sms — kod qaysi kanalga yuborilgani"
    )


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: Password
    new_password_confirm: str

    @model_validator(mode="after")
    def passwords_match(self) -> "ResetPasswordRequest":
        if self.new_password != self.new_password_confirm:
            raise ValueError("Parollar mos kelmadi")
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: Password
    new_password_confirm: str

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.new_password_confirm:
            raise ValueError("Parollar mos kelmadi")
        return self
