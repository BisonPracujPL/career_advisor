"""Semantic job matching via SentenceTransformer + JobOffer.full_text_embedding."""

from __future__ import annotations

import logging

from django.db.models import Q
from pgvector.django import CosineDistance

from apps.job_market.constants import LEVEL_VALUES_BY_GROUP, PILLAR_IDS
from apps.job_market.models import ExtractedSkills, JobOffer
from apps.job_market.services.matching import explain_overlap

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

_encoder = None


def get_embedding_encoder():
    global _encoder
    if _encoder is None:
        from sentence_transformers import SentenceTransformer

        _encoder = SentenceTransformer(EMBEDDING_MODEL)
        logger.info("Loaded embedding model %s for text matching.", EMBEDDING_MODEL)
    return _encoder


def profile_to_text(profile_data: dict | None) -> str:
    """Turn UserProfile JSON into one paragraph for MiniLM encoding."""
    if not profile_data:
        return "Kandydat bez uzupełnionego profilu."

    parts: list[str] = ["Kandydat na rynek pracy w Polsce."]

    summary = (profile_data.get("_summary") or profile_data.get("summary") or "").strip()
    if summary:
        parts.append(f"Podsumowanie: {summary}.")

    skills = []
    for s in profile_data.get("hard_skills") or []:
        if isinstance(s, dict) and s.get("name"):
            skills.append(str(s["name"]))
    if skills:
        parts.append(f"Kompetencje: {', '.join(skills[:40])}.")

    exp_lines = []
    for e in profile_data.get("experience") or []:
        if not isinstance(e, dict):
            continue
        title = (e.get("job_title") or "").strip()
        company = (e.get("company_name") or "").strip()
        months = e.get("duration_months")
        chunk = title or "stanowisko"
        if company:
            chunk += f" w {company}"
        if months:
            chunk += f" ({months} mies.)"
        exp_lines.append(chunk)
    if exp_lines:
        parts.append(f"Doświadczenie: {'; '.join(exp_lines[:6])}.")

    edu = []
    for ed in profile_data.get("education") or []:
        if not isinstance(ed, dict):
            continue
        field = (ed.get("field_of_study") or "").strip()
        school = (ed.get("university_name") or "").strip()
        if field or school:
            edu.append(f"{field} {school}".strip())
    if edu:
        parts.append(f"Edukacja: {'; '.join(edu[:4])}.")

    industries = profile_data.get("interested_industries") or []
    if industries:
        labels = []
        for item in industries[:8]:
            if isinstance(item, str):
                labels.append(item)
            elif isinstance(item, dict) and item.get("main"):
                labels.append(str(item["main"]))
        if labels:
            parts.append(f"Interesujące branże: {', '.join(labels)}.")

    langs = []
    for lang in profile_data.get("languages") or []:
        if isinstance(lang, dict) and lang.get("name"):
            lvl = lang.get("proficiency_level") or ""
            langs.append(f"{lang['name']} ({lvl})".strip())
    if langs:
        parts.append(f"Języki: {', '.join(langs)}.")

    return " ".join(parts)


def _pillar_q(pillar_id: str) -> Q:
    if pillar_id == "it":
        return Q(lead_main_category__startswith="IT -")
    if pillar_id == "physical":
        return Q(lead_main_category="Praca fizyczna")
    if pillar_id == "sales":
        return Q(lead_main_category="Sprzedaż")
    if pillar_id == "engineering":
        return Q(lead_main_category="Inżynieria")
    return Q()


def _apply_job_offer_filters(qs, filters: dict | None):
    if not filters:
        return qs
    pillar = filters.get("market_pillar")
    if pillar and pillar in PILLAR_IDS:
        qs = qs.filter(_pillar_q(pillar))
    if region := filters.get("region_name"):
        qs = qs.filter(region_name__icontains=region)
    if cat := filters.get("lead_main_category"):
        qs = qs.filter(lead_main_category=cat)
    if sub := filters.get("lead_sub_category"):
        qs = qs.filter(lead_sub_category=sub)
    groups = filters.get("position_level_groups") or []
    if groups:
        level_q = Q()
        for gid in groups:
            for val in LEVEL_VALUES_BY_GROUP.get(gid, []):
                level_q |= Q(position_levels__contains=[val])
        if level_q:
            qs = qs.filter(level_q)
    return qs


def _serialize_semantic_offer(
    offer: JobOffer,
    similarity: float,
    user_skill_ids: list[str] | None = None,
) -> dict:
    pct = int(round(max(0.0, min(1.0, similarity)) * 100))
    row = {
        "offer_id": offer.id,
        "job_title": offer.job_title,
        "region_name": offer.region_name or "",
        "lead_main_category": offer.lead_main_category or "",
        "lead_sub_category": offer.lead_sub_category or "",
        "position_levels": offer.position_levels or [],
        "similarity": round(similarity, 4),
        "similarity_pct": pct,
        "display_pct": pct,
        "role_similarity_pct": pct,
        "match_engine": "semantic",
    }
    if user_skill_ids:
        try:
            es = ExtractedSkills.objects.filter(offer_id=offer.id).first()
            if es and es.skills:
                row["overlap"] = explain_overlap(user_skill_ids, es.skills)
        except Exception:
            pass
    return row


def find_offers_by_embedding(
    query_vector: list[float],
    *,
    filters: dict | None = None,
    limit: int = 20,
    exclude_offer_id: int | None = None,
    user_skill_ids: list[str] | None = None,
) -> list[dict]:
    qs = JobOffer.objects.exclude(full_text_embedding__isnull=True)
    if exclude_offer_id:
        qs = qs.exclude(id=exclude_offer_id)
    qs = _apply_job_offer_filters(qs, filters)
    rows = (
        qs.annotate(distance=CosineDistance("full_text_embedding", query_vector))
        .order_by("distance")[:limit]
    )
    out = []
    for offer in rows:
        if offer.distance is None:
            continue
        dist = float(offer.distance)
        if dist != dist:
            continue
        sim = 1.0 - dist
        out.append(_serialize_semantic_offer(offer, sim, user_skill_ids))
    return out


def match_profile_semantic(
    profile_data: dict,
    *,
    filters: dict | None = None,
    limit: int = 20,
    user_skill_ids: list[str] | None = None,
) -> tuple[str, list[dict]]:
    text = profile_to_text(profile_data)
    vector = get_embedding_encoder().encode(text).tolist()
    offers = find_offers_by_embedding(
        vector,
        filters=filters,
        limit=limit,
        user_skill_ids=user_skill_ids,
    )
    return text, offers


def match_similar_offers_semantic(
    offer_id: int,
    *,
    filters: dict | None = None,
    limit: int = 20,
    user_skill_ids: list[str] | None = None,
) -> tuple[dict | None, list[dict]]:
    offer = (
        JobOffer.objects.filter(id=offer_id)
        .exclude(full_text_embedding__isnull=True)
        .first()
    )
    if not offer or not offer.full_text_embedding:
        return None, []
    seed = {
        "offer_id": offer.id,
        "job_title": offer.job_title,
        "region_name": offer.region_name or "",
        "lead_main_category": offer.lead_main_category or "",
        "lead_sub_category": offer.lead_sub_category or "",
    }
    results = find_offers_by_embedding(
        offer.full_text_embedding,
        filters=filters,
        limit=limit,
        exclude_offer_id=offer.id,
        user_skill_ids=user_skill_ids,
    )
    return seed, results
