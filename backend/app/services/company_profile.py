from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.company_profile import CompanyProfileSection

DEFAULT_SECTIONS = [
    {
        "key": "certifications",
        "label": "Certifications",
        "content": "ISO 9001, CMMI Level 3 (update with your certifications).",
        "sort_order": 0,
    },
    {
        "key": "clients",
        "label": "Key clients",
        "content": "Government and enterprise clients across India (update as needed).",
        "sort_order": 1,
    },
    {
        "key": "deployments",
        "label": "HappServe deployments",
        "content": "HappServe product deployments and case studies (update as needed).",
        "sort_order": 2,
    },
    {
        "key": "turnover",
        "label": "Turnover & scale",
        "content": "Annual turnover and team size (update with current figures).",
        "sort_order": 3,
    },
    {
        "key": "differentiators",
        "label": "Key differentiators",
        "content": "Core strengths and differentiators for presales (update as needed).",
        "sort_order": 4,
    },
]


async def seed_company_profile() -> None:
    async with AsyncSessionLocal() as session:
        existing = await session.scalar(select(CompanyProfileSection.id).limit(1))
        if existing is not None:
            return
        for item in DEFAULT_SECTIONS:
            session.add(CompanyProfileSection(**item, enabled=True))
        await session.commit()


async def build_company_context() -> str:
    async with AsyncSessionLocal() as session:
        rows = (
            await session.scalars(
                select(CompanyProfileSection)
                .where(CompanyProfileSection.enabled.is_(True))
                .order_by(CompanyProfileSection.sort_order, CompanyProfileSection.id)
            )
        ).all()
    parts: list[str] = []
    for row in rows:
        text = (row.content or "").strip()
        if text:
            parts.append(f"## {row.label}\n{text}")
    return "\n\n".join(parts)


async def company_profile_status() -> dict:
    """Public read-only snapshot for tools that use the admin company profile."""
    async with AsyncSessionLocal() as session:
        rows = (
            await session.scalars(
                select(CompanyProfileSection)
                .where(CompanyProfileSection.enabled.is_(True))
                .order_by(CompanyProfileSection.sort_order, CompanyProfileSection.id)
            )
        ).all()
    sections: list[dict[str, str]] = []
    for row in rows:
        text = (row.content or "").strip()
        if text:
            sections.append({"label": row.label, "content": text})
    labels = [s["label"] for s in sections]
    return {"available": bool(labels), "section_labels": labels, "sections": sections}
