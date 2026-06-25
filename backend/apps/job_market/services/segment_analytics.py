"""Market segment analytics from lead_main_category × lead_sub_category + LightCast skills."""

from __future__ import annotations

import numpy as np
from django.db import connection
from django.db.models import Q

from apps.job_market.constants import LEVEL_VALUES_BY_GROUP, POSITION_LEVEL_GROUPS
from apps.job_market.services.pillar_labels import pillar_label_for_lead_main, segment_display_label
from apps.job_market.services.wordcloud_img import build_skills_wordcloud_png
from apps.job_market.models import ExtractedSkills, JobOffer, Skill
from apps.job_market.services import matching


def _apply_segment_filters(qs, filters: dict | None):
    if not filters:
        return qs
    if region := filters.get("region_name"):
        qs = qs.filter(region_name__icontains=region)
    groups = filters.get("position_level_groups") or []
    if groups:
        level_q = Q()
        for gid in groups:
            for val in LEVEL_VALUES_BY_GROUP.get(gid, []):
                level_q |= Q(position_levels__contains=[val])
        if level_q:
            qs = qs.filter(level_q)
    return qs


def _percentiles(values: list[float]) -> dict | None:
    if len(values) < 5:
        return None
    arr = np.array(values, dtype=float)
    return {
        "n": int(len(arr)),
        "median": int(round(float(np.median(arr)))),
        "p25": int(round(float(np.percentile(arr, 25)))),
        "p75": int(round(float(np.percentile(arr, 75)))),
    }


