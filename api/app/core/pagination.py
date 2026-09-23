"""Sahifalash — barcha ro'yxatlar uchun bitta shakl (talab 13: tezlik)."""

from typing import Annotated, Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field

T = TypeVar("T")

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class PageParams(BaseModel):
    page: int = 1
    size: int = DEFAULT_PAGE_SIZE

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


def page_params(
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> PageParams:
    return PageParams(page=page, size=size)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int = Field(description="Filtrga mos jami yozuvlar soni")
    page: int
    size: int
    pages: int

    @classmethod
    def create(cls, items: list[T], total: int, params: PageParams) -> "Page[T]":
        pages = (total + params.size - 1) // params.size if params.size else 0
        return cls(
            items=items, total=total, page=params.page, size=params.size, pages=pages
        )
