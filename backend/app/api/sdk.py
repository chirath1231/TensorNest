"""Endpoints the in-container SDK calls back into.

Separate from /files because the callers are different: these are served to a
kernel or job container holding an `sdk`-type token, which is deliberately
allowed to do nothing but read datasets. Keeping them on their own router is
what makes that boundary easy to see.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_sdk_user
from app.core.db import get_db
from app.models.file import UploadedFile
from app.models.user import User
from app.sdk import sdk_source
from app.services.storage_service import presigned_get_url_for_container

router = APIRouter(prefix="/sdk", tags=["sdk"])


@router.get("/tensornest.py", response_class=PlainTextResponse)
async def serve_sdk() -> str:
    """The SDK source itself.

    Unauthenticated on purpose: this is client code, identical for everyone,
    and a kernel container fetches it before it has anything else. Serving it
    rather than baking it into the kernel image means a fix ships on a backend
    restart instead of a 2 GB rebuild.
    """
    return sdk_source()


@router.get("/datasets")
async def list_datasets(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_sdk_user)
) -> dict:
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.owner_id == current_user.id)
        .order_by(UploadedFile.created_at.desc())
    )
    return {
        "items": [
            {
                "id": str(record.id),
                "filename": record.filename,
                "size": record.size,
                "content_type": record.content_type,
            }
            for record in result.scalars().all()
        ]
    }


@router.get("/datasets/resolve")
async def resolve_dataset(
    ref: str = Query(min_length=1, max_length=512),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_sdk_user),
) -> dict:
    """Turn a filename or id into a presigned URL the container can fetch.

    Bytes go bucket → container directly. Proxying them through this process
    would put a multi-gigabyte dataset through the API for no benefit, and
    would not work at all for a job running on hardware we do not own.
    """
    owned = select(UploadedFile).where(UploadedFile.owner_id == current_user.id)

    # Filename first: it is what people actually type. Two files can share a
    # name, so the newest wins — which is the one they just uploaded.
    result = await db.execute(owned.where(UploadedFile.filename == ref).order_by(UploadedFile.created_at.desc()))
    record = result.scalars().first()

    if record is None:
        try:
            ref_id = UUID(ref)
        except ValueError:
            ref_id = None
        if ref_id is not None:
            result = await db.execute(owned.where(UploadedFile.id == ref_id))
            record = result.scalars().first()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"No dataset named '{ref}' on your account. "
                f"Run tn.datasets() to see what is available, or upload it on the Datasets page."
            ),
        )

    return {
        "id": str(record.id),
        "filename": record.filename,
        "size": record.size,
        "content_type": record.content_type,
        "url": await presigned_get_url_for_container(record.object_key),
    }
