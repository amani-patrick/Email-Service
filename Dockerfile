FROM node:22.0.0-slim AS builder

WORKDIR /opt/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

FROM python:3.11-slim
WORKDIR /opt/web

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
	git \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
	playwright install chromium && \
	playwright install-deps

COPY *.py template.jinja2 ./
COPY --from=builder /opt/frontend/dist static

EXPOSE 8000

# Ensure the database is initialized before starting
CMD python init.py && python main.py