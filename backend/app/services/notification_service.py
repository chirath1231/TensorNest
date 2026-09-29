"""Records notifications and queues their emails.

Two things are worth knowing about how this is wired.

First, a job reaches its final status by one of two independent paths: the
tracking task in `workers.tasks`, or — when that task's worker died mid-run —
the `job_reconciler` sweep. Both call in here, so recording is done with an
INSERT ... ON CONFLICT DO NOTHING against a unique (job_id, event) index. The
insert's own result is what decides whether an email goes out, which makes
"exactly one email per job event" a property of the database rather than of
the callers agreeing with each other.

Second, sending is queued onto arq rather than done inline. A job that trained
for an hour must not be reported as failed because a mail server timed out
while we were recording that it succeeded.
"""

import logging
from datetime import datetime, timezone
from html import escape
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import async_session_maker
from app.core.redis import get_arq_pool
from app.models.job import Job
from app.models.notification import Notification
from app.models.user import User
from app.services import email_service

settings = get_settings()

logger = logging.getLogger(__name__)

JOB_EVENT_BY_STATUS = {
    "running": "job_started",
    "succeeded": "job_succeeded",
    "failed": "job_failed",
}

PROVIDER_LABELS = {"local_cpu": "Local CPU", "modal_gpu": "Modal GPU"}


async def notify_job_event(db: AsyncSession, job: Job, event: str) -> None:
    """Record one job notification and queue its email, at most once ever.

    Commits: callers invoke this straight after committing the status change
    it describes, so the notification is never recorded for an outcome that
    failed to persist.
    """
    title, body = _render_job_event(job, event)

    result = await db.execute(
        pg_insert(Notification)
        .values(
            user_id=job.owner_id,
            job_id=job.id,
            event=event,
            title=title,
            body=body,
            email_status="pending" if settings.email_enabled else "skipped",
        )
        .on_conflict_do_nothing(constraint="uq_notifications_job_event")
        .returning(Notification.id)
    )
    notification_id = result.scalar_one_or_none()
    await db.commit()

    if notification_id is None:
        # The other finaliser got here first; it already queued the email.
        return
    if not settings.email_enabled:
        return

    try:
        pool = await get_arq_pool()
        await pool.enqueue_job("send_notification_email", str(notification_id))
    except Exception:  # noqa: BLE001 — a job outcome outranks its email
        logger.exception("Could not queue notification email %s", notification_id)


async def notify_job_status(db: AsyncSession, job: Job) -> None:
    """Notify for whatever status `job` currently holds, if it is notifiable."""
    event = JOB_EVENT_BY_STATUS.get(job.status)
    if event is None:
        return
    await notify_job_event(db, job, event)


async def deliver(notification_id: UUID) -> None:
    """Send the email for one notification. Called by the arq task."""
    async with async_session_maker() as db:
        notification = await db.get(Notification, notification_id)
        if notification is None or notification.email_status == "sent":
            return
        user = await db.get(User, notification.user_id)
        if user is None:
            return

        job = await db.get(Job, notification.job_id) if notification.job_id else None
        subject = f"{notification.title}: {job.name}" if job else notification.title
        html = _email_html(notification.title, notification.body, job)
        text = _email_text(notification.body, job)

        try:
            await email_service.send_email(user.email, subject, text, html)
        except Exception:  # noqa: BLE001
            notification.email_status = "failed"
            await db.commit()
            raise

        notification.email_status = "sent"
        await db.commit()


async def list_for_user(db: AsyncSession, user: User, limit: int = 30) -> list[Notification]:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def unread_count(db: AsyncSession, user: User) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
    )
    return int(result.scalar_one())


async def mark_read(db: AsyncSession, user: User, notification_id: UUID) -> Notification | None:
    notification = await db.get(Notification, notification_id)
    if notification is None or notification.user_id != user.id:
        return None
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()
    return notification


async def mark_all_read(db: AsyncSession, user: User) -> int:
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user.id, Notification.read_at.is_(None)
        )
    )
    unread = list(result.scalars().all())
    now = datetime.now(timezone.utc)
    for notification in unread:
        notification.read_at = now
    await db.commit()
    return len(unread)


async def send_test_email(user: User) -> None:
    """Prove the SMTP settings work. Sent inline, not queued, so that a bad
    App Password surfaces as an error on the request that asked for it."""
    html = _email_html(
        "Email notifications are working",
        "This is a test message from TensorNest. Job updates will arrive at this address.",
        None,
    )
    text = _email_text(
        "This is a test message from TensorNest. Job updates will arrive at this address.", None
    )
    await email_service.send_email(user.email, "TensorNest test email", text, html)


def _render_job_event(job: Job, event: str) -> tuple[str, str]:
    provider = PROVIDER_LABELS.get(job.provider_type, job.provider_type)
    if event == "job_started":
        return "Training started", f"“{job.name}” is now running on {provider}."
    if event == "job_succeeded":
        return "Training finished", f"“{job.name}” finished successfully on {provider}."
    if event == "job_failed":
        reason = (job.error_message or "").strip()
        detail = f" {reason}" if reason else " Check the job logs for details."
        return "Training failed", f"“{job.name}” failed on {provider}.{detail}"
    return "Job update", f"“{job.name}” is now {job.status}."


def _job_url(job: Job) -> str:
    return f"{settings.frontend_base_url.rstrip('/')}/jobs/{job.id}"


def _email_text(body: str, job: Job | None) -> str:
    lines = [body]
    if job is not None:
        lines += ["", f"View the job: {_job_url(job)}"]
    lines += ["", "— TensorNest"]
    return "\n".join(lines)


def _email_html(title: str, body: str, job: Job | None) -> str:
    # Table layout with inline styles: every other approach degrades somewhere
    # in Outlook or Gmail's HTML sanitiser.
    #
    # title and body carry the job name and its error message, both of which
    # are whatever the user typed or the training script printed, so they are
    # escaped rather than trusted.
    title = escape(title)
    body = escape(body)
    button = ""
    if job is not None:
        button = f"""
            <tr><td style="padding:8px 32px 32px 32px;">
              <a href="{_job_url(job)}"
                 style="display:inline-block;padding:11px 20px;border-radius:10px;
                        background:#0f172a;color:#ffffff;font-size:14px;
                        text-decoration:none;font-weight:600;">View job</a>
            </td></tr>"""

    return f"""\
<!doctype html>
<html><body style="margin:0;padding:24px;background:#f1f5f9;
  font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
         style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;
                overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="padding:20px 32px;background:#0b1020;">
      <span style="color:#ffffff;font-size:16px;font-weight:700;
                   letter-spacing:-0.01em;">TensorNest</span>
    </td></tr>
    <tr><td style="padding:32px 32px 8px 32px;">
      <h1 style="margin:0 0 12px 0;font-size:20px;color:#0f172a;">{title}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">{body}</p>
    </td></tr>{button}
    <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        You are receiving this because you started a training job on TensorNest.
      </p>
    </td></tr>
  </table>
</body></html>"""
