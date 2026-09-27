"""Testlar, obuna, tayinlash va urinishlarning biznes-mantiqi.

Katalog testlari (`is_catalog=True`) faqat Super Admin tomonidan yaratiladi.
O'qituvchi ulardan foydalanish uchun avval obuna bo'lishi kerak (Steam
ishchi stoli uslubi) — yoki o'zi mustaqil test yaratadi (`is_catalog=False`,
obunasiz, faqat o'ziniki).
"""

import logging
import secrets

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.clock import as_utc, utc_now
from app.core.exceptions import ConflictError, NotFoundError
from app.core.notify import notify_exam_result_to_parent, notify_teacher_exam_ready
from app.core.pagination import PageParams
from app.modules.groups.models import Enrollment, EnrollmentStatus, Group
from app.modules.quizzes import schemas
from app.modules.quizzes.models import (
    AttemptStatus,
    ParentTelegramLink,
    QuestionType,
    Quiz,
    QuizAssignment,
    QuizAttempt,
    QuizMode,
    QuizQuestion,
    QuizSection,
    QuizSubscription,
    ScoreRule,
)
from app.modules.users.models import User

logger = logging.getLogger("app.quizzes")

# -------------------------------------------------------------------- test


async def _question_count(quiz_id: int, db: AsyncSession) -> int:
    return (
        await db.scalar(
            select(func.count(QuizQuestion.id))
            .join(QuizSection, QuizSection.id == QuizQuestion.section_id)
            .where(QuizSection.quiz_id == quiz_id)
        )
        or 0
    )


def _build_sections(
    quiz_id: int, sections_in: list[schemas.SectionIn]
) -> list[QuizSection]:
    """Bo'lim/savollarni ORM obyektiga aylantirish (create/update birga ishlatadi)."""
    sections = []
    for section_index, section_in in enumerate(sections_in):
        section = QuizSection(
            quiz_id=quiz_id,
            order_index=section_index,
            title=section_in.title.strip(),
            instructions=section_in.instructions,
        )
        for question_index, question_in in enumerate(section_in.questions):
            section.questions.append(
                QuizQuestion(
                    section_id=None,  # ORM relationship orqali to'ldiriladi
                    order_index=question_index,
                    type=question_in.type,
                    prompt=question_in.prompt,
                    media_url=question_in.media_url,
                    options=question_in.options,
                    correct_answer=question_in.correct_answer,
                    points=question_in.points,
                )
            )
        sections.append(section)
    return sections


async def create_quiz(
    db: AsyncSession, *, owner_id: int, is_catalog: bool, data: schemas.QuizCreate
) -> Quiz:
    quiz = Quiz(
        owner_id=owner_id,
        is_catalog=is_catalog,
        subject=data.subject.strip(),
        title=data.title.strip(),
        description=data.description,
        time_limit_minutes=data.time_limit_minutes,
    )
    db.add(quiz)
    await db.flush()

    for section in _build_sections(quiz.id, data.sections):
        section.quiz_id = quiz.id
        db.add(section)
    await db.flush()
    return quiz


async def update_quiz(
    db: AsyncSession, *, owner_id: int, quiz_id: int, data: schemas.QuizUpdateFull
) -> Quiz:
    """Testni to'liq tahrirlash — bo'lim va savollar o'chirilib, yangilari yoziladi.

    Tayinlangan testni tahrirlashga ruxsat yo'q — oldingi urinishlar
    natijasi buzilib ketmasligi uchun.
    """
    quiz = await get_owned_quiz(db, owner_id=owner_id, quiz_id=quiz_id)

    has_assignments = await db.scalar(
        select(QuizAssignment.id).where(QuizAssignment.quiz_id == quiz_id).limit(1)
    )
    if has_assignments is not None:
        raise ConflictError(
            "Bu test guruhga tayinlangan — "
            "avval tayinlovlarni o'chirib, keyin tahrirlang"
        )

    quiz.subject = data.subject.strip()
    quiz.title = data.title.strip()
    quiz.description = data.description
    quiz.time_limit_minutes = data.time_limit_minutes

    # Eski bo'lim va savollarni o'chiramiz (cascade avtomatik tozalaydi)
    existing_sections = (
        await db.execute(
            select(QuizSection).where(QuizSection.quiz_id == quiz_id)
        )
    ).scalars().all()
    for old_section in existing_sections:
        await db.delete(old_section)
    await db.flush()

    for section in _build_sections(quiz.id, data.sections):
        section.quiz_id = quiz.id
        db.add(section)
    await db.flush()
    return quiz


