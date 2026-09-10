# rag-project

RAG project with a Django backend and a React + Vite frontend.

**Latest branch:** `dev-01-temp`

## Project structure

```
rag-project/
├── docker-compose.yml            # App: backend + frontend
├── docker-compose.postgres.yml   # Optional: Postgres + PGVector (named network)
├── .env.example                  # Env template for Docker / local
├── rag-backend/                  # Django API
└── rag-frontend/                 # React + Vite UI
```

## Tech stack

### Backend (`rag-backend`)

| Piece | Choice |
|--------|--------|
| Language | Python 3.12 |
| Framework | Django 5.2 + DRF |
| Package manager | PDM |
| Database | PostgreSQL (env-configured) |
| Vectors | PGVector (env-configured) |

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

App and database are **separate** Compose files. They share a **named** Docker network `rag_pgvector_net` (not the default `…_default` network).

### 1. Configure environment

```powershell
cd d:\projects\51tuanyou\rag-project
copy .env.example .env
```

Key DB settings (container-to-container):

| Variable | Value | Notes |
|----------|--------|--------|
| `POSTGRES_HOST` | `postgres-ctr` | Container name, **not** `localhost` |
| `PGVECTOR_HOST` | `postgres-ctr` | Same Postgres / PGVector instance |
| `POSTGRES_DB` / `PGVECTOR_DB` | e.g. `rag_vectors` | Must exist in the DB volume |
| `VITE_API_BASE` | `http://localhost:8000` | Browser → backend (host port) |

> Inside a container, `localhost` means the container itself. Use `postgres-ctr` on the shared network.

### 2. Start Postgres + PGVector first

```powershell
docker compose -f docker-compose.postgres.yml up -d
```

This creates/uses network **`rag_pgvector_net`** and container **`postgres-ctr`** (`pgvector/pgvector:pg15`), with data at `D:/docker-volumes/postgres/postgres_data`.

If you already had an old `postgres-ctr` on another network, recreate it:

```powershell
docker stop postgres-ctr
docker rm postgres-ctr
docker compose -f docker-compose.postgres.yml up -d
```

(Your data volume path is unchanged.)

### 3. Build & start the app

```powershell
docker compose up -d --build
```

`docker-compose.yml` attaches `rag-backend` to external network `rag_pgvector_net`, so it can resolve `postgres-ctr:5432`.

### 4. Open the app

- Frontend: http://localhost (or `http://<server-ip>` on a remote host)
- Backend API: http://localhost:8000
- Admin: http://localhost/admin/ (nginx) or http://localhost:8000/admin/

### 5. Create Django admin superuser (Docker)

Do **not** run `pdm run python manage.py createsuperuser` on the host. Run it **inside** `rag-backend`:

```bash
docker exec -it rag-backend python manage.py createsuperuser
```

It prompts for username, email, and password. Then log in at `/admin/`.

With username/email flags (password still prompted):

```bash
docker exec -it rag-backend python manage.py createsuperuser --username admin --email admin@example.com
```

### Networking overview

```
rag-frontend  ──(host port 80)──► browser
rag-backend   ──(host port 8000)──► browser / API
rag-backend   ──rag_pgvector_net──► postgres-ctr:5432
```

| From | To Postgres use |
|------|-----------------|
| DBeaver on the host | `localhost:5432` (published port) |
| `rag-backend` container | `postgres-ctr:5432` (Docker DNS) |

### Useful Compose commands

```powershell
# DB
docker compose -f docker-compose.postgres.yml ps
docker compose -f docker-compose.postgres.yml logs -f
docker compose -f docker-compose.postgres.yml down

# App
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend
docker compose down

# Create Django admin user (inside container — not on the host)
docker exec -it rag-backend python manage.py createsuperuser
# optional:
# docker exec -it rag-backend python manage.py createsuperuser --username admin --email admin@example.com

# Connectivity check
docker exec -it rag-backend python -c "import socket; s=socket.create_connection(('postgres-ctr',5432),5); print('OK'); s.close()"
```

### Notes

- Backend entrypoint waits for Postgres, then runs `migrate`.
- Ollama on the host: `OLLAMA_API_BASE=http://host.docker.internal:11434`.
- Frontend build bakes in `VITE_API_BASE`; rebuild frontend after changing it.
- `docker-compose.postgres.yml` sets initial `POSTGRES_DB=rag_db`. If the app uses `rag_vectors`, create that database once (or change `.env` to match).

---

## Local setup with conda

### Prerequisites

- [Conda](https://docs.conda.io/) (Miniconda / Anaconda)
- PostgreSQL + PGVector (optional SQLite if `USE_POSTGRES=False`)

### 1. Backend

```powershell
conda create -n rag-backend python=3.12.7 -y
conda activate rag-backend

pip install pdm
cd rag-backend
pdm install

# Configure rag-backend/.env (see env.example)
# For local (non-Docker) use: POSTGRES_HOST=localhost
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
pnpm typecheck
```
