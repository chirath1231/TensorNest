import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import async_session_maker
from app.core.security import create_sdk_token
from app.models.job import Job, JobCheckpoint
from app.providers.base import JobLaunchSpec, JobRunHandle
from app.providers.local_docker import LocalDockerProvider
from app.providers.modal_gpu import ModalGPUProvider
from app.sdk import sdk_source
from app.services import job_artifacts, notification_service

settings = get_settings()

logger = logging.getLogger(__name__)

PROVIDERS = {
    "local_cpu": LocalDockerProvider(),
    "modal_gpu": ModalGPUProvider(),
}

POLL_INTERVAL_SECONDS = 3
LOG_UPLOAD_INTERVAL_SECONDS = 15
MAX_RUNTIME_SECONDS = 60 * 60  # 1 hour safety cap for the local CPU provider


def job_workspace(job: Job) -> str:
    """Workspace path for a reattached run.

    Both providers derive their real paths from the job id rather than reading
    this field, so it exists for logging and future providers that may need it.
    """
    return f"jobs/{job.id}"


def _launch_spec(job: Job) -> JobLaunchSpec:
    """Everything the run needs in order to reach back into the platform.

    The dataset token is minted here rather than at submit time so a job that
    is retried after a worker restart gets a fresh one — the original would
    have been issued before however long the outage lasted.
    """
    remote = job.provider_type != "local_cpu"
    # A Modal sandbox runs on Modal's hardware and cannot resolve a Compose
    # service name. Without a public URL configured it still gets the internal
    # one, and the SDK's connection error explains why it failed.
    api_base_url = (
        (settings.public_api_base_url or settings.internal_api_base_url)
        if remote
        else settings.internal_api_base_url
    )

    return JobLaunchSpec(
        script_source=job.script_source,
        sdk_source=sdk_source(),
        sdk_token=create_sdk_token(
            job.owner_id, timedelta(seconds=MAX_RUNTIME_SECONDS + 3600)
        ),
        api_base_url=api_base_url,
        allow_network=job.allow_network,
    )


async def run_job(ctx: dict, job_id: str) -> None:
    job_uuid = UUID(job_id)
    async with async_session_maker() as db:
        result = await db.execute(select(Job).where(Job.id == job_uuid))
        job = result.scalar_one_or_none()
        if job is None:
            return

        provider = PROVIDERS.get(job.provider_type)
        if provider is None:
            job.status = "failed"
            job.error_message = f"Unknown provider_type: {job.provider_type}"
            job.finished_at = datetime.now(timezone.utc)
            await db.commit()
            await notification_service.notify_job_status(db, job)
            return

        job.status = "running"
        if job.started_at is None:
            job.started_at = datetime.now(timezone.utc)
        await db.commit()
        await notification_service.notify_job_status(db, job)

        if job.container_id:
            # This task is being retried — the worker was restarted, redeployed,
            # or crashed while the run was in flight. The run itself is owned by
            # the provider's scheduler, not by this process, so reattach to it.
            # Submitting again would start a second GPU sandbox and orphan the
            # first, which costs real money and loses the run we were tracking.
            handle = JobRunHandle(container_id=job.container_id, workspace_path=job_workspace(job))
            logger.info("Reattached to existing run %s for job %s", job.container_id, job.id)
        else:
            try:
                run_handle = await provider.submit_job(job.id, _launch_spec(job))
                job.container_id = run_handle.container_id
                await db.commit()
            except Exception as exc:  # noqa: BLE001
                job.status = "failed"
                job.error_message = str(exc)
                job.finished_at = datetime.now(timezone.utc)
                await db.commit()
                await notification_service.notify_job_status(db, job)
                return
            handle = JobRunHandle(
                container_id=run_handle.container_id, workspace_path=run_handle.workspace_path
            )
        elapsed = 0
        final_state = "failed"
        logs = ""
        since_log_upload = 0
        while elapsed < MAX_RUNTIME_SECONDS:
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            elapsed += POLL_INTERVAL_SECONDS
            since_log_upload += POLL_INTERVAL_SECONDS

            status_result = await provider.get_status(handle)
            logs = await provider.stream_logs(handle)

            # Snapshot to the bucket periodically rather than every poll: a
            # long run would otherwise rewrite the whole log thousands of times.
            # The final write below is what guarantees completeness.
            if since_log_upload >= LOG_UPLOAD_INTERVAL_SECONDS:
                since_log_upload = 0
                await _safe_put_logs(job_uuid, logs)

            if status_result.state != "running":
                final_state = status_result.state
                break
        else:
            await provider.cancel(handle)
            logs = await provider.stream_logs(handle)
            final_state = "failed"

        # Persist the complete log and the run's outputs before the container is
        # reaped — after this point the bucket is the only copy.
        await _safe_put_logs(job_uuid, logs)
        checkpoint_names = await _safe_collect(provider, job_uuid, handle)

        result = await db.execute(select(Job).where(Job.id == job_uuid))
        job = result.scalar_one_or_none()
        if job is None:
            return
        for name in checkpoint_names:
            db.add(
                JobCheckpoint(
                    job_id=job.id,
                    path=job_artifacts.checkpoint_key(job.id, name),
                    metrics={},
                )
            )
        job.status = final_state
        job.progress = 1.0 if final_state == "succeeded" else job.progress
        job.finished_at = datetime.now(timezone.utc)
        await db.commit()
        await notification_service.notify_job_status(db, job)


async def send_notification_email(ctx: dict, notification_id: str) -> None:
    """Deliver one notification email.

    Queued rather than sent inline so that a slow mail server cannot hold up
    recording a job's outcome. Failures raise, which is what lets arq retry
    them — a mail server that is down for a minute should not silently cost
    the user the one message telling them their training finished.
    """
    await notification_service.deliver(UUID(notification_id))


async def _safe_put_logs(job_id: UUID, logs: str) -> None:
    """Never let a storage hiccup fail an otherwise-successful job."""
    try:
        await job_artifacts.put_logs(job_id, logs)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to upload logs for job %s", job_id)


async def _safe_collect(provider, job_id: UUID, handle: JobRunHandle) -> list[str]:
    try:
        return await provider.collect_artifacts(job_id, handle)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to collect artifacts for job %s", job_id)
        return []
