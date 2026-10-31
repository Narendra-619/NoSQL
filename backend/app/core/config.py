from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    mongodb_uri: str = Field(min_length=1)
    mongodb_database: str = Field(default="academic_system", min_length=1)
    cassandra_host: str = Field(default="127.0.0.1", min_length=1)
    cassandra_port: int = Field(default=9042, ge=1, le=65535)
    cassandra_keyspace: str = Field(
        default="academic_system", pattern=r"^[a-z][a-z0-9_]{0,47}$"
    )
    cors_origins: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"]
    )
    admin_access_key: str = ""
    mongo_timeout_ms: int = 8000
    cassandra_timeout_seconds: float = 10.0

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
