# FitnessSense — Architecture

## System Overview

FitnessSense is a full-stack fitness intelligence platform. A React/Vite frontend talks to a FastAPI backend over REST. Supabase (hosted Postgres) is the primary data store and the auth provider (it issues the JWTs). The backend is the single trusted entry point to the database: it verifies each request's JWT, scopes every query to the authenticated user, and owns all business logic. A RAG pipeline (LangChain + ChromaDB + Gemini) serves the chatbot and the generative meal/workout features.

```
Browser (React + Vite)
        │  REST (JSON, Bearer JWT)
        ▼
FastAPI Backend (Python)
   ├── Auth dependency  ── verifies JWT, derives user_id
   ├── Meal Planner
   ├── Workout Generator
   ├── Progress API
   ├── RAG Chatbot ──► LangChain (LCEL) ──► ChromaDB ──► Gemini API
   └── ── all DB access scoped to user_id ──► Supabase (Postgres)

ChromaDB collection is built offline (rag/ingest.py) and
loaded from a persistent disk at startup — never re-ingested on boot.
```

The backend mediates all data access (rather than the frontend hitting Supabase directly) for three concrete reasons: it keeps the `GEMINI_API_KEY` and Supabase service key server-side, it centralizes business logic (TDEE/macro computation, plan generation), and it hosts the RAG pipeline that the client can't run.

---

## Folder Structure

```
FitnessSense/
├── docs/                         # Architecture, roadmap, session state
├── frontend/                     # React + Vite + Tailwind
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/           # Reusable UI components
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── meals/
│   │   │   ├── workouts/
│   │   │   └── chat/
│   │   ├── pages/                # Route-level views
│   │   │   ├── Login.tsx
│   │   │   ├── Onboarding.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── MealPlanner.tsx
│   │   │   ├── WorkoutPlanner.tsx
│   │   │   └── Chatbot.tsx
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # API client, Supabase client
│   │   ├── store/                # Zustand global state
│   │   ├── types/                # Shared TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                      # FastAPI (Python)
│   ├── app/
│   │   ├── main.py               # FastAPI app, router + middleware registration
│   │   ├── config.py             # Settings via pydantic-settings
│   │   ├── dependencies.py       # get_current_user, get_db dependencies
│   │   ├── core/
│   │   │   ├── security.py       # JWT verification (Supabase JWT secret)
│   │   │   └── rate_limit.py     # Rate limiting for generate/chat routes
│   │   ├── models/               # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── profile.py
│   │   │   ├── meals.py
│   │   │   ├── workouts.py
│   │   │   ├── progress.py
│   │   │   ├── chat.py
│   │   │   └── health.py
│   │   └── services/
│   │       ├── meal_service.py
│   │       ├── workout_service.py
│   │       ├── splits.py          # Preset schedules + focus→muscle-group map
│   │       ├── progress_service.py
│   │       └── rag_service.py
│   ├── rag/
│   │   ├── ingest.py             # Offline: load + chunk USDA subset → ChromaDB
│   │   ├── retriever.py          # ChromaDB query wrapper
│   │   └── chain.py              # LCEL RAG chain with Gemini (streaming)
│   ├── chroma_db/                # Persisted ChromaDB store (on Render disk; gitignored)
│   ├── data/
│   │   └── usda_foods.json       # Curated USDA FoodData Central subset (gitignored)
│   ├── tests/
│   ├── requirements.txt
│   └── .env                      # Secrets (gitignored)
│
└── README.md
```

---

## Database Schema (Supabase / Postgres)

Supabase manages auth — `auth.users` is provided by Supabase and is not redefined here.

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | FK → auth.users.id |
| name | text | |
| age | int | |
| weight_kg | numeric | Starting weight at onboarding |
| height_cm | numeric | |
| goal | text | `cut` \| `bulk` \| `maintain` |
| activity_level | text | `sedentary` \| `light` \| `moderate` \| `active` \| `very_active` |
| tdee | int | Computed on save (kcal/day) |
| protein_target_g | int | Computed on save from goal + weight |
| workout_split | jsonb | `{ split_type, schedule }` — weekly `weekday → focus\|rest` map (see Workout Splits). Null until the user picks a split |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | |

### `weight_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → profiles.id, **indexed** |
| weight_kg | numeric | |
| logged_at | date | |

### `meal_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → profiles.id, **indexed** |
| meal_name | text | e.g. "Breakfast" |
| items | jsonb | Array of `{name, kcal, protein_g, carbs_g, fat_g}` |
| total_kcal | int | |
| logged_at | date | |

