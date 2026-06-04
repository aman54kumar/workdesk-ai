import httpx
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from sqlalchemy import text

from app.database import Base, engine
from app.models import cache as _cache_models  # noqa: F401 — register models
from app.models import task_settings as _task_settings_models  # noqa: F401
from app.models import company_profile as _company_profile_models  # noqa: F401
from app.models import prompt_override as _prompt_override_models  # noqa: F401
from app.models import analytics as _analytics_models  # noqa: F401
from app.models import app_feedback as _app_feedback_models  # noqa: F401
from app.models import org_llm_settings as _org_llm_models  # noqa: F401
from app.routers import admin, feedback, generate
from app.services.task_settings import seed_task_settings
from app.services.job_queue import start_job_consumer, stop_job_consumer
from app.services.company_profile import seed_company_profile
from app.services.org_llm_settings import get_org_llm_settings, seed_org_llm_settings
from app.services.cloud_model_presets import (
    ensure_cloud_presets_seeded,
    schedule_cloud_preset_refresh,
)


async def _apply_sqlite_migrations(conn) -> None:
    """Lightweight migrations for existing SQLite DBs without Alembic."""
    result = await conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name='usage_event'")
    )
    if result.first():
        cols = await conn.execute(text("PRAGMA table_info(usage_event)"))
        col_names = {row[1] for row in cols.fetchall()}
        if "llm_source" not in col_names:
            await conn.execute(
                text(
                    "ALTER TABLE usage_event ADD COLUMN llm_source VARCHAR(10) DEFAULT 'local'"
                )
            )
        if "llm_provider" not in col_names:
            await conn.execute(
                text("ALTER TABLE usage_event ADD COLUMN llm_provider VARCHAR(30)")
            )

    result = await conn.execute(
        text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='org_llm_settings'"
        )
    )
    if result.first():
        cols = await conn.execute(text("PRAGMA table_info(org_llm_settings)"))
        col_names = {row[1] for row in cols.fetchall()}
        migrations = [
            ("cloud_presets_json", "ALTER TABLE org_llm_settings ADD COLUMN cloud_presets_json TEXT NOT NULL DEFAULT '{}'"),
            ("cloud_presets_refreshed_at", "ALTER TABLE org_llm_settings ADD COLUMN cloud_presets_refreshed_at DATETIME"),
            ("cloud_refresh_openai_key", "ALTER TABLE org_llm_settings ADD COLUMN cloud_refresh_openai_key TEXT"),
            ("cloud_refresh_anthropic_key", "ALTER TABLE org_llm_settings ADD COLUMN cloud_refresh_anthropic_key TEXT"),
            ("cloud_refresh_google_key", "ALTER TABLE org_llm_settings ADD COLUMN cloud_refresh_google_key TEXT"),
        ]
        for col, sql in migrations:
            if col not in col_names:
                await conn.execute(text(sql))


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await _apply_sqlite_migrations(conn)
    await seed_task_settings()
    await seed_company_profile()
    await seed_org_llm_settings()
    await ensure_cloud_presets_seeded()
    schedule_cloud_preset_refresh()
    await start_job_consumer()
    yield
    await stop_job_consumer()


app = FastAPI(title="WorkDesk AI", version="1.0.0", lifespan=lifespan)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate.router)
app.include_router(admin.router)
app.include_router(feedback.router)


@app.get("/health")
async def health_check():
    org = await get_org_llm_settings()
    ollama_status = "unreachable"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            if org.local_backend == "ollama":
                response = await client.get(f"{org.local_base_url}/api/tags")
            else:
                base = org.local_base_url.rstrip("/")
                if not base.endswith("/v1"):
                    base = f"{base}/v1"
                headers = {}
                if org.local_api_key:
                    headers["Authorization"] = f"Bearer {org.local_api_key}"
                response = await client.get(f"{base}/models", headers=headers)
            if response.status_code == 200:
                ollama_status = "reachable"
    except Exception:
        ollama_status = "unreachable"

    return {
        "status": "ok",
        "local_llm": ollama_status,
        "local_backend": org.local_backend,
    }
