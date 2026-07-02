from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.dependencies import get_supabase, get_current_user
from app.models.weight import WeightLogCreate, WeightLogResponse

router = APIRouter(prefix="/weight", tags=["weight"])


@router.get("/logs", response_model=list[WeightLogResponse])
def get_weight_logs(
    date: str | None = None,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    query = supabase.table("weight_logs").select("*").eq("user_id", user_id)
    if date:
        query = query.eq("logged_at", date)
    result = query.order("logged_at", desc=True).execute()
    return result.data


@router.post("/logs", response_model=WeightLogResponse, status_code=201)
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


@router.delete("/logs/{log_id}", status_code=204)
def delete_weight_log(
    log_id: str,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    supabase.table("weight_logs").delete().eq("id", log_id).eq("user_id", user_id).execute()
