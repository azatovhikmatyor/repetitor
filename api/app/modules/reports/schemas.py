from pydantic import BaseModel, Field


class GroupRef(BaseModel):
    group_id: int
    group_name: str


class DashboardGroupCard(GroupRef):
    student_count: int
    total_due: int
    total_paid: int
    total_debt: int
    attendance_taken_today: bool


class DashboardOut(BaseModel):
    """Bosh ekran — telefonda ochilishi bilan ko'rinadigan raqamlar."""

    year: int
    month: int
    collected: int = Field(description="Shu oyda haqiqatda yig'ilgan summa")
    expected: int = Field(description="Shu oy uchun kutilayotgan summa")
    debt: int = Field(description="expected - collected (manfiy bo'lmaydi)")
    collection_rate: float = Field(description="Yig'ilish foizi, 0-100")
    debtor_count: int = Field(description="To'liq to'lamagan o'quvchilar soni")
    active_group_count: int
    active_student_count: int
    groups: list[DashboardGroupCard]
    groups_without_attendance_today: list[GroupRef] = Field(
        description="Bugun davomat qilinmagan faol guruhlar — eslatma"
    )


class MonthlyGroupSummary(GroupRef):
    student_count: int
    total_due: int
    total_paid: int
    total_debt: int
    paid_count: int
    partial_count: int
    unpaid_count: int


class MonthlyReportOut(BaseModel):
    year: int
    month: int
    total_due: int
    total_paid: int
    total_debt: int
    groups: list[MonthlyGroupSummary]


class RevenuePoint(BaseModel):
    year: int
    month: int
    collected: int
    expected: int


class RevenueTrendOut(BaseModel):
    points: list[RevenuePoint]


class GroupAttendanceRate(GroupRef):
    session_count: int
    attendance_rate: float


class FrequentAbsentee(BaseModel):
    student_id: int
    full_name: str
    absent_count: int
    total_sessions: int
    attendance_rate: float


class AttendanceReportOut(BaseModel):
    groups: list[GroupAttendanceRate]
    frequent_absentees: list[FrequentAbsentee] = Field(
        description="Eng ko'p dars qoldiradigan o'quvchilar"
    )


class AdminStatsOut(BaseModel):
    """Platforma sog'ligi.

    Ataylab moliyaviy raqamlarsiz: super admin alohida o'qituvchining
    daromadini ko'rmaydi (talab 9).
    """

    teacher_count: int
    active_teacher_count: int
    pending_teacher_count: int = Field(
        description="Tasdiq kutayotgan o'qituvchilar — bildirishnoma hisoblagichi"
    )
    student_count: int
    group_count: int
    active_group_count: int
    attendance_sessions_last_30_days: int
    new_teachers_last_30_days: int
    new_groups_last_30_days: int


class DebtorOut(GroupRef):
    """Qarzi bor bitta hisob — to'lov kiritish uchun yetarli ma'lumot bilan."""

    charge_id: int
    student_id: int
    full_name: str
    phone: str | None
    amount_due: int
    amount_paid: int
    balance: int


class DebtorsOut(BaseModel):
    year: int
    month: int
    total_debt: int
    items: list[DebtorOut]
