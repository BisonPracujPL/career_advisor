from django.db.models import Count
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from pgvector.django import CosineDistance
from sentence_transformers import SentenceTransformer

from apps.job_market.constants import MARKET_PILLARS, PILLAR_IDS, POSITION_LEVEL_GROUPS
from apps.job_market.models import JobOffer, Skill
from apps.job_market.services import matching


class SkillSearchView(APIView):
    """Autocomplete skills by English name."""

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        limit = min(int(request.query_params.get("limit", 20)), 50)
        if len(q) < 2:
            return Response({"results": []})
        skills = Skill.objects.filter(is_category=False, name__icontains=q).order_by(
            "name"
        )[:limit]
        return Response(
            {
                "results": [
                    {
                        "id": s.id,
                        "name": s.name,
                        "main_category": s.main_category,
                        "subcategory": s.subcategory,
                    }
                    for s in skills
                ]
            }
        )


class SkillCategoriesView(APIView):
    """Main LightCast categories for browse UI."""

    def get(self, request):
        rows = (
            Skill.objects.filter(is_category=False)
            .exclude(main_category_code="")
            .values("main_category_code", "main_category")
            .annotate(skill_count=Count("id"))
            .order_by("main_category")
        )
        return Response(
            {
                "categories": [
                    {
                        "code": r["main_category_code"],
                        "name": r["main_category"],
                        "skill_count": r["skill_count"],
                    }
                    for r in rows
                ]
            }
        )


class SkillSubcategoriesView(APIView):
    def get(self, request, main_code: str):
        rows = (
            Skill.objects.filter(is_category=False, main_category_code=main_code)
            .exclude(subcategory_code="")
            .values("subcategory_code", "subcategory")
            .annotate(skill_count=Count("id"))
            .order_by("subcategory")
        )
        return Response(
            {
                "main_category_code": main_code,
                "subcategories": [
                    {
                        "code": r["subcategory_code"],
                        "name": r["subcategory"],
                        "skill_count": r["skill_count"],
                    }
                    for r in rows
                ],
            }
        )


class SkillBrowseView(APIView):
    def get(self, request):
        main_code = request.query_params.get("main_category_code")
        sub_code = request.query_params.get("subcategory_code")
        limit = min(int(request.query_params.get("limit", 40)), 100)
        qs = Skill.objects.filter(is_category=False)
        if main_code:
            qs = qs.filter(main_category_code=main_code)
        if sub_code:
            qs = qs.filter(subcategory_code=sub_code)
        skills = qs.order_by("name")[:limit]
        return Response(
            {
                "results": [
                    {
                        "id": s.id,
                        "name": s.name,
                        "main_category": s.main_category,
                        "subcategory": s.subcategory,
                    }
                    for s in skills
                ]
            }
        )


class MarketPillarsView(APIView):
    """Four pracuj.pl-style market areas with offer counts."""

    def get(self, request):
        pillars = []
        for p in MARKET_PILLARS:
            qs = JobOffer.objects.all()
            if p["id"] == "it":
                count = qs.filter(lead_main_category__startswith="IT -").count()
            else:
                main = p["lead_main_exact"][0]
                count = qs.filter(lead_main_category=main).count()
            pillars.append(
                {
                    "id": p["id"],
                    "label": p["label"],
                    "description": p.get("description", ""),
                    "offer_count": count,
                }
            )
        return Response({"pillars": pillars})


class MarketPillarSegmentsView(APIView):
    """lead_main + lead_sub segments inside one pillar (drill-down)."""

    def get(self, request, pillar_id: str):
        if pillar_id not in PILLAR_IDS:
            return Response({"detail": "Nieznany obszar rynku."}, status=404)
        qs = JobOffer.objects.exclude(lead_sub_category="")
        if pillar_id == "it":
            qs = qs.filter(lead_main_category__startswith="IT -")
        elif pillar_id == "physical":
            qs = qs.filter(lead_main_category="Praca fizyczna")
        elif pillar_id == "sales":
            qs = qs.filter(lead_main_category="Sprzedaż")
        else:
            qs = qs.filter(lead_main_category="Inżynieria")
        rows = (
            qs.values("lead_main_category", "lead_sub_category")
            .annotate(offer_count=Count("id"))
            .order_by("-offer_count")[:50]
        )
        return Response(
            {
                "pillar_id": pillar_id,
                "segments": [
                    {
                        "lead_main_category": r["lead_main_category"],
                        "lead_sub_category": r["lead_sub_category"],
                        "offer_count": r["offer_count"],
                        "label": f"{r['lead_sub_category']}",
                        "group_label": r["lead_main_category"],
                    }
                    for r in rows
                ],
            }
        )


