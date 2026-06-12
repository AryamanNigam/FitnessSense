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
| GET | `/profile/me` | Get current user profile |
| PATCH | `/profile/me` | Update profile fields |

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
| POST | `/workouts/generate` | Generate a workout plan for the day *(rate-limited)* |
| GET | `/workouts/logs` | Get workout logs (query: `?date=YYYY-MM-DD`) |
| POST | `/workouts/logs` | Save a workout log entry |
| DELETE | `/workouts/logs/{id}` | Delete a workout log |

### Progress
| Method | Path | Description |
|---|---|---|
| POST | `/progress/weight` | Log a weight entry |
| GET | `/progress/weight` | Get weight history (query: `?days=30`) |
| GET | `/progress/summary` | Aggregated calorie + workout summary |

### Chat
| Method | Path | Description |
|---|---|---|
| POST | `/chat` | Send a message; returns a **streamed (SSE)** RAG-grounded answer *(rate-limited)* |
| GET | `/chat/history` | Get chat history for the current user |

Ownership note: `DELETE` and `GET .../logs/{id}` handlers re-check `user_id` against the JWT before acting, so a valid token for user A can never read or delete user B's row even with a guessed id.

---

## Authentication & Authorization

This is the part most worth getting exactly right.

- Supabase issues a JWT on login/signup, signed with the project's JWT secret (HS256).
- The frontend keeps the JWT **in memory** (Zustand), never in `localStorage`, to limit XSS token theft. Session refresh is handled by the Supabase client.
- Every backend request carries `Authorization: Bearer <jwt>`. A FastAPI dependency `get_current_user` (`core/security.py`) verifies the signature and expiry against `SUPABASE_JWT_SECRET` and extracts the user id from the `sub` claim. A missing, invalid, or expired token returns `401`.
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

## Frontend ↔ Backend Connection

- All API calls go through `src/lib/apiClient.ts`, an Axios instance that injects `Authorization: Bearer <jwt>` on every request and handles `401` by triggering a session refresh / redirect to login.
- The Supabase client (`src/lib/supabaseClient.ts`) is used **only** for auth operations (signup, login, session refresh). All data reads/writes go through the FastAPI backend.
- CORS on FastAPI allows `https://fitnesssense.vercel.app` (production) and `http://localhost:5173` (development).
- The chat client consumes the `/chat` SSE stream and renders tokens incrementally.

### Environment variables
- **Frontend:** `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Backend:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `GEMINI_API_KEY`, `CHROMA_PERSIST_DIR`

---

## Operational Notes

- **Deployment:** frontend on Vercel, backend on Render with a mounted persistent disk for `chroma_db/`.
- **Cold starts:** on Render's free tier the service sleeps; the first request after idle is slow. The Chroma collection loads from disk (seconds), not via re-ingestion (minutes + API cost).
- **External-call resilience:** Gemini calls in `/meals/generate`, `/workouts/generate`, and `/chat` are wrapped with a timeout and a graceful error response, so an upstream failure returns a clean `503`-style message rather than a hanging request.
- **Rate limiting:** the three generate/chat routes are rate-limited per user to bound Gemini spend.
- **Testing:** `backend/tests/` covers JWT verification, user-scoping on a representative router, and the retriever returning the expected top-k shape.
