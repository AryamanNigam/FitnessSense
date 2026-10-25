from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import register_error_handlers


class Payload(BaseModel):
    age: int


def _client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/missing")
    def missing():
        raise HTTPException(status_code=404, detail="Log not found")

    @app.get("/boom")
    def boom():
        raise RuntimeError("secret internals")

    @app.post("/payload")
    def payload(body: Payload):
        return body

    return TestClient(app, raise_server_exceptions=False)


def test_http_exception_keeps_detail_and_adds_code():
    res = _client().get("/missing")
    assert res.status_code == 404
    assert res.json() == {"detail": "Log not found", "code": "not_found"}


def test_validation_error_is_flattened_to_a_string_detail():
    res = _client().post("/payload", json={"age": "abc"})
    body = res.json()
    assert res.status_code == 422
    assert body["code"] == "validation_error"
    assert isinstance(body["detail"], str) and body["detail"].startswith("age")
    assert body["errors"][0]["field"] == "age"


def test_unhandled_error_hides_internals():
    res = _client().get("/boom")
    assert res.status_code == 500
    assert res.json() == {"detail": "Internal server error", "code": "error"}
