"""Searching external catalogues and pulling files into the bucket.

Two things shape this module.

Search fans out concurrently and tolerates failure. A catalogue being slow or
down is normal, and it must cost the user that source's results rather than
their whole query — so one adapter raising is logged and dropped, not
propagated.

Import is a queued job, not a request. A dataset is routinely gigabytes; that
cannot happen inside an HTTP handler, and the bytes are streamed straight
through to the bucket rather than buffered, so a 4 GB parquet never becomes
4 GB of worker memory.
"""

import asyncio
import logging
import tempfile
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis import get_arq_pool
from app.datasets import SOURCES, SearchResult
from app.models.file import UploadedFile
from app.models.user import User
from app.services import storage_service

settings = get_settings()

logger = logging.getLogger(__name__)

DOWNLOAD_TIMEOUT = httpx.Timeout(30.0, read=300.0)
CHUNK_BYTES = 1024 * 1024


async def search(query: str, limit: int, source_names: list[str] | None = None) -> list[SearchResult]:
    chosen = [
        source
        for name, source in SOURCES.items()
        if source.available and (not source_names or name in source_names)
    ]

    async def _safe(source):
        try:
            return await source.search(query, limit)
        except Exception:  # noqa: BLE001 — one bad catalogue must not empty the page
            logger.exception("Dataset search failed for source %s", source.name)
            return []

    batches = await asyncio.gather(*(_safe(s) for s in chosen))

    # Interleave rather than concatenate, so a source that returns 20 results
    # cannot bury one that returned 3.
    merged: list[SearchResult] = []
    for row in range(max((len(b) for b in batches), default=0)):
        for batch in batches:
            if row < len(batch):
                merged.append(batch[row])
    return merged[:limit]


async def describe(source_name: str, ref: str) -> SearchResult:
    source = SOURCES[source_name]
    return await source.describe(ref)


async def queue_import(
    db: AsyncSession, owner: User, source_name: str, ref: str, path: str, filename: str
) -> UploadedFile:
    """Record the dataset as importing and hand the download to the worker."""
    source = SOURCES[source_name]

    # Capture the licence now, while we still know which catalogue entry this
    # came from. Recovering it later means re-deriving the source from a URL,
    # which is exactly the friction that stops anyone from checking terms.
    licence = None
    try:
        licence = (await source.describe(ref)).license
    except Exception:  # noqa: BLE001 — provenance is worth having, not worth failing over
        logger.warning("Could not read licence for %s:%s", source_name, ref, exc_info=True)

    record = UploadedFile(
        owner_id=owner.id,
        filename=filename,
        object_key="",
        size=0,
        content_type="application/octet-stream",
        status="importing",
        source=source_name,
        source_ref=f"{ref}::{path}" if path else ref,
        source_url=await source.file_url(ref, path),
        data_license=licence,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    pool = await get_arq_pool()
    await pool.enqueue_job("import_dataset", str(record.id))
    return record


async def retry(db: AsyncSession, owner: User, file_id: UUID) -> UploadedFile | None:
    """Re-queue an import that failed. Most failures are a timeout or a
    catalogue having a bad minute, so the useful response is to try again
    rather than to make the user find the dataset a second time."""
    record = await db.get(UploadedFile, file_id)
    if record is None or record.owner_id != owner.id or record.status != "failed":
        return None

    record.status = "importing"
    record.error_message = None
    await db.commit()
    await db.refresh(record)

    pool = await get_arq_pool()
    await pool.enqueue_job("import_dataset", str(record.id))
    return record


async def perform_import(file_id: UUID) -> None:
    """Fetch the bytes and finish the row. Called by the arq task."""
    from app.core.db import async_session_maker

    async with async_session_maker() as db:
        record = await db.get(UploadedFile, file_id)
        if record is None or record.status != "importing":
            return
        url = record.source_url
        owner_id = record.owner_id
        filename = record.filename

    try:
        object_key, size, content_type = await _stream_to_bucket(owner_id, filename, url)
    except Exception as exc:  # noqa: BLE001 — the reason belongs on the row
        logger.exception("Dataset import failed for %s", file_id)
        async with async_session_maker() as db:
            record = await db.get(UploadedFile, file_id)
            if record is not None:
                record.status = "failed"
                record.error_message = str(exc)[:500]
                await db.commit()
        return

    async with async_session_maker() as db:
        record = await db.get(UploadedFile, file_id)
        if record is None:
            # Cancelled while downloading — do not leave the object orphaned.
            await storage_service.delete_object(object_key)
            return
        record.object_key = object_key
        record.size = size
        record.content_type = content_type
        record.status = "ready"
        record.error_message = None
        await db.commit()


async def _stream_to_bucket(owner_id, filename: str, url: str) -> tuple[str, int, str]:
    """Download to a spooled temp file, then upload. Never holds the whole
    dataset in memory: the spool rolls over to disk past a few megabytes, and
    boto3 reads it back as a stream."""
    content_type = "application/octet-stream"

    with tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024) as spool:
        async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                header_type = (response.headers.get("content-type") or "").split(";")[0].strip()
                if header_type:
                    content_type = header_type
                downloaded = 0
                async for chunk in response.aiter_bytes(CHUNK_BYTES):
                    downloaded += len(chunk)
                    if downloaded > settings.dataset_import_max_bytes:
                        raise ValueError(
                            f"This file is larger than the "
                            f"{settings.dataset_import_max_bytes // (1024 ** 3)} GB import limit."
                        )
                    spool.write(chunk)

        spool.seek(0)
        object_key, size = await storage_service.upload_fileobj(
            owner_id, filename, spool, content_type
        )

    return object_key, size, content_type
