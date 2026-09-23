import enum
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.types import enum_column


class GroupStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class EnrollmentStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Group(Base, TimestampMixin):
    """O'qituvchi ishlaydigan asosiy birlik.

    Alohida "Kurs" entity yo'q — guruh nomi va description hammasini
    ifodalaydi (masalan "IELTS ertalabki", description'da fan/daraja/jadval).
    """

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    monthly_fee: Mapped[int] = mapped_column(Integer, nullable=False)
    schedule: Mapped[str | None] = mapped_column(String(255))

    status: Mapped[GroupStatus] = mapped_column(
        enum_column(GroupStatus, name="group_status"),
        default=GroupStatus.ACTIVE,
        nullable=False,
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    enrollments: Mapped[list["Enrollment"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("monthly_fee >= 0", name="monthly_fee_non_negative"),
        Index("ix_groups_teacher_status", "teacher_id", "status"),
    )

    @property
    def is_archived(self) -> bool:
        return self.status is GroupStatus.ARCHIVED


class Enrollment(Base, TimestampMixin):
    """O'quvchining guruhdagi a'zoligi.

    Bu atama UI'da ko'rinmaydi (talab 13: "enrollment" so'zi o'qituvchiga
    ko'rsatilmaydi) — API javoblarida ham "group student" sifatida beriladi.
    Bitta o'quvchi bir nechta guruhda bo'lishi mumkin, har biri alohida
    to'lov va davomatga ega.
    """

    __tablename__ = "enrollments"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Shu guruhdagi alohida narx. Bo'sh bo'lsa guruhning monthly_fee'si.
    # 0 — bepul o'qiydi (o'qituvchining yaqini, imtiyoz va h.k.).
    custom_fee: Mapped[int | None] = mapped_column(Integer)
    #: Nega alohida narx berilgani — bir necha oydan keyin esda qolmaydi.
    fee_note: Mapped[str | None] = mapped_column(String(255))

    status: Mapped[EnrollmentStatus] = mapped_column(
        enum_column(EnrollmentStatus, name="enrollment_status"),
        default=EnrollmentStatus.ACTIVE,
        nullable=False,
    )
    joined_on: Mapped[date] = mapped_column(Date, nullable=False)
    left_on: Mapped[date | None] = mapped_column(Date)

    group: Mapped["Group"] = relationship(back_populates="enrollments")

    __table_args__ = (
        UniqueConstraint("group_id", "student_id", name="uq_enrollment_group_student"),
        CheckConstraint(
            "custom_fee IS NULL OR custom_fee >= 0", name="custom_fee_non_negative"
        ),
        Index("ix_enrollments_group_status", "group_id", "status"),
    )

    @property
    def is_active(self) -> bool:
        return self.status is EnrollmentStatus.ACTIVE

    @property
    def is_free(self) -> bool:
        return self.custom_fee == 0

    def effective_fee(self, group: "Group | None" = None) -> int:
        """Shu oy uchun amaldagi narx.

        Guruh narxi o'zgarsa faqat kelajakdagi oylarga ta'sir qiladi:
        o'tgan oylarning `amount_due` qiymati MonthlyCharge'da muzlatilgan
        (talab 12), shuning uchun bu yerda faqat yangi hisob uchun ishlatiladi.
        """
        if self.custom_fee is not None:
            return self.custom_fee
        return (group or self.group).monthly_fee
