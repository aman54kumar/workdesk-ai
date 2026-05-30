from functools import cached_property

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SQLITE_DB_PATH: str = "./workdesk_cache.db"
    OLLAMA_BASE_URL: str
    CORS_ORIGINS: str
    CACHE_TTL_HOURS: int = 24

    OLLAMA_MODEL_DEFAULT: str
    OLLAMA_MODEL_CODE: str
    OLLAMA_MODEL_QUALITY: str
    OLLAMA_ALLOWED_MODEL_OVERRIDES: str

    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"
    JWT_SECRET: str = "change-this-secret-in-production"
    JWT_EXPIRE_MINUTES: int = 480

    MAX_INPUT_CHARS: int = 20000
    GENERATION_TIMEOUT_S: int = 180
    ETA_WINDOW: int = 20

    class Config:
        env_file = ".env"

    @cached_property
    def allowed_model_override_set(self) -> frozenset[str]:
        return frozenset(
            m.strip()
            for m in self.OLLAMA_ALLOWED_MODEL_OVERRIDES.split(",")
            if m.strip()
        )


settings = Settings()
