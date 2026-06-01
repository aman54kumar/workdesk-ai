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
from app.routers import admin, feedback, generate
from app.services.task_settings import seed_task_settings
from app.services.job_queue import start_job_consumer, stop_job_consumer
from app.services.company_profile import seed_company_profile


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("PRAGMA journal_mode=WAL"))
    await seed_task_settings()
    await seed_company_profile()
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
    ollama_status = "unreachable"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                ollama_status = "reachable"
    except Exception:
        ollama_status = "unreachable"

    return {"status": "ok", "ollama": ollama_status}
