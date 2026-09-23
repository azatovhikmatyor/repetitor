from datetime import date, time

from pydantic import BaseModel, Field

from app.modules.attendance.models import AttendanceStatus


class AttendanceMark(BaseModel):
    student_id: int
    status: AttendanceStatus


class AttendanceSaveRequest(BaseModel):
    """Davomatni saqlash.

    `records` ichiga FAQAT standartdan farq qiladigan o'quvchilar kiritiladi
    (ya'ni kelmaganlar). Ro'yxatda yo'q har bir faol o'quvchi `present`
    deb yoziladi. Shu sababli 30 kishilik guruhda 5 ta kelmagan bo'lsa,
    so'rov atigi 5 ta elementdan iborat bo'ladi (talab 7).
    """

    session_date: date | None = Field(
        default=None, description="Bo'sh bo'lsa — bugungi sana (Asia/Tashkent)"
    )
    start_time: time | None = Field(
        default=None,
        description=(
            "Kunda bir nechta dars bo'lsa — qaysi biri. Bitta dars bo'lsa "
            "jadvaldan avtomatik olinadi"
        ),
    )
    note: str | None = Field(default=None, max_length=255)
    records: list[AttendanceMark] = Field(default_factory=list)


class AttendanceStudentOut(BaseModel):
    student_id: int
    full_name: str
    status: AttendanceStatus


class DayLesson(BaseModel):
    """Shu kundagi darslardan biri — ekranda tanlash uchun."""

    start_time: time | None
    end_time: time | None = None
    session_id: int | None = None
    is_saved: bool


class AttendanceSessionOut(BaseModel):
    group_id: int
    session_date: date
    start_time: time | None = Field(
        default=None, description="Jadvalsiz dars bo'lsa — null"
    )
    day_lessons: list[DayLesson] = Field(
        default_factory=list,
        description="Shu kundagi barcha darslar (jadval + saqlanganlar)",
    )
    session_id: int | None = Field(
        default=None, description="null — bu kunga hali davomat saqlanmagan"
    )
    is_saved: bool
    is_editable: bool = Field(
        description="Arxivlangan guruh yoki kelajak sana bo'lsa — false"
    )
    note: str | None = None
    students: list[AttendanceStudentOut]
    present_count: int
    absent_count: int


class MonthlyStudentRow(BaseModel):
    student_id: int
    full_name: str
    marks: dict[str, AttendanceStatus] = Field(
        description="Kalit — `MonthlyColumn.key`. Yozuvi yo'q dars kirmaydi"
    )
    present_count: int
    absent_count: int
    attendance_rate: float = Field(description="Foiz, 0-100")


class MonthlyColumn(BaseModel):
    """Jadvaldagi bitta ustun — bir dars.

    Bir kunda ikki dars bo'lsa ikki ustun chiqadi, shuning uchun kalit
    sana emas, `key`.
    """

    key: str = Field(description="'YYYY-MM-DD' yoki 'YYYY-MM-DD HH:MM'")
    lesson_date: date
    start_time: time | None
    is_planned: bool = Field(description="Jadval bo'yicha bo'lishi kerak edi")
    is_saved: bool = Field(description="Davomat kiritilgan")


class MonthlyAttendanceOut(BaseModel):
    group_id: int
    year: int
    month: int
    columns: list[MonthlyColumn]
    students: list[MonthlyStudentRow]


class StudentGroupAttendance(BaseModel):
    group_id: int
    group_name: str
    total_sessions: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    attendance_rate: float


class StudentAttendanceOut(BaseModel):
    student_id: int
    full_name: str
    groups: list[StudentGroupAttendance]
