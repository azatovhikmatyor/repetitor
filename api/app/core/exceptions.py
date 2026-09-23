"""Domen xatoliklari.

Service qatlami HTTP haqida bilmaydi — u shu xatoliklarni ko'taradi,
`app.main` dagi handler ularni JSON javobga aylantiradi.
"""

from typing import Any


class AppError(Exception):
    status_code: int = 400
    code: str = "app_error"

    def __init__(self, message: str, *, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    """Mavjud emas — yoki boshqa o'qituvchiga tegishli.

    Talab 12: begona resursga so'rov 403 emas, 404 qaytaradi (resurs
    umuman ko'rinmasligi kerak).
    """

    status_code = 404
    code = "not_found"


class PermissionDeniedError(AppError):
    status_code = 403
    code = "permission_denied"


class AuthenticationError(AppError):
    status_code = 401
    code = "authentication_failed"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"


class PasswordChangeRequiredError(AppError):
    """must_change_password=true bo'lganda boshqa ekranlar yopiq."""

    status_code = 403
    code = "password_change_required"
