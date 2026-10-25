from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from app.dependencies import get_current_user, get_supabase
from app.models.progress import ProgressSummary
from app.models.weight import WeightLogCreate, WeightLogResponse
from app.services.progress_service import build_summary

router = APIRouter(prefix="/progress", tags=["progress"])


@router.post("/weight", response_model=WeightLogResponse, status_code=201)
def log_weight(
    body: WeightLogCreate,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    data = {"user_id": user_id, "weight_kg": body.weight_kg, "logged_at": str(body.logged_at)}
    result = supabase.table("weight_logs").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save weight log")
    return result.data[0]


@router.get("/weight", response_model=list[WeightLogResponse])
def get_weight_history(
    days: int = Query(30, ge=1, le=365),
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    since = (date.today() - timedelta(days=days - 1)).isoformat()
    result = (
        supabase.table("weight_logs")
        .select("*")
        .eq("user_id", user_id)
        .gte("logged_at", since)
        .order("logged_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/summary", response_model=ProgressSummary)
def get_summary(
    days: int = Query(30, ge=1, le=365),
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    today = date.today()
    since = (today - timedelta(days=days - 1)).isoformat()

    profile = supabase.table("profiles").select("tdee").eq("id", user_id).maybe_single().execute()
    if not profile or not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    def fetch(table: str, columns: str) -> list[dict]:
        return (
            supabase.table(table)
            .select(columns)
            .eq("user_id", user_id)
            .gte("logged_at", since)
            .execute()
            .data
        )

    return build_summary(
        meals=fetch("meal_logs", "total_kcal, logged_at"),
        workouts=fetch("workout_logs", "logged_at"),
        weights=fetch("weight_logs", "weight_kg, logged_at"),
        tdee=profile.data["tdee"],
        days=days,
        today=today,
    )
