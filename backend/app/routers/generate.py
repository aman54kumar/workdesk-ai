import asyncio
import json
import random
import time

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.config import settings
from app.prompts.resolver import resolve_prompt
from app.prompts.templates import get_task_config
from app.schemas.admin import PublicTaskResponse
from app.schemas.generate import (
    CancelJobRequest,
    CompanyProfileStatusResponse,
    CloudModelPreset,
    GenerateRequest,
    LlmOptionsResponse,
    LlmOptionsLocal,
    LlmOptionsCloud,
)
from app.services.company_profile import build_company_context, company_profile_status
from app.services.cache import get_cached, make_cache_key, set_cache
from app.services import task_settings as task_settings_service
from app.services.job_queue import (
    cancel_job_by_id,
    enqueue_job,
    iter_job_frames,
    stream_cloud_frames,
)
from app.services.llm_resolution import resolve_generation_llm
from app.services.org_llm_settings import get_org_llm_settings
from app.services.cloud_model_presets import get_cloud_model_presets
from app.services.usage import record_usage

router = APIRouter(prefix="/generate", tags=["generate"])

NO_CACHE_TASK_TYPES = frozenset({
    "email_composer",
    "meeting_mom",
    "summarise_doc",
    "status_report",
    "risk_register",
    "explain_code",
    "commit_message",
    "bug_report",
    "de_ai_text",
})


def _input_char_count(variables: dict[str, str]) -> int:
    return sum(len(v) for v in variables.values())


def _frame_line(frame: dict) -> str:
    return json.dumps(frame, ensure_ascii=False) + "\n"


@router.get("/limits")
async def get_limits():
    return {"max_input_chars": settings.MAX_INPUT_CHARS}


@router.get("/tasks", response_model=list[PublicTaskResponse])
async def get_tasks():
    return await task_settings_service.list_public_tasks()


@router.get("/company-profile-status", response_model=CompanyProfileStatusResponse)
async def get_company_profile_status():
    return CompanyProfileStatusResponse(**await company_profile_status())


@router.get("/llm-options", response_model=LlmOptionsResponse)
async def get_llm_options():
    org = await get_org_llm_settings()
    presets_raw = await get_cloud_model_presets()
    presets: dict[str, list[CloudModelPreset]] = {}
    for provider in org.allowed_cloud_providers:
        if provider == "custom":
            continue
        items = presets_raw.get(provider, [])
        presets[provider] = [
            CloudModelPreset(id=item["id"], label=item["label"]) for item in items
        ]
    return LlmOptionsResponse(
        local=LlmOptionsLocal(
            enabled=True,
            models=org.allowed_models,
            backend=org.local_backend,
        ),
        cloud=LlmOptionsCloud(
            enabled=org.allow_user_cloud,
            providers=org.allowed_cloud_providers,
            presets=presets,
        ),
        org_display_name=org.org_display_name,
    )


@router.post("/stream")
async def generate_stream(request: GenerateRequest):
    if not await task_settings_service.is_task_active(request.task_type):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This tool is currently disabled",
        )

    char_count = _input_char_count(request.variables)
    if char_count > settings.MAX_INPUT_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Input is too long ({char_count:,} characters). "
                f"Maximum allowed is {settings.MAX_INPUT_CHARS:,} characters."
            ),
        )

    llm_payload = request.llm.model_dump(exclude_none=True) if request.llm else None
    resolved = await resolve_generation_llm(request.task_type, llm_payload)
    config = await get_task_config(request.task_type)
    model = resolved.model

    template = await resolve_prompt(request.task_type)
    system_prompt = template["system"]
    variables = dict(request.variables)
    if request.task_type == "eligibility_check":
        cred = (variables.get("credentials") or "").strip()
        if not cred:
            profile = await build_company_context()
            variables["credentials"] = (
                profile
                if profile
                else "No company credentials are available. Mark all criteria as Needs Verification."
            )
    user_prompt = template["user_template"].format(**variables)

    is_cloud = resolved.source == "cloud"
    bypass_cache = (
        request.task_type in NO_CACHE_TASK_TYPES or request.skip_cache or is_cloud
    )
    cache_key = make_cache_key(model, system_prompt, user_prompt)
    cached = None if bypass_cache else await get_cached(cache_key)

    async def stream_body():
        started = time.monotonic()
        final_status = "success"
        was_cached = False

        try:
            if cached:
                was_cached = True
                yield _frame_line({"type": "start"})
                for i in range(0, len(cached), 50):
                    yield _frame_line({"type": "token", "t": cached[i : i + 50]})
                    await asyncio.sleep(0.005)
                yield _frame_line({"type": "done", "cached": True, "model": model})
                return

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            options: dict = {
                "num_predict": config["num_predict"],
                "temperature": config["temperature"],
            }
            if bypass_cache:
                options["seed"] = random.randint(1, 2**31 - 1)

            if is_cloud:
                async for frame in stream_cloud_frames(
                    backend=resolved.backend,
                    base_url=resolved.base_url,
                    model=model,
                    messages=messages,
                    options=options,
                    api_key=resolved.api_key or "",
                ):
                    yield _frame_line(frame)
                    ftype = frame.get("type")
                    if ftype == "error":
                        msg = frame.get("msg", "error")
                        if msg == "timeout":
                            final_status = "timeout"
                        else:
                            final_status = "error"
                    elif ftype == "done":
                        pass
            else:
                job = await enqueue_job(
                    model,
                    messages,
                    options,
                    backend=resolved.backend,
                    base_url=resolved.base_url,
                    api_key=resolved.api_key,
                )

                async for frame in iter_job_frames(job):
                    yield _frame_line(frame)
                    ftype = frame.get("type")
                    if ftype == "error":
                        msg = frame.get("msg", "error")
                        if msg == "timeout":
                            final_status = "timeout"
                        elif msg == "cancelled":
                            final_status = "cancelled"
                        else:
                            final_status = "error"
                    elif ftype == "done" and not frame.get("cached"):
                        assembled = getattr(job, "_assembled", "")
                        if assembled and not bypass_cache:
                            await set_cache(
                                cache_key,
                                model,
                                request.task_type,
                                assembled,
                                ttl_hours=settings.CACHE_TTL_HOURS,
                            )
        finally:
            latency_ms = 0 if was_cached else int((time.monotonic() - started) * 1000)
            await record_usage(
                task_type=request.task_type,
                model=model,
                cached=was_cached,
                latency_ms=latency_ms,
                input_chars=char_count,
                status=final_status,
                llm_source=resolved.source,
                llm_provider=resolved.provider,
            )

    return StreamingResponse(stream_body(), media_type="application/x-ndjson")


@router.post("/cancel")
async def cancel_generation(request: CancelJobRequest):
    await cancel_job_by_id(request.job_id)
    return {"ok": True}
