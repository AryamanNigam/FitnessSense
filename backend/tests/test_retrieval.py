import chromadb
import pytest

import rag.constraints as constraints_mod
import rag.retriever as retriever
from rag.constraints import Constraints, annotate, extract_constraints, matches, portion_grams, to_where
from rag.usda import parse_food

FOODS = [
    # (id, description, category, protein, kcal)
    ("fdc-1", "Chicken, breast, roasted", "Poultry Products", 31.0, 165),
    ("fdc-2", "Chicken, breast, raw", "Poultry Products", 22.5, 120),
    ("fdc-3", "Tofu, firm", "Legumes and Legume Products", 17.3, 144),
    ("fdc-4", "Lentils, cooked", "Legumes and Legume Products", 9.0, 116),
    ("fdc-5", "Rice, white, cooked", "Cereal Grains and Pasta", 2.7, 130),
]


def _vector(text: str) -> list[float]:
    # Deterministic fake embedding: a bag of a few food words, so similarity is meaningful.
    words = ("chicken", "breast", "tofu", "lentils", "rice", "protein")
    return [float(w in text.lower()) + 0.01 for w in words]


@pytest.fixture
def collection(monkeypatch):
    client = chromadb.EphemeralClient()
    name = "test_foods"
    try:
        client.delete_collection(name)
    except Exception:
        pass
    col = client.create_collection(name, metadata={"hnsw:space": "cosine"})
    docs = [f"Food: {d}. Nutrients per 100g: protein {p}g, kcal {k}." for _, d, _, p, k in FOODS]
    col.add(
        ids=[f[0] for f in FOODS],
        documents=docs,
        embeddings=[_vector(d) for d in docs],
        metadatas=[
            {"description": d, "category": cat, "protein_g": p, "kcal": k, "is_vegetarian": cat != "Poultry Products"}
            for _, d, cat, p, k in FOODS
        ],
    )
    monkeypatch.setattr(retriever, "get_collection", lambda: col)
    monkeypatch.setattr(retriever, "embed_query", _vector)
    monkeypatch.setattr(retriever, "_bm25", None)
    return col


def test_is_vegetarian_uses_category_and_name():
    def food(description, category):
        return {
            "fdcId": 1,
            "description": description,
            "foodCategory": {"description": category},
            "foodNutrients": [
                {"nutrient": {"number": n}, "amount": 1.0} for n in ("203", "204", "205", "208")
            ],
        }

    assert parse_food(food("Chicken, breast, raw", "Poultry Products"))["metadata"]["is_vegetarian"] is False
    assert parse_food(food("Soup, chicken noodle", "Soups, Sauces, and Gravies"))["metadata"]["is_vegetarian"] is False
    assert parse_food(food("Tofu, firm", "Legumes and Legume Products"))["metadata"]["is_vegetarian"] is True
    assert parse_food(food("Meatless burger", "Legumes and Legume Products"))["metadata"]["is_vegetarian"] is True


def test_to_where_combines_clauses():
    assert to_where(Constraints()) is None
    assert to_where(Constraints(vegetarian=True)) == {"is_vegetarian": True}
    assert to_where(Constraints(min_protein_per_100g=20, max_kcal_per_100g=150)) == {
        "$and": [{"protein_g": {"$gte": 20}}, {"kcal": {"$lte": 150}}]
    }


def test_per_meal_protein_does_not_filter():
    # 23 g/100g chicken still reaches 50 g in a bigger portion, so it must not be excluded.
    c = Constraints(min_protein_per_meal_g=50)
    assert to_where(c) is None
    assert matches(c, {"protein_g": 22.5, "is_vegetarian": False})


def test_portion_math_done_in_code():
    assert portion_grams(50, 31.0) == 161
    assert portion_grams(50, 0) is None
    c = Constraints(min_protein_per_meal_g=50)
    assert "about 161g (computed)" in annotate("Food: Chicken.", {"protein_g": 31.0}, c)
    assert "too much for one meal" in annotate("Food: Rice.", {"protein_g": 2.7}, c)
    assert annotate("Food: Rice.", {"protein_g": 2.7}, Constraints()) == "Food: Rice."


def test_extract_skips_llm_without_hints(monkeypatch):
    def boom(_):
        raise AssertionError("LLM should not be called")

    monkeypatch.setattr(constraints_mod, "generate_json", boom)
    assert extract_constraints("what is good for breakfast?").is_empty()


def test_extract_validates_llm_output(monkeypatch):
    monkeypatch.setattr(
        constraints_mod, "generate_json",
        lambda _: {"min_protein_per_meal_g": 50, "min_protein_per_100g": None, "vegetarian": None},
    )
    assert extract_constraints("chicken with 50g protein") == Constraints(min_protein_per_meal_g=50)

    monkeypatch.setattr(constraints_mod, "generate_json", lambda _: {"min_protein_per_meal_g": -5})
    assert extract_constraints("chicken with 50g protein").is_empty()


def test_extract_failure_falls_back_to_no_filter(monkeypatch):
    def fail(_):
        raise RuntimeError("Gemini down")

    monkeypatch.setattr(constraints_mod, "generate_json", fail)
    assert extract_constraints("vegetarian dinner").is_empty()


def test_fuse_rewards_agreement():
    a = [("x", "X", {}), ("y", "Y", {})]
    b = [("y", "Y", {}), ("z", "Z", {})]
    assert [doc for doc, _ in retriever.fuse([a, b], 3)] == ["Y", "X", "Z"]


def test_hybrid_retrieve_applies_vegetarian_filter(collection):
    hits = retriever.retrieve("high protein breast", Constraints(vegetarian=True))
    assert hits
    assert all(meta["is_vegetarian"] for _, meta in hits)


def test_hybrid_retrieve_applies_numeric_filter(collection):
    hits = retriever.retrieve("protein", Constraints(min_protein_per_100g=20))
    assert {meta["description"] for _, meta in hits} == {"Chicken, breast, roasted", "Chicken, breast, raw"}


def test_keyword_search_still_works_when_vector_search_fails(collection, monkeypatch):
    def down(_):
        raise RuntimeError("embedding API down")

    monkeypatch.setattr(retriever, "embed_query", down)
    hits = retriever.retrieve("tofu")
    assert hits[0][1]["description"] == "Tofu, firm"
