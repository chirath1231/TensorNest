from app.core.redis import redis_settings
from app.workers.tasks import run_job


class WorkerSettings:
    functions = [run_job]
    redis_settings = redis_settings()
    max_jobs = 4
