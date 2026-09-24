"""expenses

Xarajat yozuvlari — ijara, maosh, kommunal va boshqalar. Ularsiz
tizimda daromad bor, foyda yo'q edi.

Revision ID: c34d7a90b112
Revises: b28e5f71c904
Create Date: 2026-09-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c34d7a90b112"
down_revision: str | None = "b28e5f71c904"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "rent",
                "salary",
                "utilities",
                "marketing",
                "supplies",
                "other",
                name="expense_category",
                native_enum=False,
                create_constraint=True,
                length=24,
            ),
            nullable=False,
        ),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("spent_on", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "is_recurring", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.CheckConstraint("amount > 0", name="expense_amount_positive"),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_expenses_teacher_id", "expenses", ["teacher_id"])
    op.create_index(
        "ix_expenses_teacher_date", "expenses", ["teacher_id", "spent_on"]
    )


def downgrade() -> None:
    op.drop_index("ix_expenses_teacher_date", table_name="expenses")
    op.drop_index("ix_expenses_teacher_id", table_name="expenses")
    op.drop_table("expenses")
