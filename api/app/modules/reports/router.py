from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.api.deps import CurrentTeacher, DbSession
from app.core.pdf import build_monthly_report_pdf
from app.modules.reports import schemas, service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard", response_model=schemas.DashboardOut, summary="Bosh ekran")
async def dashboard(db: DbSession, teacher: CurrentTeacher) -> schemas.DashboardOut:
    """Shu oy daromadi, qarz va bugun davomat qilinmagan guruhlar — bir ekranda."""
    return await service.dashboard(db, teacher_id=teacher.id)


@router.get(
    "/monthly",
    response_model=schemas.MonthlyReportOut,
    summary="Oylik moliyaviy hisobot",
)
async def monthly(
    db: DbSession,
    teacher: CurrentTeacher,
    year: Annotated[int, Query(ge=2000, le=2100)],
    month: Annotated[int, Query(ge=1, le=12)],
) -> schemas.MonthlyReportOut:
    """Guruhlar kesimida: kutilgan, yig'ilgan, qarz va holatlar soni.

    O'quvchi darajasidagi tafsilot uchun `GET /groups/{id}/payments`.
    """
    return await service.monthly_report(
        db, teacher_id=teacher.id, year=year, month=month
    )


@router.get(
    "/monthly.pdf",
    summary="Oylik hisobotni PDF qilib yuklab olish",
)
async def monthly_pdf(
    db: DbSession,
    teacher: CurrentTeacher,
    year: Annotated[int, Query(ge=2000, le=2100)],
    month: Annotated[int, Query(ge=1, le=12)],
) -> Response:
    """Ekrandagi/chop etiladigan hisobot bilan bir xil ma'lumot, lekin
    haqiqiy fayl — buxgalteriyaga berish yoki arxivlash uchun qulay."""
    report = await service.monthly_report(
        db, teacher_id=teacher.id, year=year, month=month
    )
    attendance_report = await service.attendance_report(
        db, teacher_id=teacher.id, year=year, month=month
    )
    pdf = build_monthly_report_pdf(
        report=report, attendance=attendance_report, teacher_name=teacher.full_name
    )
    filename = f"hisobot-{year}-{month:02d}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/revenue-trend",
    response_model=schemas.RevenueTrendOut,
    summary="Oylararo daromad tendentsiyasi",
)
async def revenue_trend(
    db: DbSession,
    teacher: CurrentTeacher,
    months: Annotated[int, Query(ge=2, le=24)] = 12,
) -> schemas.RevenueTrendOut:
    return await service.revenue_trend(db, teacher_id=teacher.id, months=months)


@router.get(
    "/attendance",
    response_model=schemas.AttendanceReportOut,
    summary="Davomat hisoboti",
)
async def attendance(
    db: DbSession,
    teacher: CurrentTeacher,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> schemas.AttendanceReportOut:
    """Guruhlar bo'yicha davomat foizi va eng ko'p qoldiradigan o'quvchilar."""
    return await service.attendance_report(
        db, teacher_id=teacher.id, year=year, month=month
    )


@router.get(
    "/debtors",
    response_model=schemas.DebtorsOut,
    summary="Qarzdorlar ro'yxati",
)
async def debtors(
    db: DbSession,
    teacher: CurrentTeacher,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> schemas.DebtorsOut:
    """Shu oyda to'liq to'lamaganlar — eng katta qarz yuqorida."""
    return await service.debtors(db, teacher_id=teacher.id, year=year, month=month)
