"""Dataset storage on an S3-compatible bucket.

Object keys are shaped `uploads/<owner_id>/<random>_<filename>` so that a key
is self-describing and every user's objects share a prefix (useful later for
per-user quota queries and lifecycle rules).

boto3 is synchronous, so every call here is wrapped in `asyncio.to_thread` to
keep it off the event loop — the same pattern `LocalDockerProvider` uses for
the Docker SDK.
"""

import asyncio
import os
import uuid
from typing import BinaryIO

from app.core.config import get_settings
from app.core.storage import get_s3_client

settings = get_settings()


def build_object_key(owner_id: uuid.UUID, filename: str) -> str:
    """Namespace the key by owner and prefix a random component, so two users
    uploading `train.csv` never collide and a leaked key cannot be guessed."""
    safe_name = os.path.basename(filename) or "upload.bin"
    return f"uploads/{owner_id}/{uuid.uuid4().hex}_{safe_name}"


def _fileobj_size(fileobj: BinaryIO) -> int:
    current = fileobj.tell()
    fileobj.seek(0, os.SEEK_END)
    size = fileobj.tell()
    fileobj.seek(current)
    return size


async def upload_fileobj(
    owner_id: uuid.UUID,
    filename: str,
    fileobj: BinaryIO,
    content_type: str = "application/octet-stream",
) -> tuple[str, int]:
    """Stream a file into the bucket and return (object_key, size_in_bytes).

    `upload_fileobj` switches to multipart automatically for large files, so a
    multi-gigabyte dataset never has to be held in memory the way a plain
    `await file.read()` would.
    """
    key = build_object_key(owner_id, filename)

    def _put() -> int:
        size = _fileobj_size(fileobj)
        fileobj.seek(0)
        get_s3_client().upload_fileobj(
            fileobj,
            settings.s3_bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )
        return size

    size = await asyncio.to_thread(_put)
    return key, size


async def delete_object(key: str) -> None:
    def _delete() -> None:
        get_s3_client().delete_object(Bucket=settings.s3_bucket, Key=key)

    await asyncio.to_thread(_delete)


async def presigned_get_url(key: str, filename: str | None = None) -> str:
    """Time-limited download URL.

    Bytes travel bucket → client directly rather than through this API, which
    matters twice over on R2: the API process never buffers a multi-gigabyte
    dataset, and R2 charges nothing for the egress.
    """

    def _sign() -> str:
        params = {"Bucket": settings.s3_bucket, "Key": key}
        if filename:
            params["ResponseContentDisposition"] = f'attachment; filename="{filename}"'
        return get_s3_client().generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=settings.presigned_url_ttl_seconds,
        )

    return await asyncio.to_thread(_sign)


async def download_bytes(key: str) -> bytes:
    """Fetch a whole object into memory. Intended for small objects only —
    training containers should be handed a presigned URL and stream it
    themselves rather than routing gigabytes through this process."""

    def _get() -> bytes:
        response = get_s3_client().get_object(Bucket=settings.s3_bucket, Key=key)
        return response["Body"].read()

    return await asyncio.to_thread(_get)
