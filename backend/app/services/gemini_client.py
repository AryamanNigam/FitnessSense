import json
import httpx
from fastapi import HTTPException
from app.config import settings

_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"]
_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def generate_json(prompt: str) -> dict:
    """Call Gemini with structured JSON output, falling back to a second
    model if the primary one is overloaded (429/503) or unreachable."""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    last_exc: Exception | None = None
    for model in _MODELS:
        try:
            resp = httpx.post(
                _URL_TEMPLATE.format(model=model),
                params={"key": settings.gemini_api_key},
                json=payload,
                timeout=45.0,
            )
            resp.raise_for_status()
            body = resp.json()
            candidates = body.get("candidates")
            if not candidates:
                last_exc = HTTPException(status_code=503, detail="Generation was blocked or returned no content.")
                continue
            text = candidates[0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (429, 503):
                last_exc = e
                continue
            raise HTTPException(status_code=503, detail=f"Generation failed: {e.response.text}")
        except httpx.HTTPError as e:
            last_exc = e
            continue
        except json.JSONDecodeError:
            last_exc = HTTPException(status_code=503, detail="Generation returned invalid data. Please try again.")
            continue

    if isinstance(last_exc, HTTPException):
        raise last_exc
    raise HTTPException(status_code=503, detail="Generation failed after trying all available models. Please try again.")
