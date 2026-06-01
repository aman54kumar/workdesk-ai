"""Date bounds for admin analytics / feedback filters."""

from datetime import date, datetime

from sqlalchemy import func, select

from app.database import AsyncSessionLocal
from app.models.analytics import Feedback, UsageEvent
from app.models.app_feedback import AppFeedback


async def get_record_date_bounds() -> dict[str, str]:
    """Earliest stored record date and today (max selectable date)."""
    today = date.today()
    async with AsyncSessionLocal() as session:
        earliest: datetime | None = None
        for model in (UsageEvent, Feedback, AppFeedback):
            row_min = await session.scalar(select(func.min(model.created_at)))
            if row_min is not None and (earliest is None or row_min < earliest):
                earliest = row_min

    if earliest is None:
        min_day = today
    else:
        # Use calendar date in local/server timezone (naive datetimes from DB).
        min_day = earliest.date() if isinstance(earliest, datetime) else today

    if min_day > today:
        min_day = today

    return {
        "min_date": min_day.isoformat(),
        "max_date": today.isoformat(),
    }
