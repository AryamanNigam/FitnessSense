from typing import Iterator

from app.services.gemini_client import stream_text
from rag.prompt import SYSTEM_PROMPT, build_prompt
from rag.retriever import retrieve


def answer_stream(question: str, profile: dict, history: list[dict]) -> Iterator[str]:
    context = retrieve(question)
    prompt = build_prompt(question, context, profile, history)
    yield from stream_text(prompt, SYSTEM_PROMPT)
