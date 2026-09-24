"""Xarajat va foyda hisobi."""

import calendar
from datetime import date

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import local_today, shift_period
from app.core.exceptions import NotFoundError
from app.modules.expenses import schemas
from app.modules.expenses.models import Expense, ExpenseCategory
from app.modules.groups.models import Enrollment, Group
from app.modules.payments.models import MonthlyCharge, Payment


def period_bounds(year: int, month: int) -> tuple[date, date]:
    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


async def collected_in_month(
    db: AsyncSession, *, teacher_id: int, year: int, month: int
) -> int:
    """Shu oy uchun yig'ilgan to'lov.

    Diqqat: to'lov qaysi oy uchun ekani `MonthlyCharge` da yozilgan, to'lov
    sanasida emas. Avgust uchun sentabrda tushgan pul avgustga tegishli —
    foyda ham shunday hisoblanadi.
    """
    total = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .select_from(Payment)
        .join(MonthlyCharge, MonthlyCharge.id == Payment.charge_id)
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(Group, Group.id == Enrollment.group_id)
        .where(
            Group.teacher_id == teacher_id,
            MonthlyCharge.year == year,
            MonthlyCharge.month == month,
        )
    )
    return int(total or 0)


async def expenses_in_month(
    db: AsyncSession, *, teacher_id: int, year: int, month: int
) -> int:
    start, end = period_bounds(year, month)
    total = await db.scalar(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.teacher_id == teacher_id,
            Expense.spent_on.between(start, end),
        )
    )
    return int(total or 0)


async def month_summary(
    db: AsyncSession, *, teacher_id: int, year: int, month: int
) -> schemas.ExpenseMonthOut:
    start, end = period_bounds(year, month)

    items = list(
        await db.scalars(
            select(Expense)
            .where(
                Expense.teacher_id == teacher_id,
                Expense.spent_on.between(start, end),
            )
            .order_by(Expense.spent_on.desc(), Expense.id.desc())
        )
    )

    rows = await db.execute(
        select(Expense.category, func.sum(Expense.amount), func.count(Expense.id))
        .where(
            Expense.teacher_id == teacher_id,
            Expense.spent_on.between(start, end),
        )
        .group_by(Expense.category)
    )
    by_category = [
        schemas.CategoryTotal(category=category, total=int(total), count=count)
        for category, total, count in rows.all()
    ]
    by_category.sort(key=lambda item: item.total, reverse=True)

    total = sum(item.total for item in by_category)
    collected = await collected_in_month(
        db, teacher_id=teacher_id, year=year, month=month
    )

    return schemas.ExpenseMonthOut(
        year=year,
        month=month,
        total=total,
        collected=collected,
        profit=collected - total,
        by_category=by_category,
        items=[schemas.ExpenseOut.model_validate(item) for item in items],
    )


async def get_expense(db: AsyncSession, *, teacher_id: int, expense_id: int) -> Expense:
    expense = await db.scalar(
        select(Expense).where(
            Expense.id == expense_id, Expense.teacher_id == teacher_id
        )
    )
    if expense is None:
        raise NotFoundError("Xarajat topilmadi")
    return expense


async def create_expense(
    db: AsyncSession, *, teacher_id: int, data: schemas.ExpenseCreate
) -> Expense:
    expense = Expense(
        teacher_id=teacher_id,
        title=data.title.strip(),
        amount=data.amount,
        category=data.category,
        spent_on=data.spent_on or local_today(),
        note=data.note,
        is_recurring=data.is_recurring,
    )
    db.add(expense)
    await db.flush()
    return expense


async def update_expense(
    db: AsyncSession, *, teacher_id: int, expense_id: int, data: schemas.ExpenseUpdate
) -> Expense:
    expense = await get_expense(db, teacher_id=teacher_id, expense_id=expense_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(expense, field, value.strip() if field == "title" and value else value)
    await db.flush()
    return expense


async def delete_expense(db: AsyncSession, *, teacher_id: int, expense_id: int) -> None:
    expense = await get_expense(db, teacher_id=teacher_id, expense_id=expense_id)
    await db.execute(delete(Expense).where(Expense.id == expense.id))


async def copy_previous_month(
    db: AsyncSession, *, teacher_id: int, year: int, month: int
) -> schemas.CopyPreviousResult:
    """O'tgan oyning takrorlanuvchi xarajatlarini shu oyga ko'chiradi.

    Ijara va kommunal har oy bir xil — ularni qayta qo'lda kiritish
    zerikarli. Nomi bo'yicha takrorlanmaydi: shu oyda o'sha nom bilan
    yozuv bo'lsa, ustidan qo'shilmaydi.
    """
    previous_year, previous_month = shift_period(year, month, -1)
    previous_start, previous_end = period_bounds(previous_year, previous_month)
    start, end = period_bounds(year, month)

    sources = list(
        await db.scalars(
            select(Expense).where(
                Expense.teacher_id == teacher_id,
                Expense.is_recurring.is_(True),
                Expense.spent_on.between(previous_start, previous_end),
            )
        )
    )
    if not sources:
        return schemas.CopyPreviousResult(copied=0, skipped=0)

    existing = {
        title.lower()
        for title in await db.scalars(
            select(Expense.title).where(
                Expense.teacher_id == teacher_id,
                Expense.spent_on.between(start, end),
            )
        )
    }

    copied = skipped = 0
    for source in sources:
        if source.title.lower() in existing:
            skipped += 1
            continue
        # Sana o'sha kun, lekin yangi oyda. Oyda bunday kun bo'lmasa
        # (31-dan 30 kunlik oyga) — oxirgi kun.
        day = min(source.spent_on.day, end.day)
        db.add(
            Expense(
                teacher_id=teacher_id,
                title=source.title,
                amount=source.amount,
                category=source.category,
                spent_on=date(year, month, day),
                note=source.note,
                is_recurring=True,
            )
        )
        copied += 1

    await db.flush()
    return schemas.CopyPreviousResult(copied=copied, skipped=skipped)


async def trend(
    db: AsyncSession, *, teacher_id: int, months: int
) -> dict[tuple[int, int], int]:
    """Oxirgi oylar bo'yicha xarajat — daromad grafigi uchun."""
    current = local_today()
    first_year, first_month = shift_period(current.year, current.month, -(months - 1))
    start = date(first_year, first_month, 1)

    rows = await db.execute(
        select(
            func.extract("year", Expense.spent_on),
            func.extract("month", Expense.spent_on),
            func.sum(Expense.amount),
        )
        .where(Expense.teacher_id == teacher_id, Expense.spent_on >= start)
        .group_by(
            func.extract("year", Expense.spent_on),
            func.extract("month", Expense.spent_on),
        )
    )
    return {(int(year), int(month)): int(total) for year, month, total in rows.all()}


__all__ = [
    "ExpenseCategory",
    "collected_in_month",
    "copy_previous_month",
    "create_expense",
    "delete_expense",
    "expenses_in_month",
    "get_expense",
    "month_summary",
    "trend",
    "update_expense",
]
