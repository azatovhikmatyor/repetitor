import re
from datetime import date, datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    EmailStr,
    Field,
    computed_field,
)

from app.core.schemas import ORMModel
from app.modules.users.models import UserRole, UserStatus

PASSWORD_MIN_LENGTH = 8
USERNAME_PATTERN = re.compile(r"^[a-z0-9._-]{3,64}$")


def validate_password_strength(value: str) -> str:
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Parol kamida {PASSWORD_MIN_LENGTH} belgidan iborat bo'lsin")
    if value.isdigit():
        raise ValueError("Parol faqat raqamlardan iborat bo'lmasin")
    return value


def normalize_username(value: str) -> str:
    """Username kichik harfda saqlanadi — kirishda registr ahamiyatsiz."""
    normalized = value.strip().lower()
    if not USERNAME_PATTERN.fullmatch(normalized):
        raise ValueError(
            "Username 3-64 ta belgidan iborat bo'lsin: kichik harf, raqam, . _ -"
        )
    return normalized


def blank_to_none(value: str | None) -> str | None:
    """Bo'sh matnni `None` ga aylantiradi.

    Forma tozalangan maydonni bo'sh satr sifatida yuboradi, baza esa
    unikal ustunlarda bo'sh satr emas, `NULL` kutadi.
    """
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


#: Bo'sh satr avtomatik `None` bo'ladigan ixtiyoriy matn maydoni.
OptionalText = Annotated[str | None, BeforeValidator(blank_to_none)]

#: Bo'sh satr `None` bo'ladigan email.
#:
#: Forma tozalangan maydonni `""` sifatida yuboradi. `EmailStr | None` uni
#: xato deb hisoblardi va butun so'rov 422 bilan yiqilardi — hatto email
#: ixtiyoriy bo'lsa ham.
OptionalEmail = Annotated[EmailStr | None, BeforeValidator(blank_to_none)]

#: Kuchliligi tekshiriladigan parol.
Password = Annotated[str, AfterValidator(validate_password_strength)]

#: Kichik harfga keltirilib tekshiriladigan username.
Username = Annotated[str, AfterValidator(normalize_username)]


class UserOut(ORMModel):
    id: int
    role: UserRole
    status: UserStatus
    first_name: str
    last_name: str | None = None
    middle_name: str | None = None
    username: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    avatar_url: str | None = None
    must_change_password: bool
    created_at: datetime

    @computed_field
    @property
    def full_name(self) -> str:
        return (
            f"{self.first_name} {self.last_name}".strip()
            if self.last_name
            else self.first_name
        )

    @computed_field
    @property
    def is_active(self) -> bool:
        return self.status is UserStatus.ACTIVE


class MeOut(UserOut):
    last_login_at: datetime | None = None

    @computed_field
    @property
    def can_reset_password_alone(self) -> bool:
        """False bo'lsa, parolni faqat admin tiklay oladi."""
        return bool(self.email or self.phone)


class ProfileUpdate(BaseModel):
    """Profilni tahrirlash.

    Username o'zgartirilmaydi — u hisobning barqaror identifikatori.
    Profil rasmi ham bu yerda emas: u alohida `POST /auth/me/avatar`
    orqali fayl sifatida yuklanadi.
    """

    first_name: str | None = Field(default=None, min_length=2, max_length=80)
    last_name: OptionalText = Field(default=None, max_length=80)
    middle_name: OptionalText = Field(default=None, max_length=80)
    phone: OptionalText = Field(default=None, max_length=32)
    email: OptionalEmail = None


class StudentSummary(ORMModel):
    """O'quvchining qisqa ko'rinishi — ro'yxatlarda ishlatiladi."""

    id: int
    first_name: str
    last_name: str | None = None
    phone: str | None = None
    username: str | None = None
    avatar_url: str | None = None
    status: UserStatus

    @computed_field
    @property
    def full_name(self) -> str:
        return (
            f"{self.first_name} {self.last_name}".strip()
            if self.last_name
            else self.first_name
        )

    @computed_field
    @property
    def is_active(self) -> bool:
        return self.status is UserStatus.ACTIVE


class StudentListItem(StudentSummary):
    """Ro'yxat uchun: kartada ko'rsatiladigan qo'shimcha raqamlar."""

    group_count: int = 0
    group_names: list[str] = Field(default_factory=list)
    debt: int = Field(default=0, description="Barcha oylar bo'yicha yig'ilgan qarz")
    # Qidiruv shu maydonlar bo'yicha ham ishlaydi — klient topilgan joyni
    # ajratib ko'rsatishi uchun ular ham qaytadi.
    parent_name: str | None = None
    parent_phone: str | None = None
    school: str | None = None


class StudentUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=2, max_length=80)
    last_name: OptionalText = Field(default=None, max_length=80)
    middle_name: OptionalText = Field(default=None, max_length=80)
    phone: OptionalText = Field(default=None, max_length=32)
    username: OptionalText = Field(default=None, max_length=64)
    birth_date: date | None = None
    parent_name: OptionalText = Field(default=None, max_length=120)
    parent_phone: OptionalText = Field(default=None, max_length=32)
    school: OptionalText = Field(default=None, max_length=120)
    note: OptionalText = None


class TempPasswordOut(BaseModel):
    """Vaqtinchalik parol — faqat yaratilgan yoki tiklangan paytda qaytariladi."""

    user_id: int
    temporary_password: str
