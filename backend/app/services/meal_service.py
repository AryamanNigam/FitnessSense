from app.services.gemini_client import generate_json


def generate_meal_plan(
    tdee: int,
    protein_target_g: int,
    goal: str,
    mode: str,
    ingredients: list[str] | None,
) -> dict:

    if mode == "ingredients" and ingredients:
        ingredient_clause = (
            f"Use ONLY these ingredients (combine them in different preparations): "
            f"{', '.join(ingredients)}."
        )
    else:
        ingredient_clause = (
            "Choose nutritious, whole foods freely to best meet the targets."
        )

    prompt = f"""You are a professional nutritionist. Generate a complete daily meal plan.

User profile:
- Daily calorie target: {tdee} kcal
- Protein target: {protein_target_g}g
- Goal: {goal} (cut = lose fat, bulk = gain muscle, maintain = maintain weight)

{ingredient_clause}

Return a JSON object with this exact structure:
{{
  "meals": [
    {{
      "meal_name": "Breakfast",
      "items": [
        {{"name": "Scrambled eggs", "kcal": 200, "protein_g": 14.0, "carbs_g": 2.0, "fat_g": 15.0}}
      ],
      "total_kcal": 200,
      "instructions": [
        "Crack 3 eggs into a bowl and whisk with a pinch of salt.",
        "Heat a non-stick pan over medium heat and add a small knob of butter.",
        "Pour in the eggs and stir gently until just set. Remove from heat while still slightly glossy."
      ]
    }}
  ]
}}

Requirements:
- Include 3-5 meals: Breakfast, Lunch, Dinner, and optionally 1-2 snacks
- Total kcal across all meals must be within 100 kcal of {tdee}
- Each meal's total_kcal must equal the sum of its items' kcal values
- Use realistic portion sizes with accurate macro values
- instructions must be a list of clear, numbered cooking steps for that meal
- All numeric fields must be numbers, not strings"""

    return generate_json(prompt)
