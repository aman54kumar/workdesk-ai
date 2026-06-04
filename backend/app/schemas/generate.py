import re
from typing import Literal

from pydantic import BaseModel, field_validator

from app.prompts.templates import VALID_TASK_TYPES

_SYSTEM_ID_RE = re.compile(r"^[a-zA-Z0-9-]{8,64}$")


class LlmSelection(BaseModel):
    source: Literal["local", "cloud"]
    model: str | None = None
    provider: Literal["openai", "anthropic", "google", "custom"] | None = None
    api_key: str | None = None
    base_url: str | None = None


class GenerateRequest(BaseModel):
    task_type: str
    variables: dict[str, str]
    skip_cache: bool = False
    llm: LlmSelection | None = None
    system_id: str | None = None
    client_source: Literal["web", "outlook"] | None = None

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, v: str) -> str:
        if v not in VALID_TASK_TYPES:
            raise ValueError(
                f"Invalid task_type '{v}'. "
                f"Must be one of: {sorted(VALID_TASK_TYPES)}"
            )
        return v

    @field_validator("system_id")
    @classmethod
    def validate_system_id(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        if not trimmed:
            return None
        if not _SYSTEM_ID_RE.match(trimmed):
            raise ValueError("Invalid system_id")
        return trimmed


class CancelJobRequest(BaseModel):
    job_id: str


class LlmOptionsLocal(BaseModel):
    enabled: bool
    models: list[str]
    backend: str


class CloudModelPreset(BaseModel):
    id: str
    label: str


class LlmOptionsCloud(BaseModel):
    enabled: bool
    providers: list[str]
    presets: dict[str, list[CloudModelPreset]] = {}


class LlmOptionsResponse(BaseModel):
    local: LlmOptionsLocal
    cloud: LlmOptionsCloud
    org_display_name: str


class CompanyProfileSectionPublic(BaseModel):
    label: str
    content: str


class CompanyProfileStatusResponse(BaseModel):
    available: bool
    section_labels: list[str]
    sections: list[CompanyProfileSectionPublic] = []
