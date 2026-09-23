"""enrollment fee note

Alohida narx nega berilganini yozib qo'yish uchun (imtiyoz, qarindosh,
aka-uka chegirmasi). Bir necha oydan keyin "nega bu o'quvchi kamroq
to'laydi?" degan savolga javob bo'ladi.

Revision ID: 9d33b7c15a48
Revises: 8c21a4d9e307
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9d33b7c15a48"
down_revision: str | None = "8c21a4d9e307"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "enrollments", sa.Column("fee_note", sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("enrollments", "fee_note")
