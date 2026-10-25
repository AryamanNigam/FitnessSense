from pydantic import BaseModel
from datetime import date
from typing import Optional


class DailyProgress(BaseModel):
    date: date
    kcal: int
    workouts: int


class WeightSummary(BaseModel):
    start_kg: Optional[float] = None
    latest_kg: Optional[float] = None
    change_kg: Optional[float] = None


class ProgressSummary(BaseModel):
    days: int
    calorie_target: int
    avg_kcal: int
    days_with_meals: int
    workouts_completed: int
    weight: WeightSummary
    daily: list[DailyProgress]
