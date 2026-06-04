from typing import Any, AsyncIterator

MetaChunk = dict[str, str]


async def stream_chat(
    *,
    backend: str,
    base_url: str,
    model: str,
    messages: list[dict[str, str]],
    options: dict[str, Any] | None = None,
    api_key: str | None = None,
    cancel_event=None,
) -> AsyncIterator[str | MetaChunk]:
    from app.services.llm import anthropic, google, ollama, openai_compat

    opts = options or {}
    if backend == "ollama":
        async for chunk in ollama.stream_ollama(
            model,
            messages,
            opts,
            base_url=base_url,
            cancel_event=cancel_event,
        ):
            yield chunk
        return

    if backend == "openai_compat":
        async for chunk in openai_compat.stream_openai_compat(
            model,
            messages,
            opts,
            base_url=base_url,
            api_key=api_key or "",
            cancel_event=cancel_event,
        ):
            yield chunk
        return

    if backend == "anthropic":
        async for chunk in anthropic.stream_anthropic(
            model,
            messages,
            opts,
            api_key=api_key or "",
            cancel_event=cancel_event,
        ):
            yield chunk
        return

    if backend == "google":
        async for chunk in google.stream_gemini(
            model,
            messages,
            opts,
            api_key=api_key or "",
            cancel_event=cancel_event,
        ):
            yield chunk
        return

    raise ValueError(f"Unknown LLM backend: {backend}")
