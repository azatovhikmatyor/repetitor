import enum
from datetime import date, time

from sqlalchemy import (
    Date,
    ForeignKey,
    Index,
    String,
    Time,
    UniqueConstraint,
    func,
    literal_column,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.types import enum_column


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    # MVP'da bor/yo'q yetarli; quyidagilar API darajasida qabul qilinadi
    # va keyingi bosqichda UI'ga chiqadi (talab 7).
    LATE = "late"
    EXCUSED = "excused"


class AttendanceSession(Base, TimestampMixin):
    """Bir guruhning bitta darsi.

    Bir kunda bir nechta dars bo'lishi mumkin (ertalab va kechqurun),
    shuning uchun unikallik kun + boshlanish vaqti bo'yicha.

    `start_time` jadvaldan KO'CHIRIB olinadi, havola qilinmaydi: jadval
    keyinchalik o'zgarsa ham o'tgan darsning vaqti o'zgarmasligi kerak.
    `slot_id` esa faqat ma'lumot uchun — slot o'chirilsa NULL bo'ladi.
    """

    __tablename__ = "attendance_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    #: Jadvalsiz (ad-hoc) dars uchun NULL.
    start_time: Mapped[time | None] = mapped_column(Time)
    slot_id: Mapped[int | None] = mapped_column(
        ForeignKey("group_schedule_slots.id", ondelete="SET NULL")
    )
    note: Mapped[str | None] = mapped_column(String(255))

    records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # NULL'lar unikallikda teng hisoblanmagani uchun COALESCE: vaqtsiz
        # dars kuniga faqat bitta bo'ladi.
        Index(
            "uq_session_group_date_time",
            "group_id",
            "session_date",
            func.coalesce(literal_column("start_time"), literal_column("'00:00:00'")),
            unique=True,
        ),
        Index("ix_sessions_group_date", "group_id", "session_date"),
    )


class AttendanceRecord(Base, TimestampMixin):
    """Bir o'quvchining bir darsdagi holati.

    Standart holat `present` — o'qituvchi faqat kelmaganlarni belgilaydi.
    """

    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False
    )
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[AttendanceStatus] = mapped_column(
        enum_column(AttendanceStatus, name="attendance_status"),
        default=AttendanceStatus.PRESENT,
        nullable=False,
    )

    session: Mapped["AttendanceSession"] = relationship(back_populates="records")

    __table_args__ = (
        UniqueConstraint(
            "session_id", "enrollment_id", name="uq_record_session_enrollment"
        ),
    )
