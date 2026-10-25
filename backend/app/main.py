from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.errors import register_error_handlers
from app.routers import health, auth, profile, meals, workouts, weight, progress, chat

app = FastAPI(title="FitnessSense API", version="0.1.0")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://fitnesssense.vercel.app",
    *[o.strip().rstrip("/") for o in settings.cors_origins.split(",") if o.strip()],
]

register_error_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(meals.router, prefix="/api/v1")
app.include_router(workouts.router, prefix="/api/v1")
app.include_router(weight.router, prefix="/api/v1")
app.include_router(progress.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
