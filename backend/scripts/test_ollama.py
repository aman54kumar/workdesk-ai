"""
Standalone test for Ollama streaming.
Run from the backend/ directory with the venv active:

    python scripts/test_ollama.py
"""
import asyncio
import sys
import time

sys.path.insert(0, ".")

from app.config import settings
from app.services.ollama import stream_ollama


async def main():
    model = settings.OLLAMA_MODEL_DEFAULT
    messages = [
        {"role": "user", "content": "Say hello in one short sentence."},
    ]

    print(f"Model  : {model}")
    print(f"Prompt : {messages[0]['content']}")
    print("-" * 40)

    start = time.perf_counter()
    chunk_count = 0

    async for chunk in stream_ollama(model, messages, {"num_predict": 60, "temperature": 0.3}):
        print(chunk, end="", flush=True)
        chunk_count += 1

    elapsed = time.perf_counter() - start
    print(f"\n{'-' * 40}")
    print(f"Chunks : {chunk_count}")
    print(f"Time   : {elapsed:.2f}s")


if __name__ == "__main__":
    asyncio.run(main())
