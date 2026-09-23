"""Umumiy ustun turlari."""

import enum
from typing import TypeVar

from sqlalchemy import Enum as SAEnum

E = TypeVar("E", bound=enum.Enum)


def enum_column(enum_cls: type[E], *, name: str, length: int = 24) -> SAEnum:
    """Enumni VARCHAR + CHECK sifatida saqlaydi.

    PostgreSQL native ENUM emas: yangi qiymat qo'shish `ALTER TYPE` talab
    qiladi va migratsiyani og'irlashtiradi. Talab 13 "kengaytiriluvchanlik"
    ni hisobga olib, matn + CHECK tanlandi (masalan davomatga keyinchalik
    `late`/`excused` qo'shish oddiy migratsiya bo'ladi).
    """
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        length=length,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda cls: [member.value for member in cls],
    )
