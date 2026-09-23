"""Davomat biznes-mantiqi.

Asosiy tamoyil: standart holat — `present`. O'qituvchi faqat kelmaganlarni
belgilaydi, qolgani avtomatik. O'tgan kunni tuzatish mumkin, kelajak kunga
davomat qo'yib bo'lmaydi.

Bir kunda bir nechta dars bo'lishi mumkin (guruh jadvali ertalab va
kechqurun darsni ko'rsatsa), shuning uchun sessiya sana + boshlanish vaqti
bilan aniqlanadi.
"""

import calendar
from datetime import date, time

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import local_today
from app.core.exceptions import ValidationError
from app.modules.attendance import schemas
from app.modules.attendance.models import (
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
)
from app.modules.groups import schedule_service
from app.modules.groups.models import Enrollment, EnrollmentStatus, Group
from app.modules.groups.service import ensure_writable, get_group
from app.modules.users.models import User
from app.modules.users.service import full_name_of, get_owned_student


async def _active_roster(
    db: AsyncSession, group_id: int, on_date: date
) -> list[tuple[Enrollment, User]]:
    """Shu sanada guruhda bo'lgan o'quvchilar.

    Guruhdan chiqarilgan o'quvchi chiqqan sanasidan keyingi darslarda
    ro'yxatga kirmaydi, lekin undan oldingi tarixi saqlanib qoladi.

    Diqqat: `joined_on` bo'yicha filtr ataylab qo'yilmagan. O'qituvchi
    ilovani bugun o'rnatib, o'tgan haftaning davomatini kiritishi odatiy
    holat — bunda o'quvchilar bugun qo'shilgan bo'ladi va qat'iy filtr
    "bu sanada guruhda emas" degan xatolik berardi. Kim darsda bo'lganini
    o'qituvchi biladi.

    To'lovda esa buning aksi: u yerda `joined_on` qat'iy hisobga olinadi,
    chunki xato hisob pul masalasi (`payments.service.ensure_charges`).
    """
    rows = await db.execute(
        select(Enrollment, User)
        .join(User, User.id == Enrollment.student_id)
        .where(
            Enrollment.group_id == group_id,
            (Enrollment.status == EnrollmentStatus.ACTIVE)
            | (Enrollment.left_on.is_(None))
            | (Enrollment.left_on >= on_date),
        )
        .order_by(User.first_name, User.last_name)
    )
    return list(rows.all())


def column_key(day: date, start_time: time | None) -> str:
    """Bir darsning barqaror kaliti — sana, kerak bo'lsa vaqt bilan."""
    if start_time is None:
        return day.isoformat()
    return f"{day.isoformat()} {start_time:%H:%M}"


def _same_time(column, value: time | None):
    """`start_time` bo'yicha shart — NULL ni ham to'g'ri qiyoslaydi."""
    return column.is_(None) if value is None else column == value


async def _day_sessions(
    db: AsyncSession, group_id: int, day: date
) -> list[AttendanceSession]:
    return list(
        await db.scalars(
            select(AttendanceSession)
            .where(
                AttendanceSession.group_id == group_id,
                AttendanceSession.session_date == day,
            )
            .order_by(AttendanceSession.start_time)
        )
    )


async def _day_lessons(
    db: AsyncSession, group_id: int, day: date
) -> list[schemas.DayLesson]:
    """Shu kundagi darslar: jadval bo'yicha rejadagilar + saqlanganlar.

    Jadval keyin o'zgargan bo'lsa ham saqlangan dars ro'yxatdan
    tushib qolmaydi — yozuv bor ekan, u ko'rinishi kerak.
    """
    planned = await schedule_service.lessons_in_range(
        db, group_id=group_id, start=day, end=day
    )
    sessions = await _day_sessions(db, group_id, day)
    by_time = {session.start_time: session for session in sessions}

    lessons: list[schemas.DayLesson] = []
    for lesson in planned:
        session = by_time.pop(lesson.start_time, None)
        lessons.append(
            schemas.DayLesson(
                start_time=lesson.start_time,
                end_time=lesson.end_time,
                session_id=session.id if session else None,
                is_saved=session is not None,
            )
        )

    for start_time, session in by_time.items():
        lessons.append(
            schemas.DayLesson(
                start_time=start_time, session_id=session.id, is_saved=True
            )
        )

    lessons.sort(key=lambda item: (item.start_time is not None, item.start_time))
    return lessons


def _resolve_date(value: date | None) -> date:
    session_date = value or local_today()
    if session_date > local_today():
        raise ValidationError("Kelajakdagi sanaga davomat qo'yib bo'lmaydi")
    return session_date


