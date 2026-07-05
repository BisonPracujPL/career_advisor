"""Dynamic career skill tree — branches are real TF-IDF skill gains toward market segments."""

from __future__ import annotations

from apps.job_market.models import JobOffer, Skill
from apps.job_market.services.pillar_labels import segment_display_label
from apps.job_market.services.segment_analytics import (
    SegmentMatchCache,
    _enrich_skill_pcts,
    _level_snapshot,
    _salary_stats,
    _segment_match_score,
    _top_skills_in_segment,
)
from apps.job_market.services.segment_ranking import (
    rank_segments_for_profile,
    top_segment_without_skills,
)

MAX_BRANCHES = 4
MAX_BUNDLE_BRANCHES = 2
MAX_SINGLE_BRANCHES = 2
TREE_RANK_LIMIT = 8
TREE_MAX_CANDIDATES = 12
RANK_MATCH_LIMIT = 16
SKILLS_PER_SEGMENT = 2
BUNDLE_SIZE = 3
MATCH_TRIAL_LIMIT = 16
INSIGHT_SAMPLE_SIZE = 6000
LEVEL_SALARY_KEYS = ("junior", "mid", "senior")
LEVEL_ORDER = ("junior", "mid", "senior")


def _salary_level_row(snapshot: list[dict], level_id: str) -> dict | None:
    row = next((r for r in snapshot if r.get("level_id") == level_id), None)
    if not row or not row.get("median_salary"):
        return None
    return {
        "level_id": level_id,
        "label": row["level"],
        "median": row["median_salary"],
        "offers": row["offer_count"],
    }


def segment_market_insight(lead_main: str, lead_sub: str) -> dict:
    """Salary / level stats for one segment (sampled for speed)."""
    qs = JobOffer.objects.filter(
        lead_main_category=lead_main,
        lead_sub_category=lead_sub,
    )
    size = qs.count()
    sample_ids = list(qs.values_list("id", flat=True)[:INSIGHT_SAMPLE_SIZE])
    qs_sample = qs.filter(id__in=sample_ids) if sample_ids else qs.none()
    snapshot = _level_snapshot(qs_sample)
    sal_uop = _salary_stats(qs_sample, "uop")
    return {
        "offer_count": size,
        "median_salary_uop": sal_uop["median"] if sal_uop else None,
        "salary_by_level": {
            lid: _salary_level_row(snapshot, lid) for lid in LEVEL_SALARY_KEYS
        },
    }


