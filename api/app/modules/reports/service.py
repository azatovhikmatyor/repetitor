"""Hisobot va dashboard.

Barcha raqamlar faqat so'rov yuborgan o'qituvchining ma'lumotidan
hisoblanadi — har bir so'rovda `Group.teacher_id` filtri bor (talab 9).
Agregatlar bazada bajariladi: 12 oylik tendentsiya uchun ham bitta
`GROUP BY` so'rovi ishlatiladi, oyma-oy aylanish yo'q.
"""

from datetime import date, time

from sqlalchemy import Integer, case, cast, func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import current_period, local_today, shift_period
from app.modules.attendance.models import (
    AttendanceRecord,
    AttendanceSession,
    AttendanceStatus,
)
from app.modules.expenses import service as expense_service
from app.modules.groups import schedule_service
from app.modules.groups.models import Enrollment, EnrollmentStatus, Group, GroupStatus
from app.modules.payments.models import MonthlyCharge, Payment
from app.modules.payments.service import ensure_charges
from app.modules.reports import schemas
from app.modules.users.models import User, UserRole, UserStatus
from app.modules.users.service import full_name_of


async def _ensure_current_charges(
    db: AsyncSession, *, teacher_id: int, year: int, month: int
) -> list[Group]:
    """Faol guruhlar uchun shu oyning hisoblari ochilganiga ishonch hosil qiladi."""
    groups = list(
        await db.scalars(
            select(Group).where(
                Group.teacher_id == teacher_id, Group.status == GroupStatus.ACTIVE
            )
        )
    )
    for group in groups:
        await ensure_charges(db, group, year=year, month=month)
    return groups


async def dashboard(db: AsyncSession, *, teacher_id: int) -> schemas.DashboardOut:
    year, month = current_period()
    today = local_today()
    await _ensure_current_charges(db, teacher_id=teacher_id, year=year, month=month)

    # Har bir hisob uchun to'langan summa — bitta so'rovda.
    paid_per_charge = (
        select(
            Payment.charge_id.label("charge_id"),
            func.sum(Payment.amount).label("paid"),
        )
        .group_by(Payment.charge_id)
        .subquery()
    )
    paid = func.coalesce(paid_per_charge.c.paid, 0)

    rows = await db.execute(
        select(
            Group.id,
            Group.name,
            func.count(MonthlyCharge.id),
            func.coalesce(func.sum(MonthlyCharge.amount_due), 0),
            func.coalesce(func.sum(paid), 0),
            func.sum(case((paid < MonthlyCharge.amount_due, 1), else_=0)),
        )
        .select_from(MonthlyCharge)
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(Group, Group.id == Enrollment.group_id)
        .outerjoin(paid_per_charge, paid_per_charge.c.charge_id == MonthlyCharge.id)
        .where(
            Group.teacher_id == teacher_id,
            MonthlyCharge.year == year,
            MonthlyCharge.month == month,
        )
        .group_by(Group.id, Group.name)
        .order_by(Group.name)
    )

    # Bugungi sessiyalar: (guruh, boshlanish vaqti) -> sessiya.
    sessions_rows = await db.execute(
        select(
            AttendanceSession.group_id,
            AttendanceSession.start_time,
            AttendanceSession.is_cancelled,
        )
        .join(Group, Group.id == AttendanceSession.group_id)
        .where(
            Group.teacher_id == teacher_id,
            AttendanceSession.session_date == today,
        )
    )
    today_sessions = {
        (group_id, start_time): is_cancelled
        for group_id, start_time, is_cancelled in sessions_rows.all()
    }
    sessions_today = {group_id for group_id, _ in today_sessions}

    active_groups = {
        group_id: name
        for group_id, name in (
            await db.execute(
                select(Group.id, Group.name).where(
                    Group.teacher_id == teacher_id,
                    Group.status == GroupStatus.ACTIVE,
                )
            )
        ).all()
    }

    cards: list[schemas.DashboardGroupCard] = []
    collected = expected = debtor_count = 0
    for group_id, name, charge_count, total_due, total_paid, unpaid in rows.all():
        if group_id not in active_groups:
            continue  # arxivlangan guruh dashboardda ko'rinmaydi
        collected += total_paid
        expected += total_due
        debtor_count += unpaid or 0
        cards.append(
            schemas.DashboardGroupCard(
                group_id=group_id,
                group_name=name,
                student_count=charge_count,
                total_due=total_due,
                total_paid=total_paid,
                total_debt=max(total_due - total_paid, 0),
                attendance_taken_today=group_id in sessions_today,
            )
        )

    active_student_count = (
        await db.scalar(
            select(func.count(func.distinct(Enrollment.student_id)))
            .join(Group, Group.id == Enrollment.group_id)
            .where(
                Group.teacher_id == teacher_id,
                Group.status == GroupStatus.ACTIVE,
                Enrollment.status == EnrollmentStatus.ACTIVE,
            )
        )
        or 0
    )

    today_lessons = await _today_lessons(
        db,
        groups=active_groups,
        student_counts={card.group_id: card.student_count for card in cards},
        sessions=today_sessions,
        today=today,
    )

    expenses = await expense_service.expenses_in_month(
        db, teacher_id=teacher_id, year=year, month=month
    )

    return schemas.DashboardOut(
        year=year,
        month=month,
        collected=collected,
        expenses=expenses,
        profit=collected - expenses,
        expected=expected,
        debt=max(expected - collected, 0),
        collection_rate=round(collected / expected * 100, 1) if expected else 0.0,
        debtor_count=debtor_count,
        active_group_count=len(active_groups),
        active_student_count=active_student_count,
        groups=cards,
        today_lessons=today_lessons,
        groups_without_attendance_today=[
            schemas.GroupRef(group_id=gid, group_name=name)
            for gid, name in active_groups.items()
            if gid not in sessions_today
        ],
    )


