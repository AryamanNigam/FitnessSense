from pathlib import Path
import chromadb
from app.config import settings

COLLECTION_NAME = "usda_foods"

_client: chromadb.ClientAPI | None = None


def get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        Path(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return _client


def get_or_create_collection():
    return get_client().get_or_create_collection(
        name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
    )


def get_collection():
    return get_client().get_collection(name=COLLECTION_NAME)
