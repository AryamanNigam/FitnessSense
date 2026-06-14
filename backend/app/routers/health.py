from fastapi import APIRouter, Depends
from supabase import Client
from app.dependencies import get_supabase

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(supabase: Client = Depends(get_supabase)):
    try:
        supabase.table("profiles").select("id").limit(1).execute()
        db_status = "ok"
    except Exception:
        db_status = "error"
    return {"status": "ok", "db": db_status}
