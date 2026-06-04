import asyncio
import json
import logging

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(connect=15.0, read=600.0, write=30.0, pool=15.0)
_CANCEL_POLL_S = 0.5


def _to_gemini_contents(messages: list[dict[str, str]]) -> tuple[str | None, list[dict]]:
    system_parts: list[str] = []
    contents: list[dict] = []
    for msg in messages:
        role = msg.get("role", "user")
        text = msg.get("content", "")
        if role == "system":
            system_parts.append(text)
            continue
        gemini_role = "model" if role == "assistant" else "user"
        contents.append({"role": gemini_role, "parts": [{"text": text}]})
    system = "\n\n".join(p for p in system_parts if p).strip() or None
    return system, contents


async def stream_gemini(
    model: str,
    messages: list[dict[str, str]],
    options: dict | None = None,
    *,
    api_key: str,
    cancel_event=None,
):
    opts = options or {}
    system, contents = _to_gemini_contents(messages)
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:streamGenerateContent?alt=sse&key={api_key}"
    )
    payload: dict = {
        "contents": contents,
        "generationConfig": {
            "temperature": opts.get("temperature", 0.3),
            "maxOutputTokens": opts.get("num_predict", 600),
        },
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}

    headers = {"Content-Type": "application/json"}

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
                    logger.warning("Gemini read error: %s", exc)
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
                candidates = data.get("candidates") or []
                if not candidates:
                    continue
                parts = candidates[0].get("content", {}).get("parts") or []
                for part in parts:
                    text = part.get("text")
                    if text:
                        yield text
                finish = candidates[0].get("finishReason")
                if finish == "MAX_TOKENS":
                    yield {"__meta__": "truncated"}
