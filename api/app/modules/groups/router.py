from calendar import monthrange
from datetime import date
from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile, status

from app.api.deps import CurrentTeacher, DbSession, Pagination
from app.core.pagination import Page
from app.core.storage import delete_avatar, save_avatar
from app.modules.groups import schedule_schemas, schedule_service, schemas, service
from app.modules.groups.models import GroupStatus
from app.modules.users.schemas import (
    StudentListItem,
    StudentUpdate,
    TempPasswordOut,
)
from app.modules.users.service import get_owned_student

router = APIRouter(prefix="/groups", tags=["groups"])
students_router = APIRouter(prefix="/students", tags=["students"])


# ------------------------------------------------------------------ guruhlar


@router.get("", response_model=Page[schemas.GroupOut], summary="Guruhlar ro'yxati")
async def list_groups(
    db: DbSession,
    teacher: CurrentTeacher,
    params: Pagination,
    status_filter: Annotated[
        GroupStatus | None,
        Query(alias="status", description="active | archived. Bo'sh — hammasi"),
    ] = None,
    search: Annotated[str | None, Query(max_length=120)] = None,
) -> Page[schemas.GroupOut]:
    items, total = await service.list_groups(
        db,
        teacher_id=teacher.id,
        status=status_filter,
        search=search,
        params=params,
    )
    return Page.create(items, total, params)


@router.post(
    "",
    response_model=schemas.GroupOut,
    status_code=status.HTTP_201_CREATED,
    summary="Guruh yaratish",
)
async def create_group(
    data: schemas.GroupCreate, db: DbSession, teacher: CurrentTeacher
) -> schemas.GroupOut:
    return await service.create_group(db, teacher_id=teacher.id, data=data)


