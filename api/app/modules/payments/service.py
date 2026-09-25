"""To'lov biznes-mantiqi.

Model ikki qatlamdan iborat:

* `MonthlyCharge` — "shu o'quvchi shu oyda qancha to'lashi kerak". Yaratilgan
  paytdagi narxni muzlatadi, shuning uchun guruh narxi keyin o'zgarsa
  o'tgan oylarning qarzi o'zgarmaydi.
* `Payment` — pul harakati. O'zgarmas: xato kiritilgan to'lov o'chirilmaydi,
  unga bog'langan manfiy summali "bekor qilish" yozuvi qo'shiladi.

Hisobning holati (`paid` / `partial` / `unpaid`) saqlanmaydi — u har doim
`SUM(payments.amount)` dan hisoblanadi. Barcha moliyaviy hisob-kitob shu
yerda, server tomonda bajariladi (talab 12).
"""

import calendar
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import current_period, shift_period, utc_now
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.groups.models import Enrollment, EnrollmentStatus, Group
from app.modules.groups.service import get_group
from app.modules.payments import schemas
from app.modules.payments.models import ChargeStatus, MonthlyCharge, Payment
from app.modules.users.models import User
from app.modules.users.service import get_owned_student


def _period_bounds(year: int, month: int) -> tuple[date, date]:
    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


def _charge_status(amount_due: int, amount_paid: int) -> ChargeStatus:
    # Bepul o'qiydigan (amount_due = 0) qarzdor emas — to'lovsiz ham yopiq.
    if amount_due == 0 and amount_paid <= 0:
        return ChargeStatus.PAID
    if amount_paid <= 0:
        return ChargeStatus.UNPAID
    if amount_paid < amount_due:
        return ChargeStatus.PARTIAL
    if amount_paid > amount_due:
        return ChargeStatus.OVERPAID
    return ChargeStatus.PAID


def ensure_period_allowed(year: int, month: int) -> None:
    """To'lov o'tgan, joriy va kelasi oy uchun kiritiladi (talab 12)."""
    max_year, max_month = shift_period(*current_period(), 1)
    if (year, month) > (max_year, max_month):
        raise ValidationError(
            "To'lovni faqat o'tgan, joriy yoki kelasi oy uchun kiritish mumkin"
        )


async def ensure_charges(
    db: AsyncSession, group: Group, *, year: int, month: int
) -> None:
    """Shu oyda guruhda bo'lgan har bir o'quvchi uchun hisob ochadi.

    Hisoblar oldindan emas, birinchi so'ralganda yaratiladi (lazy) — shunda
    fon vazifasi (cron) kerak bo'lmaydi va narx o'zgarishi to'g'ri paytda
    muzlatiladi.

    Arxivlangan guruhga yangi hisob ochilmaydi, lekin eskilari ko'rinadi.
    """
    if group.is_archived:
        return

    period_start, period_end = _period_bounds(year, month)
    enrollments = await db.scalars(
        select(Enrollment).where(
            Enrollment.group_id == group.id,
            Enrollment.joined_on <= period_end,
            (Enrollment.status == EnrollmentStatus.ACTIVE)
            | (Enrollment.left_on.is_(None))
            | (Enrollment.left_on >= period_start),
        )
    )
    enrollments = list(enrollments)
    if not enrollments:
        return

    existing = set(
        await db.scalars(
            select(MonthlyCharge.enrollment_id).where(
                MonthlyCharge.enrollment_id.in_([e.id for e in enrollments]),
                MonthlyCharge.year == year,
                MonthlyCharge.month == month,
            )
        )
    )

    rows = [
        {
            "enrollment_id": enrollment.id,
            "year": year,
            "month": month,
            # Oy o'rtasida qo'shilgan o'quvchi ham to'liq to'laydi —
            # proratsiya yo'q (talab 12). Chegirma custom_fee orqali.
            "amount_due": enrollment.effective_fee(group),
        }
        for enrollment in enrollments
        if enrollment.id not in existing
    ]
    if not rows:
        return

    # ORM obyekti emas, to'g'ridan-to'g'ri INSERT ... ON CONFLICT DO NOTHING.
    #
    # Ikki so'rov bir vaqtda shu oyning hisobini ochishi odatiy hol
    # (dashboard va to'lovlar sahifasi birga yuklanadi). ORM orqali
    # qo'shilsa, UNIQUE buzilishi flush'ni yiqitadi va sessiya "pending
    # rollback" holatiga tushib, so'rovning qolgan qismi ham ishlamay
    # qoladi. Bu shakl esa konfliktni bazaning o'zida jimgina yutadi.
    dialect = db.get_bind().dialect.name
    statement = (
        pg_insert(MonthlyCharge)
        if dialect == "postgresql"
        else sqlite_insert(MonthlyCharge)
    )
    await db.execute(statement.values(rows).on_conflict_do_nothing())


