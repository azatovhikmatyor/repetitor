import enum
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.types import enum_column


class QuestionType(str, enum.Enum):
    SINGLE_CHOICE = "single_choice"
    MULTI_CHOICE = "multi_choice"
    TEXT = "text"
    ESSAY = "essay"


#: Bu turlar javob yuborilgan zahoti avtomatik baholanadi.
AUTO_GRADABLE_TYPES = (
    QuestionType.SINGLE_CHOICE,
    QuestionType.MULTI_CHOICE,
    QuestionType.TEXT,
)


class QuizMode(str, enum.Enum):
    PRACTICE = "practice"
    EXAM = "exam"


class ScoreRule(str, enum.Enum):
    BEST = "best"
    AVERAGE = "average"
    LATEST = "latest"


class AttemptStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"


class Quiz(Base, TimestampMixin):
    """Test shabloni — savollar shu testga, savol to'plami esa bo'limlarga bog'langan.

    `is_catalog=True` bo'lsa — owner (super_admin) tomonidan tayyorlangan,
    "Steam ish stoli" uslubida obuna orqali ishlatiladigan test (talab: fan
    bo'yicha tayyor to'plamlar). `is_catalog=False` — o'qituvchining o'z
    testi, faqat o'zi ishlatadi, subscribe shart emas.
    """

    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    is_catalog: Mapped[bool] = mapped_column(default=False, nullable=False)
    subject: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer)

    sections: Mapped[list["QuizSection"]] = relationship(
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="QuizSection.order_index",
    )

    __table_args__ = (
        CheckConstraint(
            "time_limit_minutes IS NULL OR time_limit_minutes > 0",
            name="time_limit_positive",
        ),
        Index("ix_quizzes_catalog_subject", "is_catalog", "subject"),
    )


class QuizSection(Base, TimestampMixin):
    """IELTS kabi ko'p bo'limli testlar uchun (Reading/Listening/Writing).

    Oddiy testlarda ham bitta bo'lim yaratiladi — savollar hamisha
    bo'lim orqali testga bog'lanadi, alohida yo'l yo'q.
    """

    __tablename__ = "quiz_sections"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text)

    quiz: Mapped["Quiz"] = relationship(back_populates="sections")
    questions: Mapped[list["QuizQuestion"]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.order_index",
    )

    __table_args__ = (
        UniqueConstraint("quiz_id", "order_index", name="uq_section_order"),
    )


class QuizQuestion(Base, TimestampMixin):
    """Bitta savol.

    `options`/`correct_answer` JSON: savol turi ochiq bo'lgani uchun
    (IELTS'gacha) qat'iy ustunlar o'rniga moslashuvchan struktura tanlandi.
    `correct_answer` faqat avtomatik baholanadigan turlarda (`single_choice`,
    `multi_choice`, `text`) ishlatiladi; `essay` uchun bo'sh qoladi — o'qituvchi
    qo'lda baholaydi.
    """

    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("quiz_sections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[QuestionType] = mapped_column(
        enum_column(QuestionType, name="question_type"), nullable=False
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    media_url: Mapped[str | None] = mapped_column(
        String(500), doc="Audio/rasm (masalan IELTS Listening) — ixtiyoriy"
    )
    options: Mapped[list | None] = mapped_column(JSON)
    correct_answer: Mapped[object | None] = mapped_column(JSON)
    points: Mapped[float] = mapped_column(Float, default=1, nullable=False)

    section: Mapped["QuizSection"] = relationship(back_populates="questions")

    __table_args__ = (
        UniqueConstraint("section_id", "order_index", name="uq_question_order"),
        CheckConstraint("points > 0", name="points_positive"),
    )


class QuizSubscription(Base, TimestampMixin):
    """O'qituvchining katalog testiga obunasi — Steam ishchi stoli uslubi.

    Faqat shu yozuv bo'lsa o'qituvchi shu testni guruhga tayinlay oladi.
    O'z testlari (`is_catalog=False`) uchun obuna kerak emas.
    """

    __tablename__ = "quiz_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quiz_id: Mapped[int] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False, index=True
    )

    __table_args__ = (
        UniqueConstraint("teacher_id", "quiz_id", name="uq_subscription_teacher_quiz"),
    )