async def delete_quiz(
    db: AsyncSession, *, owner_id: int, quiz_id: int
) -> None:
    """Testni o'chirish — faqat tayinlanmagan va obunalari bo'lmagan testlar."""
    quiz = await get_owned_quiz(db, owner_id=owner_id, quiz_id=quiz_id)

    has_assignments = await db.scalar(
        select(QuizAssignment.id).where(QuizAssignment.quiz_id == quiz_id).limit(1)
    )
    if has_assignments is not None:
        raise ConflictError(
            "Bu test guruhga tayinlangan — "
            "avval tayinlovlarni o'chirib, keyin testni o'chiring"
        )

    # Obunalarni o'chirish
    if quiz.is_catalog:
        subs = await db.execute(
            select(QuizSubscription).where(QuizSubscription.quiz_id == quiz_id)
        )
        for sub in subs.scalars().all():
            await db.delete(sub)
        await db.flush()

    await db.delete(quiz)
    await db.flush()


async def clone_quiz(
    db: AsyncSession, *, teacher_id: int, quiz_id: int
) -> Quiz:
    """Testning to'liq nusxasini yaratish — barcha bo'lim va savollar ko'chiriladi.

    Nusxa har doim o'qituvchining shaxsiy testi bo'ladi (`is_catalog=False`),
    katalog testi nusxalanganda ham. Faqat o'zi ishlata oladigan testlarni
    nusxalay oladi.
    """
    quiz = await get_usable_quiz(db, teacher_id=teacher_id, quiz_id=quiz_id)
    # Testni sections bilan yuklash
    quiz = await db.scalar(
        select(Quiz)
        .where(Quiz.id == quiz.id)
        .options(selectinload(Quiz.sections).selectinload(QuizSection.questions))
        .execution_options(populate_existing=True)
    )
    if quiz is None:
        raise NotFoundError("Test topilmadi")

    new_quiz = Quiz(
        owner_id=teacher_id,
        is_catalog=False,
        subject=quiz.subject,
        title=f"{quiz.title} (nusxa)",
        description=quiz.description,
        time_limit_minutes=quiz.time_limit_minutes,
    )
    db.add(new_quiz)
    await db.flush()

    for section in quiz.sections:
        new_section = QuizSection(
            quiz_id=new_quiz.id,
            order_index=section.order_index,
            title=section.title,
            instructions=section.instructions,
        )
        db.add(new_section)
        await db.flush()

        for question in section.questions:
            db.add(
                QuizQuestion(
                    section_id=new_section.id,
                    order_index=question.order_index,
                    type=question.type,
                    prompt=question.prompt,
                    media_url=question.media_url,
                    options=question.options,
                    correct_answer=question.correct_answer,
                    points=question.points,
                )
            )
    await db.flush()
    return new_quiz


async def get_usable_quiz(db: AsyncSession, *, teacher_id: int, quiz_id: int) -> Quiz:
    """O'qituvchi shu testni ko'rishi/ishlatishi mumkinmi.

    O'zining testi bo'lsa, yoki katalog testiga obuna bo'lgan bo'lsa — ha.
    Aks holda begona resurs sifatida 404 (talab: mavjudligi ham ko'rinmasin).
    """
    quiz = await db.scalar(
        select(Quiz)
        .where(Quiz.id == quiz_id)
        .options(selectinload(Quiz.sections).selectinload(QuizSection.questions))
        .execution_options(populate_existing=True)
    )
    if quiz is None:
        raise NotFoundError("Test topilmadi")
    if quiz.owner_id == teacher_id:
        return quiz
    if quiz.is_catalog:
        subscribed = await db.scalar(
            select(QuizSubscription).where(
                QuizSubscription.teacher_id == teacher_id,
                QuizSubscription.quiz_id == quiz_id,
            )
        )
        if subscribed is not None:
            return quiz
    raise NotFoundError("Test topilmadi")


async def get_owned_quiz(db: AsyncSession, *, owner_id: int, quiz_id: int) -> Quiz:
    """Faqat testni yaratgan shaxs (admin yoki o'qituvchi o'zi) tahrirlashi mumkin."""
    quiz = await db.scalar(
        select(Quiz).where(Quiz.id == quiz_id, Quiz.owner_id == owner_id)
    )
    if quiz is None:
        raise NotFoundError("Test topilmadi")
    return quiz


