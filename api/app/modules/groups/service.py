"""Guruh va o'quvchi boshqaruvining biznes-mantiqi.

Bu modulning eng muhim mas'uliyati — ma'lumot izolyatsiyasi. Har bir
o'qish/yozish amali `teacher_id` bo'yicha filtrlanadi va begona resurs
uchun `NotFoundError` ko'tariladi (talab 12: 403 emas, 404).
"""

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.clock import current_period, local_today, utc_now
from app.core.exceptions import (
    AppError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from app.core.pagination import PageParams
from app.core.security import generate_temp_password, hash_password
from app.modules.attendance.models import AttendanceSession
from app.modules.groups import schedule_schemas, schedule_service, schemas
from app.modules.groups.models import Enrollment, EnrollmentStatus, Group, GroupStatus
from app.modules.payments.models import MonthlyCharge, Payment
from app.modules.users import schemas as user_schemas
from app.modules.users.models import User, UserRole, UserStatus
from app.modules.users.service import ensure_identifiers_free, get_owned_student

# ---------------------------------------------------------------- guruhlar


def _active_student_count() -> Select:
    return (
        select(func.count(Enrollment.id))
        .where(
            Enrollment.group_id == Group.id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
        .correlate(Group)
        .scalar_subquery()
    )


def _expected_monthly() -> Select:
    """Guruhdan bir oyda kutilayotgan summa.

    Alohida narxi borlar o'z narxi bilan, qolganlar guruh narxi bilan
    qo'shiladi — shuning uchun `o'quvchi soni × narx` emas.
    """
    return (
        select(
            func.coalesce(
                func.sum(func.coalesce(Enrollment.custom_fee, Group.monthly_fee)), 0
            )
        )
        .where(
            Enrollment.group_id == Group.id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
        .correlate(Group)
        .scalar_subquery()
    )


def _to_group_out(
    group: Group, student_count: int, expected_monthly: int = 0
) -> schemas.GroupOut:
    return schemas.GroupOut(
        **{
            field: getattr(group, field)
            for field in (
                "id",
                "name",
                "description",
                "monthly_fee",
                "schedule",
                "status",
                "archived_at",
                "created_at",
            )
        },
        student_count=student_count,
        expected_monthly=expected_monthly,
    )


async def schedule_out(
    db: AsyncSession, group: Group
) -> schedule_schemas.GroupScheduleOut:
    """Guruhning jadval tarixi."""
    today = local_today()
    versions = await schedule_service.list_versions(db, group.id)

    items = [
        schedule_schemas.ScheduleVersionOut(
            id=version.id,
            effective_from=version.effective_from,
            effective_to=version.effective_to,
            note=version.note,
            is_current=version.covers(today),
            display=schedule_service.display_text(version),
            slots=[
                schedule_schemas.SlotOut(
                    id=slot.id,
                    weekday=slot.weekday,
                    weekday_name=schedule_schemas.weekday_name(slot.weekday),
                    start_time=slot.start_time,
                    end_time=slot.end_time,
                )
                for slot in version.slots
            ],
        )
        for version in versions
    ]

    return schedule_schemas.GroupScheduleOut(
        group_id=group.id,
        current=next((item for item in items if item.is_current), None),
        history=items,
    )


async def get_group(db: AsyncSession, *, teacher_id: int, group_id: int) -> Group:
    group = await db.scalar(
        select(Group).where(Group.id == group_id, Group.teacher_id == teacher_id)
    )
    if group is None:
        raise NotFoundError("Guruh topilmadi")
    return group


def ensure_writable(group: Group) -> None:
    """Arxivlangan guruhga yangi yozuv qo'shilmaydi (talab 12)."""
    if group.is_archived:
        raise ConflictError(
            "Guruh arxivlangan. Yangi yozuv qo'shish uchun avval arxivdan qaytaring."
        )


async def list_groups(
    db: AsyncSession,
    *,
    teacher_id: int,
    status: GroupStatus | None,
    search: str | None,
    params: PageParams,
) -> tuple[list[schemas.GroupOut], int]:
    conditions = [Group.teacher_id == teacher_id]
    if status is not None:
        conditions.append(Group.status == status)
    if search:
        conditions.append(Group.name.ilike(f"%{search.strip()}%"))

    total = await db.scalar(select(func.count(Group.id)).where(*conditions)) or 0

    rows = await db.execute(
        select(
            Group,
            _active_student_count().label("student_count"),
            _expected_monthly().label("expected_monthly"),
        )
        .where(*conditions)
        .order_by(Group.status, Group.name)
        .offset(params.offset)
        .limit(params.size)
    )
    items = [
        _to_group_out(group, count, expected) for group, count, expected in rows.all()
    ]
    return items, total


async def create_group(
    db: AsyncSession, *, teacher_id: int, data: schemas.GroupCreate
) -> schemas.GroupOut:
    group = Group(
        teacher_id=teacher_id,
        name=data.name.strip(),
        description=data.description,
        monthly_fee=data.monthly_fee,
    )
    db.add(group)
    await db.flush()

    if data.slots:
        await schedule_service.replace_schedule(
            db,
            group=group,
            data=schedule_schemas.ScheduleUpdate(slots=data.slots),
        )
    return _to_group_out(group, 0)


async def update_group(
    db: AsyncSession, *, teacher_id: int, group_id: int, data: schemas.GroupUpdate
) -> schemas.GroupOut:
    """Guruhni tahrirlaydi.

    Narx o'zgarsa faqat kelajakdagi oylarga ta'sir qiladi: o'tgan oylarning
    `amount_due` qiymati `monthly_charges` da muzlatilgan va bu yerda
    o'zgarmaydi (talab 12).
    """
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(group, field, value.strip() if field == "name" and value else value)
    await db.flush()
    return await get_group_out(db, teacher_id=teacher_id, group_id=group.id)


async def get_group_out(
    db: AsyncSession, *, teacher_id: int, group_id: int
) -> schemas.GroupOut:
    row = await db.execute(
        select(
            Group,
            _active_student_count().label("student_count"),
            _expected_monthly().label("expected_monthly"),
        ).where(Group.id == group_id, Group.teacher_id == teacher_id)
    )
    result = row.first()
    if result is None:
        raise NotFoundError("Guruh topilmadi")
    return _to_group_out(result[0], result[1], result[2])


async def set_group_status(
    db: AsyncSession, *, teacher_id: int, group_id: int, archived: bool
) -> schemas.GroupOut:
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    group.status = GroupStatus.ARCHIVED if archived else GroupStatus.ACTIVE
    group.archived_at = utc_now() if archived else None
    await db.flush()
    return await get_group_out(db, teacher_id=teacher_id, group_id=group.id)


async def delete_group(db: AsyncSession, *, teacher_id: int, group_id: int) -> None:
    """Faqat mutlaqo bo'sh guruhni o'chiradi.

    Ma'lumoti bor guruh hech qachon o'chirilmaydi — arxivlanadi (talab 12).
    """
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)

    has_students = await db.scalar(
        select(Enrollment.id).where(Enrollment.group_id == group.id).limit(1)
    )
    has_sessions = await db.scalar(
        select(AttendanceSession.id)
        .where(AttendanceSession.group_id == group.id)
        .limit(1)
    )
    if has_students or has_sessions:
        raise ConflictError(
            "Bu guruhda o'quvchi yoki davomat tarixi bor — o'chirib bo'lmaydi. "
            "Uni arxivlang."
        )
    await db.delete(group)


# -------------------------------------------------- guruhdagi o'quvchilar


def _to_group_student(enrollment: Enrollment, student: User, group_fee: int):
    fee = enrollment.custom_fee if enrollment.custom_fee is not None else group_fee
    return schemas.GroupStudentOut(
        enrollment_id=enrollment.id,
        student=student,
        custom_fee=enrollment.custom_fee,
        fee_note=enrollment.fee_note,
        monthly_fee=fee,
        discount=max(group_fee - fee, 0),
        status=enrollment.status,
        joined_on=enrollment.joined_on,
        left_on=enrollment.left_on,
    )


async def list_group_students(
    db: AsyncSession, *, teacher_id: int, group_id: int, include_left: bool
) -> list[schemas.GroupStudentOut]:
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)

    conditions = [Enrollment.group_id == group.id]
    if not include_left:
        conditions.append(Enrollment.status == EnrollmentStatus.ACTIVE)

    rows = await db.execute(
        select(Enrollment, User)
        .join(User, User.id == Enrollment.student_id)
        .where(*conditions)
        .order_by(User.first_name, User.last_name)
    )
    return [
        _to_group_student(enrollment, student, group.monthly_fee)
        for enrollment, student in rows.all()
    ]


async def _create_student_account(
    db: AsyncSession, *, teacher_id: int, data: schemas.AddStudentRequest
) -> tuple[User, str]:
    await ensure_identifiers_free(db, phone=data.phone, username=data.username)

    temp_password = generate_temp_password()
    student = User(
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
        first_name=(data.first_name or "").strip(),
        last_name=data.last_name,
        phone=data.phone,
        username=data.username.lower() if data.username else None,
        password_hash=hash_password(temp_password),
        # Birinchi kirishda parolni almashtirish majburiy (talab 3).
        must_change_password=True,
        teacher_id=teacher_id,
    )
    db.add(student)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise ConflictError("Bu telefon yoki username allaqachon band") from exc
    return student, temp_password


async def add_student_to_group(
    db: AsyncSession,
    *,
    teacher_id: int,
    group_id: int,
    data: schemas.AddStudentRequest,
) -> schemas.AddStudentResponse:
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    ensure_writable(group)

    temp_password: str | None = None
    if data.student_id is not None:
        student = await get_owned_student(
            db, teacher_id=teacher_id, student_id=data.student_id
        )
    else:
        student, temp_password = await _create_student_account(
            db, teacher_id=teacher_id, data=data
        )

    existing = await db.scalar(
        select(Enrollment).where(
            Enrollment.group_id == group.id, Enrollment.student_id == student.id
        )
    )
    if existing is not None:
        if existing.status is EnrollmentStatus.ACTIVE:
            raise ConflictError("Bu o'quvchi allaqachon shu guruhda")
        # Qaytib kelgan o'quvchi — eski yozuv tiklanadi, tarix saqlanadi.
        existing.status = EnrollmentStatus.ACTIVE
        existing.left_on = None
        if data.custom_fee is not None:
            existing.custom_fee = data.custom_fee
            existing.fee_note = data.fee_note
        enrollment = existing
    else:
        enrollment = Enrollment(
            group_id=group.id,
            student_id=student.id,
            custom_fee=data.custom_fee,
            fee_note=data.fee_note if data.custom_fee is not None else None,
            joined_on=data.joined_on or local_today(),
        )
        db.add(enrollment)

    await db.flush()
    return schemas.AddStudentResponse(
        student=_to_group_student(enrollment, student, group.monthly_fee),
        temporary_password=temp_password,
    )


async def get_enrollment(
    db: AsyncSession, *, teacher_id: int, group_id: int, student_id: int
) -> tuple[Group, Enrollment, User]:
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    row = await db.execute(
        select(Enrollment, User)
        .join(User, User.id == Enrollment.student_id)
        .where(Enrollment.group_id == group.id, Enrollment.student_id == student_id)
    )
    result = row.first()
    if result is None:
        raise NotFoundError("Bu guruhda bunday o'quvchi yo'q")
    return group, result[0], result[1]


async def update_group_student(
    db: AsyncSession,
    *,
    teacher_id: int,
    group_id: int,
    student_id: int,
    data: schemas.GroupStudentUpdate,
) -> schemas.GroupStudentOut:
    group, enrollment, student = await get_enrollment(
        db, teacher_id=teacher_id, group_id=group_id, student_id=student_id
    )
    if data.reset_custom_fee:
        # Guruh narxiga qaytdi — sabab ham keraksiz bo'lib qoladi.
        enrollment.custom_fee = None
        enrollment.fee_note = None
    elif data.custom_fee is not None:
        enrollment.custom_fee = data.custom_fee
        enrollment.fee_note = data.fee_note
    await db.flush()

    if data.apply_current_month:
        await _apply_fee_to_current_month(db, enrollment, group)
        await db.flush()
    return _to_group_student(enrollment, student, group.monthly_fee)


async def _apply_fee_to_current_month(
    db: AsyncSession, enrollment: Enrollment, group: Group
) -> None:
    """Yangi narxni joriy oyning ochilgan hisobiga ham qo'llaydi.

    Odatda `amount_due` muzlatilgan bo'ladi (talab 12) — aks holda guruh
    narxi o'zgarganda o'tgan oylarning qarzi ham o'zgarib ketardi. Lekin
    joriy oy hali yopilmagan: chegirma haqidagi kelishuv ko'pincha oy
    boshida bo'ladi va o'qituvchi uni shu oydan qo'llashni kutadi.

    Shart: shu oyda hali to'lov bo'lmagan bo'lsin. To'lov kiritilgan
    hisobga tegilmaydi — u allaqachon hisob-kitobning bir qismi.
    """
    year, month = current_period()
    charge = await db.scalar(
        select(MonthlyCharge).where(
            MonthlyCharge.enrollment_id == enrollment.id,
            MonthlyCharge.year == year,
            MonthlyCharge.month == month,
        )
    )
    if charge is None:
        return

    paid = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.charge_id == charge.id
        )
    )
    if paid:
        return

    charge.amount_due = enrollment.effective_fee(group)


