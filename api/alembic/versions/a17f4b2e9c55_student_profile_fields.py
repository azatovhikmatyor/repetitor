"""student profile fields

O'quvchi kartasi uchun: tug'ilgan sana, ota-ona aloqasi, maktab va izoh.
Barchasi ixtiyoriy va faqat o'quvchi rolida to'ldiriladi (`teacher_id`
kabi).

Revision ID: a17f4b2e9c55
Revises: 9d33b7c15a48
Create Date: 2026-09-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a17f4b2e9c55"
down_revision: str | None = "9d33b7c15a48"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS = [
    ("birth_date", sa.Date()),
    ("parent_name", sa.String(length=120)),
    ("parent_phone", sa.String(length=32)),
    ("school", sa.String(length=120)),
    ("note", sa.Text()),
]


def upgrade() -> None:
    for name, type_ in COLUMNS:
        op.add_column("users", sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    for name, _type in reversed(COLUMNS):
        op.drop_column("users", name)
