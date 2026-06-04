from pydantic import BaseModel


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


class AnalyticsOverview(BaseModel):
    total_requests: int
    unique_ips: int
    cache_hit_rate: float
    avg_latency_ms: int
    total_input_chars: int
    avg_requests_per_ip: float
    success_count: int
    error_count: int
    timeout_count: int
    cancelled_count: int
    success_rate: float
    failure_count: int
    requests_web: int
    requests_outlook: int
    requests_unknown_source: int


class AnalyticsToolDetail(BaseModel):
    task_type: str
    display_name: str
    usage_count: int
    unique_ips: int
    share_pct: float
    cache_hit_rate: float
    avg_latency_ms: int
    errors: int
    timeouts: int
    cancelled: int
    local_count: int
    cloud_count: int
    thumbs_up: int
    thumbs_down: int
    satisfaction_rate: float | None = None


class AnalyticsCountShare(BaseModel):
    source: str | None = None
    provider: str | None = None
    count: int
    pct: float


class AnalyticsModelRow(BaseModel):
    model: str
    llm_source: str
    count: int


class AnalyticsLlmBreakdown(BaseModel):
    by_source: list[AnalyticsCountShare]
    by_provider: list[AnalyticsCountShare]
    by_model: list[AnalyticsModelRow]


class AnalyticsTopIp(BaseModel):
    ip_address: str
    request_count: int
    tools_used: int
    last_seen: str


class AnalyticsIpActivity(BaseModel):
    unique_ips: int
    new_ips: int
    returning_ips: int
    tracking_note: str
    top_ips: list[AnalyticsTopIp]


class AnalyticsDailyTrend(BaseModel):
    date: str
    requests: int
    unique_ips: int


class AnalyticsHourBucket(BaseModel):
    hour: int
    requests: int


class AnalyticsFeedbackSummary(BaseModel):
    thumbs_up: int
    thumbs_down: int
    satisfaction_rate: float | None = None
    comment_count: int


class AnalyticsUnusedTool(BaseModel):
    task_type: str
    display_name: str


class AnalyticsDashboardResponse(BaseModel):
    overview: AnalyticsOverview
    tools: list[AnalyticsToolDetail]
    llm: AnalyticsLlmBreakdown
    ips: AnalyticsIpActivity
    trends: list[AnalyticsDailyTrend]
    peak_hours: list[AnalyticsHourBucket]
    feedback: AnalyticsFeedbackSummary
    unused_tools: list[AnalyticsUnusedTool]


class AppFeedbackRow(BaseModel):
    id: int
    name: str
    email_or_phone: str | None
    issue: str
    page_url: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: str


class OrgLlmSettingsResponse(BaseModel):
    local_backend: str
    local_base_url: str
    local_api_key_set: bool
    model_default: str
    model_code: str
    model_quality: str
    allowed_models: list[str]
    allow_user_cloud: bool
    allowed_cloud_providers: list[str]
    org_display_name: str
    tier_models: dict[str, str]
    cloud_refresh_openai_key_set: bool = False
    cloud_refresh_anthropic_key_set: bool = False
    cloud_refresh_google_key_set: bool = False
    cloud_presets_refreshed_at: str | None = None


class OrgLlmSettingsUpdate(BaseModel):
    local_backend: str | None = None
    local_base_url: str | None = None
    local_api_key: str | None = None
    clear_local_api_key: bool = False
    model_default: str | None = None
    model_code: str | None = None
    model_quality: str | None = None
    allowed_models: list[str] | None = None
    allow_user_cloud: bool | None = None
    allowed_cloud_providers: list[str] | None = None
    org_display_name: str | None = None
    cloud_refresh_openai_key: str | None = None
    cloud_refresh_anthropic_key: str | None = None
    cloud_refresh_google_key: str | None = None
    clear_cloud_refresh_openai_key: bool = False
    clear_cloud_refresh_anthropic_key: bool = False
    clear_cloud_refresh_google_key: bool = False


class RefreshCloudPresetsResponse(BaseModel):
    ok: bool
    skipped: bool | None = None
    reason: str | None = None
    refreshed_providers: list[str] | None = None
    errors: dict[str, str] | None = None
    refreshed_at: str | None = None


class RefreshModelsResponse(BaseModel):
    models: list[str]


class TestConnectionResponse(BaseModel):
    ok: bool
    model_count: int | None = None
    sample_models: list[str] | None = None
    error: str | None = None
