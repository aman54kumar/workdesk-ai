from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import require_admin
from app.auth.jwt import create_access_token
from app.config import settings
from app.schemas.admin import (
    AdminLoginRequest,
    AdminLoginResponse,
    AppFeedbackRow,
    AdminDateBoundsResponse,
    AnalyticsSummaryResponse,
    AnalyticsToolRow,
    CompanyProfileBulkSave,
    CompanyProfileSectionResponse,
    FeedbackCommentRow,
    PromptTemplateResponse,
    PromptTemplateSave,
    TaskSettingResponse,
    TaskSettingUpdate,
)
from app.services import company_profile_admin, prompts_admin, task_settings as task_settings_service
from app.services.app_feedback import list_app_feedback
from app.services.admin_dates import get_record_date_bounds
from app.services.usage import analytics_by_tool, recent_feedback_comments
from app.database import AsyncSessionLocal

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(body: AdminLoginRequest):
    if (
        body.username != settings.ADMIN_USERNAME
        or body.password != settings.ADMIN_PASSWORD
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    return AdminLoginResponse(access_token=create_access_token(body.username))


@router.get("/models")
async def list_allowed_models(_: str = Depends(require_admin)):
    return {
        "models": sorted(settings.allowed_model_override_set),
        "tiers": {
            "default": settings.OLLAMA_MODEL_DEFAULT,
            "code": settings.OLLAMA_MODEL_CODE,
            "quality": settings.OLLAMA_MODEL_QUALITY,
        },
    }


@router.get("/tasks", response_model=list[TaskSettingResponse])
async def get_admin_tasks(_: str = Depends(require_admin)):
    return await task_settings_service.list_admin_tasks()


@router.patch("/tasks/{task_type}", response_model=TaskSettingResponse)
async def patch_admin_task(
    task_type: str,
    body: TaskSettingUpdate,
    _: str = Depends(require_admin),
):
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    try:
        updated = await task_settings_service.update_task_setting(
            task_type,
            is_active=changes.get("is_active"),
            model_override=changes.get("model_override"),
            clear_model_override="model_override" in changes
            and changes["model_override"] is None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc),
        ) from exc

    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown task")

    return updated


# --- Company profile ---


@router.get("/company-profile", response_model=list[CompanyProfileSectionResponse])
async def get_company_profile(_: str = Depends(require_admin)):
    rows = await company_profile_admin.list_sections()
    return rows


@router.put("/company-profile", response_model=list[CompanyProfileSectionResponse])
async def save_company_profile(
    body: CompanyProfileBulkSave,
    _: str = Depends(require_admin),
):
    updates = [s.model_dump(exclude_unset=True) for s in body.sections]
    rows = await company_profile_admin.bulk_save_sections(updates)
    return rows


@router.delete("/company-profile/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company_profile_section(
    section_id: int,
    _: str = Depends(require_admin),
):
    if not await company_profile_admin.delete_section(section_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


# --- Prompt templates ---


@router.get("/prompts", response_model=list[PromptTemplateResponse])
async def list_prompts(_: str = Depends(require_admin)):
    return await prompts_admin.list_all_templates()


@router.get("/prompts/{task_type}", response_model=PromptTemplateResponse)
async def get_prompt(task_type: str, _: str = Depends(require_admin)):
    try:
        return await prompts_admin.get_effective_template(task_type)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown task") from exc


@router.put("/prompts/{task_type}", response_model=PromptTemplateResponse)
async def save_prompt(
    task_type: str,
    body: PromptTemplateSave,
    _: str = Depends(require_admin),
):
    try:
        return await prompts_admin.save_override(
            task_type,
            body.system,
            body.user_template,
            body.use_company_profile,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc),
        ) from exc


@router.delete("/prompts/{task_type}", response_model=PromptTemplateResponse)
async def reset_prompt(task_type: str, _: str = Depends(require_admin)):
    try:
        return await prompts_admin.reset_override(task_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# --- Analytics ---


@router.get("/date-bounds", response_model=AdminDateBoundsResponse)
async def get_date_bounds(_: str = Depends(require_admin)):
    return AdminDateBoundsResponse(**await get_record_date_bounds())


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@router.get("/analytics/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    _: str = Depends(require_admin),
    since: str | None = Query(None),
    until: str | None = Query(None),
):
    since_dt, until_dt = _parse_dt(since), _parse_dt(until)
    async with AsyncSessionLocal() as session:
        from app.models.analytics import UsageEvent
        from sqlalchemy import func, select

        q = select(UsageEvent)
        if since_dt:
            q = q.where(UsageEvent.created_at >= since_dt)
        if until_dt:
            q = q.where(UsageEvent.created_at <= until_dt)
        sub = q.subquery()
        total = await session.scalar(select(func.count()).select_from(sub)) or 0
        cached = (
            await session.scalar(
                select(func.count()).select_from(sub).where(sub.c.cached.is_(True))
            )
            or 0
        )
        avg_latency = await session.scalar(
            select(func.avg(sub.c.latency_ms)).where(sub.c.cached.is_(False))
        )
    return AnalyticsSummaryResponse(
        total_requests=total,
        cache_hit_rate=(cached / total) if total else 0.0,
        avg_latency_ms=int(avg_latency or 0),
    )


@router.get("/analytics/tools", response_model=list[AnalyticsToolRow])
async def get_analytics_tools(
    _: str = Depends(require_admin),
    since: str | None = Query(None),
    until: str | None = Query(None),
):
    return await analytics_by_tool(_parse_dt(since), _parse_dt(until))


@router.get("/analytics/comments", response_model=list[FeedbackCommentRow])
async def get_analytics_comments(
    _: str = Depends(require_admin),
    since: str | None = Query(None),
    until: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    return await recent_feedback_comments(limit, _parse_dt(since), _parse_dt(until))


@router.get("/feedback", response_model=list[AppFeedbackRow])
async def get_app_feedback(
    _: str = Depends(require_admin),
    since: str | None = Query(None),
    until: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    return await list_app_feedback(
        limit=limit,
        since=_parse_dt(since),
        until=_parse_dt(until),
    )
