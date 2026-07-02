from fastapi import APIRouter, Depends, HTTPException, Request
from supabase import Client
from app.dependencies import get_supabase, get_current_user
from app.core.rate_limit import check_rate_limit
from app.models.workouts import (
    GeneratedWorkout,
    WorkoutLogCreate,
    WorkoutLogResponse,
)
from app.services.workout_service import generate_workout

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.post("/generate", response_model=GeneratedWorkout)
def generate_workout_plan(
    request: Request,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    check_rate_limit(request, user_id)
    profile = (
        supabase.table("profiles")
        .select("goal, activity_level")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not profile or not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return generate_workout(
        goal=profile.data["goal"],
        activity_level=profile.data["activity_level"],
    )


@router.get("/logs", response_model=list[WorkoutLogResponse])
def get_workout_logs(
    date: str | None = None,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    query = supabase.table("workout_logs").select("*").eq("user_id", user_id)
    if date:
        try:
            from datetime import date as date_type
            date_type.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        query = query.eq("logged_at", date)
    result = query.order("logged_at", desc=True).execute()
    return result.data


@router.post("/logs", response_model=WorkoutLogResponse, status_code=201)
def save_workout_log(
    body: WorkoutLogCreate,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    data = {
        "user_id": user_id,
        "plan": [exercise.model_dump() for exercise in body.plan],
        "notes": body.notes,
        "logged_at": str(body.logged_at),
    }
    result = supabase.table("workout_logs").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to save workout log")
    return result.data[0]


@router.delete("/logs/{log_id}", status_code=204)
def delete_workout_log(
    log_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = (
        supabase.table("workout_logs")
        .delete()
        .eq("id", log_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Log not found")
