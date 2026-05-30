import asyncio
import hashlib
import sqlite3
from datetime import datetime, timedelta, timezone

from app.config import settings


def make_cache_key(model: str, system_prompt: str, user_prompt: str) -> str:
    raw = f"{model}||{system_prompt}||{user_prompt}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _parse_expires(value: str) -> datetime:
    expires = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return expires


async def get_cached(cache_key: str) -> str | None:
    def _read() -> str | None:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT response_text, expires_at FROM response_cache WHERE cache_key = ?",
                (cache_key,),
            ).fetchone()
            if not row:
                return None
            response_text, expires_at = row
            if _parse_expires(expires_at) <= datetime.now(timezone.utc):
                return None
            return response_text
        finally:
            conn.close()

    return await asyncio.to_thread(_read)


async def set_cache(
    cache_key: str,
    model: str,
    task_type: str,
    response_text: str,
    ttl_hours: int = 24,
) -> None:
    def _write() -> None:
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=ttl_hours)).isoformat()
        conn = _connect()
        try:
            conn.execute(
                """
                INSERT INTO response_cache (cache_key, model, task_type, response_text, expires_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET
                    model = excluded.model,
                    task_type = excluded.task_type,
                    response_text = excluded.response_text,
                    expires_at = excluded.expires_at
                """,
                (cache_key, model, task_type, response_text, expires_at),
            )
            conn.commit()
        finally:
            conn.close()

    await asyncio.to_thread(_write)
