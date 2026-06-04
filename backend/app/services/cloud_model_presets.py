import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select

from app.config import settings
from app.data.cloud_model_presets import DEFAULT_CLOUD_PRESETS, default_label_map
from app.database import AsyncSessionLocal
from app.models.org_llm_settings import OrgLlmSettings
from app.services.org_llm_settings import ORG_SINGLETON_ID, seed_org_llm_settings

logger = logging.getLogger(__name__)

_PROVIDER_ORDER = ("openai", "anthropic", "google")
_OPENAI_CHAT_PREFIXES = ("gpt-", "chatgpt-", "o1", "o3", "o4", "o5")
_OPENAI_EXCLUDE_FRAGMENTS = (
    "whisper",
    "tts",
    "dall-e",
    "embedding",
    "embed",
    "moderation",
    "instruct",
    "realtime",
    "transcribe",
    "audio",
    "gpt-image",
    "babbage",
    "davinci",
    "curie",
    "ada",
    "text-search",
    "code-search",
    "similarity",
    "search",
    "edit",
    "query",
)
_DATE_SNAPSHOT = re.compile(r"-\d{4}-\d{2}-\d{2}$")


def _defaults_dict() -> dict[str, list[dict[str, str]]]:
    return {k: [dict(p) for p in v] for k, v in DEFAULT_CLOUD_PRESETS.items()}


def _merge_defaults_into(
    presets: dict[str, list[dict[str, str]]],
) -> dict[str, list[dict[str, str]]]:
    """Ensure curated defaults appear first; keep any extra models from DB/API refresh."""
    out: dict[str, list[dict[str, str]]] = {}
    all_providers = set(DEFAULT_CLOUD_PRESETS) | set(presets)
    for provider in all_providers:
        merged: list[dict[str, str]] = []
        seen: set[str] = set()
        for preset in DEFAULT_CLOUD_PRESETS.get(provider, []):
            mid = preset["id"]
            if mid not in seen:
                merged.append(dict(preset))
                seen.add(mid)
        for item in presets.get(provider, []):
            mid = item["id"]
            if mid not in seen:
                merged.append(item)
                seen.add(mid)
        if merged:
            out[provider] = merged
    return out


def _parse_presets(raw: str | None) -> dict[str, list[dict[str, str]]]:
    if not raw:
        return _defaults_dict()
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            out: dict[str, list[dict[str, str]]] = {}
            for provider, items in data.items():
                if not isinstance(items, list):
                    continue
                cleaned: list[dict[str, str]] = []
                for item in items:
                    if isinstance(item, dict) and item.get("id"):
                        cleaned.append(
                            {
                                "id": str(item["id"]),
                                "label": str(item.get("label") or item["id"]),
                            }
                        )
                if cleaned:
                    out[str(provider)] = cleaned
            if out:
                return _merge_defaults_into(out)
    except json.JSONDecodeError:
        pass
    return _defaults_dict()


def _serialize_presets(presets: dict[str, list[dict[str, str]]]) -> str:
    return json.dumps(presets, ensure_ascii=False)


def _auto_label(model_id: str) -> str:
    return model_id.replace("-", " ").replace("_", " ")


def _is_openai_chat_model(model_id: str) -> bool:
    lower = model_id.lower()
    if any(fragment in lower for fragment in _OPENAI_EXCLUDE_FRAGMENTS):
        return False
    return any(lower.startswith(prefix) for prefix in _OPENAI_CHAT_PREFIXES)


def _dedupe_openai_snapshots(ids: list[str]) -> list[str]:
    """Drop dated snapshots when a stable alias exists (e.g. gpt-5.4-mini vs gpt-5.4-mini-2026-03-17)."""
    id_set = set(ids)
    out: list[str] = []
    for mid in ids:
        match = _DATE_SNAPSHOT.search(mid)
        if match and mid[: match.start()] in id_set:
            continue
        out.append(mid)
    return out