def _to_summary(
    quiz: Quiz, question_count: int, *, is_subscribed: bool = True
) -> schemas.QuizSummary:
    return schemas.QuizSummary(
        id=quiz.id,
        subject=quiz.subject,
        title=quiz.title,
        description=quiz.description,
        is_catalog=quiz.is_catalog,
        time_limit_minutes=quiz.time_limit_minutes,
        question_count=question_count,
        is_subscribed=is_subscribed,
    )


async def list_catalog_quizzes(
    db: AsyncSession, *, teacher_id: int, subject: str | None, params: PageParams
) -> tuple[list[schemas.QuizSummary], int]:
    conditions = [Quiz.is_catalog.is_(True)]
    if subject:
        conditions.append(Quiz.subject.ilike(f"%{subject.strip()}%"))

    total = await db.scalar(select(func.count(Quiz.id)).where(*conditions)) or 0
    rows = await db.execute(
        select(Quiz)
        .where(*conditions)
        .order_by(Quiz.subject, Quiz.title)
        .offset(params.offset)
        .limit(params.size)
    )
    quizzes = rows.scalars().all()

    subscribed_ids: set[int] = set()
    if quizzes:
        sub_rows = await db.execute(
            select(QuizSubscription.quiz_id).where(
                QuizSubscription.teacher_id == teacher_id,
                QuizSubscription.quiz_id.in_([q.id for q in quizzes]),
            )
        )
        subscribed_ids = {row[0] for row in sub_rows.all()}

    items = [
        _to_summary(
            quiz,
            await _question_count(quiz.id, db),
            is_subscribed=quiz.id in subscribed_ids,
        )
        for quiz in quizzes
    ]
    return items, total


async def list_usable_quizzes(
    db: AsyncSession, *, teacher_id: int, params: PageParams
) -> tuple[list[schemas.QuizSummary], int]:
    """O'qituvchi guruhga tayinlashi mumkin bo'lgan testlar: o'ziniki + obunalari."""
    condition = (Quiz.owner_id == teacher_id) | (
        Quiz.id.in_(
            select(QuizSubscription.quiz_id).where(
                QuizSubscription.teacher_id == teacher_id
            )
        )
    )
    total = await db.scalar(select(func.count(Quiz.id)).where(condition)) or 0
    rows = await db.execute(
        select(Quiz)
        .where(condition)
        .order_by(Quiz.subject, Quiz.title)
        .offset(params.offset)
        .limit(params.size)
    )
    quizzes = rows.scalars().all()
    items = [_to_summary(quiz, await _question_count(quiz.id, db)) for quiz in quizzes]
    return items, total


def _to_quiz_out(quiz: Quiz, question_count: int) -> schemas.QuizOut:
    return schemas.QuizOut(
        **_to_summary(quiz, question_count).model_dump(),
        sections=[
            schemas.SectionOut.model_validate(section) for section in quiz.sections
        ],
    )


async def get_quiz_detail(
    db: AsyncSession, *, teacher_id: int, quiz_id: int
) -> schemas.QuizOut:
    quiz = await get_usable_quiz(db, teacher_id=teacher_id, quiz_id=quiz_id)
    return _to_quiz_out(quiz, await _question_count(quiz.id, db))


async def subscribe(db: AsyncSession, *, teacher_id: int, quiz_id: int) -> None:
    quiz = await db.get(Quiz, quiz_id)
    if quiz is None or not quiz.is_catalog:
        raise NotFoundError("Test topilmadi")
    existing = await db.scalar(
        select(QuizSubscription).where(
            QuizSubscription.teacher_id == teacher_id,
            QuizSubscription.quiz_id == quiz_id,
        )
    )
    if existing is not None:
        return
    db.add(QuizSubscription(teacher_id=teacher_id, quiz_id=quiz_id))
    await db.flush()


