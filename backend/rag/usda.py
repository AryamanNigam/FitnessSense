import json
import re
from pathlib import Path

FOOD_KEYS = ("FoundationFoods", "SRLegacyFoods")
ENERGY_NUMBERS = ("208", "957", "958")
MEAT_CATEGORIES = (
    "Poultry Products",
    "Beef Products",
    "Pork Products",
    "Lamb, Veal, and Game Products",
    "Finfish and Shellfish Products",
    "Sausages and Luncheon Meats",
)
# Mixed categories (soups, fast food, entrees) can contain meat, so check the name too.
MEAT_WORDS = re.compile(
    r"\b(chicken|beef|pork|lamb|veal|turkey|duck|ham|bacon|sausage|fish|salmon|tuna|shrimp|crab|"
    r"anchov\w*|meats?|gelatin)\b",
    re.I,
)


def _amounts(food: dict) -> dict[str, float]:
    amounts: dict[str, float] = {}
    for entry in food.get("foodNutrients", []):
        nutrient = entry.get("nutrient") or {}
        number = str(nutrient.get("number", ""))
        amount = entry.get("amount")
        if number and isinstance(amount, (int, float)) and number not in amounts:
            amounts[number] = float(amount)
    return amounts


def parse_food(food: dict) -> dict | None:
    description = (food.get("description") or "").strip()
    amounts = _amounts(food)
    kcal = next((amounts[n] for n in ENERGY_NUMBERS if n in amounts), None)
    protein = amounts.get("203")
    fat = amounts.get("204")
    carbs = amounts.get("205")
    if not description or None in (kcal, protein, fat, carbs):
        return None

    category = (food.get("foodCategory") or {}).get("description", "")
    return {
        "id": f"fdc-{food.get('fdcId', description)}",
        "text": (
            f"Food: {description}. Nutrients per 100g: protein {protein:.1f}g, "
            f"carbs {carbs:.1f}g, fat {fat:.1f}g, kcal {kcal:.0f}."
        ),
        "metadata": {
            "description": description,
            "category": category,
            "protein_g": round(protein, 1),
            "carbs_g": round(carbs, 1),
            "fat_g": round(fat, 1),
            "kcal": round(kcal),
            "is_vegetarian": category not in MEAT_CATEGORIES and not MEAT_WORDS.search(description),
        },
    }


def load_foods(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)

    if isinstance(payload, list):
        raw = payload
    else:
        raw = next((payload[k] for k in FOOD_KEYS if k in payload), [])

    seen: set[str] = set()
    foods: list[dict] = []
    for item in raw:
        parsed = parse_food(item)
        if parsed is None or parsed["metadata"]["description"].lower() in seen:
            continue
        seen.add(parsed["metadata"]["description"].lower())
        foods.append(parsed)
    return foods
