"""Lightweight market + career context for AI chat (no full tree build)."""

from __future__ import annotations

# ── Lazy imports from heavier modules — fail gracefully ──────────────────────
try:
    from apps.job_market.services.career_tree import (
        _infer_career_level,
        _next_career_level,
        _next_level_readiness,
    )
except Exception:
    def _infer_career_level(experience): return "mid"
    def _next_career_level(level): return None
    def _next_level_readiness(*a, **kw): return None

try:
    from apps.job_market.services.segment_analytics import _top_skills_in_segment
except Exception:
    def _top_skills_in_segment(*a, **kw): return []

try:
    from apps.job_market.services.segment_ranking import (
        rank_segments_for_profile,
        top_segment_without_skills,
    )
except Exception:
    def rank_segments_for_profile(*a, **kw): return []
    def top_segment_without_skills(*a, **kw): return None


# ── Course instructions constant ─────────────────────────────────────────────

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
4. **Priorytety** — na końcu krótka lista „Zacznij od…" (max 3 punkty).
5. Nie wymyślaj certyfikatów ani firm. Jeśli nie masz pewnego linku, użyj wyszukiwania na platformie z query=skill.

Używaj markdown (nagłówki ###, listy, **pogrubienia**). Bądź konkretny względem profilu.
"""


# ── Internal helpers ─────────────────────────────────────────────────────────

def _skill_names(profile_data: dict) -> list[str]:
    return [
        s.get("skill_name", "")
        for s in (profile_data.get("hard_skills") or [])
        if s.get("skill_name")
    ]


def _skill_ids(profile_data: dict) -> list[str]:
    return [
        s.get("skill_id", "")
        for s in (profile_data.get("hard_skills") or [])
        if s.get("skill_id")
    ]


def _experience_summary(experience: list) -> str:
    if not experience:
        return "Brak wpisów o doświadczeniu."
    total_months = sum(e.get("duration_months", 0) or 0 for e in experience)
    parts = []
    for e in experience[:4]:
        title = e.get("job_title", "")
        company = e.get("company_name", "")
        months = e.get("duration_months")
        part = f"{title}"
        if company:
            part += f" @ {company}"
        if months:
            part += f" ({months} mies.)"
        parts.append(part)
    suffix = f"; łącznie ~{total_months} mies." if total_months else ""
    n = len(experience)
    return f"{n} pozycji, łącznie ~{total_months} mies.; " + "; ".join(parts)


def _missing_skills_for_segment(
    skill_ids: list[str],
    lead_main: str,
    lead_sub: str,
) -> list[dict]:
    try:
        top = _top_skills_in_segment(lead_main, lead_sub, limit=10)
        user_set = set(skill_ids)
        return [s for s in top if s.get("id") not in user_set][:5]
    except Exception:
        return []


# ── Public API ────────────────────────────────────────────────────────────────

def build_chat_career_context(profile_data: dict | None) -> dict:
    """Build a lightweight context dict for the chat system prompt."""
    if not profile_data:
        return {}

    skill_ids = _skill_ids(profile_data)
    industries = profile_data.get("interested_industries") or []
    experience = profile_data.get("experience") or []
    career_path = profile_data.get("career_path") or []

    # Steps from saved career path
    steps = []
    for s in (career_path or []):
        if s.get("steps"):
            steps = s["steps"]
            break

    # Segment ranking
    try:
        ranked = rank_segments_for_profile(skill_ids, industries) or []
        fallback = top_segment_without_skills(industries) if not ranked else None
    except Exception:
        ranked = []
        fallback = None

    # Career level
    try:
        level = _infer_career_level(experience)
        next_level = _next_career_level(level)
    except Exception:
        level = None
        next_level = None

    # Best segment
    best = ranked[0] if ranked else fallback

    # Next level readiness
    try:
        readiness = _next_level_readiness(skill_ids, experience, best) if best else None
    except Exception:
        readiness = None

    # Missing skills in top segment
    try:
        missing = []
        if best:
            lead_main = best.get("lead_main_category", "")
            lead_sub = best.get("lead_sub_category", "")
            missing_raw = _missing_skills_for_segment(skill_ids, lead_main, lead_sub)
            missing = [m.get("name", "") for m in missing_raw if m.get("name")]
    except Exception:
        missing = []

    # Career path steps for context
    path_skills = []
    for s in (steps or [])[-5:]:
        m = {
            "skill": s.get("skill_name", s.get("skill", "")),
            "segment": (
                f"{s.get('lead_main_category', '')} / {s.get('lead_sub_category', '')}"
                if s.get("lead_main_category")
                else s.get("segment", "")
            ),
            "match_gain": s.get("match_gain", s.get("match_delta", "")),
            "match_after": s.get("match_after", ""),
            "match_before": s.get("match_before", ""),
        }
        path_skills.append(m)

    return {
        "skills": _skill_names(profile_data),
        "skill_count": len(skill_ids),
        "experience_summary": _experience_summary(experience),
        "career_level_inferred": level,
        "next_career_level": next_level,
        "career_path_steps": path_skills,
        "career_path_step_count": len(path_skills),
        "top_segments": [
            {
                "label": seg.get("display_label", seg.get("lead_sub_category", "")),
                "display_label": seg.get("display_label", ""),
                "match_pct": seg.get("match_pct", seg.get("avg_similarity_pct", "")),
                "offer_count": seg.get("offer_count", ""),
            }
            for seg in (ranked[:5] if ranked else [])
        ],
        "best_segment": best.get("display_label", best.get("lead_sub_category", "")) if best else None,
        "missing_skills_priority": missing,
        "next_level_readiness": readiness,
    }


def format_chat_context_block(profile_data: dict, market_ctx: dict) -> str:
    """Human-readable block appended to system prompt."""
    if not market_ctx:
        return ""

    lines = ["## Kontekst rynkowy (z bazy Career Advisor)"]

    if market_ctx.get("career_level_inferred"):
        level_line = f"- Poziom kariery (szacunek): **{market_ctx['career_level_inferred']}**"
        if market_ctx.get("next_career_level"):
            level_line += f" → cel: **{market_ctx['next_career_level']}**"
        lines.append(level_line)

    if market_ctx.get("experience_summary"):
        lines.append(f"- Doświadczenie: {market_ctx['experience_summary']}")

    skill_count = market_ctx.get("skill_count", 0)
    skills = market_ctx.get("skills") or []
    if skills:
        lines.append(f"- Skille ({skill_count}): {', '.join(skills[:12])}")

    if market_ctx.get("best_segment"):
        lines.append(f"- Najlepszy segment dopasowania: **{market_ctx['best_segment']}**")

    if market_ctx.get("missing_skills_priority"):
        lines.append(
            "- Brakujące kompetencje w top segmencie: "
            + ", ".join(market_ctx["missing_skills_priority"])
        )

    if market_ctx.get("career_path_steps"):
        lines.append("- Kroki ścieżki kariery w aplikacji:")
        for step in market_ctx["career_path_steps"]:
            lines.append(
                f"  · {step['skill']} → {step['segment']} (+"
                f"{step['match_gain']}% dopasowania)"
            )

    readiness = market_ctx.get("next_level_readiness")
    if readiness:
        lines.append(
            f"- Gotowość na {readiness.get('next_level')}"
            f": dopasowanie do ofert {readiness.get('match_target_level')}"
            f"% (po pakiecie skilli: {readiness.get('match_after_bundle')}%)"
        )

    if market_ctx.get("top_segments"):
        lines.append("- Top segmenty:")
        for seg in market_ctx["top_segments"]:
            lines.append(
                f"  · {seg.get('label')} — dopasowanie "
                f"{seg.get('match_pct')}%, "
                f"{seg.get('offer_count')} ofert"
            )

    return "\n".join(lines)
