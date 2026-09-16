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

    # --- Object storage (S3-compatible) ---------------------------------
    # User uploads live in a bucket, not on this host's disk, because the GPU
    # providers that run jobs (Modal first) execute on machines that cannot see
    # this filesystem — they can only fetch a dataset over the network.
    # Defaults below point at the MinIO container in docker-compose; production
    # points them at Cloudflare R2. Same S3 API either way, so only these five
    # values change between environments.
    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key_id: str = "tensornest"
    s3_secret_access_key: str = "tensornest123"
    s3_bucket: str = "tensornest"
    # Endpoint used only for *presigned* URLs, which are opened by a browser
    # on the host rather than from inside this container. With local MinIO the
    # two differ: the backend reaches it at http://minio:9000, but that name
    # does not resolve outside Docker, so a URL signed for it is unopenable.
    # The host header is part of the signature, so the URL has to be signed
    # against the public name -- rewriting it afterwards invalidates it.
    # Empty means "same as s3_endpoint_url", which is correct for R2.
    s3_public_endpoint_url: str = ""
    s3_region: str = "auto"  # R2 requires the literal "auto"
    # Downloads are handed out as time-limited presigned URLs so that bytes go
    # straight from the bucket to the client (or to a training container)
    # without being proxied through this API.
    presigned_url_ttl_seconds: int = 3600

    # --- Modal (remote GPU provider) -------------------------------------
    # Tokens come from modal.com > Settings > API Tokens. The Modal client
    # reads MODAL_TOKEN_ID / MODAL_TOKEN_SECRET from the environment, which
    # takes precedence over any ~/.modal.toml, so these are all it needs.
    modal_token_id: str = ""
    modal_token_secret: str = ""
    modal_app_name: str = "tensornest"
    modal_volume_name: str = "tensornest-jobs"
    # Modal GPU type: "T4", "L4", "A10G", "L40S", "A100", "H100", or "any".
    # T4 is the cheapest, so the $30/month free credit goes furthest there.
    modal_gpu: str = "T4"
    # Hard ceiling Modal enforces is 24h; keep the default well under it so a
    # runaway job cannot burn the whole month's credit.
    modal_timeout_seconds: int = 3600
    modal_pip_packages: list[str] = ["torch", "numpy", "pandas", "scikit-learn"]

    # --- Email notifications (SMTP) --------------------------------------
    # Job outcomes are emailed because the whole point of running training
    # off the browser session is that you can close the laptop — so the
    # result has to reach you somewhere other than the tab you left.
    #
    # With Gmail, smtp_password must be a 16-character App Password
    # (Google Account > Security > 2-Step Verification > App passwords).
    # Google rejects the account password itself on SMTP, so a normal
    # password fails authentication no matter how correct it looks.
    #
    # Leaving smtp_host empty disables email; the in-app notification
    # centre still records everything.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    # Gmail ignores a From that isn't the authenticated account, so this
    # defaults to smtp_username rather than being separately required.
    smtp_from_email: str = ""
    smtp_from_name: str = "TensorNest"
    # Port 587 opens in the clear and upgrades with STARTTLS; port 465
    # expects TLS from the first byte. Anything else is server-specific.
    smtp_use_ssl: bool = False
    smtp_timeout_seconds: int = 20

    # Base URL that links in notification emails point at. It is resolved
    # in the recipient's mail client, not in a container, so localhost only
    # works while you are reading mail on the machine running the stack.
    frontend_base_url: str = "http://localhost:3000"

    # --- In-container SDK ------------------------------------------------
    # How a kernel or job container reaches this API to resolve a dataset.
    # Containers on the Compose network reach it by service name; "localhost"
    # inside a container is the container itself, so it can never be that.
    internal_api_base_url: str = "http://backend:8000"
    # A Modal sandbox runs on Modal's hardware and cannot see the Compose
    # network at all, so remote jobs need a URL reachable from the internet —
    # a tunnel while developing, or a real deployment. Empty means remote jobs
    # fall back to the internal URL, where tn.load() will fail with a message
    # saying exactly this.
    public_api_base_url: str = ""
    # Lifetime of the dataset-read token handed to a kernel. Long enough to
    # outlive a working session; a kernel is reaped after 30 idle minutes
    # anyway, and restarting it issues a fresh one.
    sdk_token_hours: int = 12

    storage_root: str = "/storage"
    # Name of the Docker volume mounted at storage_root. The backend and worker
    # ask the *host's* daemon to start sibling job containers, so those
    # containers cannot be given a path from inside this container — and a host
    # bind path is not portable (it differs per machine, and Docker Desktop has
    # to translate Windows paths). A named volume sidesteps both: every
    # container mounts the same volume at the same path, so /storage/jobs/<id>
    # means the same thing everywhere.
    storage_volume: str = "tensornest_storage"

    docker_network: str = "tensornest_default"
    kernel_image: str = "tensornest-kernel:latest"
    kernel_idle_timeout_minutes: int = 30
    kernel_cpu_limit: float = 1.0
    kernel_memory_limit: str = "2g"

    job_cpu_limit: float = 1.0
    job_memory_limit: str = "2g"

    cors_origins: list[str] = ["http://localhost:3000"]

    @property
    def email_enabled(self) -> bool:
        return bool(self.smtp_host)

    @property
    def email_sender(self) -> str:
        return self.smtp_from_email or self.smtp_username


@lru_cache
def get_settings() -> Settings:
    return Settings()
