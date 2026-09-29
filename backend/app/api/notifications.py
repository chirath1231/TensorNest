from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.models.user import User
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services import notification_service

settings = get_settings()

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationListResponse:
    items = await notification_service.list_for_user(db, current_user, limit)
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(item) for item in items],
        unread_count=await notification_service.unread_count(db, current_user),
        email_enabled=settings.email_enabled,
    )


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationResponse:
    notification = await notification_service.mark_read(db, current_user, notification_id)
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )
    return NotificationResponse.model_validate(notification)


@router.post("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict:
    return {"updated": await notification_service.mark_all_read(db, current_user)}


@router.post("/test-email")
async def send_test_email(current_user: User = Depends(get_current_user)) -> dict:
    """Send a test message to the signed-in user's address.

    SMTP setup fails in quiet ways — a Gmail account password instead of an
    App Password, the wrong port for the TLS mode — and the failures otherwise
    only ever appear in worker logs, long after a job finished.
    """
    if not settings.email_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is not configured. Set SMTP_HOST and restart the backend.",
        )
    try:
        await notification_service.send_test_email(current_user)
    except Exception as exc:  # noqa: BLE001 — the reason is the whole point
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"SMTP error: {exc}"
        ) from exc
    return {"sent_to": current_user.email}
