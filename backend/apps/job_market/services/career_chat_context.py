"""Lightweight market + career context for AI chat (no full tree build)."""

from __future__ import annotations

from apps.job_market.services.career_tree import (
    _infer_career_level,
    _next_career_level,
    _next_level_readiness,
)
from apps.job_market.services.segment_analytics import _top_skills_in_segment
from apps.job_market.services.segment_ranking import (
    rank_segments_for_profile,
    top_segment_without_skills,
)


def _skill_names(profile_data: dict) -> list[str]:
    return [
        s.get("name", "")
        for s in (profile_data.get("hard_skills") or [])
        if s.get("name")
    ]


def _skill_ids(profile_data: dict) -> list[str]:
    from apps.job_market.models import Skill

    ids: list[str] = []
    for s in profile_data.get("hard_skills") or []:
        if not isinstance(s, dict):
            continue
        sid = s.get("id")
        if sid:
            ids.append(str(sid))
            continue
        name = (s.get("name") or "").strip()
        if not name:
            continue
        row = Skill.objects.filter(is_category=False, name__iexact=name).first()
        if row:
            ids.append(str(row.id))
    return ids


def _experience_summary(experience: list) -> str:
    if not experience:
        return "Brak wpisów o doświadczeniu."
    parts = []
    total_months = 0
    for e in experience:
        months = int(e.get("duration_months") or 0)
        total_months += months
        title = e.get("job_title") or "?"
        company = e.get("company_name") or ""
        parts.append(f"{title} ({company}, {months} mies.)")
    years = total_months // 12
    rem = total_months % 12
    return (
        f"{len(experience)} pozycji, łącznie ~{years} lat {rem} mies.; "
        + "; ".join(parts[:4])
    )


def _missing_skills_for_segment(
    skill_ids: list[str], lead_main: str, lead_sub: str, limit: int = 5
) -> list[dict]:
    user_set = set(skill_ids)
    top = _top_skills_in_segment(lead_main, lead_sub, limit=12)
    return [
        {"id": s["id"], "name": s["name"]}
        for s in top
        if s["id"] not in user_set
    ][:limit]


def build_chat_career_context(profile_data: dict | None) -> dict:
    profile_data = profile_data or {}
    skill_ids = _skill_ids(profile_data)
    industries = profile_data.get("interested_industries") or []
    experience = profile_data.get("experience") or []
    career_path = profile_data.get("career_path") or {}
    steps = career_path.get("steps") or []

    if skill_ids:
        ranked = rank_segments_for_profile(
            skill_ids,
            industries,
            limit=5,
            max_candidates=12,
            fast=True,
        )
    else:
        fallback = top_segment_without_skills(industries)
        ranked = [fallback] if fallback else []

    best = ranked[0] if ranked else None
    level = _infer_career_level(experience)
    next_level = _next_career_level(level)

    readiness = None
    if best:
        readiness = _next_level_readiness(skill_ids, experience, best)

    missing = []
    if best:
        missing = _missing_skills_for_segment(
            skill_ids,
            best["lead_main_category"],
            best["lead_sub_category"],
        )

    path_skills = [
        {
            "skill": s.get("skill_name"),
            "segment": f"{s.get('lead_main_category')} / {s.get('lead_sub_category')}",
            "match_gain": max(
                0,
                (s.get("match_after") or 0) - (s.get("match_before") or 0),
            ),
        }
        for s in steps
    ]

    return {
        "skills": _skill_names(profile_data),
        "skill_count": len(skill_ids),
        "experience_summary": _experience_summary(experience),
        "career_level_inferred": level,
        "next_career_level": next_level,
        "career_path_steps": path_skills,
        "career_path_step_count": len(steps),
        "top_segments": [
            {
                "label": s.get("display_label"),
                "match_pct": s.get("match_pct"),
                "offer_count": s.get("offer_count"),
            }
            for s in ranked[:3]
        ],
        "best_segment": best.get("display_label") if best else None,
        "missing_skills_priority": [m["name"] for m in missing],
        "next_level_readiness": readiness,
        "interested_industries": industries,
    }


