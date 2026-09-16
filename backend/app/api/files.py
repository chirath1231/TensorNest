from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.file import UploadedFile
from app.models.user import User
from app.schemas.file import FileDownloadResponse, FileResponse
from app.services.storage_service import delete_object, presigned_get_url, upload_fileobj

router = APIRouter(prefix="/files", tags=["files"])


async def _owned_file(db: AsyncSession, owner: User, file_id: UUID) -> UploadedFile:
    result = await db.execute(
        select(UploadedFile).where(UploadedFile.id == file_id, UploadedFile.owner_id == owner.id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return record


@router.get("", response_model=list[FileResponse])
async def list_files(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[FileResponse]:
    result = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.owner_id == current_user.id)
        .order_by(UploadedFile.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    filename = file.filename or "upload.bin"
    # Stream straight from the request's spooled temp file into the bucket, so
    # a large dataset is never fully materialised in this process's memory.
    object_key, size = await upload_fileobj(
        current_user.id,
        filename,
        file.file,
        file.content_type or "application/octet-stream",
    )
    record = UploadedFile(
        owner_id=current_user.id,
        filename=filename,
        object_key=object_key,
        size=size,
        content_type=file.content_type or "application/octet-stream",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/{file_id}/download", response_model=FileDownloadResponse)
async def download_file(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileDownloadResponse:
    """Hand back a short-lived presigned URL rather than proxying the bytes.

    The same URL is what a training container will use to pull its dataset, so
    a job never needs bucket credentials of its own.
    """
    record = await _owned_file(db, current_user, file_id)
    if record.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That dataset is still importing." if record.status == "importing"
            else "That import failed, so there is nothing to download.",
        )
    url = await presigned_get_url(record.object_key, record.filename)
    return FileDownloadResponse(url=url, filename=record.filename)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_file(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    record = await _owned_file(db, current_user, file_id)
    # Delete the object first: a failure here aborts the request and leaves the
    # row in place, so the object stays reachable and retryable rather than
    # becoming an orphan nobody can see or clean up.
    #
    # An import that failed or is still running has no object yet, and asking
    # the bucket to delete an empty key is not a no-op — it is an error.
    if record.object_key:
        await delete_object(record.object_key)
    await db.delete(record)
    await db.commit()
