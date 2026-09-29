from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

BIO_MAX = 280


class UserProfileResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    bio: str | None
    # Signed on read and short-lived, so it is absent rather than stale when
    # the user has no picture. Never persisted in this form.
    avatar_url: str | None
    created_at: datetime


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    # "" clears the bio; the service normalises it to NULL so an empty bio and
    # an unset one are the same thing to every reader.
    bio: str = Field(default="", max_length=BIO_MAX)
