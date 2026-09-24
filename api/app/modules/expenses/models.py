"""Xarajatlar.

Daromad bor edi, foyda yo'q edi: o'qituvchi ijara, kommunal va reklama
puliga qancha ketayotganini tizimda ko'ra olmasdi. Xarajat yozuvlari
o'sha bo'shliqni to'ldiradi va oylik hisobotda "yig'ilgan − xarajat =
foyda" qatorini ochadi.

Xarajat guruhga bog'lanmaydi: ijara butun markazga tegishli, uni
guruhlarga bo'lish sun'iy bo'lardi.
"""

import enum
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.db.types import enum_column


class ExpenseCategory(str, enum.Enum):
    """Toifalar ataylab kam: ro'yxat uzun bo'lsa hech kim to'ldirmaydi."""

    RENT = "rent"
    SALARY = "salary"
    UTILITIES = "utilities"
    MARKETING = "marketing"
    SUPPLIES = "supplies"
    OTHER = "other"


class Expense(Base, TimestampMixin):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    category: Mapped[ExpenseCategory] = mapped_column(
        enum_column(ExpenseCategory, name="expense_category"),
        default=ExpenseCategory.OTHER,
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(nullable=False)
    spent_on: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

    #: Har oy takrorlanadi (ijara, kommunal). Keyingi oyda bir bosishda
    #: ko'chirib olinadi — qo'lda qayta kiritish shart emas.
    is_recurring: Mapped[bool] = mapped_column(default=False, nullable=False)

    __table_args__ = (
        CheckConstraint("amount > 0", name="expense_amount_positive"),
        Index("ix_expenses_teacher_date", "teacher_id", "spent_on"),
    )
