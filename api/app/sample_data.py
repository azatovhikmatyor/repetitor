"""Mavjud o'qituvchiga namuna (sample) ma'lumot to'ldirish.

`seed-demo` dan farqi: u bo'sh bazani ishga tushirish uchun, bu esa
allaqachon bor hisobga bir necha oylik "haqiqiy ishga o'xshash" tarix
qo'shadi — hisobot, davomat va qarz ekranlarini shunday sinash mumkin.

Raqamlar ataylab tekis emas: qarzdorlar, qisman to'lovlar, kech qo'shilgan
o'quvchilar va dars qoldirishlar bor.
"""

import random
from calendar import monthrange
from datetime import date, datetime, time, timedelta
from typing import NamedTuple

from sqlalchemy import select

from app.core.clock import (
    LOCAL_TZ,
    current_period,
    local_today,
    shift_period,
)
from app.core.security import hash_password
from app.db.registry import (
    AttendanceRecord,
    AttendanceSession,
    Enrollment,
    Group,
    MonthlyCharge,
    Payment,
    User,
)
from app.db.session import SessionLocal
from app.modules.attendance.models import AttendanceStatus
from app.modules.groups.schedule_models import ScheduleSlot, ScheduleVersion
from app.modules.groups.schedule_service import display_text
from app.modules.payments.models import PaymentMethod
from app.modules.users.models import UserRole, UserStatus

MALE_NAMES = [
    "Aziz",
    "Bobur",
    "Doston",
    "Elyor",
    "Farrux",
    "Hasan",
    "Ibrohim",
    "Jasur",
    "Kamron",
    "Lazizbek",
    "Muhammadali",
    "Nodir",
    "Otabek",
    "Rustam",
    "Sardor",
    "Temur",
    "Shohruh",
    "Zafar",
]

FEMALE_NAMES = [
    "Aziza",
    "Barno",
    "Dilnoza",
    "Elnora",
    "Feruza",
    "Gulnora",
    "Hilola",
    "Iroda",
    "Jamila",
    "Kamola",
    "Laylo",
    "Madina",
    "Nigora",
    "Rayhona",
    "Sevara",
    "Malika",
    "Umida",
    "Shahnoza",
    "Zilola",
]

SURNAMES = [
    "Abdullayev",
    "Bekmurodov",
    "Toshmatov",
    "Ergashev",
    "Yusupov",
    "Hamidov",
    "Ismoilov",
    "Karimov",
    "Latipov",
    "Mirzayev",
    "Normatov",
    "Olimov",
    "Rahimov",
    "Saidov",
    "Tursunov",
    "Usmonov",
    "Xolmatov",
    "Zokirov",
    "Qodirov",
    "Nazarov",
    "Sharipov",
    "Aliyev",
]

#: Jadval sloti: (hafta kuni, boshlanish, tugash). 0 — dushanba.
Slot = tuple[int, str, str]


class SampleGroup(NamedTuple):
    name: str
    monthly_fee: int
    description: str
    slots: list[Slot]
    #: Jadval o'zgarishi: necha oy oldin va yangi slotlar. Bo'sh — o'zgarmagan.
    change_months_ago: int | None = None
    new_slots: list[Slot] | None = None


SAMPLE_GROUPS = [
    # Har kuni bir xil vaqt — eng oddiy holat.
    SampleGroup(
        "IELTS intensiv",
        600_000,
        "IELTS 6.5+ maqsadida",
        [(0, "08:00", "09:30"), (2, "08:00", "09:30"), (4, "08:00", "09:30")],
    ),
    # Kunlar turli vaqtda: ish kuni kechqurun, shanba ertalab.
    SampleGroup(
        "Ingliz tili boshlang'ich",
        400_000,
        "A1-A2 daraja",
        [(1, "18:00", "19:30"), (3, "18:00", "19:30"), (5, "10:00", "11:30")],
    ),
    # Bir kunda ikki dars: ertalabki va kechqurungi guruhcha.
    SampleGroup(
        "Matematika 11-sinf",
        500_000,
        "Blok fanlarga tayyorlov",
        [(0, "09:00", "10:30"), (0, "16:00", "17:30"), (3, "09:00", "10:30")],
    ),
    # Jadval o'rtada o'zgargan — tarix o'sha paytdagi holicha qoladi.
    SampleGroup(
        "Fizika 9-sinf",
        450_000,
        "Maktab dasturi bo'yicha",
        [(1, "17:00", "18:30"), (3, "17:00", "18:30")],
        change_months_ago=2,
        new_slots=[(2, "15:00", "16:30"), (5, "09:00", "10:30")],
    ),
]

