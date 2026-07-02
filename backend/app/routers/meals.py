from fastapi import APIRouter, Depends, HTTPException, Request
from supabase import Client
from app.dependencies import get_supabase, get_current_user
from app.core.rate_limit import check_rate_limit
from app.models.meals import (
    MealGenerateRequest,
    MealPlanResponse,
    MealLogCreate,
    MealLogResponse,
)
from app.services.meal_service import generate_meal_plan

router = APIRouter(prefix="/meals", tags=["meals"])


@router.post("/generate", response_model=MealPlanResponse)
def generate_meals(
    body: MealGenerateRequest,
    request: Request,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    check_rate_limit(request, user_id)
    profile = (
        supabase.table("profiles")
        .select("tdee, protein_target_g, goal")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not profile or not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return generate_meal_plan(
        tdee=profile.data["tdee"],
        protein_target_g=profile.data["protein_target_g"],
        goal=profile.data["goal"],
        mode=body.mode,
        ingredients=body.ingredients,
    )


@router.get("/logs", response_model=list[MealLogResponse])
def get_meal_logs(
    date: str | None = None,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    query = supabase.table("meal_logs").select("*").eq("user_id", user_id)
    if date:
        try:
            from datetime import date as date_type
            date_type.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        query = query.eq("logged_at", date)
    result = query.order("logged_at", desc=True).execute()
    return result.data


@router.post("/logs", response_model=MealLogResponse, status_code=201)
def save_meal_log(
    body: MealLogCreate,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    data = {
        "user_id": user_id,
        "meal_name": body.meal_name,
        "items": [item.model_dump() for item in body.items],
        "total_kcal": body.total_kcal,
        "instructions": body.instructions,
        "logged_at": str(body.logged_at),
    }
    result = supabase.table("meal_logs").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to save meal log")
    return result.data[0]


@router.delete("/logs/{log_id}", status_code=204)
def delete_meal_log(
    log_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = (
        supabase.table("meal_logs")
        .delete()
        .eq("id", log_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Log not found")
