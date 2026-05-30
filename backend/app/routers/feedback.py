from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.feedback import AppFeedbackRequest, FeedbackRequest
from app.services.app_feedback import submit_app_feedback
from app.services.usage import submit_feedback

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("")
async def post_feedback(body: FeedbackRequest):
    try:
        await submit_feedback(
            task_type=body.task_type,
            model=body.model,
            rating=body.rating,
            comment=body.comment,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save feedback",
        ) from exc
    return {"ok": True}


def _client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None
    return request.client.host if request.client else None


@router.post("/app")
async def post_app_feedback(body: AppFeedbackRequest, request: Request):
    try:
        await submit_app_feedback(
            name=body.name,
            issue=body.issue,
            email_or_phone=body.email_or_phone,
            page_url=body.page_url,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save feedback",
        ) from exc
    return {"ok": True}
