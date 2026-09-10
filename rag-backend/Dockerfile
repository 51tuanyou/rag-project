FROM python:3.12-slim

# psycopg2-binary is used, so no apt packages (build-essential/libpq-dev) are required.
# Avoid apt.debian.org timeouts common on restricted networks.

ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PDM_CHECK_UPDATE=false \
    PDM_USE_VENV=true \
    PATH="/app/.venv/bin:$PATH" \
    PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST} \
    PDM_PYPI_URL=${PIP_INDEX_URL}

WORKDIR /app

RUN pip install --no-cache-dir -i ${PIP_INDEX_URL} --trusted-host ${PIP_TRUSTED_HOST} pdm

COPY pyproject.toml pdm.lock README.md ./
# PDM venvs often omit pip; bootstrap pip then install gunicorn into the same env as Django
RUN pdm config pypi.url ${PIP_INDEX_URL} \
    && pdm install --prod --no-editable --no-self \
    && /app/.venv/bin/python -m ensurepip --upgrade \
    && /app/.venv/bin/python -m pip install --no-cache-dir -i ${PIP_INDEX_URL} --trusted-host ${PIP_TRUSTED_HOST} gunicorn whitenoise

COPY . .
RUN sed -i 's/\r$//' /app/docker/entrypoint.sh \
    && chmod +x /app/docker/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["gunicorn", "rag_backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]
