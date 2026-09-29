from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _create_token(
    subject: UUID, token_type: Literal["access", "refresh", "sdk"], expires_delta: timedelta
) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": str(subject), "type": token_type, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: UUID) -> str:
    return _create_token(subject, "access", timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(subject: UUID) -> str:
    return _create_token(subject, "refresh", timedelta(days=settings.refresh_token_expire_days))


def create_sdk_token(subject: UUID, expires_delta: timedelta) -> str:
    """Token handed to a kernel or job container so the SDK can read datasets.

    A separate type rather than a long-lived access token: this one lives in an
    environment variable inside a container running the user's own code, where
    anything it can do is effectively public to that code. `get_sdk_user` is the
    only dependency that accepts it, so its reach stops at reading datasets —
    it cannot submit jobs, edit notebooks, or touch the account.

    The caller sets the lifetime, because a kernel and a twelve-hour training
    run need very different ones.
    """
    return _create_token(subject, "sdk", expires_delta)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
