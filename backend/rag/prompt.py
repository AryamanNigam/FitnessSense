SYSTEM_PROMPT = (
    "You are FitnessSense's assistant, a concise and practical coach for nutrition and training. "
    "Ground food and macro answers in the provided USDA context when it is relevant, quoting its per-100g values. "
    "If the context does not cover the question, answer from general knowledge and say the figure is approximate. "
    "Tailor advice to the user's goal and targets. Decline topics unrelated to fitness, nutrition, or health. "
    "Do not give medical diagnoses; recommend a professional for medical concerns. Keep answers under 200 words."
)


def build_prompt(question: str, context: list[str], profile: dict, history: list[dict]) -> str:
    context_block = "\n".join(f"- {c}" for c in context) if context else "No relevant USDA entries found."
    history_block = "\n".join(f"{m['role']}: {m['content']}" for m in history) if history else "None."
    return (
        f"User profile:\n"
        f"- Goal: {profile.get('goal')}\n"
        f"- Daily calorie target (TDEE): {profile.get('tdee')} kcal\n"
        f"- Protein target: {profile.get('protein_target_g')} g\n\n"
        f"USDA context:\n{context_block}\n\n"
        f"Recent conversation:\n{history_block}\n\n"
        f"Question: {question}"
    )
