from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    supabase_anon_key: str
    gemini_api_key: str
    chroma_persist_dir: str = "./chroma_db"
    environment: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
