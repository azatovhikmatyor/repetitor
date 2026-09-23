from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentAdmin, DbSession, Pagination
from app.core.pagination import Page
from app.modules.admin import schemas, service
from app.modules.reports import schemas as report_schemas
from app.modules.reports import service as report_service
from app.modules.users.models import UserStatus
from app.modules.users.schemas import TempPasswordOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/teachers", response_model=Page[schemas.TeacherOut], summary="O'qituvchilar"
)
async def list_teachers(
    db: DbSession,
    admin: CurrentAdmin,
    params: Pagination,
    search: Annotated[str | None, Query(max_length=120)] = None,
    status_filter: Annotated[
        UserStatus | None,
        Query(alias="status", description="pending | active | blocked"),
    ] = None,
) -> Page[schemas.TeacherOut]:
    """Tasdiq kutayotganlar ro'yxatning boshida turadi."""
    items, total = await service.list_teachers(
        db, search=search, status=status_filter, params=params
    )
    return Page.create(items, total, params)


@router.get(
    "/teachers/pending-count",
    summary="Tasdiq kutayotganlar soni",
)
async def pending_count(db: DbSession, admin: CurrentAdmin) -> dict[str, int]:
    """Admin panelidagi bildirishnoma hisoblagichi."""
    return {"count": await service.pending_count(db)}


@router.post(
    "/teachers/{teacher_id}/approve",
    response_model=schemas.TeacherOut,
    summary="O'qituvchini tasdiqlash",
)
async def approve_teacher(
    teacher_id: int, db: DbSession, admin: CurrentAdmin
) -> schemas.TeacherOut:
    """Hisobni faollashtiradi — shundan keyin o'qituvchi tizimga kira oladi."""
    await service.set_status(
        db, teacher_id=teacher_id, status=UserStatus.ACTIVE, actor_id=admin.id
    )
    return await service.get_teacher_out(db, teacher_id)


@router.post(
    "/teachers/{teacher_id}/block",
    response_model=schemas.TeacherOut,
    summary="O'qituvchini bloklash",
)
async def block_teacher(
    teacher_id: int, db: DbSession, admin: CurrentAdmin
) -> schemas.TeacherOut:
    """Hisob o'chirilmaydi — bloklanadi.

    O'qituvchining va uning barcha o'quvchilarining sessiyalari yopiladi:
    bloklangan o'qituvchining o'quvchilari ham tizimga kira olmaydi.
    """
    await service.set_status(
        db, teacher_id=teacher_id, status=UserStatus.BLOCKED, actor_id=admin.id
    )
    return await service.get_teacher_out(db, teacher_id)


@router.post(
    "/teachers/{teacher_id}/unblock",
    response_model=schemas.TeacherOut,
    summary="O'qituvchini tiklash",
)
async def unblock_teacher(
    teacher_id: int, db: DbSession, admin: CurrentAdmin
) -> schemas.TeacherOut:
    await service.set_status(
        db, teacher_id=teacher_id, status=UserStatus.ACTIVE, actor_id=admin.id
    )
    return await service.get_teacher_out(db, teacher_id)


@router.post(
    "/teachers/{teacher_id}/reset-password",
    response_model=TempPasswordOut,
    summary="O'qituvchi parolini tiklash",
)
async def reset_teacher_password(
    teacher_id: int, db: DbSession, admin: CurrentAdmin
) -> TempPasswordOut:
    """Email va telefoni yo'q o'qituvchi uchun.

    Yangi vaqtinchalik parol beriladi va o'qituvchi keyingi kirishda uni
    almashtirishi shart.
    """
    temp_password = await service.reset_teacher_password(
        db, teacher_id=teacher_id, actor_id=admin.id
    )
    return TempPasswordOut(user_id=teacher_id, temporary_password=temp_password)


@router.get(
    "/teachers/{teacher_id}/delete-preview",
    response_model=schemas.TeacherDeletePreview,
    summary="O'chirishda nima yo'qoladi",
)
async def delete_preview(
    teacher_id: int, db: DbSession, admin: CurrentAdmin
) -> schemas.TeacherDeletePreview:
    return await service.delete_preview(db, teacher_id)


@router.get(
    "/teachers/{teacher_id}/export",
    response_model=schemas.TeacherExport,
    summary="Zaxira nusxa (JSON)",
)
async def export_teacher(
    teacher_id: int, db: DbSession, admin: CurrentAdmin
) -> schemas.TeacherExport:
    """O'qituvchining butun ma'lumoti — o'chirishdan oldin saqlab qo'yish uchun."""
    return await service.export_teacher(db, teacher_id)


@router.delete(
    "/teachers/{teacher_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="O'qituvchini butunlay o'chirish",
)
async def delete_teacher(
    teacher_id: int,
    db: DbSession,
    admin: CurrentAdmin,
    confirm: Annotated[
        str,
        Query(description="Tasdiqlash uchun o'qituvchining username'ini yozing"),
    ],
) -> None:
    """O'qituvchi va unga tegishli HAMMA narsa o'chadi.

    Guruhlar, o'quvchi hisoblari, davomat va to'lov tarixi butunlay
    yo'qoladi — qaytarib bo'lmaydi. Avval `/export` orqali zaxira nusxa
    oling.
    """
    await service.delete_teacher(
        db, teacher_id=teacher_id, actor_id=admin.id, confirm=confirm
    )


@router.get(
    "/stats",
    response_model=report_schemas.AdminStatsOut,
    summary="Platforma statistikasi",
)
async def stats(db: DbSession, admin: CurrentAdmin) -> report_schemas.AdminStatsOut:
    """Faqat agregat ko'rsatkichlar — o'qituvchilarning daromadi ko'rsatilmaydi."""
    return await report_service.admin_stats(db)
