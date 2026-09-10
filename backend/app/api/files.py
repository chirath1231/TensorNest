from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.file import UploadedFile
from app.models.user import User
from app.schemas.file import FileResponse
from app.services.storage_service import delete_file, save_upload

router = APIRouter(prefix="/files", tags=["files"])


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
    data = await file.read()
    path = save_upload(current_user.id, file.filename or "upload.bin", data)
    record = UploadedFile(
        owner_id=current_user.id,
        filename=file.filename or "upload.bin",
        path=path,
        size=len(data),
        content_type=file.content_type or "application/octet-stream",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_file(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(
        select(UploadedFile).where(UploadedFile.id == file_id, UploadedFile.owner_id == current_user.id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    delete_file(record.path)
    await db.delete(record)
    await db.commit()
