from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.company_profile import CompanyProfileSection


async def list_sections() -> list[CompanyProfileSection]:
    async with AsyncSessionLocal() as session:
        return list(
            await session.scalars(
                select(CompanyProfileSection).order_by(
                    CompanyProfileSection.sort_order,
                    CompanyProfileSection.id,
                )
            )
        )


async def bulk_save_sections(updates: list[dict]) -> list[CompanyProfileSection]:
    async with AsyncSessionLocal() as session:
        for item in updates:
            if "id" in item and item["id"]:
                row = await session.get(CompanyProfileSection, item["id"])
                if not row:
                    continue
            elif item.get("key"):
                row = await session.scalar(
                    select(CompanyProfileSection).where(
                        CompanyProfileSection.key == item["key"]
                    )
                )
                if not row:
                    row = CompanyProfileSection(
                        key=item["key"],
                        label=item.get("label", item["key"]),
                        content="",
                        enabled=True,
                        sort_order=item.get("sort_order", 0),
                    )
                    session.add(row)
            else:
                continue

            if "label" in item:
                row.label = item["label"]
            if "content" in item:
                row.content = item["content"]
            if "enabled" in item:
                row.enabled = bool(item["enabled"])
            if "sort_order" in item:
                row.sort_order = int(item["sort_order"])
            if "key" in item and not row.key:
                row.key = item["key"]

        await session.commit()
        result = list(
            await session.scalars(
                select(CompanyProfileSection).order_by(
                    CompanyProfileSection.sort_order,
                    CompanyProfileSection.id,
                )
            )
        )
    return result


async def delete_section(section_id: int) -> bool:
    async with AsyncSessionLocal() as session:
        row = await session.get(CompanyProfileSection, section_id)
        if not row:
            return False
        await session.delete(row)
        await session.commit()
    return True
