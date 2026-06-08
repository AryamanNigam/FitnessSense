# FitnessSense — Project Roadmap

## Overview

4-week build plan. Each week ends with a testable vertical slice.

---

## Week 1 — Foundation: Auth, Onboarding, Profile

**Goal:** A user can sign up, complete onboarding, and have their profile (with TDEE) saved to Supabase.

**Backend**
- [ ] FastAPI project scaffold (`main.py`, `config.py`, `dependencies.py`)
- [ ] Supabase client setup (service role key)
- [ ] `POST /profile` — create profile, compute TDEE, store in `profiles` table
- [ ] `GET /profile/me` — return profile for authenticated user
- [ ] `PATCH /profile/me` — update profile fields
- [ ] Auth middleware: validate Supabase JWT on protected routes

**Frontend**
- [ ] Vite + React + Tailwind scaffold
- [ ] Supabase client + Zustand auth store
- [ ] `apiClient.ts` (Axios with JWT injection)
- [ ] Login / Signup page (email + password via Supabase Auth)
- [ ] Onboarding flow: name, age, weight, height, goal, activity level
- [ ] Route guard: redirect unauthenticated users to `/login`

**Done when:** New user can sign up, fill in onboarding, and see their TDEE displayed on a stub dashboard.

---

## Week 2 — Core Features: Meal Planner + Workout Generator

**Goal:** Users can generate a goal-aware meal plan and a workout plan, then save them.

**Backend**
- [ ] `POST /meals/generate` — call Gemini with user profile + USDA context, return structured meal plan
- [ ] `POST /meals/logs`, `GET /meals/logs`, `DELETE /meals/logs/{id}`
- [ ] `POST /workouts/generate` — generate workout adapted to goal (cut/bulk/maintain)
- [ ] `POST /workouts/logs`, `GET /workouts/logs`, `DELETE /workouts/logs/{id}`
- [ ] Gemini API service (`meal_service.py`, `workout_service.py`)
- [ ] USDA data integration for meal generation (initial: keyword lookup, not yet RAG)

**Frontend**
- [ ] Meal Planner page: "Generate plan" button → display meals with macros per item
- [ ] Save generated plan to meal log
- [ ] Workout Generator page: "Generate workout" button → display exercise table
- [ ] Save generated workout to log
- [ ] Shared `MacroCard` and `ExerciseTable` components

**Done when:** User can generate and save a meal plan and a workout in the same session.

---

## Week 3 — Progress Dashboard + RAG Chatbot

**Goal:** Users can track their weight/calories over time on charts, and ask fitness questions to the RAG chatbot.

**Backend**
- [ ] `POST /progress/weight`, `GET /progress/weight`, `GET /progress/summary`
- [ ] RAG ingestion script (`rag/ingest.py`) — parse USDA JSON → ChromaDB embeddings
- [ ] `rag/retriever.py` — ChromaDB similarity search wrapper
- [ ] `rag/chain.py` — LangChain `RetrievalQA` with Gemini + user-profile context
- [ ] `POST /chat` — RAG-grounded answer generation
- [ ] `GET /chat/history` — load prior messages for the session

**Frontend**
- [ ] Dashboard page: weight trend chart (Recharts), calorie vs. target chart, recent workouts list
- [ ] Weight log form (quick entry widget)
- [ ] Chatbot page: chat UI, send message, display streamed answer
- [ ] Load and display chat history on page mount

**Done when:** User can log weight, see charts update, and get a RAG-grounded answer about a food or exercise.

---

## Week 4 — Polish, Testing, Deployment

**Goal:** App is deployed, responsive, and stable enough for a final-year project demo.

**Backend**
- [ ] Input validation on all endpoints (Pydantic models)
- [ ] Error handling middleware (structured JSON error responses)
- [ ] Unit tests for TDEE calculation, meal/workout generation prompts
- [ ] Deploy to Render (Docker or bare Python): set env vars, health check endpoint
- [ ] Verify ChromaDB persists correctly on Render's disk

**Frontend**
- [ ] Responsive layout (mobile-first Tailwind breakpoints)
- [ ] Loading and error states on all async operations
- [ ] Toast notifications for save/delete actions
- [ ] Empty states (first-time user, no logs yet)
- [ ] Deploy to Vercel: set `VITE_*` env vars, configure production API base URL

**Integration**
- [ ] End-to-end smoke test: signup → onboard → generate meal → log weight → chat
- [ ] Fix CORS for production domain
- [ ] Seed one demo account for presentation

**Done when:** The app is live at the Vercel URL, demo account works, all pages load without errors.