async def remove_student_from_group(
    db: AsyncSession, *, teacher_id: int, group_id: int, student_id: int
) -> None:
    """Guruhdan chiqarish.

    Account o'chmaydi (boshqa guruhda bo'lishi mumkin), davomat va to'lov
    tarixi saqlanadi. Kelgusi oylarga hisob ochilmaydi.
    """
    _, enrollment, _ = await get_enrollment(
        db, teacher_id=teacher_id, group_id=group_id, student_id=student_id
    )
    if enrollment.status is EnrollmentStatus.INACTIVE:
        return
    enrollment.status = EnrollmentStatus.INACTIVE
    enrollment.left_on = local_today()
    await db.flush()


# ------------------------------------------------ o'qituvchining o'quvchilari


async def list_students(
    db: AsyncSession,
    *,
    teacher_id: int,
    search: str | None,
    group_id: int | None,
    only_debtors: bool,
    params: PageParams,
) -> tuple[list[user_schemas.StudentListItem], int]:
    """O'qituvchining o'quvchilari — karta uchun yetarli ma'lumot bilan.

    Qarz va guruhlar soni ro'yxatning o'zida keladi: aks holda har bir
    o'quvchi uchun alohida so'rov kerak bo'lardi.
    """
    conditions = [User.teacher_id == teacher_id, User.role == UserRole.STUDENT]
    if search:
        pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.phone.ilike(pattern),
                User.username.ilike(pattern),
                User.parent_name.ilike(pattern),
                User.parent_phone.ilike(pattern),
                User.school.ilike(pattern),
            )
        )

    active_enrollments = (
        select(Enrollment.id)
        .join(Group, Group.id == Enrollment.group_id)
        .where(
            Enrollment.student_id == User.id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
            Group.teacher_id == teacher_id,
        )
        .correlate(User)
    )
    group_count = (
        select(func.count())
        .select_from(active_enrollments.subquery())
        .scalar_subquery()
    )

    if group_id is not None:
        conditions.append(
            select(Enrollment.id)
            .where(
                Enrollment.student_id == User.id,
                Enrollment.group_id == group_id,
                Enrollment.status == EnrollmentStatus.ACTIVE,
            )
            .correlate(User)
            .exists()
        )

    paid = (
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.charge_id == MonthlyCharge.id)
        .correlate(MonthlyCharge)
        .scalar_subquery()
    )
    unpaid = func.max(MonthlyCharge.amount_due - paid, 0)
    debt = (
        select(func.coalesce(func.sum(unpaid), 0))
        .select_from(MonthlyCharge)
        .join(Enrollment, Enrollment.id == MonthlyCharge.enrollment_id)
        .join(Group, Group.id == Enrollment.group_id)
        .where(Enrollment.student_id == User.id, Group.teacher_id == teacher_id)
        .correlate(User)
        .scalar_subquery()
    )

    if only_debtors:
        conditions.append(debt > 0)

    total = await db.scalar(select(func.count(User.id)).where(*conditions)) or 0

    rows = await db.execute(
        select(User, group_count.label("group_count"), debt.label("debt"))
        .where(*conditions)
        .order_by(User.first_name, User.last_name)
        .offset(params.offset)
        .limit(params.size)
    )
    page = rows.all()

    names = await _group_names_by_student(
        db, teacher_id=teacher_id, student_ids=[user.id for user, _, _ in page]
    )

    return [
        user_schemas.StudentListItem(
            **user_schemas.StudentSummary.model_validate(user).model_dump(),
            parent_name=user.parent_name,
            parent_phone=user.parent_phone,
            school=user.school,
            group_count=count,
            group_names=names.get(user.id, []),
            debt=int(student_debt or 0),
        )
        for user, count, student_debt in page
    ], total


