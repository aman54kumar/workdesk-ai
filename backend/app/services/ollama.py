"""Backward-compatible Ollama helper; prefer app.services.llm.router for new code."""

from app.config import settings
from app.services.llm.ollama import stream_ollama as _stream_ollama

OLLAMA_CHAT_URL = f"{settings.OLLAMA_BASE_URL}/api/chat"


async def stream_ollama(
    model: str,
    messages: list,
    options: dict | None = None,
    cancel_event=None,
    *,
    base_url: str | None = None,
):
    url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
    async for chunk in _stream_ollama(
        model,
        messages,
        options,
        base_url=url,
        cancel_event=cancel_event,
    ):
        yield chunk
