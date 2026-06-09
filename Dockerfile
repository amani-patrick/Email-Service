FROM node:22.0.0-slim AS builder

WORKDIR /opt/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

FROM python:3.11-slim

RUN groupadd -r sesuser && useradd -r -g sesuser sesuser

WORKDIR /opt/web

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py template.jinja2 EULA.md ./
COPY docs/ ./docs/
COPY --from=builder /opt/frontend/dist static

RUN mkdir -p uploads drive data && \
    chown -R sesuser:sesuser /opt/web && \
    chmod 700 uploads drive data

USER sesuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

EXPOSE 8000 2525

CMD ["sh", "-c", "python init.py && uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1"]
