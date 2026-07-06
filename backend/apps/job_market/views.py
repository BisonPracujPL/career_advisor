import random
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


class SkillResolveView(APIView):
    """Fill LightCast skill ids for profile entries saved with name only."""

    def post(self, request):
        items = request.data.get("skills") or []
        out = []
        updated = False
        for item in items:
            if not isinstance(item, dict):
                continue
            name = (item.get("name") or "").strip()
            sid = item.get("id")
            if sid:
                out.append(
                    {
                        "id": str(sid),
                        "name": name
                        or Skill.objects.filter(id=sid).values_list("name", flat=True).first()
                        or str(sid),
                        "main_category": item.get("main_category"),
                        "subcategory": item.get("subcategory"),
                    }
                )
                continue
            if not name:
                continue
            row = Skill.objects.filter(is_category=False, name__iexact=name).first()
            if row:
                updated = True
                out.append(
                    {
                        "id": row.id,
                        "name": row.name,
                        "main_category": row.main_category,
                        "subcategory": row.subcategory,
                    }
                )
            else:
                out.append(item)
        return Response({"skills": out, "updated": updated})


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


class OfferCategoriesView(APIView):
    def get(self, request):
        pairs = JobOffer.objects.exclude(lead_main_category="").values_list("lead_main_category", "lead_sub_category").distinct()
        
        tree = {}
        for main, sub in pairs:
            if main not in tree:
                tree[main] = set()
            if sub:
                tree[main].add(sub)
                
        categories = []
        for main in sorted(tree.keys()):
            categories.append({
                "code": main,
                "name": main,
                "subcategories": [{"code": s, "name": s} for s in sorted(tree[main])]
            })
            
        return Response({"categories": categories})


class OfferSubcategoriesView(APIView):
    def get(self, request, main_cat: str):
        subcategories = list(
            JobOffer.objects.filter(lead_main_category=main_cat)
            .exclude(lead_sub_category="")
            .values_list("lead_sub_category", flat=True)
            .distinct()
            .order_by("lead_sub_category")
        )
        return Response(
            {
                "subcategories": [
                    {"code": s, "name": s} for s in subcategories
                ]
            }
        )


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


from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated

from apps.job_market.models import UserProfile
from apps.job_market.validators import validate_user_profile