async def _today_lessons(
    db: AsyncSession,
    *,
    groups: dict[int, str],
    student_counts: dict[int, int],
    sessions: dict[tuple[int, time | None], bool],
    today: date,
) -> list[schemas.TodayLesson]:
    """Bugun jadval bo'yicha bo'ladigan darslar.

    O'qituvchi ertalab ilovani ochganda birinchi savoli — "bugun soat
    nechada qaysi guruh?". Javob shu yerda, davomat tugmasi bilan birga.

    Jadvalda yo'q, lekin davomati kiritilgan dars ham ro'yxatga tushadi:
    yozuv bor ekan, u ko'rinishi kerak.
    """
    lessons: list[schemas.TodayLesson] = []
    seen: set[tuple[int, time | None]] = set()

    for group_id, name in groups.items():
        planned = await schedule_service.lessons_in_range(
            db, group_id=group_id, start=today, end=today
        )
        for lesson in planned:
            key = (group_id, lesson.start_time)
            seen.add(key)
            lessons.append(
                schemas.TodayLesson(
                    group_id=group_id,
                    group_name=name,
                    start_time=lesson.start_time,
                    end_time=lesson.end_time,
                    is_saved=key in sessions,
                    is_cancelled=sessions.get(key, False),
                    student_count=student_counts.get(group_id, 0),
                )
            )

    for (group_id, start_time), is_cancelled in sessions.items():
        if (group_id, start_time) in seen or group_id not in groups:
            continue
        lessons.append(
            schemas.TodayLesson(
                group_id=group_id,
                group_name=groups[group_id],
                start_time=start_time,
                is_saved=True,
                is_cancelled=is_cancelled,
                student_count=student_counts.get(group_id, 0),
            )
        )

    lessons.sort(
        key=lambda item: (item.start_time is None, item.start_time, item.group_name)
    )
    return lessons