def _top_skills_in_segment(lead_main: str, lead_sub: str, limit: int = 20) -> list[dict]:
    """Top LightCast skills in segment by offer frequency."""
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT elem->>'skill_id' AS skill_id, COUNT(*)::int AS offer_count
            FROM extracted_skills es
            INNER JOIN job_offer_info o ON o.id = es.offer_id
            CROSS JOIN LATERAL jsonb_array_elements(es.skills::jsonb) AS elem
            WHERE o.lead_main_category = %s AND o.lead_sub_category = %s
              AND elem->>'skill_id' IS NOT NULL
            GROUP BY elem->>'skill_id'
            ORDER BY offer_count DESC
            LIMIT %s
            """,
            [lead_main, lead_sub, limit],
        )
        rows = cur.fetchall()
    if not rows:
        return []
    ids = [r[0] for r in rows]
    names = dict(Skill.objects.filter(id__in=ids).values_list("id", "name"))
    return [
        {
            "id": sid,
            "name": names.get(sid, sid),
            "offer_count": cnt,
            "pct_of_segment": 0,
        }
        for sid, cnt in rows
    ]


def _enrich_skill_pcts(skills: list[dict], segment_size: int) -> list[dict]:
    if not segment_size:
        return skills
    for s in skills:
        s["pct_of_segment"] = int(round(100 * s["offer_count"] / segment_size))
    return skills


_GROUP_LABEL = {g["id"]: g["label"] for g in POSITION_LEVEL_GROUPS}
_VALUE_TO_GROUP: dict[str, str] = {}
for _g in POSITION_LEVEL_GROUPS:
    for _v in _g["values"]:
        _VALUE_TO_GROUP[_v.lower().strip()] = _g["id"]

_LEVEL_HINTS: list[tuple[str, str]] = [
    ("młodszy specjalista", "junior"),
    ("junior", "junior"),
    ("starszy specjalista", "senior"),
    ("senior", "senior"),
    ("specjalista", "mid"),
    ("mid", "mid"),
    ("ekspert", "expert"),
    ("kierownik", "lead"),
    ("koordynator", "lead"),
    ("menedżer", "manager"),
    ("dyrektor", "director"),
    ("prezes", "director"),
    ("asystent", "assistant"),
    ("praktykant", "intern"),
    ("stażyst", "intern"),
    ("pracownik fizyczny", "physical"),
]


def _resolve_level_group(raw: str) -> tuple[str, str]:
    key = (raw or "").lower().strip()
    if key in _VALUE_TO_GROUP:
        gid = _VALUE_TO_GROUP[key]
        return gid, _GROUP_LABEL[gid]
    for hint, gid in _LEVEL_HINTS:
        if hint in key and gid in _GROUP_LABEL:
            return gid, _GROUP_LABEL[gid]
    slug = key[:48] or "other"
    return slug, raw or "Inne"


def _match_level_to_groups(level: str, selected_gids: set[str]) -> tuple[str, str] | None:
    gid, label = _resolve_level_group(level)
    if gid in selected_gids:
        return gid, label
    key = (level or "").lower().strip()
    for sg in selected_gids:
        for val in LEVEL_VALUES_BY_GROUP.get(sg, []):
            if val.lower().strip() == key:
                return sg, _GROUP_LABEL[sg]
    return None


def _bucket_for_offer(levels: list, filters: dict | None) -> tuple[str, str] | None:
    if not levels:
        return None
    selected = set((filters or {}).get("position_level_groups") or [])
    if selected:
        for lvl in levels:
            hit = _match_level_to_groups(lvl, selected)
            if hit:
                return hit
        return None
    return _resolve_level_group(levels[0])


def _level_stats(qs, filters: dict | None = None) -> list[dict]:
    """Merged offer counts + median salary per canonical position group."""
    buckets: dict[str, dict] = {}
    total = 0
    selected_gids = set((filters or {}).get("position_level_groups") or [])
    for row in qs.values_list(
        "position_levels",
        "salary_uop_from",
        "salary_uop_to",
        "salary_b2b_from",
        "salary_b2b_to",
    )[:50000]:
        levels, uop_f, uop_t, b2b_f, b2b_t = row
        bucket = _bucket_for_offer(levels or [], filters)
        if not bucket:
            continue
        gid, label = bucket
        if gid not in buckets:
            buckets[gid] = {"level_id": gid, "level": label, "count": 0, "salaries": []}
        buckets[gid]["count"] += 1
        total += 1
        val = None
        if uop_f and float(uop_f) > 0:
            val = (float(uop_f) + float(uop_t or uop_f)) / 2.0
        elif b2b_f and float(b2b_f) > 0:
            val = (float(b2b_f) + float(b2b_t or b2b_f)) / 2.0
        if val and val > 0:
            buckets[gid]["salaries"].append(val)

    out = []
    for b in buckets.values():
        if b["count"] <= 0:
            continue
        salaries = b["salaries"]
        median_salary = None
        salary_n = len(salaries)
        if salaries:
            median_salary = int(
                round(float(np.median(np.array(salaries, dtype=float))))
            )
        out.append(
            {
                "level_id": b["level_id"],
                "level": b["level"],
                "offer_count": b["count"],
                "pct": int(round(100 * b["count"] / total)) if total else 0,
                "median_salary": median_salary,
                "salary_n": salary_n,
            }
        )
    if selected_gids:
        out = [r for r in out if r["level_id"] in selected_gids]
    out.sort(key=lambda x: -x["offer_count"])
    return out


def _seniority_distribution(qs, filters: dict | None = None) -> list[dict]:
    return [
        {"level": r["level"], "count": r["offer_count"], "pct": r["pct"]}
        for r in _level_stats(qs, filters)
    ]


def _salary_by_level(qs, filters: dict | None = None) -> list[dict]:
    return [
        {
            "level": r["level"],
            "n": r["salary_n"],
            "median": r["median_salary"],
            "p25": r["median_salary"],
            "p75": r["median_salary"],
        }
        for r in _level_stats(qs, filters)
        if r["median_salary"] is not None and r["salary_n"] >= 3
    ]


def _level_snapshot(qs, filters: dict | None = None) -> list[dict]:
    return _level_stats(qs, filters)


def _salary_stats(qs, prefix: str) -> dict | None:
    from_field = f"salary_{prefix}_from"
    to_field = f"salary_{prefix}_to"
    values = []
    for row in qs.exclude(**{from_field: None}).values_list(from_field, to_field)[:50000]:
        lo, hi = row
        if lo is None:
            continue
        lo_f = float(lo)
        if lo_f <= 0:
            continue
        hi_f = float(hi) if hi and float(hi) > 0 else lo_f
        values.append((lo_f + hi_f) / 2.0)
    return _percentiles(values)


def _skill_fit(user_skill_ids: list[str], top_skills: list[dict]) -> dict:
    user_set = set(user_skill_ids or [])
    top = top_skills or []
    if not top:
        return {"have": [], "missing": [], "coverage_pct": 0}
    have, missing = [], []
    for s in top:
        if s["id"] in user_set:
            have.append(s)
        else:
            missing.append(s)
    cov = int(round(100 * len(have) / len(top))) if top else 0
    return {"have": have, "missing": missing, "coverage_pct": cov}


def _segment_match_score(
    skill_ids: list[str], lead_main: str, lead_sub: str, filters: dict | None = None
) -> dict | None:
    if not skill_ids:
        return None
    seg_filters = {
        "lead_main_category": lead_main,
        "lead_sub_category": lead_sub,
        **(filters or {}),
    }
    results = matching.match_by_skills(
        skill_ids,
        limit=60,
        min_similarity=0,
        filters=seg_filters,
    )
    if not results:
        return {"matching_offers": 0, "avg_similarity_pct": 0}
    sims = [r["similarity_pct"] for r in results]
    top = sorted(sims, reverse=True)[:20]
    return {
        "matching_offers": len(results),
        "avg_similarity_pct": int(round(sum(top) / len(top))),
    }


def get_segment_analytics(
    lead_main: str,
    lead_sub: str,
    user_skill_ids: list[str] | None = None,
    filters: dict | None = None,
) -> dict | None:
    if not lead_main or not lead_sub:
        return None
    qs = _apply_segment_filters(
        JobOffer.objects.filter(
            lead_main_category=lead_main,
            lead_sub_category=lead_sub,
        ),
        filters,
    )
    size = qs.count()
    if size == 0:
        return None

    top_skills = _enrich_skill_pcts(_top_skills_in_segment(lead_main, lead_sub), size)
    skill_fit = _skill_fit(user_skill_ids or [], top_skills)
    match_score = _segment_match_score(
        user_skill_ids or [], lead_main, lead_sub, filters
    )

    return {
        "lead_main_category": lead_main,
        "lead_sub_category": lead_sub,
        "pillar_label": pillar_label_for_lead_main(lead_main),
        "label": lead_sub,
        "display_label": segment_display_label(lead_main, lead_sub),
        "offer_count": size,
        "top_skills": top_skills,
        "skills_wordcloud_png": build_skills_wordcloud_png(top_skills),
        "seniority_distribution": _seniority_distribution(qs, filters),
        "salary_by_level": _salary_by_level(qs, filters),
        "level_snapshot": _level_snapshot(qs, filters),
        "salary_uop_monthly": _salary_stats(
            qs.filter(salary_uop_duration__icontains="mies"),
            "uop",
        ),
        "salary_b2b_monthly": _salary_stats(
            qs.filter(salary_b2b_duration__icontains="mies"),
            "b2b",
        ),
        "skill_fit": skill_fit,
        "match_score": match_score,
        "filters_applied": filters or {},
    }


def get_segment_sample_offers(
    lead_main: str,
    lead_sub: str,
    user_skill_ids: list[str] | None = None,
    limit: int = 12,
    filters: dict | None = None,
) -> list[dict]:
    seg_filters = {
        "lead_main_category": lead_main,
        "lead_sub_category": lead_sub,
        **(filters or {}),
    }
    if user_skill_ids:
        return matching.match_by_skills(
            user_skill_ids,
            limit=limit,
            filters=seg_filters,
        )
    offer_qs = _apply_segment_filters(
        JobOffer.objects.filter(
            lead_main_category=lead_main,
            lead_sub_category=lead_sub,
        ),
        filters,
    )
    rows = list(
        ExtractedSkills.objects.filter(
            offer__in=offer_qs,
            skill_vector__isnull=False,
        )
        .select_related("offer")
        .order_by("-offer__start_date")[: limit * 3]
    )
    scored = sorted(rows, key=lambda es: len(es.skills or []), reverse=True)[:limit]
    out = []
    for es in scored:
        o = es.offer
        out.append(
            {
                "offer_id": o.id,
                "job_title": o.job_title,
                "region_name": o.region_name or "",
                "lead_main_category": o.lead_main_category or "",
                "lead_sub_category": o.lead_sub_category or "",
                "similarity_pct": None,
                "display_pct": None,
                "skill_count": len(es.skills or []),
            }
        )
    return out
