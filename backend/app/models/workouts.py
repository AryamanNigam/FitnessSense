from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date

from app.services.splits import FOCUSES


class WorkoutExercise(BaseModel):
    exercise: str
    sets: int
    reps: str
    rest_s: int


class WorkoutGenerateRequest(BaseModel):
    """Optional body for POST /workouts/generate.

    `focus` overrides today's scheduled focus. Omitted -> the endpoint derives
    focus from the user's split (or falls back to full_body).
    """
    focus: Optional[str] = None

    @field_validator("focus")
    @classmethod
    def _known_focus(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in FOCUSES:
            raise ValueError(f"focus must be one of {sorted(FOCUSES)}")
        return v


class GeneratedWorkout(BaseModel):
    exercises: list[WorkoutExercise]
    notes: str
    session_focus: str


class WorkoutLogCreate(BaseModel):
    plan: list[WorkoutExercise]
    notes: Optional[str] = None
    session_focus: Optional[str] = None
    logged_at: date


class WorkoutLogResponse(BaseModel):
    id: str
    user_id: str
    plan: list[WorkoutExercise]
    notes: Optional[str] = None
    session_focus: Optional[str] = None
    logged_at: date
