from pydantic import BaseModel
from datetime import date


class WeightLogCreate(BaseModel):
    weight_kg: float
    logged_at: date


class WeightLogResponse(BaseModel):
    id: str
    user_id: str
    weight_kg: float
    logged_at: date
