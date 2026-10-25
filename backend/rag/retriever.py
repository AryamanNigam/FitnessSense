from rag.embeddings import embed_query
from rag.store import get_collection

TOP_K = 5


def retrieve(query: str, k: int = TOP_K) -> list[str]:
    try:
        collection = get_collection()
        result = collection.query(query_embeddings=[embed_query(query)], n_results=k)
    except Exception:
        return []
    documents = result.get("documents") or [[]]
    return documents[0]


def collection_status() -> str:
    try:
        return "ok" if get_collection().count() > 0 else "empty"
    except Exception:
        return "error"
