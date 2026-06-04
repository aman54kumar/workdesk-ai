import asyncio
import json
import logging

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(connect=15.0, read=600.0, write=30.0, pool=15.0)
_CANCEL_POLL_S = 0.5


def _normalize_openai_base(base_url: str) -> str:
    base = base_url.rstrip("/")
    if not base.endswith("/v1"):
        base = f"{base}/v1"
    return base


async def stream_openai_compat(
    model: str,
    messages: list[dict[str, str]],
    options: dict | None = None,
    *,
    base_url: str,
    api_key: str,
    cancel_event=None,
):
    opts = options or {}
    url = f"{_normalize_openai_base(base_url)}/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": opts.get("temperature", 0.3),
        "max_tokens": opts.get("num_predict", 600),
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

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
                    logger.warning("OpenAI-compatible read error: %s", exc)
                    yield {"__meta__": "incomplete"}
                    break
                if not line or not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                choices = data.get("choices") or []
                if not choices:
                    continue
                choice = choices[0]
                delta = choice.get("delta") or {}
                content = delta.get("content")
                if content:
                    yield content
                finish = choice.get("finish_reason")
                if finish == "length":
                    yield {"__meta__": "truncated"}
