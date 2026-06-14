from app.services.profile_service import compute_tdee, compute_protein_target


def test_tdee_increases_with_activity():
    base = {"weight_kg": 70, "height_cm": 175, "age": 25}
    assert compute_tdee(**base, activity_level="sedentary") < compute_tdee(**base, activity_level="active")


def test_tdee_reasonable_range():
    tdee = compute_tdee(70, 175, 25, "moderate")
    assert 1500 < tdee < 2800


def test_protein_cut_highest():
    assert compute_protein_target(70, "cut") > compute_protein_target(70, "bulk")


def test_protein_values():
    assert compute_protein_target(70, "cut") == round(70 * 2.2)
    assert compute_protein_target(70, "bulk") == round(70 * 1.8)
    assert compute_protein_target(70, "maintain") == round(70 * 2.0)