async def monthly_report(
    db: AsyncSession, *, teacher_id: int, year: int, month: int
) -> schemas.MonthlyReportOut:
    """Oylik moliyaviy hisobot — guruhlar kesimida."""
    await _ensure_current_charges(db, teacher_id=teacher_id, year=year, month=month)

    paid_per_charge = (
        select(
            Payment.charge_id.label("charge_id"),
            func.sum(Payment.amount).label("paid"),
        )
        .group_by(Payment.charge_id)
        .subquery()
    )
    paid = func.coalesce(paid_per_charge.c.paid, 0)

    rows = await db.execute(
        select(
            Group.id,
            Group.name,
            func.count(MonthlyCharge.id),
            func.coalesce(func.sum(MonthlyCharge.amount_due), 0),
            func.coalesce(func.sum(paid), 0),
            func.sum(case((paid >= MonthlyCharge.amount_due, 1), else_=0)),
            func.sum(
                case(
                    ((paid > 0) & (paid < MonthlyCharge.amount_due), 1),
                    else_=0,
                )
            ),
            # Bepul o'qiydigan (amount_due = 0) "to'lamagan" emas — u
            # yuqoridagi `paid >= amount_due` shartiga tushadi.
            func.sum(case(((paid <= 0) & (MonthlyCharge.amount_due > 0), 1), else_=0)),
        )
        .select_from(MonthlyCharge)
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(Group, Group.id == Enrollment.group_id)
        .outerjoin(paid_per_charge, paid_per_charge.c.charge_id == MonthlyCharge.id)
        .where(
            Group.teacher_id == teacher_id,
            MonthlyCharge.year == year,
            MonthlyCharge.month == month,
        )
        .group_by(Group.id, Group.name)
        .order_by(Group.name)
    )

    groups: list[schemas.MonthlyGroupSummary] = []
    total_due = total_paid = 0
    for (
        group_id,
        name,
        count,
        due,
        paid_sum,
        paid_cnt,
        partial_cnt,
        unpaid_cnt,
    ) in rows.all():
        total_due += due
        total_paid += paid_sum
        groups.append(
            schemas.MonthlyGroupSummary(
                group_id=group_id,
                group_name=name,
                student_count=count,
                total_due=due,
                total_paid=paid_sum,
                total_debt=max(due - paid_sum, 0),
                paid_count=paid_cnt or 0,
                partial_count=partial_cnt or 0,
                unpaid_count=unpaid_cnt or 0,
            )
        )

    total_expenses = await expense_service.expenses_in_month(
        db, teacher_id=teacher_id, year=year, month=month
    )

    return schemas.MonthlyReportOut(
        year=year,
        month=month,
        total_due=total_due,
        total_paid=total_paid,
        total_debt=max(total_due - total_paid, 0),
        total_expenses=total_expenses,
        # Foyda yig'ilgan puldan hisoblanadi, kutilgandan emas: qarz
        # hali pul emas.
        profit=total_paid - total_expenses,
        groups=groups,
    )


