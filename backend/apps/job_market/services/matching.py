"""Skill-vector matching: user profile or seed offer → similar job offers."""

from __future__ import annotations

from django.db.models import Max, Q

from pgvector.django import CosineDistance

from apps.job_market.constants import LEVEL_VALUES_BY_GROUP, PILLAR_IDS
from apps.job_market.models import ExtractedSkills, JobOffer, Skill
from apps.job_market.vectors import build_skill_vector, skill_index_map


def vector_dimension() -> int:
    m = Skill.objects.aggregate(m=Max("vector_index"))["m"]
    return (m + 1) if m is not None else 0


def build_profile_vector(skill_ids: list[str]):
    """Sparse user profile from selected LightCast skill ids (binary weights)."""
    index_map = skill_index_map()
    dim = len(index_map)
    if not dim or not skill_ids:
        return None
    skills = [{"skill_id": sid, "probability": 1.0} for sid in skill_ids]
    return build_skill_vector(skills, index_map, dim, value="binary")


def _pillar_q(pillar_id: str) -> Q:
    if pillar_id == "it":
        return Q(offer__lead_main_category__startswith="IT -")
    if pillar_id == "physical":
        return Q(offer__lead_main_category="Praca fizyczna")
    if pillar_id == "sales":
        return Q(offer__lead_main_category="Sprzedaż")
    if pillar_id == "engineering":
        return Q(offer__lead_main_category="Inżynieria")
    return Q()


def _apply_offer_filters(qs, filters: dict | None):
    if not filters:
        return qs
    pillar = filters.get("market_pillar")
    if pillar and pillar in PILLAR_IDS:
        qs = qs.filter(_pillar_q(pillar))
    if region := filters.get("region_name"):
        qs = qs.filter(offer__region_name__icontains=region)
    if cat := filters.get("lead_main_category"):
        qs = qs.filter(offer__lead_main_category=cat)
    if sub := filters.get("lead_sub_category"):
        qs = qs.filter(offer__lead_sub_category=sub)
    level_groups = filters.get("position_level_groups") or []
    if level_groups:
        level_q = Q()
        for gid in level_groups:
            for val in LEVEL_VALUES_BY_GROUP.get(gid, []):
                level_q |= Q(offer__position_levels__contains=[val])
        if level_q:
            qs = qs.filter(level_q)
    return qs


def _skill_names_map(skill_ids: set[str]) -> dict[str, str]:
    if not skill_ids:
        return {}
    return dict(Skill.objects.filter(id__in=skill_ids).values_list("id", "name"))


def _skill_ids_in_vector(skill_ids: list[str], index_map: dict[str, int]) -> set[str]:
    """Skills that actually contribute to the sparse vector (have vector_index)."""
    return {sid for sid in skill_ids if sid in index_map}


def explain_overlap(user_skill_ids: list[str], offer_skills: list) -> dict:
    index_map = skill_index_map()
    user_set = _skill_ids_in_vector(user_skill_ids, index_map)
    offer_set = _skill_ids_in_vector(
        [s["skill_id"] for s in (offer_skills or [])], index_map
    )
    matched_ids = user_set & offer_set
    missing_ids = offer_set - user_set
    names = _skill_names_map(matched_ids | missing_ids)
    matched = len(matched_ids)
    u_cnt = len(user_set)
    o_cnt = len(offer_set)
    union = len(user_set | offer_set)
    offer_cov = (matched / o_cnt) if o_cnt else 0.0
    profile_cov = (matched / u_cnt) if u_cnt else 0.0
    jaccard = (matched / union) if union else 0.0
    # Same formula as pgvector cosine for binary 0/1 vectors over indexed skills.
    cosine_est = (
        matched / ((u_cnt * o_cnt) ** 0.5) if u_cnt and o_cnt and matched else 0.0
    )
    return {
        "matched_count": matched,
        "profile_skill_count": u_cnt,
        "offer_skill_count": o_cnt,
        "offer_coverage_pct": int(round(offer_cov * 100)),
        "profile_coverage_pct": int(round(profile_cov * 100)),
        "jaccard_pct": int(round(jaccard * 100)),
        "cosine_estimate_pct": int(round(cosine_est * 100)),
        "matched_skills": [
            {"id": sid, "name": names.get(sid, sid)} for sid in sorted(matched_ids)
        ],
        "missing_skills": [
            {"id": sid, "name": names.get(sid, sid)} for sid in sorted(missing_ids)
        ],
    }