class QuizAssignment(Base, TimestampMixin):
    """Testning bir guruhga tayinlanishi.

    `mode=practice` — cheklovsiz mashq, deadline yo'q, natija hech kimga
    xabar qilinmaydi. `mode=exam` — guruhning barcha o'quvchilari uchun
    majburiy, `deadline` shart, muddat o'tgach reyting hisoblanib
    o'qituvchi va ota-onalarga xabar boradi (`notified_at` shu jarayonning
    bajarilganini belgilaydi — bir marta yuboriladi).
    """

    __tablename__ = "quiz_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(
        ForeignKey("quizzes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mode: Mapped[QuizMode] = mapped_column(
        enum_column(QuizMode, name="quiz_mode"), nullable=False
    )
    max_attempts: Mapped[int | None] = mapped_column(
        Integer, doc="null — cheksiz (faqat practice uchun mumkin)"
    )
    score_rule: Mapped[ScoreRule] = mapped_column(
        enum_column(ScoreRule, name="quiz_score_rule"),
        default=ScoreRule.BEST,
        nullable=False,
    )
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), doc="Reyting/xabar yuborilgan payt — faqat bir marta"
    )

    attempts: Mapped[list["QuizAttempt"]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "(mode = 'practice') OR "
            "(deadline IS NOT NULL AND max_attempts IS NOT NULL)",
            name="exam_requires_deadline_and_limit",
        ),
        CheckConstraint(
            "max_attempts IS NULL OR max_attempts > 0", name="max_attempts_positive"
        ),
        Index("ix_assignments_group_mode", "group_id", "mode"),
    )


class QuizAttempt(Base, TimestampMixin):
    """O'quvchining bitta urinishi.

    `max_score` topshirilgan paytda muzlatiladi (savollar keyin o'zgarsa
    ham eski urinish natijasi buzilmasin — `MonthlyCharge.amount_due` bilan
    bir xil mantiq). `answers` — {question_id: {answer, auto_score,
    manual_score, feedback}}. `essay` savol bo'lsa `manual_score` o'qituvchi
    tekshirmaguncha `null` qoladi, shuning uchun `status` alohida saqlanadi
    (`GRADED` faqat hamma savol baholangach).
    """

    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("quiz_assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[AttemptStatus] = mapped_column(
        enum_column(AttemptStatus, name="quiz_attempt_status"),
        default=AttemptStatus.IN_PROGRESS,
        nullable=False,
    )
    answers: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    auto_score: Mapped[float | None] = mapped_column(Float)
    manual_score: Mapped[float | None] = mapped_column(Float)
    max_score: Mapped[float | None] = mapped_column(Float)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    graded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    assignment: Mapped["QuizAssignment"] = relationship(back_populates="attempts")

    __table_args__ = (
        UniqueConstraint(
            "assignment_id", "student_id", "attempt_no", name="uq_attempt_number"
        ),
    )

    @property
    def total_score(self) -> float | None:
        if self.auto_score is None:
            return None
        return self.auto_score + (self.manual_score or 0)

    @property
    def needs_manual_grading(self) -> bool:
        return self.status == AttemptStatus.SUBMITTED


class ParentTelegramLink(Base, TimestampMixin):
    """O'quvchi ota-onasining Telegram bog'lanishi.

    `link_code` o'qituvchi tomonidan generatsiya qilinadi, ota-ona botga
    `/start <link_code>` yuboradi — shundan keyin `chat_id` to'ldiriladi.
    """

    __tablename__ = "parent_telegram_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    link_code: Mapped[str] = mapped_column(String(16), nullable=False, unique=True)
    chat_id: Mapped[str | None] = mapped_column(String(64))
    linked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def is_linked(self) -> bool:
        return self.chat_id is not None
