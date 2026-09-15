from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    event: str
    title: str
    body: str
    job_id: UUID | None
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
    # Lets the UI explain why no mail is arriving instead of leaving the user
    # to guess whether the feature is broken or simply not set up.
    email_enabled: bool