async def get_session(
    db: AsyncSession,
    *,
    teacher_id: int,
    group_id: int,
    on_date: date | None,
    start_time: time | None = None,
) -> schemas.AttendanceSessionOut:
    """Bir kunlik davomat ekranini tayyorlaydi.

    Sessiya hali saqlanmagan bo'lsa, hamma `present` holatida qaytadi —
    o'qituvchi shu ro'yxatdan kelmaganlarni belgilaydi.
    """
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    session_date = on_date or local_today()

    lessons = await _day_lessons(db, group.id, session_date)
    if start_time is None and lessons:
        # Ko'rsatilmasa — kunning birinchi darsi.
        start_time = lessons[0].start_time

    session = await db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.group_id == group.id,
            AttendanceSession.session_date == session_date,
            _same_time(AttendanceSession.start_time, start_time),
        )
    )

    saved: dict[int, AttendanceStatus] = {}
    if session is not None:
        rows = await db.execute(
            select(AttendanceRecord.enrollment_id, AttendanceRecord.status).where(
                AttendanceRecord.session_id == session.id
            )
        )
        saved = dict(rows.all())

    roster = await _active_roster(db, group.id, session_date)
    students = [
        schemas.AttendanceStudentOut(
            student_id=student.id,
            full_name=student.full_name,
            status=saved.get(enrollment.id, AttendanceStatus.PRESENT),
        )
        for enrollment, student in roster
    ]

    present = sum(1 for s in students if s.status is AttendanceStatus.PRESENT)
    return schemas.AttendanceSessionOut(
        group_id=group.id,
        session_date=session_date,
        start_time=start_time,
        day_lessons=lessons,
        session_id=session.id if session else None,
        is_saved=session is not None,
        is_editable=not group.is_archived and session_date <= local_today(),
        note=session.note if session else None,
        students=students,
        present_count=present,
        absent_count=len(students) - present,
    )


async def save_session(
    db: AsyncSession,
    *,
    teacher_id: int,
    group_id: int,
    data: schemas.AttendanceSaveRequest,
) -> schemas.AttendanceSessionOut:
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    ensure_writable(group)
    session_date = _resolve_date(data.session_date)

    roster = await _active_roster(db, group.id, session_date)
    if not roster:
        raise ValidationError("Bu sanada guruhda o'quvchi yo'q")

    enrollment_by_student = {student.id: enr.id for enr, student in roster}
    overrides: dict[int, AttendanceStatus] = {}
    for mark in data.records:
        enrollment_id = enrollment_by_student.get(mark.student_id)
        if enrollment_id is None:
            raise ValidationError(f"O'quvchi {mark.student_id} bu sanada guruhda emas")
        overrides[enrollment_id] = mark.status

    # Kunda bir nechta dars bo'lishi mumkin — qaysi biri ekanini aniqlaymiz.
    slot = await schedule_service.slot_for(
        db, group_id=group.id, day=session_date, start_time=data.start_time
    )
    start_time = data.start_time or (slot.start_time if slot else None)

    session = await db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.group_id == group.id,
            AttendanceSession.session_date == session_date,
            _same_time(AttendanceSession.start_time, start_time),
        )
    )
    if session is None:
        session = AttendanceSession(
            group_id=group.id,
            session_date=session_date,
            # Vaqt jadvaldan ko'chiriladi: jadval keyin o'zgarsa ham
            # bu darsning vaqti o'zgarmaydi.
            start_time=start_time,
            slot_id=slot.id if slot else None,
            note=data.note,
        )
        db.add(session)
        await db.flush()
    elif data.note is not None:
        session.note = data.note

    existing = {
        record.enrollment_id: record
        for record in await db.scalars(
            select(AttendanceRecord).where(AttendanceRecord.session_id == session.id)
        )
    }

    for enrollment, _student in roster:
        status = overrides.get(enrollment.id, AttendanceStatus.PRESENT)
        record = existing.get(enrollment.id)
        if record is None:
            db.add(
                AttendanceRecord(
                    session_id=session.id,
                    enrollment_id=enrollment.id,
                    status=status,
                )
            )
        elif record.status is not status:
            record.status = status

    await db.flush()
    return await get_session(
        db,
        teacher_id=teacher_id,
        group_id=group.id,
        on_date=session_date,
        start_time=start_time,
    )


