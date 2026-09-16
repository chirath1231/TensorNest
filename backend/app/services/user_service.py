"""Profile reads and edits.

The one thing worth knowing: `avatar_key` is stored, `avatar_url` is derived.
The bucket is private, so a URL is a signed, expiring artefact — storing one
would mean serving a link that stopped working an hour later. Every response
signs a fresh one instead.
"""

import logging
from typing import BinaryIO

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import ProfileUpdateRequest, UserProfileResponse
from app.services import storage_service

logger = logging.getLogger(__name__)

AVATAR_MAX_BYTES = 5 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


async def serialize(user: User) -> UserProfileResponse:
    avatar_url = None
    if user.avatar_key:
        try:
            # No filename: the browser renders this inline in an <img>, and
            # passing one would set Content-Disposition: attachment.
            avatar_url = await storage_service.presigned_get_url(user.avatar_key)
        except Exception:  # noqa: BLE001 — a broken picture must not 500 /auth/me
            logger.exception("Could not sign avatar URL for user %s", user.id)

    return UserProfileResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        bio=user.bio,
        avatar_url=avatar_url,
        created_at=user.created_at,
    )


async def update_profile(
    db: AsyncSession, user: User, payload: ProfileUpdateRequest
) -> UserProfileResponse:
    user.name = payload.name.strip()
    bio = payload.bio.strip()
    user.bio = bio or None
    await db.commit()
    await db.refresh(user)
    return await serialize(user)


async def set_avatar(
    db: AsyncSession, user: User, filename: str, fileobj: BinaryIO, content_type: str
) -> UserProfileResponse:
    previous_key = user.avatar_key

    key, _ = await storage_service.upload_fileobj(
        user.id, filename, fileobj, content_type, prefix="avatars"
    )
    user.avatar_key = key
    await db.commit()
    await db.refresh(user)

    # Only once the new key is committed, so a failed delete leaves an orphaned
    # object rather than a profile pointing at one that no longer exists.
    await _discard(previous_key)
    return await serialize(user)


async def remove_avatar(db: AsyncSession, user: User) -> UserProfileResponse:
    previous_key = user.avatar_key
    user.avatar_key = None
    await db.commit()
    await db.refresh(user)
    await _discard(previous_key)
    return await serialize(user)


async def _discard(key: str | None) -> None:
    if not key:
        return
    try:
        await storage_service.delete_object(key)
    except Exception:  # noqa: BLE001 — the profile is already correct
        logger.exception("Could not delete replaced avatar object %s", key)
