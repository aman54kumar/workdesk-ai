from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.task_settings import TaskSetting
from app.prompts.templates import TASK_MODEL_MAP
from app.task_definitions import TASK_DEFINITION_BY_TYPE, TASK_DEFINITIONS


async def seed_task_settings() -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(TaskSetting.task_type))
        existing = set(result.scalars().all())
        for i, definition in enumerate(TASK_DEFINITIONS):
            task_type = definition["task_type"]
            if task_type in existing:
                continue
            session.add(
                TaskSetting(
                    task_type=task_type,
                    is_active=True,
                    model_override=None,
                    sort_order=i,
                )
            )
        await session.commit()


async def _get_settings_map(session: AsyncSession) -> dict[str, TaskSetting]:
    result = await session.execute(
        select(TaskSetting).order_by(TaskSetting.sort_order)
    )
    return {row.task_type: row for row in result.scalars().all()}


def default_model_for(task_type: str) -> str:
    return TASK_MODEL_MAP[task_type]["model"]


async def resolve_model(task_type: str) -> str:
    async with AsyncSessionLocal() as session:
        row = await session.get(TaskSetting, task_type)
        if row and row.model_override:
            return row.model_override
    return default_model_for(task_type)


async def is_task_active(task_type: str) -> bool:
    async with AsyncSessionLocal() as session:
        row = await session.get(TaskSetting, task_type)
        return True if row is None else row.is_active


async def list_public_tasks() -> list[dict]:
    async with AsyncSessionLocal() as session:
        settings_map = await _get_settings_map(session)

    tasks: list[dict] = []
    for definition in TASK_DEFINITIONS:
        task_type = definition["task_type"]
        setting = settings_map.get(task_type)
        if setting is not None and not setting.is_active:
            continue
        tasks.append({**definition})
    return tasks


async def list_admin_tasks() -> list[dict]:
    async with AsyncSessionLocal() as session:
        settings_map = await _get_settings_map(session)

    rows: list[dict] = []
    for definition in TASK_DEFINITIONS:
        task_type = definition["task_type"]
        setting = settings_map.get(task_type)
        is_active = True if setting is None else setting.is_active
        model_override = None if setting is None else setting.model_override
        rows.append(
            {
                **definition,
                "is_active": is_active,
                "model_override": model_override,
                "default_model": default_model_for(task_type),
            }
        )
    return rows


async def update_task_setting(
    task_type: str,
    *,
    is_active: bool | None = None,
    model_override: str | None = None,
    clear_model_override: bool = False,
) -> dict | None:
    if task_type not in TASK_DEFINITION_BY_TYPE:
        return None

    async with AsyncSessionLocal() as session:
        row = await session.get(TaskSetting, task_type)
        if row is None:
            idx = next(
                i for i, d in enumerate(TASK_DEFINITIONS) if d["task_type"] == task_type
            )
            row = TaskSetting(
                task_type=task_type,
                is_active=True,
                model_override=None,
                sort_order=idx,
            )
            session.add(row)

        if is_active is not None:
            row.is_active = is_active
        if clear_model_override:
            row.model_override = None
        elif model_override is not None:
            row.model_override = model_override

        await session.commit()

    items = await list_admin_tasks()
    return next((t for t in items if t["task_type"] == task_type), None)
