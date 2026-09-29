"""Job outputs — logs and checkpoints — stored in the object bucket.

These used to live on a local volume, which works only while the job runs on
this host. A remote GPU provider (Modal) has no access to that volume, so
anything a job produces has to end up somewhere both the job's executor and this
API can reach. The bucket is that place.

Key layout mirrors the job's identity, so everything for one run shares a prefix
and can be listed or lifecycle-expired together:

    jobs/<job_id>/logs.txt
    jobs/<job_id>/checkpoints/<filename>
"""

import asyncio
from uuid import UUID

from botocore.exceptions import ClientError

from app.core.config import get_settings
from app.core.storage import get_presign_client, get_s3_client

settings = get_settings()


def logs_key(job_id: UUID) -> str:
    return f"jobs/{job_id}/logs.txt"


def checkpoint_prefix(job_id: UUID) -> str:
    return f"jobs/{job_id}/checkpoints/"


def checkpoint_key(job_id: UUID, name: str) -> str:
    return f"{checkpoint_prefix(job_id)}{name}"


async def put_logs(job_id: UUID, text: str) -> None:
    """Overwrite the job's log object with the full log so far."""

    def _put() -> None:
        get_s3_client().put_object(
            Bucket=settings.s3_bucket,
            Key=logs_key(job_id),
            Body=text.encode("utf-8", errors="replace"),
            ContentType="text/plain; charset=utf-8",
        )

    await asyncio.to_thread(_put)


async def get_logs(job_id: UUID) -> str:
    """Return the stored log, or empty string if the job has not written one."""

    def _get() -> str:
        try:
            resp = get_s3_client().get_object(Bucket=settings.s3_bucket, Key=logs_key(job_id))
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
                return ""
            raise
        return resp["Body"].read().decode("utf-8", errors="replace")

    return await asyncio.to_thread(_get)


async def put_checkpoint(job_id: UUID, name: str, data: bytes) -> str:
    key = checkpoint_key(job_id, name)

    def _put() -> None:
        get_s3_client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=data,
            ContentType="application/octet-stream",
        )

    await asyncio.to_thread(_put)
    return key


async def list_checkpoints(job_id: UUID) -> list[dict]:
    """Checkpoint objects for a job, oldest first."""
    prefix = checkpoint_prefix(job_id)

    def _list() -> list[dict]:
        client = get_s3_client()
        found: list[dict] = []
        token = None
        while True:
            kwargs = {"Bucket": settings.s3_bucket, "Prefix": prefix}
            if token:
                kwargs["ContinuationToken"] = token
            resp = client.list_objects_v2(**kwargs)
            for obj in resp.get("Contents", []):
                found.append(
                    {
                        "name": obj["Key"][len(prefix):],
                        "size": obj["Size"],
                        "modified": obj["LastModified"].isoformat(),
                    }
                )
            if not resp.get("IsTruncated"):
                break
            token = resp.get("NextContinuationToken")
        return sorted(found, key=lambda c: c["modified"])

    return await asyncio.to_thread(_list)


async def presigned_checkpoint_url(job_id: UUID, name: str) -> str:
    def _sign() -> str:
        return get_presign_client().generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.s3_bucket,
                "Key": checkpoint_key(job_id, name),
                "ResponseContentDisposition": f'attachment; filename="{name}"',
            },
            ExpiresIn=settings.presigned_url_ttl_seconds,
        )

    return await asyncio.to_thread(_sign)