async def _group_names_by_student(
    db: AsyncSession, *, teacher_id: int, student_ids: list[int]
) -> dict[int, list[str]]:
    """Sahifadagi o'quvchilarning faol guruhlari — bitta so'rovda."""
    if not student_ids:
        return {}

    rows = await db.execute(
        select(Enrollment.student_id, Group.name)
        .join(Group, Group.id == Enrollment.group_id)
        .where(
            Enrollment.student_id.in_(student_ids),
            Enrollment.status == EnrollmentStatus.ACTIVE,
            Group.teacher_id == teacher_id,
        )
        .order_by(Group.name)
    )

    names: dict[int, list[str]] = {}
    for student_id, group_name in rows.all():
        names.setdefault(student_id, []).append(group_name)
    return names


async def get_student_detail(
    db: AsyncSession, *, teacher_id: int, student_id: int
) -> schemas.StudentDetailOut:
    student = await get_owned_student(db, teacher_id=teacher_id, student_id=student_id)
    rows = await db.execute(
        select(Enrollment, Group)
        .join(Group, Group.id == Enrollment.group_id)
        .where(Enrollment.student_id == student.id, Group.teacher_id == teacher_id)
        .options(selectinload(Enrollment.group))
        .order_by(Group.name)
    )
    groups = [
        schemas.StudentGroupRef(
            group_id=group.id,
            group_name=group.name,
            status=enrollment.status,
            monthly_fee=(
                enrollment.custom_fee
                if enrollment.custom_fee is not None
                else group.monthly_fee
            ),
            joined_on=enrollment.joined_on,
        )
        for enrollment, group in rows.all()
    ]
    detail = schemas.StudentDetailOut.model_validate(student)
    detail.groups = groups
    return detail