def batch_segment_insights(segments: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    seen: set[tuple[str, str]] = set()
    for seg in segments:
        lead_main = (seg.get("lead_main_category") or "").strip()
        lead_sub = (seg.get("lead_sub_category") or "").strip()
        if not lead_main or not lead_sub:
            continue
        key_tuple = (lead_main, lead_sub)
        if key_tuple in seen:
            continue
        seen.add(key_tuple)
        cache_key = f"{lead_main}|{lead_sub}"
        out[cache_key] = segment_market_insight(lead_main, lead_sub)
    return out


def _segment_match_pct(
    skill_ids: list[str],
    lead_main: str,
    lead_sub: str,
    filters: dict | None = None,
    match_cache: SegmentMatchCache | None = None,
) -> int:
    match = _segment_match_score(
        skill_ids,
        lead_main,
        lead_sub,
        filters=filters,
        match_limit=MATCH_TRIAL_LIMIT,
        match_cache=match_cache,
    ) or {}
    return int(match.get("avg_similarity_pct", 0))


def _infer_career_level(experience: list | None) -> str:
    total_months = sum(int(e.get("duration_months") or 0) for e in (experience or []))
    if total_months < 24:
        return "junior"
    if total_months < 72:
        return "mid"
    return "senior"


def _next_career_level(level: str) -> str | None:
    try:
        idx = LEVEL_ORDER.index(level)
    except ValueError:
        return None
    if idx >= len(LEVEL_ORDER) - 1:
        return None
    return LEVEL_ORDER[idx + 1]


def _skill_details(skill_ids: list[str]) -> list[dict]:
    if not skill_ids:
        return []
    names = dict(Skill.objects.filter(id__in=skill_ids).values_list("id", "name"))
    return [{"id": sid, "name": names.get(sid, sid)} for sid in skill_ids]


def _rank_for_tree(
    skill_ids: list[str],
    industries: list | None,
    match_cache: SegmentMatchCache,
) -> list[dict]:
    if skill_ids:
        return rank_segments_for_profile(
            skill_ids,
            industries,
            limit=TREE_RANK_LIMIT,
            max_candidates=TREE_MAX_CANDIDATES,
            fast=True,
            match_limit=RANK_MATCH_LIMIT,
            match_cache=match_cache,
            parallel=True,
        )
    fallback = top_segment_without_skills(industries)
    return [fallback] if fallback else []


def _branch_row(
    *,
    skill_ids: list[str],
    seg: dict,
    base_match: int,
    branch_type: str,
    primary_skill: dict,
    extra_skills: list[dict] | None = None,
    match_cache: SegmentMatchCache | None = None,
) -> dict | None:
    lead_main = seg["lead_main_category"]
    lead_sub = seg["lead_sub_category"]
    user_set = set(skill_ids or [])
    bundle_skills = [primary_skill] + list(extra_skills or [])
    bundle_ids = [s["id"] for s in bundle_skills if s["id"] not in user_set]
    if branch_type == "bundle":
        bundle_ids = [s["id"] for s in bundle_skills]
    if not bundle_ids:
        return None

    trial_ids = list(skill_ids or [])
    for sid in bundle_ids:
        if sid not in trial_ids:
            trial_ids.append(sid)

    new_match = _segment_match_pct(
        trial_ids, lead_main, lead_sub, match_cache=match_cache
    )
    delta = new_match - base_match
    if skill_ids and delta <= 0:
        return None

    if branch_type == "bundle":
        names = [s["name"] for s in bundle_skills]
        title = f"Pakiet · {len(bundle_skills)} skille"
        skill_name = " · ".join(names)
        branch_id = f"bundle:{'+'.join(bundle_ids)}|{lead_main}|{lead_sub}"
    else:
        title = primary_skill["name"]
        skill_name = primary_skill["name"]
        branch_id = f"branch:{primary_skill['id']}|{lead_main}|{lead_sub}"

    return {
        "id": branch_id,
        "kind": "branch",
        "branch_type": branch_type,
        "status": "available",
        "skill_id": bundle_ids[0],
        "skill_name": skill_name,
        "skill_ids": bundle_ids,
        "skills": [{"id": s["id"], "name": s["name"]} for s in bundle_skills],
        "title": title,
        "subtitle": segment_display_label(lead_main, lead_sub),
        "lead_main_category": lead_main,
        "lead_sub_category": lead_sub,
        "segment_label": segment_display_label(lead_main, lead_sub),
        "match_before": base_match,
        "match_after": new_match,
        "match_delta": max(delta, 0) if skill_ids else new_match,
        "pct_of_segment": primary_skill.get("pct_of_segment", 0),
    }


def _generate_branches(
    skill_ids: list[str],
    ranked: list[dict],
    match_cache: SegmentMatchCache,
    top_skills_cache: dict[tuple[str, str], list[dict]],
) -> list[dict]:
    user_set = set(skill_ids or [])
    candidates: list[dict] = []

    def top_skills_for(lead_main: str, lead_sub: str, size: int) -> list[dict]:
        key = (lead_main, lead_sub)
        if key not in top_skills_cache:
            top_skills_cache[key] = _enrich_skill_pcts(
                _top_skills_in_segment(lead_main, lead_sub, limit=12),
                size,
            )
        return top_skills_cache[key]

    for seg in ranked[:TREE_RANK_LIMIT]:
        lead_main = seg["lead_main_category"]
        lead_sub = seg["lead_sub_category"]
        size = seg["offer_count"]
        base_match = seg["match_pct"] if skill_ids else 0

        top = top_skills_for(lead_main, lead_sub, size)
        missing = [s for s in top if s["id"] not in user_set]
        if not missing:
            continue

        bundle_pool = missing[:BUNDLE_SIZE]
        if len(bundle_pool) >= 2:
            bundle_row = _branch_row(
                skill_ids=skill_ids,
                seg=seg,
                base_match=base_match,
                branch_type="bundle",
                primary_skill=bundle_pool[0],
                extra_skills=bundle_pool[1:],
                match_cache=match_cache,
            )
            if bundle_row:
                candidates.append(bundle_row)

        for skill in missing[:SKILLS_PER_SEGMENT]:
            single_row = _branch_row(
                skill_ids=skill_ids,
                seg=seg,
                base_match=base_match,
                branch_type="single",
                primary_skill=skill,
                match_cache=match_cache,
            )
            if single_row:
                candidates.append(single_row)

        if len(candidates) >= MAX_BRANCHES * 2:
            break

    candidates.sort(key=lambda x: (-x["match_delta"], -x["match_after"]))

    seen_segments: set[tuple[str, str]] = set()
    seen_keys: set[str] = set()
    branches: list[dict] = []
    bundle_count = 0
    single_count = 0
    for row in candidates:
        seg_key = (row["lead_main_category"], row["lead_sub_category"])
        dedupe_key = f"{row['branch_type']}|{row['id']}"
        if dedupe_key in seen_keys:
            continue
        if row["branch_type"] == "bundle":
            if bundle_count >= MAX_BUNDLE_BRANCHES:
                continue
            bundle_count += 1
        else:
            if single_count >= MAX_SINGLE_BRANCHES:
                continue
            if seg_key in seen_segments:
                continue
            single_count += 1
            seen_segments.add(seg_key)
        seen_keys.add(dedupe_key)
        branches.append(row)
        if len(branches) >= MAX_BRANCHES:
            break

    return branches


def _history_state_node(skill_ids: list[str], depth: int) -> dict:
    return {
        "id": f"state:{depth}",
        "kind": "state",
        "status": "completed",
        "depth": depth,
        "title": f"Etap {depth}" if depth else "Start",
        "subtitle": f"{len(skill_ids)} kompetencji",
        "skill_ids": skill_ids,
        "skills": _skill_details(skill_ids),
        "match_pct": 0,
        "top_segments": [],
    }


def _active_state_node(
    skill_ids: list[str],
    ranked: list[dict],
    depth: int,
) -> dict:
    best = ranked[0] if ranked else None
    return {
        "id": "state:current",
        "kind": "state",
        "status": "active",
        "depth": depth,
        "title": "Twój stan",
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
                "offer_count": s.get("offer_count", 0),
            }
            for s in ranked[:3]
        ],
    }


