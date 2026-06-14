from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from app.dependencies import get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/signup")
def signup(body: AuthRequest):
    supabase = get_supabase()
    try:
        res = supabase.auth.sign_up({"email": body.email, "password": body.password})
        return {"user": res.user, "session": res.session}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/login")
def login(body: AuthRequest):
    supabase = get_supabase()
    try:
        res = supabase.auth.sign_in_with_password({"email": body.email, "password": body.password})
        return {"user": res.user, "session": res.session}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
