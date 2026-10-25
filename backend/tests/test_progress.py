from datetime import date

from app.services.progress_service import build_summary

TODAY = date(2026, 8, 10)


def test_summary_fills_every_day_in_window():
    summary = build_summary([], [], [], tdee=2000, days=7, today=TODAY)
    assert len(summary["daily"]) == 7
    assert summary["daily"][0]["date"] == "2026-08-04"
    assert summary["daily"][-1]["date"] == "2026-08-10"
    assert summary["avg_kcal"] == 0
    assert summary["weight"]["change_kg"] is None


def test_summary_sums_kcal_per_day_and_averages_logged_days():
    meals = [
        {"total_kcal": 500, "logged_at": "2026-08-10"},
        {"total_kcal": 700, "logged_at": "2026-08-10T08:00:00+00:00"},
        {"total_kcal": 1000, "logged_at": "2026-08-09"},
        {"total_kcal": 999, "logged_at": "2026-01-01"},
    ]
    summary = build_summary(meals, [], [], tdee=2000, days=7, today=TODAY)
    assert summary["daily"][-1]["kcal"] == 1200
    assert summary["days_with_meals"] == 2
    assert summary["avg_kcal"] == 1100


def test_summary_counts_workouts_in_window():
    workouts = [{"logged_at": "2026-08-10"}, {"logged_at": "2026-08-08"}, {"logged_at": "2026-07-01"}]
    summary = build_summary([], workouts, [], tdee=2000, days=7, today=TODAY)
    assert summary["workouts_completed"] == 2


def test_summary_weight_change_uses_earliest_and_latest_in_window():
    weights = [
        {"weight_kg": 80.0, "logged_at": "2026-08-05"},
        {"weight_kg": 78.5, "logged_at": "2026-08-10"},
        {"weight_kg": 90.0, "logged_at": "2026-01-01"},
    ]
    summary = build_summary([], [], weights, tdee=2000, days=7, today=TODAY)
    assert summary["weight"] == {"start_kg": 80.0, "latest_kg": 78.5, "change_kg": -1.5}
