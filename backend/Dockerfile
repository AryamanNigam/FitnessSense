FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY rag ./rag
COPY scripts ./scripts
# The USDA index is static, so it ships in the image (built locally with `make ingest`).
COPY chroma_db ./chroma_db

ENV CHROMA_PERSIST_DIR=/app/chroma_db \
    ENVIRONMENT=production

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
