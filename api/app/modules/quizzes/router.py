from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import (
    CurrentAdmin,
    CurrentStudent,
    CurrentTeacher,
    DbSession,
    Pagination,
)
from app.core.pagination import Page
from app.core.schemas import Message
from app.modules.quizzes import schemas, service

admin_router = APIRouter(prefix="/admin/quizzes", tags=["quizzes"])
router = APIRouter(prefix="/quizzes", tags=["quizzes"])
student_router = APIRouter(prefix="/students/me/quizzes", tags=["quizzes"])


# --------------------------------------------------------- admin: katalog


@admin_router.post(
    "",
    response_model=schemas.QuizOut,
    status_code=status.HTTP_201_CREATED,
    summary="Katalog testi yaratish",
)
async def create_catalog_quiz(
    data: schemas.QuizCreate, db: DbSession, admin: CurrentAdmin
) -> schemas.QuizOut:
    """Owner (Super Admin) tomonidan tayyorlangan, o'qituvchilar obuna
    bo'lishi mumkin bo'lgan test — Steam ishchi stoli uslubi."""
    quiz = await service.create_quiz(db, owner_id=admin.id, is_catalog=True, data=data)
    return await service.get_quiz_detail(db, teacher_id=admin.id, quiz_id=quiz.id)


@admin_router.get(
    "",
    response_model=Page[schemas.QuizSummary],
    summary="O'zim yaratgan katalog testlar",
)
async def list_my_catalog_quizzes(
    db: DbSession,
    admin: CurrentAdmin,
    params: Pagination,
    subject: Annotated[str | None, Query(max_length=80)] = None,
) -> Page[schemas.QuizSummary]:
    items, total = await service.list_catalog_quizzes(
        db, teacher_id=admin.id, subject=subject, params=params
    )
    return Page.create(items, total, params)


@admin_router.get(
    "/{quiz_id}", response_model=schemas.QuizOut, summary="Katalog testi tafsiloti"
)
async def get_catalog_quiz(
    quiz_id: int, db: DbSession, admin: CurrentAdmin
) -> schemas.QuizOut:
    return await service.get_quiz_detail(db, teacher_id=admin.id, quiz_id=quiz_id)


@admin_router.put(
    "/{quiz_id}", response_model=schemas.QuizOut, summary="Katalog testini tahrirlash"
)
async def update_catalog_quiz(
    quiz_id: int, data: schemas.QuizUpdateFull, db: DbSession, admin: CurrentAdmin
) -> schemas.QuizOut:
    """Katalog testini bo'lim va savollar bilan birga tahrirlash."""
    quiz = await service.update_quiz(db, owner_id=admin.id, quiz_id=quiz_id, data=data)
    return await service.get_quiz_detail(db, teacher_id=admin.id, quiz_id=quiz.id)


@admin_router.delete(
    "/{quiz_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Katalog testini o'chirish",
)
async def delete_catalog_quiz(quiz_id: int, db: DbSession, admin: CurrentAdmin) -> None:
    await service.delete_quiz(db, owner_id=admin.id, quiz_id=quiz_id)


# ---------------------------------------------------- o'qituvchi: katalog


@router.get(
    "/catalog", response_model=Page[schemas.QuizSummary], summary="Katalogdagi testlar"
)
async def browse_catalog(
    db: DbSession,
    teacher: CurrentTeacher,
    params: Pagination,
    subject: Annotated[str | None, Query(max_length=80)] = None,
) -> Page[schemas.QuizSummary]:
    items, total = await service.list_catalog_quizzes(
        db, teacher_id=teacher.id, subject=subject, params=params
    )
    return Page.create(items, total, params)


@router.post(
    "/{quiz_id}/subscribe",
    response_model=Message,
    summary="Katalog testiga obuna bo'lish",
)
async def subscribe_quiz(
    quiz_id: int, db: DbSession, teacher: CurrentTeacher
) -> Message:
    await service.subscribe(db, teacher_id=teacher.id, quiz_id=quiz_id)
    return Message(detail="Obuna bo'ldingiz")


@router.delete(
    "/{quiz_id}/subscribe",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Obunani bekor qilish",
)
async def unsubscribe_quiz(
    quiz_id: int, db: DbSession, teacher: CurrentTeacher
) -> None:
    await service.unsubscribe(db, teacher_id=teacher.id, quiz_id=quiz_id)


