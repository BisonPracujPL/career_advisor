"""Single job offer detail for drill-down UI."""

from __future__ import annotations

from apps.job_market.models import ExtractedSkills, JobOffer, Skill
from apps.job_market.services.matching import (
    explain_overlap,
    match_by_offer_id,
    profile_offer_similarity,
)
from apps.job_market.services.pillar_labels import pillar_label_for_lead_main, segment_display_label


def _salary_block(offer: JobOffer, prefix: str) -> dict | None:
    from_f = getattr(offer, f"salary_{prefix}_from")
    to_f = getattr(offer, f"salary_{prefix}_to")
    if from_f is None and to_f is None:
        return None
    if from_f is not None and float(from_f) <= 0 and (to_f is None or float(to_f) <= 0):
        return None
    return {
        "from": int(float(from_f)) if from_f else None,
        "to": int(float(to_f)) if to_f else None,
        "currency": getattr(offer, f"salary_{prefix}_currency") or "PLN",
        "duration": getattr(offer, f"salary_{prefix}_duration") or "",
        "kind": getattr(offer, f"salary_{prefix}_kind") or "",
    }


def _skill_rows(raw_skills: list) -> list[dict]:
    ids = [s["skill_id"] for s in (raw_skills or []) if s.get("skill_id")]
    names = dict(Skill.objects.filter(id__in=ids).values_list("id", "name"))
    rows = []
    for s in raw_skills or []:
        sid = s.get("skill_id")
        if not sid:
            continue
        rows.append(
            {
                "id": sid,
                "name": names.get(sid, sid),
                "probability": round(float(s.get("probability") or 0), 3),
            }
        )
    rows.sort(key=lambda r: -r["probability"])
    return rows


def get_offer_detail(offer_id: int, user_skill_ids: list[str] | None = None) -> dict | None:
    try:
        offer = JobOffer.objects.get(pk=offer_id)
        es = ExtractedSkills.objects.get(offer_id=offer_id)
    except (JobOffer.DoesNotExist, ExtractedSkills.DoesNotExist):
        return None

    skills = _skill_rows(es.skills)
    overlap = (
        explain_overlap(user_skill_ids or [], es.skills)
        if user_skill_ids
        else None
    )
    similarity_pct = (
        profile_offer_similarity(offer_id, user_skill_ids) if user_skill_ids else None
    )
    similar_offers = []
    if offer.lead_main_category and offer.lead_sub_category:
        _, similar_offers = match_by_offer_id(
            offer_id,
            limit=48,
            min_similarity=0,
            user_skill_ids=user_skill_ids or None,
            filters={
                "lead_main_category": offer.lead_main_category,
                "lead_sub_category": offer.lead_sub_category,
            },
        ) or (None, [])
        similar_offers.sort(
            key=lambda o: (
                o.get("display_pct") or 0,
                o.get("role_similarity_pct") or 0,
            ),
            reverse=True,
        )
        similar_offers = similar_offers[:12]

    return {
        "offer_id": offer.id,
        "job_title": offer.job_title,
        "lead_main_category": offer.lead_main_category or "",
        "lead_sub_category": offer.lead_sub_category or "",
        "pillar_label": pillar_label_for_lead_main(offer.lead_main_category or ""),
        "segment_display_label": segment_display_label(
            offer.lead_main_category or "", offer.lead_sub_category or ""
        ),
        "region_name": offer.region_name or "",
        "country_name": offer.country_name or "",
        "work_modes": offer.work_modes or [],
        "work_schedules": offer.work_schedules or [],
        "position_levels": offer.position_levels or [],
        "type_of_contract": offer.type_of_contract or [],
        "keywords": offer.keywords or [],
        "is_remote_work": offer.is_remote_work,
        "salary_uop": _salary_block(offer, "uop"),
        "salary_b2b": _salary_block(offer, "b2b"),
        "requirements_expected": offer.requirements_expected or "",
        "requirements_optional": offer.requirements_optional or "",
        "responsibilities": offer.responsibilities or "",
        "technologies_expected": offer.technologies_expected or "",
        "skills": skills,
        "overlap": overlap,
        "similarity_pct": similarity_pct,
        "similar_offers": similar_offers,
        "segment": {
            "lead_main_category": offer.lead_main_category or "",
            "lead_sub_category": offer.lead_sub_category or "",
        },
    }
