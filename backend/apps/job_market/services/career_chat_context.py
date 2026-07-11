"""Lightweight market + career context for AI chat (no full tree build)."""

from __future__ import annotations

import json

# ── Lazy imports from heavier modules — fail gracefully ──────────────────────
try:
    from apps.job_market.services.career_tree import (
        _infer_career_level,
        _next_career_level,
        _next_level_readiness,
    )
except Exception:
    def _infer_career_level(experience): return "mid"
    def _next_career_level(level): return None
    def _next_level_readiness(*a, **kw): return None

try:
    from apps.job_market.services.segment_analytics import (
        _enrich_skill_pcts,
        _level_stats,
        _salary_stats,
        _top_skills_in_segment,
        get_segment_analytics,
    )
    from apps.job_market.services.pillar_labels import pillar_label_for_lead_main
except Exception:
    def _top_skills_in_segment(*a, **kw): return []
    def _enrich_skill_pcts(skills, size): return skills
    def get_segment_analytics(*a, **kw): return None
    def _salary_stats(*a, **kw): return None
    def _level_stats(*a, **kw): return []
    def pillar_label_for_lead_main(x): return x

try:
    from apps.job_market.services.segment_ranking import (
        rank_segments_for_profile,
        top_segment_without_skills,
    )
except Exception:
    def rank_segments_for_profile(*a, **kw): return []
    def top_segment_without_skills(*a, **kw): return None


# ── Course instructions constant ─────────────────────────────────────────────

CHAT_DATA_RULES = """
## Zasady danych (OBOWIĄZKOWE)

1. **Nigdy nie wymyślaj liczb** (procentów, PLN, liczby ofert, poziomów skilli).
2. Dozwolone źródła liczb: sekcje `facts` i `chart_data` w tym prompcie oraz „Dokumenty źródłowe” (RAG).
3. **Nie oceniaj poziomu użytkownika per skill** (skala 1–10, 0–100, radar, wykres kołowy). Masz tylko: skill w profilu / brakuje + statystyki ofert z `facts`.
4. **Wykresy wynagrodzeń (auto-renderowane przez serwer — dokładnie jeden obrazek):**
   - `salary_by_level_bar` — poziomy kariery w **segmencie** użytkownika (niebieski bar chart, tytuł: „Zarobki w PLN/miesięcznie”, bez podpisów osi category/value).
   - `salary_by_pillar_radar` — **branże** (kolory) × poziomy kariery; wspólna skala realnych median w tysiącach PLN miesięcznie. Tylko dla pytań o branże.
   - **NIGDY** nie wklejaj JSON z chart_data — wykres pojawi się automatycznie.
   - **NIGDY** nie wstawiaj obrazków markdown `![...](url)` ani linków do wykresów — serwer renderuje jeden wykres sam.
5. Zakaz: wykresy skilli, % dopasowania, kołowe, linie trendów bez danych.
6. **Skilli, segmentów, luk** — tekst z `facts`. **Trendy** — RAG. Bez wykresów poza wynagrodzeniami.
7. Gdy `facts.segments_asked` nie jest puste — odpowiadaj na ten segment.
8. **NIGDY** nie wklejaj JSON, `chart_data` ani bloków kodu z danymi wykresu — serwer renderuje obrazek sam.
"""

CHAT_STYLE_INSTRUCTIONS = """
## Styl odpowiedzi (OBOWIĄZKOWE — odpowiedzi tekstowe)

Pisz po polsku jak **empatyczny doradca kariery**, nie jak raport Excel.

**Zasady:**
- **Płynny tekst** — 2–4 akapity lub krótkie sekcje z nagłówkami markdown (`###`), bez sztywnych bloków „Posiadane:” / „Brakujące:” wypełnionych samymi bulletami.
- **Liczb używaj osadzonych w zdaniach** (np. „Kubernetes wymagają ok. 16% ofert w tym segmencie — to ok. 2 tys. ogłoszeń”), nie jako gołej listy „Skill — 20% (2495 ofert)”.
- **Priorytetyzuj skille techniczne** z `facts`; pomijaj ogólniki typu komunikacja, language competency, rozwiązywanie problemów — chyba że użytkownik o nie pyta wprost.
- **Porównanie stanowisk** — opisz codzienną pracę, wejście w rolę, overlap z profilem użytkownika, naturalne przejście; bez wykresów i bez sztucznych ocen 1–100.
- **Nauka i kursy** — dla każdego z max 3 priorytetowych skilli z `facts.missing_skills`:
  - 1–2 zdania *dlaczego* ten skill w tym segmencie,
  - potem **konkretne kursy** w markdown, np.:
    - [DevOps Engineer – Coursera](https://www.coursera.org/search?query=devops)
    - [Kubernetes — Microsoft Learn](https://learn.microsoft.com/pl-pl/search/?terms=kubernetes)
  - Platformy: Coursera, Udemy, freeCodeCamp, Microsoft Learn, LinkedIn Learning, Google Skills.
- **Zakończenie** — jedno zdanie zachęty lub następny krok (bez pustych frazesów).

**Zakaz:** suchych list 5+ punktów z samymi procentami; szablonu kopiowanego z JSON facts 1:1.
"""

