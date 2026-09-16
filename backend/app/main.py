import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, discover, files, jobs, kernels, notebooks, notifications, sdk, users
from app.core.config import get_settings
from app.core.storage import ensure_bucket
from app.services.job_reconciler import reconcile_running_jobs
from app.services.kernel_service import reap_idle_sessions

settings = get_settings()

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # MinIO starts with an empty volume locally; on R2 this is a cheap HEAD.
    await asyncio.to_thread(ensure_bucket)
    scheduler.add_job(reap_idle_sessions, "interval", minutes=1, id="reap_idle_kernels")
    # Catches jobs whose worker died mid-run: the provider finished them, but
    # nothing was left alive to record it. Runs on startup too, so a machine
    # coming back from shutdown settles its jobs immediately.
    scheduler.add_job(
        reconcile_running_jobs,
        "interval",
        minutes=1,
        id="reconcile_running_jobs",
        next_run_time=datetime.now(timezone.utc),
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(notebooks.router)
app.include_router(jobs.router)
app.include_router(files.router)
app.include_router(kernels.router)
app.include_router(notifications.router)
app.include_router(users.router)
app.include_router(sdk.router)
app.include_router(discover.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