async def unsubscribe(db: AsyncSession, *, teacher_id: int, quiz_id: int) -> None:
    existing = await db.scalar(
        select(QuizSubscription).where(
            QuizSubscription.teacher_id == teacher_id,
            QuizSubscription.quiz_id == quiz_id,
        )
    )
    if existing is None:
        return
    in_use = await db.scalar(
        select(QuizAssignment.id)
        .where(
            QuizAssignment.quiz_id == quiz_id, QuizAssignment.teacher_id == teacher_id
        )
        .limit(1)
    )
    if in_use is not None:
        raise ConflictError(
            "Bu test allaqachon guruhga tayinlangan — avval tayinlovni bekor qiling"
        )
    await db.delete(existing)


# ------------------------------------------------------------- tayinlash


async def _get_owned_group(
    db: AsyncSession, *, teacher_id: int, group_id: int
) -> Group:
    group = await db.scalar(
        select(Group).where(Group.id == group_id, Group.teacher_id == teacher_id)
    )
    if group is None:
        raise NotFoundError("Guruh topilmadi")
    return group


async def create_assignment(
    db: AsyncSession, *, teacher_id: int, data: schemas.AssignmentCreate
) -> QuizAssignment:
    await get_usable_quiz(db, teacher_id=teacher_id, quiz_id=data.quiz_id)
    await _get_owned_group(db, teacher_id=teacher_id, group_id=data.group_id)

    assignment = QuizAssignment(
        quiz_id=data.quiz_id,
        teacher_id=teacher_id,
        group_id=data.group_id,
        mode=data.mode,
        max_attempts=data.max_attempts,
        score_rule=data.score_rule,
        deadline=data.deadline,
    )
    db.add(assignment)
    await db.flush()
    return assignment


async def get_owned_assignment(
    db: AsyncSession, *, teacher_id: int, assignment_id: int
) -> QuizAssignment:
    assignment = await db.scalar(
        select(QuizAssignment).where(
            QuizAssignment.id == assignment_id, QuizAssignment.teacher_id == teacher_id
        )
    )
    if assignment is None:
        raise NotFoundError("Tayinlov topilmadi")
    return assignment


async def _to_assignment_out(
    db: AsyncSession, assignment: QuizAssignment
) -> schemas.AssignmentOut:
    quiz = await db.get(Quiz, assignment.quiz_id)
    group = await db.get(Group, assignment.group_id)
    return schemas.AssignmentOut(
        id=assignment.id,
        quiz_id=assignment.quiz_id,
        quiz_title=quiz.title if quiz else "",
        group_id=assignment.group_id,
        group_name=group.name if group else "",
        mode=assignment.mode,
        max_attempts=assignment.max_attempts,
        score_rule=assignment.score_rule,
        deadline=assignment.deadline,
        notified_at=assignment.notified_at,
        created_at=assignment.created_at,
    )


async def get_assignment_out(
    db: AsyncSession, *, teacher_id: int, assignment_id: int
) -> schemas.AssignmentOut:
    assignment = await get_owned_assignment(
        db, teacher_id=teacher_id, assignment_id=assignment_id
    )
    return await _to_assignment_out(db, assignment)


async def list_assignments(
    db: AsyncSession, *, teacher_id: int, group_id: int | None
) -> list[schemas.AssignmentOut]:
    conditions = [QuizAssignment.teacher_id == teacher_id]
    if group_id is not None:
        conditions.append(QuizAssignment.group_id == group_id)
    rows = await db.execute(
        select(QuizAssignment)
        .where(*conditions)
        .order_by(QuizAssignment.created_at.desc())
    )
    return [await _to_assignment_out(db, a) for a in rows.scalars().all()]


async def delete_assignment(
    db: AsyncSession, *, teacher_id: int, assignment_id: int
) -> None:
    assignment = await get_owned_assignment(
        db, teacher_id=teacher_id, assignment_id=assignment_id
    )
    has_attempts = await db.scalar(
        select(QuizAttempt.id)
        .where(QuizAttempt.assignment_id == assignment.id)
        .limit(1)
    )
    if has_attempts is not None:
        raise ConflictError("Bu tayinlovda urinishlar bor — o'chirib bo'lmaydi")
    await db.delete(assignment)