async def group_month(
    db: AsyncSession, *, teacher_id: int, group_id: int, year: int, month: int
) -> schemas.GroupMonthOut:
    """Guruhning bir oylik to'lov holati."""
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    await ensure_charges(db, group, year=year, month=month)

    paid_sum = (
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.charge_id == MonthlyCharge.id)
        .correlate(MonthlyCharge)
        .scalar_subquery()
    )

    rows = await db.execute(
        select(MonthlyCharge, User, paid_sum.label("amount_paid"))
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(User, User.id == Enrollment.student_id)
        .where(
            Enrollment.group_id == group.id,
            MonthlyCharge.year == year,
            MonthlyCharge.month == month,
        )
        .order_by(User.first_name, User.last_name)
    )

    students: list[schemas.ChargeOut] = []
    total_due = total_paid = 0
    for charge, student, amount_paid in rows.all():
        total_due += charge.amount_due
        total_paid += amount_paid
        students.append(
            schemas.ChargeOut(
                charge_id=charge.id,
                student_id=student.id,
                full_name=student.full_name,
                amount_due=charge.amount_due,
                amount_paid=amount_paid,
                balance=charge.amount_due - amount_paid,
                status=_charge_status(charge.amount_due, amount_paid),
                note=charge.note,
            )
        )

    return schemas.GroupMonthOut(
        group_id=group.id,
        group_name=group.name,
        year=year,
        month=month,
        total_due=total_due,
        total_paid=total_paid,
        total_debt=max(total_due - total_paid, 0),
        students=students,
    )


async def _get_charge_for_student(
    db: AsyncSession,
    *,
    group: Group,
    student_id: int,
    year: int,
    month: int,
) -> MonthlyCharge:
    enrollment = await db.scalar(
        select(Enrollment).where(
            Enrollment.group_id == group.id, Enrollment.student_id == student_id
        )
    )
    if enrollment is None:
        raise NotFoundError("Bu guruhda bunday o'quvchi yo'q")

    # Guruhdan chiqarilgan o'quvchiga chiqqanidan keyingi oylar uchun hisob
    # ochilmaydi — eski qarzini to'lash esa mumkin (talab 12).
    if enrollment.left_on is not None and (year, month) > (
        enrollment.left_on.year,
        enrollment.left_on.month,
    ):
        raise ConflictError(
            "O'quvchi bu oydan oldin guruhdan chiqarilgan — to'lov kiritilmaydi"
        )

    charge = await db.scalar(
        select(MonthlyCharge).where(
            MonthlyCharge.enrollment_id == enrollment.id,
            MonthlyCharge.year == year,
            MonthlyCharge.month == month,
        )
    )
    if charge is None:
        charge = MonthlyCharge(
            enrollment_id=enrollment.id,
            year=year,
            month=month,
            amount_due=enrollment.effective_fee(group),
        )
        db.add(charge)
        await db.flush()
    return charge


def _to_payment_out(
    payment: Payment, charge: MonthlyCharge, group: Group, student: User
) -> schemas.PaymentOut:
    return schemas.PaymentOut(
        id=payment.id,
        charge_id=charge.id,
        group_id=group.id,
        group_name=group.name,
        student_id=student.id,
        full_name=student.full_name,
        year=charge.year,
        month=charge.month,
        amount=payment.amount,
        method=payment.method,
        paid_at=payment.paid_at,
        note=payment.note,
        is_reversal=payment.is_reversal,
        reverses_id=payment.reverses_id,
        created_at=payment.created_at,
    )


async def record_payment(
    db: AsyncSession,
    *,
    teacher_id: int,
    group_id: int,
    data: schemas.PaymentCreate,
) -> schemas.PaymentOut:
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    if group.is_archived:
        raise ConflictError("Arxivlangan guruhga yangi to'lov qo'shilmaydi")
    ensure_period_allowed(data.year, data.month)

    student = await get_owned_student(
        db, teacher_id=teacher_id, student_id=data.student_id
    )
    charge = await _get_charge_for_student(
        db, group=group, student_id=student.id, year=data.year, month=data.month
    )

    payment = Payment(
        charge_id=charge.id,
        amount=data.amount,
        method=data.method,
        paid_at=data.paid_at or utc_now(),
        note=data.note,
        created_by_id=teacher_id,
    )
    db.add(payment)
    await db.flush()
    return _to_payment_out(payment, charge, group, student)


async def _load_payment(
    db: AsyncSession, *, teacher_id: int, payment_id: int
) -> tuple[Payment, MonthlyCharge, Group, User]:
    row = await db.execute(
        select(Payment, MonthlyCharge, Group, User)
        .join(MonthlyCharge, MonthlyCharge.id == Payment.charge_id)
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(Group, Group.id == Enrollment.group_id)
        .join(User, User.id == Enrollment.student_id)
        .where(Payment.id == payment_id, Group.teacher_id == teacher_id)
    )
    result = row.first()
    if result is None:
        raise NotFoundError("To'lov topilmadi")
    return result[0], result[1], result[2], result[3]