@router.get("/{group_id}", response_model=schemas.GroupOut, summary="Guruh ma'lumoti")
async def get_group(
    group_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.GroupOut:
    return await service.get_group_out(db, teacher_id=teacher.id, group_id=group_id)


@router.patch(
    "/{group_id}", response_model=schemas.GroupOut, summary="Guruhni tahrirlash"
)
async def update_group(
    group_id: int,
    data: schemas.GroupUpdate,
    db: DbSession,
    teacher: CurrentTeacher,
) -> schemas.GroupOut:
    """Narx o'zgarsa faqat kelajakdagi oylarga ta'sir qiladi."""
    return await service.update_group(
        db, teacher_id=teacher.id, group_id=group_id, data=data
    )


@router.get(
    "/{group_id}/schedule",
    response_model=schedule_schemas.GroupScheduleOut,
    summary="Dars jadvali va uning tarixi",
)
async def get_schedule(
    group_id: int, db: DbSession, teacher: CurrentTeacher
) -> schedule_schemas.GroupScheduleOut:
    """Amaldagi jadval va barcha o'tgan versiyalar.

    Har bir versiya qaysi sanadan qaysi sanagacha amal qilgani bilan
    qaytadi — o'tgan oyning jadvali shu yerdan ko'rinadi.
    """
    group = await service.get_group(db, teacher_id=teacher.id, group_id=group_id)
    return await service.schedule_out(db, group)


@router.put(
    "/{group_id}/schedule",
    response_model=schedule_schemas.GroupScheduleOut,
    summary="Jadvalni o'zgartirish",
)
async def update_schedule(
    group_id: int,
    data: schedule_schemas.ScheduleUpdate,
    db: DbSession,
    teacher: CurrentTeacher,
) -> schedule_schemas.GroupScheduleOut:
    """Yangi versiya ochadi — eski jadval tarixda o'zgarmay qoladi.

    `effective_from` berilmasa bugundan amal qiladi. Bir kunda bir nechta
    dars bo'lishi mumkin: bitta `weekday` uchun bir necha `start_time`
    kiritiladi.
    """
    group = await service.get_group(db, teacher_id=teacher.id, group_id=group_id)
    service.ensure_writable(group)
    await schedule_service.replace_schedule(db, group=group, data=data)
    return await service.schedule_out(db, group)


@router.get(
    "/{group_id}/schedule/lessons",
    response_model=list[schedule_schemas.PlannedLesson],
    summary="Oy bo'yicha rejadagi darslar",
)
async def schedule_lessons(
    db: DbSession,
    teacher: CurrentTeacher,
    group_id: int,
    year: Annotated[int, Query(ge=2000, le=2100)],
    month: Annotated[int, Query(ge=1, le=12)],
) -> list[schedule_schemas.PlannedLesson]:
    """Shu oyda jadval bo'yicha bo'lishi kerak bo'lgan darslar."""
    group = await service.get_group(db, teacher_id=teacher.id, group_id=group_id)
    first = date(year, month, 1)
    last = date(year, month, monthrange(year, month)[1])
    return await schedule_service.lessons_in_range(
        db, group_id=group.id, start=first, end=last
    )


@router.post(
    "/{group_id}/archive", response_model=schemas.GroupOut, summary="Arxivlash"
)
async def archive_group(
    group_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.GroupOut:
    """Guruh o'chirilmaydi — arxivga o'tadi, butun tarix saqlanadi."""
    return await service.set_group_status(
        db, teacher_id=teacher.id, group_id=group_id, archived=True
    )


@router.post(
    "/{group_id}/unarchive",
    response_model=schemas.GroupOut,
    summary="Arxivdan qaytarish",
)
async def unarchive_group(
    group_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.GroupOut:
    return await service.set_group_status(
        db, teacher_id=teacher.id, group_id=group_id, archived=False
    )


@router.delete(
    "/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Bo'sh guruhni o'chirish",
)
async def delete_group(group_id: int, db: DbSession, teacher: CurrentTeacher) -> None:
    """Faqat o'quvchisiz va davomatsiz guruh o'chiriladi."""
    await service.delete_group(db, teacher_id=teacher.id, group_id=group_id)


# ------------------------------------------------------- guruhdagi o'quvchilar


@router.get(
    "/{group_id}/students",
    response_model=list[schemas.GroupStudentOut],
    summary="Guruhdagi o'quvchilar",
)
async def list_group_students(
    group_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
    include_left: Annotated[
        bool, Query(description="Guruhdan chiqqanlarni ham ko'rsatish")
    ] = False,
) -> list[schemas.GroupStudentOut]:
    return await service.list_group_students(
        db, teacher_id=teacher.id, group_id=group_id, include_left=include_left
    )


@router.post(
    "/{group_id}/students",
    response_model=schemas.AddStudentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Guruhga o'quvchi qo'shish",
)
async def add_student(
    group_id: int,
    data: schemas.AddStudentRequest,
    db: DbSession,
    teacher: CurrentTeacher,
) -> schemas.AddStudentResponse:
    """Yangi o'quvchi yaratadi yoki mavjudini guruhga qo'shadi.

    Yangi account yaratilsa javobda vaqtinchalik parol qaytadi — u faqat
    shu bir marta ko'rsatiladi.
    """
    return await service.add_student_to_group(
        db, teacher_id=teacher.id, group_id=group_id, data=data
    )


@router.patch(
    "/{group_id}/students/{student_id}",
    response_model=schemas.GroupStudentOut,
    summary="Guruhdagi o'quvchi narxini o'zgartirish",
)
async def update_group_student(
    group_id: int,
    student_id: int,
    data: schemas.GroupStudentUpdate,
    db: DbSession,
    teacher: CurrentTeacher,
) -> schemas.GroupStudentOut:
    return await service.update_group_student(
        db,
        teacher_id=teacher.id,
        group_id=group_id,
        student_id=student_id,
        data=data,
    )


@router.delete(
    "/{group_id}/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="O'quvchini guruhdan chiqarish",
)
async def remove_student(
    group_id: int, student_id: int, db: DbSession, teacher: CurrentTeacher
) -> None:
    """Tarix saqlanadi, account o'chmaydi."""
    await service.remove_student_from_group(
        db, teacher_id=teacher.id, group_id=group_id, student_id=student_id
    )


# ------------------------------------------------ o'qituvchining o'quvchilari


@students_router.get(
    "", response_model=Page[StudentListItem], summary="Barcha o'quvchilarim"
)
async def list_students(
    db: DbSession,
    teacher: CurrentTeacher,
    params: Pagination,
    search: Annotated[
        str | None,
        Query(
            max_length=120,
            description="Ism, telefon, username, ota-ona yoki maktab",
        ),
    ] = None,
    group_id: Annotated[int | None, Query(description="Faqat shu guruhdagilar")] = None,
    only_debtors: Annotated[bool, Query(description="Faqat qarzi borlar")] = False,
) -> Page[StudentListItem]:
    """Mavjud o'quvchini boshqa guruhga qo'shishdan oldin qidirish uchun ham.

    Har bir yozuvda guruhlari va umumiy qarzi bo'ladi — ro'yxatdan
    chiqmasdan kim bilan gaplashish kerakligi ko'rinadi.
    """
    items, total = await service.list_students(
        db,
        teacher_id=teacher.id,
        search=search,
        group_id=group_id,
        only_debtors=only_debtors,
        params=params,
    )
    return Page.create(items, total, params)


@students_router.get(
    "/{student_id}",
    response_model=schemas.StudentDetailOut,
    summary="O'quvchi ma'lumoti",
)
async def get_student(
    student_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.StudentDetailOut:
    return await service.get_student_detail(
        db, teacher_id=teacher.id, student_id=student_id
    )


@students_router.patch(
    "/{student_id}",
    response_model=schemas.StudentDetailOut,
    summary="O'quvchini tahrirlash",
)
async def update_student(
    student_id: int,
    data: StudentUpdate,
    db: DbSession,
    teacher: CurrentTeacher,
) -> schemas.StudentDetailOut:
    """Ism, aloqa va karta ma'lumotlari (ota-ona, maktab, izoh)."""
    await service.update_student(
        db, teacher_id=teacher.id, student_id=student_id, data=data
    )
    return await service.get_student_detail(
        db, teacher_id=teacher.id, student_id=student_id
    )


@students_router.post(
    "/{student_id}/reset-password",
    response_model=TempPasswordOut,
    summary="O'quvchi parolini tiklash",
)
async def reset_student_password(
    student_id: int, db: DbSession, teacher: CurrentTeacher
) -> TempPasswordOut:
    """Yangi vaqtinchalik parol beradi va o'quvchining sessiyalarini yopadi."""
    temp_password = await service.reset_student_password(
        db, teacher_id=teacher.id, student_id=student_id
    )
    return TempPasswordOut(student_id=student_id, temporary_password=temp_password)


@students_router.post(
    "/{student_id}/avatar",
    response_model=schemas.StudentDetailOut,
    summary="O'quvchi rasmini yuklash",
)
async def upload_student_avatar(
    student_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
    file: Annotated[UploadFile, File(description="JPG, PNG yoki WEBP")],
) -> schemas.StudentDetailOut:
    """Rasmni o'qituvchi yuklaydi — o'quvchi hisobiga kirishi shart emas.

    Server rasmni tekshiradi (`Content-Type` ga emas, mazmuniga qarab) va
    512×512 gacha kichraytiradi.
    """
    student = await get_owned_student(db, teacher_id=teacher.id, student_id=student_id)
    url = save_avatar(await file.read())
    previous = student.avatar_url
    student.avatar_url = url
    await db.flush()
    # Eski fayl yangisi saqlangandan keyin o'chiriladi.
    delete_avatar(previous)
    return await service.get_student_detail(
        db, teacher_id=teacher.id, student_id=student_id
    )


@students_router.delete(
    "/{student_id}/avatar",
    response_model=schemas.StudentDetailOut,
    summary="O'quvchi rasmini o'chirish",
)
async def delete_student_avatar(
    student_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.StudentDetailOut:
    student = await get_owned_student(db, teacher_id=teacher.id, student_id=student_id)
    delete_avatar(student.avatar_url)
    student.avatar_url = None
    await db.flush()
    return await service.get_student_detail(
        db, teacher_id=teacher.id, student_id=student_id
    )
