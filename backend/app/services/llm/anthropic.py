import asyncio
import json
import logging

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(connect=15.0, read=600.0, write=30.0, pool=15.0)
_CANCEL_POLL_S = 0.5
_ANTHROPIC_VERSION = "2023-06-01"


def _split_system(messages: list[dict[str, str]]) -> tuple[str | None, list[dict[str, str]]]:
    system_parts: list[str] = []
    rest: list[dict[str, str]] = []
    for msg in messages:
        if msg.get("role") == "system":
            system_parts.append(msg.get("content", ""))
        else:
            rest.append({"role": msg["role"], "content": msg.get("content", "")})
    system = "\n\n".join(p for p in system_parts if p).strip() or None
    return system, rest


async def stream_anthropic(
    model: str,
    messages: list[dict[str, str]],
    options: dict | None = None,
    *,
    api_key: str,
    cancel_event=None,
):
    opts = options or {}
    system, chat_messages = _split_system(messages)
    payload: dict = {
        "model": model,
        "max_tokens": opts.get("num_predict", 600),
        "messages": chat_messages,
        "stream": True,
        "temperature": opts.get("temperature", 0.3),
    }
    if system:
        payload["system"] = system

    headers = {
        "x-api-key": api_key,
        "anthropic-version": _ANTHROPIC_VERSION,
        "content-type": "application/json",
    }
    url = "https://api.anthropic.com/v1/messages"

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as response:
            response.raise_for_status()
            lines = response.aiter_lines()
            while True:
                if cancel_event and cancel_event.is_set():
                    break
                try:
                    line = await asyncio.wait_for(lines.__anext__(), timeout=_CANCEL_POLL_S)
                except asyncio.TimeoutError:
                    continue
                except StopAsyncIteration:
                    break
                except httpx.ReadError as exc:
                    logger.warning("Anthropic read error: %s", exc)
                    yield {"__meta__": "incomplete"}
                    break
                if not line or not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if not data_str:
                    continue
                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                event_type = data.get("type")
                if event_type == "error":
                    err = data.get("error") or {}
                    message = err.get("message") if isinstance(err, dict) else str(err)
                    yield {"__meta__": "provider_error", "message": message or "Anthropic error"}
                    break
                if event_type == "content_block_delta":
                    delta = data.get("delta") or {}
                    text = delta.get("text")
                    if text:
                        yield text
                elif event_type == "message_delta":
                    delta = data.get("delta") or {}
                    if delta.get("stop_reason") == "max_tokens":
                        yield {"__meta__": "truncated"}
                elif event_type == "message_stop":
                    break
