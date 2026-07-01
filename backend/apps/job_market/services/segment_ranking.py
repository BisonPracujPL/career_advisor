"""
Segment ranking for career advisor.

Ranks job market segments (lead_main_category / lead_sub_category pairs)
by similarity to a user's skill profile.
"""

from __future__ import annotations

from django.db.models import Count, Q

from apps.job_market.services.matching import match_by_skills
from apps.job_market.services.segment_analytics import _segment_match_score
from apps.job_market.services.pillar_labels import segment_display_label
from apps.job_market.models import JobOffer


def rank_segments_for_profile(
    skill_ids: list[str],
    industries: list[str] | None = None,
    limit: int = 10,
) -> list[dict]:
    """
    Return the top *limit* segments ranked by cosine similarity to *skill_ids*.

    Each result dict contains:
      lead_main_category, lead_sub_category, display_label,
      offer_count, match_pct, avg_similarity_pct
    """
    if not skill_ids:
        return []

    try:
        results = match_by_skills(
            skill_ids,
            limit=200,
            min_similarity=0.0,
        )
    except Exception:
        return []

    # Aggregate by segment
    seg_stats: dict[tuple, dict] = {}
    for r in results:
        key = (r.get("lead_main_category", ""), r.get("lead_sub_category", ""))
        if not key[0] or not key[1]:
            continue
        if key not in seg_stats:
            seg_stats[key] = {
                "lead_main_category": key[0],
                "lead_sub_category": key[1],
                "display_label": segment_display_label(key[0], key[1]),
                "sims": [],
                "offer_count": 0,
            }
        seg_stats[key]["sims"].append(r.get("similarity", 0))
        seg_stats[key]["offer_count"] += 1

    # Score each segment
    ranked = []
    for key, seg in seg_stats.items():
        sims = seg["sims"]
        top_sims = sorted(sims, reverse=True)[:20]
        avg = int(round(100 * sum(top_sims) / len(top_sims))) if top_sims else 0
        ranked.append({
            **seg,
            "match_pct": avg,
            "avg_similarity_pct": avg,
        })

    ranked.sort(key=lambda x: x["match_pct"], reverse=True)

    # Filter by industry if given
    if industries:
        industries_lower = [i.lower() for i in industries]
        filtered = [
            r for r in ranked
            if any(ind in r["lead_main_category"].lower() for ind in industries_lower)
        ]
        if filtered:
            ranked = filtered

    return ranked[:limit]


def top_segment_without_skills(
    industries: list[str] | None = None,
    limit: int = 1,
) -> dict | None:
    """
    Return the largest segment (by offer count) when the user has no skills,
    optionally filtered by industry.
    """
    try:
        qs = (
            JobOffer.objects
            .values("lead_main_category", "lead_sub_category")
            .annotate(offer_count=Count("id"))
            .filter(lead_main_category__gt="", lead_sub_category__gt="")
            .order_by("-offer_count")
        )
        if industries:
            q = Q()
            for ind in industries:
                q |= Q(lead_main_category__icontains=ind)
            qs = qs.filter(q)

        row = qs.first()
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
        }
    except Exception:
        return None
