from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel, EmailStr
import httpx
from app.dependencies import get_supabase
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "refresh_token"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def _is_prod() -> bool:
    return settings.environment == "production"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=_is_prod(),
        samesite="none" if _is_prod() else "lax",
        max_age=COOKIE_MAX_AGE,
        path="/api/v1/auth",
    )


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/signup")
def signup(body: AuthRequest, response: Response):
    supabase = get_supabase()
    try:
        res = supabase.auth.sign_up({"email": body.email, "password": body.password})
        if res.session:
            _set_refresh_cookie(response, res.session.refresh_token)
            return {
                "user": {"id": res.user.id, "email": res.user.email},
                "access_token": res.session.access_token,
            }
        return {
            "user": {"id": res.user.id, "email": res.user.email},
            "access_token": None,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/login")
def login(body: AuthRequest, response: Response):
    supabase = get_supabase()
    try:
        res = supabase.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    session = res.session
    _set_refresh_cookie(response, session.refresh_token)
    return {
        "user": {"id": res.user.id, "email": res.user.email},
        "access_token": session.access_token,
    }


@router.post("/refresh")
def refresh(response: Response, refresh_token: str | None = Cookie(default=None)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        r = httpx.post(
            f"{settings.supabase_url}/auth/v1/token?grant_type=refresh_token",
            json={"refresh_token": refresh_token},
            headers={"apikey": settings.supabase_anon_key, "Content-Type": "application/json"},
            timeout=10.0,
        )
        r.raise_for_status()
        data = r.json()
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Auth service temporarily unavailable")

    _set_refresh_cookie(response, data["refresh_token"])
    return {"access_token": data["access_token"]}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/api/v1/auth",
        secure=_is_prod(),
        samesite="none" if _is_prod() else "lax",
    )
    return {"ok": True}
