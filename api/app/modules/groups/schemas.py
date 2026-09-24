from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.core.schemas import ORMModel
from app.modules.groups.models import EnrollmentStatus, GroupStatus
from app.modules.groups.schedule_schemas import SlotIn
from app.modules.users.schemas import OptionalText, StudentSummary


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    monthly_fee: int = Field(ge=0, description="Oylik to'lov, so'mda (butun son)")
    slots: list[SlotIn] | None = Field(
        default=None,
        description="Dastlabki jadval. Keyin PUT /groups/{id}/schedule orqali",
    )


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    monthly_fee: int | None = Field(default=None, ge=0)


class GroupOut(ORMModel):
    id: int
    name: str
    description: str | None
    monthly_fee: int
    schedule: str | None = Field(
        description="Amaldagi jadvalning qisqa matni — jadvaldan hosil qilinadi"
    )
    expected_monthly: int = Field(
        default=0,
        description=(
            "Shu guruhdan bir oyda kutilayotgan summa — alohida narxlar "
            "hisobga olingan holda"
        ),
    )
    status: GroupStatus
    archived_at: datetime | None
    created_at: datetime
    student_count: int = Field(default=0, description="Guruhdagi faol o'quvchilar soni")


class GroupStudentOut(ORMModel):
    """Guruhdagi o'quvchi.

    "Enrollment" atamasi API'da ham ko'rinmaydi — bu guruhdagi o'quvchi.
    `enrollment_id` faqat texnik identifikator sifatida qoldirilgan.
    """

    enrollment_id: int
    student: StudentSummary
    custom_fee: int | None = Field(
        description="Alohida narx. null — guruh narxi, 0 — bepul o'qiydi"
    )
    fee_note: str | None = Field(default=None, description="Chegirma sababi")
    monthly_fee: int = Field(description="Amaldagi narx: custom_fee yoki guruh narxi")
    discount: int = Field(
        default=0, description="Guruh narxidan qancha kam to'laydi (so'm)"
    )
    status: EnrollmentStatus
    joined_on: date
    left_on: date | None


class ExistingStudentRef(BaseModel):
    student_id: int


class AddStudentRequest(BaseModel):
    """Guruhga o'quvchi qo'shish — ikki holat.

    - `student_id` berilsa: mavjud o'quvchi qo'shiladi, yangi account
      yaratilmaydi (bitta o'quvchi bir necha guruhda bo'lishi mumkin).
    - Aks holda ism va telefon/username kerak: tizim yangi o'quvchi
      accountini vaqtinchalik parol bilan yaratadi.
    """

    student_id: int | None = None
    first_name: str | None = Field(default=None, min_length=2, max_length=80)
    last_name: OptionalText = Field(default=None, max_length=80)
    phone: OptionalText = Field(default=None, max_length=32)
    username: OptionalText = Field(default=None, max_length=64)
    custom_fee: int | None = Field(
        default=None,
        ge=0,
        description="Shu guruhdagi alohida narx. 0 — bepul o'qiydi",
    )
    fee_note: OptionalText = Field(
        default=None, max_length=255, description="Chegirma sababi"
    )
    joined_on: date | None = Field(
        default=None, description="Bo'sh bo'lsa — bugungi sana"
    )

    @model_validator(mode="after")
    def check_identity(self) -> "AddStudentRequest":
        if self.student_id is not None:
            return self
        if not self.first_name:
            raise ValueError("Yangi o'quvchi uchun ism kiritilishi shart")
        if not (self.phone or self.username):
            raise ValueError("Telefon yoki username kiritilishi shart")
        return self


class AddStudentResponse(BaseModel):
    student: GroupStudentOut
    temporary_password: str | None = Field(
        default=None,
        description=(
            "Faqat yangi account yaratilganda qaytariladi. O'quvchi birinchi "
            "kirishda uni o'zgartirishi shart."
        ),
    )


class ImportRow(BaseModel):
    """Ro'yxatdan bitta qator."""

    first_name: str = Field(min_length=2, max_length=80)
    last_name: OptionalText = Field(default=None, max_length=80)
    phone: OptionalText = Field(default=None, max_length=32)
    custom_fee: int | None = Field(default=None, ge=0)


class ImportRequest(BaseModel):
    rows: list[ImportRow] = Field(min_length=1, max_length=200)
    joined_on: date | None = None


class ImportResultRow(BaseModel):
    line: int = Field(description="Qatorning ro'yxatdagi tartibi, 1 dan")
    full_name: str
    student_id: int | None = None
    temporary_password: str | None = None
    error: str | None = Field(default=None, description="Bo'sh bo'lsa — qo'shildi")


class ImportResult(BaseModel):
    """Import natijasi — qo'shilganlar va sabablari bilan o'tkazilganlar."""

    added: int
    failed: int
    rows: list[ImportResultRow]


class GroupStudentUpdate(BaseModel):
    custom_fee: int | None = Field(default=None, ge=0, description="0 — bepul o'qiydi")
    fee_note: OptionalText = Field(default=None, max_length=255)
    reset_custom_fee: bool = Field(
        default=False, description="true bo'lsa guruh narxiga qaytariladi"
    )
    apply_current_month: bool = Field(
        default=False,
        description=(
            "Joriy oyning ochilgan hisobiga ham qo'llansin. Faqat shu oyda "
            "hali to'lov bo'lmagan bo'lsa ishlaydi"
        ),
    )


class StudentDetailOut(StudentSummary):
    middle_name: str | None = None
    birth_date: date | None = None
    parent_name: str | None = None
    parent_phone: str | None = None
    school: str | None = None
    note: str | None = None
    must_change_password: bool
    last_login_at: datetime | None = None
    created_at: datetime
    groups: list["StudentGroupRef"] = []


class StudentGroupRef(BaseModel):
    group_id: int
    group_name: str
    status: EnrollmentStatus
    monthly_fee: int
    joined_on: date


StudentDetailOut.model_rebuild()
