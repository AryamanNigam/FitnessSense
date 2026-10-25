import argparse
from pathlib import Path

from rag.embeddings import BATCH_SIZE, embed_documents
from rag.store import COLLECTION_NAME, get_client, get_or_create_collection
from rag.usda import load_foods


def ingest(path: Path, limit: int | None = None, reset: bool = False) -> int:
    foods = load_foods(path)
    if limit:
        foods = foods[:limit]

    if reset:
        try:
            get_client().delete_collection(COLLECTION_NAME)
        except Exception:
            pass

    collection = get_or_create_collection()
    for start in range(0, len(foods), BATCH_SIZE):
        batch = foods[start:start + BATCH_SIZE]
        collection.upsert(
            ids=[f["id"] for f in batch],
            documents=[f["text"] for f in batch],
            metadatas=[f["metadata"] for f in batch],
            embeddings=embed_documents([f["text"] for f in batch]),
        )
        print(f"Indexed {min(start + BATCH_SIZE, len(foods))}/{len(foods)}")
    return len(foods)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest a USDA FoodData Central JSON file into ChromaDB")
    parser.add_argument("path", type=Path)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    total = ingest(args.path, args.limit, args.reset)
    print(f"Done. {total} foods in collection '{COLLECTION_NAME}'.")


if __name__ == "__main__":
    main()
