from pydantic import BaseModel, field_validator

from app.prompts.templates import VALID_TASK_TYPES


class FeedbackRequest(BaseModel):
    task_type: str
    model: str
    rating: str
    comment: str | None = None

    @field_validator("task_type")
    @classmethod
    def validate_task(cls, v: str) -> str:
        if v not in VALID_TASK_TYPES:
            raise ValueError(f"Invalid task_type '{v}'")
        return v

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: str) -> str:
        if v not in ("up", "down"):
            raise ValueError("rating must be 'up' or 'down'")
        return v


class AppFeedbackRequest(BaseModel):
    name: str
    issue: str
    email_or_phone: str | None = None
    page_url: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("name is required")
        if len(value) > 120:
            raise ValueError("name must be 120 characters or fewer")
        return value

    @field_validator("issue")
    @classmethod
    def validate_issue(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("issue is required")
        if len(value) > 4000:
            raise ValueError("issue must be 4000 characters or fewer")
        return value

    @field_validator("email_or_phone", "page_url")
    @classmethod
    def clean_optional_text(cls, v: str | None) -> str | None:
        if v is None:
            return None
        value = v.strip()
        return value or None
