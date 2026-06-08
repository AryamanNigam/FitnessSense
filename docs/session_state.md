# FitnessSense — Session State

Tracks what has been built, decisions made, and what is next. Updated at the start of each work session.

---

## Current Phase

Week 1 — Foundation: Auth, Onboarding, Profile

## Status

Not started. Docs written; awaiting approval to begin scaffolding.

---

## What's Done

_Nothing yet._

---

## What's In Progress

_Nothing yet._

---

## Decisions Made

| Decision | Rationale |
|---|---|
| Supabase for auth + DB | Managed Postgres + built-in JWT auth reduces backend boilerplate |
| Gemini API (gemini-1.5-flash) | Free tier available; multimodal for future expansion |
| JWT stored in memory (Zustand), not localStorage | Avoids XSS token theft |
| All data reads/writes through FastAPI, not direct Supabase client | Single point of validation + business logic; service role key stays server-side only |
| USDA FoodData Central as RAG corpus | Authoritative, free, large enough for meaningful retrieval |
| ChromaDB persisted to disk | Avoids re-indexing on every backend restart |

---

## Open Questions

- [ ] Should meal plan generation use RAG retrieval at generation time, or just use Gemini's own food knowledge with USDA data reserved for the chatbot only?
- [ ] Do workout logs need sets/reps tracked per-exercise, or is a free-text notes field sufficient for the MVP?
- [ ] Streaming chat responses (SSE) vs. single-shot responses — decide before implementing `/chat`.
- [ ] Render free tier has ephemeral disk — need to decide if ChromaDB is rebuilt on each deploy or stored externally (e.g. S3).

---

## Blockers

_None._

---

## Next Actions (when approved to code)

1. Scaffold `backend/` — FastAPI app, config, dependencies, Supabase client.
2. Scaffold `frontend/` — Vite + React + Tailwind, Supabase client, Zustand store.
3. Implement auth flow end-to-end (signup → login → JWT → protected route).
4. Implement onboarding form → `POST /profile`.
