"""Barcha modellarni bitta joyda import qiladi.

Alembic autogenerate va `Base.metadata` to'liq bo'lishi uchun kerak —
modullar bir-birini import qilmagani uchun (modulli monolith) modellar
aks holda metadata'ga tushmay qoladi.
"""

from app.db.base import Base  # noqa: F401
from app.modules.attendance.models import (  # noqa: F401
    AttendanceRecord,
    AttendanceSession,
)
from app.modules.expenses.models import Expense  # noqa: F401
from app.modules.groups.models import Enrollment, Group  # noqa: F401
from app.modules.groups.schedule_models import (  # noqa: F401
    ScheduleSlot,
    ScheduleVersion,
)
from app.modules.payments.models import MonthlyCharge, Payment  # noqa: F401
from app.modules.quizzes.models import (  # noqa: F401
    ParentTelegramLink,
    Quiz,
    QuizAssignment,
    QuizAttempt,
    QuizQuestion,
    QuizSection,
    QuizSubscription,
)
from app.modules.users.models import (  # noqa: F401
    PasswordResetToken,
    RefreshToken,
    User,
)

__all__ = [
    "Base",
    "User",
    "RefreshToken",
    "PasswordResetToken",
    "Group",
    "Enrollment",
    "ScheduleVersion",
    "ScheduleSlot",
    "AttendanceSession",
    "AttendanceRecord",
    "MonthlyCharge",
    "Expense",
    "Payment",
    "Quiz",
    "QuizSection",
    "QuizQuestion",
    "QuizSubscription",
    "QuizAssignment",
    "QuizAttempt",
    "ParentTelegramLink",
]