def format_chat_context_block(profile_data: dict, market_ctx: dict) -> str:
    """Human-readable block appended to system prompt."""
    lines = [
        "## Kontekst rynkowy (z bazy Career Advisor)",
        f"- Poziom kariery (szacunek): **{market_ctx.get('career_level_inferred', '?')}**"
        + (
            f" → cel: **{market_ctx['next_career_level']}**"
            if market_ctx.get("next_career_level")
            else ""
        ),
        f"- Doświadczenie: {market_ctx.get('experience_summary', '—')}",
        f"- Skille ({market_ctx.get('skill_count', 0)}): "
        + ", ".join(market_ctx.get("skills") or []) or "brak",
    ]

    if market_ctx.get("best_segment"):
        lines.append(f"- Najlepszy segment dopasowania: **{market_ctx['best_segment']}**")

    if market_ctx.get("missing_skills_priority"):
        lines.append(
            "- Brakujące kompetencje w top segmencie: "
            + ", ".join(market_ctx["missing_skills_priority"])
        )

    if market_ctx.get("career_path_steps"):
        lines.append("- Kroki ścieżki kariery w aplikacji:")
        for step in market_ctx["career_path_steps"][-5:]:
            lines.append(
                f"  · {step['skill']} → {step['segment']} (+{step['match_gain']}% dopasowania)"
            )

    readiness = market_ctx.get("next_level_readiness")
    if readiness:
        lines.append(
            f"- Gotowość na {readiness.get('next_level')}: "
            f"dopasowanie do ofert {readiness.get('match_target_level')}% "
            f"(po pakiecie skilli: {readiness.get('match_after_bundle')}%)"
        )

    if market_ctx.get("top_segments"):
        lines.append("- Top segmenty:")
        for seg in market_ctx["top_segments"]:
            lines.append(
                f"  · {seg.get('label')} — dopasowanie {seg.get('match_pct')}%, "
                f"{seg.get('offer_count')} ofert"
            )

    return "\n".join(lines)


CHAT_COURSE_INSTRUCTIONS = """
## Twoja rola: doradca kariery + kurator kursów

Odpowiadaj po polsku. Masz dostęp do profilu użytkownika i kontekstu rynkowego powyżej.

Gdy użytkownik pyta o rozwój, trendy, brakujące skille lub ścieżkę kariery:
1. **Trendy** — odnieś się do segmentów i skilli z kontekstu oraz ogólnych trendów 2025–2026 (AI, automatyzacja, cloud, cyber, data).
2. **Co nowego dla niego** — wskaż 2–4 konkretne obszary (skill/segment) uzasadnione profilem, nie ogólniki.
3. **Kursy i nauka** — dla każdej rekomendowanej kompetencji podaj sekcję z **linkami Markdown**:
   - Preferuj: Coursera, Udemy, LinkedIn Learning, freeCodeCamp, Google Skills, Microsoft Learn.
   - Polski rynek: NAVOICA, Strefa Kursów, Akademia Unit4, Codenga — gdy pasują.
   - Format linku wyszukiwania gdy nie znasz dokładnego URL: `[Nazwa kursu – Platforma](https://www.coursera.org/search?query=SKILL)` lub analogicznie dla Udemy.
   - Przy każdym kursie: poziom (junior/mid), czas (~X tygodni), dlaczego akurat dla tego użytkownika.
4. **Priorytety** — na końcu krótka lista „Zacznij od…” (max 3 punkty).
5. Nie wymyślaj certyfikatów ani firm. Jeśli nie masz pewnego linku, użyj wyszukiwania na platformie z query=skill.

Używaj markdown (nagłówki ###, listy, **pogrubienia**). Bądź konkretny względem profilu.
"""