async def list_student_assignments(
    db: AsyncSession, *, student: User
) -> list[schemas.StudentAssignmentOut]:
    """O'quvchining a'zo bo'lgan guruhlariga tayinlangan barcha testlar."""
    group_ids_rows = await db.execute(
        select(Enrollment.group_id).where(
            Enrollment.student_id == student.id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
    )
    group_ids = [row[0] for row in group_ids_rows.all()]
    if not group_ids:
        return []

    rows = await db.execute(
        select(QuizAssignment)
        .where(QuizAssignment.group_id.in_(group_ids))
        .order_by(QuizAssignment.created_at.desc())
    )
    assignments = rows.scalars().all()

    used_rows = await db.execute(
        select(QuizAttempt.assignment_id, func.count(QuizAttempt.id))
        .where(
            QuizAttempt.student_id == student.id,
            QuizAttempt.assignment_id.in_([a.id for a in assignments]),
        )
        .group_by(QuizAttempt.assignment_id)
    )
    used_by_assignment = dict(used_rows.all())

    items = []
    for assignment in assignments:
        out = await _to_assignment_out(db, assignment)
        items.append(
            schemas.StudentAssignmentOut(
                **out.model_dump(),
                attempts_used=used_by_assignment.get(assignment.id, 0),
            )
        )
    return items


# --------------------------------------------------------------- urinish


async def _get_group_assignment_for_student(
    db: AsyncSession, *, student: User, assignment_id: int
) -> QuizAssignment:
    assignment = await db.get(QuizAssignment, assignment_id)
    if assignment is None:
        raise NotFoundError("Tayinlov topilmadi")
    enrolled = await db.scalar(
        select(Enrollment.id).where(
            Enrollment.group_id == assignment.group_id,
            Enrollment.student_id == student.id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
    )
    if enrolled is None:
        raise NotFoundError("Tayinlov topilmadi")
    return assignment


async def start_attempt(
    db: AsyncSession, *, student: User, assignment_id: int
) -> schemas.AttemptStartOut:
    assignment = await _get_group_assignment_for_student(
        db, student=student, assignment_id=assignment_id
    )
    if (
        assignment.mode == QuizMode.EXAM
        and assignment.deadline is not None
        and utc_now() > as_utc(assignment.deadline)
    ):
        raise ConflictError("Bu imtihonning muddati tugagan")

    existing_count = (
        await db.scalar(
            select(func.count(QuizAttempt.id)).where(
                QuizAttempt.assignment_id == assignment.id,
                QuizAttempt.student_id == student.id,
            )
        )
        or 0
    )
    if (
        assignment.max_attempts is not None
        and existing_count >= assignment.max_attempts
    ):
        raise ConflictError("Urinishlar soni tugadi")

    quiz = await db.scalar(
        select(Quiz)
        .where(Quiz.id == assignment.quiz_id)
        .options(selectinload(Quiz.sections).selectinload(QuizSection.questions))
        .execution_options(populate_existing=True)
    )
    if quiz is None:
        raise NotFoundError("Test topilmadi")

    attempt = QuizAttempt(
        assignment_id=assignment.id,
        student_id=student.id,
        attempt_no=existing_count + 1,
        started_at=utc_now(),
        answers={},
    )
    db.add(attempt)
    await db.flush()

    return schemas.AttemptStartOut(
        attempt_id=attempt.id,
        attempt_no=attempt.attempt_no,
        max_attempts=assignment.max_attempts,
        started_at=attempt.started_at,
        quiz=schemas.QuizPlayOut(
            id=quiz.id,
            title=quiz.title,
            time_limit_minutes=quiz.time_limit_minutes,
            sections=[schemas.SectionPlayOut.model_validate(s) for s in quiz.sections],
        ),
    )


def _grade_answer(question: QuizQuestion, answer: object) -> float | None:
    """Avtomatik baholanadigan turlar uchun ball, essay uchun `None`."""
    if question.type == QuestionType.ESSAY:
        return None
    if question.type == QuestionType.SINGLE_CHOICE:
        return question.points if answer == question.correct_answer else 0.0
    if question.type == QuestionType.MULTI_CHOICE:
        correct = set(question.correct_answer or [])
        given = set(answer or []) if isinstance(answer, list) else set()
        return question.points if correct == given else 0.0
    if question.type == QuestionType.TEXT:
        expected = str(question.correct_answer or "").strip().casefold()
        given_text = str(answer or "").strip().casefold()
        return question.points if expected and given_text == expected else 0.0
    return 0.0


async def get_owned_attempt(
    db: AsyncSession, *, student: User, attempt_id: int
) -> QuizAttempt:
    attempt = await db.scalar(
        select(QuizAttempt).where(
            QuizAttempt.id == attempt_id, QuizAttempt.student_id == student.id
        )
    )
    if attempt is None:
        raise NotFoundError("Urinish topilmadi")
    return attempt


async def submit_attempt(
    db: AsyncSession, *, student: User, attempt_id: int, data: schemas.AttemptSubmit
) -> schemas.AttemptResultOut:
    attempt = await get_owned_attempt(db, student=student, attempt_id=attempt_id)
    if attempt.status != AttemptStatus.IN_PROGRESS:
        raise ConflictError("Bu urinish allaqachon topshirilgan")

    questions_rows = await db.execute(
        select(QuizQuestion)
        .join(QuizSection, QuizSection.id == QuizQuestion.section_id)
        .join(QuizAssignment, QuizAssignment.quiz_id == QuizSection.quiz_id)
        .where(QuizAssignment.id == attempt.assignment_id)
    )
    questions = questions_rows.scalars().all()

    answers: dict = {}
    auto_score = 0.0
    max_score = 0.0
    has_pending_essay = False

    for question in questions:
        max_score += question.points
        given = data.answers.get(question.id)
        score = _grade_answer(question, given)
        if score is None:
            has_pending_essay = True
            answers[str(question.id)] = {
                "answer": given,
                "manual_score": None,
                "feedback": None,
            }
        else:
            auto_score += score
            answers[str(question.id)] = {"answer": given, "auto_score": score}

    attempt.answers = answers
    attempt.auto_score = auto_score
    attempt.max_score = max_score
    attempt.submitted_at = utc_now()

    if has_pending_essay:
        attempt.status = AttemptStatus.SUBMITTED
    else:
        attempt.status = AttemptStatus.GRADED
        attempt.manual_score = 0.0
        attempt.graded_at = utc_now()

    await db.flush()

    assignment = await db.get(QuizAssignment, attempt.assignment_id)
    if assignment is not None and assignment.mode == QuizMode.EXAM:
        await maybe_finalize_assignment(db, assignment=assignment)

    return schemas.AttemptResultOut(
        attempt_id=attempt.id,
        status=attempt.status,
        auto_score=attempt.auto_score,
        manual_score=attempt.manual_score,
        total_score=attempt.total_score,
        max_score=attempt.max_score,
        pending_manual_grading=has_pending_essay,
    )


async def get_history(
    db: AsyncSession, *, student_id: int, assignment_id: int | None
) -> list[schemas.AttemptHistoryItem]:
    conditions = [QuizAttempt.student_id == student_id]
    if assignment_id is not None:
        conditions.append(QuizAttempt.assignment_id == assignment_id)

    rows = await db.execute(
        select(QuizAttempt, QuizAssignment, Quiz)
        .join(QuizAssignment, QuizAssignment.id == QuizAttempt.assignment_id)
        .join(Quiz, Quiz.id == QuizAssignment.quiz_id)
        .where(*conditions)
        .order_by(QuizAttempt.created_at.desc())
    )
    return [
        schemas.AttemptHistoryItem(
            attempt_id=attempt.id,
            assignment_id=assignment.id,
            quiz_title=quiz.title,
            mode=assignment.mode,
            attempt_no=attempt.attempt_no,
            status=attempt.status,
            total_score=attempt.total_score,
            max_score=attempt.max_score,
            submitted_at=attempt.submitted_at,
        )
        for attempt, assignment, quiz in rows.all()
    ]


# ------------------------------------------------------- qo'lda baholash


async def list_pending_grading(
    db: AsyncSession, *, teacher_id: int, assignment_id: int
) -> list[schemas.PendingGradingItem]:
    assignment = await get_owned_assignment(
        db, teacher_id=teacher_id, assignment_id=assignment_id
    )

    questions_rows = await db.execute(
        select(QuizQuestion)
        .join(QuizSection, QuizSection.id == QuizQuestion.section_id)
        .where(
            QuizSection.quiz_id == assignment.quiz_id,
            QuizQuestion.type == QuestionType.ESSAY,
        )
    )
    essay_questions = {q.id: q for q in questions_rows.scalars().all()}
    if not essay_questions:
        return []

    rows = await db.execute(
        select(QuizAttempt, User)
        .join(User, User.id == QuizAttempt.student_id)
        .where(
            QuizAttempt.assignment_id == assignment.id,
            QuizAttempt.status == AttemptStatus.SUBMITTED,
        )
    )
    items = []
    for attempt, student in rows.all():
        pending_questions = [
            schemas.PendingQuestion(
                question_id=question.id,
                prompt=question.prompt,
                student_answer=(attempt.answers.get(str(question.id)) or {}).get(
                    "answer"
                ),
                max_points=question.points,
            )
            for question in essay_questions.values()
            if (attempt.answers.get(str(question.id)) or {}).get("manual_score") is None
        ]
        if pending_questions:
            items.append(
                schemas.PendingGradingItem(
                    attempt_id=attempt.id,
                    student_id=student.id,
                    student_name=student.full_name,
                    submitted_at=attempt.submitted_at,
                    questions=pending_questions,
                )
            )
    return items


async def grade_attempt(
    db: AsyncSession,
    *,
    teacher_id: int,
    attempt_id: int,
    data: schemas.ManualGradeRequest,
) -> schemas.AttemptResultOut:
    attempt = await db.get(QuizAttempt, attempt_id)
    if attempt is None:
        raise NotFoundError("Urinish topilmadi")
    assignment = await get_owned_assignment(
        db, teacher_id=teacher_id, assignment_id=attempt.assignment_id
    )
    if attempt.status not in (AttemptStatus.SUBMITTED, AttemptStatus.GRADED):
        raise ConflictError("Bu urinish hali topshirilmagan")

    question_ids = [grade.question_id for grade in data.grades]
    points_rows = await db.execute(
        select(QuizQuestion.id, QuizQuestion.points).where(
            QuizQuestion.id.in_(question_ids), QuizQuestion.type == QuestionType.ESSAY
        )
    )
    max_points_by_question = dict(points_rows.all())

    for grade in data.grades:
        max_points = max_points_by_question.get(grade.question_id)
        if max_points is None:
            raise ConflictError("Bu savol shu urinishga tegishli emas")
        if grade.score > max_points:
            raise ConflictError(
                f"Ball savolning maksimal balli ({max_points}) dan oshmasligi kerak"
            )
        entry = attempt.answers.get(str(grade.question_id))
        if entry is None:
            raise ConflictError("Bu savol shu urinishga tegishli emas")
        entry["manual_score"] = grade.score
        entry["feedback"] = grade.feedback
    attempt.answers = dict(attempt.answers)

    still_pending = any(
        value.get("manual_score") is None
        for key, value in attempt.answers.items()
        if "manual_score" in value
    )
    attempt.manual_score = sum(
        value.get("manual_score") or 0
        for value in attempt.answers.values()
        if "manual_score" in value
    )
    if not still_pending:
        attempt.status = AttemptStatus.GRADED
        attempt.graded_at = utc_now()

    await db.flush()

    if assignment.mode == QuizMode.EXAM:
        await maybe_finalize_assignment(db, assignment=assignment)

    return schemas.AttemptResultOut(
        attempt_id=attempt.id,
        status=attempt.status,
        auto_score=attempt.auto_score,
        manual_score=attempt.manual_score,
        total_score=attempt.total_score,
        max_score=attempt.max_score,
        pending_manual_grading=still_pending,
    )


# ------------------------------------------------------------------ reyting


def _representative_score(attempts: list[QuizAttempt], rule: ScoreRule) -> float | None:
    graded = [
        a
        for a in attempts
        if a.status == AttemptStatus.GRADED and a.total_score is not None
    ]
    if not graded:
        return None
    if rule == ScoreRule.BEST:
        return max(a.total_score for a in graded)
    if rule == ScoreRule.LATEST:
        return max(graded, key=lambda a: a.attempt_no).total_score
    # AVERAGE
    return sum(a.total_score for a in graded) / len(graded)


async def compute_results(
    db: AsyncSession, *, assignment: QuizAssignment
) -> schemas.AssignmentResultsOut:
    rows = await db.execute(
        select(QuizAttempt, User)
        .join(User, User.id == QuizAttempt.student_id)
        .where(QuizAttempt.assignment_id == assignment.id)
    )
    by_student: dict[int, tuple[User, list[QuizAttempt]]] = {}
    for attempt, student in rows.all():
        by_student.setdefault(student.id, (student, []))[1].append(attempt)

    fully_graded = not any(
        attempt.status == AttemptStatus.SUBMITTED
        for _, attempts in by_student.values()
        for attempt in attempts
    )

    scored = [
        (student, _representative_score(attempts, assignment.score_rule))
        for student, attempts in by_student.values()
    ]
    scored = [(student, score) for student, score in scored if score is not None]
    scored.sort(key=lambda pair: pair[1], reverse=True)

    entries = [
        schemas.RankingEntry(
            student_id=student.id,
            student_name=student.full_name,
            score=score,
            rank=index + 1,
            out_of=len(scored),
        )
        for index, (student, score) in enumerate(scored)
    ]
    return schemas.AssignmentResultsOut(
        assignment_id=assignment.id, fully_graded=fully_graded, entries=entries
    )


async def maybe_finalize_assignment(
    db: AsyncSession, *, assignment: QuizAssignment
) -> None:
    """Muddat o'tgan va hamma urinish baholangan bo'lsa — reyting + xabar.

    Idempotent: `notified_at` bilan bir marta ishlaydi. Grading tugagach
    (`grade_attempt`) yoki har bir topshirishdan keyin, shuningdek fon
    rejimidagi vaqt tekshiruvchisi (`quizzes.scheduler`) tomonidan chaqiriladi.
    """
    if assignment.notified_at is not None:
        return
    if assignment.mode != QuizMode.EXAM or assignment.deadline is None:
        return
    if utc_now() < as_utc(assignment.deadline):
        return

    results = await compute_results(db, assignment=assignment)
    if not results.fully_graded:
        return

    quiz = await db.get(Quiz, assignment.quiz_id)
    teacher = await db.get(User, assignment.teacher_id)

    for entry in results.entries:
        link = await db.scalar(
            select(ParentTelegramLink).where(
                ParentTelegramLink.student_id == entry.student_id,
                ParentTelegramLink.chat_id.is_not(None),
            )
        )
        if link is not None:
            await notify_exam_result_to_parent(
                chat_id=link.chat_id,
                student_name=entry.student_name,
                quiz_title=quiz.title if quiz else "",
                score=entry.score,
                rank=entry.rank,
                out_of=entry.out_of,
            )

    if teacher is not None:
        await notify_teacher_exam_ready(
            teacher_email=teacher.email,
            teacher_phone=teacher.phone,
            quiz_title=quiz.title if quiz else "",
            participant_count=len(results.entries),
        )

    assignment.notified_at = utc_now()
    await db.flush()


async def check_due_exam_assignments(db: AsyncSession) -> None:
    """Fon vazifasi uchun: muddati o'tgan, hali xabar yuborilmagan imtihonlar."""
    rows = await db.execute(
        select(QuizAssignment).where(
            QuizAssignment.mode == QuizMode.EXAM,
            QuizAssignment.notified_at.is_(None),
            QuizAssignment.deadline.is_not(None),
            QuizAssignment.deadline <= utc_now(),
        )
    )
    for assignment in rows.scalars().all():
        try:
            await maybe_finalize_assignment(db, assignment=assignment)
        except Exception:
            logger.exception(
                "Imtihon natijasini yakunlashda xato (assignment_id=%s)", assignment.id
            )
    await db.commit()


# ------------------------------------------------------- telegram bog'lash


async def get_or_create_link_code(db: AsyncSession, *, student_id: int) -> str:
    """Bir xil kod har doim qaytadi — bir nechta chaqiruv baravar kelsa ham
    (masalan, React ikki marta so'rov yuborsa) 409 emas, xuddi shu kod
    qaytishi kerak, chunki bu shunchaki o'qish (GET) amali."""
    link = await db.scalar(
        select(ParentTelegramLink).where(ParentTelegramLink.student_id == student_id)
    )
    if link is not None:
        return link.link_code

    code = secrets.token_hex(4)
    try:
        async with db.begin_nested():
            db.add(ParentTelegramLink(student_id=student_id, link_code=code))
            await db.flush()
    except IntegrityError:
        link = await db.scalar(
            select(ParentTelegramLink).where(
                ParentTelegramLink.student_id == student_id
            )
        )
        if link is None:
            raise
        return link.link_code
    return code


async def link_parent_chat(db: AsyncSession, *, link_code: str, chat_id: str) -> bool:
    link = await db.scalar(
        select(ParentTelegramLink).where(ParentTelegramLink.link_code == link_code)
    )
    if link is None:
        return False
    link.chat_id = chat_id
    link.linked_at = utc_now()
    await db.flush()
    return True
