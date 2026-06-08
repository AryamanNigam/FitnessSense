# FitnessSense — Architecture

## System Overview

FitnessSense is a full-stack fitness intelligence platform. The React/Vite frontend communicates with a FastAPI backend over REST. Supabase (hosted Postgres) is the primary data store and handles user authentication via JWTs. A RAG pipeline powered by LangChain + ChromaDB and the Gemini API serves the AI chatbot and generative meal/workout features.

```
Browser (React + Vite)
        │  REST (JSON/JWT)
        ▼
FastAPI Backend (Python)
   ├── Auth middleware  ──────────────────► Supabase (Postgres)
   ├── Meal Planner
   ├── Workout Generator
   ├── Progress API
   └── RAG Chatbot ──► LangChain + ChromaDB ──► Gemini API
                            ▲
                      USDA FoodData
                      (indexed at startup)
```

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
│   │   ├── main.py               # FastAPI app + router registration
│   │   ├── config.py             # Settings via pydantic-settings
│   │   ├── dependencies.py       # Auth/DB dependency injection
│   │   ├── models/               # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── profile.py
│   │   │   ├── meals.py
│   │   │   ├── workouts.py
│   │   │   ├── progress.py
│   │   │   └── chat.py
│   │   └── services/
│   │       ├── meal_service.py
│   │       ├── workout_service.py
│   │       ├── progress_service.py
│   │       └── rag_service.py
│   ├── rag/
│   │   ├── ingest.py             # Load + chunk USDA data → ChromaDB
│   │   ├── retriever.py          # ChromaDB query wrapper
│   │   └── chain.py              # LangChain RAG chain with Gemini
│   ├── chroma_db/                # Persisted ChromaDB vector store (gitignored)
│   ├── data/
│   │   └── usda_foods.json       # USDA FoodData Central snapshot (gitignored)
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
| created_at | timestamptz | default now() |
| updated_at | timestamptz | |

### `weight_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → profiles.id |
| weight_kg | numeric | |
| logged_at | date | |

### `meal_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → profiles.id |
| meal_name | text | e.g. "Breakfast" |
| items | jsonb | Array of `{name, kcal, protein_g, carbs_g, fat_g}` |
| total_kcal | int | |
| logged_at | date | |

### `workout_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → profiles.id |
| plan | jsonb | Array of `{exercise, sets, reps, rest_s}` |
| notes | text | |
| logged_at | date | |

### `chat_history`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → profiles.id |
| role | text | `user` \| `assistant` |
| content | text | |
| created_at | timestamptz | |

All tables use Supabase Row Level Security (RLS): each row is only accessible by its owner (`auth.uid() = user_id`).

---

## API Endpoints

Base URL: `https://fitnesssense-api.onrender.com/api/v1`

All endpoints (except `/auth/*`) require `Authorization: Bearer <supabase_jwt>`.

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
| POST | `/meals/generate` | Generate a day's meal plan from Gemini + USDA |
| GET | `/meals/logs` | Get meal logs (query: `?date=YYYY-MM-DD`) |
| POST | `/meals/logs` | Save a meal log entry |
| DELETE | `/meals/logs/{id}` | Delete a meal log |

### Workouts
| Method | Path | Description |
|---|---|---|
| POST | `/workouts/generate` | Generate a workout plan for the day |
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
| POST | `/chat` | Send a message; returns RAG-grounded answer |
| GET | `/chat/history` | Get chat history for the current user |

---

## RAG Pipeline

```
User question
      │
      ▼
LangChain retriever
      │  similarity search (top-k=5)
      ▼
ChromaDB (USDA food embeddings)
      │  retrieved chunks
      ▼
Prompt template
  [system: fitness assistant]
  [context: {retrieved_chunks}]
  [user_profile: goal, tdee, macros]
  [question: {user_question}]
      │
      ▼
Gemini API (gemini-1.5-flash)
      │
      ▼
Streamed answer → frontend
```

**Ingestion (offline / one-time):**
1. Download USDA FoodData Central JSON snapshot.
2. `rag/ingest.py` parses each food entry into a text chunk: `"Food: {description}. Nutrients per 100g: protein {x}g, carbs {y}g, fat {z}g, kcal {k}."`.
3. Chunks are embedded using `GoogleGenerativeAIEmbeddings` and persisted to `chroma_db/`.

**Retrieval (per request):**
- `rag/retriever.py` embeds the user query and returns top-5 closest USDA chunks.
- `rag/chain.py` builds a `RetrievalQA` chain with a custom system prompt that includes the user's goal and TDEE.

---

## Frontend ↔ Backend Connection

- The frontend stores the Supabase JWT in memory (via Zustand) after login. It is never written to localStorage to avoid XSS exposure.
- All API calls go through `src/lib/apiClient.ts`, an Axios instance that injects `Authorization: Bearer <jwt>` on every request.
- The Supabase client (`src/lib/supabaseClient.ts`) is used only for auth operations (signup, login, session refresh). All data reads/writes go through the FastAPI backend, which in turn queries Supabase with the service role key.
- CORS is configured on FastAPI to allow `https://fitnesssense.vercel.app` in production and `http://localhost:5173` in development.
- Environment variables:
  - Frontend: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`, `CHROMA_PERSIST_DIR`
