# FitnessSense

React + FastAPI fitness app with Supabase auth/data and a Gemini-powered RAG chatbot over USDA nutrition data. See `docs/architecture.md` for the design.

## Setup

```bash
make setup
```

Then fill in `backend/.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`) and `frontend/.env` (copy `frontend/.env.example`).

1. Run `backend/migrations/chat_history.sql` in the Supabase SQL editor.
2. Download USDA FoodData Central Foundation Foods (JSON) from https://fdc.nal.usda.gov/download-datasets and save it as `backend/data/usda.json`.
3. `make ingest`

## Run

```bash
make backend    # http://localhost:8000
make frontend   # http://localhost:5173
```

## Test

```bash
make test
make seed                                   # demo@fitnesssense.app
make smoke                                  # local API
make smoke ARGS="--base-url https://<render-url>/api/v1"
```