CHAT_SALARY_STYLE_INSTRUCTIONS = """
## Styl odpowiedzi o wynagrodzeniach (OBOWIĄZKOWE gdy pytanie dotyczy zarobków)

Pisz **wyłącznie ciągłą prozą** — jak doradca rozmawiający z klientem przy kawie. Wykres pojawi się pod tekstem; **nie opisuj wykresu** („jak widać na wykresie…”) — opisz rynek słowami.

**Struktura (2–3 akapity, zero bulletów):**
1. **Kontekst segmentu** — jednym-dwoma zdaniami: o jaki segment chodzi i jak ogólnie wygląda krajobraz płac (tylko liczby z facts).
2. **Narracja progresji** — przejdź przez poziomy kariery **w zdaniach**, łącząc poziomy spójnikami („następnie”, „z kolei”, „na poziomie seniorskim”). Każda kwota PLN osadzona w pełnym zdaniu z kontekstem (co oznacza ten poziom, jak skok do poprzedniego).
3. **Domknięcie** — krótkie zdanie: co z tego wynika dla użytkownika (realistyczny cel, sens awansu) — bez pustych frazesów.

**Przy porównaniu branż (radar):** zamiast listy branż pisz zdania porównawcze („W IT administracja wypada…, podczas gdy w finansach…”), kwoty PLN z facts.salary_by_pillar_radar.

**Przykład DOBRZE:**
„W segmencie administracji systemów IT mediana wynagrodzeń na poziomie juniora to ok. 9,7 tys. zł brutto miesięcznie — typowy próg wejścia dla osób z podstawową znajomością infrastruktury serwerowej. Po kilku latach doświadczenia, już jako mid, widełki rosną do ok. 18,8 tys. zł, co odzwierciedla większą samodzielność i odpowiedzialność za stabilność środowisk produkcyjnych. Na poziomie seniora mediana sięga ok. 24,5 tys. zł, a role kierownicze i menedżerskie w tym segmencie mogą zbliżać się do 28–32 tys. zł — to już pozycje, gdzie liczy się nie tylko technologia, lecz też koordynacja zespołu.”

**Przykład ŹLE (NIGDY tak nie pisz):**
„Junior: 9700 PLN. Mid: 18750 PLN. Senior: 24500 PLN.”
„- Junior — 9 700 zł
- Mid — 18 750 zł”
„Mediana wynagrodzeń wg poziomu:
1. Junior: 9700
2. Mid: 18750”

**Zakazy:** bulletów i numerowanych list z kwotami; tabel; nagłówków `###` przy wynagrodzeniach; powtarzania schematu „Poziom X: Y PLN”; suchego przepisywania facts.salary_by_level wiersz po wierszu.
"""

CHAT_RAG_INSTRUCTIONS = """
## Trendy i porównanie ścieżek (RAG + profil)

Gdy użytkownik pyta o trendy, „co dalej”, perspektywy lub porównanie stanowisk:
1. **Trendy ogólne** — z sekcji „Dokumenty źródłowe”; cytuj nazwę raportu (Hays, Antal, Barometr Zawodów itd.).
2. **Porównanie CV vs rynek** — zestaw `past_roles` / doświadczenie z profilu z `facts.top_segments` (sugerowane segmenty z bazy). Opisz podobieństwa, luki i naturalne przejścia **tekstem**.
3. **Ścieżka kariery** — jeśli jest `career_path_steps` w kontekście, użyj jej jako sugestii kolejnych kroków.
4. **Bez wykresów** — nie rysuj radarów, słupków % skilli ani „poziomów kompetencji”.
5. Jeśli RAG nie pokrywa tematu — powiedz wprost; nie wymyślaj trendów ani widełek.
"""

