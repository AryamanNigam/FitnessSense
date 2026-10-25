from app.services.gemini_client import generate_json
from app.services.splits import muscles_for


def generate_workout(goal: str, activity_level: str, focus: str = "full_body") -> dict:
    muscles = muscles_for(focus)
    muscle_line = ", ".join(muscles) if muscles else "full body"

    prompt = f"""You are a certified personal trainer. Generate a single workout session for today.

User profile:
- Goal: {goal} (cut = lose fat, bulk = gain muscle, maintain = maintain weight)
- Activity level: {activity_level}

Today's session focus: {focus}
Target these muscle groups: {muscle_line}

Return a JSON object with this exact structure:
{{
  "exercises": [
    {{
      "exercise": "Barbell Squat",
      "sets": 4,
      "reps": "8-10",
      "rest_s": 90
    }}
  ],
  "notes": "Focus on controlled eccentric tempo today."
}}

Requirements:
- Every exercise must primarily train one of the target muscle groups: {muscle_line}
- Include 5-8 exercises appropriate for the user's goal and activity level
- reps can be a range (e.g. "8-12"), a single number (e.g. "10"), or "failure" for burnout sets
- rest_s is rest time between sets in seconds
- notes should be one short coaching cue or focus point for the session
- All numeric fields (sets, rest_s) must be numbers, not strings"""

    result = generate_json(prompt)
    result["session_focus"] = focus
    return result
