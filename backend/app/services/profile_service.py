from app.models.profile import Goal, ActivityLevel

ACTIVITY_MULTIPLIERS: dict[str, float] = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}

PROTEIN_MULTIPLIERS: dict[str, float] = {
    "cut": 2.2,
    "bulk": 1.8,
    "maintain": 2.0,
}


def compute_tdee(weight_kg: float, height_cm: float, age: int, activity_level: ActivityLevel) -> int:
    # Mifflin-St Jeor sex-neutral average (male: +5, female: -161, midpoint: -78)
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 78
    return round(bmr * ACTIVITY_MULTIPLIERS[activity_level])


def compute_protein_target(weight_kg: float, goal: Goal) -> int:
    return round(weight_kg * PROTEIN_MULTIPLIERS[goal])
