import json
from typing import Iterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from supabase import Client

from app.core.rate_limit import check_rate_limit
from app.dependencies import get_current_user, get_supabase
from app.models.chat import ChatMessageResponse, ChatRequest
from rag.chain import answer_stream

router = APIRouter(prefix="/chat", tags=["chat"])

HISTORY_TURNS = 6


def _recent_history(supabase: Client, user_id: str) -> list[dict]:
    rows = (
        supabase.table("chat_history")
        .select("role, content")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(HISTORY_TURNS)
        .execute()
        .data
    )
    return list(reversed(rows))


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@router.post("")
def chat(
    body: ChatRequest,
    request: Request,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    check_rate_limit(request, user_id)
    profile = (
        supabase.table("profiles")
        .select("goal, tdee, protein_target_g")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not profile or not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    history = _recent_history(supabase, user_id)
    message = body.message.strip()

    def event_stream() -> Iterator[str]:
        parts: list[str] = []
        try:
            for token in answer_stream(message, profile.data, history):
                parts.append(token)
                yield _sse({"token": token})
        except HTTPException as e:
            yield _sse({"error": e.detail})
            return
        except Exception:
            yield _sse({"error": "Something went wrong. Please try again."})
            return

        supabase.table("chat_history").insert(
            [
                {"user_id": user_id, "role": "user", "content": message},
                {"user_id": user_id, "role": "assistant", "content": "".join(parts)},
            ]
        ).execute()
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history", response_model=list[ChatMessageResponse])
def get_history(
    limit: int = 50,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    limit = max(1, min(limit, 200))
    rows = (
        supabase.table("chat_history")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )
    return list(reversed(rows))


@router.delete("/history", status_code=204)
def clear_history(
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    supabase.table("chat_history").delete().eq("user_id", user_id).execute()