#: Joriy oy ham shunga kiradi.
MONTHS_BACK = 6

SAMPLE_PASSWORD = "oquvchi12345"


def _slots(rows: list[Slot]) -> list[ScheduleSlot]:
    return [
        ScheduleSlot(
            weekday=weekday,
            start_time=time.fromisoformat(start),
            end_time=time.fromisoformat(end),
        )
        for weekday, start, end in rows
    ]


def _build_versions(
    sample: "SampleGroup", season_start: date, year: int, month: int
) -> list[ScheduleVersion]:
    """Guruhning jadval tarixi.

    Jadval o'zgargan guruhda ikki versiya bo'ladi: eskisi yopiladi,
    yangisi o'sha sanadan boshlanadi. Shu sababli o'tgan oylarning
    darslari eski jadval bo'yicha qoladi.
    """
    if sample.change_months_ago is None or not sample.new_slots:
        return [
            ScheduleVersion(effective_from=season_start, slots=_slots(sample.slots))
        ]

    change_year, change_month = shift_period(year, month, -sample.change_months_ago)
    change_day = date(change_year, change_month, 1)
    return [
        ScheduleVersion(
            effective_from=season_start,
            effective_to=change_day - timedelta(days=1),
            slots=_slots(sample.slots),
        ),
        ScheduleVersion(
            effective_from=change_day,
            note="Jadval o'zgardi",
            slots=_slots(sample.new_slots),
        ),
    ]


def _lessons(
    versions: list[ScheduleVersion], year: int, month: int, until: date
) -> list[tuple[date, ScheduleSlot]]:
    """Oydagi darslar — har kuni o'sha kundagi versiyaga qarab."""
    lessons = []
    for day_number in range(1, monthrange(year, month)[1] + 1):
        day = date(year, month, day_number)
        if day > until:
            break
        version = next((v for v in versions if v.covers(day)), None)
        if version is None:
            continue
        for slot in version.slots:
            if slot.weekday == day.weekday():
                lessons.append((day, slot))
    lessons.sort(key=lambda item: (item[0], item[1].start_time))
    return lessons


def _name_pool() -> list[tuple[str, str]]:
    """Ism-familiya juftliklari — takrorlanmaydigan qilib aralashtiriladi."""
    pool = [
        (first, surname + ("a" if first in FEMALE_NAMES else ""))
        for first in MALE_NAMES + FEMALE_NAMES
        for surname in SURNAMES
    ]
    random.shuffle(pool)
    return pool


