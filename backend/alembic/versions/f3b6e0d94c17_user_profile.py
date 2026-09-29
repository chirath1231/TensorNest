"""user profile: bio and avatar

Both nullable with no backfill — an existing account simply has no bio and
no picture until its owner sets one.

Revision ID: f3b6e0d94c17
Revises: d7f2c9a15b84
Create Date: 2026-09-16 08:14:37.552118

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3b6e0d94c17'
down_revision: Union[str, None] = 'd7f2c9a15b84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('avatar_key', sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'avatar_key')
    op.drop_column('users', 'bio')
