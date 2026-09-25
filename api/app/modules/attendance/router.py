from datetime import date, time
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentStudent, CurrentTeacher, DbSession
from app.modules.attendance import schemas, service

router = APIRouter(tags=["attendance"])


@router.get(
    "/students/me/attendance",
    response_model=schemas.StudentAttendanceOut,
    summary="O'zining davomat xulosasi (o'quvchi)",
)
async def my_attendance(
    db: DbSession, student: CurrentStudent
) -> schemas.StudentAttendanceOut:
    """Har bir guruh bo'yicha o'z davomat foizi va oxirgi darslar tarixi.

    MUHIM: bu literal `/students/me/attendance` — pastdagi
    `/students/{student_id}/attendance` dan OLDIN turishi shart, aks
    holda "me" `student_id` sifatida o'qilib, 422 qaytaradi.
    """
    return await service.student_summary_self(db, student=student)


@router.get(
    "/groups/{group_id}/attendance",
    response_model=schemas.AttendanceSessionOut,
    summary="Kunlik davomat ekrani",
)
async def get_attendance(
    group_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
    session_date: Annotated[
        date | None,
        Query(alias="date", description="Bo'sh bo'lsa — bugun (Asia/Tashkent)"),
    ] = None,
    start_time: Annotated[
        time | None,
        Query(description="Kunda bir nechta dars bo'lsa — qaysi biri"),
    ] = None,
) -> schemas.AttendanceSessionOut:
    """Guruhning shu kundagi ro'yxatini qaytaradi.

    Hali saqlanmagan bo'lsa — hamma `present`. Saqlangan bo'lsa — mavjud
    sessiya yuklanadi va tahrirlash mumkin.

    `day_lessons` shu kundagi barcha darslarni qaytaradi: guruhda bir
    kunda ikki dars bo'lsa, klient qaysi biri ekanini shundan tanlaydi.
    """
    return await service.get_session(
        db,
        teacher_id=teacher.id,
        group_id=group_id,
        on_date=session_date,
        start_time=start_time,
    )


@router.put(
    "/groups/{group_id}/attendance",
    response_model=schemas.AttendanceSessionOut,
    summary="Davomatni saqlash",
)
async def save_attendance(
    group_id: int,
    data: schemas.AttendanceSaveRequest,
    db: DbSession,
    teacher: CurrentTeacher,
) -> schemas.AttendanceSessionOut:
    """Faqat kelmaganlar yuboriladi — qolgani avtomatik `present`.

    Amal idempotent: bir kunga ikkinchi marta yuborilsa mavjud sessiya
    yangilanadi, yangisi yaratilmaydi.
    """
    return await service.save_session(
        db, teacher_id=teacher.id, group_id=group_id, data=data
    )


@router.get(
    "/groups/{group_id}/attendance/monthly",
    response_model=schemas.MonthlyAttendanceOut,
    summary="Oylik davomat jadvali",
)
async def monthly_attendance(
    group_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
    year: Annotated[int, Query(ge=2000, le=2100)],
    month: Annotated[int, Query(ge=1, le=12)],
) -> schemas.MonthlyAttendanceOut:
    """O'quvchilar × sanalar ko'rinishidagi jadval."""
    return await service.monthly_report(
        db, teacher_id=teacher.id, group_id=group_id, year=year, month=month
    )


@router.get(
    "/students/{student_id}/attendance",
    response_model=schemas.StudentAttendanceOut,
    summary="O'quvchining davomat xulosasi",
)
async def student_attendance(
    student_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.StudentAttendanceOut:
    """Har bir guruh bo'yicha: nechta darsdan nechtasida bo'lgani (%)."""
    return await service.student_summary(
        db, teacher_id=teacher.id, student_id=student_id
    )
