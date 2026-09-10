#!/bin/sh
set -e

echo "Waiting for database ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}..."

python - <<'PY'
import os
import socket
import time

host = os.getenv("POSTGRES_HOST", "localhost")
port = int(os.getenv("POSTGRES_PORT", "5432"))
use_postgres = os.getenv("USE_POSTGRES", "0").lower() in {"1", "true", "yes"}

if not use_postgres:
    print("USE_POSTGRES is disabled; skipping DB wait.")
else:
    deadline = time.time() + 60
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=2):
                print(f"Database is reachable at {host}:{port}")
                break
        except OSError:
            print(f"Database not ready at {host}:{port}, retrying...")
            time.sleep(2)
    else:
        raise SystemExit(f"Timed out waiting for database at {host}:{port}")
PY

mkdir -p /app/temp

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting application..."
exec "$@"
