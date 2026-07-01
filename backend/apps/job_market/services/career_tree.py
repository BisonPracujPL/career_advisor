"""
Career tree builder — provides career level inference and next-level readiness.

The full tree-building logic (build_career_tree) is complex and used by the
career path UI. The functions below are the lightweight subset used by the
chat context module.
"""

from __future__ import annotations

from apps.job_market.services.segment_ranking import rank_segments_for_profile, top_segment_without_skills
from apps.job_market.services.segment_analytics import _top_skills_in_segment, _segment_match_score
from apps.job_market.services.pillar_labels import segment_display_label

LEVEL_ORDER = ["junior", "mid", "senior", "lead", "principal"]
BUNDLE_SIZE = 3


def _infer_career_level(experience: list) -> str:
    """Estimate seniority from total months of experience."""
    if not experience:
        return "junior"
    total_months = sum(e.get("duration_months", 0) or 0 for e in experience)
    if total_months < 24:
        return "junior"
    if total_months < 60:
        return "mid"
    return "senior"


def _next_career_level(level: str) -> str | None:
    """Return the level after *level* in LEVEL_ORDER, or None if already at top."""
    try:
        idx = LEVEL_ORDER.index(level)
    except ValueError:
        return None
    if idx + 1 < len(LEVEL_ORDER):
        return LEVEL_ORDER[idx + 1]
    return None


def _next_level_readiness(
    skill_ids: list[str],
    experience: list,
    best_segment: dict | None,
) -> dict | None:
    """
    Estimate how close the user is to the next career level in their best segment.

    Returns a dict with: next_level, segment_label, display_label,
    match_now, match_target_level, match_after_bundle, bundle_delta, missing_skills
    Or None if not computable.
    """
    if not best_segment:
        return None

    current = _infer_career_level(experience)
    target = _next_career_level(current)
    if not target:
        return None

    lead_main = best_segment.get("lead_main_category", "")
    lead_sub = best_segment.get("lead_sub_category", "")
    if not lead_main or not lead_sub:
        return None

    try:
        level_filter = {"position_level_groups": [target]}
        score_now = _segment_match_score(skill_ids, lead_main, lead_sub) or {}
        score_target = _segment_match_score(skill_ids, lead_main, lead_sub, level_filter) or {}

        match_now = score_now.get("avg_similarity_pct", 0)
        match_target = score_target.get("avg_similarity_pct", 0)

        # Simulate adding a bundle of missing skills
        top = _top_skills_in_segment(lead_main, lead_sub, limit=20)
        user_set = set(skill_ids)
        missing = [s for s in top if s.get("id") not in user_set][:BUNDLE_SIZE]
        bundle_ids = [s["id"] for s in missing if s.get("id")]
        trial_ids = list(dict.fromkeys(skill_ids + bundle_ids))
        score_after = _segment_match_score(trial_ids, lead_main, lead_sub, level_filter) or {}
        match_after = score_after.get("avg_similarity_pct", match_target)

        return {
            "current_level": current,
            "next_level": target,
            "segment_label": lead_sub,
            "display_label": segment_display_label(lead_main, lead_sub),
            "match_now": match_now,
            "match_target_level": match_target,
            "match_after_bundle": match_after,
            "bundle_delta": match_after - match_target,
            "missing_skills": [{"name": s.get("name", ""), "id": s.get("id", "")} for s in missing],
        }
    except Exception:
        return None
