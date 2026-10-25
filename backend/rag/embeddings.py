import time
import httpx
from app.config import settings

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIMENSIONS = 768
BATCH_SIZE = 100
_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBED_MODEL}:batchEmbedContents"


def _embed_batch(texts: list[str], task_type: str) -> list[list[float]]:
    payload = {
        "requests": [
            {
                "model": f"models/{EMBED_MODEL}",
                "content": {"parts": [{"text": text}]},
                "taskType": task_type,
                "outputDimensionality": EMBED_DIMENSIONS,
            }
            for text in texts
        ]
    }
    for attempt in range(5):
        resp = httpx.post(_URL, params={"key": settings.gemini_api_key}, json=payload, timeout=60.0)
        if resp.status_code in (429, 503):
            time.sleep(2 ** attempt)
            continue
        resp.raise_for_status()
        return [e["values"] for e in resp.json()["embeddings"]]
    raise RuntimeError("Embedding request failed after retries")


def embed_documents(texts: list[str]) -> list[list[float]]:
    vectors: list[list[float]] = []
    for start in range(0, len(texts), BATCH_SIZE):
        vectors.extend(_embed_batch(texts[start:start + BATCH_SIZE], "RETRIEVAL_DOCUMENT"))
    return vectors


def embed_query(text: str) -> list[float]:
    return _embed_batch([text], "RETRIEVAL_QUERY")[0]
