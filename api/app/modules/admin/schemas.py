from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, computed_field

from app.modules.users.models import UserStatus


class TeacherOut(BaseModel):
    id: int
    first_name: str
    last_name: str | None
    middle_name: str | None
    username: str | None
    email: EmailStr | None
    phone: str | None
    avatar_url: str | None
    status: UserStatus
    created_at: datetime
    approved_at: datetime | None
    last_login_at: datetime | None
    active_group_count: int
    student_count: int

    @computed_field
    @property
    def full_name(self) -> str:
        return (
            f"{self.first_name} {self.last_name}".strip()
            if self.last_name
            else self.first_name
        )

    @computed_field
    @property
    def can_reset_password_alone(self) -> bool:
        """False bo'lsa, parolni faqat admin tiklay oladi."""
        return bool(self.email or self.phone)


class TeacherDeletePreview(BaseModel):
    """O'chirishdan oldin nima yo'qolishini ko'rsatadi."""

    teacher_id: int
    full_name: str
    group_count: int
    student_count: int
    attendance_session_count: int
    payment_count: int
    total_collected: int


class TeacherExport(BaseModel):
    """O'qituvchining butun ma'lumoti — o'chirishdan oldingi zaxira nusxa.

    JSON fayl sifatida yuklab olinadi va kerak bo'lsa qo'lda tiklash uchun
    yetarli bo'ladi.
    """

    exported_at: datetime
    teacher: dict[str, Any]
    groups: list[dict[str, Any]]
    students: list[dict[str, Any]]
    enrollments: list[dict[str, Any]]
    attendance_sessions: list[dict[str, Any]]
    attendance_records: list[dict[str, Any]]
    monthly_charges: list[dict[str, Any]]
    payments: list[dict[str, Any]]
