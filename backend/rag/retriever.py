import logging
import re

from rank_bm25 import BM25Okapi

from rag.constraints import Constraints, matches, to_where
from rag.embeddings import embed_queries
from rag.store import get_collection

logger = logging.getLogger("fitnesssense")

TOP_K = 8  # room for a dish that combines protein and fiber sources
CANDIDATES = 20  # per retriever, before fusion
RRF_K = 60  # standard reciprocal-rank-fusion constant; damps the gap between rank 1 and 2
# Cosine distance cutoff for gemini-embedding-001, from sample queries: food and constraint
# questions land at 0.26-0.37, off-topic ones (training, sleep, trivia) at 0.42+.
MAX_VECTOR_DISTANCE = 0.40

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


def _vector_search(queries: list[str], c: Constraints, n: int) -> list[list[tuple[str, str, dict]]]:
    """One ranking per query, from a single batched embedding call and a single Chroma query."""
    result = get_collection().query(
        query_embeddings=embed_queries(queries),
        n_results=n,
        where=to_where(c),
        include=["documents", "metadatas", "distances"],
    )
    rankings = []
    for ids, docs, metas, dists in zip(result["ids"], result["documents"], result["metadatas"], result["distances"]):
        hits = zip(ids, docs, metas, dists)
        rankings.append([(doc_id, doc, meta) for doc_id, doc, meta, dist in hits if dist <= MAX_VECTOR_DISTANCE])
    return rankings


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


def _interleave(results: list[list[tuple[str, dict]]], k: int) -> list[tuple[str, dict]]:
    """Round-robin across queries so every requested food gets a slot before any gets a second."""
    picked: list[tuple[str, dict]] = []
    seen: set[str] = set()
    for rank in range(max((len(r) for r in results), default=0)):
        for result in results:
            if rank < len(result) and result[rank][0] not in seen:
                seen.add(result[rank][0])
                picked.append(result[rank])
                if len(picked) == k:
                    return picked
    return picked


def retrieve(
    query: str | list[str], constraints: Constraints | None = None, k: int = TOP_K
) -> list[tuple[str, dict]]:
    """Several queries (one per food from the rewritten question) are searched separately:
    one blended embedding of "cheddar, lentils, chicken breast" lands among the cheeses."""
    queries = [query] if isinstance(query, str) else query
    c = constraints or Constraints()
    # Each retriever fails independently, and failures are logged rather than swallowed,
    # so an ungrounded answer is visible in the logs instead of looking normal.
    vector: list[list[tuple[str, str, dict]]] | None = None
    try:
        vector = _vector_search(queries, c, CANDIDATES)
    except Exception:
        logger.exception("Vector search failed for %r", queries)

    results = []
    for i, q in enumerate(queries):
        rankings = []
        if vector is not None:
            # Vector search is the relevance gate: BM25 matches "protein" in every chunk, so it
            # can't tell an off-topic query apart. Empty context lets the prompt say so.
            if not vector[i]:
                logger.info("No chunk within distance %.2f for query %r", MAX_VECTOR_DISTANCE, q)
                continue
            rankings.append(vector[i])
        try:
            rankings.append(_keyword_search(q, c, CANDIDATES))
        except Exception:
            logger.exception("Keyword search failed for query %r", q)
        results.append(fuse(rankings, k))
    return _interleave(results, k)


def collection_status() -> str:
    try:
        return "ok" if get_collection().count() > 0 else "empty"
    except Exception:
        return "error"