# ------------------------------------------------------- o'qituvchi: test


@router.get(
    "",
    response_model=Page[schemas.QuizSummary],
    summary="Ishlatsa bo'ladigan testlarim",
)
async def list_my_quizzes(
    db: DbSession, teacher: CurrentTeacher, params: Pagination
) -> Page[schemas.QuizSummary]:
    """O'zi yaratgan testlar + obuna bo'lgan katalog testlar."""
    items, total = await service.list_usable_quizzes(
        db, teacher_id=teacher.id, params=params
    )
    return Page.create(items, total, params)


@router.post(
    "",
    response_model=schemas.QuizOut,
    status_code=status.HTTP_201_CREATED,
    summary="O'z testimni yaratish",
)
async def create_own_quiz(
    data: schemas.QuizCreate, db: DbSession, teacher: CurrentTeacher
) -> schemas.QuizOut:
    quiz = await service.create_quiz(
        db, owner_id=teacher.id, is_catalog=False, data=data
    )
    return await service.get_quiz_detail(db, teacher_id=teacher.id, quiz_id=quiz.id)


@router.put(
    "/{quiz_id}", response_model=schemas.QuizOut, summary="O'z testimni tahrirlash"
)
async def update_own_quiz(
    quiz_id: int, data: schemas.QuizUpdateFull, db: DbSession, teacher: CurrentTeacher
) -> schemas.QuizOut:
    """Bo'lim va savollar bilan birga to'liq tahrirlash — tayinlangan testni
    tahrirlab bo'lmaydi (avval tayinlovlarni o'chiring)."""
    quiz = await service.update_quiz(
        db, owner_id=teacher.id, quiz_id=quiz_id, data=data
    )
    return await service.get_quiz_detail(db, teacher_id=teacher.id, quiz_id=quiz.id)


@router.delete(
    "/{quiz_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="O'z testimni o'chirish",
)
async def delete_own_quiz(quiz_id: int, db: DbSession, teacher: CurrentTeacher) -> None:
    await service.delete_quiz(db, owner_id=teacher.id, quiz_id=quiz_id)