CHAT_COURSE_INSTRUCTIONS = """
## Kursy i rozwój (gdy użytkownik pyta „czego się uczyć”)

1. **Priorytety** — max 3 skilli z `facts.missing_skills`. Gdy lista została ułożona tak, by nie powtarzać poprzedniej odpowiedzi, zachowaj jej kolejność.
2. **Format odpowiedzi** — narracja + sekcja „Od czego zacząć” z linkami do kursów (patrz CHAT_STYLE).
3. **Nie proponuj** skilli spoza `facts.missing_skills` / `facts.top_skills`.
4. **Linki** — zawsze klikalne markdown; jeśli nie znasz URL kursu, użyj wyszukiwania platformy.
5. Liczby (% ofert, liczba ogłoszeń) — z `facts`, wplecione w tekst, nie jako sama lista.
"""


# ── Internal helpers ─────────────────────────────────────────────────────────

def _skill_names(profile_data: dict) -> list[str]:
    names = []
    for s in profile_data.get("hard_skills") or []:
        if not isinstance(s, dict):
            continue
        name = s.get("skill_name") or s.get("name") or ""
        if name:
            names.append(name)
    return names


def _skill_ids(profile_data: dict) -> list[str]:
    ids = []
    for s in profile_data.get("hard_skills") or []:
        if not isinstance(s, dict):
            continue
        sid = s.get("skill_id") or s.get("id")
        if sid:
            ids.append(str(sid))
    return ids


def _career_path_steps(career_path) -> list:
    """Accept career_path as {steps: [...]} or legacy list wrappers."""
    if not career_path:
        return []
    if isinstance(career_path, dict):
        steps = career_path.get("steps")
        return list(steps) if isinstance(steps, list) else []
    if isinstance(career_path, list):
        for item in career_path:
            if isinstance(item, dict) and isinstance(item.get("steps"), list):
                return item["steps"]
        if career_path and isinstance(career_path[0], dict):
            return career_path
    return []


def build_chat_rag_query(user_query: str, market_ctx: dict | None) -> str:
    """Enrich RAG retrieval with profile segment + role context."""
    parts: list[str] = []
    q = (user_query or "").strip()
    if q:
        parts.append(q)

    ctx = market_ctx or {}
    for role in (ctx.get("past_roles") or [])[:4]:
        title = role.get("job_title") or ""
        if title:
            parts.append(str(title))

    for seg in (ctx.get("top_segments") or [])[:3]:
        label = seg.get("label") or seg.get("display_label") or ""
        if label:
            parts.append(str(label))

    if ctx.get("best_segment"):
        parts.append(str(ctx["best_segment"]))

    if ctx.get("career_level_inferred"):
        parts.append(str(ctx["career_level_inferred"]))

    ql = q.lower()
    trend_words = (
        "trend", "rynek", "perspektyw", "zapotrzebowan", "przyszłość", "przyszlosc",
        "porówn", "porown", "dalej", "ścieżk", "sciezk", "stanowisk", "rol",
    )
    if any(w in ql for w in trend_words):
        parts.extend(["Polska", "rynek pracy", "zapotrzebowanie", "trendy", "wynagrodzenia"])

    return " ".join(p for p in parts if p).strip()


def _experience_summary(experience: list) -> str:
    if not experience:
        return "Brak wpisów o doświadczeniu."
    total_months = sum(e.get("duration_months", 0) or 0 for e in experience)
    parts = []
    for e in experience[:4]:
        title = e.get("job_title", "")
        company = e.get("company_name", "")
        months = e.get("duration_months")
        part = f"{title}"
        if company:
            part += f" @ {company}"
        if months:
            part += f" ({months} mies.)"
        parts.append(part)
    suffix = f"; łącznie ~{total_months} mies." if total_months else ""
    n = len(experience)
    return f"{n} pozycji, łącznie ~{total_months} mies.; " + "; ".join(parts)


def _missing_skills_for_segment(
    skill_ids: list[str],
    lead_main: str,
    lead_sub: str,
) -> list[dict]:
    try:
        top = _top_skills_in_segment(lead_main, lead_sub, limit=10)
        user_set = set(skill_ids)
        return [s for s in top if s.get("id") not in user_set][:5]
    except Exception:
        return []