def _branch_comparison_row(branch: dict) -> dict:
    label = branch["skill_name"]
    if branch.get("branch_type") == "bundle":
        label = f"Pakiet: {branch['skill_name']}"
    return {
        "skill_name": label,
        "branch_type": branch.get("branch_type", "single"),
        "segment_label": branch["segment_label"],
        "match_before": branch["match_before"],
        "match_after": branch["match_after"],
        "match_delta": branch["match_delta"],
        "lead_main_category": branch["lead_main_category"],
        "lead_sub_category": branch["lead_sub_category"],
    }


def _next_level_readiness(
    skill_ids: list[str],
    experience: list | None,
    best_segment: dict | None,
    match_cache: SegmentMatchCache | None = None,
    top_skills_cache: dict[tuple[str, str], list[dict]] | None = None,
) -> dict | None:
    if not best_segment:
        return None

    match_cache = match_cache or SegmentMatchCache()
    top_skills_cache = top_skills_cache if top_skills_cache is not None else {}

    current = _infer_career_level(experience)
    target = _next_career_level(current)
    if not target:
        return None

    lead_main = best_segment["lead_main_category"]
    lead_sub = best_segment["lead_sub_category"]
    level_filter = {"position_level_groups": [target]}

    match_now = int(best_segment.get("match_pct") or 0)
    match_target = _segment_match_pct(
        skill_ids, lead_main, lead_sub, filters=level_filter, match_cache=match_cache
    )

    seg_key = (lead_main, lead_sub)
    if seg_key not in top_skills_cache:
        top_skills_cache[seg_key] = _enrich_skill_pcts(
            _top_skills_in_segment(lead_main, lead_sub, limit=12),
            best_segment.get("offer_count") or 0,
        )
    top = top_skills_cache[seg_key]
    user_set = set(skill_ids or [])
    missing = [s for s in top if s["id"] not in user_set][:BUNDLE_SIZE]
    bundle_ids = [s["id"] for s in missing]
    trial_ids = list(skill_ids or [])
    for sid in bundle_ids:
        if sid not in trial_ids:
            trial_ids.append(sid)

    match_after_bundle = _segment_match_pct(
        trial_ids,
        lead_main,
        lead_sub,
        filters=level_filter,
        match_cache=match_cache,
    )

    return {
        "current_level": current,
        "next_level": target,
        "segment_label": best_segment.get("display_label")
        or segment_display_label(lead_main, lead_sub),
        "lead_main_category": lead_main,
        "lead_sub_category": lead_sub,
        "match_now": match_now,
        "match_target_level": match_target,
        "match_after_bundle": match_after_bundle,
        "bundle_delta": max(0, match_after_bundle - match_target),
        "missing_skills": [{"id": s["id"], "name": s["name"]} for s in missing],
    }


