from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from datetime import datetime

from app.services.splits import is_valid_schedule

Goal = Literal["cut", "bulk", "maintain"]
ActivityLevel = Literal["sedentary", "light", "moderate", "active", "very_active"]
SplitType = Literal["ppl_3", "ppl_6", "bro_5", "custom"]


class WorkoutSplit(BaseModel):
    """The split as stored on the profile and returned in responses."""
    split_type: SplitType
    schedule: dict[str, str]  # weekday -> focus | "rest"

    @field_validator("schedule")
    @classmethod
    def _schedule_covers_the_week(cls, v: dict[str, str]) -> dict[str, str]:
        if not is_valid_schedule(v):
            raise ValueError("schedule must map exactly mon–sun to valid focus values")
        return v


class SplitUpdate(BaseModel):
    """Request body for PATCH /profile/split.

    For a preset (ppl_3 / ppl_6 / bro_5) the client can send just the type — the
    backend fills the schedule authoritatively. For `custom`, schedule is required.
    """
    split_type: SplitType
    schedule: Optional[dict[str, str]] = None


class ProfileCreate(BaseModel):
    name: str
    age: int = Field(ge=10, le=120)
    weight_kg: float = Field(gt=0, le=500)
    height_cm: float = Field(gt=0, le=300)
    goal: Goal
    activity_level: ActivityLevel


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = Field(None, ge=10, le=120)
    weight_kg: Optional[float] = Field(None, gt=0, le=500)
    height_cm: Optional[float] = Field(None, gt=0, le=300)
    goal: Optional[Goal] = None
    activity_level: Optional[ActivityLevel] = None


class ProfileResponse(BaseModel):
    id: str
    name: str
    age: int
    weight_kg: float
    height_cm: float
    goal: Goal
    activity_level: ActivityLevel
    tdee: int
    protein_target_g: int
    workout_split: Optional[WorkoutSplit] = None
    created_at: datetime
    updated_at: datetime
