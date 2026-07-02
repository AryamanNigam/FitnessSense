from pydantic import BaseModel
from typing import Optional
from datetime import date


class WorkoutExercise(BaseModel):
    exercise: str
    sets: int
    reps: str
    rest_s: int


class GeneratedWorkout(BaseModel):
    exercises: list[WorkoutExercise]
    notes: str



class WorkoutLogCreate(BaseModel):
    plan: list[WorkoutExercise]
    notes: Optional[str] = None
    logged_at: date


class WorkoutLogResponse(BaseModel):
    id: str
    user_id: str
    plan: list[WorkoutExercise]
    notes: Optional[str] = None
    logged_at: date
