"""SMTP transport.

Deliberately dumb: it knows how to put one message on the wire and nothing
about what the message says. Templates live in notification_service, so this
module stays the only place that has to care about STARTTLS vs implicit TLS.

smtplib is blocking, so every call is pushed to a thread — a slow or
unreachable mail server must never stall the event loop that is also polling
running jobs.
"""

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import get_settings

settings = get_settings()

logger = logging.getLogger(__name__)


class EmailNotConfigured(RuntimeError):
    pass


async def send_email(to: str, subject: str, text_body: str, html_body: str) -> None:
    """Deliver one message. Raises on failure so the caller can record it."""
    if not settings.email_enabled:
        raise EmailNotConfigured("SMTP_HOST is not set")

    message = EmailMessage()
    # The subject carries a user-supplied job name. A newline inside a header
    # value is how header injection works, so it never reaches the wire.
    message["Subject"] = " ".join(subject.split())
    message["From"] = formataddr((settings.smtp_from_name, settings.email_sender))
    message["To"] = to
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    await asyncio.to_thread(_deliver, message)
    logger.info("Sent notification email to %s: %s", to, subject)


def _deliver(message: EmailMessage) -> None:
    if settings.smtp_use_ssl:
        client = smtplib.SMTP_SSL(
            settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds
        )
    else:
        client = smtplib.SMTP(
            settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds
        )

    with client:
        if not settings.smtp_use_ssl:
            client.starttls()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)
