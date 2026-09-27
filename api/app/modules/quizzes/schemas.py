from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.core.schemas import ORMModel
from app.modules.quizzes.models import AttemptStatus, QuestionType, QuizMode, ScoreRule

# --------------------------------------------------------------- savollar


class QuestionIn(BaseModel):
    type: QuestionType
    prompt: str = Field(min_length=1)
    media_url: str | None = Field(default=None, max_length=500)
    options: list[dict] | None = Field(
        default=None, description="single_choice/multi_choice uchun variantlar"
    )
    correct_answer: Any = Field(
        default=None,
        description=(
            "single_choice/multi_choice/text uchun to'g'ri javob. essay'da bo'sh"
        ),
    )
    points: float = Field(default=1, gt=0)

    @model_validator(mode="after")
    def check_gradability(self) -> "QuestionIn":
        if self.type in (QuestionType.SINGLE_CHOICE, QuestionType.MULTI_CHOICE):
            if not self.options:
                raise ValueError(
                    "Variantli savolda kamida bitta variant bo'lishi shart"
                )
            if self.correct_answer is None:
                raise ValueError("Variantli savolda to'g'ri javob ko'rsatilishi shart")
        if self.type == QuestionType.ESSAY and self.correct_answer is not None:
            raise ValueError(
                "Essay turidagi savolda to'g'ri javob bo'lmaydi (qo'lda baholanadi)"
            )
        return self


class QuestionOut(ORMModel):
    """O'qituvchi ko'rinishi — to'g'ri javob bilan."""

    id: int
    order_index: int
    type: QuestionType
    prompt: str
    media_url: str | None
    options: list[dict] | None
    correct_answer: Any
    points: float


class QuestionPlayOut(ORMModel):
    """O'quvchi test yechayotganda ko'radigan ko'rinish — to'g'ri javobsiz."""

    id: int
    order_index: int
    type: QuestionType
    prompt: str
    media_url: str | None
    options: list[dict] | None
    points: float


# --------------------------------------------------------------- bo'limlar


class SectionIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    instructions: str | None = None
    questions: list[QuestionIn] = Field(min_length=1)


class SectionOut(ORMModel):
    id: int
    order_index: int
    title: str
    instructions: str | None
    questions: list[QuestionOut]


class SectionPlayOut(ORMModel):
    id: int
    order_index: int
    title: str
    instructions: str | None
    questions: list[QuestionPlayOut]


# ------------------------------------------------------------------ test


class QuizCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    time_limit_minutes: int | None = Field(default=None, gt=0)
    sections: list[SectionIn] = Field(min_length=1)


class QuizUpdate(BaseModel):
    subject: str | None = Field(default=None, min_length=1, max_length=80)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    time_limit_minutes: int | None = Field(default=None, gt=0)


class QuizUpdateFull(BaseModel):
    """Testni to'liq tahrirlash — bo'limlar va savollar qayta yoziladi."""
    subject: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    time_limit_minutes: int | None = Field(default=None, gt=0)
    sections: list[SectionIn] = Field(min_length=1)


class QuizSummary(ORMModel):
    id: int
    subject: str
    title: str
    description: str | None
    is_catalog: bool
    time_limit_minutes: int | None
    question_count: int = 0
    is_subscribed: bool = Field(
        default=True, description="Katalog testlari uchun — o'qituvchi obuna bo'lganmi"
    )


class QuizOut(QuizSummary):
    sections: list[SectionOut]


class QuizPlayOut(ORMModel):
    id: int
    title: str
    time_limit_minutes: int | None
    sections: list[SectionPlayOut]


# --------------------------------------------------------------- obuna


class SubscriptionOut(BaseModel):
    quiz_id: int
    subscribed: bool


# --------------------------------------------------------------- tayinlash


class AssignmentCreate(BaseModel):
    quiz_id: int
    group_id: int
    mode: QuizMode
    max_attempts: int | None = Field(default=None, gt=0)
    score_rule: ScoreRule = ScoreRule.BEST
    deadline: datetime | None = None

    @model_validator(mode="after")
    def check_exam_requirements(self) -> "AssignmentCreate":
        if self.mode == QuizMode.EXAM:
            if self.deadline is None:
                raise ValueError("Imtihon uchun muddat (deadline) ko'rsatilishi shart")
            if self.max_attempts is None:
                raise ValueError("Imtihon uchun urinishlar soni ko'rsatilishi shart")
        return self


class AssignmentOut(BaseModel):
    id: int
    quiz_id: int
    quiz_title: str
    group_id: int
    group_name: str
    mode: QuizMode
    max_attempts: int | None
    score_rule: ScoreRule
    deadline: datetime | None
    notified_at: datetime | None
    created_at: datetime


class StudentAssignmentOut(AssignmentOut):
    attempts_used: int


# --------------------------------------------------------------- urinish


class AttemptStartOut(BaseModel):
    attempt_id: int
    attempt_no: int
    max_attempts: int | None
    started_at: datetime
    quiz: QuizPlayOut


class AttemptSubmit(BaseModel):
    answers: dict[int, Any] = Field(description="question_id -> o'quvchining javobi")


class AttemptResultOut(BaseModel):
    attempt_id: int
    status: AttemptStatus
    auto_score: float | None
    manual_score: float | None
    total_score: float | None
    max_score: float | None
    pending_manual_grading: bool


class AttemptHistoryItem(BaseModel):
    attempt_id: int
    assignment_id: int
    quiz_title: str
    mode: QuizMode
    attempt_no: int
    status: AttemptStatus
    total_score: float | None
    max_score: float | None
    submitted_at: datetime | None


class ManualGrade(BaseModel):
    question_id: int
    score: float = Field(ge=0)
    feedback: str | None = None


class ManualGradeRequest(BaseModel):
    grades: list[ManualGrade] = Field(min_length=1)


class PendingGradingItem(BaseModel):
    attempt_id: int
    student_id: int
    student_name: str
    submitted_at: datetime | None
    questions: list["PendingQuestion"]


class PendingQuestion(BaseModel):
    question_id: int
    prompt: str
    student_answer: Any
    max_points: float


PendingGradingItem.model_rebuild()


# --------------------------------------------------------------- reyting


class RankingEntry(BaseModel):
    student_id: int
    student_name: str
    score: float
    rank: int
    out_of: int


class AssignmentResultsOut(BaseModel):
    assignment_id: int
    fully_graded: bool
    entries: list[RankingEntry]
