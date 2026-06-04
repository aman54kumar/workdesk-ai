"""org llm settings and analytics llm columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "org_llm_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("local_backend", sa.String(30), nullable=False, server_default="ollama"),
        sa.Column("local_base_url", sa.String(500), nullable=False),
        sa.Column("local_api_key", sa.Text(), nullable=True),
        sa.Column("model_default", sa.String(120), nullable=False),
        sa.Column("model_code", sa.String(120), nullable=False),
        sa.Column("model_quality", sa.String(120), nullable=False),
        sa.Column("allowed_models", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("allow_user_cloud", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("allowed_cloud_providers", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("org_display_name", sa.String(200), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("usage_event", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("llm_source", sa.String(10), nullable=True, server_default="local")
        )
        batch_op.add_column(sa.Column("llm_provider", sa.String(30), nullable=True))
        batch_op.alter_column("model", type_=sa.String(120), existing_type=sa.String(50))


def downgrade() -> None:
    with op.batch_alter_table("usage_event", schema=None) as batch_op:
        batch_op.alter_column("model", type_=sa.String(50), existing_type=sa.String(120))
        batch_op.drop_column("llm_provider")
        batch_op.drop_column("llm_source")

    op.drop_table("org_llm_settings")
