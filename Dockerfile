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