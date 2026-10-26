import logging
import re

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.services.gemini_client import generate_json

logger = logging.getLogger("fitnesssense")

MAX_PORTION_G = 500
# Extraction runs before the answer streams, so a hung call must not stall the chat.
EXTRACT_TIMEOUT_S = 8.0
# "More protein/fiber" without a number means a food that is a real source per 100 g.
HIGH_PROTEIN_PER_100G = 10
HIGH_FIBER_PER_100G = 3

# Only pay for an extraction call when the question could carry a constraint.
_HINT = re.compile(r"\d|vegetarian|vegan|meatless|plant[- ]based|low[- ]cal|protein|fib(er|re)", re.I)

EXTRACT_PROMPT = """Extract numeric and dietary food constraints from the question below.
Return JSON with only these keys, using null when the question does not state it:
- "min_protein_per_meal_g": protein the user wants in one meal/serving, in grams
- "min_protein_per_100g": protein density per 100 g, only if the user says "per 100g"
- "max_kcal_per_100g": calorie ceiling per 100 g, only if the user says "per 100g"
- "vegetarian": true if the user wants vegetarian/vegan/meatless food, else false
- "high_protein": true if the user wants more/high protein without giving a number, else false
- "high_fiber": true if the user wants more/high fiber, else false
- "search_query": a comma-separated list of 4-8 specific foods worth looking up in the USDA database
  to answer the question. Name ingredients to add, not the dish the user already has
  (e.g. "what can I add to oatmeal for protein" -> "Greek yogurt, eggs, milk, peanut butter, hemp seeds").
  Cover every goal the user names (e.g. a protein source and a fiber source). Unless the user
  wants vegetarian food, the list must include at least two meat, fish or egg foods.
Do not guess numeric values that are not in the question.

Question: {question}"""


class Constraints(BaseModel):
    min_protein_per_meal_g: float | None = Field(default=None, gt=0, le=300)
    min_protein_per_100g: float | None = Field(default=None, gt=0, le=100)
    max_kcal_per_100g: float | None = Field(default=None, gt=0, le=900)
    vegetarian: bool = False
    high_protein: bool = False
    high_fiber: bool = False
    # Retrieval query rewritten as foods to look up; "add protein to mac and cheese" would
    # otherwise retrieve cheeses, since the dish name dominates the embedding.
    search_query: str | None = Field(default=None, max_length=300)

    @field_validator("vegetarian", "high_protein", "high_fiber", mode="before")
    @classmethod
    def _null_is_false(cls, value):
        return bool(value)

    def is_empty(self) -> bool:
        return self == Constraints()


def extract_constraints(question: str) -> Constraints:
    if not _HINT.search(question):
        return Constraints()
    try:
        return Constraints.model_validate(generate_json(EXTRACT_PROMPT.format(question=question), timeout=EXTRACT_TIMEOUT_S))
    except ValidationError:
        logger.warning("Discarding invalid constraints extracted from %r", question)
    except Exception:
        logger.exception("Constraint extraction failed; retrieving without filters")
    return Constraints()


def to_where(c: Constraints) -> dict | None:
    """Chroma metadata filter. Per-meal protein is not filtered here: a food with 23 g/100g
    still reaches 50 g in a larger portion, so it is handled by portion_grams instead."""
    clauses = []
    if c.min_protein_per_100g is not None:
        clauses.append({"protein_g": {"$gte": c.min_protein_per_100g}})
    if c.max_kcal_per_100g is not None:
        clauses.append({"kcal": {"$lte": c.max_kcal_per_100g}})
    if c.vegetarian:
        clauses.append({"is_vegetarian": True})
    # Either goal may qualify a food: a dish combines a protein source with a fiber source,
    # and few single foods are high in both.
    goals = _goal_clauses(c)
    if goals:
        clauses.append(goals[0] if len(goals) == 1 else {"$or": goals})
    if not clauses:
        return None
    return clauses[0] if len(clauses) == 1 else {"$and": clauses}


def _goal_clauses(c: Constraints) -> list[dict]:
    goals = []
    if c.high_protein and c.min_protein_per_100g is None:
        goals.append({"protein_g": {"$gte": HIGH_PROTEIN_PER_100G}})
    if c.high_fiber:
        goals.append({"fiber_g": {"$gte": HIGH_FIBER_PER_100G}})
    return goals


def matches(c: Constraints, metadata: dict) -> bool:
    """Same rules as to_where, for candidates that don't come from Chroma (BM25)."""
    if c.min_protein_per_100g is not None and metadata.get("protein_g", 0) < c.min_protein_per_100g:
        return False
    if c.max_kcal_per_100g is not None and metadata.get("kcal", 0) > c.max_kcal_per_100g:
        return False
    if c.vegetarian and not metadata.get("is_vegetarian", False):
        return False
    goals = _goal_clauses(c)
    if goals and not any(
        metadata.get(field, 0) >= bound["$gte"] for goal in goals for field, bound in goal.items()
    ):
        return False
    return True


def portion_grams(target_protein_g: float, protein_per_100g: float) -> int | None:
    if protein_per_100g <= 0:
        return None
    return round(target_protein_g / protein_per_100g * 100)


def annotate(text: str, metadata: dict, c: Constraints) -> str:
    """Append fiber and the computed portion so the LLM quotes our numbers instead of its own."""
    if "fiber_g" in metadata:
        text = f"{text} Fiber {metadata['fiber_g']:.1f}g per 100g."
    if c.min_protein_per_meal_g is None:
        return text
    grams = portion_grams(c.min_protein_per_meal_g, metadata.get("protein_g", 0))
    if grams is None:
        return f"{text} Contains no protein, so it cannot reach {c.min_protein_per_meal_g:.0f}g."
    if grams > MAX_PORTION_G:
        return f"{text} Would need about {grams}g to reach {c.min_protein_per_meal_g:.0f}g protein, too much for one meal (computed)."
    return f"{text} Portion for {c.min_protein_per_meal_g:.0f}g protein: about {grams}g (computed)."
