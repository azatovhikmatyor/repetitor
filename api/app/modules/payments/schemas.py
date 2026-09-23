from datetime import datetime

from pydantic import BaseModel, Field

from app.modules.payments.models import ChargeStatus, PaymentMethod


class ChargeOut(BaseModel):
    """Bir o'quvchining bir oylik hisobi."""

    charge_id: int
    student_id: int
    full_name: str
    amount_due: int = Field(description="Shu oy uchun kutilgan summa (muzlatilgan)")
    amount_paid: int = Field(description="Kiritilgan to'lovlar yig'indisi")
    balance: int = Field(description="Qarz: amount_due - amount_paid")
    status: ChargeStatus
    note: str | None = None


class GroupMonthOut(BaseModel):
    group_id: int
    group_name: str
    year: int
    month: int
    total_due: int
    total_paid: int
    total_debt: int
    students: list[ChargeOut]


class PaymentCreate(BaseModel):
    student_id: int
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    amount: int = Field(gt=0, description="So'mda, butun son")
    method: PaymentMethod = PaymentMethod.CASH
    paid_at: datetime | None = Field(
        default=None, description="Bo'sh bo'lsa — hozirgi vaqt"
    )
    note: str | None = None


class PaymentReverse(BaseModel):
    note: str | None = Field(default=None, description="Nima uchun bekor qilinayotgani")


class PaymentOut(BaseModel):
    id: int
    charge_id: int
    group_id: int
    group_name: str
    student_id: int
    full_name: str
    year: int
    month: int
    amount: int = Field(description="Musbat — to'lov, manfiy — bekor qilish")
    method: PaymentMethod
    paid_at: datetime
    note: str | None
    is_reversal: bool
    reverses_id: int | None
    created_at: datetime


class StudentChargeOut(ChargeOut):
    group_id: int
    group_name: str
    year: int
    month: int
    payments: list[PaymentOut] = []
