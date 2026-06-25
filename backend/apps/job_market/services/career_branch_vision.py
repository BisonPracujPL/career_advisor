"""AI-generated branch vision + course links (career path only, not main chat)."""

from __future__ import annotations

import json
import os

from apps.job_market.services.career_chat_context import build_chat_career_context

AI_MODEL = "openai/gpt-4o-mini"

VISION_INSTRUCTIONS = """
Jesteś generatorem krótkiej wizji kariery dla JEDNEJ gałęzi drzewka skilli.
Odpowiedz WYŁĄCZNIE po polsku, w Markdown (bez otaczających bloków ```).

Struktura (dokładnie te nagłówki):

### Twoja wizja po tej gałęzi
2–3 krótkie akapity: jak może wyglądać praca w tym segmencie po dodaniu tych skilli,
jakie role/stanowiska są realne, co zyskasz kompetencyjnie. Bez wymyślania dat awansu.

### Kursy — od czego zacząć
3–5 punktów w formacie:
- [Nazwa kursu – Platforma](https://...) — poziom (junior/mid), ~X tygodni, jedno zdanie dlaczego dla tego profilu

Używaj prawdziwych platform (Coursera, Udemy, LinkedIn Learning, freeCodeCamp, Microsoft Learn,
Google Skills, NAVOICA, Codenga). Jeśli nie znasz dokładnego URL kursu, użyj wyszukiwania platformy:
https://www.coursera.org/search?query=SKILL lub https://www.udemy.com/courses/search/?q=SKILL

### W skrócie
3 bullet pointy: najważniejszy skill, potencjał w segmencie, pierwszy krok.

Bądź konkretny względem przekazanego profilu i gałęzi. Max ~450 słów.
"""


def generate_branch_vision(
    branch: dict,
    profile_data: dict | None,
    segment_insight: dict | None = None,
) -> dict:
    openrouter_key = os.environ.get("OPEN_ROUTER_API_KEY", "")
    if not openrouter_key or openrouter_key == "set_me_up":
        return {
            "content": "",
            "error": "Brak klucza OPEN_ROUTER_API_KEY.",
        }

    profile_data = profile_data or {}
    market_ctx = build_chat_career_context(profile_data)

    payload = {
        "branch": branch,
        "profile_summary": {
            "skills": market_ctx.get("skills"),
            "experience_summary": market_ctx.get("experience_summary"),
            "career_level": market_ctx.get("career_level_inferred"),
            "best_segment": market_ctx.get("best_segment"),
        },
        "segment_salaries": segment_insight,
    }

    user_msg = (
        f"Dane gałęzi i profilu (JSON):\n"
        f"{json.dumps(payload, ensure_ascii=False)}\n\n"
        "Wygeneruj wizję kariery i listę kursów z linkami."
    )

    try:
        from openai import OpenAI

        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_key,
        )
        response = client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": VISION_INSTRUCTIONS},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=900,
            temperature=0.45,
        )
        content = (response.choices[0].message.content or "").strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.lower().startswith("markdown"):
                content = content[8:].strip()
        return {"content": content, "error": None}
    except Exception as exc:
        return {"content": "", "error": str(exc)}