class FilterOptionsView(APIView):
    def get(self, request):
        categories = list(
            JobOffer.objects.exclude(lead_main_category="")
            .values_list("lead_main_category", flat=True)
            .distinct()
            .order_by("lead_main_category")[:80]
        )
        regions = list(
            JobOffer.objects.exclude(region_name="")
            .values_list("region_name", flat=True)
            .distinct()
            .order_by("region_name")[:40]
        )
        return Response(
            {
                "market_pillars": MARKET_PILLARS,
                "position_level_groups": POSITION_LEVEL_GROUPS,
                "regions": regions,
                "lead_main_categories": categories,
            }
        )


class MatchBySkillsView(APIView):
    def post(self, request):
        skill_ids = request.data.get("skill_ids") or []
        if not skill_ids:
            return Response(
                {"detail": "Wybierz co najmniej jeden skill."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        filters = request.data.get("filters") or {}
        limit = min(int(request.data.get("limit", 20)), 50)
        min_sim = float(request.data.get("min_similarity", 0.0))
        results = matching.match_by_skills(
            skill_ids,
            limit=limit,
            min_similarity=min_sim,
            filters=filters,
        )
        return Response(
            {
                "mode": "skills",
                "skill_ids": skill_ids,
                "count": len(results),
                "offers": results,
            }
        )


class MatchSimilarOffersView(APIView):
    def get(self, request):
        try:
            offer_id = int(request.query_params["offer_id"])
        except (KeyError, TypeError, ValueError):
            return Response(
                {"detail": "Parametr offer_id jest wymagany."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        filters = {}
        if request.query_params.get("market_pillar"):
            filters["market_pillar"] = request.query_params["market_pillar"]
        if request.query_params.get("region_name"):
            filters["region_name"] = request.query_params["region_name"]
        if request.query_params.get("lead_main_category"):
            filters["lead_main_category"] = request.query_params["lead_main_category"]
        if request.query_params.get("lead_sub_category"):
            filters["lead_sub_category"] = request.query_params["lead_sub_category"]
        groups = request.query_params.getlist("position_level_groups")
        if groups:
            filters["position_level_groups"] = groups
        limit = min(int(request.query_params.get("limit", 20)), 50)
        min_sim = float(request.query_params.get("min_similarity", 0.0))
        seed, results = matching.match_by_offer_id(
            offer_id,
            limit=limit,
            min_similarity=min_sim,
            filters=filters or None,
        )
        if seed is None:
            return Response(
                {"detail": "Oferta nie istnieje lub nie ma wektora skilli."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {
                "mode": "offer",
                "seed": seed,
                "count": len(results),
                "offers": results,
            }
        )


class OfferSearchView(APIView):
    def get(self, request):
        q = request.query_params.get("q", "")
        limit = min(int(request.query_params.get("limit", 15)), 30)
        return Response({"results": matching.search_offers_by_title(q, limit=limit)})


embedding_model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")


class MatchCandidateJsonView(APIView):
    """
    Przyjmuje JSON kandydata (np. CV), wektoryzuje go i znajduje
    najlepiej dopasowane całe oferty pracy po wektorze pełnego tekstu.
    """

    def post(self, request):
        candidate_json = request.data

        # 1. Zabezpieczenie przed pustym requestem
        if not candidate_json:
            return Response(
                {"detail": "Nie podano JSONa kandydata."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Sklejenie wartości JSONa (Doświadczenie, skille, opis) w jeden tekst
        # Możesz to dostosować pod konkretne klucze, jakie mają te JSONy.
        skills = ", ".join(candidate_json.get("skills", []))
        experience = candidate_json.get("experience", "")
        summary = candidate_json.get("summary", "")

        candidate_text = (
            f"Kandydat. Podsumowanie: {summary}. "
            f"Doświadczenie: {experience}. "
            f"Umiejętności: {skills}."
        )

        # 3. Zamiana tekstu kandydata na gęsty wektor (embedding)
        candidate_vector = embedding_model.encode(candidate_text).tolist()

        # 4. Znajdowanie podobieństwa w bazie PostgreSQL używając pgvector
        limit = int(request.query_params.get("limit", 10))

        # CosineDistance zwraca odległość (im mniejsza tym lepsza).
        # Cosine Similarity to 1 - CosineDistance.
        similar_offers = (
            JobOffer.objects.exclude(full_text_embedding__isnull=True)
            .annotate(distance=CosineDistance("full_text_embedding", candidate_vector))
            .order_by("distance")[:limit]
        )

        # 5. Przygotowanie wyników
        results = []
        for offer in similar_offers:
            similarity = 1.0 - float(
                offer.distance
            )  # Zmiana z odległości na % podobieństwa
            results.append(
                {
                    "id": offer.id,
                    "job_title": offer.job_title,
                    "lead_main_category": offer.lead_main_category,
                    "similarity_score": round(
                        similarity, 3
                    ),  # Wynik np. 0.852 (czyli ~85%)
                }
            )

        return Response(
            {
                "mode": "json_full_text_matching",
                "candidate_text_used": candidate_text,
                "count": len(results),
                "offers": results,
            }
        )
