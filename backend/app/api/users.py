import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.user import ProfileUpdateRequest, UserProfileResponse
from app.services import user_service
from app.services.user_service import ALLOWED_AVATAR_TYPES, AVATAR_MAX_BYTES

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfileResponse)
async def read_profile(current_user: User = Depends(get_current_user)) -> UserProfileResponse:
    return await user_service.serialize(current_user)


@router.patch("/me", response_model=UserProfileResponse)
async def update_profile(
    payload: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    """Edit the fields a user owns.

    Email is deliberately not among them: it is the login identity and the
    address job notifications are sent to, so changing it needs a verification
    round-trip rather than a text box.
    """
    return await user_service.update_profile(db, current_user, payload)


@router.post("/me/avatar", response_model=UserProfileResponse)
async def upload_avatar(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Profile picture must be a PNG, JPEG, WebP or GIF image.",
        )

    # The bucket would happily take a 2 GB "avatar", and every page load signs
    # a URL for it. Measure by seeking the spooled upload rather than reading
    # it into memory just to find out how big it is.
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="That file is empty."
        )
    if size > AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Profile picture must be under {AVATAR_MAX_BYTES // (1024 * 1024)} MB.",
        )

    return await user_service.set_avatar(
        db, current_user, file.filename or "avatar", file.file, content_type
    )


@router.delete("/me/avatar", response_model=UserProfileResponse)
async def delete_avatar(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> UserProfileResponse:
    return await user_service.remove_avatar(db, current_user)
