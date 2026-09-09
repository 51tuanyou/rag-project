# rag-project

RAG project with a Django backend and a React + Vite frontend.

## Project structure

```
rag-project/
├── rag-backend/    # Django API
└── rag-frontend/   # React + Vite UI
```

## Tech stack

### Backend (`rag-backend`)

| Piece | Choice |
|--------|--------|
| Language | Python 3.12.7 |
| Framework | Django 5.2.7 |
| Package manager | PDM |
| Database | SQLite |

### Frontend (`rag-frontend`)

| Piece | Choice |
|--------|--------|
| UI | React 19 + TypeScript |
| Bundler | Vite 7 |
| CSS | Tailwind CSS 3.4 + PostCSS + Autoprefixer |
| Lint / format | ESLint + Prettier |
| Package manager | pnpm |

### Default URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://127.0.0.1:8000 |
| Django admin | http://127.0.0.1:8000/admin/ |

> Frontend and backend are not wired together yet (no API proxy / CORS). Start them independently.

## Prerequisites

- [Conda](https://docs.conda.io/) (Miniconda / Anaconda)
- Backend uses PDM inside the conda env
- Frontend uses Node.js + pnpm (via conda or system install)

## Setup & start with conda

### 1. Backend

```powershell
# Create & activate env
conda create -n rag-backend python=3.12.7 -y
conda activate rag-backend

# Install PDM, then project deps
pip install pdm
cd rag-backend
pdm install

# First-time DB migration
pdm run python manage.py migrate

# Start Django
pdm run python manage.py runserver
```

Without PDM (pip only):

```powershell
conda activate rag-backend
cd rag-backend
pip install "django>=5.2.7"
python manage.py migrate
python manage.py runserver
```

### 2. Frontend

Open a **new** terminal:

```powershell
# Create & activate env
conda create -n rag-frontend nodejs=22 -y
conda activate rag-frontend

# Enable pnpm
corepack enable
cd rag-frontend
pnpm install

# Start Vite
pnpm dev
```

If Node.js and pnpm are already on your PATH, you can skip the conda frontend env and run:

```powershell
cd rag-frontend
pnpm install
pnpm dev
```

## Quick start checklist

1. Terminal A: `conda activate rag-backend` → `cd rag-backend` → `pdm run python manage.py runserver`
2. Terminal B: `conda activate rag-frontend` (or system Node) → `cd rag-frontend` → `pnpm dev`
3. Open http://localhost:5173 and http://127.0.0.1:8000

## Useful commands

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
pnpm dev      # development server
pnpm build    # production build
pnpm preview  # preview production build
pnpm lint
```
