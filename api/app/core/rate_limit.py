"""Oddiy rate limiter (login va parol tiklash uchun).

MVP'da jarayon ichidagi xotirada ishlaydi. Talabda Redis "keyinroq"
deyilgan — shuning uchun interfeys `RateLimiter` sifatida ajratilgan:
Redis qo'shilganda faqat shu klassning yangi implementatsiyasi yoziladi,
chaqiruvchi kod o'zgarmaydi.
"""

import time
from collections import defaultdict
from threading import Lock

from app.core.config import settings
from app.core.exceptions import RateLimitError


class RateLimiter:
    def hit(self, key: str, *, limit: int, window_seconds: int) -> None:
        raise NotImplementedError

    def reset(self, key: str) -> None:
        raise NotImplementedError


class InMemoryRateLimiter(RateLimiter):
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def hit(self, key: str, *, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        with self._lock:
            recent = [t for t in self._hits[key] if now - t < window_seconds]
            if len(recent) >= limit:
                retry_after = int(window_seconds - (now - recent[0])) + 1
                self._hits[key] = recent
                raise RateLimitError(
                    "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.",
                    details={"retry_after_seconds": retry_after},
                )
            recent.append(now)
            self._hits[key] = recent

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


login_limiter: RateLimiter = InMemoryRateLimiter()


def check_login_attempt(key: str) -> None:
    login_limiter.hit(
        f"login:{key}",
        limit=settings.login_rate_limit_attempts,
        window_seconds=settings.login_rate_limit_window_seconds,
    )


def clear_login_attempts(key: str) -> None:
    login_limiter.reset(f"login:{key}")
