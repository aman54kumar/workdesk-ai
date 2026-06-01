from pydantic import BaseModel, field_validator

from app.prompts.templates import VALID_TASK_TYPES


class GenerateRequest(BaseModel):
    task_type: str
    variables: dict[str, str]
    skip_cache: bool = False

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, v: str) -> str:
        if v not in VALID_TASK_TYPES:
            raise ValueError(
                f"Invalid task_type '{v}'. "
                f"Must be one of: {sorted(VALID_TASK_TYPES)}"
            )
        return v


class CancelJobRequest(BaseModel):
    job_id: str


class CompanyProfileSectionPublic(BaseModel):
    label: str
    content: str


class CompanyProfileStatusResponse(BaseModel):
    available: bool
    section_labels: list[str]
    sections: list[CompanyProfileSectionPublic] = []
