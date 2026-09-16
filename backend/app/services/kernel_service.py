import asyncio
import time
import uuid
from datetime import datetime, timedelta, timezone

import docker
import httpx
from docker.errors import ImageNotFound, NotFound
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import async_session_maker
from app.core.security import create_sdk_token
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


SDK_DIR = "/opt/tensornest"

# Pull the SDK from the API before starting the gateway, so `import tensornest`
# resolves in the first cell the user runs. Fetching beats baking it into the
# image: the kernel image is ~2 GB and rebuilding it to change a client-side
# helper is a poor trade. `|| true` keeps a backend hiccup from costing the user
# their whole kernel — they lose tn.load(), not the notebook, and the SDK says
# so if they call it.
_BOOTSTRAP = (
    "mkdir -p {sdk_dir} && "
    "python -c \"import urllib.request;"
    "urllib.request.urlretrieve('{api}/sdk/tensornest.py','{sdk_dir}/tensornest.py')\" || true; "
    "exec jupyter kernelgateway "
    "--KernelGatewayApp.ip=0.0.0.0 "
    "--KernelGatewayApp.port={port} "
    "--KernelGatewayApp.allow_origin='*'"
)


async def _create_session(db: AsyncSession, notebook: Notebook) -> KernelSession:
    container_name = f"tensornest-kernel-{uuid.uuid4().hex[:12]}"
    sdk_token = create_sdk_token(
        notebook.owner_id, timedelta(hours=settings.sdk_token_hours)
    )

    def _run() -> str:
        client = _client()
        # containers.run() silently falls back to pulling when the image is
        # missing locally, and tensornest-kernel is built, never published — so
        # the pull fails with an unhelpful "pull access denied". Check first and
        # say what actually needs doing.
        try:
            client.images.get(settings.kernel_image)
        except ImageNotFound:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    f"Kernel image '{settings.kernel_image}' is not built. "
                    f"Run: docker compose build kernel-image"
                ),
            ) from None
        client.containers.run(
            settings.kernel_image,
            command=[
                "sh",
                "-c",
                _BOOTSTRAP.format(
                    sdk_dir=SDK_DIR,
                    api=settings.internal_api_base_url.rstrip("/"),
                    port=GATEWAY_PORT,
                ),
            ],
            environment={
                "PYTHONPATH": SDK_DIR,
                "TENSORNEST_API_URL": settings.internal_api_base_url,
                "TENSORNEST_TOKEN": sdk_token,
            },
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
