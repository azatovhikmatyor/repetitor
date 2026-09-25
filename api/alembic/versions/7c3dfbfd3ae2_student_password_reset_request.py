"""student password reset request

O'quvchi ilovaga kira olmay qolsa, o'qituvchisiga so'rov yuboradi.
O'qituvchi ENDI faqat shu so'rov kelgandan keyin parolni tiklay oladi —
avvalgidek istalgan payt emas.

Revision ID: 7c3dfbfd3ae2
Revises: c34d7a90b112
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7c3dfbfd3ae2"
down_revision: str | None = "c34d7a90b112"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_reset_requested_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_column("users", "password_reset_requested_at")
