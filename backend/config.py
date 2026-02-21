from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    G_API_KEY: str
    MONGODB_URI: str
    DB_NAME: str = "Koereprove"
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = "../.env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