### `workout_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → profiles.id, **indexed** |
| plan | jsonb | Array of `{exercise, sets, reps, rest_s}` |
| notes | text | |
| session_focus | text | Focus this session was generated for (`push`, `pull`, `legs`, …); enables the weekly done/pending view. Nullable for legacy rows |
| logged_at | date | |

### `chat_history`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → profiles.id, **indexed** |
| role | text | `user` \| `assistant` |
| content | text | |
| created_at | timestamptz | |

A composite index on `(user_id, logged_at)` is added to the `*_logs` tables, since the common access pattern is "this user's entries for a date / date range."

**Row Level Security:** RLS is enabled on every table with the policy `auth.uid() = user_id`. Note that this policy is **defense-in-depth for direct client access via the anon key** — it does *not* govern backend traffic, because the backend uses the service role key (see Security below).

---

## API Endpoints

Base URL: `https://fitnesssense-api.onrender.com/api/v1`

All endpoints except `/auth/*` and `/health` require `Authorization: Bearer <supabase_jwt>`.

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness + readiness (checks DB + Chroma load) |

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | Create account (delegates to Supabase) |
| POST | `/auth/login` | Sign in (delegates to Supabase) |

### Profile
| Method | Path | Description |
|---|---|---|
| POST | `/profile` | Create profile after signup (onboarding) |
| GET | `/profile/me` | Get current user profile (includes `workout_split`) |
| PATCH | `/profile/me` | Update profile fields |
| PATCH | `/profile/split` | Set the user's workout split (`split_type` + weekly `schedule`) |

### Meals
| Method | Path | Description |
|---|---|---|
| POST | `/meals/generate` | Generate a meal plan *(rate-limited)* — see modes below |
| GET | `/meals/logs` | Get meal logs (query: `?date=YYYY-MM-DD`) |
| POST | `/meals/logs` | Save a meal log entry |
| DELETE | `/meals/logs/{id}` | Delete a meal log |

**`POST /meals/generate` request body:**
```json
{
  "mode": "ingredients",   // or "random"
  "ingredients": ["chicken breast", "rice", "broccoli"]  // required if mode=ingredients, ignored if mode=random
}
```
- `ingredients` mode: Gemini generates a meal plan using only (or primarily) the listed ingredients, with macro targets derived from the user's goal and TDEE.
- `random` mode: Gemini generates a nutritionally appropriate meal plan for the day without ingredient constraints, still respecting the user's goal and TDEE.

### Workouts
| Method | Path | Description |
|---|---|---|
| POST | `/workouts/generate` | Generate a split-aware workout *(rate-limited)* — see split logic below |
| GET | `/workouts/logs` | Get workout logs (query: `?date=YYYY-MM-DD`) |
| POST | `/workouts/logs` | Save a workout log entry (includes `session_focus`) |
| DELETE | `/workouts/logs/{id}` | Delete a workout log |

**`POST /workouts/generate` request body:**
```json
{ "focus": "pull" }   // optional; defaults to today's scheduled focus
```
- If `focus` is omitted, the backend derives it from `workout_split.schedule[weekday(today)]`. A `rest` focus returns a 400/no-op (nothing to generate).
- The resolved focus is expanded via the server-side muscle-group map and injected into the Gemini prompt so the session targets the right muscles.

### Progress
| Method | Path | Description |
|---|---|---|
| POST | `/progress/weight` | Log a weight entry |
| GET | `/progress/weight` | Get weight history (query: `?days=30`) |
| GET | `/progress/summary` | Aggregated calorie + workout summary (query: `?days=30`) |

### Chat
| Method | Path | Description |
|---|---|---|
| POST | `/chat` | Send a message; returns a **streamed (SSE)** RAG-grounded answer *(rate-limited)* |
| GET | `/chat/history` | Get chat history for the current user |
| DELETE | `/chat/history` | Clear the current user's chat history |

Ownership note: `DELETE` and `GET .../logs/{id}` handlers re-check `user_id` against the JWT before acting, so a valid token for user A can never read or delete user B's row even with a guessed id.

---

## Authentication & Authorization

This is the part most worth getting exactly right.

### Token verification (asymmetric / JWKS)

