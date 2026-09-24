from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentTeacher, DbSession
from app.core.clock import current_period
from app.modules.expenses import schemas, service

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("", response_model=schemas.ExpenseMonthOut, summary="Oylik xarajatlar")
async def list_expenses(
    db: DbSession,
    teacher: CurrentTeacher,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> schemas.ExpenseMonthOut:
    """Shu oyning xarajatlari, toifalar kesimi va foyda.

    Foyda = shu oy uchun yig'ilgan to'lov − shu oydagi xarajat.
    """
    if year is None or month is None:
        year, month = current_period()
    return await service.month_summary(
        db, teacher_id=teacher.id, year=year, month=month
    )


@router.post(
    "",
    response_model=schemas.ExpenseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Xarajat qo'shish",
)
async def create_expense(
    data: schemas.ExpenseCreate, db: DbSession, teacher: CurrentTeacher
) -> schemas.ExpenseOut:
    expense = await service.create_expense(db, teacher_id=teacher.id, data=data)
    return schemas.ExpenseOut.model_validate(expense)


@router.patch(
    "/{expense_id}", response_model=schemas.ExpenseOut, summary="Xarajatni tahrirlash"
)
async def update_expense(
    expense_id: int,
    data: schemas.ExpenseUpdate,
    db: DbSession,
    teacher: CurrentTeacher,
) -> schemas.ExpenseOut:
    expense = await service.update_expense(
        db, teacher_id=teacher.id, expense_id=expense_id, data=data
    )
    return schemas.ExpenseOut.model_validate(expense)


@router.delete(
    "/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xarajatni o'chirish",
)
async def delete_expense(
    expense_id: int, db: DbSession, teacher: CurrentTeacher
) -> None:
    """To'lovdan farqli: xarajat oddiy o'chiriladi.

    To'lov yozuvi o'chmaydi (u pul harakatining dalili), xarajat esa
    o'qituvchining o'z qaydi — xato kiritilsa o'chirib tashlanadi.
    """
    await service.delete_expense(db, teacher_id=teacher.id, expense_id=expense_id)


@router.post(
    "/copy-previous",
    response_model=schemas.CopyPreviousResult,
    summary="O'tgan oydagi takrorlanuvchilarni ko'chirish",
)
async def copy_previous(
    db: DbSession,
    teacher: CurrentTeacher,
    year: Annotated[int, Query(ge=2000, le=2100)],
    month: Annotated[int, Query(ge=1, le=12)],
) -> schemas.CopyPreviousResult:
    """Ijara va kommunal har oy bir xil — bir bosishda ko'chiriladi."""
    return await service.copy_previous_month(
        db, teacher_id=teacher.id, year=year, month=month
    )