async def revenue_trend(
    db: AsyncSession, *, teacher_id: int, months: int
) -> schemas.RevenueTrendOut:
    """Oxirgi N oy daromad tendentsiyasi — bitta agregat so'rovda."""
    year, month = current_period()
    periods = [
        shift_period(year, month, -offset) for offset in range(months - 1, -1, -1)
    ]

    rows = await db.execute(
        select(
            MonthlyCharge.year,
            MonthlyCharge.month,
            func.coalesce(func.sum(MonthlyCharge.amount_due), 0),
        )
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(Group, Group.id == Enrollment.group_id)
        .where(
            Group.teacher_id == teacher_id,
            tuple_(MonthlyCharge.year, MonthlyCharge.month).in_(periods),
        )
        .group_by(MonthlyCharge.year, MonthlyCharge.month)
    )
    expected_by_period = {(y, m): due for y, m, due in rows.all()}

    paid_rows = await db.execute(
        select(
            MonthlyCharge.year,
            MonthlyCharge.month,
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .select_from(Payment)
        .join(MonthlyCharge, MonthlyCharge.id == Payment.charge_id)
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(Group, Group.id == Enrollment.group_id)
        .where(
            Group.teacher_id == teacher_id,
            tuple_(MonthlyCharge.year, MonthlyCharge.month).in_(periods),
        )
        .group_by(MonthlyCharge.year, MonthlyCharge.month)
    )
    collected_by_period = {(y, m): total for y, m, total in paid_rows.all()}

    expenses_by_period = await expense_service.trend(
        db, teacher_id=teacher_id, months=months
    )

    points = []
    for y, m in periods:
        collected = collected_by_period.get((y, m), 0)
        expenses = expenses_by_period.get((y, m), 0)
        points.append(
            schemas.RevenuePoint(
                year=y,
                month=m,
                collected=collected,
                expected=expected_by_period.get((y, m), 0),
                expenses=expenses,
                profit=collected - expenses,
            )
        )

    return schemas.RevenueTrendOut(points=points)


async def attendance_report(
    db: AsyncSession, *, teacher_id: int, year: int | None, month: int | None
) -> schemas.AttendanceReportOut:
    # Bo'lmagan dars hisobga olinmaydi — aks holda uni "hamma kelmagan"
    # deb belgilash kerak bo'lardi va foiz buzilardi.
    conditions = [
        Group.teacher_id == teacher_id,
        AttendanceSession.is_cancelled.is_(False),
    ]
    if year is not None:
        conditions.append(func.extract("year", AttendanceSession.session_date) == year)
    if month is not None:
        conditions.append(
            func.extract("month", AttendanceSession.session_date) == month
        )

    # Takrorlanadigan ifodalar — bir marta e'lon qilinadi.
    attended = cast(
        case((AttendanceRecord.status != AttendanceStatus.ABSENT, 1), else_=0), Integer
    )
    absent = cast(
        case((AttendanceRecord.status == AttendanceStatus.ABSENT, 1), else_=0), Integer
    )
    absent_total = func.coalesce(func.sum(absent), 0)

    group_rows = await db.execute(
        select(
            Group.id,
            Group.name,
            func.count(func.distinct(AttendanceSession.id)),
            func.count(AttendanceRecord.id),
            func.coalesce(func.sum(attended), 0),
        )
        .select_from(AttendanceSession)
        .join(Group, Group.id == AttendanceSession.group_id)
        .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
        .where(*conditions)
        .group_by(Group.id, Group.name)
        .order_by(Group.name)
    )

    groups = [
        schemas.GroupAttendanceRate(
            group_id=group_id,
            group_name=name,
            session_count=session_count,
            attendance_rate=(
                round(present / record_count * 100, 1) if record_count else 0.0
            ),
        )
        for group_id, name, session_count, record_count, present in group_rows.all()
    ]

    absent_rows = await db.execute(
        select(
            User.id,
            # `User.full_name` — Python property, SQL ifodasi emas.
            User.first_name,
            User.last_name,
            func.count(AttendanceRecord.id),
            absent_total,
        )
        .select_from(AttendanceRecord)
        .join(AttendanceSession, AttendanceSession.id == AttendanceRecord.session_id)
        .join(Group, Group.id == AttendanceSession.group_id)
        .join(Enrollment, Enrollment.id == AttendanceRecord.enrollment_id)
        .join(User, User.id == Enrollment.student_id)
        .where(*conditions)
        .group_by(User.id, User.first_name, User.last_name)
        .having(absent_total > 0)
        .order_by(absent_total.desc())
        .limit(10)
    )

    return schemas.AttendanceReportOut(
        groups=groups,
        frequent_absentees=[
            schemas.FrequentAbsentee(
                student_id=student_id,
                full_name=full_name_of(first, last),
                absent_count=absent,
                total_sessions=total,
                attendance_rate=(
                    round((total - absent) / total * 100, 1) if total else 0.0
                ),
            )
            for student_id, first, last, total, absent in absent_rows.all()
        ],
    )


async def admin_stats(db: AsyncSession) -> schemas.AdminStatsOut:
    """Platforma ko'rsatkichlari — moliyaviy raqamlarsiz."""
    cutoff = date.fromordinal(local_today().toordinal() - 30)

    teacher_count = await db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.TEACHER)
    )
    active_teacher_count = await db.scalar(
        select(func.count(User.id)).where(
            User.role == UserRole.TEACHER, User.status == UserStatus.ACTIVE
        )
    )
    pending_teacher_count = await db.scalar(
        select(func.count(User.id)).where(
            User.role == UserRole.TEACHER, User.status == UserStatus.PENDING
        )
    )
    student_count = await db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.STUDENT)
    )
    group_count = await db.scalar(select(func.count(Group.id)))
    active_group_count = await db.scalar(
        select(func.count(Group.id)).where(Group.status == GroupStatus.ACTIVE)
    )
    sessions_30 = await db.scalar(
        select(func.count(AttendanceSession.id)).where(
            AttendanceSession.session_date >= cutoff,
            AttendanceSession.is_cancelled.is_(False),
        )
    )
    new_teachers = await db.scalar(
        select(func.count(User.id)).where(
            User.role == UserRole.TEACHER, func.date(User.created_at) >= cutoff
        )
    )
    new_groups = await db.scalar(
        select(func.count(Group.id)).where(func.date(Group.created_at) >= cutoff)
    )

    return schemas.AdminStatsOut(
        teacher_count=teacher_count or 0,
        active_teacher_count=active_teacher_count or 0,
        pending_teacher_count=pending_teacher_count or 0,
        student_count=student_count or 0,
        group_count=group_count or 0,
        active_group_count=active_group_count or 0,
        attendance_sessions_last_30_days=sessions_30 or 0,
        new_teachers_last_30_days=new_teachers or 0,
        new_groups_last_30_days=new_groups or 0,
    )


