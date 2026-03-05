FROM node:22.0.0-slim AS builder

WORKDIR /opt/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

FROM python:3.11-slim
WORKDIR /opt/web

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
	git \
	&& rm -rf /var/lib/apt/lists/*

# Install python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application assets
COPY *.py template.jinja2 ./
COPY --from=builder /opt/frontend/dist static

# Create directory for encrypted uploads
RUN mkdir -p uploads

EXPOSE 8000

# Ensure the database is initialized and production server starts
CMD ["sh", "-c", "python init.py && uvicorn main:app --host 0.0.0.0 --port 8000"]
FROM node:22.0.0-slim AS builder

WORKDIR /opt/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

FROM python:3.11-slim

# Security: Create non-root user
RUN groupadd -r sesuser && useradd -r -g sesuser sesuser

WORKDIR /opt/web

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application assets
COPY *.py template.jinja2 ./
COPY --from=builder /opt/frontend/dist static

# Create directories for encrypted uploads and data
RUN mkdir -p uploads data && \
    chown -R sesuser:sesuser /opt/web

# Security: Set proper permissions
RUN chmod 700 uploads data && \
    chmod 600 requirements.txt

# Security: Switch to non-root user
USER sesuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/me || exit 1

EXPOSE 8000

# Ensure the database is initialized and production server starts
CMD ["sh", "-c", "python init.py && uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2"]