@router.post(
    "/{quiz_id}/clone",
    response_model=schemas.QuizOut,
    status_code=status.HTTP_201_CREATED,
    summary="Test nusxasini yaratish",
)
async def clone_quiz(
    quiz_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.QuizOut:
    quiz = await service.clone_quiz(db, teacher_id=teacher.id, quiz_id=quiz_id)
    return await service.get_quiz_detail(db, teacher_id=teacher.id, quiz_id=quiz.id)


# --------------------------------------------------------------- tayinlash


@router.post(
    "/assignments",
    response_model=schemas.AssignmentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Testni guruhga tayinlash",
)
async def create_assignment(
    data: schemas.AssignmentCreate, db: DbSession, teacher: CurrentTeacher
) -> schemas.AssignmentOut:
    assignment = await service.create_assignment(db, teacher_id=teacher.id, data=data)
    return await service.get_assignment_out(
        db, teacher_id=teacher.id, assignment_id=assignment.id
    )


@router.get(
    "/assignments",
    response_model=list[schemas.AssignmentOut],
    summary="Tayinlovlar ro'yxati",
)
async def list_assignments(
    db: DbSession,
    teacher: CurrentTeacher,
    group_id: Annotated[int | None, Query()] = None,
) -> list[schemas.AssignmentOut]:
    return await service.list_assignments(db, teacher_id=teacher.id, group_id=group_id)


@router.delete(
    "/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Tayinlovni o'chirish",
)
async def delete_assignment(
    assignment_id: int, db: DbSession, teacher: CurrentTeacher
) -> None:
    await service.delete_assignment(
        db, teacher_id=teacher.id, assignment_id=assignment_id
    )


@router.get(
    "/assignments/{assignment_id}/results",
    response_model=schemas.AssignmentResultsOut,
    summary="Imtihon reytingi",
)
async def get_assignment_results(
    assignment_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.AssignmentResultsOut:
    assignment = await service.get_owned_assignment(
        db, teacher_id=teacher.id, assignment_id=assignment_id
    )
    return await service.compute_results(db, assignment=assignment)


@router.post(
    "/assignments/{assignment_id}/finalize",
    response_model=schemas.AssignmentResultsOut,
    summary="Baholashni yakunlab, reyting va xabarlarni yuborish",
)
async def finalize_assignment(
    assignment_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.AssignmentResultsOut:
    """Essay savollarni qo'lda baholab bo'lgach chaqiriladi — deadline
    o'tgan bo'lsa darhol reyting va Telegram/email xabarlarini yuboradi."""
    assignment = await service.get_owned_assignment(
        db, teacher_id=teacher.id, assignment_id=assignment_id
    )
    await service.maybe_finalize_assignment(db, assignment=assignment)
    return await service.compute_results(db, assignment=assignment)


@router.get(
    "/assignments/{assignment_id}/pending-grading",
    response_model=list[schemas.PendingGradingItem],
    summary="Qo'lda baholanishi kerak bo'lgan javoblar",
)
async def get_pending_grading(
    assignment_id: int, db: DbSession, teacher: CurrentTeacher
) -> list[schemas.PendingGradingItem]:
    return await service.list_pending_grading(
        db, teacher_id=teacher.id, assignment_id=assignment_id
    )


@router.post(
    "/attempts/{attempt_id}/grade",
    response_model=schemas.AttemptResultOut,
    summary="Essay javobni qo'lda baholash",
)
async def grade_attempt(
    attempt_id: int,
    data: schemas.ManualGradeRequest,
    db: DbSession,
    teacher: CurrentTeacher,
) -> schemas.AttemptResultOut:
    return await service.grade_attempt(
        db, teacher_id=teacher.id, attempt_id=attempt_id, data=data
    )


# `/{quiz_id}` — bitta segmentli parametr, shuning uchun yuqoridagi
# `/assignments`, `/attempts/...` kabi bitta segmentli literal yo'llardan
# KEYIN ro'yxatdan o'tishi shart (aks holda "assignments" ham quiz_id
# sifatida tushunilib, 422 xato beradi — Starlette ro'yxatga olingan
# tartibda tekshiradi).
@router.get("/{quiz_id}", response_model=schemas.QuizOut, summary="Test tafsiloti")
async def get_quiz(
    quiz_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.QuizOut:
    return await service.get_quiz_detail(db, teacher_id=teacher.id, quiz_id=quiz_id)


# -------------------------------------------------------------- o'quvchi


@student_router.get(
    "/assignments",
    response_model=list[schemas.StudentAssignmentOut],
    summary="Menga tayinlangan testlar",
)
async def my_assignments(
    db: DbSession, student: CurrentStudent
) -> list[schemas.StudentAssignmentOut]:
    return await service.list_student_assignments(db, student=student)


@student_router.post(
    "/assignments/{assignment_id}/start",
    response_model=schemas.AttemptStartOut,
    status_code=status.HTTP_201_CREATED,
    summary="Testni boshlash",
)
async def start_attempt(
    assignment_id: int, db: DbSession, student: CurrentStudent
) -> schemas.AttemptStartOut:
    return await service.start_attempt(db, student=student, assignment_id=assignment_id)


@student_router.post(
    "/attempts/{attempt_id}/submit",
    response_model=schemas.AttemptResultOut,
    summary="Testni topshirish",
)
async def submit_attempt(
    attempt_id: int,
    data: schemas.AttemptSubmit,
    db: DbSession,
    student: CurrentStudent,
) -> schemas.AttemptResultOut:
    return await service.submit_attempt(
        db, student=student, attempt_id=attempt_id, data=data
    )


@student_router.get(
    "/history",
    response_model=list[schemas.AttemptHistoryItem],
    summary="Yechgan testlarim tarixi",
)
async def my_history(
    db: DbSession,
    student: CurrentStudent,
    assignment_id: Annotated[int | None, Query()] = None,
) -> list[schemas.AttemptHistoryItem]:
    return await service.get_history(
        db, student_id=student.id, assignment_id=assignment_id
    )


@student_router.get(
    "/telegram-link-code", summary="Ota-ona uchun Telegram bog'lash kodi"
)
async def get_telegram_link_code(
    db: DbSession, student: CurrentStudent
) -> dict[str, str]:
    """Ota-ona shu kodni Telegram botga `/start <kod>` shaklida yuboradi."""
    code = await service.get_or_create_link_code(db, student_id=student.id)
    return {"link_code": code}
