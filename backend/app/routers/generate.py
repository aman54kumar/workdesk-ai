import asyncio
import json
import random
import time

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.config import settings
from app.prompts.resolver import resolve_prompt
from app.prompts.templates import TASK_MODEL_MAP
from app.schemas.admin import PublicTaskResponse
from app.schemas.generate import CancelJobRequest, GenerateRequest
from app.services.cache import get_cached, make_cache_key, set_cache
from app.services import task_settings as task_settings_service
from app.services.job_queue import cancel_job_by_id, enqueue_job, iter_job_frames
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

    config = TASK_MODEL_MAP[request.task_type]
    model = await task_settings_service.resolve_model(request.task_type)
    template = await resolve_prompt(request.task_type)
    system_prompt = template["system"]
    user_prompt = template["user_template"].format(**request.variables)

    bypass_cache = (
        request.task_type in NO_CACHE_TASK_TYPES or request.skip_cache
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

            job = await enqueue_job(model, messages, options)

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
            )

    return StreamingResponse(stream_body(), media_type="application/x-ndjson")


@router.post("/cancel")
async def cancel_generation(request: CancelJobRequest):
    # Idempotent: job may already have finished and been removed from the registry.
    await cancel_job_by_id(request.job_id)
    return {"ok": True}
