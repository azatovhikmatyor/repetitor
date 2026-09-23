"""group schedule versions and lesson times

Guruh jadvali erkin matndan versiyalangan jadvalga o'tadi, davomat
sessiyasi esa dars vaqtini oladi (bir kunda bir nechta dars mumkin).

Mavjud ma'lumot saqlanadi: `groups.schedule` matni joyida qoladi va
birinchi jadval versiyasi ochilmaydi — o'qituvchi jadvalni o'zi kiritadi.
Eski sessiyalarning `start_time` qiymati NULL bo'lib qoladi, ular
"jadvalsiz dars" sifatida ko'rinadi.

Revision ID: 8c21a4d9e307
Revises: 4f95faaf622b
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8c21a4d9e307"
down_revision: str | None = "4f95faaf622b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "group_schedule_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("note", sa.String(length=255), nullable=True),
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
        sa.CheckConstraint(
            "effective_to IS NULL OR effective_to >= effective_from",
            name="schedule_period_order",
        ),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_id", "effective_from", name="uq_schedule_group_from"),
    )
    op.create_index(
        "ix_schedule_group_from",
        "group_schedule_versions",
        ["group_id", "effective_from"],
    )

    op.create_table(
        "group_schedule_slots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("version_id", sa.Integer(), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=True),
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
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="weekday_range"),
        sa.CheckConstraint(
            "end_time IS NULL OR end_time > start_time", name="slot_time_order"
        ),
        sa.ForeignKeyConstraint(
            ["version_id"], ["group_schedule_versions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "version_id", "weekday", "start_time", name="uq_slot_version_weekday_time"
        ),
    )

    # Bir kunga bitta sessiya cheklovi olib tashlanadi: endi kun + vaqt.
    # SQLite'da cheklovni olib tashlash jadvalni qayta qurishni talab
    # qiladi, shuning uchun batch rejimi.
    with op.batch_alter_table("attendance_sessions") as batch:
        batch.add_column(sa.Column("start_time", sa.Time(), nullable=True))
        batch.add_column(sa.Column("slot_id", sa.Integer(), nullable=True))
        batch.drop_constraint("uq_session_group_date", type_="unique")
        batch.create_foreign_key(
            "fk_session_slot",
            "group_schedule_slots",
            ["slot_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.create_index(
        "uq_session_group_date_time",
        "attendance_sessions",
        ["group_id", "session_date", sa.text("coalesce(start_time, '00:00:00')")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_session_group_date_time", table_name="attendance_sessions")
    with op.batch_alter_table("attendance_sessions") as batch:
        batch.drop_constraint("fk_session_slot", type_="foreignkey")
        batch.drop_column("slot_id")
        batch.drop_column("start_time")
        batch.create_unique_constraint(
            "uq_session_group_date", ["group_id", "session_date"]
        )

    op.drop_table("group_schedule_slots")
    op.drop_index("ix_schedule_group_from", table_name="group_schedule_versions")
    op.drop_table("group_schedule_versions")
