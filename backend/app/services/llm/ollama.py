import asyncio
import json
import logging

import httpx

logger = logging.getLogger(__name__)

_OLLAMA_TIMEOUT = httpx.Timeout(connect=15.0, read=600.0, write=30.0, pool=15.0)
_CANCEL_POLL_S = 0.5


async def stream_ollama(
    model: str,
    messages: list,
    options: dict | None = None,
    *,
    base_url: str,
    cancel_event=None,
):
    """Streams tokens from Ollama as an async generator."""
    opts = options or {}
    ollama_options: dict = {
        "temperature": opts.get("temperature", 0.3),
        "num_predict": opts.get("num_predict", 600),
        "keep_alive": "10m",
    }
    if "seed" in opts:
        ollama_options["seed"] = opts["seed"]
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": ollama_options,
    }
    chat_url = f"{base_url.rstrip('/')}/api/chat"

    async with httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT) as client:
        async with client.stream("POST", chat_url, json=payload) as response:
            response.raise_for_status()
            lines = response.aiter_lines()
            while True:
                if cancel_event and cancel_event.is_set():
                    logger.info("Ollama stream cancelled for model=%s", model)
                    break
                try:
                    line = await asyncio.wait_for(
                        lines.__anext__(),
                        timeout=_CANCEL_POLL_S,
                    )
                except asyncio.TimeoutError:
                    continue
                except StopAsyncIteration:
                    break
                except httpx.ReadError as exc:
                    logger.warning("Ollama read error for model=%s: %s", model, exc)
                    yield {"__meta__": "incomplete"}
                    break
                if not line:
                    continue
                data = json.loads(line)
                if data.get("done", False):
                    done_reason = data.get("done_reason")
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield content
                    if done_reason == "length":
                        yield {"__meta__": "truncated"}
                    logger.info(
                        "Ollama stream finished model=%s reason=%s",
                        model,
                        done_reason,
                    )
                    break
                content = data.get("message", {}).get("content", "")
                if content:
                    yield content
