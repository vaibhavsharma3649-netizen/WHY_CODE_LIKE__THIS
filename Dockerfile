FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --create-home app

COPY requirements-deploy.txt ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements-deploy.txt

COPY backend ./backend
RUN mkdir -p /app/data/repos && chown -R app:app /app

USER app
WORKDIR /app/backend

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
