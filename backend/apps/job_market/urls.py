from django.urls import path

from . import views

urlpatterns = [
    path("skills/search/", views.SkillSearchView.as_view()),
    path("skills/recommend/", views.SkillRecommendView.as_view()),
    path("skills/categories/", views.SkillCategoriesView.as_view()),
    path(
        "skills/categories/<str:main_code>/subcategories/",
        views.SkillSubcategoriesView.as_view(),
    ),
    path("skills/browse/", views.SkillBrowseView.as_view()),
    path("market/pillars/", views.MarketPillarsView.as_view()),
    path(
        "market/pillars/<str:pillar_id>/segments/",
        views.MarketPillarSegmentsView.as_view(),
    ),
    path("filters/options/", views.FilterOptionsView.as_view()),
    path("match/by-skills/", views.MatchBySkillsView.as_view()),
    path("match/similar/", views.MatchSimilarOffersView.as_view()),
    path("offers/search/", views.OfferSearchView.as_view()),
    path("offers/categories/", views.OfferCategoriesView.as_view()),
    path(
        "offers/categories/<str:main_cat>/subcategories/",
        views.OfferSubcategoriesView.as_view(),
    ),
    path("match/candidate-json/", views.MatchCandidateJsonView.as_view()),
    path("auth/register/", views.RegisterView.as_view()),
    path("auth/login/", views.LoginView.as_view()),
    path("profile/", views.UserProfileView.as_view()),
]
