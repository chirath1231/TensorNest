from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.notebook import (
    NotebookCreateRequest,
    NotebookExportResponse,
    NotebookResponse,
    NotebookSummary,
    NotebookUpdateRequest,
)
from app.services import notebook_export, notebook_service
from app.services.storage_service import presigned_get_url

router = APIRouter(prefix="/notebooks", tags=["notebooks"])


@router.get("", response_model=list[NotebookSummary])
async def list_notebooks(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[NotebookSummary]:
    return await notebook_service.list_notebooks(db, current_user)


@router.post("", response_model=NotebookResponse, status_code=status.HTTP_201_CREATED)
async def create_notebook(
    payload: NotebookCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotebookResponse:
    return await notebook_service.create_notebook(db, current_user, payload)


@router.get("/{notebook_id}", response_model=NotebookResponse)
async def get_notebook(
    notebook_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotebookResponse:
    return await notebook_service.get_notebook(db, current_user, notebook_id)


@router.patch("/{notebook_id}", response_model=NotebookResponse)
async def update_notebook(
    notebook_id: UUID,
    payload: NotebookUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotebookResponse:
    return await notebook_service.update_notebook(db, current_user, notebook_id, payload)


@router.post("/{notebook_id}/export", response_model=NotebookExportResponse)
async def export_notebook(
    notebook_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotebookExportResponse:
    """Write the notebook to the bucket as a standalone .ipynb and hand back a
    download URL. Re-exporting overwrites the previous file for this notebook.
    """
    notebook = await notebook_service.get_notebook(db, current_user, notebook_id)
    key, size = await notebook_export.export_to_bucket(
        current_user.id, notebook.id, notebook.content, notebook.title
    )
    filename = f"{notebook.title or 'notebook'}.ipynb"
    url = await presigned_get_url(key, filename)
    return NotebookExportResponse(object_key=key, size=size, filename=filename, url=url)


@router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notebook(
    notebook_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await notebook_service.delete_notebook(db, current_user, notebook_id)
