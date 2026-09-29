from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.datasets import SOURCES
from app.models.user import User
from app.schemas.file import FileResponse
from app.services import dataset_import

router = APIRouter(prefix="/discover", tags=["discover"])


class ImportRequest(BaseModel):
    source: str
    ref: str = Field(min_length=1, max_length=512)
    # Which file inside the dataset. Empty for sources that address a single
    # file directly, such as a pasted link.
    path: str = Field(default="", max_length=512)
    # Overrides the name it lands under, so an import can avoid colliding with
    # something already on the account.
    filename: str = Field(default="", max_length=255)


@router.get("/sources")
async def list_sources(_: User = Depends(get_current_user)) -> dict:
    return {
        "sources": [
            {"name": s.name, "label": s.label, "available": s.available}
            for s in SOURCES.values()
        ]
    }


@router.get("/search")
async def search_datasets(
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(20, ge=1, le=50),
    source: list[str] | None = Query(default=None),
    _: User = Depends(get_current_user),
) -> dict:
    results = await dataset_import.search(q, limit, source)
    return {"results": [r.__dict__ for r in results]}


@router.get("/describe")
async def describe_dataset(
    source: str = Query(min_length=1),
    ref: str = Query(min_length=1, max_length=512),
    _: User = Depends(get_current_user),
) -> dict:
    if source not in SOURCES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown source '{source}'."
        )
    try:
        result = await dataset_import.describe(source, ref)
    except Exception as exc:  # noqa: BLE001 — the catalogue's reason is the useful one
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not read '{ref}' from {SOURCES[source].label}: {exc}",
        ) from exc
    return {**result.__dict__, "files": [f.__dict__ for f in result.files]}


@router.post("/import", response_model=FileResponse, status_code=status.HTTP_202_ACCEPTED)
async def import_dataset(
    payload: ImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Start pulling one file into the user's datasets.

    Returns immediately with the row in `importing`: the download happens on the
    worker, because a dataset is routinely large enough that doing it here would
    hold a request open for minutes.
    """
    if payload.source not in SOURCES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown source '{payload.source}'."
        )

    filename = payload.filename.strip() or payload.path.rsplit("/", 1)[-1]
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Choose which file to import.",
        )

    record = await dataset_import.queue_import(
        db, current_user, payload.source, payload.ref, payload.path, filename
    )
    return record


@router.post("/import/{file_id}/retry", response_model=FileResponse)
async def retry_import(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    record = await dataset_import.retry(db, current_user, file_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No failed import with that id."
        )
    return record
