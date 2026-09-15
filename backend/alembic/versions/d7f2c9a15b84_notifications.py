"""notifications

In-app notification centre plus the record that backs each outcome email.

The unique constraint on (job_id, event) is load-bearing rather than
defensive: a job is finalised either by its tracking task or, when that
task's worker died, by the reconciler sweep, and both notify. The
constraint is what turns the second one into a no-op instead of a
duplicate email.

Revision ID: d7f2c9a15b84
Revises: c4a1b8d07e32
Create Date: 2026-09-15 09:41:02.118904

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd7f2c9a15b84'
down_revision: Union[str, None] = 'c4a1b8d07e32'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('notifications',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('job_id', sa.UUID(), nullable=True),
    sa.Column('event', sa.String(length=32), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('email_status', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('job_id', 'event', name='uq_notifications_job_event')
    )
    op.create_index(op.f('ix_notifications_job_id'), 'notifications', ['job_id'], unique=False)
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_job_id'), table_name='notifications')
    op.drop_table('notifications')
