from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.dependencies import get_supabase, get_current_user
from app.models.profile import ProfileCreate, ProfileUpdate, ProfileResponse, SplitUpdate
from app.services.profile_service import compute_tdee, compute_protein_target
from app.services.splits import PRESET_SCHEDULES, is_valid_schedule

router = APIRouter(prefix="/profile", tags=["profile"])


@router.post("", response_model=ProfileResponse, status_code=201)
def create_profile(
    body: ProfileCreate,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    tdee = compute_tdee(body.weight_kg, body.height_cm, body.age, body.activity_level)
    protein = compute_protein_target(body.weight_kg, body.goal)

    data = {
        "id": user_id,
        **body.model_dump(),
        "tdee": tdee,
        "protein_target_g": protein,
    }

    result = supabase.table("profiles").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create profile")
    return result.data[0]


@router.get("/me", response_model=ProfileResponse)
def get_profile(
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    if not result or not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data


@router.patch("/me", response_model=ProfileResponse)
def update_profile(
    body: ProfileUpdate,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    if any(k in updates for k in ("weight_kg", "height_cm", "age", "activity_level", "goal")):
        current = supabase.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
        if not current or not current.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        merged = {**current.data, **updates}
        updates["tdee"] = compute_tdee(
            merged["weight_kg"], merged["height_cm"], merged["age"], merged["activity_level"]
        )
        updates["protein_target_g"] = compute_protein_target(merged["weight_kg"], merged["goal"])

    result = supabase.table("profiles").update(updates).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]


@router.patch("/split", response_model=ProfileResponse)
def set_split(
    body: SplitUpdate,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Presets are authoritative: fill the schedule from server config so it can't
    # drift. `custom` must supply its own valid 7-day schedule.
    if body.split_type == "custom":
        if body.schedule is None or not is_valid_schedule(body.schedule):
            raise HTTPException(
                status_code=400,
                detail="A custom split requires a valid schedule mapping mon–sun to focus values.",
            )
        schedule = body.schedule
    else:
        schedule = PRESET_SCHEDULES[body.split_type]

    split = {"split_type": body.split_type, "schedule": schedule}

    result = (
        supabase.table("profiles")
        .update({"workout_split": split})
        .eq("id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]
