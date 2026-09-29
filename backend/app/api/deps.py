from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import decode_token
from app.models.user import User

bearer_scheme = HTTPBearer()


async def _user_for_token(
    credentials: HTTPAuthorizationCredentials, db: AsyncSession, accepted: set[str]
) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise unauthorized from exc

    if payload.get("type") not in accepted:
        raise unauthorized

    user_id = payload.get("sub")
    if user_id is None:
        raise unauthorized

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise unauthorized
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await _user_for_token(credentials, db, {"access"})


async def get_sdk_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate a kernel or job container calling back in through the SDK.

    Accepts the long-lived `sdk` token those containers are issued, and also a
    normal access token so the endpoints stay usable from a browser or curl
    while debugging. Kept separate from `get_current_user` so that the sdk
    token unlocks these read-only routes and nothing else.
    """
    return await _user_for_token(credentials, db, {"sdk", "access"})