def _best_segment_row(profile_data: dict) -> dict | None:
    skill_ids = _skill_ids(profile_data)
    industries = profile_data.get("interested_industries") or []
    try:
        ranked = rank_segments_for_profile(skill_ids, industries) or []
        fallback = top_segment_without_skills(industries) if not ranked else None
    except Exception:
        ranked = []
        fallback = None
    return ranked[0] if ranked else fallback


_CHAT_SKILL_NOISE = frozenset({
    "współpraca",
    "raport",
    "praca",
    "gotowość",
    "odpowiedzialność",
    "komunikacja",
    "komunikacja międzyludzka",
    "human communication",
    "language competency",
    "rozwiązywanie problemów",
    "problem solving",
    "people management",
    "planowanie",
    "nadzór",
    "prezentacja",
})

_CHAT_SKILL_NOISE_SUBSTR = (
    "komunikacja",
    "language compet",
    "problem solv",
    "rozwiązywanie problem",
    "interpersonal",
    "międzyludzk",
)


def _is_chat_noise(name: str) -> bool:
    n = (name or "").strip().lower()
    if n in _CHAT_SKILL_NOISE:
        return True
    return any(hint in n for hint in _CHAT_SKILL_NOISE_SUBSTR)


def _filter_noise_skills(skills: list[dict]) -> list[dict]:
    return [s for s in (skills or []) if not _is_chat_noise(s.get("name", ""))]


def _skill_summary(skills: list[dict]) -> list[dict]:
    return [
        {
            "id": s.get("id"),
            "name": s.get("name"),
            "offer_count": s.get("offer_count", 0),
            "pct_of_segment": s.get("pct_of_segment", 0),
        }
        for s in (skills or [])
        if s.get("name")
    ]


def _sort_chart_rows(rows: list[dict], *, descending: bool = True) -> list[dict]:
    return sorted(
        rows,
        key=lambda d: float(d.get("value") or 0),
        reverse=descending,
    )


# Chart levels — career ladder (Staż → Dyrektor), labels on Y, PLN on X
_CHART_SALARY_LEVEL_ORDER = (
    ("intern", "Staż"),
    ("junior", "Junior"),
    ("mid", "Mid"),
    ("senior", "Senior"),
    ("expert", "Ekspert"),
    ("lead", "Kierownik"),
    ("manager", "Menedżer"),
    ("director", "Dyrektor"),
)
_CHART_LEVEL_IDS = frozenset(gid for gid, _ in _CHART_SALARY_LEVEL_ORDER)


def _typical_salary_chart_rows(
    salary_by_level: list[dict],
    *,
    min_salary_n: int = 3,
) -> list[dict]:
    by_id: dict[str, dict] = {}
    for row in salary_by_level or []:
        gid = (row.get("level_id") or "").strip().lower()
        if gid:
            by_id[gid] = row

    out: list[dict] = []
    for gid, short_label in _CHART_SALARY_LEVEL_ORDER:
        src = by_id.get(gid)
        if not src:
            continue
        median = src.get("median_salary")
        salary_n = src.get("salary_n") or 0
        if median is None or salary_n < min_salary_n:
            continue
        out.append(
            {
                "category": short_label,
                "value": median,
                "offer_count": src.get("offer_count"),
                "salary_n": salary_n,
            }
        )
    return out


def _filter_typical_salary_levels(salary_by_level: list[dict]) -> list[dict]:
    """Facts/text: same career levels as the chart."""
    return [
        r
        for r in (salary_by_level or [])
        if (r.get("level_id") or "").strip().lower() in _CHART_LEVEL_IDS
    ]