async def seed_teacher(username: str) -> None:
    username = username.strip().lower()
    # Qayta ishga tushirilsa ham bir xil ma'lumot chiqsin.
    random.seed(f"sample-{username}")

    async with SessionLocal() as db:
        teacher = await db.scalar(select(User).where(User.username == username))
        if teacher is None:
            print(f"'{username}' topilmadi")
            return
        if teacher.role is not UserRole.TEACHER:
            print(f"'{username}' o'qituvchi emas ({teacher.role.value})")
            return

        existing_names = set(
            await db.scalars(select(Group.name).where(Group.teacher_id == teacher.id))
        )
        planned = [item for item in SAMPLE_GROUPS if item[0] not in existing_names]
        if not planned:
            print("Namuna guruhlar allaqachon yaratilgan")
            return

        # Telefon raqami unikal — mavjudlarini chetlab o'tamiz.
        used_phones = {phone for phone in await db.scalars(select(User.phone)) if phone}
        counter = 3_000_000

        def next_phone() -> str:
            nonlocal counter
            while True:
                counter += 1
                candidate = f"+99893{counter:07d}"
                if candidate not in used_phones:
                    used_phones.add(candidate)
                    return candidate

        today = local_today()
        year, month = current_period()
        first_year, first_month = shift_period(year, month, -(MONTHS_BACK - 1))
        season_start = date(first_year, first_month, 1)

        # Har bir o'quvchi uchun hash hisoblash sekin (argon2) — bittasini
        # hammasiga ishlatamiz, bu baribir namuna ma'lumot.
        password_hash = hash_password(SAMPLE_PASSWORD)

        names = iter(_name_pool())
        groups: list[tuple[Group, list[ScheduleVersion]]] = []
        enrollments: list[Enrollment] = []

        for sample in planned:
            group = Group(
                teacher_id=teacher.id,
                name=sample.name,
                monthly_fee=sample.monthly_fee,
                description=sample.description,
            )
            db.add(group)
            await db.flush()

            versions = _build_versions(sample, season_start, year, month)
            for version in versions:
                version.group_id = group.id
                db.add(version)
            await db.flush()

            # Karta va ro'yxatlardagi matn — bugungi amaldagi versiyadan.
            current = next((v for v in versions if v.covers(today)), None)
            group.schedule = display_text(current)
            groups.append((group, versions))

            fee = sample.monthly_fee
            for _ in range(random.randint(15, 20)):
                first_name, last_name = next(names)
                student = User(
                    role=UserRole.STUDENT,
                    status=UserStatus.ACTIVE,
                    first_name=first_name,
                    last_name=last_name,
                    phone=next_phone(),
                    password_hash=password_hash,
                    must_change_password=True,
                    teacher_id=teacher.id,
                )
                db.add(student)
                await db.flush()

                # To'rtdan biri keyinroq qo'shilgan — hisoblari ham shundan boshlanadi.
                if random.random() < 0.25:
                    joined = min(
                        season_start + timedelta(days=random.randint(40, 120)), today
                    )
                else:
                    joined = season_start

                enrollment = Enrollment(
                    group_id=group.id,
                    student_id=student.id,
                    joined_on=joined,
                    # Ba'zilarida chegirma bor.
                    custom_fee=int(fee * 0.8) if random.random() < 0.1 else None,
                )
                db.add(enrollment)
                enrollments.append(enrollment)

        await db.flush()
        group_by_id = {group.id: group for group, _ in groups}

        charge_count = payment_count = 0
        for offset in range(MONTHS_BACK - 1, -1, -1):
            period_year, period_month = shift_period(year, month, -offset)
            period_start = date(period_year, period_month, 1)
            period_end = date(
                period_year, period_month, monthrange(period_year, period_month)[1]
            )

            for enrollment in enrollments:
                if enrollment.joined_on > period_end:
                    continue

                group = group_by_id[enrollment.group_id]
                charge = MonthlyCharge(
                    enrollment_id=enrollment.id,
                    year=period_year,
                    month=period_month,
                    amount_due=enrollment.custom_fee or group.monthly_fee,
                )
                db.add(charge)
                await db.flush()
                charge_count += 1

                # O'tgan oylar deyarli yopilgan, joriy oy hali yig'ilmoqda.
                roll = random.random()
                if offset == 0:
                    share = 1.0 if roll < 0.45 else 0.5 if roll < 0.7 else 0.0
                else:
                    share = 1.0 if roll < 0.85 else 0.5 if roll < 0.95 else 0.0
                if share == 0.0:
                    continue

                pay_day = max(period_start, enrollment.joined_on) + timedelta(
                    days=random.randint(0, 12)
                )
                pay_day = min(pay_day, period_end, today)

                db.add(
                    Payment(
                        charge_id=charge.id,
                        amount=int(charge.amount_due * share),
                        method=random.choices(
                            list(PaymentMethod), weights=[6, 3, 1, 1]
                        )[0],
                        paid_at=datetime.combine(
                            pay_day, time(hour=random.randint(9, 18)), tzinfo=LOCAL_TZ
                        ),
                        created_by_id=teacher.id,
                    )
                )
                payment_count += 1

        session_count = record_count = 0
        for group, versions in groups:
            roster = [item for item in enrollments if item.group_id == group.id]
            for offset in range(MONTHS_BACK - 1, -1, -1):
                period_year, period_month = shift_period(year, month, -offset)
                # Har bir kun o'sha kuni amalda bo'lgan jadvalga qarab.
                for day, slot in _lessons(versions, period_year, period_month, today):
                    attendees = [item for item in roster if item.joined_on <= day]
                    if not attendees:
                        continue

                    session = AttendanceSession(
                        group_id=group.id,
                        session_date=day,
                        start_time=slot.start_time,
                        slot_id=slot.id,
                    )
                    db.add(session)
                    await db.flush()
                    session_count += 1

                    for enrollment in attendees:
                        roll = random.random()
                        if roll < 0.08:
                            status = AttendanceStatus.ABSENT
                        elif roll < 0.12:
                            status = AttendanceStatus.LATE
                        elif roll < 0.15:
                            status = AttendanceStatus.EXCUSED
                        else:
                            status = AttendanceStatus.PRESENT
                        db.add(
                            AttendanceRecord(
                                session_id=session.id,
                                enrollment_id=enrollment.id,
                                status=status,
                            )
                        )
                        record_count += 1

        await db.commit()

    print(
        f"{username}: {len(groups)} guruh, {len(enrollments)} o'quvchi, "
        f"{session_count} dars kuni ({record_count} davomat yozuvi), "
        f"{charge_count} oylik hisob, {payment_count} to'lov"
    )
    print(f"O'quvchilarning vaqtinchalik paroli: {SAMPLE_PASSWORD}")
