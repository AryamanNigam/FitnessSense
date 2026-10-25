import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core import rate_limit


def _request(path: str) -> Request:
    return Request({"type": "http", "method": "POST", "path": path, "headers": []})


@pytest.fixture(autouse=True)
def _reset():
    rate_limit._counters.clear()


def test_allows_up_to_limit_then_blocks():
    request = _request("/api/v1/meals/generate")
    for _ in range(rate_limit.RATE_LIMIT):
        rate_limit.check_rate_limit(request, "user-a")
    with pytest.raises(HTTPException) as exc:
        rate_limit.check_rate_limit(request, "user-a")
    assert exc.value.status_code == 429


def test_limits_are_per_user_and_per_path():
    for _ in range(rate_limit.RATE_LIMIT):
        rate_limit.check_rate_limit(_request("/a"), "user-a")
    rate_limit.check_rate_limit(_request("/a"), "user-b")
    rate_limit.check_rate_limit(_request("/b"), "user-a")
