"""Vaqt bilan ishlash — barcha sanaga bog'liq mantiq Asia/Tashkent bo'yicha.

Baza UTC saqlaydi; "bugun", "joriy oy" kabi tushunchalar esa o'qituvchining
mahalliy zonasida hisoblanadi (talab 12: Vaqt va valyuta).
"""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings

LOCAL_TZ = ZoneInfo(settings.timezone)


def utc_now() -> datetime:
    return datetime.now(tz=UTC)


def local_now() -> datetime:
    return datetime.now(tz=LOCAL_TZ)


def local_today() -> date:
    return local_now().date()


def current_period() -> tuple[int, int]:
    """Joriy (yil, oy) — mahalliy zona bo'yicha."""
    today = local_today()
    return today.year, today.month


def shift_period(year: int, month: int, delta: int) -> tuple[int, int]:
    """(yil, oy) ni delta oyga suradi. delta manfiy bo'lishi mumkin."""
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def as_utc(value: datetime) -> datetime:
    """Zonasiz datetime'ni UTC deb qabul qiladi.

    PostgreSQL `timestamptz` ni zonasi bilan qaytaradi, SQLite esa (testlarda)
    zonasiz. Taqqoslash ikkala muhitda ham to'g'ri ishlashi uchun kerak.
    """
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
