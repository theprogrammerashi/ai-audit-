"""
CareAudit AI - Configuration
Loads environment variables and provides app-wide settings.
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


_current_dir = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(os.path.dirname(_current_dir))


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App
    APP_NAME: str = "CareAudit AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Database (DuckDB)
    DUCKDB_PATH: str = os.path.join(ROOT_DIR, "data", "careaudit.duckdb")
    
    # Groq API
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_FAST_MODEL: str = "llama-3.1-8b-instant"
    
    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_PERSIST_DIR: str = os.path.join(ROOT_DIR, "data", "chroma")
    
    # Security
    SECRET_KEY: str = "careaudit-dev-secret-key-change-in-production-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
