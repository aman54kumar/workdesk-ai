from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OrgLlmSettings(Base):
    __tablename__ = "org_llm_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    local_backend: Mapped[str] = mapped_column(String(30), nullable=False, default="ollama")
    local_base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    local_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_default: Mapped[str] = mapped_column(String(120), nullable=False)
    model_code: Mapped[str] = mapped_column(String(120), nullable=False)
    model_quality: Mapped[str] = mapped_column(String(120), nullable=False)
    allowed_models: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    allow_user_cloud: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allowed_cloud_providers: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    org_display_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    cloud_presets_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    cloud_presets_refreshed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cloud_refresh_openai_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    cloud_refresh_anthropic_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    cloud_refresh_google_key: Mapped[str | None] = mapped_column(Text, nullable=True)
