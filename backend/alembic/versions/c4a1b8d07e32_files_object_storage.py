"""files: local path -> bucket object key

Uploads moved from the backend's local disk to an S3-compatible bucket
(MinIO locally, Cloudflare R2 in deployment), because remote GPU providers
cannot read this host's filesystem.

Revision ID: c4a1b8d07e32
Revises: 8eaa107de6f6
Create Date: 2026-09-13 10:12:44.190233

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c4a1b8d07e32'
down_revision: Union[str, None] = '8eaa107de6f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing rows hold absolute local paths that no longer resolve to
    # anything. The prototype has no uploads worth preserving, so the rename
    # is a straight rename and any stale rows should be deleted by hand.
    op.alter_column('files', 'path', new_column_name='object_key')


def downgrade() -> None:
    op.alter_column('files', 'object_key', new_column_name='path')
