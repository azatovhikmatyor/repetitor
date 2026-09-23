"""Guruh dars jadvali — versiyalangan.

Nega versiya: jadval vaqt o'tishi bilan o'zgaradi (sentabrda Du/Chor 08:00
edi, oktabrdan Se/Pay 10:00 bo'ldi). Agar jadval bitta bo'lsa, uni
o'zgartirgan zahoti o'tgan oylarning "rejalashtirilgan darslari" ham
o'zgarib ketardi va eski hisobotlar buzilardi.

Shuning uchun har bir tahrir yangi `ScheduleVersion` yaratadi, eskisi esa
`effective_to` bilan yopiladi. Har qanday sana uchun "o'sha kuni amalda
bo'lgan jadval" doim topiladi.

Davomat yozuvlarining o'zi ham himoyalangan: `AttendanceSession` dars
vaqtini ko'chirib oladi (`start_time`), shuning uchun slot keyinchalik
o'chirilsa ham o'tgan dars vaqti joyida qoladi.
"""

from datetime import date, time

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

#: 0 — dushanba (Python `date.weekday()` bilan bir xil).
WEEKDAY_NAMES = ["Du", "Se", "Chor", "Pay", "Ju", "Shan", "Yak"]


class ScheduleVersion(Base, TimestampMixin):
    __tablename__ = "group_schedule_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )

    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    #: NULL — hozir amalda bo'lgan versiya.
    effective_to: Mapped[date | None] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(255))

    slots: Mapped[list["ScheduleSlot"]] = relationship(
        back_populates="version",
        cascade="all, delete-orphan",
        order_by="ScheduleSlot.weekday, ScheduleSlot.start_time",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("group_id", "effective_from", name="uq_schedule_group_from"),
        CheckConstraint(
            "effective_to IS NULL OR effective_to >= effective_from",
            name="schedule_period_order",
        ),
        Index("ix_schedule_group_from", "group_id", "effective_from"),
    )

    def covers(self, day: date) -> bool:
        if day < self.effective_from:
            return False
        return self.effective_to is None or day <= self.effective_to


class ScheduleSlot(Base, TimestampMixin):
    """Haftaning bir kunidagi bitta dars.

    Bir kunda bir nechta slot bo'lishi mumkin (ertalab va kechqurun) —
    shuning uchun unikallik kun emas, kun + boshlanish vaqti bo'yicha.
    """

    __tablename__ = "group_schedule_slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    version_id: Mapped[int] = mapped_column(
        ForeignKey("group_schedule_versions.id", ondelete="CASCADE"), nullable=False
    )

    weekday: Mapped[int] = mapped_column(nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time | None] = mapped_column(Time)

    version: Mapped["ScheduleVersion"] = relationship(back_populates="slots")

    __table_args__ = (
        UniqueConstraint(
            "version_id", "weekday", "start_time", name="uq_slot_version_weekday_time"
        ),
        CheckConstraint("weekday BETWEEN 0 AND 6", name="weekday_range"),
        CheckConstraint(
            "end_time IS NULL OR end_time > start_time", name="slot_time_order"
        ),
    )

    @property
    def label(self) -> str:
        return f"{WEEKDAY_NAMES[self.weekday]} {self.start_time.strftime('%H:%M')}"
