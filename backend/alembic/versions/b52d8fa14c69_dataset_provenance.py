"""files: import status and provenance

Datasets can now arrive from an external catalogue rather than only from a
file picker. An import takes minutes, so the row exists first in `importing`
and is filled in by the worker — otherwise a dataset would appear out of
nowhere long after the user asked for it.

Provenance is recorded at import because web-sourced data carries terms that
a local file does not, and a licence you have to go and look up later is one
nobody looks up.

Revision ID: b52d8fa14c69
Revises: a91c4e7b23d5
Create Date: 2026-09-16 15:02:18.447291

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b52d8fa14c69'
down_revision: Union[str, None] = 'a91c4e7b23d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('files', sa.Column('status', sa.String(length=16), nullable=False, server_default='ready'))
    op.add_column('files', sa.Column('error_message', sa.Text(), nullable=True))
    op.add_column('files', sa.Column('source', sa.String(length=32), nullable=False, server_default='upload'))
    op.add_column('files', sa.Column('source_ref', sa.String(length=512), nullable=True))
    op.add_column('files', sa.Column('source_url', sa.Text(), nullable=True))
    op.add_column('files', sa.Column('data_license', sa.String(length=128), nullable=True))


def downgrade() -> None:
    op.drop_column('files', 'data_license')
    op.drop_column('files', 'source_url')
    op.drop_column('files', 'source_ref')
    op.drop_column('files', 'source')
    op.drop_column('files', 'error_message')
    op.drop_column('files', 'status')
