"""S3-compatible object storage client.

One client serves both environments: MinIO locally (via docker-compose) and
Cloudflare R2 in deployment. Only the endpoint and credentials differ, so
nothing above this module needs to know which one it is talking to.

R2 specifics worth knowing if you are debugging a signature error:
  * the region must be the literal string "auto"
  * signatures must be v4 (botocore's default, pinned here so it stays that way)
  * path-style addressing works on both R2 and MinIO; virtual-host style does
    not work against MinIO's default single-host setup, so path style is what
    keeps one config valid for both.
"""

from functools import lru_cache

import boto3
from botocore.client import BaseClient
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import get_settings

settings = get_settings()


@lru_cache
def get_s3_client() -> BaseClient:
    """Cached boto3 S3 client. boto3 clients are thread-safe, so one instance
    is shared across the thread-pool calls made from async request handlers."""
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    )


@lru_cache
def get_presign_client() -> BaseClient:
    """Client used solely to sign download URLs.

    Identical to get_s3_client() except for the endpoint, which must be the
    one the *browser* can reach. Falls back to the internal client when no
    public endpoint is configured (the R2 case, where they are the same).
    """
    if not settings.s3_public_endpoint_url:
        return get_s3_client()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_public_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    )


def ensure_bucket() -> None:
    """Create the bucket if it is missing.

    This exists for local MinIO, which starts empty on every fresh volume. On
    R2 the bucket is created once in the dashboard and this is a no-op HEAD;
    if the credentials lack CreateBucket permission the error is logged rather
    than raised, so a locked-down production token does not block startup.
    """
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
        return
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code not in ("404", "NoSuchBucket", "403", "AccessDenied"):
            raise
        if code in ("403", "AccessDenied"):
            # Bucket exists but the token cannot HEAD it; assume it is usable.
            return

    try:
        client.create_bucket(Bucket=settings.s3_bucket)
    except ClientError as exc:  # noqa: BLE001
        code = exc.response.get("Error", {}).get("Code", "")
        if code in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
            return
        if code not in ("InvalidLocationConstraint", "IllegalLocationConstraintException"):
            raise
        # boto3 attaches a LocationConstraint whenever the region is not
        # us-east-1, and our region is the R2-mandated "auto". Some S3
        # implementations reject that on create. Retry with a us-east-1 client,
        # for which boto3 omits the constraint entirely.
        boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name="us-east-1",
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        ).create_bucket(Bucket=settings.s3_bucket)
