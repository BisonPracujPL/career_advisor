"""Dynamic career skill tree — branches are real TF-IDF skill gains toward market segments."""

from __future__ import annotations

from apps.job_market.models import Skill
from apps.job_market.services.pillar_labels import segment_display_label
from apps.job_market.services.segment_analytics import (
    _enrich_skill_pcts,
    _segment_match_score,
    _top_skills_in_segment,
)
from apps.job_market.services.segment_ranking import (
    _top_segment_without_skills,
    rank_segments_for_profile,
)

MAX_BRANCHES = 5
MAX_HISTORY_SEGMENTS = 6
SKILLS_PER_SEGMENT = 5


def _segment_match_pct(skill_ids: list[str], lead_main: str, lead_sub: str) -> int:
    match = _segment_match_score(skill_ids, lead_main, lead_sub) or {}
    return int(match.get("avg_similarity_pct", 0))


def _skill_details(skill_ids: list[str]) -> list[dict]:
    if not skill_ids:
        return []
    names = dict(Skill.objects.filter(id__in=skill_ids).values_list("id", "name"))
    return [{"id": sid, "name": names.get(sid, sid)} for sid in skill_ids]


def _generate_branches(skill_ids: list[str], industries: list | None) -> list[dict]:
    """Pick up to MAX_BRANCHES skills that most improve TF-IDF match to distinct segments."""
    ranked = rank_segments_for_profile(skill_ids, industries, limit=MAX_HISTORY_SEGMENTS)
    if not ranked and not skill_ids:
        fallback = _top_segment_without_skills(industries)
        if fallback:
            ranked = [fallback]

    user_set = set(skill_ids or [])
    candidates: list[dict] = []

    for seg in ranked:
        lead_main = seg["lead_main_category"]
        lead_sub = seg["lead_sub_category"]
        size = seg["offer_count"]
        base_match = seg["match_pct"] if skill_ids else 0

        top = _enrich_skill_pcts(
            _top_skills_in_segment(lead_main, lead_sub, limit=15),
            size,
        )
        missing = [s for s in top if s["id"] not in user_set][:SKILLS_PER_SEGMENT]

        best: dict | None = None
        for skill in missing:
            trial_ids = list(skill_ids or []) + [skill["id"]]
            new_match = _segment_match_pct(trial_ids, lead_main, lead_sub)
            delta = new_match - base_match
            if delta <= 0 and skill_ids:
                continue
            if skill_ids and new_match <= base_match:
                continue
            row = {
                "id": f"branch:{skill['id']}|{lead_main}|{lead_sub}",
                "kind": "branch",
                "status": "available",
                "skill_id": skill["id"],
                "skill_name": skill["name"],
                "title": skill["name"],
                "subtitle": segment_display_label(lead_main, lead_sub),
                "lead_main_category": lead_main,
                "lead_sub_category": lead_sub,
                "segment_label": segment_display_label(lead_main, lead_sub),
                "match_before": base_match,
                "match_after": new_match,
                "match_delta": max(delta, 0) if skill_ids else new_match,
                "pct_of_segment": skill.get("pct_of_segment", 0),
            }
            if best is None or row["match_delta"] > best["match_delta"]:
                best = row

        if best is not None:
            candidates.append(best)

    candidates.sort(key=lambda x: (-x["match_delta"], -x["match_after"]))

    seen_segments: set[tuple[str, str]] = set()
    seen_skills: set[str] = set()
    branches: list[dict] = []
    for row in candidates:
        seg_key = (row["lead_main_category"], row["lead_sub_category"])
        if seg_key in seen_segments or row["skill_id"] in seen_skills:
            continue
        seen_segments.add(seg_key)
        seen_skills.add(row["skill_id"])
        branches.append(row)
        if len(branches) >= MAX_BRANCHES:
            break

    return branches


def _state_node(
    skill_ids: list[str],
    industries: list | None,
    *,
    node_id: str,
    status: str,
    depth: int,
) -> dict:
    ranked = rank_segments_for_profile(skill_ids, industries, limit=3) if skill_ids else []
    if not ranked:
        fallback = _top_segment_without_skills(industries)
        if fallback:
            ranked = [fallback]

    best = ranked[0] if ranked else None
    return {
        "id": node_id,
        "kind": "state",
        "status": status,
        "depth": depth,
        "title": "Twój stan" if status == "active" else f"Etap {depth}",
        "subtitle": f"{len(skill_ids)} kompetencji · najlepsze dopasowanie {best['match_pct'] if best else 0}%",
        "skill_ids": skill_ids,
        "skills": _skill_details(skill_ids),
        "match_pct": best["match_pct"] if best else 0,
        "top_segments": [
            {
                "display_label": s["display_label"],
                "match_pct": s["match_pct"],
                "lead_main_category": s["lead_main_category"],
                "lead_sub_category": s["lead_sub_category"],
            }
            for s in ranked[:3]
        ],
    }


def build_career_tree(
    skill_ids: list[str],
    industries: list | None = None,
    career_path: dict | None = None,
) -> dict | None:
    """
    career_path.steps — ordered branch choices taken via the tree UI.
    Each step: {skill_id, skill_name, lead_main_category, lead_sub_category, match_before, match_after}
    """
    career_path = career_path or {}
    steps: list[dict] = list(career_path.get("steps") or [])

    taken_ids = {s["skill_id"] for s in steps}
    base_skills = [s for s in (skill_ids or []) if s not in taken_ids]

    levels: list[dict] = []
    accumulated = list(base_skills)

    for i, step in enumerate(steps):
        state = _state_node(
            accumulated,
            industries,
            node_id=f"state:{i}",
            status="completed",
            depth=i,
        )
        branch = {
            "id": f"branch:{step['skill_id']}|{step['lead_main_category']}|{step['lead_sub_category']}",
            "kind": "branch",
            "status": "completed",
            "skill_id": step["skill_id"],
            "skill_name": step.get("skill_name", ""),
            "title": step.get("skill_name", "Skill"),
            "subtitle": segment_display_label(
                step["lead_main_category"], step["lead_sub_category"]
            ),
            "lead_main_category": step["lead_main_category"],
            "lead_sub_category": step["lead_sub_category"],
            "segment_label": segment_display_label(
                step["lead_main_category"], step["lead_sub_category"]
            ),
            "match_before": step.get("match_before", 0),
            "match_after": step.get("match_after", 0),
            "match_delta": max(
                0,
                step.get("match_after", 0) - step.get("match_before", 0),
            ),
        }
        levels.append({"state": state, "branches": [branch], "chosen_branch_id": branch["id"]})
        accumulated.append(step["skill_id"])

    current_skills = list(skill_ids or [])
    if not current_skills and not steps:
        current_skills = []

    active_state = _state_node(
        current_skills,
        industries,
        node_id="state:current",
        status="active",
        depth=len(steps),
    )
    branches = _generate_branches(current_skills, industries)

    levels.append(
        {
            "state": active_state,
            "branches": branches,
            "chosen_branch_id": None,
        }
    )

    if not levels:
        return None

    best_seg = active_state["top_segments"][0] if active_state.get("top_segments") else None

    return {
        "title": "Mapa rozwoju kariery",
        "subtitle": "Każda gałąź to skill, który realnie podnosi dopasowanie TF-IDF do segmentu rynku",
        "levels": levels,
        "depth": len(levels),
        "best_segment": best_seg,
        "total_skills": len(current_skills),
    }