async def update_student(
    db: AsyncSession, *, teacher_id: int, student_id: int, data
) -> User:
    student = await get_owned_student(db, teacher_id=teacher_id, student_id=student_id)
    payload = data.model_dump(exclude_unset=True)
    if payload:
        await ensure_identifiers_free(
            db,
            phone=payload.get("phone"),
            username=payload.get("username"),
            exclude_user_id=student.id,
        )
    for field, value in payload.items():
        setattr(student, field, value)
    if not (student.phone or student.username):
        raise ValidationError("O'quvchida telefon yoki username bo'lishi shart")
    await db.flush()
    return student


async def reset_student_password(
    db: AsyncSession, *, teacher_id: int, student_id: int
) -> str:
    """O'qituvchi o'z o'quvchisiga yangi vaqtinchalik parol beradi.

    O'quvchi parolni o'zi tiklay olmaydi (talab 3) — u o'qituvchisiga
    murojaat qiladi. Shu sababli bu faqat o'quvchi avval so'rov yuborgan
    bo'lsa ishlaydi — o'qituvchi parolni o'z ixtiyori bilan, istalgan
    payt o'zgartira olmaydi.
    """
    from app.modules.auth.service import revoke_all_tokens

    student = await get_owned_student(db, teacher_id=teacher_id, student_id=student_id)
    if student.password_reset_requested_at is None:
        raise ConflictError(
            "O'quvchidan parolni tiklash so'rovi kelmagan. "
            "U ilovaga kirolmay qolganda so'rov yuboradi."
        )
    temp_password = generate_temp_password()
    student.password_hash = hash_password(temp_password)
    student.must_change_password = True
    student.password_reset_requested_at = None
    await revoke_all_tokens(db, student.id)
    await db.flush()
    return temp_password


