from collections import defaultdict
from time import time
from fastapi import HTTPException, Request

RATE_LIMIT = 10
WINDOW_SECONDS = 60

_counters: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(request: Request, user_id: str) -> None:
    key = f"{user_id}:{request.url.path}"
    now = time()
    window_start = now - WINDOW_SECONDS

    _counters[key] = [t for t in _counters[key] if t > window_start]

    if len(_counters[key]) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait before trying again.")

    _counters[key].append(now)