def _segments_matching_query(query: str, limit: int = 4) -> list[tuple[str, str]]:
    """Map user text (e.g. '… w segmencie edukacja') to lead_main × lead_sub in DB."""
    import re

    from django.db.models import Count, Q

    from apps.job_market.models import JobOffer

    q = (query or "").strip().lower()
    if len(q) < 3:
        return []

    _STOP = frozenset({
        "jak", "moje", "moj", "moja", "moi", "w", "na", "do", "czy", "cym", "jest",
        "są", "się", "sie", "segmen", "segmencie", "segmencie", "segment", "segmentu",
        "rynku", "skilli", "skille", "skill", "wyglądają", "wygladaja", "wyglada",
        "brakuje", "luki", "kompetencje", "kompetencji", "proszę", "prosze", "mam",
        "gdzie", "którym", "ktorym", "jakie", "jaki", "jaką", "jaka", "oraz", "the",
        "and", "for", "about", "what", "where", "moje", "moich", "moim", "tym", "tych",
        "tego", "tej", "ten", "ta", "to", "czy", "bardzo", "dobrze", "źle", "zle",
    })

    def _search_terms(terms: list[str]) -> list[tuple[str, str]]:
        cleaned = []
        seen = set()
        for term in terms:
            t = (term or "").strip().lower()
            if len(t) < 3 or t in _STOP or t in seen:
                continue
            seen.add(t)
            cleaned.append(t)
        if not cleaned:
            return []

        q_filter = Q()
        for term in cleaned:
            q_filter |= (
                Q(lead_main_category__icontains=term)
                | Q(lead_sub_category__icontains=term)
            )
        rows = (
            JobOffer.objects.filter(q_filter)
            .values("lead_main_category", "lead_sub_category")
            .annotate(c=Count("id"))
            .order_by("-c")[: limit * 2]
        )
        out: list[tuple[str, str]] = []
        for r in rows:
            sub = r.get("lead_sub_category")
            main = r.get("lead_main_category")
            if not sub or not main:
                continue
            pair = (main, sub)
            if pair not in out:
                out.append(pair)
            if len(out) >= limit:
                break
        return out

    # Short queries — try whole string first (e.g. "edukacja").
    if len(q) <= 48:
        hit = _search_terms([q])
        if hit:
            return hit

    tokens = re.findall(r"[\wąćęłńóśźż]+", q, flags=re.I)
    hit = _search_terms(tokens)
    if hit:
        return hit

    for pattern in (
        r"segmencie\s+(.+?)(?:\?|$)",
        r"segmen(?:cie|t|tu)\s+(.+?)(?:\?|$)",
        r"branż[ay]\s+(.+?)(?:\?|$)",
        r"dziedzinie\s+(.+?)(?:\?|$)",
    ):
        m = re.search(pattern, q)
        if m:
            phrase_tokens = re.findall(r"[\wąćęłńóśźż]+", m.group(1), flags=re.I)
            hit = _search_terms(phrase_tokens)
            if hit:
                return hit

    return []


def _pillar_label(main: str) -> str:
    label = pillar_label_for_lead_main(main) or main
    if main.startswith("IT -"):
        return main.replace("IT - ", "IT: ", 1)[:36]
    return label[:36]


def _salary_radar_by_pillar(limit: int = 5) -> tuple[list[dict], list[dict]]:
    """Radar: axes = poziomy kariery, series = branże (group/color)."""
    from django.db.models import Count

    from apps.job_market.models import JobOffer

    pillars = (
        JobOffer.objects.exclude(lead_main_category="")
        .values("lead_main_category")
        .annotate(offer_count=Count("id"))
        .order_by("-offer_count")[:limit]
    )
    radar_data: list[dict] = []
    meta: list[dict] = []
    for p in pillars:
        main = p["lead_main_category"]
        qs = JobOffer.objects.filter(lead_main_category=main)
        level_rows = _typical_salary_chart_rows(_level_stats(qs), min_salary_n=3)
        if len(level_rows) < 2:
            continue
        label = _pillar_label(main)
        for row in level_rows:
            radar_data.append(
                {
                    "name": row["category"],
                    "value": row["value"],
                    "group": label,
                }
            )
        meta.append(
            {
                "branza": label,
                "levels": level_rows,
                "offer_count": p["offer_count"],
            }
        )
    return radar_data, meta


def _salary_by_pillar(limit: int = 8) -> list[dict]:
    """Median UoP salary per branża (lead_main_category)."""
    from django.db.models import Count

    from apps.job_market.models import JobOffer

    pillars = (
        JobOffer.objects.exclude(lead_main_category="")
        .values("lead_main_category")
        .annotate(offer_count=Count("id"))
        .order_by("-offer_count")[:limit]
    )
    rows = []
    for p in pillars:
        main = p["lead_main_category"]
        qs = JobOffer.objects.filter(lead_main_category=main)
        stats = _salary_stats(qs, "uop")
        if not stats or stats.get("n", 0) < 5:
            continue
        label = pillar_label_for_lead_main(main) or main
        if main.startswith("IT -"):
            label = main.replace("IT - ", "IT: ", 1)[:42]
        rows.append(
            {
                "category": label[:42],
                "value": stats["median"],
                "offer_count": p["offer_count"],
                "salary_n": stats["n"],
            }
        )
    return _sort_chart_rows(rows)