async def import_students(
    db: AsyncSession,
    *,
    teacher_id: int,
    group_id: int,
    data: schemas.ImportRequest,
) -> schemas.ImportResult:
    """Ro'yxatni bir yo'la qo'shadi.

    Har bir qator alohida savepoint ichida bajariladi: bitta yozuvdagi
    xato (takroriy telefon, bo'sh ism) qolgan qatorlarni bekor qilmasin.
    Natijada nima qo'shilgani va nima o'tkazib yuborilgani sabab bilan
    qaytadi — o'qituvchi faqat muammoli qatorni tuzatadi.
    """
    group = await get_group(db, teacher_id=teacher_id, group_id=group_id)
    ensure_writable(group)

    rows: list[schemas.ImportResultRow] = []
    added = 0

    for index, row in enumerate(data.rows, start=1):
        full_name = f"{row.first_name} {row.last_name or ''}".strip()
        try:
            async with db.begin_nested():
                result = await add_student_to_group(
                    db,
                    teacher_id=teacher_id,
                    group_id=group.id,
                    data=schemas.AddStudentRequest(
                        first_name=row.first_name,
                        last_name=row.last_name,
                        phone=row.phone,
                        custom_fee=row.custom_fee,
                        joined_on=data.joined_on,
                    ),
                )
        except AppError as exc:
            rows.append(
                schemas.ImportResultRow(
                    line=index, full_name=full_name, error=exc.message
                )
            )
            continue
        except PydanticValidationError as exc:
            # Masalan telefonsiz qator — butun importni to'xtatmaydi.
            message = exc.errors()[0].get("msg", "Ma'lumot noto'g'ri")
            rows.append(
                schemas.ImportResultRow(
                    line=index,
                    full_name=full_name,
                    error=message.removeprefix("Value error, "),
                )
            )
            continue

        added += 1
        rows.append(
            schemas.ImportResultRow(
                line=index,
                full_name=result.student.student.full_name,
                student_id=result.student.student.id,
                temporary_password=result.temporary_password,
            )
        )

    return schemas.ImportResult(added=added, failed=len(rows) - added, rows=rows)
