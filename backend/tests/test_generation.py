from app.services import meal_service, workout_service
from app.services.splits import (
    FOCUSES,
    MUSCLE_GROUPS,
    PRESET_SCHEDULES,
    WEEKDAYS,
    is_valid_schedule,
    muscles_for,
)


def _capture(monkeypatch, module):
    captured = {}

    def fake(prompt):
        captured["prompt"] = prompt
        return {"exercises": [], "notes": "", "meals": []}

    monkeypatch.setattr(module, "generate_json", fake)
    return captured


def test_meal_prompt_includes_targets_and_goal(monkeypatch):
    captured = _capture(monkeypatch, meal_service)
    meal_service.generate_meal_plan(2200, 150, "cut", "random", None)
    assert "2200" in captured["prompt"]
    assert "150g" in captured["prompt"]
    assert "cut" in captured["prompt"]
    assert "freely" in captured["prompt"]


def test_meal_prompt_restricts_to_ingredients(monkeypatch):
    captured = _capture(monkeypatch, meal_service)
    meal_service.generate_meal_plan(2000, 140, "bulk", "ingredients", ["rice", "eggs"])
    assert "rice, eggs" in captured["prompt"]
    assert "ONLY" in captured["prompt"]


def test_meal_ingredients_mode_without_ingredients_falls_back(monkeypatch):
    captured = _capture(monkeypatch, meal_service)
    meal_service.generate_meal_plan(2000, 140, "bulk", "ingredients", [])
    assert "ONLY" not in captured["prompt"]


def test_workout_prompt_targets_focus_muscles(monkeypatch):
    captured = _capture(monkeypatch, workout_service)
    result = workout_service.generate_workout("bulk", "moderate", "pull")
    assert "back, biceps, rear delts" in captured["prompt"]
    assert result["session_focus"] == "pull"


def test_presets_are_valid_and_cover_the_week():
    for schedule in PRESET_SCHEDULES.values():
        assert is_valid_schedule(schedule)
        assert list(schedule) == WEEKDAYS


def test_invalid_schedules_are_rejected():
    assert not is_valid_schedule({"mon": "push"})
    assert not is_valid_schedule({**PRESET_SCHEDULES["ppl_3"], "mon": "cardio"})


def test_every_focus_has_a_muscle_mapping():
    assert set(MUSCLE_GROUPS) == set(FOCUSES)
    assert muscles_for("rest") == []
    assert muscles_for("unknown") == []
