from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notebook import EMPTY_NOTEBOOK, Notebook
from app.models.user import User
from app.schemas.notebook import NotebookCreateRequest, NotebookUpdateRequest


async def list_notebooks(db: AsyncSession, owner: User) -> list[Notebook]:
    result = await db.execute(
        select(Notebook).where(Notebook.owner_id == owner.id).order_by(Notebook.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_notebook(db: AsyncSession, owner: User, notebook_id: UUID) -> Notebook:
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.owner_id == owner.id)
    )
    notebook = result.scalar_one_or_none()
    if notebook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notebook not found")
    return notebook


async def create_notebook(db: AsyncSession, owner: User, payload: NotebookCreateRequest) -> Notebook:
    notebook = Notebook(owner_id=owner.id, title=payload.title, content=dict(EMPTY_NOTEBOOK))
    db.add(notebook)
    await db.commit()
    await db.refresh(notebook)
    return notebook


async def update_notebook(
    db: AsyncSession, owner: User, notebook_id: UUID, payload: NotebookUpdateRequest
) -> Notebook:
    notebook = await get_notebook(db, owner, notebook_id)
    if payload.title is not None:
        notebook.title = payload.title
    if payload.content is not None:
        notebook.content = payload.content
    await db.commit()
    await db.refresh(notebook)
    return notebook


async def delete_notebook(db: AsyncSession, owner: User, notebook_id: UUID) -> None:
    notebook = await get_notebook(db, owner, notebook_id)
    await db.delete(notebook)
    await db.commit()
