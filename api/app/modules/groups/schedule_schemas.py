from datetime import date, time

from pydantic import BaseModel, Field, model_validator

from app.modules.groups.schedule_models import WEEKDAY_NAMES


class SlotIn(BaseModel):
    weekday: int = Field(ge=0, le=6, description="0 — dushanba")
    start_time: time
    end_time: time | None = None

    @model_validator(mode="after")
    def check_order(self) -> "SlotIn":
        if self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("Tugash vaqti boshlanishdan keyin bo'lsin")
        return self


class SlotOut(SlotIn):
    id: int
    weekday_name: str


class ScheduleUpdate(BaseModel):
    """Yangi jadval versiyasi.

    `effective_from` — shu sanadan boshlab amal qiladi. Bo'sh bo'lsa
    bugundan. O'tgan sanani ko'rsatish mumkin (jadval allaqachon
    o'zgargan, lekin tizimga endi kiritilmoqda).
    """

    effective_from: date | None = None
    note: str | None = Field(default=None, max_length=255)
    slots: list[SlotIn] = Field(default_factory=list)


class ScheduleVersionOut(BaseModel):
    id: int
    effective_from: date
    effective_to: date | None
    note: str | None
    is_current: bool
    display: str | None = Field(description="Qisqa matn: `Du/Chor 08:00`")
    slots: list[SlotOut]


class GroupScheduleOut(BaseModel):
    group_id: int
    current: ScheduleVersionOut | None
    history: list[ScheduleVersionOut] = Field(
        description="Barcha versiyalar, yangisi birinchi"
    )


class PlannedLesson(BaseModel):
    """Jadval bo'yicha bo'lishi kerak bo'lgan dars."""

    lesson_date: date
    start_time: time
    end_time: time | None = None
    slot_id: int | None = None


def weekday_name(weekday: int) -> str:
    return WEEKDAY_NAMES[weekday]
