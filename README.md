# rag-project

RAG project with a Django backend and a React + Vite frontend.

**Latest branch:** `dev-01-temp`

## Project structure

```
rag-project/
├── docker-compose.yml   # App services only (no database container)
├── .env.example         # Env template for Docker / local
├── rag-backend/         # Django API
└── rag-frontend/        # React + Vite UI
```

## Tech stack

### Backend (`rag-backend`)

| Piece | Choice |
|--------|--------|
| Language | Python 3.12 |
| Framework | Django 5.2 + DRF |
| Package manager | PDM |
| Database | Existing PostgreSQL (env-configured) |
| Vectors | Existing PGVector (env-configured) |

### Frontend (`rag-frontend`)

| Piece | Choice |
|--------|--------|
| UI | React 19 + TypeScript |
| Bundler | Vite 7 |
| UI libs | MUI |
| Package manager | pnpm |

### Default URLs

| Mode | Frontend | Backend |
|------|----------|---------|
| Local conda/dev | http://localhost:5173 | http://127.0.0.1:8000 |
| Docker Compose | http://localhost | http://localhost:8000 |

## Docker Compose deploy (recommended)

Uses **existing** Postgres / PGVector. Compose does **not** start a database container.

### 1. Configure environment

```powershell
cd d:\projects\51tuanyou\rag-project
copy .env.example .env
```

Edit `.env` and point DB hosts at your existing instance:

| Variable | Typical value when DB is on the Docker host |
|----------|---------------------------------------------|
| `POSTGRES_HOST` | `host.docker.internal` |
| `PGVECTOR_HOST` | `host.docker.internal` |
| `POSTGRES_*` / `PGVECTOR_*` | Your real DB name / user / password |
| `VITE_API_BASE` | `http://localhost:8000` (browser → backend) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost,http://127.0.0.1` |

If Postgres runs on another machine, set `POSTGRES_HOST` / `PGVECTOR_HOST` to that IP/hostname instead.

Ensure Postgres accepts connections from Docker (listen address / `pg_hba.conf`).

### 2. Build & start

```powershell
docker compose up -d --build
```

### 3. Open the app

- Frontend: http://localhost
- Backend API: http://localhost:8000
- Admin: http://localhost:8000/admin/

### Useful Compose commands

```powershell
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend
docker compose down
```

### Notes

- Backend entrypoint waits for Postgres, then runs `migrate`.
- Ollama on the host should use `OLLAMA_API_BASE=http://host.docker.internal:11434`.
- Frontend build bakes in `VITE_API_BASE`; rebuild frontend after changing it.

---

## Local setup with conda

### Prerequisites

- [Conda](https://docs.conda.io/) (Miniconda / Anaconda)
- Existing PostgreSQL + PGVector (optional for local SQLite if `USE_POSTGRES=False`)

### 1. Backend

```powershell
conda create -n rag-backend python=3.12.7 -y
conda activate rag-backend

pip install pdm
cd rag-backend
pdm install

# Configure rag-backend/.env (see env.example)
pdm run python manage.py migrate
pdm run python manage.py runserver
```

### 2. Frontend

```powershell
conda create -n rag-frontend nodejs=22 -y
conda activate rag-frontend

corepack enable
cd rag-frontend
pnpm install
pnpm dev
```

### Quick start checklist

1. Terminal A: `conda activate rag-backend` → `cd rag-backend` → `pdm run python manage.py runserver`
2. Terminal B: `conda activate rag-frontend` → `cd rag-frontend` → `pnpm dev`
3. Open http://localhost:5173 and http://127.0.0.1:8000

## Useful local commands

### Backend

```powershell
cd rag-backend
pdm run python manage.py migrate
pdm run python manage.py createsuperuser
pdm run python manage.py runserver
```

### Frontend

```powershell
cd rag-frontend
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm lint
```