async def debtors(
    db: AsyncSession, *, teacher_id: int, year: int | None, month: int | None
) -> schemas.DebtorsOut:
    """Shu oyda to'liq to'lamaganlar — eng katta qarz yuqorida.

    Bosh sahifadagi "Qarz" raqami shu ro'yxatga olib boradi: raqamni
    ko'rgan o'qituvchi darrov kim qarzdorligini ko'rsin.
    """
    if year is None or month is None:
        year, month = current_period()

    await _ensure_current_charges(db, teacher_id=teacher_id, year=year, month=month)

    paid_sum = (
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.charge_id == MonthlyCharge.id)
        .correlate(MonthlyCharge)
        .scalar_subquery()
    )

    rows = await db.execute(
        select(MonthlyCharge, Group, User, paid_sum.label("amount_paid"))
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(Group, Group.id == Enrollment.group_id)
        .join(User, User.id == Enrollment.student_id)
        .where(
            Group.teacher_id == teacher_id,
            MonthlyCharge.year == year,
            MonthlyCharge.month == month,
            paid_sum < MonthlyCharge.amount_due,
        )
        .order_by((MonthlyCharge.amount_due - paid_sum).desc(), User.first_name)
    )

    items = [
        schemas.DebtorOut(
            group_id=group.id,
            group_name=group.name,
            charge_id=charge.id,
            student_id=student.id,
            full_name=student.full_name,
            phone=student.phone,
            amount_due=charge.amount_due,
            amount_paid=amount_paid,
            balance=charge.amount_due - amount_paid,
        )
        for charge, group, student, amount_paid in rows.all()
    ]

    return schemas.DebtorsOut(
        year=year,
        month=month,
        total_debt=sum(item.balance for item in items),
        items=items,
    )
