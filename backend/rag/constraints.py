import logging
import re

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.services.gemini_client import generate_json

logger = logging.getLogger("fitnesssense")

# Only pay for an extraction call when the question could carry a constraint.
MAX_PORTION_G = 500

_HINT = re.compile(r"\d|vegetarian|vegan|meatless|plant[- ]based|low[- ]cal|high[- ]protein", re.I)

EXTRACT_PROMPT = """Extract numeric and dietary food constraints from the question below.
Return JSON with only these keys, using null when the question does not state it:
- "min_protein_per_meal_g": protein the user wants in one meal/serving, in grams
- "min_protein_per_100g": protein density per 100 g, only if the user says "per 100g"
- "max_kcal_per_100g": calorie ceiling per 100 g, only if the user says "per 100g"
- "vegetarian": true if the user wants vegetarian/vegan/meatless food, else false
Do not guess values that are not in the question.

Question: {question}"""


class Constraints(BaseModel):
    min_protein_per_meal_g: float | None = Field(default=None, gt=0, le=300)
    min_protein_per_100g: float | None = Field(default=None, gt=0, le=100)
    max_kcal_per_100g: float | None = Field(default=None, gt=0, le=900)
    vegetarian: bool = False

    @field_validator("vegetarian", mode="before")
    @classmethod
    def _null_is_false(cls, value):
        return bool(value)

    def is_empty(self) -> bool:
        return self == Constraints()


def extract_constraints(question: str) -> Constraints:
    if not _HINT.search(question):
        return Constraints()
    try:
        return Constraints.model_validate(generate_json(EXTRACT_PROMPT.format(question=question)))
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
    if not clauses:
        return None
    return clauses[0] if len(clauses) == 1 else {"$and": clauses}


def matches(c: Constraints, metadata: dict) -> bool:
    """Same rules as to_where, for candidates that don't come from Chroma (BM25)."""
    if c.min_protein_per_100g is not None and metadata.get("protein_g", 0) < c.min_protein_per_100g:
        return False
    if c.max_kcal_per_100g is not None and metadata.get("kcal", 0) > c.max_kcal_per_100g:
        return False
    if c.vegetarian and not metadata.get("is_vegetarian", False):
        return False
    return True


def portion_grams(target_protein_g: float, protein_per_100g: float) -> int | None:
    if protein_per_100g <= 0:
        return None
    return round(target_protein_g / protein_per_100g * 100)


def annotate(text: str, metadata: dict, c: Constraints) -> str:
    """Append the computed portion so the LLM quotes our arithmetic instead of doing its own."""
    if c.min_protein_per_meal_g is None:
        return text
    grams = portion_grams(c.min_protein_per_meal_g, metadata.get("protein_g", 0))
    if grams is None:
        return f"{text} Contains no protein, so it cannot reach {c.min_protein_per_meal_g:.0f}g."
    if grams > MAX_PORTION_G:
        return f"{text} Would need about {grams}g to reach {c.min_protein_per_meal_g:.0f}g protein, too much for one meal (computed)."
    return f"{text} Portion for {c.min_protein_per_meal_g:.0f}g protein: about {grams}g (computed)."
