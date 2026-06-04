import json
import logging
from dataclasses import dataclass
from typing import Literal

import httpx
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.org_llm_settings import OrgLlmSettings

logger = logging.getLogger(__name__)

LocalBackend = Literal["ollama", "openai_compatible"]
CloudProvider = Literal["openai", "anthropic", "google", "custom"]

DEFAULT_CLOUD_PROVIDERS: list[str] = ["openai", "anthropic", "google", "custom"]

ORG_SINGLETON_ID = 1


@dataclass
class OrgLlmConfig:
    local_backend: LocalBackend
    local_base_url: str
    local_api_key: str | None
    model_default: str
    model_code: str
    model_quality: str
    allowed_models: list[str]
    allow_user_cloud: bool
    allowed_cloud_providers: list[str]
    org_display_name: str

    def tier_models(self) -> dict[str, str]:
        return {
            "default": self.model_default,
            "code": self.model_code,
            "quality": self.model_quality,
        }

    def allowed_model_set(self) -> frozenset[str]:
        return frozenset(self.allowed_models)


def _parse_json_list(raw: str) -> list[str]:
    try:
        data = json.loads(raw or "[]")
        if isinstance(data, list):
            return [str(x).strip() for x in data if str(x).strip()]
    except json.JSONDecodeError:
        pass
    return []


def _serialize_json_list(items: list[str]) -> str:
    return json.dumps(sorted({str(x).strip() for x in items if str(x).strip()}))


def sort_cloud_providers(providers: list[str]) -> list[str]:
    order = {p: i for i, p in enumerate(DEFAULT_CLOUD_PROVIDERS)}
    unique: list[str] = []
    seen: set[str] = set()
    for provider in providers:
        pid = str(provider).strip()
        if pid and pid not in seen:
            unique.append(pid)
            seen.add(pid)
    return sorted(unique, key=lambda p: order.get(p, len(DEFAULT_CLOUD_PROVIDERS)))


def _serialize_cloud_providers(items: list[str]) -> str:
    return json.dumps(sort_cloud_providers(items))


def _bootstrap_from_env() -> OrgLlmConfig:
    allowed = [
        m.strip()
        for m in settings.OLLAMA_ALLOWED_MODEL_OVERRIDES.split(",")
        if m.strip()
    ]
    if not allowed:
        allowed = [
            settings.OLLAMA_MODEL_DEFAULT,
            settings.OLLAMA_MODEL_CODE,
            settings.OLLAMA_MODEL_QUALITY,
        ]
    return OrgLlmConfig(
        local_backend="ollama",
        local_base_url=settings.OLLAMA_BASE_URL.rstrip("/"),
        local_api_key=None,
        model_default=settings.OLLAMA_MODEL_DEFAULT,
        model_code=settings.OLLAMA_MODEL_CODE,
        model_quality=settings.OLLAMA_MODEL_QUALITY,
        allowed_models=allowed,
        allow_user_cloud=settings.ALLOW_USER_CLOUD,
        allowed_cloud_providers=list(DEFAULT_CLOUD_PROVIDERS),
        org_display_name=settings.ORG_DISPLAY_NAME,
    )


def _row_to_config(row: OrgLlmSettings) -> OrgLlmConfig:
    return OrgLlmConfig(
        local_backend=row.local_backend,  # type: ignore[arg-type]
        local_base_url=row.local_base_url.rstrip("/"),
        local_api_key=row.local_api_key,
        model_default=row.model_default,
        model_code=row.model_code,
        model_quality=row.model_quality,
        allowed_models=_parse_json_list(row.allowed_models),
        allow_user_cloud=row.allow_user_cloud,
        allowed_cloud_providers=sort_cloud_providers(
            _parse_json_list(row.allowed_cloud_providers) or list(DEFAULT_CLOUD_PROVIDERS)
        ),
        org_display_name=row.org_display_name or "",
    )


async def get_org_llm_settings() -> OrgLlmConfig:
    async with AsyncSessionLocal() as session:
        row = await session.get(OrgLlmSettings, ORG_SINGLETON_ID)
        if row is None:
            return _bootstrap_from_env()
        return _row_to_config(row)


async def seed_org_llm_settings() -> None:
    async with AsyncSessionLocal() as session:
        existing = await session.get(OrgLlmSettings, ORG_SINGLETON_ID)
        if existing is not None:
            return
        boot = _bootstrap_from_env()
        session.add(
            OrgLlmSettings(
                id=ORG_SINGLETON_ID,
                local_backend=boot.local_backend,
                local_base_url=boot.local_base_url,
                local_api_key=boot.local_api_key,
                model_default=boot.model_default,
                model_code=boot.model_code,
                model_quality=boot.model_quality,
                allowed_models=_serialize_json_list(boot.allowed_models),
                allow_user_cloud=boot.allow_user_cloud,
                allowed_cloud_providers=_serialize_cloud_providers(boot.allowed_cloud_providers),
                org_display_name=boot.org_display_name,
            )
        )
        await session.commit()


