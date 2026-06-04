from dataclasses import dataclass
from typing import Literal

from fastapi import HTTPException, status

from app.services.org_llm_settings import (
    CloudProvider,
    OrgLlmConfig,
    get_org_llm_settings,
    provider_default_base_url,
)
from app.services import task_settings as task_settings_service
from app.prompts.templates import get_task_config

LlmSource = Literal["local", "cloud"]


@dataclass
class ResolvedLlm:
    source: LlmSource
    model: str
    backend: str
    base_url: str
    api_key: str | None
    provider: str | None


async def resolve_generation_llm(
    task_type: str,
    llm_selection: dict | None,
) -> ResolvedLlm:
    org = await get_org_llm_settings()

    if llm_selection is None or llm_selection.get("source", "local") == "local":
        model = await _resolve_local_model(task_type, llm_selection, org)
        backend = org.local_backend
        if backend == "openai_compatible":
            return ResolvedLlm(
                source="local",
                model=model,
                backend="openai_compat",
                base_url=org.local_base_url,
                api_key=org.local_api_key,
                provider=None,
            )
        return ResolvedLlm(
            source="local",
            model=model,
            backend="ollama",
            base_url=org.local_base_url,
            api_key=None,
            provider=None,
        )

    if llm_selection.get("source") != "cloud":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid llm.source; must be 'local' or 'cloud'.",
        )

    if not org.allow_user_cloud:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cloud LLM is disabled by your organization administrator.",
        )

    provider = llm_selection.get("provider")
    if provider not in org.allowed_cloud_providers:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cloud provider '{provider}' is not allowed.",
        )

    model = (llm_selection.get("model") or "").strip()
    api_key = (llm_selection.get("api_key") or "").strip()
    if not model or not api_key:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cloud generation requires model and api_key.",
        )

    base_url = (llm_selection.get("base_url") or "").strip()
    backend, resolved_base = _cloud_backend_and_url(provider, base_url)

    return ResolvedLlm(
        source="cloud",
        model=model,
        backend=backend,
        base_url=resolved_base,
        api_key=api_key,
        provider=provider,
    )


async def _resolve_local_model(
    task_type: str,
    llm_selection: dict | None,
    org: OrgLlmConfig,
) -> str:
    if llm_selection and (llm_selection.get("model") or "").strip():
        model = llm_selection["model"].strip()
        if model not in org.allowed_model_set():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Model '{model}' is not in the organization's allowed model list.",
            )
        return model

    override = await task_settings_service.resolve_model(task_type)
    if override:
        return override
    config = await get_task_config(task_type)
    return config["model"]


def _cloud_backend_and_url(provider: CloudProvider, base_url: str) -> tuple[str, str]:
    if provider == "openai":
        return "openai_compat", base_url or provider_default_base_url("openai")
    if provider == "custom":
        if not base_url:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Custom cloud provider requires base_url.",
            )
        return "openai_compat", base_url
    if provider == "anthropic":
        return "anthropic", provider_default_base_url("anthropic")
    if provider == "google":
        return "google", provider_default_base_url("google")
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Unknown cloud provider '{provider}'.",
    )
