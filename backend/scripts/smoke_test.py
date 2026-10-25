import argparse
import sys
from datetime import date

import httpx

DEMO_EMAIL = "demo@fitnesssense.app"
DEMO_PASSWORD = "FitnessSense-Demo-1"


def main() -> int:
    parser = argparse.ArgumentParser(description="End-to-end smoke test against a running API")
    parser.add_argument("--base-url", default="http://localhost:8000/api/v1")
    parser.add_argument("--email", default=DEMO_EMAIL)
    parser.add_argument("--password", default=DEMO_PASSWORD)
    args = parser.parse_args()

    failures: list[str] = []
    client = httpx.Client(base_url=args.base_url, timeout=90.0)

    def step(name: str, fn) -> object:
        try:
            result = fn()
            print(f"PASS  {name}")
            return result
        except Exception as exc:
            failures.append(name)
            print(f"FAIL  {name}: {exc}")
            return None

    def health():
        r = client.get("/health")
        r.raise_for_status()
        assert r.json()["db"] == "ok", r.json()
        print(f"      chroma: {r.json().get('chroma')}")

    def login():
        r = client.post("/auth/login", json={"email": args.email, "password": args.password})
        r.raise_for_status()
        client.headers["Authorization"] = f"Bearer {r.json()['access_token']}"

    def profile():
        r = client.get("/profile/me")
        r.raise_for_status()
        assert r.json()["tdee"] > 0

    def meal():
        r = client.post("/meals/generate", json={"mode": "random"})
        r.raise_for_status()
        meals = r.json()["meals"]
        assert meals
        log = client.post(
            "/meals/logs",
            json={**{k: meals[0][k] for k in ("meal_name", "items", "total_kcal", "instructions")}, "logged_at": date.today().isoformat()},
        )
        log.raise_for_status()
        client.delete(f"/meals/logs/{log.json()['id']}").raise_for_status()

    def workout():
        r = client.post("/workouts/generate", json={"focus": "push"})
        r.raise_for_status()
        assert r.json()["exercises"]

    def weight():
        r = client.post("/progress/weight", json={"weight_kg": 80.0, "logged_at": date.today().isoformat()})
        r.raise_for_status()
        client.delete(f"/weight/logs/{r.json()['id']}").raise_for_status()
        summary = client.get("/progress/summary", params={"days": 14})
        summary.raise_for_status()
        assert len(summary.json()["daily"]) == 14

    def chat():
        text = []
        with client.stream("POST", "/chat", json={"message": "How much protein is in chicken breast?"}) as r:
            r.raise_for_status()
            for line in r.iter_lines():
                if line.startswith("data:") and "[DONE]" not in line:
                    text.append(line)
        assert text, "no tokens streamed"
        client.get("/chat/history").raise_for_status()

    step("health", health)
    if step("login", login) is None and "login" in failures:
        return 1
    step("profile", profile)
    step("meal generate/log/delete", meal)
    step("workout generate", workout)
    step("weight log + progress summary", weight)
    step("chat stream + history", chat)

    print(f"\n{'All steps passed' if not failures else 'Failed: ' + ', '.join(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