async def update_org_llm_settings(**fields) -> OrgLlmConfig:
    await seed_org_llm_settings()
    async with AsyncSessionLocal() as session:
        row = await session.get(OrgLlmSettings, ORG_SINGLETON_ID)
        if row is None:
            raise RuntimeError("org LLM settings row missing after seed")

        if "local_backend" in fields and fields["local_backend"] is not None:
            row.local_backend = fields["local_backend"]
        if "local_base_url" in fields and fields["local_base_url"] is not None:
            row.local_base_url = fields["local_base_url"].rstrip("/")
        if "local_api_key" in fields:
            if fields["local_api_key"]:
                row.local_api_key = fields["local_api_key"]
            elif fields["local_api_key"] is None:
                row.local_api_key = None
        if "model_default" in fields and fields["model_default"] is not None:
            row.model_default = fields["model_default"]
        if "model_code" in fields and fields["model_code"] is not None:
            row.model_code = fields["model_code"]
        if "model_quality" in fields and fields["model_quality"] is not None:
            row.model_quality = fields["model_quality"]
        if "allowed_models" in fields and fields["allowed_models"] is not None:
            row.allowed_models = _serialize_json_list(fields["allowed_models"])
        if "allow_user_cloud" in fields and fields["allow_user_cloud"] is not None:
            row.allow_user_cloud = fields["allow_user_cloud"]
        if "allowed_cloud_providers" in fields and fields["allowed_cloud_providers"] is not None:
            row.allowed_cloud_providers = _serialize_cloud_providers(
                fields["allowed_cloud_providers"]
            )
        if "org_display_name" in fields and fields["org_display_name"] is not None:
            row.org_display_name = fields["org_display_name"]
        if "cloud_refresh_openai_key" in fields:
            if fields["cloud_refresh_openai_key"]:
                row.cloud_refresh_openai_key = fields["cloud_refresh_openai_key"]
            elif fields["cloud_refresh_openai_key"] is None:
                row.cloud_refresh_openai_key = None
        if "cloud_refresh_anthropic_key" in fields:
            if fields["cloud_refresh_anthropic_key"]:
                row.cloud_refresh_anthropic_key = fields["cloud_refresh_anthropic_key"]
            elif fields["cloud_refresh_anthropic_key"] is None:
                row.cloud_refresh_anthropic_key = None
        if "cloud_refresh_google_key" in fields:
            if fields["cloud_refresh_google_key"]:
                row.cloud_refresh_google_key = fields["cloud_refresh_google_key"]
            elif fields["cloud_refresh_google_key"] is None:
                row.cloud_refresh_google_key = None

        await session.commit()
        await session.refresh(row)
        return _row_to_config(row)


async def get_admin_llm_settings_dict(*, include_local_api_key: bool = False) -> dict:
    await seed_org_llm_settings()
    async with AsyncSessionLocal() as session:
        row = await session.get(OrgLlmSettings, ORG_SINGLETON_ID)
        if row is None:
            boot = _bootstrap_from_env()
            base = config_to_admin_dict(boot, include_local_api_key=include_local_api_key)
            base.update(
                {
                    "cloud_refresh_openai_key_set": False,
                    "cloud_refresh_anthropic_key_set": False,
                    "cloud_refresh_google_key_set": False,
                    "cloud_presets_refreshed_at": None,
                }
            )
            return base
        base = config_to_admin_dict(
            _row_to_config(row), include_local_api_key=include_local_api_key
        )
        base.update(
            {
                "cloud_refresh_openai_key_set": bool(row.cloud_refresh_openai_key),
                "cloud_refresh_anthropic_key_set": bool(row.cloud_refresh_anthropic_key),
                "cloud_refresh_google_key_set": bool(row.cloud_refresh_google_key),
                "cloud_presets_refreshed_at": (
                    row.cloud_presets_refreshed_at.isoformat()
                    if row.cloud_presets_refreshed_at
                    else None
                ),
            }
        )
        return base


def config_to_admin_dict(config: OrgLlmConfig, *, include_local_api_key: bool) -> dict:
    return {
        "local_backend": config.local_backend,
        "local_base_url": config.local_base_url,
        "local_api_key_set": bool(config.local_api_key),
        "local_api_key": config.local_api_key if include_local_api_key else None,
        "model_default": config.model_default,
        "model_code": config.model_code,
        "model_quality": config.model_quality,
        "allowed_models": config.allowed_models,
        "allow_user_cloud": config.allow_user_cloud,
        "allowed_cloud_providers": config.allowed_cloud_providers,
        "org_display_name": config.org_display_name,
        "tier_models": config.tier_models(),
    }


async def fetch_remote_model_names(config: OrgLlmConfig) -> list[str]:
    timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)
    headers: dict[str, str] = {}
    if config.local_api_key:
        headers["Authorization"] = f"Bearer {config.local_api_key}"

    async with httpx.AsyncClient(timeout=timeout) as client:
        if config.local_backend == "ollama":
            url = f"{config.local_base_url}/api/tags"
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            models = data.get("models") or []
            return sorted(
                {
                    str(m.get("name", "")).strip()
                    for m in models
                    if str(m.get("name", "")).strip()
                }
            )

        base = config.local_base_url.rstrip("/")
        if not base.endswith("/v1"):
            if base.endswith("/"):
                base = base[:-1]
            if not base.endswith("/v1"):
                base = f"{base}/v1"
        url = f"{base}/models"
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        items = data.get("data") or data.get("models") or []
        names: set[str] = set()
        for item in items:
            if isinstance(item, dict):
                name = item.get("id") or item.get("name")
                if name:
                    names.add(str(name).strip())
            elif isinstance(item, str):
                names.add(item.strip())
        return sorted(n for n in names if n)


async def test_local_connection(config: OrgLlmConfig) -> dict:
    try:
        models = await fetch_remote_model_names(config)
        return {"ok": True, "model_count": len(models), "sample_models": models[:10]}
    except Exception as exc:
        logger.warning("Local LLM test failed: %s", exc)
        return {"ok": False, "error": str(exc)}


def provider_default_base_url(provider: CloudProvider) -> str:
    return {
        "openai": "https://api.openai.com/v1",
        "anthropic": "https://api.anthropic.com",
        "google": "https://generativelanguage.googleapis.com/v1beta",
        "custom": "",
    }[provider]
