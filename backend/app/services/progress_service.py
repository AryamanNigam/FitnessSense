from datetime import date, timedelta


def _day(value: str) -> str:
    return str(value)[:10]


def build_summary(
    meals: list[dict],
    workouts: list[dict],
    weights: list[dict],
    tdee: int,
    days: int,
    today: date,
) -> dict:
    window = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]
    kcal_by_day = {d.isoformat(): 0 for d in window}
    workouts_by_day = {d.isoformat(): 0 for d in window}

    for meal in meals:
        key = _day(meal["logged_at"])
        if key in kcal_by_day:
            kcal_by_day[key] += int(meal.get("total_kcal") or 0)

    for workout in workouts:
        key = _day(workout["logged_at"])
        if key in workouts_by_day:
            workouts_by_day[key] += 1

    in_window = [w for w in weights if _day(w["logged_at"]) in kcal_by_day]
    in_window.sort(key=lambda w: _day(w["logged_at"]))

    weight = {"start_kg": None, "latest_kg": None, "change_kg": None}
    if in_window:
        start = float(in_window[0]["weight_kg"])
        latest = float(in_window[-1]["weight_kg"])
        weight = {"start_kg": start, "latest_kg": latest, "change_kg": round(latest - start, 1)}

    logged_days = [v for v in kcal_by_day.values() if v > 0]

    return {
        "days": days,
        "calorie_target": tdee,
        "avg_kcal": round(sum(logged_days) / len(logged_days)) if logged_days else 0,
        "days_with_meals": len(logged_days),
        "workouts_completed": sum(workouts_by_day.values()),
        "weight": weight,
        "daily": [
            {"date": d.isoformat(), "kcal": kcal_by_day[d.isoformat()], "workouts": workouts_by_day[d.isoformat()]}
            for d in window
        ],
    }
