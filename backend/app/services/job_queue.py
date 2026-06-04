"""Single-consumer local LLM job queue with position / ETA frames."""

from __future__ import annotations

import asyncio
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from app.config import settings
from app.services.llm.errors import provider_error_message
from app.services.llm.router import stream_chat

_DEFAULT_ETA_S = 45.0

_durations_by_model: dict[str, deque[float]] = {}
_jobs_by_id: dict[str, Job] = {}
_work_queue: asyncio.Queue[Job | None] = asyncio.Queue()
_waiting: list[Job] = []
_processing: Job | None = None
_consumer_task: asyncio.Task[None] | None = None


@dataclass
class Job:
    id: str
    model: str
    messages: list[dict[str, str]]
    options: dict[str, Any]
    backend: str = "ollama"
    base_url: str = ""
    api_key: str | None = None
    output_queue: asyncio.Queue[dict[str, Any]] = field(default_factory=asyncio.Queue)
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    cancel_notified: bool = False
    position: int = 0


def _avg_duration(model: str) -> float:
    samples = _durations_by_model.get(model)
    if not samples:
        return _DEFAULT_ETA_S
    return sum(samples) / len(samples)


def _record_duration(model: str, seconds: float) -> None:
    if model not in _durations_by_model:
        _durations_by_model[model] = deque(maxlen=settings.ETA_WINDOW)
    _durations_by_model[model].append(seconds)


def _eta_for(job: Job) -> int:
    return max(1, int(job.position * _avg_duration(job.model)))


async def _push_queued_frame(job: Job) -> None:
    await job.output_queue.put(
        {
            "type": "queued",
            "position": job.position,
            "eta_s": _eta_for(job),
            "job_id": job.id,
        }
    )


async def _refresh_waiting_positions() -> None:
    offset = 1 if _processing else 0
    for idx, job in enumerate(_waiting):
        if job.cancel_event.is_set():
            continue
        job.position = idx + offset
        await _push_queued_frame(job)


def _enqueue_position() -> int:
    return len(_waiting) + (1 if _processing else 0)


async def enqueue_job(
    model: str,
    messages: list[dict[str, str]],
    options: dict[str, Any] | None = None,
    *,
    backend: str = "ollama",
    base_url: str = "",
    api_key: str | None = None,
) -> Job:
    job = Job(
        id=str(uuid.uuid4()),
        model=model,
        messages=messages,
        options=options or {},
        backend=backend,
        base_url=base_url,
        api_key=api_key,
    )
    job.position = _enqueue_position()
    _waiting.append(job)
    _jobs_by_id[job.id] = job
    await _work_queue.put(job)
    await _push_queued_frame(job)
    return job


async def cancel_job(job: Job) -> None:
    if job.cancel_event.is_set():
        return
    job.cancel_event.set()
    if job in _waiting:
        _waiting.remove(job)
        job.cancel_notified = True
        await job.output_queue.put({"type": "error", "msg": "cancelled"})
        await _refresh_waiting_positions()


async def cancel_job_by_id(job_id: str) -> bool:
    job = _jobs_by_id.get(job_id)
    if job is None:
        return False
    await cancel_job(job)
    return True


