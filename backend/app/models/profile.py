from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime

Goal = Literal["cut", "bulk", "maintain"]
ActivityLevel = Literal["sedentary", "light", "moderate", "active", "very_active"]


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
    created_at: datetime
    updated_at: datetime