- Supabase issues a signed JWT on login/signup. The backend verifies it **asymmetrically** against Supabase's **public signing keys**, fetched from the project's JWKS endpoint (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`) and cached in memory.
- Every backend request carries `Authorization: Bearer <jwt>`. A FastAPI dependency `get_current_user` (`dependencies.py` → `core/security.py`) reads the token's `kid` (key id) and `alg` from its header, selects the matching public key from the JWKS, and calls `jwt.decode(...)` to verify the **signature and expiry** with `audience="authenticated"`. It then extracts the user id from the `sub` claim. A missing, invalid, or expired token returns `401`.
- **Asymmetric, not symmetric.** The verifying backend holds only *public* keys — it never possesses a secret capable of *signing* tokens (Supabase's private key does that). This is stronger than an HS256 shared secret and lets Supabase rotate keys without a backend redeploy. (`config.py` still declares a `supabase_jwt_secret` setting, but the JWKS path does not use it — it is currently vestigial.)

### Session storage & refresh (in-memory access token + HttpOnly refresh cookie)

- Auth calls (`signup`, `login`, `refresh`, `logout`) go through the **FastAPI backend**, which proxies Supabase. The Supabase JS client is not used for the app's session lifecycle.
- The **access token** (short-lived JWT, ~1h) is kept **in memory** (Zustand), never in `localStorage`, to limit XSS token theft. It is lost on tab close/reload by design.
- The **refresh token** is stored in an **HttpOnly cookie** set by the backend, scoped to `/api/v1/auth` (`SameSite=Lax` in dev, `SameSite=None; Secure` in prod for the cross-domain Vercel→Render call). `HttpOnly` means JS cannot read it, so XSS cannot steal it; the cookie survives page reloads.
- **Silent refresh:** on app mount, and whenever a request gets a `401`, the Axios interceptor (`lib/apiClient.ts`) calls `POST /auth/refresh` (which reads the cookie server-side and mints a new access token) and **replays the original request**. Concurrent `401`s queue behind a single in-flight refresh (no thundering herd); a request is retried at most once; `401`s from `/auth/*` endpoints skip retry and redirect to login.

### Row isolation (service key + application-level scoping)

- The backend connects to Postgres with the **Supabase service role key**. This key **bypasses RLS by design**, so row isolation for backend traffic is enforced in application code: every query is scoped to the authenticated `user_id`, and there is no code path that returns rows without that filter.
- RLS (`auth.uid() = user_id`) is enabled on all tables as **defense-in-depth for any direct anon-key client access**. It is intentionally *not* the primary guard for service-key traffic — conflating the two is a common mistake, so the responsibilities are kept explicit here.

In one line: **the JWT is the identity, the `sub` claim is the authorization key, and application-level scoping is the row guard. RLS is a backstop, not the backstop.**

---

## RAG Pipeline

```
User question
      │
      ▼
LangChain retriever  ── embeds query, similarity search (top-k=5)
      │
      ▼
ChromaDB (USDA food embeddings, loaded from persisted disk)
      │  retrieved chunks
      ▼
LCEL chain
  [system: fitness assistant]
  [context: {retrieved_chunks}]
  [user_profile: goal, tdee, protein_target]
  [question: {user_question}]
      │
      ▼
Gemini API (flash-tier model)
      │
      ▼
Streamed (SSE) answer → frontend
```

**Ingestion — offline, one-time (`python -m rag.ingest`):**
1. Load a **curated subset** of USDA FoodData Central (Foundation Foods + SR Legacy staples) rather than the full corpus, to keep embedding volume and cost bounded.
2. Parse each food into a text chunk: `"Food: {description}. Nutrients per 100g: protein {x}g, carbs {y}g, fat {z}g, kcal {k}."`
3. Embed with `GoogleGenerativeAIEmbeddings` and persist to `CHROMA_PERSIST_DIR`.

**Startup:** the API opens the **already-persisted** Chroma collection from disk. It does **not** re-ingest on boot. On Render, `CHROMA_PERSIST_DIR` points at a mounted persistent disk so the index survives restarts and redeploys. (Without a persistent disk, Render's filesystem is ephemeral and the index would be lost on every deploy — hence the disk.)

**Per request:** `rag/retriever.py` embeds the query and returns the top-5 closest USDA chunks; `rag/chain.py` composes an LCEL chain (`prompt | llm | output_parser`) that injects the retrieved context plus the user's goal and TDEE, then streams Gemini's response back over SSE. The user/assistant turns are appended to `chat_history`.

---

## Workout Splits

A **split** is how the user organizes training across the week. The core design decision: every split — 3-day PPL, 6-day PPL, 5-day bro split, and fully custom — is represented by **one data structure**, a 7-day weekly schedule mapping each weekday to a session focus (or rest). Presets are just pre-filled versions of that schedule; "custom" is the user filling it in.

**Model: weekly calendar (not an advancing rotation).** Today's session is derived, never stored as rotation state:
```
today_focus = workout_split.schedule[weekday(today)]
```
This keeps tracking trivial (no cursor to keep in sync) and matches the requirement that users choose *which* weekdays are rest days. A missed day simply shows as a missed slot in the weekly view rather than shifting everything.

**Stored on `profiles.workout_split` (jsonb):**
```json
{
  "split_type": "ppl_6",                 // ppl_3 | ppl_6 | bro_5 | custom
  "schedule": {
    "mon": "push", "tue": "pull", "wed": "legs",
    "thu": "push", "fri": "pull", "sat": "legs", "sun": "rest"
  }
}
```

**Focus vocabulary (fixed enum, shared frontend + backend):**
`push · pull · legs · chest · back · shoulders · arms · upper · lower · full_body · rest`

**Muscle-group map (server-side constant, `services/splits.py`).** Each focus expands to the muscle groups fed into the generation prompt, so Gemini targets the right areas:
```
push → chest, front delts, triceps       pull  → back, biceps, rear delts
legs → quads, hamstrings, glutes, calves  upper → chest, back, shoulders, arms
back → lats, traps, rhomboids             lower → quads, hamstrings, glutes, calves
chest/shoulders/arms → map to themselves  full_body → all major groups
```

**Presets** live in the same config, keyed by `split_type` (e.g. `ppl_3` trains Mon/Wed/Fri and rests the rest; `bro_5` = Chest/Back/Shoulders/Legs/Arms + 2 rest). Selecting a preset copies its schedule into `workout_split`; `custom` starts editable.

**Generation flow:** `POST /workouts/generate` resolves the focus (request body override → else today's schedule), expands it via the muscle map, and generates a session for just those muscles. Each saved log records its `session_focus`, so the app can render a weekly done / pending / rest / missed view by comparing the schedule against the logs.

---

## Frontend ↔ Backend Connection

- All API calls go through `src/lib/apiClient.ts`, an Axios instance (with `withCredentials: true`) that injects `Authorization: Bearer <jwt>` on every request and handles `401` with a queued silent refresh against `POST /auth/refresh`, then replays the original request (see Authentication above).
- Auth operations (signup, login, refresh, logout) go through the **FastAPI backend**, which proxies Supabase and manages the HttpOnly refresh cookie. The Supabase JS client (`src/lib/supabaseClient.ts`) is not part of the session lifecycle. All data reads/writes also go through the FastAPI backend.
- CORS on FastAPI allows `https://fitnesssense.vercel.app` (production) and `http://localhost:5173` (development).
- The chat client consumes the `/chat` SSE stream and renders tokens incrementally.

### Environment variables
- **Frontend:** `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Backend:** `SUPABASE_URL` (also used to fetch the JWKS for token verification), `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `CHROMA_PERSIST_DIR`. (`SUPABASE_JWT_SECRET` is still declared in `config.py` but unused now that verification is JWKS-based.)

---

## Operational Notes

- **Deployment:** frontend on Vercel, backend on Render with a mounted persistent disk for `chroma_db/`.
- **Cold starts:** on Render's free tier the service sleeps; the first request after idle is slow. The Chroma collection loads from disk (seconds), not via re-ingestion (minutes + API cost).
- **External-call resilience:** Gemini calls in `/meals/generate`, `/workouts/generate`, and `/chat` are wrapped with a timeout and a graceful error response, so an upstream failure returns a clean `503`-style message rather than a hanging request.
- **Rate limiting:** the three generate/chat routes are rate-limited per user to bound Gemini spend.
- **Testing:** `backend/tests/` covers JWT verification, user-scoping on a representative router, and the retriever returning the expected top-k shape.


---

## Errors, Deployment & Operations

- **Error shape:** every error returns `{ "detail": "<message>", "code": "<slug>" }` (validation errors add an `errors` list). Unhandled exceptions return a generic 500 and are logged server-side only. Handlers live in `app/core/errors.py`.
- **CORS:** localhost and the Vercel domain are allowed by default; add more origins with the comma-separated `CORS_ORIGINS` env var.
- **Backend (Render):** `render.yaml` + `backend/Dockerfile`; a 1 GB disk is mounted at `/data` and `CHROMA_PERSIST_DIR=/data/chroma_db`. After first deploy, open a Render shell and run `python -m rag.ingest <usda.json> --reset`. `/api/v1/health` reports `chroma: ok | empty | error`.
- **Frontend (Vercel):** set `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; `frontend/vercel.json` rewrites all routes to the SPA.
- **Database:** run `backend/migrations/chat_history.sql` once in Supabase.
- **Demo + smoke test:** `python scripts/seed_demo.py` creates `demo@fitnesssense.app` with 3 weeks of data; `python scripts/smoke_test.py --base-url <api>` exercises login, profile, meals, workouts, weight, progress and chat.
