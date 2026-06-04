"""Curated cloud model presets — fallback when provider list APIs are unavailable."""

from typing import TypedDict


class CloudModelPreset(TypedDict):
    id: str
    label: str


DEFAULT_CLOUD_PRESETS: dict[str, list[CloudModelPreset]] = {
    "openai": [
        {"id": "gpt-5.5", "label": "GPT-5.5 (frontier, best quality)"},
        {"id": "gpt-5.5-pro", "label": "GPT-5.5 Pro (highest accuracy)"},
        {"id": "gpt-5.4", "label": "GPT-5.4 (strong reasoning & coding)"},
        {"id": "gpt-5.4-mini", "label": "GPT-5.4 Mini (fast, high volume)"},
        {"id": "gpt-5.4-nano", "label": "GPT-5.4 Nano (cheapest, simple tasks)"},
        {"id": "gpt-5-mini", "label": "GPT-5 Mini"},
        {"id": "gpt-5-nano", "label": "GPT-5 Nano"},
        {"id": "gpt-4o-mini", "label": "GPT-4o Mini (legacy, low cost)"},
        {"id": "gpt-4o", "label": "GPT-4o (legacy, balanced)"},
        {"id": "gpt-4.1-mini", "label": "GPT-4.1 Mini"},
        {"id": "gpt-4.1", "label": "GPT-4.1"},
        {"id": "o4-mini", "label": "o4-mini (reasoning, efficient)"},
        {"id": "o3-mini", "label": "o3-mini (reasoning)"},
    ],
    "anthropic": [
        {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5 (fast)"},
        {"id": "claude-sonnet-4-6", "label": "Claude Sonnet 4.6 (balanced)"},
        {"id": "claude-opus-4-8", "label": "Claude Opus 4.8 (best quality)"},
        {"id": "claude-sonnet-4-20250514", "label": "Claude Sonnet 4 (May 2025)"},
    ],
    "google": [
        {"id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash (fast)"},
        {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
        {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro (quality)"},
        {"id": "gemini-2.0-flash-lite", "label": "Gemini 2.0 Flash Lite (cheapest)"},
    ],
}


def default_label_map() -> dict[str, dict[str, str]]:
    return {
        provider: {p["id"]: p["label"] for p in presets}
        for provider, presets in DEFAULT_CLOUD_PRESETS.items()
    }
