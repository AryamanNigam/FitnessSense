from typing import Iterator

from app.services.gemini_client import stream_text
from rag.constraints import annotate, extract_constraints
from rag.prompt import SYSTEM_PROMPT, build_prompt
from rag.retriever import retrieve


def answer_stream(question: str, profile: dict, history: list[dict]) -> Iterator[str]:
    constraints = extract_constraints(question)
    foods = [f.strip() for f in (constraints.search_query or "").split(",") if f.strip()]
    hits = retrieve(foods or question, constraints)
    context = [annotate(text, meta, constraints) for text, meta in hits]
    prompt = build_prompt(question, context, profile, history)
    yield from stream_text(prompt, SYSTEM_PROMPT)
