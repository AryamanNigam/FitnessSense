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
# Meatless categories that reuse meat words ("coconut meat", "oyster mushroom", "goat cheese").
VEGETARIAN_CATEGORIES = (
    "Dairy and Egg Products",
    "Vegetables and Vegetable Products",
    "Fruits and Fruit Juices",
    "Spices and Herbs",
    "Nut and Seed Products",
    "Cereal Grains and Pasta",
)
# Mixed categories (soups, fast food, entrees) can contain meat, so check the name too.
MEAT_WORDS = re.compile(
    r"\b(chicken|beef|pork|lamb|mutton|goat|veal|turkey|duck|goose|quail|pheasant|rabbit|venison|bison|"
    r"buffalo|elk|moose|caribou|whale|seal|sea lion|walrus|(?<!sauce, )steak(?! (?:fries|cut|sauce))|sirloin|salisbury|"
    r"tripe|tongue|marrow|giblets?|gizzards?|smelt|eel|"
    r"ham|bacon|sausages?|pepperoni|salami|bologna|frankfurters?|hot ?dogs?|jerky|pastrami|chorizo|"
    r"prosciutto|bratwurst|kielbasa|liverwurst|corned|hamburgers?|cheeseburgers?|meatballs?|meatloaf|"
    r"liver|lard|tallow|suet|\w*fish|salmon|tuna|cod|haddock|halibut|tilapia|trout|sardines?|herring|"
    r"mackerel|pollock|snapper|shrimp|prawns?|crab|lobster|cray\w*|craw\w*|clams?|oysters?|mussels?|"
    r"scallops?|squid|calamari|octopus|caviar|roe|anchov\w*|meats?|gelatin)\b",
    re.I,
)
# Free-tier embedding quota rules out the full ~8k foods, so the core index keeps every
# Foundation Food plus the most generic SR Legacy items (shortest names) from fitness-relevant
# categories. Branded, restaurant, baby and dessert categories are left out.
CORE_CATEGORY_CAPS = {
    "Vegetables and Vegetable Products": 70,
    "Finfish and Shellfish Products": 60,
    "Dairy and Egg Products": 60,
    "Fruits and Fruit Juices": 50,
    "Poultry Products": 50,
    "Beef Products": 50,
    "Legumes and Legume Products": 50,
    "Cereal Grains and Pasta": 50,
    "Nut and Seed Products": 40,
    "Pork Products": 30,
    "Lamb, Veal, and Game Products": 15,
    "Fats and Oils": 15,
    "Baked Products": 20,
    "Breakfast Cereals": 10,
    "Sausages and Luncheon Meats": 10,
}
BRAND = re.compile(r"\b[A-Z][A-Z'&.]{2,}\b")

# Meat analogues ("Bacon, meatless", "Vegetarian meatloaf", soy "Meat extender") name the meat they replace.
MEATLESS_WORDS = re.compile(r"\b(meatless|vegetarian|vegan|veggie|plant[- ]based|meat extender)\b", re.I)


def is_vegetarian(description: str, category: str) -> bool:
    if category in MEAT_CATEGORIES:
        return False
    if category in VEGETARIAN_CATEGORIES:
        return True
    return bool(MEATLESS_WORDS.search(description)) or not MEAT_WORDS.search(description)


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
    fiber = amounts.get("291")
    if not description or None in (kcal, protein, fat, carbs):
        return None

    category = (food.get("foodCategory") or {}).get("description", "")
    parsed = {
        "id": f"fdc-{food.get('fdcId', description)}",
        "text": (
            f"Food: {description}. Nutrients per 100g: protein {protein:.1f}g, "
            f"carbs {carbs:.1f}g, fat {fat:.1f}g, kcal {kcal:.0f}."
        ),
        "data_type": food.get("dataType", ""),
        "metadata": {
            "description": description,
            "category": category,
            "protein_g": round(protein, 1),
            "carbs_g": round(carbs, 1),
            "fat_g": round(fat, 1),
            "kcal": round(kcal),
            "is_vegetarian": is_vegetarian(description, category),
        },
    }
    # Fiber stays out of the embedded text (changing it would mean re-embedding);
    # annotate() adds it to the context at query time.
    if fiber is not None:
        parsed["metadata"]["fiber_g"] = round(fiber, 1)
    return parsed


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


def select_core(foods: list[dict]) -> list[dict]:
    core = [f for f in foods if f["data_type"] == "Foundation"]
    by_category: dict[str, list[dict]] = {}
    for f in foods:
        meta = f["metadata"]
        if f["data_type"] != "Foundation" and meta["category"] in CORE_CATEGORY_CAPS and not BRAND.search(meta["description"]):
            by_category.setdefault(meta["category"], []).append(f)
    for category, items in by_category.items():
        items.sort(key=lambda f: len(f["metadata"]["description"]))
        core.extend(items[: CORE_CATEGORY_CAPS[category]])
    return core
