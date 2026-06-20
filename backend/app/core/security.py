import httpx
from fastapi import HTTPException
from jose import jwt, JWTError
from app.config import settings

_jwks_cache: list | None = None


def _get_public_keys() -> list:
    global _jwks_cache
    if _jwks_cache is None:
        r = httpx.get(
            f"{settings.supabase_url}/auth/v1/.well-known/jwks.json",
            timeout=10.0,
        )
        r.raise_for_status()
        _jwks_cache = r.json().get("keys", [])
    return _jwks_cache


def verify_token(token: str) -> str:
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "RS256")
        kid = header.get("kid")

        keys = _get_public_keys()
        candidates = [k for k in keys if k.get("kid") == kid] if kid else keys
        if not candidates:
            candidates = keys

        last_exc: Exception | None = None
        for jwk in candidates:
            try:
                payload = jwt.decode(token, jwk, algorithms=[alg], audience="authenticated")
                user_id: str | None = payload.get("sub")
                if not user_id:
                    raise HTTPException(status_code=401, detail="Invalid token: missing subject")
                return user_id
            except JWTError as e:
                last_exc = e

        raise last_exc or JWTError("No valid signing key matched")

    except HTTPException:
        raise
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
