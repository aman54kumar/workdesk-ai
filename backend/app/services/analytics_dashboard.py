"""Aggregate usage analytics for the admin dashboard."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.analytics import Feedback, UsageEvent
from app.task_definitions import TASK_DEFINITION_BY_TYPE


def _usage_filters(since: datetime | None, until: datetime | None):
    clauses = []
    if since is not None:
        clauses.append(UsageEvent.created_at >= since)
    if until is not None:
        clauses.append(UsageEvent.created_at <= until)
    return clauses


async def build_analytics_dashboard(
    since: datetime | None = None,
    until: datetime | None = None,
) -> dict:
    async with AsyncSessionLocal() as session:
        filters = _usage_filters(since, until)
        overview = await _overview(session, filters)
        tools = await _tools_breakdown(
            session, filters, since, until, overview["total_requests"]
        )
        llm = await _llm_breakdown(session, filters, overview["total_requests"])
        ips = await _ip_activity(session, filters, since, until, overview)
        trends = await _daily_trends(session, filters)
        peak_hours = await _peak_hours(session, filters)
        feedback = await _feedback_summary(session, since, until)
        unused_tools = await _unused_enabled_tools(session, filters)
        return {
            "overview": overview,
            "tools": tools,
            "llm": llm,
            "ips": ips,
            "trends": trends,
            "peak_hours": peak_hours,
            "feedback": feedback,
            "unused_tools": unused_tools,
        }


async def _overview(session: AsyncSession, filters: list) -> dict:
    base = select(UsageEvent).where(*filters) if filters else select(UsageEvent)
    sub = base.subquery()

    total = await session.scalar(select(func.count()).select_from(sub)) or 0
    cached = (
        await session.scalar(
            select(func.count()).select_from(sub).where(sub.c.cached.is_(True))
        )
        or 0
    )
    avg_latency = await session.scalar(
        select(func.avg(sub.c.latency_ms)).where(sub.c.cached.is_(False))
    )
    unique_ips = await session.scalar(
        select(func.count(func.distinct(sub.c.client_ip))).where(
            sub.c.client_ip.isnot(None)
        )
    ) or 0
    total_input_chars = (
        await session.scalar(select(func.sum(sub.c.input_chars)).select_from(sub)) or 0
    )

    status_counts = {}
    for status in ("success", "error", "timeout", "cancelled"):
        status_counts[status] = (
            await session.scalar(
                select(func.count()).select_from(sub).where(sub.c.status == status)
            )
            or 0
        )

    source_rows = (
        await session.execute(
            select(sub.c.client_source, func.count())
            .select_from(sub)
            .group_by(sub.c.client_source)
        )
    ).all()
    by_source: dict[str, int] = {}
    for src, cnt in source_rows:
        key = (src or "unknown").lower()
        by_source[key] = by_source.get(key, 0) + (cnt or 0)

    failures = (
        status_counts["error"]
        + status_counts["timeout"]
        + status_counts["cancelled"]
    )
    success_rate = (
        (status_counts["success"] / total) if total else 0.0
    )

    return {
        "total_requests": total,
        "unique_ips": unique_ips,
        "cache_hit_rate": (cached / total) if total else 0.0,
        "avg_latency_ms": int(avg_latency or 0),
        "total_input_chars": int(total_input_chars),
        "avg_requests_per_ip": round(total / unique_ips, 1) if unique_ips else 0.0,
        "success_count": status_counts["success"],
        "error_count": status_counts["error"],
        "timeout_count": status_counts["timeout"],
        "cancelled_count": status_counts["cancelled"],
        "success_rate": success_rate,
        "failure_count": failures,
        "requests_web": by_source.get("web", 0),
        "requests_outlook": by_source.get("outlook", 0),
        "requests_unknown_source": by_source.get("unknown", 0),
    }


async def _tools_breakdown(
    session: AsyncSession,
    filters: list,
    since: datetime | None,
    until: datetime | None,
    total_requests: int,
) -> list[dict]:
    q = (
        select(
            UsageEvent.task_type,
            func.count().label("usage_count"),
            func.count(func.distinct(UsageEvent.client_ip)).label("unique_ips"),
            func.sum(case((UsageEvent.cached.is_(True), 1), else_=0)).label("cache_hits"),
            func.avg(
                case((UsageEvent.cached.is_(False), UsageEvent.latency_ms), else_=None)
            ).label("avg_latency_ms"),
            func.sum(case((UsageEvent.status == "error", 1), else_=0)).label("errors"),
            func.sum(case((UsageEvent.status == "timeout", 1), else_=0)).label("timeouts"),
            func.sum(case((UsageEvent.status == "cancelled", 1), else_=0)).label(
                "cancelled"
            ),
            func.sum(
                case((UsageEvent.llm_source == "local", 1), else_=0)
            ).label("local_count"),
            func.sum(
                case((UsageEvent.llm_source == "cloud", 1), else_=0)
            ).label("cloud_count"),
        )
        .group_by(UsageEvent.task_type)
        .order_by(func.count().desc())
    )
    if filters:
        q = q.where(*filters)
    usage_rows = (await session.execute(q)).all()

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
        up = fb_map.get(task_type, {}).get("up", 0)
        down = fb_map.get(task_type, {}).get("down", 0)
        rated = up + down
        defn = TASK_DEFINITION_BY_TYPE.get(task_type, {})
        tools.append(
            {
                "task_type": task_type,
                "display_name": defn.get("display_name", task_type),
                "usage_count": usage,
                "unique_ips": row.unique_ips or 0,
                "share_pct": round(100.0 * usage / total_requests, 1)
                if total_requests
                else 0.0,
                "cache_hit_rate": (cache_hits / usage) if usage else 0.0,
                "avg_latency_ms": int(row.avg_latency_ms or 0),
                "errors": row.errors or 0,
                "timeouts": row.timeouts or 0,
                "cancelled": row.cancelled or 0,
                "local_count": row.local_count or 0,
                "cloud_count": row.cloud_count or 0,
                "thumbs_up": up,
                "thumbs_down": down,
                "satisfaction_rate": (up / rated) if rated else None,
            }
        )
    return tools


async def _llm_breakdown(
    session: AsyncSession, filters: list, total_requests: int
) -> dict:
    q_src = (
        select(UsageEvent.llm_source, func.count().label("cnt"))
        .group_by(UsageEvent.llm_source)
        .order_by(func.count().desc())
    )
    if filters:
        q_src = q_src.where(*filters)
    by_source = []
    for src, cnt in (await session.execute(q_src)).all():
        count = cnt or 0
        by_source.append(
            {
                "source": src or "local",
                "count": count,
                "pct": round(100.0 * count / total_requests, 1) if total_requests else 0.0,
            }
        )

    q_prov = (
        select(UsageEvent.llm_provider, func.count().label("cnt"))
        .where(UsageEvent.llm_source == "cloud")
        .group_by(UsageEvent.llm_provider)
        .order_by(func.count().desc())
    )
    if filters:
        q_prov = q_prov.where(*filters)
    by_provider = []
    for prov, cnt in (await session.execute(q_prov)).all():
        count = cnt or 0
        by_provider.append(
            {
                "provider": prov or "unknown",
                "count": count,
                "pct": round(100.0 * count / total_requests, 1) if total_requests else 0.0,
            }
        )

    q_model = (
        select(
            UsageEvent.model,
            UsageEvent.llm_source,
            func.count().label("cnt"),
        )
        .group_by(UsageEvent.model, UsageEvent.llm_source)
        .order_by(func.count().desc())
        .limit(15)
    )
    if filters:
        q_model = q_model.where(*filters)
    by_model = [
        {
            "model": model,
            "llm_source": src or "local",
            "count": cnt or 0,
        }
        for model, src, cnt in (await session.execute(q_model)).all()
    ]

    return {
        "by_source": by_source,
        "by_provider": by_provider,
        "by_model": by_model,
    }


async def _ip_activity(
    session: AsyncSession,
    filters: list,
    since: datetime | None,
    until: datetime | None,
    overview: dict,
) -> dict:
    unique_in_period = overview["unique_ips"]

    first_seen_sq = (
        select(
            UsageEvent.client_ip.label("client_ip"),
            func.min(UsageEvent.created_at).label("first_at"),
        )
        .where(UsageEvent.client_ip.isnot(None))
        .group_by(UsageEvent.client_ip)
        .subquery()
    )

    new_ips = 0
    returning_ips = 0
    if since is not None and until is not None:
        new_ips = (
            await session.scalar(
                select(func.count())
                .select_from(first_seen_sq)
                .where(
                    first_seen_sq.c.first_at >= since,
                    first_seen_sq.c.first_at <= until,
                )
            )
            or 0
        )
        returning_ips = max(0, unique_in_period - new_ips)

    q_top = (
        select(
            UsageEvent.client_ip,
            func.count().label("request_count"),
            func.max(UsageEvent.created_at).label("last_seen"),
            func.count(func.distinct(UsageEvent.task_type)).label("tools_used"),
        )
        .where(UsageEvent.client_ip.isnot(None))
        .group_by(UsageEvent.client_ip)
        .order_by(func.count().desc())
        .limit(10)
    )
    if filters:
        q_top = q_top.where(*filters)
    top_ips = []
    for row in (await session.execute(q_top)).all():
        top_ips.append(
            {
                "ip_address": row.client_ip or "",
                "request_count": row.request_count or 0,
                "tools_used": row.tools_used or 0,
                "last_seen": row.last_seen.isoformat() if row.last_seen else "",
            }
        )

    return {
        "unique_ips": unique_in_period,
        "new_ips": new_ips,
        "returning_ips": returning_ips,
        "tracking_note": (
            "Unique users are counted by client IP address (from X-Forwarded-For when "
            "behind a reverse proxy, otherwise the direct connection IP). Colleagues "
            "on the same office network or VPN may share one IP."
        ),
        "top_ips": top_ips,
    }


async def _daily_trends(session: AsyncSession, filters: list) -> list[dict]:
    day = func.strftime("%Y-%m-%d", UsageEvent.created_at)
    q = (
        select(
            day.label("day"),
            func.count().label("requests"),
            func.count(func.distinct(UsageEvent.client_ip)).label("unique_ips"),
        )
        .group_by(day)
        .order_by(day)
    )
    if filters:
        q = q.where(*filters)
    return [
        {
            "date": row.day,
            "requests": row.requests or 0,
            "unique_ips": row.unique_ips or 0,
        }
        for row in (await session.execute(q)).all()
    ]


async def _peak_hours(session: AsyncSession, filters: list) -> list[dict]:
    hour = func.strftime("%H", UsageEvent.created_at)
    q = (
        select(hour.label("hour"), func.count().label("requests"))
        .group_by(hour)
        .order_by(hour)
    )
    if filters:
        q = q.where(*filters)
    return [
        {"hour": int(row.hour), "requests": row.requests or 0}
        for row in (await session.execute(q)).all()
    ]


async def _feedback_summary(
    session: AsyncSession,
    since: datetime | None,
    until: datetime | None,
) -> dict:
    q = select(Feedback.rating, func.count().label("cnt")).group_by(Feedback.rating)
    if since:
        q = q.where(Feedback.created_at >= since)
    if until:
        q = q.where(Feedback.created_at <= until)
    counts = {rating: cnt for rating, cnt in (await session.execute(q)).all()}
    up = counts.get("up", 0)
    down = counts.get("down", 0)
    rated = up + down

    q_comments = select(func.count()).select_from(Feedback).where(
        Feedback.comment.isnot(None),
        Feedback.comment != "",
    )
    if since:
        q_comments = q_comments.where(Feedback.created_at >= since)
    if until:
        q_comments = q_comments.where(Feedback.created_at <= until)
    comment_count = await session.scalar(q_comments) or 0

    return {
        "thumbs_up": up,
        "thumbs_down": down,
        "satisfaction_rate": (up / rated) if rated else None,
        "comment_count": comment_count,
    }


async def _unused_enabled_tools(session: AsyncSession, filters: list) -> list[dict]:
    from app.models.task_settings import TaskSetting

    active_rows = (
        await session.execute(
            select(TaskSetting.task_type).where(TaskSetting.is_active.is_(True))
        )
    ).all()
    active_types = {r[0] for r in active_rows}

    q_used = select(UsageEvent.task_type).distinct()
    if filters:
        q_used = q_used.where(*filters)
    used_types = {r[0] for r in (await session.execute(q_used)).all()}

    unused = []
    for task_type in sorted(active_types - used_types):
        defn = TASK_DEFINITION_BY_TYPE.get(task_type, {})
        unused.append(
            {
                "task_type": task_type,
                "display_name": defn.get("display_name", task_type),
            }
        )
    return unused