async def _run_job(job: Job) -> None:
    global _processing
    _processing = job
    await job.output_queue.put({"type": "start"})
    start = time.monotonic()
    full_parts: list[str] = []
    status = "success"
    truncated = False

    try:
        async with asyncio.timeout(settings.GENERATION_TIMEOUT_S):
            async for chunk in stream_chat(
                backend=job.backend,
                base_url=job.base_url,
                model=job.model,
                messages=job.messages,
                options=job.options,
                api_key=job.api_key,
                cancel_event=job.cancel_event,
            ):
                if job.cancel_event.is_set():
                    status = "cancelled"
                    break
                if isinstance(chunk, dict) and chunk.get("__meta__") == "truncated":
                    truncated = True
                    await job.output_queue.put({"type": "truncated"})
                    continue
                if isinstance(chunk, dict) and chunk.get("__meta__") == "incomplete":
                    status = "error"
                    await job.output_queue.put(
                        {"type": "error", "msg": "generation incomplete"}
                    )
                    return
                if isinstance(chunk, dict) and chunk.get("__meta__") == "provider_error":
                    status = "error"
                    await job.output_queue.put(
                        {
                            "type": "error",
                            "msg": chunk.get("message") or "generation failed",
                        }
                    )
                    return
                if isinstance(chunk, str) and chunk:
                    full_parts.append(chunk)
                    await job.output_queue.put({"type": "token", "t": chunk})
    except TimeoutError:
        status = "timeout"
        await job.output_queue.put({"type": "error", "msg": "timeout"})
        return
    except Exception as exc:
        status = "error"
        await job.output_queue.put(
            {"type": "error", "msg": provider_error_message(exc)}
        )
        return
    finally:
        elapsed = time.monotonic() - start
        if status == "success":
            _record_duration(job.model, elapsed)
        _processing = None

    if job.cancel_event.is_set():
        job.cancel_notified = True
        await job.output_queue.put({"type": "error", "msg": "cancelled"})
        return

    if status == "success":
        job._assembled = "".join(full_parts)  # type: ignore[attr-defined]
        job._truncated = truncated  # type: ignore[attr-defined]
        await job.output_queue.put(
            {"type": "done", "cached": False, "model": job.model}
        )


async def _consumer_loop() -> None:
    while True:
        job = await _work_queue.get()
        if job is None:
            _work_queue.task_done()
            break
        try:
            if job in _waiting:
                _waiting.remove(job)

            if job.cancel_event.is_set():
                if not job.cancel_notified:
                    job.cancel_notified = True
                    await job.output_queue.put({"type": "error", "msg": "cancelled"})
                continue

            await _run_job(job)
        finally:
            _jobs_by_id.pop(job.id, None)
            _work_queue.task_done()
            await _refresh_waiting_positions()


async def start_job_consumer() -> None:
    global _consumer_task
    if _consumer_task is None or _consumer_task.done():
        _consumer_task = asyncio.create_task(_consumer_loop())


async def stop_job_consumer() -> None:
    global _consumer_task
    await _work_queue.put(None)
    if _consumer_task is not None:
        await _consumer_task
        _consumer_task = None


async def iter_job_frames(job: Job) -> AsyncIterator[dict[str, Any]]:
    while True:
        frame = await job.output_queue.get()
        yield frame
        if frame.get("type") in ("done", "error"):
            break


async def stream_cloud_frames(
    *,
    backend: str,
    base_url: str,
    model: str,
    messages: list[dict[str, str]],
    options: dict[str, Any],
    api_key: str,
    cancel_event: asyncio.Event | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Stream generation frames for cloud BYOK (no queue)."""
    yield {"type": "start"}
    full_parts: list[str] = []
    try:
        async with asyncio.timeout(settings.GENERATION_TIMEOUT_S):
            async for chunk in stream_chat(
                backend=backend,
                base_url=base_url,
                model=model,
                messages=messages,
                options=options,
                api_key=api_key,
                cancel_event=cancel_event,
            ):
                if cancel_event and cancel_event.is_set():
                    yield {"type": "error", "msg": "cancelled"}
                    return
                if isinstance(chunk, dict) and chunk.get("__meta__") == "truncated":
                    yield {"type": "truncated"}
                    continue
                if isinstance(chunk, dict) and chunk.get("__meta__") == "incomplete":
                    yield {"type": "error", "msg": "generation incomplete"}
                    return
                if isinstance(chunk, dict) and chunk.get("__meta__") == "provider_error":
                    yield {
                        "type": "error",
                        "msg": chunk.get("message") or "generation failed",
                    }
                    return
                if isinstance(chunk, str) and chunk:
                    full_parts.append(chunk)
                    yield {"type": "token", "t": chunk}
    except TimeoutError:
        yield {"type": "error", "msg": "timeout"}
        return
    except Exception as exc:
        yield {"type": "error", "msg": provider_error_message(exc)}
        return

    if cancel_event and cancel_event.is_set():
        yield {"type": "error", "msg": "cancelled"}
        return

    yield {"type": "done", "cached": False, "model": model}
