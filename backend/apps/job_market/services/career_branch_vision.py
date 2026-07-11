"""AI-generated branch vision + course links (career path only, not main chat)."""

from __future__ import annotations

import json
import os

from apps.job_market.services.career_chat_context import (
    build_chat_career_context,
    format_chat_context_block,
)
from apps.job_market.services.rag_service import retrieve_context

AI_MODEL = "openai/gpt-5.6-terra"
AI_TEMPERATURE = 0.45

VISION_RAG_INSTRUCTIONS = """
CRITICAL INSTRUCTIONS FOR RAG:
1. When you mention salaries, market trends, or demand in this segment, ground factual claims in the 'Dokumenty źródłowe' section above when it is present.
2. Do NOT invent salary bands (Junior/Mid/Senior) if they are not in the provided reports or in segment_salaries JSON.
3. If reports only cover part of the market, say so clearly.
4. Cite the report name when using report data (e.g. 'Według raportu Antal…').
5. Course links and learning paths may use well-known platforms even without RAG; market facts should prefer RAG + segment_salaries.
"""

VISION_OUTPUT_SCHEMA = """
OUTPUT STRUCTURE — respond in Polish, use these exact Markdown headings (no ``` fences):

### Twoja wizja po tej gałęzi
2–3 short paragraphs: what work in this segment could look like after adding these skills,
realistic roles, competency gains. Do not invent promotion dates.

### Kursy — od czego zacząć
3–5 bullet points:
- [Course name – Platform](https://...) — level (junior/mid), ~X weeks, one sentence why for this profile

Use real platforms (Coursera, Udemy, LinkedIn Learning, freeCodeCamp, Microsoft Learn,
Google Skills, NAVOICA, Codenga). If you do not know an exact course URL, use platform search:
https://www.coursera.org/search?query=SKILL or https://www.udemy.com/courses/search/?q=SKILL

### W skrócie
3 bullets: key skill, segment potential, first step.

Be specific to the branch and profile JSON in the user message. Max ~450 words.
"""


def _vision_rag_query(branch: dict, market_ctx: dict) -> str:
    """Build a retrieval query from branch + profile context (no chat history)."""
    parts: list[str] = []

    seg = (
        branch.get("segment_label")
        or branch.get("subtitle")
        or branch.get("lead_sub_category")
        or ""
    )
    if seg:
        parts.append(str(seg))

    lead_main = branch.get("lead_main_category") or ""
    if lead_main:
        parts.append(str(lead_main))

    skill = branch.get("skill_name") or branch.get("title") or ""
    if skill:
        parts.append(str(skill))

    for skill_row in branch.get("skills") or []:
        if isinstance(skill_row, dict) and skill_row.get("name"):
            parts.append(str(skill_row["name"]))

    best = market_ctx.get("best_segment") or ""
    if best and best not in parts:
        parts.append(str(best))

    level = market_ctx.get("career_level_inferred") or ""
    if level:
        parts.append(str(level))

    for kw in (market_ctx.get("missing_skills_priority") or [])[:3]:
        parts.append(str(kw))

    parts.extend(["Polska", "rynek pracy", "wynagrodzenia", "zapotrzebowanie", "kursy"])
    return " ".join(p for p in parts if p).strip()


def _build_system_prompt(
    profile_data: dict,
    market_ctx: dict,
    rag_section: str,
) -> str:
    context_block = format_chat_context_block(profile_data, market_ctx)

    sections = [
        "You are a personalized AI career advisor generating a short vision for ONE skill-tree "
        "branch on the Polish job market. Respond in Polish only.",
        "",
    ]

    if context_block:
        sections.append(context_block)
        sections.append("")

    if rag_section:
        sections.append(rag_section.strip())
        sections.append("")
        sections.append(VISION_RAG_INSTRUCTIONS.strip())
        sections.append("")

    sections.append(VISION_OUTPUT_SCHEMA.strip())
    return "\n".join(sections)


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

    rag_query = _vision_rag_query(branch, market_ctx)
    rag_context = retrieve_context(rag_query) if rag_query else ""
    rag_section = f"\n{rag_context}" if rag_context else ""

    payload = {
        "branch": branch,
        "profile_summary": {
            "skills": market_ctx.get("skills"),
            "experience_summary": market_ctx.get("experience_summary"),
            "career_level": market_ctx.get("career_level_inferred"),
            "best_segment": market_ctx.get("best_segment"),
            "missing_skills_priority": market_ctx.get("missing_skills_priority"),
        },
        "segment_salaries": segment_insight,
    }

    system_prompt = _build_system_prompt(profile_data, market_ctx, rag_section)

    user_msg = (
        "Branch and profile data (JSON):\n"
        f"{json.dumps(payload, ensure_ascii=False)}\n\n"
        "Generate the career vision and course list with Markdown links."
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
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=900,
            temperature=AI_TEMPERATURE,
        )
        content = (response.choices[0].message.content or "").strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.lower().startswith("markdown"):
                content = content[8:].strip()
        return {"content": content, "error": None}
    except Exception as exc:
        return {"content": "", "error": str(exc)}
