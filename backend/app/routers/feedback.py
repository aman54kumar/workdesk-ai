from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.feedback import AppFeedbackRequest, FeedbackRequest
from app.services.app_feedback import submit_app_feedback
from app.services.client_ip import get_client_ip
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


@router.post("/app")
async def post_app_feedback(body: AppFeedbackRequest, request: Request):
    try:
        await submit_app_feedback(
            name=body.name,
            issue=body.issue,
            email_or_phone=body.email_or_phone,
            page_url=body.page_url,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save feedback",
        ) from exc
    return {"ok": True}
