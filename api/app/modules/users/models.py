import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.types import enum_column


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    TEACHER = "teacher"
    STUDENT = "student"


class UserStatus(str, enum.Enum):
    """Hisob holati.

    O'qituvchi ro'yxatdan o'tganda `pending` bo'ladi va super admin
    tasdiqlamaguncha tizimga kira olmaydi. O'quvchi hisobini o'qituvchi
    yaratadi — u darhol `active`.
    """

    PENDING = "pending"
    ACTIVE = "active"
    BLOCKED = "blocked"


class User(Base, TimestampMixin):
    """Platformaning yagona foydalanuvchi jadvali.

    Ism uch bo'lakka ajratilgan: bir xil ism-familiyali odamlar bo'lishi
    mumkin, shuning uchun hisobning yagona va o'zgarmas identifikatori —
    `username`.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[UserRole] = mapped_column(
        enum_column(UserRole, name="user_role"), nullable=False, index=True
    )
    status: Mapped[UserStatus] = mapped_column(
        enum_column(UserStatus, name="user_status"),
        default=UserStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(80))
    # Sharifi (otasining ismi) — ixtiyoriy, profildan to'ldiriladi.
    middle_name: Mapped[str | None] = mapped_column(String(80))

    # Login identifikatorlari. `username` o'qituvchi uchun majburiy,
    # email va telefon ixtiyoriy — lekin ularning bittasi bo'lsa
    # parolni mustaqil tiklash mumkin bo'ladi.
    username: Mapped[str | None] = mapped_column(String(64), unique=True)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True)
    email: Mapped[str | None] = mapped_column(String(254), unique=True)

    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))

    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # O'quvchi ilovaga kira olmay qolsa, shu vaqtni belgilab o'qituvchisiga
    # so'rov yuboradi — o'qituvchi FAQAT shunda parolni tiklay oladi.
    # Bo'sh bo'lsa, o'qituvchi o'z ixtiyori bilan parolni o'zgartira olmaydi.
    password_reset_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    # --- Faqat o'quvchi uchun to'ldiriladigan maydonlar ---
    # Alohida jadval qilinmadi: o'quvchi ham shu jadvalda yashaydi va
    # `teacher_id` allaqachon shunday — rolga bog'liq maydon.
    birth_date: Mapped[date | None] = mapped_column(Date)
    #: Ota-ona yoki vasiy — o'qituvchi ko'pincha shu raqamga qo'ng'iroq qiladi.
    parent_name: Mapped[str | None] = mapped_column(String(120))
    parent_phone: Mapped[str | None] = mapped_column(String(32))
    #: Maktab/sinf yoki kurs joyi.
    school: Mapped[str | None] = mapped_column(String(120))
    #: O'qituvchining erkin izohi.
    note: Mapped[str | None] = mapped_column(Text)

    # O'quvchini qaysi o'qituvchi yaratgan. Ma'lumot izolyatsiyasining
    # tayanchi va bloklash zanjiri: o'qituvchi bloklansa, uning
    # o'quvchilari ham tizimga kira olmaydi.
    teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )

    teacher: Mapped["User | None"] = relationship(
        remote_side="User.id", back_populates="students"
    )
    students: Mapped[list["User"]] = relationship(back_populates="teacher")

    __table_args__ = (
        # O'qituvchi har doim username bilan kiradi.
        CheckConstraint(
            "role <> 'teacher' OR username IS NOT NULL",
            name="teacher_requires_username",
        ),
        # O'quvchiga o'qituvchi telefon yoki username beradi.
        CheckConstraint(
            "role <> 'student' OR phone IS NOT NULL OR username IS NOT NULL",
            name="student_requires_login_identifier",
        ),
        CheckConstraint(
            "teacher_id IS NULL OR role = 'student'",
            name="only_student_has_teacher",
        ),
        Index("ix_users_teacher_role", "teacher_id", "role"),
        Index("ix_users_name", "first_name", "last_name"),
    )

    @property
    def full_name(self) -> str:
        """Ro'yxatlarda ko'rsatiladigan to'liq ism."""
        return (
            f"{self.first_name} {self.last_name}".strip()
            if self.last_name
            else self.first_name
        )

    @property
    def display_name(self) -> str:
        """Sharifi bilan to'liq ism — profil va hujjatlar uchun."""
        parts = [self.last_name, self.first_name, self.middle_name]
        return " ".join(part for part in parts if part)

    @property
    def is_active(self) -> bool:
        return self.status is UserStatus.ACTIVE

    @property
    def can_reset_password_alone(self) -> bool:
        """Email yoki telefonsiz parolni o'zi tiklay olmaydi — adminga murojaat."""
        return bool(self.email or self.phone)

    def __repr__(self) -> str:  # pragma: no cover - debug qulayligi uchun
        return f"<User {self.id} {self.role.value} {self.username!r}>"


class RefreshToken(Base):
    """Bekor qilinadigan refresh token.

    Tokenning o'zi emas, SHA-256 hash'i saqlanadi (talab: o'g'irlanganda
    bekor qilish imkoniyati).
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jti: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    user_agent: Mapped[str | None] = mapped_column(String(255))

    @property
    def is_usable(self) -> bool:
        from app.core.clock import as_utc, utc_now

        return self.revoked_at is None and as_utc(self.expires_at) > utc_now()


class PasswordResetToken(Base):
    """Bir martalik parol tiklash kodi (email yoki SMS orqali, ~30 daqiqa)."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # Kod qaysi kanal orqali yuborilgani — foydalanuvchiga ko'rsatish uchun.
    channel: Mapped[str] = mapped_column(String(10), default="email", nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
