from app.core.redis import redis_settings
from app.workers.tasks import MAX_RUNTIME_SECONDS, run_job


class WorkerSettings:
    functions = [run_job]
    redis_settings = redis_settings()
    max_jobs = 4

    # arq's default job_timeout is 300s. run_job follows a job for its whole
    # life, so the default would cancel tracking five minutes in and leave any
    # longer job stuck at "running". Give it room to outlast the run itself.
    job_timeout = MAX_RUNTIME_SECONDS + 600

    # Each restart of this worker costs the in-flight job one attempt. With
    # reattach, a retry is cheap (it rejoins the existing run rather than
    # starting a new one), so allow many more than arq's default of 5 before
    # giving up on a job that is probably still running fine in the cloud.
    max_tries = 50
