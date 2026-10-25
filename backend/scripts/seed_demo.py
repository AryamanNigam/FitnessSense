import random
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.dependencies import get_supabase
from app.services.profile_service import compute_protein_target, compute_tdee
from app.services.splits import PRESET_SCHEDULES

DEMO_EMAIL = "demo@fitnesssense.app"
DEMO_PASSWORD = "FitnessSense-Demo-1"
DAYS = 21

MEALS = [
    ("Breakfast", [("Oats with banana", 380, 12, 62, 8), ("Greek yogurt", 130, 17, 6, 4)]),
    ("Lunch", [("Grilled chicken breast", 280, 52, 0, 6), ("Brown rice", 215, 5, 45, 2), ("Broccoli", 55, 4, 11, 1)]),
    ("Dinner", [("Baked salmon", 360, 34, 0, 22), ("Sweet potato", 180, 4, 41, 0)]),
]

WORKOUTS = [
    {"exercise": "Barbell Bench Press", "sets": 4, "reps": "6-8", "rest_s": 120},
    {"exercise": "Incline Dumbbell Press", "sets": 3, "reps": "8-10", "rest_s": 90},
    {"exercise": "Cable Fly", "sets": 3, "reps": "12-15", "rest_s": 60},
    {"exercise": "Triceps Pushdown", "sets": 3, "reps": "10-12", "rest_s": 60},
]


def find_or_create_user(supabase) -> str:
    try:
        created = supabase.auth.admin.create_user(
            {"email": DEMO_EMAIL, "password": DEMO_PASSWORD, "email_confirm": True}
        )
        return created.user.id
    except Exception:
        users = supabase.auth.admin.list_users()
        return next(u.id for u in users if u.email == DEMO_EMAIL)


def main() -> None:
    supabase = get_supabase()
    user_id = find_or_create_user(supabase)
    rng = random.Random(7)

    profile = {
        "id": user_id,
        "name": "Demo User",
        "age": 27,
        "weight_kg": 82.0,
        "height_cm": 178.0,
        "goal": "cut",
        "activity_level": "moderate",
    }
    profile["tdee"] = compute_tdee(profile["weight_kg"], profile["height_cm"], profile["age"], profile["activity_level"])
    profile["protein_target_g"] = compute_protein_target(profile["weight_kg"], profile["goal"])
    profile["workout_split"] = {"split_type": "ppl_3", "schedule": PRESET_SCHEDULES["ppl_3"]}
    supabase.table("profiles").upsert(profile).execute()

    for table in ("meal_logs", "workout_logs", "weight_logs"):
        supabase.table(table).delete().eq("user_id", user_id).execute()

    today = date.today()
    meal_rows, workout_rows, weight_rows = [], [], []
    for offset in range(DAYS - 1, -1, -1):
        day = today - timedelta(days=offset)
        weight_rows.append(
            {"user_id": user_id, "weight_kg": round(82.0 - (DAYS - 1 - offset) * 0.09 + rng.uniform(-0.3, 0.3), 1), "logged_at": day.isoformat()}
        )
        if rng.random() < 0.85:
            for name, items in MEALS:
                meal_rows.append(
                    {
                        "user_id": user_id,
                        "meal_name": name,
                        "items": [
                            {"name": n, "kcal": k, "protein_g": p, "carbs_g": c, "fat_g": f}
                            for n, k, p, c, f in items
                        ],
                        "total_kcal": sum(i[1] for i in items),
                        "instructions": ["Prepare the ingredients.", "Cook and serve."],
                        "logged_at": day.isoformat(),
                    }
                )
        if day.weekday() in (0, 2, 4):
            workout_rows.append(
                {
                    "user_id": user_id,
                    "plan": WORKOUTS,
                    "notes": "Control the eccentric on every rep.",
                    "session_focus": "push",
                    "logged_at": day.isoformat(),
                }
            )

    supabase.table("weight_logs").insert(weight_rows).execute()
    supabase.table("meal_logs").insert(meal_rows).execute()
    supabase.table("workout_logs").insert(workout_rows).execute()

    print(f"Seeded demo account: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    print(f"{len(weight_rows)} weight logs, {len(meal_rows)} meal logs, {len(workout_rows)} workout logs")


if __name__ == "__main__":
    main()
