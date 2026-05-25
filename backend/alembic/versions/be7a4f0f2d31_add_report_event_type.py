"""add report event type

Revision ID: be7a4f0f2d31
Revises: aee32d9e34c9
Create Date: 2026-05-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "be7a4f0f2d31"
down_revision: Union[str, Sequence[str], None] = "aee32d9e34c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


report_event_type = sa.Enum(
    "outage",
    "restored",
    "low_voltage",
    "flickering",
    "still_out",
    name="reporteventtype",
)


def upgrade() -> None:
    bind = op.get_bind()
    report_event_type.create(bind, checkfirst=True)
    op.add_column(
        "reports",
        sa.Column(
            "event_type",
            report_event_type,
            nullable=False,
            server_default="outage",
        ),
    )
    op.alter_column("reports", "event_type", server_default=None)


def downgrade() -> None:
    op.drop_column("reports", "event_type")
    bind = op.get_bind()
    report_event_type.drop(bind, checkfirst=True)
