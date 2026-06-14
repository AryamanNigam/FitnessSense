from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import health, auth, profile

app = FastAPI(title="FitnessSense API", version="0.1.0")

origins = [
    "http://localhost:5173",
    "https://fitnesssense.vercel.app",
]

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