async def get_payment(
    db: AsyncSession, *, teacher_id: int, payment_id: int
) -> schemas.PaymentOut:
    payment, charge, group, student = await _load_payment(
        db, teacher_id=teacher_id, payment_id=payment_id
    )
    return _to_payment_out(payment, charge, group, student)


async def reverse_payment(
    db: AsyncSession, *, teacher_id: int, payment_id: int, note: str | None
) -> schemas.PaymentOut:
    """To'lovni bekor qiladi — o'chirmaydi.

    Manfiy summali yangi yozuv qo'shiladi, ikkalasi ham tarixda qoladi.
    """
    payment, charge, group, student = await _load_payment(
        db, teacher_id=teacher_id, payment_id=payment_id
    )
    if payment.is_reversal:
        raise ConflictError("Bekor qilish yozuvini qayta bekor qilib bo'lmaydi")

    already = await db.scalar(
        select(Payment.id).where(Payment.reverses_id == payment.id)
    )
    if already is not None:
        raise ConflictError("Bu to'lov allaqachon bekor qilingan")

    reversal = Payment(
        charge_id=charge.id,
        amount=-payment.amount,
        method=payment.method,
        paid_at=utc_now(),
        note=note or f"#{payment.id} to'lovi bekor qilindi",
        reverses_id=payment.id,
        created_by_id=teacher_id,
    )
    db.add(reversal)
    await db.flush()
    return _to_payment_out(reversal, charge, group, student)


async def list_group_payments(
    db: AsyncSession,
    *,
    teacher_id: int,
    group_id: int,
    year: int | None,
    month: int | None,
) -> list[schemas.PaymentOut]:
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    conditions = [Enrollment.group_id == group.id]
    if year is not None:
        conditions.append(MonthlyCharge.year == year)
    if month is not None:
        conditions.append(MonthlyCharge.month == month)

    rows = await db.execute(
        select(Payment, MonthlyCharge, User)
        .join(MonthlyCharge, MonthlyCharge.id == Payment.charge_id)
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(User, User.id == Enrollment.student_id)
        .where(*conditions)
        .order_by(Payment.paid_at.desc())
    )
    return [
        _to_payment_out(payment, charge, group, student)
        for payment, charge, student in rows.all()
    ]


async def student_payments(
    db: AsyncSession, *, teacher_id: int, student_id: int
) -> list[schemas.StudentChargeOut]:
    """O'quvchining barcha guruhlar bo'yicha to'lov tarixi (o'qituvchi ko'rinishi)."""
    student = await get_owned_student(db, teacher_id=teacher_id, student_id=student_id)
    return await _student_payment_history(db, student=student, teacher_id=teacher_id)


async def student_payments_self(
    db: AsyncSession, *, student: User
) -> list[schemas.StudentChargeOut]:
    """O'quvchi o'zining to'lov tarixini ko'radi."""
    return await _student_payment_history(
        db, student=student, teacher_id=student.teacher_id
    )


async def _student_payment_history(
    db: AsyncSession, *, student: User, teacher_id: int | None
) -> list[schemas.StudentChargeOut]:
    rows = await db.execute(
        select(MonthlyCharge, Group)
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(Group, Group.id == Enrollment.group_id)
        .where(Enrollment.student_id == student.id, Group.teacher_id == teacher_id)
        .order_by(MonthlyCharge.year.desc(), MonthlyCharge.month.desc(), Group.name)
    )
    charges = rows.all()
    if not charges:
        return []

    payment_rows = await db.scalars(
        select(Payment)
        .where(Payment.charge_id.in_([charge.id for charge, _ in charges]))
        .order_by(Payment.paid_at)
    )
    by_charge: dict[int, list[Payment]] = {}
    for payment in payment_rows:
        by_charge.setdefault(payment.charge_id, []).append(payment)

    result: list[schemas.StudentChargeOut] = []
    for charge, group in charges:
        payments = by_charge.get(charge.id, [])
        amount_paid = sum(p.amount for p in payments)
        result.append(
            schemas.StudentChargeOut(
                charge_id=charge.id,
                student_id=student.id,
                full_name=student.full_name,
                amount_due=charge.amount_due,
                amount_paid=amount_paid,
                balance=charge.amount_due - amount_paid,
                status=_charge_status(charge.amount_due, amount_paid),
                note=charge.note,
                group_id=group.id,
                group_name=group.name,
                year=charge.year,
                month=charge.month,
                payments=[_to_payment_out(p, charge, group, student) for p in payments],
            )
        )
    return result