def _openai_sort_key(model_id: str) -> tuple:
    lower = model_id.lower()
    if lower.startswith("gpt-5.5"):
        return (0, lower)
    if lower.startswith("gpt-5.4"):
        return (1, lower)
    if lower.startswith("gpt-5"):
        return (2, lower)
    if lower.startswith("gpt-4"):
        return (3, lower)
    if lower.startswith(("o3", "o4", "o5")):
        return (4, lower)
    return (5, lower)


def _merge_provider_presets(
    provider: str,
    fetched_ids: list[str],
    existing: list[dict[str, str]],
    labels: dict[str, dict[str, str]],
) -> list[dict[str, str]]:
    known = labels.get(provider, {})
    order: list[str] = []
    seen: set[str] = set()

    for preset in DEFAULT_CLOUD_PRESETS.get(provider, []):
        mid = preset["id"]
        if mid not in seen:
            order.append(mid)
            seen.add(mid)

    for item in existing:
        mid = item["id"]
        if mid not in seen:
            order.append(mid)
            seen.add(mid)

    for mid in sorted(fetched_ids, key=_openai_sort_key):
        if mid not in seen:
            order.append(mid)
            seen.add(mid)

    result: list[dict[str, str]] = []
    for mid in order:
        label = known.get(mid) or _auto_label(mid)
        result.append({"id": mid, "label": label})
    return result


def _refresh_key_for_provider(row: OrgLlmSettings, provider: str) -> str | None:
    row_key = {
        "openai": row.cloud_refresh_openai_key,
        "anthropic": row.cloud_refresh_anthropic_key,
        "google": row.cloud_refresh_google_key,
    }.get(provider)
    if row_key and row_key.strip():
        return row_key.strip()
    env_key = {
        "openai": settings.CLOUD_MODEL_REFRESH_OPENAI_KEY,
        "anthropic": settings.CLOUD_MODEL_REFRESH_ANTHROPIC_KEY,
        "google": settings.CLOUD_MODEL_REFRESH_GOOGLE_KEY,
    }.get(provider)
    return env_key.strip() if env_key and env_key.strip() else None


async def _fetch_openai_model_ids(api_key: str) -> list[str]:
    timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        response.raise_for_status()
        data = response.json()
    ids: list[str] = []
    for item in data.get("data") or []:
        mid = str(item.get("id", "")).strip()
        if mid and _is_openai_chat_model(mid):
            ids.append(mid)
    return _dedupe_openai_snapshots(ids)


async def _fetch_anthropic_model_ids(api_key: str) -> list[str]:
    timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            "https://api.anthropic.com/v1/models",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
        )
        response.raise_for_status()
        data = response.json()
    ids: list[str] = []
    for item in data.get("data") or []:
        mid = str(item.get("id", "")).strip()
        if mid:
            ids.append(mid)
    return ids


async def _fetch_google_model_ids(api_key: str) -> list[str]:
    timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
    url = "https://generativelanguage.googleapis.com/v1beta/models"
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url, params={"key": api_key})
        response.raise_for_status()
        data = response.json()
    ids: list[str] = []
    for item in data.get("models") or []:
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        mid = name.split("/")[-1] if "/" in name else name
        methods = item.get("supportedGenerationMethods") or []
        if "generateContent" in methods and "gemini" in mid.lower():
            ids.append(mid)
    return ids


async def _fetch_provider_ids(provider: str, api_key: str) -> list[str]:
    if provider == "openai":
        return await _fetch_openai_model_ids(api_key)
    if provider == "anthropic":
        return await _fetch_anthropic_model_ids(api_key)
    if provider == "google":
        return await _fetch_google_model_ids(api_key)
    return []


async def get_cloud_model_presets() -> dict[str, list[dict[str, str]]]:
    await seed_org_llm_settings()
    async with AsyncSessionLocal() as session:
        row = await session.get(OrgLlmSettings, ORG_SINGLETON_ID)
        if row is None:
            return {k: [dict(p) for p in v] for k, v in DEFAULT_CLOUD_PRESETS.items()}
        return _parse_presets(row.cloud_presets_json)