def _segment_facts_block(
    lead_main: str,
    lead_sub: str,
    skill_ids: list[str],
) -> dict | None:
    try:
        analytics = get_segment_analytics(
            lead_main, lead_sub, user_skill_ids=skill_ids
        )
    except Exception:
        return None
    if not analytics:
        return None
    skill_fit = analytics.get("skill_fit") or {}
    match = analytics.get("match_score") or {}
    return {
        "display_label": analytics.get("display_label"),
        "offer_count": analytics.get("offer_count"),
        "match_pct": match.get("avg_similarity_pct"),
        "skill_coverage_top10_pct": skill_fit.get("coverage_pct"),
        "top_skills": _filter_noise_skills(
            _skill_summary((analytics.get("top_skills") or [])[:8])
        ),
        "have_skills": _filter_noise_skills(
            _skill_summary(skill_fit.get("have") or [])
        )[:6],
        "missing_skills": _filter_noise_skills(
            _skill_summary(skill_fit.get("missing") or [])
        )[:6],
        "salary_uop_monthly": analytics.get("salary_uop_monthly"),
        "salary_by_level": [
            {
                "level": r.get("level"),
                "median_salary": r.get("median_salary"),
                "offer_count": r.get("offer_count"),
                "salary_n": r.get("salary_n"),
            }
            for r in (analytics.get("level_snapshot") or [])
            if r.get("median_salary")
        ],
    }


def _build_chart_data(
    display_label: str,
    salary_by_level: list[dict],
    salary_radar: tuple[list[dict], list[dict]] | None = None,
) -> dict:
    """Salary charts: bar (segment levels) + radar (branches × levels)."""
    charts: dict = {}

    salary_rows = _typical_salary_chart_rows(salary_by_level, min_salary_n=3)
    if salary_rows:
        charts["salary_by_level_bar"] = {
            "tool": "generate_bar_chart",
            "title": "Zarobki w PLN/miesięcznie",
            "axisXTitle": "",
            "axisYTitle": "",
            "width": 720,
            "height": max(360, 52 * len(salary_rows) + 120),
            "preserve_order": False,
            "data": [
                {"category": r["category"], "value": r["value"]} for r in salary_rows
            ],
            "meta": salary_rows,
        }

    radar_data, radar_meta = salary_radar or ([], [])
    if radar_data:
        charts["salary_by_pillar_radar"] = {
            "tool": "generate_radar_chart",
            "title": "Zarobki (tys. PLN/mies.)",
            "width": 760,
            "height": 560,
            "data": radar_data,
            "meta": radar_meta,
        }

    return {"charts": charts}