class RegisterView(APIView):
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        if not username or not password:
            return Response({"detail": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
        
        user = User.objects.create_user(username=username, password=password)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(username=username, password=password)
        if not user:
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key}, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response({"profile_data": profile.profile_data})

    def post(self, request):
        data = request.data
        validation = validate_user_profile(data)
        if not validation["is_valid"]:
            return Response({"detail": validation["error"]}, status=status.HTTP_400_BAD_REQUEST)
        
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        profile.profile_data = data
        profile.save()
        return Response({"detail": "Profile saved successfully.", "profile_data": profile.profile_data})

class SkillRecommendView(APIView):
    def post(self, request):
        current_skills = request.data.get("skills", [])
        
        base_qs = Skill.objects.filter(is_category=False).exclude(name__in=current_skills).order_by("idf_weight")
        
        if current_skills:
            subcats = list(Skill.objects.filter(name__in=current_skills).values_list("subcategory_code", flat=True).distinct())
            pool = list(base_qs.filter(subcategory_code__in=subcats)[:60])
            
            if len(pool) > 15:
                recommended = random.sample(pool, 15)
            else:
                recommended = pool
            
            if len(recommended) < 10:
                needed = 15 - len(recommended)
                exclude_names = current_skills + [s.name for s in recommended]
                extra_pool = list(Skill.objects.filter(is_category=False).exclude(name__in=exclude_names).order_by("idf_weight")[:60])
                if len(extra_pool) > needed:
                    extra = random.sample(extra_pool, needed)
                else:
                    extra = extra_pool
                recommended.extend(extra)
        else:
            pool = list(base_qs[:60])
            recommended = random.sample(pool, 15) if len(pool) > 15 else pool

        data = [
            {
                "id": s.id,
                "name": s.name,
                "main_category": s.main_category,
                "subcategory": s.subcategory,
            }
            for s in recommended
        ]
        return Response({"results": data})


class ChatSuggestionsView(APIView):
    """
    Analyzes chat history and returns the top 4 recommended helper prompts.
    """
    def post(self, request):
        messages = request.data.get("messages", [])
        
        # Take the last 3 messages to understand the recent context
        recent_messages = messages[-3:] if len(messages) >= 3 else messages
        
        # Combine text of recent messages
        context_text = " ".join([m.get("content", "") for m in recent_messages if isinstance(m, dict)])
        
        from apps.job_market.prompt_suggester import get_top_k_prompts, fill_prompt_variables_with_llm
        top_prompts = get_top_k_prompts(context_text, embedding_model, k=4)
        
        profile_data = {}
        if request.user and request.user.is_authenticated:
            try:
                profile = getattr(request.user, "profile", None)
                profile_data = profile.profile_data if profile else {}
            except Exception:
                pass
                
        filled_prompts = fill_prompt_variables_with_llm(top_prompts, profile_data, recent_messages)
        
        return Response({"suggestions": filled_prompts})


def _skill_ids_from_request(request) -> list[str]:
    if request.method == "POST":
        ids = request.data.get("skill_ids")
        if ids:
            return list(ids)
    raw = request.query_params.get("skill_ids", "")
    if raw:
        return [s.strip() for s in raw.split(",") if s.strip()]
    return []


def _segment_filters_from_request(request) -> dict | None:
    data = request.data if request.method == "POST" else request.query_params
    filters: dict = {}
    region = (data.get("region_name") or "").strip()
    if region:
        filters["region_name"] = region
    groups = data.get("position_level_groups")
    if groups:
        filters["position_level_groups"] = list(groups)
    elif request.method == "GET":
        raw_groups = request.query_params.getlist("position_level_groups")
        if raw_groups:
            filters["position_level_groups"] = raw_groups
    return filters or None


def _segment_analytics_response(request, lead_main: str, lead_sub: str):
    from apps.job_market.services.segment_analytics import (
        get_segment_analytics,
        get_segment_sample_offers,
    )

    skill_ids = _skill_ids_from_request(request)
    seg_filters = _segment_filters_from_request(request)
    analytics = get_segment_analytics(
        lead_main, lead_sub, skill_ids or None, filters=seg_filters
    )
    if analytics is None:
        return None
    analytics["sample_offers"] = get_segment_sample_offers(
        lead_main,
        lead_sub,
        skill_ids or None,
        limit=12,
        filters=seg_filters,
    )
    return analytics


class OfferDetailView(APIView):
    """Full job offer detail + LightCast skills and profile overlap."""

    def get(self, request, offer_id: int):
        from apps.job_market.services.offer_detail import get_offer_detail

        skill_ids = _skill_ids_from_request(request)
        detail = get_offer_detail(
            offer_id,
            user_skill_ids=skill_ids if skill_ids else None,
        )
        if detail is None:
            return Response({"detail": "Oferta nie istnieje."}, status=status.HTTP_404_NOT_FOUND)
        return Response(detail)

    def post(self, request, offer_id: int):
        from apps.job_market.services.offer_detail import get_offer_detail

        skill_ids = _skill_ids_from_request(request)
        detail = get_offer_detail(offer_id, user_skill_ids=skill_ids)
        if detail is None:
            return Response({"detail": "Oferta nie istnieje."}, status=status.HTTP_404_NOT_FOUND)
        return Response(detail)


class SegmentAnalyticsView(APIView):
    """Analytics for lead_main × lead_sub segment (skills, salary, seniority from DB)."""

    def get(self, request):
        lead_main = (request.query_params.get("lead_main_category") or "").strip()
        lead_sub = (request.query_params.get("lead_sub_category") or "").strip()
        if not lead_main or not lead_sub:
            return Response(
                {"detail": "Podaj lead_main_category i lead_sub_category."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        analytics = _segment_analytics_response(request, lead_main, lead_sub)
        if analytics is None:
            return Response({"detail": "Brak ofert w tym segmencie."}, status=status.HTTP_404_NOT_FOUND)
        return Response(analytics)

    def post(self, request):
        lead_main = (request.data.get("lead_main_category") or "").strip()
        lead_sub = (request.data.get("lead_sub_category") or "").strip()
        if not lead_main or not lead_sub:
            return Response(
                {"detail": "Podaj lead_main_category i lead_sub_category."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        analytics = _segment_analytics_response(request, lead_main, lead_sub)
        if analytics is None:
            return Response({"detail": "Brak ofert w tym segmencie."}, status=status.HTTP_404_NOT_FOUND)
        return Response(analytics)


class SegmentRankingView(APIView):
    """Rank market segments by fit with the user's skill profile."""

    def post(self, request):
        from apps.job_market.services.segment_ranking import rank_segments_for_profile

        skill_ids = request.data.get("skill_ids") or []
        if not skill_ids:
            return Response(
                {"detail": "Wybierz co najmniej jeden skill."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        limit = min(int(request.data.get("limit", 15)), 30)
        industries = request.data.get("interested_industries")
        segments = rank_segments_for_profile(skill_ids, industries, limit)
        return Response({"segments": segments, "count": len(segments)})


class CareerRoadmapView(APIView):
    """Dynamic TF-IDF skill tree — branches show real match gains toward segments."""

    def post(self, request):
        from apps.job_market.services.career_tree import build_career_tree

        skill_ids = request.data.get("skill_ids") or []
        industries = request.data.get("interested_industries")
        career_path = request.data.get("career_path") or {}
        experience = request.data.get("experience") or []
        tree = build_career_tree(skill_ids, industries, career_path, experience=experience)
        if tree is None:
            return Response(
                {"detail": "Brak danych do wygenerowania ścieżki kariery."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(tree)


class CareerSegmentInsightsView(APIView):
    """Batch salary / level insight for career-path segments (lazy-loaded)."""

    def post(self, request):
        from apps.job_market.services.career_tree import batch_segment_insights

        segments = request.data.get("segments") or []
        if not segments:
            return Response({"insights": {}})
        return Response({"insights": batch_segment_insights(segments)})


class CareerBranchVisionView(APIView):
    """One-shot AI vision + course links for a career tree branch (not the main chat)."""

    def post(self, request):
        from apps.job_market.services.career_branch_vision import generate_branch_vision

        branch = request.data.get("branch")
        if not branch or not isinstance(branch, dict):
            return Response(
                {"error": "branch (object) is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile_data = request.data.get("profile_override")
        if profile_data is None and request.user.is_authenticated:
            profile_data = request.user.profile_data or {}

        segment_insight = request.data.get("segment_insight")
        result = generate_branch_vision(branch, profile_data, segment_insight)
        if result.get("error") and not result.get("content"):
            return Response(result, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)