def _career_narrative(
    branches: list[dict],
    steps: list[dict],
    total_skills: int,
    best_segment: dict | None,
) -> dict:
    steps_n = len(steps)
    if not branches:
        if total_skills == 0:
            return {
                "headline": "Zacznij od pierwszego skilla",
                "body": "Wybierz gałąź na mapie — każda pokazuje realny wzrost dopasowania do segmentu rynku.",
                "goal_label": best_segment["display_label"] if best_segment else None,
            }
        return {
            "headline": "Budujesz profil krok po kroku",
            "body": f"Masz {total_skills} kompetencji. Uzupełnij profil lub wybierz kolejną gałąź rozwoju.",
            "goal_label": best_segment["display_label"] if best_segment else None,
        }

    best_branch = max(branches, key=lambda b: b["match_delta"])
    is_bundle = best_branch.get("branch_type") == "bundle"
    rec_label = "pakiet kompetencji" if is_bundle else best_branch["skill_name"]

    if steps_n == 0:
        headline = f"Najbliżej segmentu: {best_segment['display_label'] if best_segment else best_branch['segment_label']}"
    else:
        headline = f"Krok {steps_n + 1} Twojej kariery"

    return {
        "headline": headline,
        "body": (
            f"Największy skok teraz: **{rec_label}** "
            f"(+{best_branch['match_delta']}% dopasowania → {best_branch['segment_label']}). "
            f"{'Pakiet daje wyraźniejszy wzrost niż pojedynczy skill.' if is_bundle else 'Po dodaniu tego skilla drzewo rozwinie się w dół z nowymi opcjami.'}"
        ),
        "goal_label": best_segment["display_label"] if best_segment else best_branch["segment_label"],
        "recommended_skill": best_branch["skill_name"],
        "recommended_delta": best_branch["match_delta"],
    }


def build_career_tree(
    skill_ids: list[str],
    industries: list | None = None,
    career_path: dict | None = None,
    experience: list | None = None,
) -> dict | None:
    career_path = career_path or {}
    steps: list[dict] = list(career_path.get("steps") or [])

    taken_ids = {s["skill_id"] for s in steps}
    base_skills = [s for s in (skill_ids or []) if s not in taken_ids]

    match_cache = SegmentMatchCache()
    top_skills_cache: dict[tuple[str, str], list[dict]] = {}
    ranked = _rank_for_tree(skill_ids or [], industries, match_cache)

    levels: list[dict] = []
    accumulated = list(base_skills)

    for i, step in enumerate(steps):
        state = _history_state_node(accumulated, i)
        step_skill_ids = list(step.get("skill_ids") or [step["skill_id"]])
        step_type = step.get("step_type") or (
            "bundle" if len(step_skill_ids) > 1 else "single"
        )
        step_skill_details = _skill_details(step_skill_ids)
        branch = {
            "id": f"branch:{step_skill_ids[0]}|{step['lead_main_category']}|{step['lead_sub_category']}",
            "kind": "branch",
            "branch_type": step_type,
            "status": "completed",
            "skill_id": step_skill_ids[0],
            "skill_name": step.get("skill_name", ""),
            "skill_ids": step_skill_ids,
            "skills": step_skill_details,
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
        for sid in step_skill_ids:
            if sid not in accumulated:
                accumulated.append(sid)

    current_skills = list(skill_ids or [])
    active_state = _active_state_node(current_skills, ranked, len(steps))
    branches = _generate_branches(
        current_skills, ranked, match_cache, top_skills_cache
    )

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
    if not best_seg and ranked:
        best_seg = {
            "display_label": ranked[0]["display_label"],
            "match_pct": ranked[0]["match_pct"],
            "lead_main_category": ranked[0]["lead_main_category"],
            "lead_sub_category": ranked[0]["lead_sub_category"],
        }

    return {
        "title": "Mapa rozwoju kariery",
        "subtitle": "Wybierz skill — zobacz jak rośnie dopasowanie i gdzie są zarobki Junior / Senior",
        "levels": levels,
        "depth": len(levels),
        "best_segment": best_seg,
        "total_skills": len(current_skills),
        "branch_comparison": [_branch_comparison_row(b) for b in branches],
        "next_level_readiness": _next_level_readiness(
            current_skills,
            experience,
            best_seg,
            match_cache,
            top_skills_cache,
        ),
        "career_narrative": _career_narrative(
            branches, steps, len(current_skills), best_seg
        ),
    }
