import argparse
from pathlib import Path

from rag.embeddings import BATCH_SIZE, embed_documents
from rag.store import COLLECTION_NAME, get_client, get_or_create_collection
from rag.usda import load_foods, select_core


def ingest(path: Path, limit: int | None = None, reset: bool = False, core: bool = False) -> int:
    foods = load_foods(path)
    if core:
        foods = select_core(foods)
    if limit:
        foods = foods[:limit]

    if reset:
        try:
            get_client().delete_collection(COLLECTION_NAME)
        except Exception:
            pass

    collection = get_or_create_collection()
    # Skip foods already embedded so a run cut short by rate limits can be resumed.
    existing = set(collection.get(ids=[f["id"] for f in foods], include=[])["ids"])
    total = len(foods)
    # Metadata (tags, fiber) can change without the text changing, so refresh it for free.
    refreshed = [f for f in foods if f["id"] in existing]
    if refreshed:
        collection.update(ids=[f["id"] for f in refreshed], metadatas=[f["metadata"] for f in refreshed])
    foods = [f for f in foods if f["id"] not in existing]
    for start in range(0, len(foods), BATCH_SIZE):
        batch = foods[start:start + BATCH_SIZE]
        collection.upsert(
            ids=[f["id"] for f in batch],
            documents=[f["text"] for f in batch],
            metadatas=[f["metadata"] for f in batch],
            embeddings=embed_documents([f["text"] for f in batch]),
        )
        print(f"Indexed {len(existing) + min(start + BATCH_SIZE, len(foods))}/{total}")
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest a USDA FoodData Central JSON file into ChromaDB")
    parser.add_argument("path", type=Path)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--core", action="store_true", help="index the curated core subset only")
    args = parser.parse_args()
    total = ingest(args.path, args.limit, args.reset, args.core)
    print(f"Done. {total} foods in collection '{COLLECTION_NAME}'.")


if __name__ == "__main__":
    main()