def build_chat_facts(
    profile_data: dict | None,
    user_query: str | None = None,
) -> dict:
    """Structured DB facts + salary-only chart payloads for chat."""
    market_ctx = build_chat_career_context(profile_data)
    if not profile_data:
        return {"market_ctx": market_ctx, "facts": {}, "chart_data": {"charts": {}}}

    skill_ids = _skill_ids(profile_data)
    best = _best_segment_row(profile_data)
    segment = None
    if best and best.get("lead_main_category") and best.get("lead_sub_category"):
        try:
            segment = get_segment_analytics(
                best["lead_main_category"],
                best["lead_sub_category"],
                user_skill_ids=skill_ids,
            )
        except Exception:
            segment = None

    display_label = (
        (segment or {}).get("display_label")
        or best.get("display_label")
        or best.get("lead_sub_category")
        or "segment"
    ) if best else "segment"

    top_skills = (segment or {}).get("top_skills") or []
    skill_fit = (segment or {}).get("skill_fit") or {}
    match_score = (segment or {}).get("match_score") or {}
    salary_by_level = (segment or {}).get("level_snapshot") or []

    missing_enriched = _skill_summary(skill_fit.get("missing") or [])
    have_enriched = _skill_summary(skill_fit.get("have") or [])

    if not missing_enriched and best:
        missing_enriched = _skill_summary(
            _missing_skills_for_segment(
                skill_ids,
                best.get("lead_main_category", ""),
                best.get("lead_sub_category", ""),
            )
        )
        if segment and segment.get("offer_count"):
            missing_enriched = _enrich_skill_pcts(
                missing_enriched, segment["offer_count"]
            )

    segments_asked: list[dict] = []
    for lead_main, lead_sub in _segments_matching_query(user_query or ""):
        block = _segment_facts_block(lead_main, lead_sub, skill_ids)
        if block:
            segments_asked.append(block)

    facts = {
        "best_segment": {
            "display_label": display_label,
            "lead_main_category": best.get("lead_main_category") if best else None,
            "lead_sub_category": best.get("lead_sub_category") if best else None,
            "offer_count": (segment or {}).get("offer_count")
            or (best.get("offer_count") if best else None),
            "match_pct": match_score.get("avg_similarity_pct")
            if match_score
            else (best.get("match_pct") if best else None),
            "matching_offers_sample": match_score.get("matching_offers"),
        },
        "segments_asked": segments_asked,
        "top_skills": _filter_noise_skills(_skill_summary(top_skills[:10])),
        "missing_skills": _filter_noise_skills(missing_enriched)[:8],
        "have_skills_in_segment": _filter_noise_skills(have_enriched)[:8],
        "skill_coverage_top10_pct": skill_fit.get("coverage_pct"),
        "salary_uop_monthly": (segment or {}).get("salary_uop_monthly"),
        "salary_b2b_monthly": (segment or {}).get("salary_b2b_monthly"),
        "salary_by_level": [
            {
                "level": r.get("level"),
                "level_id": r.get("level_id"),
                "offer_count": r.get("offer_count"),
                "median_salary": r.get("median_salary"),
                "salary_n": r.get("salary_n"),
            }
            for r in _filter_typical_salary_levels(salary_by_level)
            if r.get("median_salary") is not None
        ],
        "top_segments": market_ctx.get("top_segments") or [],
    }

    radar_data, radar_meta = _salary_radar_by_pillar()
    if radar_meta:
        facts["salary_by_pillar_radar"] = radar_meta

    chart_data = _build_chart_data(
        display_label,
        salary_by_level,
        (radar_data, radar_meta),
    )

    return {"market_ctx": market_ctx, "facts": facts, "chart_data": chart_data}


def format_chat_facts_json(chat_bundle: dict) -> str:
    """Facts only — chart_data is rendered server-side, not exposed to LLM."""
    payload = {"facts": chat_bundle.get("facts") or {}}
    return json.dumps(payload, ensure_ascii=False, indent=2)


# ── Public API ────────────────────────────────────────────────────────────────

def build_chat_career_context(profile_data: dict | None) -> dict:
    """Build a lightweight context dict for the chat system prompt."""
    if not profile_data:
        return {}

    skill_ids = _skill_ids(profile_data)
    industries = profile_data.get("interested_industries") or []
    experience = profile_data.get("experience") or []
    steps = _career_path_steps(profile_data.get("career_path"))

    # Segment ranking
    try:
        ranked = rank_segments_for_profile(skill_ids, industries) or []
        fallback = top_segment_without_skills(industries) if not ranked else None
    except Exception:
        ranked = []
        fallback = None

    # Career level
    try:
        level = _infer_career_level(experience)
        next_level = _next_career_level(level)
    except Exception:
        level = None
        next_level = None

    # Best segment
    best = ranked[0] if ranked else fallback

    # Next level readiness
    try:
        readiness = _next_level_readiness(skill_ids, experience, best) if best else None
    except Exception:
        readiness = None

    # Missing skills in top segment
    try:
        missing = []
        if best:
            lead_main = best.get("lead_main_category", "")
            lead_sub = best.get("lead_sub_category", "")
            missing_raw = _missing_skills_for_segment(skill_ids, lead_main, lead_sub)
            missing = [m.get("name", "") for m in missing_raw if m.get("name")]
    except Exception:
        missing = []

    past_roles = []
    for e in (experience or [])[:6]:
        title = (e.get("job_title") or "").strip()
        if not title:
            continue
        past_roles.append(
            {
                "job_title": title,
                "company": (e.get("company_name") or "").strip(),
                "duration_months": e.get("duration_months"),
            }
        )

    # Career path steps for context
    path_skills = []
    for s in (steps or [])[-5:]:
        m = {
            "skill": s.get("skill_name", s.get("skill", "")),
            "segment": (
                f"{s.get('lead_main_category', '')} / {s.get('lead_sub_category', '')}"
                if s.get("lead_main_category")
                else s.get("segment", "")
            ),
            "match_gain": s.get("match_gain", s.get("match_delta", "")),
            "match_after": s.get("match_after", ""),
            "match_before": s.get("match_before", ""),
        }
        path_skills.append(m)

    return {
        "skills": _skill_names(profile_data),
        "skill_count": len(skill_ids),
        "past_roles": past_roles,
        "experience_summary": _experience_summary(experience),
        "career_level_inferred": level,
        "next_career_level": next_level,
        "career_path_steps": path_skills,
        "career_path_step_count": len(path_skills),
        "top_segments": [
            {
                "label": seg.get("display_label", seg.get("lead_sub_category", "")),
                "display_label": seg.get("display_label", ""),
                "match_pct": seg.get("match_pct", seg.get("avg_similarity_pct", "")),
                "offer_count": seg.get("offer_count", ""),
            }
            for seg in (ranked[:5] if ranked else [])
        ],
        "best_segment": best.get("display_label", best.get("lead_sub_category", "")) if best else None,
        "missing_skills_priority": missing,
        "next_level_readiness": readiness,
    }


