from pydantic import BaseModel
from typing import Literal, Optional
from datetime import date


class MealItem(BaseModel):
    name: str
    kcal: int
    protein_g: float
    carbs_g: float
    fat_g: float


class GeneratedMeal(BaseModel):
    meal_name: str
    items: list[MealItem]
    total_kcal: int
    instructions: list[str]


class MealPlanResponse(BaseModel):
    meals: list[GeneratedMeal]


class MealGenerateRequest(BaseModel):
    mode: Literal["ingredients", "random"]
    ingredients: Optional[list[str]] = None


class MealLogCreate(BaseModel):
    meal_name: str
    items: list[MealItem]
    total_kcal: int
    instructions: list[str]
    logged_at: date


class MealLogResponse(BaseModel):
    id: str
    user_id: str
    meal_name: str
    items: list[MealItem]
    total_kcal: int
    instructions: Optional[list[str]] = []
    logged_at: date
