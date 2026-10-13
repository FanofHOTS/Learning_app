FROM python:3.13-slim AS backend

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1 \
	PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		libgl1 \
		libglib2.0-0 \
		libgomp1 \
		poppler-utils \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /data/uploads

ENV UPLOAD_DIR=/data/uploads
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


FROM node:25-bookworm-slim AS frontend

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_MINIO_PUBLIC_URL=
ARG NEXT_PUBLIC_USE_MOCK_DATA=false
ARG NEXT_PUBLIC_AI_GENERATOR_MAX_QUESTIONS=20
ARG ALLOW_PRIVATE_MINIO_IMAGES=false

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
	NEXT_PUBLIC_MINIO_PUBLIC_URL=${NEXT_PUBLIC_MINIO_PUBLIC_URL} \
	NEXT_PUBLIC_USE_MOCK_DATA=${NEXT_PUBLIC_USE_MOCK_DATA} \
	NEXT_PUBLIC_AI_GENERATOR_MAX_QUESTIONS=${NEXT_PUBLIC_AI_GENERATOR_MAX_QUESTIONS} \
	NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_MINIO_PUBLIC_URL=${NEXT_PUBLIC_MINIO_PUBLIC_URL} \
	NEXT_TELEMETRY_DISABLED=1 \
	ALLOW_PRIVATE_MINIO_IMAGES=${ALLOW_PRIVATE_MINIO_IMAGES} \
	NODE_ENV=production

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]