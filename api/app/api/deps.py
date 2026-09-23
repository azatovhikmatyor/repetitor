"""Umumiy FastAPI dependency'lari.

Ruxsat tekshiruvi shu yerda markazlashgan: har bir router faqat kerakli
dependency'ni tanlaydi, tekshiruv mantiqi takrorlanmaydi (talab 3:
"ruxsat tekshiruvi backend'da, endpoint darajasida").
"""

from collections.abc import Awaitable, Callable
from typing import Annotated

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthenticationError,
    PasswordChangeRequiredError,
    PermissionDeniedError,
)
from app.core.pagination import PageParams, page_params
from app.core.security import decode_token
from app.db.session import get_db
from app.modules.users.models import User, UserRole, UserStatus
from app.modules.users.service import effective_status

bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")

DbSession = Annotated[AsyncSession, Depends(get_db)]
Pagination = Annotated[PageParams, Depends(page_params)]


async def get_current_user(
    db: DbSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ] = None,
) -> User:
    if credentials is None:
        raise AuthenticationError("Avtorizatsiya talab qilinadi")

    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Token muddati tugagan") from exc
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Token yaroqsiz") from exc

    user = await db.get(User, int(payload["sub"]))
    if user is None:
        raise AuthenticationError("Hisob faol emas")

    # O'quvchining kirishi o'qituvchisi holatiga ham bog'liq: o'qituvchi
    # bloklansa, o'quvchilari ham tizimdan chiqariladi.
    if await effective_status(db, user) is not UserStatus.ACTIVE:
        raise AuthenticationError("Hisob faol emas")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_verified_user(user: CurrentUser) -> User:
    """Parolni almashtirish shart bo'lsa, boshqa ekranlarni yopadi.

    Talab 3: o'quvchi birinchi kirganda yangi parol qo'ymaguncha boshqa
    endpoint'larga o'tolmaydi. Ochiq qoladiganlar — `/auth/me` va
    `/auth/password/change`.
    """
    if user.must_change_password:
        raise PasswordChangeRequiredError(
            "Davom etish uchun avval parolni o'zgartiring"
        )
    return user


VerifiedUser = Annotated[User, Depends(get_verified_user)]


def require_roles(*roles: UserRole) -> Callable[[User], Awaitable[User]]:
    async def dependency(user: VerifiedUser) -> User:
        if user.role not in roles:
            raise PermissionDeniedError("Bu amal uchun ruxsat yo'q")
        return user

    return dependency


# Kundalik o'qituvchi ishlari (guruh, o'quvchi, davomat, to'lov) faqat
# TEACHER roliga ochiq. Super Admin platformani boshqaradi va o'qituvchining
# moliyaviy ma'lumotini ko'rmaydi (talab 9: "super admin alohida
# o'qituvchining aniq daromadini ko'rmaydi").
CurrentTeacher = Annotated[User, Depends(require_roles(UserRole.TEACHER))]
CurrentAdmin = Annotated[User, Depends(require_roles(UserRole.SUPER_ADMIN))]
CurrentStudent = Annotated[User, Depends(require_roles(UserRole.STUDENT))]


def get_user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


UserAgent = Annotated[str | None, Depends(get_user_agent)]
