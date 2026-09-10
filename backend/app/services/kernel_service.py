import asyncio
import time
import uuid
from datetime import datetime, timedelta, timezone

import docker
import httpx
from docker.errors import NotFound
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import async_session_maker
from app.models.kernel_session import KernelSession
from app.models.notebook import Notebook

settings = get_settings()

GATEWAY_PORT = 8888
STARTUP_TIMEOUT_SECONDS = 30
STARTUP_POLL_INTERVAL = 0.5


def _client() -> docker.DockerClient:
    return docker.from_env()


async def get_or_create_session(db: AsyncSession, notebook: Notebook) -> KernelSession:
    result = await db.execute(
        select(KernelSession)
        .where(KernelSession.notebook_id == notebook.id, KernelSession.status == "running")
        .order_by(KernelSession.created_at.desc())
    )
    session = result.scalars().first()
    if session is not None:
        session.last_activity = datetime.now(timezone.utc)
        await db.commit()
        return session

    return await _create_session(db, notebook)


async def _create_session(db: AsyncSession, notebook: Notebook) -> KernelSession:
    container_name = f"tensornest-kernel-{uuid.uuid4().hex[:12]}"

    def _run() -> str:
        client = _client()
        client.containers.run(
            settings.kernel_image,
            command=[
                "jupyter",
                "kernelgateway",
                "--KernelGatewayApp.ip=0.0.0.0",
                f"--KernelGatewayApp.port={GATEWAY_PORT}",
                "--KernelGatewayApp.allow_origin=*",
            ],
            name=container_name,
            network=settings.docker_network,
            nano_cpus=int(settings.kernel_cpu_limit * 1e9),
            mem_limit=settings.kernel_memory_limit,
            detach=True,
        )
        return container_name

    await asyncio.to_thread(_run)

    internal_base_url = f"http://{container_name}:{GATEWAY_PORT}"
    kernel_id = await _wait_for_gateway_and_start_kernel(internal_base_url)

    session = KernelSession(
        notebook_id=notebook.id,
        container_id=container_name,
        container_name=container_name,
        internal_base_url=internal_base_url,
        kernel_id=kernel_id,
        status="running",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def _wait_for_gateway_and_start_kernel(base_url: str) -> str:
    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    async with httpx.AsyncClient(timeout=5.0) as client:
        while time.monotonic() < deadline:
            try:
                resp = await client.post(f"{base_url}/api/kernels", json={"name": "python3"})
                if resp.status_code == 201:
                    return resp.json()["id"]
            except httpx.HTTPError:
                pass
            await asyncio.sleep(STARTUP_POLL_INTERVAL)
    raise RuntimeError("Kernel gateway container did not become ready in time")


async def stop_session(db: AsyncSession, session: KernelSession) -> None:
    def _stop() -> None:
        client = _client()
        try:
            container = client.containers.get(session.container_id)
            container.stop(timeout=5)
            container.remove(force=True)
        except NotFound:
            pass

    await asyncio.to_thread(_stop)
    session.status = "stopped"
    await db.commit()


async def reap_idle_sessions() -> None:
    """Periodic sweep: stop kernel containers that have had no activity for
    longer than the configured idle timeout."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.kernel_idle_timeout_minutes)
    async with async_session_maker() as db:
        result = await db.execute(
            select(KernelSession).where(KernelSession.status == "running", KernelSession.last_activity < cutoff)
        )
        idle_sessions = list(result.scalars().all())
        for session in idle_sessions:
            await stop_session(db, session)


async def touch_session(db: AsyncSession, session: KernelSession) -> None:
    session.last_activity = datetime.now(timezone.utc)
    await db.commit()


async def mark_session_dead(db: AsyncSession, session: KernelSession) -> None:
    """Called when the WS proxy can't reach a session's kernel container
    (e.g. it crashed or was reclaimed out-of-band). Marks it stopped so the
    next connect attempt spins up a fresh container instead of retrying a
    session that will never come back."""
    if session.status != "running":
        return

    def _remove() -> None:
        client = _client()
        try:
            client.containers.get(session.container_id).remove(force=True)
        except NotFound:
            pass

    await asyncio.to_thread(_remove)
    session.status = "stopped"
    await db.commit()
