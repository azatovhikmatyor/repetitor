"""Jadval bilan ishlash: versiyalar va ularni sanalarga yoyish."""

from datetime import date, time, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import local_today
from app.core.exceptions import ValidationError
from app.modules.groups import schedule_schemas as schemas
from app.modules.groups.models import Group
from app.modules.groups.schedule_models import (
    WEEKDAY_NAMES,
    ScheduleSlot,
    ScheduleVersion,
)


async def list_versions(db: AsyncSession, group_id: int) -> list[ScheduleVersion]:
    """Barcha versiyalar — yangisi birinchi."""
    return list(
        await db.scalars(
            select(ScheduleVersion)
            .where(ScheduleVersion.group_id == group_id)
            .order_by(ScheduleVersion.effective_from.desc())
        )
    )


def version_for(versions: list[ScheduleVersion], day: date) -> ScheduleVersion | None:
    """Shu kuni amalda bo'lgan versiya."""
    for version in versions:
        if version.covers(day):
            return version
    return None


def display_text(version: ScheduleVersion | None) -> str | None:
    """Jadvalning qisqa matni: `Du 08:00 · Chor 08:00 · Ju 10:00`.

    Guruh ro'yxati va kartalarida shu matn ko'rinadi — u `groups.schedule`
    ustunida keshlanadi, chunki har bir ro'yxat so'rovida slotlarni
    yuklash keraksiz.
    """
    if version is None or not version.slots:
        return None

    # Bir xil vaqtdagi kunlarni birlashtiramiz: "Du/Chor 08:00".
    by_time: dict[time, list[int]] = {}
    for slot in version.slots:
        by_time.setdefault(slot.start_time, []).append(slot.weekday)

    parts = []
    for start, weekdays in sorted(by_time.items()):
        days = "/".join(WEEKDAY_NAMES[day] for day in sorted(weekdays))
        parts.append(f"{days} {start.strftime('%H:%M')}")
    return " · ".join(parts)


async def refresh_display(db: AsyncSession, group: Group) -> None:
    """`groups.schedule` keshini bugungi amaldagi versiyadan yangilaydi."""
    versions = await list_versions(db, group.id)
    group.schedule = display_text(version_for(versions, local_today()))


async def replace_schedule(
    db: AsyncSession, *, group: Group, data: schemas.ScheduleUpdate
) -> ScheduleVersion:
    """Yangi jadval versiyasini ochadi.

    `effective_from` dan boshlab yangi jadval amal qiladi, undan oldingi
    versiya bir kun oldin yopiladi. Shu sababli o'tgan oylarning jadvali
    o'zgarmaydi — hisobotlar ham, "rejadagi darslar" ham o'sha paytdagi
    holicha qoladi.

    O'sha kuni allaqachon versiya ochilgan bo'lsa (kun davomida bir necha
    marta tahrirlash), yangisi qo'shilmaydi — mavjudining slotlari
    almashtiriladi.
    """
    effective_from = data.effective_from or local_today()

    seen: set[tuple[int, time]] = set()
    for slot in data.slots:
        key = (slot.weekday, slot.start_time)
        if key in seen:
            raise ValidationError(
                f"{WEEKDAY_NAMES[slot.weekday]} kuni {slot.start_time:%H:%M} "
                "ikki marta kiritilgan"
            )
        seen.add(key)

    new_slots = [
        ScheduleSlot(
            weekday=slot.weekday,
            start_time=slot.start_time,
            end_time=slot.end_time,
        )
        for slot in data.slots
    ]

    versions = await list_versions(db, group.id)
    existing = next((v for v in versions if v.effective_from == effective_from), None)

    if existing is not None:
        version = existing
        version.note = data.note
        # To'g'ridan-to'g'ri DELETE: bog'langan kolleksiyani async sessiyada
        # lazy yuklashdan qochamiz.
        await db.execute(
            delete(ScheduleSlot).where(ScheduleSlot.version_id == version.id)
        )
        await db.flush()
        for slot in new_slots:
            slot.version_id = version.id
            db.add(slot)
    else:
        # Kelajakdagi versiyalar bo'lsa, yangisi ulardan oldin turishi kerak.
        later = [v for v in versions if v.effective_from > effective_from]
        version = ScheduleVersion(
            group_id=group.id,
            effective_from=effective_from,
            effective_to=(
                min(v.effective_from for v in later) - timedelta(days=1)
                if later
                else None
            ),
            note=data.note,
            slots=new_slots,
        )
        db.add(version)

        for previous in versions:
            if previous.effective_from < effective_from and (
                previous.effective_to is None or previous.effective_to >= effective_from
            ):
                previous.effective_to = effective_from - timedelta(days=1)
        await db.flush()

    await db.flush()
    await refresh_display(db, group)
    return version


async def lessons_in_range(
    db: AsyncSession, *, group_id: int, start: date, end: date
) -> list[schemas.PlannedLesson]:
    """Oraliqdagi rejadagi darslar.

    Har bir sana o'sha kuni amalda bo'lgan versiyaga qarab hisoblanadi —
    shuning uchun jadval o'rtada o'zgargan oy ham to'g'ri chiqadi.
    """
    versions = await list_versions(db, group_id)
    if not versions:
        return []

    lessons: list[schemas.PlannedLesson] = []
    day = start
    while day <= end:
        version = version_for(versions, day)
        if version is not None:
            for slot in version.slots:
                if slot.weekday == day.weekday():
                    lessons.append(
                        schemas.PlannedLesson(
                            lesson_date=day,
                            start_time=slot.start_time,
                            end_time=slot.end_time,
                            slot_id=slot.id,
                        )
                    )
        day += timedelta(days=1)

    lessons.sort(key=lambda item: (item.lesson_date, item.start_time))
    return lessons


async def slot_for(
    db: AsyncSession, *, group_id: int, day: date, start_time: time | None
) -> ScheduleSlot | None:
    """Sana va vaqtga mos slot — davomat sessiyasiga bog'lash uchun."""
    versions = await list_versions(db, group_id)
    version = version_for(versions, day)
    if version is None:
        return None

    candidates = [slot for slot in version.slots if slot.weekday == day.weekday()]
    if not candidates:
        return None
    if start_time is None:
        # Kunda bitta dars bo'lsa uni tanlash aniq; bir nechta bo'lsa
        # qaysi biri ekanini chaqiruvchi ko'rsatishi kerak.
        return candidates[0] if len(candidates) == 1 else None
    return next((slot for slot in candidates if slot.start_time == start_time), None)
