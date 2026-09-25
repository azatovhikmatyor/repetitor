from typing import Annotated

from fastapi import APIRouter, Query, status
from fastapi.responses import Response

from app.api.deps import CurrentStudent, CurrentTeacher, DbSession
from app.core.pdf import build_receipt_pdf
from app.modules.payments import schemas, service

router = APIRouter(tags=["payments"])


@router.get(
    "/students/me/payments",
    response_model=list[schemas.StudentChargeOut],
    summary="O'zining to'lov tarixi (o'quvchi)",
)
async def my_payments(
    db: DbSession, student: CurrentStudent
) -> list[schemas.StudentChargeOut]:
    """Barcha guruhlar bo'yicha o'z oylik hisoblari va to'lovlari.

    MUHIM: bu literal `/students/me/payments` — pastdagi
    `/students/{student_id}/payments` dan OLDIN turishi shart, aks holda
    "me" `student_id` sifatida o'qilib, 422 qaytaradi.
    """
    return await service.student_payments_self(db, student=student)


@router.get(
    "/groups/{group_id}/payments",
    response_model=schemas.GroupMonthOut,
    summary="Guruhning oylik to'lov holati",
)
async def group_month(
    group_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
    year: Annotated[int, Query(ge=2000, le=2100)],
    month: Annotated[int, Query(ge=1, le=12)],
) -> schemas.GroupMonthOut:
    """Har bir o'quvchi uchun: kutilgan, to'langan, qarz va holat.

    Shu oyning hisoblari hali ochilmagan bo'lsa, so'rov paytida avtomatik
    ochiladi (narx o'sha paytda muzlatiladi).
    """
    return await service.group_month(
        db, teacher_id=teacher.id, group_id=group_id, year=year, month=month
    )


@router.post(
    "/groups/{group_id}/payments",
    response_model=schemas.PaymentOut,
    status_code=status.HTTP_201_CREATED,
    summary="To'lov qayd etish",
)
async def create_payment(
    group_id: int,
    data: schemas.PaymentCreate,
    db: DbSession,
    teacher: CurrentTeacher,
) -> schemas.PaymentOut:
    """To'liq yoki qisman to'lovni kiritadi.

    Bir oyga bir nechta to'lov kiritish mumkin — ular qo'shilib boradi
    (qisman to'lov). O'tgan, joriy va kelasi oy uchun ruxsat.
    """
    return await service.record_payment(
        db, teacher_id=teacher.id, group_id=group_id, data=data
    )


@router.get(
    "/groups/{group_id}/payments/history",
    response_model=list[schemas.PaymentOut],
    summary="Guruh bo'yicha to'lovlar tarixi",
)
async def group_payment_history(
    group_id: int,
    db: DbSession,
    teacher: CurrentTeacher,
    year: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> list[schemas.PaymentOut]:
    return await service.list_group_payments(
        db, teacher_id=teacher.id, group_id=group_id, year=year, month=month
    )


@router.get(
    "/payments/{payment_id}",
    response_model=schemas.PaymentOut,
    summary="To'lov ma'lumoti",
)
async def get_payment(
    payment_id: int, db: DbSession, teacher: CurrentTeacher
) -> schemas.PaymentOut:
    return await service.get_payment(db, teacher_id=teacher.id, payment_id=payment_id)


@router.get(
    "/payments/{payment_id}/receipt.pdf",
    summary="Kvitansiyani PDF qilib yuklab olish",
)
async def download_receipt_pdf(
    payment_id: int, db: DbSession, teacher: CurrentTeacher
) -> Response:
    """Ekrandagi kvitansiya (`receipt-modal.tsx`) bilan bir xil ma'lumot,
    lekin haqiqiy fayl — ota-onaga yuborish yoki arxivlash uchun."""
    payment = await service.get_payment(
        db, teacher_id=teacher.id, payment_id=payment_id
    )
    pdf = build_receipt_pdf(payment=payment, teacher_name=teacher.full_name)
    filename = f"kvitansiya-{payment.year}{payment.month:02d}-{payment.id}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/payments/{payment_id}/reverse",
    response_model=schemas.PaymentOut,
    status_code=status.HTTP_201_CREATED,
    summary="To'lovni bekor qilish",
)
async def reverse_payment(
    payment_id: int,
    data: schemas.PaymentReverse,
    db: DbSession,
    teacher: CurrentTeacher,
) -> schemas.PaymentOut:
    """To'lov o'chirilmaydi — manfiy summali bekor qilish yozuvi qo'shiladi.

    Javobda aynan shu yangi yozuv qaytadi.
    """
    return await service.reverse_payment(
        db, teacher_id=teacher.id, payment_id=payment_id, note=data.note
    )


@router.get(
    "/students/{student_id}/payments",
    response_model=list[schemas.StudentChargeOut],
    summary="O'quvchining to'lov tarixi",
)
async def student_payments(
    student_id: int, db: DbSession, teacher: CurrentTeacher
) -> list[schemas.StudentChargeOut]:
    """Barcha guruhlar bo'yicha oylik hisoblar va ularning to'lovlari."""
    return await service.student_payments(
        db, teacher_id=teacher.id, student_id=student_id
    )
