from datetime import date

from pydantic import BaseModel, Field

from app.core.schemas import ORMModel
from app.modules.expenses.models import ExpenseCategory


class ExpenseCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    amount: int = Field(gt=0, description="So'mda, butun son")
    category: ExpenseCategory = ExpenseCategory.OTHER
    spent_on: date | None = Field(default=None, description="Bo'sh bo'lsa — bugun")
    note: str | None = None
    is_recurring: bool = Field(
        default=False, description="Har oy takrorlanadi (ijara, kommunal)"
    )


class ExpenseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    amount: int | None = Field(default=None, gt=0)
    category: ExpenseCategory | None = None
    spent_on: date | None = None
    note: str | None = None
    is_recurring: bool | None = None


class ExpenseOut(ORMModel):
    id: int
    title: str
    amount: int
    category: ExpenseCategory
    spent_on: date
    note: str | None
    is_recurring: bool


class CategoryTotal(BaseModel):
    category: ExpenseCategory
    total: int
    count: int


class ExpenseMonthOut(BaseModel):
    """Bir oyning xarajatlari va foyda hisobi."""

    year: int
    month: int
    total: int = Field(description="Shu oyning barcha xarajatlari")
    collected: int = Field(description="Shu oyda yig'ilgan to'lov")
    profit: int = Field(description="collected - total (manfiy bo'lishi mumkin)")
    by_category: list[CategoryTotal]
    items: list[ExpenseOut]


class CopyPreviousResult(BaseModel):
    """O'tgan oyning takrorlanuvchi xarajatlarini ko'chirish natijasi."""

    copied: int
    skipped: int = Field(description="Shu oyda allaqachon bor bo'lganlari")
