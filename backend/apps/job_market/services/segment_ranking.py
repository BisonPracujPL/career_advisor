"""Rank market segments (lead_main × lead_sub) for a user skill profile."""

from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor

from django.db import close_old_connections
from django.db.models import Count, Q

from apps.job_market.models import JobOffer
from apps.job_market.services.pillar_labels import segment_display_label
from apps.job_market.services.segment_analytics import (
    SegmentMatchCache,
    _enrich_skill_pcts,
    _salary_stats,
    _segment_match_score,
    _skill_fit,
    _top_skills_in_segment,
)

SCORE_WORKERS = min(8, max(2, (os.cpu_count() or 4)))

MIN_SEGMENT_SIZE = 25
MAX_CANDIDATES = 80


def _industry_filter_q(industries: list | None) -> Q:
    if not industries:
        return Q()
    q = Q()
    for item in industries:
        if isinstance(item, str):
            if item.strip():
                q |= Q(lead_main_category=item.strip())
            continue
        if not isinstance(item, dict):
            continue
        main = (item.get("main") or "").strip()
        if not main:
            continue
        subs = item.get("subs") or []
        if "__ALL__" in subs or not subs:
            q |= Q(lead_main_category=main)
        else:
            for sub in subs:
                if sub and sub != "__ALL__":
                    q |= Q(lead_main_category=main, lead_sub_category=sub)
    return q


def top_segment_without_skills(industries: list | None = None) -> dict | None:
    base = JobOffer.objects.exclude(lead_sub_category="")
    iq = _industry_filter_q(industries)
    if iq:
        base = base.filter(iq)
    row = (
        base.values("lead_main_category", "lead_sub_category")
        .annotate(offer_count=Count("id"))
        .filter(offer_count__gte=MIN_SEGMENT_SIZE)
        .order_by("-offer_count")
        .first()
    )
    if not row:
        return None
    return {
        "lead_main_category": row["lead_main_category"],
        "lead_sub_category": row["lead_sub_category"],
        "display_label": segment_display_label(
            row["lead_main_category"], row["lead_sub_category"]
        ),
        "offer_count": row["offer_count"],
        "match_pct": 0,
        "skill_coverage_pct": 0,
        "top_missing_skills": [],
        "median_salary_uop": None,
    }


def _score_segment_candidate(
    row: dict,
    skill_ids: list[str],
    *,
    fast: bool,
    match_limit: int,
    match_cache: SegmentMatchCache | None,
) -> dict:
    close_old_connections()
    lead_main = row["lead_main_category"]
    lead_sub = row["lead_sub_category"]
    size = row["offer_count"]
    match = (
        _segment_match_score(
            skill_ids,
            lead_main,
            lead_sub,
            match_limit=match_limit,
            match_cache=match_cache,
        )
        or {}
    )
    entry = {
        "lead_main_category": lead_main,
        "lead_sub_category": lead_sub,
        "display_label": segment_display_label(lead_main, lead_sub),
        "offer_count": size,
        "match_pct": match.get("avg_similarity_pct", 0),
    }
    if not fast:
        top_skills = _enrich_skill_pcts(_top_skills_in_segment(lead_main, lead_sub), size)
        fit = _skill_fit(skill_ids, top_skills)
        qs = JobOffer.objects.filter(
            lead_main_category=lead_main,
            lead_sub_category=lead_sub,
        )
        sal_uop = _salary_stats(qs.filter(salary_uop_duration__icontains="mies"), "uop")
        entry["skill_coverage_pct"] = fit["coverage_pct"]
        entry["top_missing_skills"] = fit["missing"][:5]
        entry["median_salary_uop"] = sal_uop["median"] if sal_uop else None
    else:
        entry["skill_coverage_pct"] = 0
        entry["top_missing_skills"] = []
        entry["median_salary_uop"] = None
    return entry


def rank_segments_for_profile(
    skill_ids: list[str],
    industries: list | None = None,
    limit: int = 15,
    max_candidates: int = MAX_CANDIDATES,
    fast: bool = False,
    match_limit: int = 60,
    match_cache: SegmentMatchCache | None = None,
    parallel: bool = False,
) -> list[dict]:
    if not skill_ids:
        return []

    base = JobOffer.objects.exclude(lead_sub_category="")
    iq = _industry_filter_q(industries)
    if iq:
        base = base.filter(iq)

    candidates = list(
        base.values("lead_main_category", "lead_sub_category")
        .annotate(offer_count=Count("id"))
        .filter(offer_count__gte=MIN_SEGMENT_SIZE)
        .order_by("-offer_count")[:max_candidates]
    )

    if parallel and len(candidates) > 1:
        workers = min(SCORE_WORKERS, len(candidates))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            ranked = list(
                pool.map(
                    lambda row: _score_segment_candidate(
                        row,
                        skill_ids,
                        fast=fast,
                        match_limit=match_limit,
                        match_cache=match_cache,
                    ),
                    candidates,
                )
            )
    else:
        ranked = [
            _score_segment_candidate(
                row,
                skill_ids,
                fast=fast,
                match_limit=match_limit,
                match_cache=match_cache,
            )
            for row in candidates
        ]

    ranked.sort(
        key=lambda x: (
            -x["match_pct"],
            -x.get("skill_coverage_pct", 0),
            -x["offer_count"],
        )
    )
    return ranked[: min(limit, 30)]
