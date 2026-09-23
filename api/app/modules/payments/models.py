import enum
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.types import enum_column


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    TRANSFER = "transfer"
    OTHER = "other"


class ChargeStatus(str, enum.Enum):
    """Hisoblanadigan holat — bazada saqlanmaydi."""

    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"
    OVERPAID = "overpaid"


class MonthlyCharge(Base, TimestampMixin):
    """Bir o'quvchining bir guruh uchun bir oylik hisobi.

    Nega alohida jadval: guruh narxi o'zgarganda o'tgan oylarning qarzi
    o'zgarmasligi kerak (talab 12). `amount_due` yaratilgan paytdagi
    narxni muzlatib qo'yadi.

    To'langan summa bu yerda saqlanmaydi — u `payments` yozuvlarining
    yig'indisi. Shu sababli qisman to'lov tabiiy ravishda qo'llab-quvvatlanadi
    va har bir pul harakati auditda ko'rinadi.
    """

    __tablename__ = "monthly_charges"

    id: Mapped[int] = mapped_column(primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False
    )
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    amount_due: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

    payments: Mapped[list["Payment"]] = relationship(back_populates="charge")

    __table_args__ = (
        UniqueConstraint(
            "enrollment_id", "year", "month", name="uq_charge_enrollment_period"
        ),
        CheckConstraint("month BETWEEN 1 AND 12", name="month_range"),
        CheckConstraint("year BETWEEN 2000 AND 2100", name="year_range"),
        CheckConstraint("amount_due >= 0", name="amount_due_non_negative"),
        Index("ix_charges_period", "year", "month"),
    )


class Payment(Base, TimestampMixin):
    """Pul harakati — o'zgarmas (immutable) yozuv.

    To'lov o'chirilmaydi va tahrirlanmaydi (talab 12: "faqat tuzatiladi
    yoki bekor qilish yozuvi"). Xato kiritilgan to'lov `reverses_id` bilan
    bog'langan manfiy summali yozuv orqali bekor qilinadi, shunda hisobning
    balansi `SUM(amount)` bo'lib qolaveradi va tarix yo'qolmaydi.
    """

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    charge_id: Mapped[int] = mapped_column(
        ForeignKey("monthly_charges.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Musbat — to'lov, manfiy — bekor qilish/tuzatish.
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(
        enum_column(PaymentMethod, name="payment_method"),
        default=PaymentMethod.CASH,
        nullable=False,
    )
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

    reverses_id: Mapped[int | None] = mapped_column(
        ForeignKey("payments.id", ondelete="RESTRICT"), unique=True
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    charge: Mapped["MonthlyCharge"] = relationship(back_populates="payments")
    reverses: Mapped["Payment | None"] = relationship(
        remote_side="Payment.id", backref="reversal", uselist=False
    )

    __table_args__ = (
        CheckConstraint("amount <> 0", name="amount_non_zero"),
        # Bekor qilish yozuvi har doim manfiy, oddiy to'lov har doim musbat.
        CheckConstraint(
            "(reverses_id IS NULL AND amount > 0) OR "
            "(reverses_id IS NOT NULL AND amount < 0)",
            name="reversal_sign",
        ),
        Index("ix_payments_paid_at", "paid_at"),
    )

    @property
    def is_reversal(self) -> bool:
        return self.reverses_id is not None