def serialize_offer_row(es: ExtractedSkills, similarity: float, user_skill_ids: list[str] | None):
    offer = es.offer
    overlap = (
        explain_overlap(user_skill_ids, es.skills)
        if user_skill_ids is not None
        else None
    )
    return {
        "offer_id": offer.id,
        "job_title": offer.job_title,
        "region_name": offer.region_name or "",
        "lead_main_category": offer.lead_main_category or "",
        "lead_sub_category": offer.lead_sub_category or "",
        "position_levels": offer.position_levels or [],
        "similarity": round(similarity, 4),
        "similarity_pct": int(round(similarity * 100)),
        # Intuitive % for UI: share of offer requirements met (not cosine).
        "display_pct": (
            overlap["offer_coverage_pct"]
            if overlap is not None
            else int(round(similarity * 100))
        ),
        "overlap": overlap,
    }


def find_similar_offers(
    query_vector,
    *,
    limit: int = 20,
    min_similarity: float = 0.0,
    filters: dict | None = None,
    exclude_offer_id: int | None = None,
    user_skill_ids: list[str] | None = None,
):
    if query_vector is None:
        return []

    qs = (
        ExtractedSkills.objects.exclude(skill_vector__isnull=True)
        .select_related("offer")
        .annotate(distance=CosineDistance("skill_vector", query_vector))
    )
    if exclude_offer_id:
        qs = qs.exclude(offer_id=exclude_offer_id)
    qs = _apply_offer_filters(qs, filters)

    # Pull top candidates in SQL (cosine distance), then apply min_similarity.
    candidates = list(qs.order_by("distance")[: max(limit * 8, 50)])
    results = []
    for es in candidates:
        sim = 1.0 - float(es.distance)
        if sim < min_similarity:
            continue
        results.append(serialize_offer_row(es, sim, user_skill_ids))
        if len(results) >= limit:
            break
    return results


def match_by_skills(skill_ids: list[str], **kwargs):
    vec = build_profile_vector(skill_ids)
    return find_similar_offers(vec, user_skill_ids=skill_ids, **kwargs)


def match_by_offer_id(offer_id: int, **kwargs):
    try:
        es = ExtractedSkills.objects.select_related("offer").get(
            offer_id=offer_id, skill_vector__isnull=False
        )
    except ExtractedSkills.DoesNotExist:
        return None, []
    kwargs.setdefault("exclude_offer_id", offer_id)
    seed_skill_ids = [s["skill_id"] for s in (es.skills or [])]
    rows = find_similar_offers(
        es.skill_vector, user_skill_ids=seed_skill_ids, **kwargs
    )
    seed = {
        "offer_id": es.offer.id,
        "job_title": es.offer.job_title,
        "region_name": es.offer.region_name or "",
        "lead_main_category": es.offer.lead_main_category or "",
    }
    return seed, rows


def search_offers_by_title(q: str, limit: int = 15):
    if not q or len(q.strip()) < 2:
        return []
    qs = (
        JobOffer.objects.filter(job_title__icontains=q.strip())
        .filter(extracted__skill_vector__isnull=False)
        .select_related("extracted")[:limit]
    )
    return [
        {
            "offer_id": o.id,
            "job_title": o.job_title,
            "region_name": o.region_name or "",
            "lead_main_category": o.lead_main_category or "",
            "skill_count": len(o.extracted.skills or []),
        }
        for o in qs
    ]
