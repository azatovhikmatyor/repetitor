"""cancelled lessons

Bayram yoki o'qituvchi kasal bo'lgan kun: dars o'tkazilmadi. Bunday
sessiya davomat foiziga kirmaydi, aks holda o'qituvchi hammani "yo'q"
deb belgilashga majbur bo'lardi va statistika buzilardi.

Revision ID: b28e5f71c904
Revises: a17f4b2e9c55
Create Date: 2026-09-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b28e5f71c904"
down_revision: str | None = "a17f4b2e9c55"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "attendance_sessions",
        sa.Column(
            "is_cancelled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("attendance_sessions", "is_cancelled")
