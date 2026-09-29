"""Finalises jobs whose tracking task did not survive.

`run_job` follows a job by holding a coroutine open for the whole run. That is
fine while the worker lives, but the worker is the *least* durable part of the
system: it is on a laptop that gets closed, redeployed, or killed. The run
itself is owned by the provider's scheduler and carries on regardless.

So tracking cannot be the only path to a final status. This sweep runs on a
timer and reconciles reality: for every job still marked running, ask the
provider what actually happened, and if it has finished, persist the logs,
collect the artifacts, and record the outcome.

Without it, shutting the machine down mid-run leaves a job stuck at "running"
forever even though it completed successfully in the cloud — which would defeat
the point of running jobs off the browser session in the first place.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.db import async_session_maker
from app.models.job import Job, JobCheckpoint
from app.providers.base import JobRunHandle
from app.services import job_artifacts, notification_service

logger = logging.getLogger(__name__)


async def reconcile_running_jobs() -> None:
    from app.workers.tasks import PROVIDERS

    async with async_session_maker() as db:
        result = await db.execute(
            select(Job).where(Job.status == "running", Job.container_id.isnot(None))
        )
        jobs = list(result.scalars().all())

    for job in jobs:
        try:
            await _reconcile_one(job.id)
        except Exception:  # noqa: BLE001 — one bad job must not stop the sweep
            logger.exception("Reconcile failed for job %s", job.id)


async def _reconcile_one(job_id) -> None:
    from app.workers.tasks import PROVIDERS

    async with async_session_maker() as db:
        job = await db.get(Job, job_id)
        # Re-read under a fresh session: the worker may have finalised it
        # between the sweep listing and now.
        if job is None or job.status != "running" or not job.container_id:
            return

        provider = PROVIDERS.get(job.provider_type)
        if provider is None:
            return

        handle = JobRunHandle(container_id=job.container_id, workspace_path="")
        status = await provider.get_status(handle)
        if status.state == "running":
            return

        logger.info("Reconciling job %s: provider reports %s", job.id, status.state)

        try:
            logs = await provider.stream_logs(handle)
            if logs:
                await job_artifacts.put_logs(job.id, logs)
        except Exception:  # noqa: BLE001
            logger.exception("Reconcile: could not persist logs for %s", job.id)

        collected: list[str] = []
        try:
            collected = await provider.collect_artifacts(job.id, handle)
        except Exception:  # noqa: BLE001
            logger.exception("Reconcile: could not collect artifacts for %s", job.id)

        job = await db.get(Job, job_id)
        if job is None or job.status != "running":
            return

        if collected:
            existing = await db.execute(
                select(JobCheckpoint.path).where(JobCheckpoint.job_id == job.id)
            )
            known = set(existing.scalars().all())
            for name in collected:
                key = job_artifacts.checkpoint_key(job.id, name)
                if key not in known:
                    db.add(JobCheckpoint(job_id=job.id, path=key, metrics={}))

        job.status = status.state
        job.progress = 1.0 if status.state == "succeeded" else job.progress
        job.finished_at = datetime.now(timezone.utc)
        await db.commit()
        # This is the path that runs when the machine was shut down mid-run, so
        # it is the one that has to send the outcome email — there is no
        # tracking task left alive to do it.
        await notification_service.notify_job_status(db, job)
        logger.info("Reconciled job %s -> %s (%d checkpoints)", job.id, status.state, len(collected))
