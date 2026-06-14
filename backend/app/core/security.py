from jose import JWTError, jwt
from fastapi import HTTPException
from app.config import settings


def verify_token(token: str) -> str:
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing subject")
        return user_id
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
