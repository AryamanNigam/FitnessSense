import logging
import re

from rank_bm25 import BM25Okapi

from rag.constraints import Constraints, matches, to_where
from rag.embeddings import embed_query
from rag.store import get_collection

logger = logging.getLogger("fitnesssense")

TOP_K = 5
CANDIDATES = 20  # per retriever, before fusion
RRF_K = 60  # standard reciprocal-rank-fusion constant; damps the gap between rank 1 and 2

_bm25: tuple[BM25Okapi, list[str], list[str], list[dict]] | None = None


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _bm25_index() -> tuple[BM25Okapi, list[str], list[str], list[dict]]:
    """Built once per process from the Chroma collection, so both retrievers see the same corpus.
    Ingest runs offline and the server restarts after it, so the cache never goes stale."""
    global _bm25
    if _bm25 is None:
        data = get_collection().get(include=["documents", "metadatas"])
        ids, docs, metas = data["ids"], data["documents"], data["metadatas"]
        _bm25 = (BM25Okapi([_tokenize(d) for d in docs]), ids, docs, metas)
    return _bm25


def _keyword_search(query: str, c: Constraints, n: int) -> list[tuple[str, str, dict]]:
    index, ids, docs, metas = _bm25_index()
    scores = index.get_scores(_tokenize(query))
    ranked = sorted(range(len(ids)), key=lambda i: scores[i], reverse=True)
    hits = [(ids[i], docs[i], metas[i]) for i in ranked if scores[i] > 0 and matches(c, metas[i])]
    return hits[:n]


def _vector_search(query: str, c: Constraints, n: int) -> list[tuple[str, str, dict]]:
    result = get_collection().query(
        query_embeddings=[embed_query(query)], n_results=n, where=to_where(c)
    )
    return list(zip(result["ids"][0], result["documents"][0], result["metadatas"][0]))


def fuse(rankings: list[list[tuple[str, str, dict]]], k: int) -> list[tuple[str, dict]]:
    """Reciprocal rank fusion: score = sum of 1/(RRF_K + rank) across rankings. Uses ranks, not raw
    scores, because BM25 scores and cosine distances aren't on comparable scales."""
    scores: dict[str, float] = {}
    hits: dict[str, tuple[str, dict]] = {}
    for ranking in rankings:
        for rank, (doc_id, doc, meta) in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (RRF_K + rank)
            hits[doc_id] = (doc, meta)
    best = sorted(scores, key=scores.get, reverse=True)[:k]
    return [hits[doc_id] for doc_id in best]


def retrieve(query: str, constraints: Constraints | None = None, k: int = TOP_K) -> list[tuple[str, dict]]:
    c = constraints or Constraints()
    rankings = []
    # Each retriever fails independently, and failures are logged rather than swallowed,
    # so an ungrounded answer is visible in the logs instead of looking normal.
    for search in (_vector_search, _keyword_search):
        try:
            rankings.append(search(query, c, CANDIDATES))
        except Exception:
            logger.exception("%s failed for query %r", search.__name__, query)
    return fuse(rankings, k)


def collection_status() -> str:
    try:
        return "ok" if get_collection().count() > 0 else "empty"
    except Exception:
        return "error"
