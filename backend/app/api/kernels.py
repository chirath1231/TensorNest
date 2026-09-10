import asyncio
import logging
from uuid import UUID

import websockets
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.security import decode_token
from app.models.kernel_session import KernelSession
from app.models.notebook import Notebook
from app.models.user import User
from app.services import kernel_service, notebook_service

router = APIRouter(tags=["kernels"])
logger = logging.getLogger(__name__)


@router.post("/notebooks/{notebook_id}/kernel")
async def start_kernel(
    notebook_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    notebook = await notebook_service.get_notebook(db, current_user, notebook_id)
    session = await kernel_service.get_or_create_session(db, notebook)
    return {
        "session_id": str(session.id),
        "status": session.status,
        "ws_path": f"/ws/kernels/{session.id}",
    }


@router.delete("/notebooks/{notebook_id}/kernel", status_code=status.HTTP_204_NO_CONTENT)
async def stop_kernel(
    notebook_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    notebook = await notebook_service.get_notebook(db, current_user, notebook_id)
    result = await db.execute(
        select(KernelSession).where(KernelSession.notebook_id == notebook.id, KernelSession.status == "running")
    )
    for session in result.scalars().all():
        await kernel_service.stop_session(db, session)


@router.websocket("/ws/kernels/{session_id}")
async def kernel_ws_proxy(websocket: WebSocket, session_id: UUID, token: str) -> None:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("wrong token type")
        user_id = UUID(payload["sub"])
    except (ValueError, KeyError):
        await websocket.close(code=4401)
        return

    async with _db_session() as db:
        result = await db.execute(
            select(KernelSession, Notebook)
            .join(Notebook, Notebook.id == KernelSession.notebook_id)
            .where(KernelSession.id == session_id)
        )
        row = result.first()
        if row is None:
            await websocket.close(code=4404)
            return
        session, notebook = row
        if notebook.owner_id != user_id:
            await websocket.close(code=4403)
            return
        if session.status != "running":
            await websocket.close(code=4409)
            return
        upstream_url = (
            f"ws://{session.container_name}:8888/api/kernels/{session.kernel_id}/channels"
        )
        await kernel_service.touch_session(db, session)

    await websocket.accept()

    try:
        async with websockets.connect(upstream_url, max_size=None) as upstream:
            await asyncio.gather(
                _relay_client_to_upstream(websocket, upstream),
                _relay_upstream_to_client(upstream, websocket),
            )
    except (WebSocketDisconnect, websockets.exceptions.ConnectionClosed):
        pass
    except Exception:
        logger.exception(
            "Kernel WS proxy failed for session %s (upstream=%s)", session_id, upstream_url
        )
        async with _db_session() as db:
            dead_session = await db.get(KernelSession, session_id)
            if dead_session is not None:
                await kernel_service.mark_session_dead(db, dead_session)
        await websocket.close(code=1011)


async def _relay_client_to_upstream(client_ws: WebSocket, upstream) -> None:
    try:
        while True:
            message = await client_ws.receive_text()
            await upstream.send(message)
    except WebSocketDisconnect:
        await upstream.close()


async def _relay_upstream_to_client(upstream, client_ws: WebSocket) -> None:
    try:
        async for message in upstream:
            await client_ws.send_text(message)
    except websockets.exceptions.ConnectionClosed:
        await client_ws.close()


def _db_session():
    from app.core.db import async_session_maker

    return async_session_maker()