def format_chat_context_block(profile_data: dict, market_ctx: dict) -> str:
    """Human-readable block appended to system prompt."""
    if not market_ctx:
        return ""

    lines = ["## Kontekst rynkowy (z bazy Career Advisor)"]

    if market_ctx.get("career_level_inferred"):
        level_line = f"- Poziom kariery (szacunek): **{market_ctx['career_level_inferred']}**"
        if market_ctx.get("next_career_level"):
            level_line += f" → cel: **{market_ctx['next_career_level']}**"
        lines.append(level_line)

    if market_ctx.get("experience_summary"):
        lines.append(f"- Doświadczenie: {market_ctx['experience_summary']}")

    past_roles = market_ctx.get("past_roles") or []
    if past_roles:
        lines.append("- Dotychczasowe stanowiska (z profilu):")
        for role in past_roles[:5]:
            part = role.get("job_title", "")
            if role.get("company"):
                part += f" @ {role['company']}"
            if role.get("duration_months"):
                part += f" ({role['duration_months']} mies.)"
            lines.append(f"  · {part}")

    skill_count = market_ctx.get("skill_count", 0)
    skills = market_ctx.get("skills") or []
    if skills:
        lines.append(f"- Skille ({skill_count}): {', '.join(skills[:12])}")

    if market_ctx.get("best_segment"):
        lines.append(f"- Najlepszy segment dopasowania: **{market_ctx['best_segment']}**")

    if market_ctx.get("missing_skills_priority"):
        lines.append(
            "- Brakujące kompetencje w top segmencie: "
            + ", ".join(market_ctx["missing_skills_priority"])
        )

    if market_ctx.get("career_path_steps"):
        lines.append("- Kroki ścieżki kariery w aplikacji:")
        for step in market_ctx["career_path_steps"]:
            lines.append(
                f"  · {step['skill']} → {step['segment']} (+"
                f"{step['match_gain']}% dopasowania)"
            )

    readiness = market_ctx.get("next_level_readiness")
    if readiness:
        lines.append(
            f"- Gotowość na {readiness.get('next_level')}"
            f": dopasowanie do ofert {readiness.get('match_target_level')}"
            f"% (po pakiecie skilli: {readiness.get('match_after_bundle')}%)"
        )

    if market_ctx.get("top_segments"):
        lines.append("- Sugerowane segmenty rynku (dopasowanie profilu do ofert):")
        for seg in market_ctx["top_segments"]:
            lines.append(
                f"  · {seg.get('label')} — dopasowanie "
                f"{seg.get('match_pct')}%, "
                f"{seg.get('offer_count')} ofert"
            )

    if past_roles and market_ctx.get("top_segments"):
        lines.append(
            "- Przy pytaniach o porównanie ścieżek: zestaw stanowiska z CV "
            "z sugerowanymi segmentami powyżej + trendy z Dokumentów źródłowych (RAG)."
        )

    return "\n".join(lines)
