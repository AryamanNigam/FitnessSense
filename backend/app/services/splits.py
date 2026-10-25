"""Workout split domain config.

A "split" is one 7-day weekly schedule mapping each weekday to a session focus
(or "rest"). Every split style — 3/6-day PPL, 5-day bro split, custom — is just
a different fill of that same schedule. This module is the single source of truth
for the focus vocabulary, the preset schedules, and the focus -> muscle-group map
used to steer generation.
"""

from datetime import date

# Weekday keys, in order. Index matches date.weekday() (0=Mon … 6=Sun), so
# WEEKDAYS[date.today().weekday()] is today's key.
WEEKDAYS: list[str] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# The full focus vocabulary. "rest" is a valid schedule value but never generates.
FOCUSES: frozenset[str] = frozenset(
    {
        "push", "pull", "legs",
        "chest", "back", "shoulders", "arms",
        "upper", "lower", "full_body",
        "rest",
    }
)

# Split types the user can pick. "custom" has no preset schedule — the user builds it.
SPLIT_TYPES: frozenset[str] = frozenset({"ppl_3", "ppl_6", "bro_5", "custom"})

# Each focus expands to the muscle groups fed into the generation prompt, so Gemini
# targets the right areas. "rest" maps to nothing (no session is generated).
MUSCLE_GROUPS: dict[str, list[str]] = {
    "push": ["chest", "front delts", "triceps"],
    "pull": ["back", "biceps", "rear delts"],
    "legs": ["quads", "hamstrings", "glutes", "calves"],
    "chest": ["chest"],
    "back": ["lats", "traps", "rhomboids"],
    "shoulders": ["front delts", "side delts", "rear delts"],
    "arms": ["biceps", "triceps", "forearms"],
    "upper": ["chest", "back", "shoulders", "arms"],
    "lower": ["quads", "hamstrings", "glutes", "calves"],
    "full_body": ["chest", "back", "legs", "shoulders", "arms"],
    "rest": [],
}

# Preset weekly schedules. Selecting a preset copies its schedule into the user's
# profile; "custom" is intentionally absent (the user fills a blank schedule).
PRESET_SCHEDULES: dict[str, dict[str, str]] = {
    # 3-day PPL: train Mon/Wed/Fri, rest the rest.
    "ppl_3": {
        "mon": "push", "tue": "rest", "wed": "pull",
        "thu": "rest", "fri": "legs", "sat": "rest", "sun": "rest",
    },
    # 6-day PPL: PPL twice, one rest day.
    "ppl_6": {
        "mon": "push", "tue": "pull", "wed": "legs",
        "thu": "push", "fri": "pull", "sat": "legs", "sun": "rest",
    },
    # 5-day bro split: one muscle group per day, two rest days.
    "bro_5": {
        "mon": "chest", "tue": "back", "wed": "shoulders",
        "thu": "legs", "fri": "arms", "sat": "rest", "sun": "rest",
    },
}


def muscles_for(focus: str) -> list[str]:
    """Muscle groups a focus targets. Unknown focus -> empty list."""
    return MUSCLE_GROUPS.get(focus, [])


def is_valid_schedule(schedule: dict[str, str]) -> bool:
    """A schedule must cover exactly the 7 weekdays with values from FOCUSES."""
    if set(schedule.keys()) != set(WEEKDAYS):
        return False
    return all(focus in FOCUSES for focus in schedule.values())


def focus_for_today(schedule: dict[str, str]) -> str:
    """The focus scheduled for today's weekday. Missing day -> 'rest'."""
    today_key = WEEKDAYS[date.today().weekday()]
    return schedule.get(today_key, "rest")
