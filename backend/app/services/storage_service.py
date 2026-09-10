import os
import uuid

from app.core.config import get_settings

settings = get_settings()


def user_upload_dir(user_id: uuid.UUID) -> str:
    path = os.path.join(settings.storage_root, "uploads", str(user_id))
    os.makedirs(path, exist_ok=True)
    return path


def save_upload(user_id: uuid.UUID, filename: str, data: bytes) -> str:
    directory = user_upload_dir(user_id)
    safe_name = f"{uuid.uuid4().hex}_{os.path.basename(filename)}"
    full_path = os.path.join(directory, safe_name)
    with open(full_path, "wb") as f:
        f.write(data)
    return full_path


def delete_file(path: str) -> None:
    if os.path.exists(path):
        os.remove(path)
