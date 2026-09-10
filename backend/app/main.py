from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, files, jobs, kernels, notebooks
from app.core.config import get_settings
from app.services.kernel_service import reap_idle_sessions

settings = get_settings()

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(reap_idle_sessions, "interval", minutes=1, id="reap_idle_kernels")
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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
