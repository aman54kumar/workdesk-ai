"""Resolve effective prompts: DB override first, else code defaults."""

import re

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.prompt_override import PromptTemplateOverride
from app.prompts.templates import PROMPT_TEMPLATES
from app.services.company_profile import build_company_context

_PLACEHOLDER_RE = re.compile(r"\{([a-z_]+)\}")


def required_placeholders(user_template: str) -> set[str]:
    return set(_PLACEHOLDER_RE.findall(user_template))


def validate_template_placeholders(
    task_type: str, user_template: str, system: str
) -> list[str]:
    default = PROMPT_TEMPLATES.get(task_type)
    if not default:
        return [f"Unknown task_type '{task_type}'"]
    required = required_placeholders(default["user_template"])
    present = required_placeholders(user_template)
    missing = sorted(required - present)
    if missing:
        return [f"Missing required placeholder(s): {', '.join('{' + p + '}' for p in missing)}"]
    return []


async def resolve_prompt(task_type: str) -> dict[str, str]:
    use_company = False
    system = PROMPT_TEMPLATES[task_type]["system"]
    user_template = PROMPT_TEMPLATES[task_type]["user_template"]

    async with AsyncSessionLocal() as session:
        row = await session.scalar(
            select(PromptTemplateOverride).where(
                PromptTemplateOverride.task_type == task_type
            )
        )
        if row:
            system = row.system
            user_template = row.user_template
            use_company = row.use_company_profile

    if use_company:
        block = await build_company_context()
        if block:
            system = f"{system}\n\n--- Company profile ---\n{block}"

    return {"system": system, "user_template": user_template}
