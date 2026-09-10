from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "TensorNest"
    environment: str = "development"

    database_url: str = "postgresql+asyncpg://tensornest:tensornest@postgres:5432/tensornest"
    redis_url: str = "redis://redis:6379/0"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    storage_root: str = "/storage"
    # Absolute path on the Docker *host* that maps to storage_root above. Needed
    # because the backend/worker containers ask the host's Docker daemon to spin
    # up sibling containers (docker-outside-of-docker), and bind mounts for those
    # sibling containers must be specified using host paths, not paths inside the
    # backend container itself.
    storage_host_root: str = "./storage"

    docker_network: str = "tensornest_default"
    kernel_image: str = "tensornest-kernel:latest"
    kernel_idle_timeout_minutes: int = 30
    kernel_cpu_limit: float = 1.0
    kernel_memory_limit: str = "2g"

    job_cpu_limit: float = 1.0
    job_memory_limit: str = "2g"

    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
