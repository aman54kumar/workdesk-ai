from pydantic import BaseModel, field_validator

from app.config import settings


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TaskSettingResponse(BaseModel):
    task_type: str
    display_name: str
    description: str
    section: str
    path: str
    icon: str
    is_active: bool
    model_override: str | None
    default_model: str


class TaskSettingUpdate(BaseModel):
    is_active: bool | None = None
    model_override: str | None = None

    @field_validator("model_override")
    @classmethod
    def validate_model_override(cls, v: str | None) -> str | None:
        if v is not None and v != "" and v not in settings.allowed_model_override_set:
            raise ValueError(
                f"Invalid model '{v}'. "
                f"Must be one of: {sorted(settings.allowed_model_override_set)}"
            )
        return v if v else None


class PublicTaskResponse(BaseModel):
    task_type: str
    display_name: str
    description: str
    section: str
    path: str
    icon: str
    input_count: int


class CompanyProfileSectionResponse(BaseModel):
    id: int
    key: str
    label: str
    content: str
    enabled: bool
    sort_order: int

    class Config:
        from_attributes = True


class CompanyProfileSectionInput(BaseModel):
    id: int | None = None
    key: str | None = None
    label: str | None = None
    content: str | None = None
    enabled: bool | None = None
    sort_order: int | None = None


class CompanyProfileBulkSave(BaseModel):
    sections: list[CompanyProfileSectionInput]


class PromptTemplateResponse(BaseModel):
    task_type: str
    system: str
    user_template: str
    use_company_profile: bool
    is_overridden: bool
    updated_at: str | None


class PromptTemplateSave(BaseModel):
    system: str
    user_template: str
    use_company_profile: bool = False


class AdminDateBoundsResponse(BaseModel):
    min_date: str
    max_date: str


class AnalyticsSummaryResponse(BaseModel):
    total_requests: int
    cache_hit_rate: float
    avg_latency_ms: int


class AnalyticsToolRow(BaseModel):
    task_type: str
    usage_count: int
    cache_hit_rate: float
    avg_latency_ms: int
    errors: int
    timeouts: int
    cancelled: int
    thumbs_up: int
    thumbs_down: int


class FeedbackCommentRow(BaseModel):
    id: int
    task_type: str
    model: str
    rating: str
    comment: str
    created_at: str


class AppFeedbackRow(BaseModel):
    id: int
    name: str
    email_or_phone: str | None
    issue: str
    page_url: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: str
