"""jobs: per-job network access

Local job containers ran with network_disabled unconditionally, which blocked
runtime pip installs and — once the in-container SDK existed — dataset access,
since the SDK reaches the API over the network. This makes it a per-job choice,
defaulting on. Existing rows have all finished, so their value is historical.

Revision ID: a91c4e7b23d5
Revises: f3b6e0d94c17
Create Date: 2026-09-16 11:26:41.883204

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a91c4e7b23d5'
down_revision: Union[str, None] = 'f3b6e0d94c17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'jobs',
        sa.Column('allow_network', sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column('jobs', 'allow_network')