async def monthly_report(
    db: AsyncSession, *, teacher_id: int, group_id: int, year: int, month: int
) -> schemas.MonthlyAttendanceOut:
    """Oylik davomat jadvali: o'quvchilar × darslar.

    Ustunlar ikki manbadan yig'iladi: shu oyda jadval bo'yicha bo'lishi
    kerak bo'lgan darslar (o'sha paytdagi versiyaga qarab) va haqiqatda
    saqlangan sessiyalar. Shu sababli o'tkazilmagan dars ham bo'sh ustun
    bo'lib ko'rinadi, jadval keyin o'zgargan bo'lsa ham o'tgan oy o'sha
    paytdagi holicha chiqadi.
    """
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    today = local_today()

    planned = await schedule_service.lessons_in_range(
        db, group_id=group.id, start=first_day, end=min(last_day, today)
    )

    columns: dict[str, schemas.MonthlyColumn] = {}
    for lesson in planned:
        key = column_key(lesson.lesson_date, lesson.start_time)
        columns[key] = schemas.MonthlyColumn(
            key=key,
            lesson_date=lesson.lesson_date,
            start_time=lesson.start_time,
            is_planned=True,
            is_saved=False,
        )

    rows = await db.execute(
        select(
            AttendanceSession.session_date,
            AttendanceSession.start_time,
            AttendanceRecord.status,
            User.id,
            User.first_name,
            User.last_name,
        )
        .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
        .join(Enrollment, Enrollment.id == AttendanceRecord.enrollment_id)
        .join(User, User.id == Enrollment.student_id)
        .where(
            AttendanceSession.group_id == group.id,
            AttendanceSession.session_date.between(first_day, last_day),
        )
        .order_by(User.first_name, User.last_name, AttendanceSession.session_date)
    )

    students: dict[int, schemas.MonthlyStudentRow] = {}
    for session_date, start_time, status, student_id, first, last in rows.all():
        key = column_key(session_date, start_time)
        column = columns.get(key)
        if column is None:
            # Jadvalsiz yoki jadval o'zgarganidan keyingi dars — baribir
            # ko'rsatiladi, chunki yozuvi bor.
            columns[key] = schemas.MonthlyColumn(
                key=key,
                lesson_date=session_date,
                start_time=start_time,
                is_planned=False,
                is_saved=True,
            )
        else:
            column.is_saved = True

        row = students.get(student_id)
        if row is None:
            row = schemas.MonthlyStudentRow(
                student_id=student_id,
                full_name=full_name_of(first, last),
                marks={},
                present_count=0,
                absent_count=0,
                attendance_rate=0.0,
            )
            students[student_id] = row
        row.marks[key] = status
        if status is AttendanceStatus.ABSENT:
            row.absent_count += 1
        else:
            row.present_count += 1

    for row in students.values():
        total = row.present_count + row.absent_count
        row.attendance_rate = (
            round(row.present_count / total * 100, 1) if total else 0.0
        )

    return schemas.MonthlyAttendanceOut(
        group_id=group.id,
        year=year,
        month=month,
        columns=sorted(
            columns.values(),
            key=lambda item: (item.lesson_date, item.start_time or time.min),
        ),
        students=sorted(students.values(), key=lambda r: r.full_name),
    )


async def student_summary(
    db: AsyncSession, *, teacher_id: int, student_id: int
) -> schemas.StudentAttendanceOut:
    """O'quvchining har bir guruhdagi davomat foizi."""
    student = await get_owned_student(db, teacher_id=teacher_id, student_id=student_id)

    rows = await db.execute(
        select(
            Group.id,
            Group.name,
            AttendanceRecord.status,
            func.count(AttendanceRecord.id),
        )
        .join(Enrollment, Enrollment.group_id == Group.id)
        .join(AttendanceRecord, AttendanceRecord.enrollment_id == Enrollment.id)
        .where(Enrollment.student_id == student.id, Group.teacher_id == teacher_id)
        .group_by(Group.id, Group.name, AttendanceRecord.status)
        .order_by(Group.name)
    )

    groups: dict[int, schemas.StudentGroupAttendance] = {}
    for group_id, group_name, status, count in rows.all():
        summary = groups.setdefault(
            group_id,
            schemas.StudentGroupAttendance(
                group_id=group_id,
                group_name=group_name,
                total_sessions=0,
                present_count=0,
                absent_count=0,
                late_count=0,
                excused_count=0,
                attendance_rate=0.0,
            ),
        )
        summary.total_sessions += count
        match status:
            case AttendanceStatus.PRESENT:
                summary.present_count += count
            case AttendanceStatus.ABSENT:
                summary.absent_count += count
            case AttendanceStatus.LATE:
                summary.late_count += count
            case AttendanceStatus.EXCUSED:
                summary.excused_count += count

    for summary in groups.values():
        attended = summary.total_sessions - summary.absent_count
        summary.attendance_rate = (
            round(attended / summary.total_sessions * 100, 1)
            if summary.total_sessions
            else 0.0
        )

    return schemas.StudentAttendanceOut(
        student_id=student.id,
        full_name=student.full_name,
        groups=sorted(groups.values(), key=lambda g: g.group_name),
    )
