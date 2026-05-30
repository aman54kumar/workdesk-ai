from datetime import datetime

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.app_feedback import AppFeedback


async def submit_app_feedback(
    *,
    name: str,
    issue: str,
    email_or_phone: str | None,
    page_url: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> None:
    async with AsyncSessionLocal() as session:
        session.add(
            AppFeedback(
                name=name,
                issue=issue,
                email_or_phone=email_or_phone,
                page_url=page_url,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        )
        await session.commit()


async def list_app_feedback(
    *,
    limit: int = 100,
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[dict]:
    async with AsyncSessionLocal() as session:
        q = select(AppFeedback).order_by(AppFeedback.created_at.desc()).limit(limit)
        if since:
            q = q.where(AppFeedback.created_at >= since)
        if until:
            q = q.where(AppFeedback.created_at <= until)
        rows = (await session.scalars(q)).all()
        return [
            {
                "id": row.id,
                "name": row.name,
                "email_or_phone": row.email_or_phone,
                "issue": row.issue,
                "page_url": row.page_url,
                "ip_address": row.ip_address,
                "user_agent": row.user_agent,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]
