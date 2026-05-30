from datetime import datetime, timezone

from sqlalchemy import delete, select

from app.database import AsyncSessionLocal
from app.models.prompt_override import PromptTemplateOverride
from app.prompts.resolver import validate_template_placeholders
from app.prompts.templates import PROMPT_TEMPLATES


async def get_effective_template(task_type: str) -> dict:
    default = PROMPT_TEMPLATES[task_type]
    async with AsyncSessionLocal() as session:
        row = await session.get(PromptTemplateOverride, task_type)
    if row:
        return {
            "task_type": task_type,
            "system": row.system,
            "user_template": row.user_template,
            "use_company_profile": row.use_company_profile,
            "is_overridden": True,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
    return {
        "task_type": task_type,
        "system": default["system"],
        "user_template": default["user_template"],
        "use_company_profile": task_type == "eligibility_check",
        "is_overridden": False,
        "updated_at": None,
    }


async def list_all_templates() -> list[dict]:
    result = []
    for task_type in sorted(PROMPT_TEMPLATES.keys()):
        item = await get_effective_template(task_type)
        result.append(item)
    return result


async def save_override(
    task_type: str,
    system: str,
    user_template: str,
    use_company_profile: bool,
) -> dict:
    if task_type not in PROMPT_TEMPLATES:
        raise ValueError(f"Unknown task_type '{task_type}'")
    errors = validate_template_placeholders(task_type, user_template, system)
    if errors:
        raise ValueError(errors[0])

    async with AsyncSessionLocal() as session:
        row = await session.get(PromptTemplateOverride, task_type)
        if row:
            row.system = system
            row.user_template = user_template
            row.use_company_profile = use_company_profile
            row.updated_at = datetime.now(timezone.utc)
        else:
            row = PromptTemplateOverride(
                task_type=task_type,
                system=system,
                user_template=user_template,
                use_company_profile=use_company_profile,
            )
            session.add(row)
        await session.commit()
    return await get_effective_template(task_type)


async def reset_override(task_type: str) -> dict:
    if task_type not in PROMPT_TEMPLATES:
        raise ValueError(f"Unknown task_type '{task_type}'")
    async with AsyncSessionLocal() as session:
        await session.execute(
            delete(PromptTemplateOverride).where(
                PromptTemplateOverride.task_type == task_type
            )
        )
        await session.commit()
    return await get_effective_template(task_type)
