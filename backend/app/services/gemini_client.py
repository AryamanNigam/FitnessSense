import json
from typing import Iterator
import httpx
from fastapi import HTTPException
from app.config import settings

# Reliability-first ordering: lead with the healthy/fast model, keep the original
# as fallback. gemini-3.5-flash was demoted from primary — it's been returning 503
# "high demand" and takes ~5s+ just to fail, taxing every request before fallback ran.
_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash"]
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


_STREAM_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
)


def stream_text(prompt: str, system: str | None = None) -> Iterator[str]:
    payload: dict = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"thinkingConfig": {"thinkingBudget": 0}},
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}

    for model in _MODELS:
        started = False
        try:
            with httpx.stream(
                "POST",
                _STREAM_URL_TEMPLATE.format(model=model),
                params={"key": settings.gemini_api_key, "alt": "sse"},
                json=payload,
                timeout=60.0,
            ) as resp:
                if resp.status_code in (429, 503):
                    continue
                if resp.status_code >= 400:
                    raise HTTPException(status_code=503, detail="Generation failed. Please try again.")
                for line in resp.iter_lines():
                    if not line.startswith("data:"):
                        continue
                    chunk = json.loads(line[5:].strip())
                    for candidate in chunk.get("candidates", []):
                        for part in candidate.get("content", {}).get("parts", []):
                            text = part.get("text")
                            if text:
                                started = True
                                yield text
                if started:
                    return
        except httpx.HTTPError:
            if started:
                raise
            continue

    raise HTTPException(status_code=503, detail="Generation failed after trying all available models. Please try again.")
