from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.analytics import Feedback, UsageEvent


async def record_usage(
    *,
    task_type: str,
    model: str,
    cached: bool,
    latency_ms: int,
    input_chars: int,
    status: str,
) -> None:
    async with AsyncSessionLocal() as session:
        session.add(
            UsageEvent(
                task_type=task_type,
                model=model,
                cached=cached,
                latency_ms=latency_ms,
                input_chars=input_chars,
                status=status,
            )
        )
        await session.commit()


async def submit_feedback(
    *,
    task_type: str,
    model: str,
    rating: str,
    comment: str | None,
) -> None:
    async with AsyncSessionLocal() as session:
        session.add(
            Feedback(
                task_type=task_type,
                model=model,
                rating=rating,
                comment=comment.strip() if comment else None,
            )
        )
        await session.commit()


def _date_filter(q, since: datetime | None, until: datetime | None):
    if since is not None:
        q = q.where(UsageEvent.created_at >= since)
    if until is not None:
        q = q.where(UsageEvent.created_at <= until)
    return q


async def analytics_summary(
    session: AsyncSession,
    since: datetime | None = None,
    until: datetime | None = None,
) -> dict:
    base = select(UsageEvent)
    base = _date_filter(base, since, until)

    total = await session.scalar(
        select(func.count()).select_from(base.subquery())
    )
    cached_hits = await session.scalar(
        select(func.count())
        .select_from(UsageEvent)
        .where(UsageEvent.cached.is_(True))
        .where(*(base.whereclause,) if base.whereclause is not None else ())
    )
    # Simpler approach with explicit filters
    q = select(UsageEvent)
    if since:
        q = q.where(UsageEvent.created_at >= since)
    if until:
        q = q.where(UsageEvent.created_at <= until)

    sub = q.subquery()
    total = await session.scalar(select(func.count()).select_from(sub)) or 0
    cached = await session.scalar(
        select(func.count()).select_from(sub).where(sub.c.cached.is_(True))
    ) or 0
    avg_latency = await session.scalar(
        select(func.avg(sub.c.latency_ms)).where(sub.c.cached.is_(False))
    )
    return {
        "total_requests": total,
        "cache_hit_rate": (cached / total) if total else 0.0,
        "avg_latency_ms": int(avg_latency or 0),
    }


async def analytics_by_tool(
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[dict]:
    async with AsyncSessionLocal() as session:
        q_usage = select(
            UsageEvent.task_type,
            func.count().label("usage_count"),
            func.sum(case((UsageEvent.cached.is_(True), 1), else_=0)).label("cache_hits"),
            func.avg(
                case((UsageEvent.cached.is_(False), UsageEvent.latency_ms), else_=None)
            ).label("avg_latency_ms"),
            func.sum(case((UsageEvent.status == "error", 1), else_=0)).label("errors"),
            func.sum(case((UsageEvent.status == "timeout", 1), else_=0)).label("timeouts"),
            func.sum(case((UsageEvent.status == "cancelled", 1), else_=0)).label(
                "cancelled"
            ),
        ).group_by(UsageEvent.task_type)
        if since:
            q_usage = q_usage.where(UsageEvent.created_at >= since)
        if until:
            q_usage = q_usage.where(UsageEvent.created_at <= until)

        usage_rows = (await session.execute(q_usage)).all()

        q_fb = select(
            Feedback.task_type,
            Feedback.rating,
            func.count().label("cnt"),
        ).group_by(Feedback.task_type, Feedback.rating)
        if since:
            q_fb = q_fb.where(Feedback.created_at >= since)
        if until:
            q_fb = q_fb.where(Feedback.created_at <= until)
        fb_rows = (await session.execute(q_fb)).all()

        fb_map: dict[str, dict[str, int]] = {}
        for task_type, rating, cnt in fb_rows:
            fb_map.setdefault(task_type, {"up": 0, "down": 0})
            fb_map[task_type][rating] = cnt

        tools = []
        for row in usage_rows:
            task_type = row.task_type
            usage = row.usage_count or 0
            cache_hits = row.cache_hits or 0
            tools.append(
                {
                    "task_type": task_type,
                    "usage_count": usage,
                    "cache_hit_rate": (cache_hits / usage) if usage else 0.0,
                    "avg_latency_ms": int(row.avg_latency_ms or 0),
                    "errors": row.errors or 0,
                    "timeouts": row.timeouts or 0,
                    "cancelled": row.cancelled or 0,
                    "thumbs_up": fb_map.get(task_type, {}).get("up", 0),
                    "thumbs_down": fb_map.get(task_type, {}).get("down", 0),
                }
            )
        return tools


async def recent_feedback_comments(
    limit: int = 20,
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[dict]:
    async with AsyncSessionLocal() as session:
        q = (
            select(Feedback)
            .where(Feedback.comment.isnot(None))
            .where(Feedback.comment != "")
            .order_by(Feedback.created_at.desc())
            .limit(limit)
        )
        if since:
            q = q.where(Feedback.created_at >= since)
        if until:
            q = q.where(Feedback.created_at <= until)
        rows = (await session.scalars(q)).all()
        return [
            {
                "id": r.id,
                "task_type": r.task_type,
                "model": r.model,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
