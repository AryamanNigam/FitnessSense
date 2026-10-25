import json

from rag.prompt import build_prompt
from rag.usda import load_foods, parse_food


def _food(**overrides):
    base = {
        "fdcId": 171477,
        "description": "Chicken, breast, raw",
        "foodCategory": {"description": "Poultry Products"},
        "foodNutrients": [
            {"nutrient": {"number": "203"}, "amount": 22.5},
            {"nutrient": {"number": "204"}, "amount": 2.6},
            {"nutrient": {"number": "205"}, "amount": 0.0},
            {"nutrient": {"number": "208"}, "amount": 120},
        ],
    }
    base.update(overrides)
    return base


def test_parse_food_formats_chunk():
    parsed = parse_food(_food())
    assert parsed["id"] == "fdc-171477"
    assert parsed["text"] == (
        "Food: Chicken, breast, raw. Nutrients per 100g: protein 22.5g, carbs 0.0g, fat 2.6g, kcal 120."
    )
    assert parsed["metadata"]["protein_g"] == 22.5


def test_parse_food_skips_missing_macros():
    assert parse_food(_food(foodNutrients=[])) is None


def test_parse_food_uses_atwater_energy_fallback():
    nutrients = [n for n in _food()["foodNutrients"] if n["nutrient"]["number"] != "208"]
    nutrients.append({"nutrient": {"number": "957"}, "amount": 118})
    assert parse_food(_food(foodNutrients=nutrients))["metadata"]["kcal"] == 118


def test_load_foods_dedupes_by_description(tmp_path):
    path = tmp_path / "foods.json"
    path.write_text(json.dumps({"SRLegacyFoods": [_food(), _food(fdcId=2), _food(fdcId=3, description="Rice")]}))
    assert [f["metadata"]["description"] for f in load_foods(path)] == ["Chicken, breast, raw", "Rice"]


def test_build_prompt_includes_all_sections():
    prompt = build_prompt(
        "How much protein?",
        ["Food: Egg."],
        {"goal": "cut", "tdee": 2100, "protein_target_g": 154},
        [{"role": "user", "content": "hi"}],
    )
    for expected in ("cut", "2100", "154", "Food: Egg.", "user: hi", "How much protein?"):
        assert expected in prompt


def test_build_prompt_handles_empty_context_and_history():
    prompt = build_prompt("q", [], {}, [])
    assert "No relevant USDA entries found." in prompt
    assert "None." in prompt