async def ensure_cloud_presets_seeded() -> None:
    await seed_org_llm_settings()
    async with AsyncSessionLocal() as session:
        row = await session.get(OrgLlmSettings, ORG_SINGLETON_ID)
        if row is None:
            return
        current = _parse_presets(row.cloud_presets_json)
        merged = _merge_defaults_into(current)
        serialized = _serialize_presets(merged)
        if row.cloud_presets_json != serialized:
            row.cloud_presets_json = serialized
            if row.cloud_presets_refreshed_at is None:
                row.cloud_presets_refreshed_at = datetime.now(timezone.utc)
            await session.commit()
        elif not row.cloud_presets_json or row.cloud_presets_json.strip() in ("", "{}"):
            row.cloud_presets_json = serialized
            row.cloud_presets_refreshed_at = datetime.now(timezone.utc)
            await session.commit()


def _is_stale(refreshed_at: datetime | None) -> bool:
    if refreshed_at is None:
        return True
    now = datetime.now(timezone.utc)
    if refreshed_at.tzinfo is None:
        refreshed_at = refreshed_at.replace(tzinfo=timezone.utc)
    age_days = (now - refreshed_at).days
    return age_days >= settings.CLOUD_PRESET_REFRESH_DAYS


async def refresh_cloud_presets(*, force: bool = False) -> dict[str, Any]:
    await ensure_cloud_presets_seeded()
    labels = default_label_map()
    async with AsyncSessionLocal() as session:
        row = await session.get(OrgLlmSettings, ORG_SINGLETON_ID)
        if row is None:
            return {"ok": False, "error": "org settings missing"}

        if not force and not _is_stale(row.cloud_presets_refreshed_at):
            return {
                "ok": True,
                "skipped": True,
                "reason": "not stale",
                "refreshed_at": row.cloud_presets_refreshed_at.isoformat()
                if row.cloud_presets_refreshed_at
                else None,
            }

        current = _parse_presets(row.cloud_presets_json)
        updated = dict(current)
        refreshed_providers: list[str] = []
        errors: dict[str, str] = {}

        for provider in _PROVIDER_ORDER:
            api_key = _refresh_key_for_provider(row, provider)
            if not api_key:
                continue
            try:
                fetched = await _fetch_provider_ids(provider, api_key)
                if fetched:
                    updated[provider] = _merge_provider_presets(
                        provider, fetched, current.get(provider, []), labels
                    )
                    refreshed_providers.append(provider)
            except Exception as exc:
                logger.warning("Cloud preset refresh failed for %s: %s", provider, exc)
                errors[provider] = str(exc)

        if refreshed_providers:
            row.cloud_presets_json = _serialize_presets(updated)
            row.cloud_presets_refreshed_at = datetime.now(timezone.utc)
            await session.commit()
            return {
                "ok": True,
                "refreshed_providers": refreshed_providers,
                "errors": errors,
                "refreshed_at": row.cloud_presets_refreshed_at.isoformat(),
            }

        if force and errors:
            return {"ok": False, "errors": errors}

        if not refreshed_providers and _is_stale(row.cloud_presets_refreshed_at):
            row.cloud_presets_refreshed_at = datetime.now(timezone.utc)
            await session.commit()

        return {
            "ok": True,
            "skipped": not refreshed_providers,
            "reason": "no refresh keys configured" if not refreshed_providers else None,
            "errors": errors,
            "refreshed_at": row.cloud_presets_refreshed_at.isoformat()
            if row.cloud_presets_refreshed_at
            else None,
        }


async def refresh_cloud_presets_if_stale() -> None:
    try:
        result = await refresh_cloud_presets(force=False)
        if result.get("refreshed_providers"):
            logger.info(
                "Cloud model presets refreshed: %s",
                result.get("refreshed_providers"),
            )
    except Exception as exc:
        logger.warning("Background cloud preset refresh failed: %s", exc)


def schedule_cloud_preset_refresh() -> None:
    asyncio.create_task(refresh_cloud_presets_if_stale())
