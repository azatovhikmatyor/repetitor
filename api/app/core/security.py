"""Parol hashlash va JWT.

- Parol: argon2id (talab: bcrypt yoki argon2).
- Token: JWT access (qisqa) + refresh (uzun, bekor qilinadigan).
  Refresh tokenning o'zi bazada saqlanmaydi — faqat SHA-256 hash'i,
  shunda baza o'g'irlansa ham tokenlar ishlatib bo'lmaydi.
"""

import hashlib
import secrets
import string
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import settings

_hasher = PasswordHasher()

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def generate_temp_password(length: int = 8) -> str:
    """O'qituvchi o'quvchiga beradigan vaqtinchalik parol.

    Telefonda og'zaki aytish uchun chalkashtiradigan belgilar (0/O, 1/l/I)
    chiqarib tashlangan.
    """
    alphabet = "".join(
        c for c in string.ascii_uppercase + string.digits if c not in "O0I1"
    )
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_url_token() -> str:
    """Parol tiklash havolasi uchun bir martalik token."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Refresh / reset tokenning bazada saqlanadigan ko'rinishi."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_token(
    *,
    subject: str,
    token_type: TokenType,
    expires_delta: timedelta,
    extra: dict[str, Any] | None = None,
) -> tuple[str, str, datetime]:
    now = datetime.now(tz=UTC)
    expires_at = now + expires_delta
    jti = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "sub": subject,
        "jti": jti,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    if extra:
        payload.update(extra)
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, jti, expires_at


def create_access_token(
    user_id: int, *, role: str, must_change_password: bool
) -> tuple[str, datetime]:
    token, _, expires_at = _create_token(
        subject=str(user_id),
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        extra={"role": role, "mcp": must_change_password},
    )
    return token, expires_at


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    """(token, jti, expires_at) qaytaradi — jti bekor qilish uchun kerak."""
    return _create_token(
        subject=str(user_id),
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str, *, expected_type: TokenType) -> dict[str, Any]:
    """Tokenni ochadi va turini tekshiradi.

    Xato/muddati o'tgan token uchun `jwt.PyJWTError` ko'taradi.
    """
    payload = jwt.decode(
        token, settings.secret_key, algorithms=[settings.jwt_algorithm]
    )
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected {expected_type} token")
    return payload
