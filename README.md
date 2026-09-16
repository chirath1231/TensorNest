# TensorNest

A cloud ML training platform where **training jobs keep running after you close the browser**.

On Google Colab and Kaggle, training is tied to a notebook session: close the tab, lose the connection, or let your laptop sleep, and the run eventually dies. TensorNest decouples the job from the session. You submit a training script, it runs on a remote GPU owned by the provider's scheduler, and when you come back — an hour later, after a reboot — the status, logs and checkpoints are waiting.

> **Status:** early research prototype. The core loop works end to end and has been verified on a real Tesla T4. See [Known limitations](#known-limitations) before relying on it.

---

## How it works

```
                  Browser (Next.js)
                        │
                        ▼
              ┌───────────────────┐        ┌──────────────┐
              │  FastAPI backend  │◀──────▶│  PostgreSQL  │
              │  job management   │        └──────────────┘
              └─────────┬─────────┘
                        │ enqueue           ┌──────────────┐
                        ▼                   │    Redis     │
              ┌───────────────────┐◀───────▶│  (arq queue) │
              │    arq worker     │         └──────────────┘
              └─────────┬─────────┘
                        │ ComputeProvider
            ┌───────────┴────────────┐
            ▼                        ▼
   ┌─────────────────┐     ┌──────────────────┐
   │  Local Docker   │     │    Modal GPU     │
   │  (CPU, free)    │     │  (T4 … H100)     │
   └────────┬────────┘     └────────┬─────────┘
            │                       │
            └───────────┬───────────┘
                        ▼
              ┌───────────────────┐
              │   Object storage  │   datasets · notebooks
              │  (Cloudflare R2)  │   logs · checkpoints
              └───────────────────┘
```

Three ideas carry the design:

**Providers own the job, not the backend.** Every compute backend implements `ComputeProvider` (`backend/app/providers/base.py`). Once a job is submitted, the backend keeps only a handle — a container id or a Modal sandbox id. The run is not attached to any process of ours.

**Everything a job touches lives in object storage.** A remote GPU cannot read this machine's disk, so datasets, exported notebooks, logs and checkpoints all go to an S3-compatible bucket, keyed per job:

```
uploads/<user_id>/<random>_<filename>
notebooks/<user_id>/<notebook_id>.ipynb
jobs/<job_id>/logs.txt
jobs/<job_id>/checkpoints/<filename>
```

**Tracking can die; the outcome still gets recorded.** The worker follows a job while it runs, but the worker is the least durable part of the system. A reconciler (`backend/app/services/job_reconciler.py`) sweeps every minute — and once at startup — asking each provider what actually happened to jobs still marked `running`, then persists their logs and checkpoints. A worker restart reattaches to the existing run rather than starting a second one.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind, Monaco editor, dnd-kit, framer-motion |
| API | FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2 |
| Queue | arq on Redis |
| Database | PostgreSQL 16 |
| Notebook kernels | Jupyter Kernel Gateway in per-notebook Docker containers |
| Object storage | Cloudflare R2 (MinIO locally, same S3 API) |
| GPU compute | Modal Sandboxes |

---

## Quick start

### Prerequisites

- **Docker Desktop**, running
- **Git**
- Optional: a [Cloudflare R2](https://dash.cloudflare.com) bucket and a [Modal](https://modal.com) account. Neither is needed to boot the stack.

### 1. Configure

```bash
cp .env.example .env              # PowerShell: copy .env.example .env
```

Copied as-is, `.env` boots a working local stack. Edit two things:

- **`JWT_SECRET`** — generate one:
  ```bash
  openssl rand -hex 32                                              # Git Bash / macOS / Linux
  python -c "import secrets; print(secrets.token_hex(32))"          # PowerShell
  ```
- **`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`** — any values you like. These are the single source of truth: Compose builds `DATABASE_URL` from them, so do **not** set `DATABASE_URL` yourself.

Every variable is documented inline in `.env.example`.

### 2. Start

```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

The first build is slow — the notebook kernel image installs PyTorch. Later builds are cached.

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |

### 3. Verify

Register an account, open **Jobs**, leave **Local CPU** selected and submit the sample script. It should go `queued → running → succeeded` within about ten seconds, with logs and five checkpoints.

---

## Enabling cloud storage (Cloudflare R2)

Without this block, storage falls back to the local MinIO container — fine for development, but a remote GPU can't reach it. MinIO sits behind the `local-storage` Compose profile, which `.env.example` enables via `COMPOSE_PROFILES=local-storage`. Once `S3_*` points at R2, delete that line so the container stops starting.

1. In the Cloudflare dashboard, open **R2** and create a bucket (e.g. `tensornest`).
2. Copy the **S3 API** URL from the bucket's settings, **removing the bucket name from the end**. You want exactly `https://<account-id>.r2.cloudflarestorage.com`.
3. **R2 › Manage R2 API Tokens › Create API Token.** Choose an **Account** API token (a User token stops working if that person leaves the account), permission **Object Read & Write**, scoped to your one bucket.
4. Fill in `.env`:
   ```
   S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   S3_BUCKET=tensornest
   S3_REGION=auto
   ```
5. `docker compose up -d backend worker`

Ignore the "Token value" Cloudflare also shows — that is for Cloudflare's own REST API, not the S3 API.

## Enabling GPU jobs (Modal)

1. Sign up at [modal.com](https://modal.com).
2. **Settings › API Tokens › New Token.** Use your own; usage bills against the token owner.
3. Add to `.env`:
   ```
   MODAL_TOKEN_ID=ak-...
   MODAL_TOKEN_SECRET=as-...
   MODAL_GPU=T4
   ```
4. `docker compose up -d backend worker`

The job form now offers **Modal GPU (Tesla T4)**.

> **Credit:** a new Modal account starts with **$1**, and unlocks the full $30/month only after a payment method is added. $1 is roughly 1.7 hours of T4 time — enough to verify the integration, not to train a real model.

---

## Enabling email notifications (Gmail)

The notification bell in the header always works. Email is what makes it useful for jobs that outlive your session — a run you started before closing the laptop reports its result without you watching a tab.

Gmail requires an **App password**, not your account password. Google rejects the account password on SMTP no matter how correct it is, failing with `535 Username and Password not accepted`.

1. Turn on [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification) — App passwords do not exist without it.
2. Create one at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). Choose **Mail** and any device name.
3. Google shows 16 characters as `abcd efgh ijkl mnop`. Add to `.env` **with the spaces removed and no quotes**:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=you@gmail.com
   SMTP_PASSWORD=abcdefghijklmnop
   ```
4. `docker compose up -d backend worker`
5. Open the notification bell and click **Send a test email**. It reports the SMTP error directly if anything is wrong, rather than leaving it in the worker log.

You are emailed when a job **starts running**, **finishes successfully**, and **fails**. Each event is sent at most once, including when a job is finalised by the reconciler after a restart.

For a provider that wants implicit TLS rather than STARTTLS, set `SMTP_PORT=465` and `SMTP_USE_SSL=true`. Set `FRONTEND_BASE_URL` if the **View job** link in an email should point somewhere other than `http://localhost:3000`.

---

## Using the platform

### Notebooks

Interactive Python with PyTorch 2.4 (CPU), NumPy, pandas, scikit-learn and matplotlib. Run a cell with **Ctrl+Enter**. The first run starts a kernel container, so allow a few seconds.

Notebooks are **session-bound by design** — for interactive work. Close the tab and the kernel is reaped after 30 minutes idle. For anything that must outlive the session, submit a job.

`POST /notebooks/{id}/export` writes a valid nbformat 4.5 `.ipynb` to the bucket and returns a download URL.

### Datasets

Drag files onto **Datasets**. Uploads stream directly to the bucket without being buffered in memory, so large files are safe. Downloads use short-lived presigned URLs straight from storage.

### Jobs

Write a script that saves checkpoints into the directory in the `CHECKPOINT_DIR` environment variable:

```python
import os, json, torch

ckpt = os.environ["CHECKPOINT_DIR"]
os.makedirs(ckpt, exist_ok=True)

device = "cuda" if torch.cuda.is_available() else "cpu"
for epoch in range(10):
    loss = ...  # your training step
    print(f"epoch {epoch} loss {loss:.4f}", flush=True)
    torch.save(model.state_dict(), os.path.join(ckpt, f"epoch_{epoch}.pt"))
```

Use `flush=True` on prints so output reaches the logs promptly. Checkpoints are uploaded to the bucket when the job finishes and appear on the job's page with download links.

**Choosing a provider:**

| | Local CPU | Modal GPU |
|---|---|---|
| Cost | Free | Consumes Modal credit |
| Hardware | Your machine's CPU | T4 by default (configurable) |
| Survives closing the tab | ✅ | ✅ |
| Survives shutting down your computer | ❌ | ✅ |

**The detached-execution guarantee, precisely:** submit a Modal GPU job, shut your computer down mid-run, and come back later. The job completes on Modal the whole time. When you run `docker compose up -d` again, the reconciler notices within a minute and records the result — status, logs and checkpoints. The one condition is that you have to start the stack again: the web app itself runs on your machine.

---

## API

Full interactive reference at **http://localhost:8000/docs**. Every route except `/auth/register`, `/auth/login` and `/health` requires `Authorization: Bearer <access_token>`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Create an account, returns tokens |
| `POST` | `/auth/login` | Exchange credentials for tokens |
| `POST` | `/auth/refresh` | Refresh an access token |
| `GET` | `/auth/me` | Current user |
| `GET` `POST` | `/notebooks` | List / create notebooks |
| `GET` `PATCH` `DELETE` | `/notebooks/{id}` | Read / update / delete a notebook |
| `POST` | `/notebooks/{id}/export` | Write `.ipynb` to the bucket |
| `POST` `DELETE` | `/notebooks/{id}/kernel` | Start / stop the notebook's kernel |
| `WS` | `/ws/kernels/{session_id}?token=…` | Jupyter messaging proxy |
| `GET` `POST` | `/files` | List / upload datasets |
| `GET` | `/files/{id}/download` | Presigned download URL |
| `DELETE` | `/files/{id}` | Delete a dataset |
| `GET` `POST` | `/jobs` | List / submit jobs (`provider_type`: `local_cpu` \| `modal_gpu`) |
| `GET` | `/jobs/{id}` | Job status |
| `GET` | `/jobs/{id}/logs` | Job logs |
| `GET` | `/jobs/{id}/checkpoints` | Checkpoint list with sizes |
| `GET` | `/jobs/{id}/checkpoints/{name}/download` | Presigned checkpoint URL |
| `POST` | `/jobs/{id}/cancel` | Cancel a running job |
| `GET` | `/notifications` | Recent notifications, unread count, whether email is on |
| `POST` | `/notifications/{id}/read` | Mark one notification read |
| `POST` | `/notifications/read-all` | Mark every notification read |
| `POST` | `/notifications/test-email` | Send a test email to the signed-in address |

---

## Project structure

```
.
├── backend/
│   ├── alembic/                  database migrations
│   └── app/
│       ├── api/                  FastAPI route handlers
│       ├── core/                 config, database, redis, S3 client, security
│       ├── models/               SQLAlchemy models
│       ├── providers/
│       │   ├── base.py           ComputeProvider interface
│       │   ├── local_docker.py   CPU jobs in local containers
│       │   └── modal_gpu.py      GPU jobs in Modal sandboxes
│       ├── schemas/              Pydantic request/response models
│       ├── services/
│       │   ├── job_artifacts.py    logs + checkpoints in the bucket
│       │   ├── job_reconciler.py   finalises jobs whose tracking died
│       │   ├── notebook_export.py  stored notebook → valid .ipynb
│       │   └── storage_service.py  dataset uploads
│       └── workers/              arq worker and job tracking task
├── frontend/src/
│   ├── app/                      Next.js routes
│   ├── components/               notebook editor, job form, UI primitives
│   └── lib/                      API client, kernel WebSocket client, types
├── kernel-image/                 Dockerfile for notebook and local job containers
├── docker-compose.yml
└── .env.example
```

## Adding a compute provider

Subclass `ComputeProvider` and implement five methods:

```python
class MyProvider(ComputeProvider):
    provider_type = "my_provider"

    async def submit_job(self, job_id, script_source) -> JobRunHandle: ...
    async def get_status(self, handle) -> JobStatus: ...
    async def stream_logs(self, handle) -> str: ...
    async def cancel(self, handle) -> None: ...
    async def collect_artifacts(self, job_id, handle) -> list[str]: ...
```

Register it in `PROVIDERS` in `backend/app/workers/tasks.py`, and add it to `PROVIDERS` in `frontend/src/components/jobs/JobForm.tsx`.

Two rules keep the platform's guarantees intact. **`submit_job` must return as soon as the run is scheduled** — never block on completion — because the handle is what lets any later process reattach. And **`get_status` must work from a fresh process given only the handle**, since the reconciler calls it with no other context.

---

## Troubleshooting

**`docker` is not recognized** — your terminal was opened before Docker Desktop was installed. Fully quit and reopen the editor or terminal. In VS Code, a new terminal tab isn't enough; restart VS Code itself.

**Database login fails after changing `POSTGRES_*`** — Postgres only applies these on an empty data volume. Recreate it:
```bash
docker compose down -v
docker compose up -d --build
docker compose exec backend alembic upgrade head
```
This deletes all local data.

**Notebook says a kernel image is not built** — run `docker compose build kernel-image`.

**R2 `SignatureDoesNotMatch`** — usually `S3_REGION` isn't `auto`, or the secret was mis-copied. **`NoSuchBucket`** — usually the bucket name was left on the end of `S3_ENDPOINT_URL`.

**Registration returns 422 for a valid-looking email** — the validator rejects special-use domains such as `.local`, `.test` and `.invalid`. Use a real domain.

**Port already in use** — change the matching `*_PORT` variable in `.env`. If you change `BACKEND_PORT`, update `NEXT_PUBLIC_API_BASE_URL` to match and rebuild the frontend (`docker compose up -d --build frontend`) — Next.js bakes `NEXT_PUBLIC_*` into the browser bundle at build time, so a restart alone will not pick it up.

**A job shows `running` long after it finished** — the reconciler settles these within a minute of the backend running. Check `docker compose logs backend` for reconcile errors.

---

## Known limitations

- **Logs lag up to 15 seconds** while a job runs; the worker snapshots them to the bucket rather than streaming.
- **Jobs are capped at one hour** by `MAX_RUNTIME_SECONDS` in `backend/app/workers/tasks.py`, independently of `MODAL_TIMEOUT_SECONDS`. Raise both for longer runs.
- **Notebooks and jobs aren't connected** — there is no "run this notebook as a job" action yet; paste the code into the job form.
- **No export button in the UI** for notebooks; the endpoint exists.
- **Checkpoint metrics aren't parsed** — the `metrics` column on `job_checkpoints` is always empty.
- **Reconciling long-finished Modal runs is unverified.** Status retrieval has been confirmed for sandboxes finished around 25 minutes earlier; behaviour for sandboxes finished hours earlier has not been tested, and a hung read could stall the reconcile sweep.
- **The platform itself runs locally**, so the web app is unavailable while your machine is off, even though Modal jobs continue.
- **Local CPU jobs run without network access** (`network_disabled=True`), so they cannot `pip install` at runtime.

## Security notes

- `.env` is gitignored. Never commit it, and never put real credentials in `.env.example`.
- If credentials are ever pasted into chat, a ticket or a shared document, rotate them: delete and recreate the R2 API token and the Modal token.
- The backend mounts the host's Docker socket to launch job and kernel containers, which is root-equivalent on the host. Don't expose this stack to untrusted users as-is.
