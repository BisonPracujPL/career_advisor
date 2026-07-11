"""Server-side guard + auto-render for salary charts from chart_data."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

ALLOWED_CHART_TOOLS = frozenset({"generate_bar_chart", "generate_radar_chart"})
ALLOWED_CHART_KEYS = frozenset({"salary_by_level_bar", "salary_by_pillar_radar"})

BAR_CHART_STYLE = {
    "theme": "default",
    "style": {
        "palette": ["#2563eb"],
        "backgroundColor": "#ffffff",
    },
}

RADAR_CHART_STYLE = {
    "theme": "default",
    "style": {
        "palette": [
            "#2563eb",
            "#16a34a",
            "#ea580c",
            "#9333ea",
            "#0891b2",
            "#dc2626",
        ],
        "backgroundColor": "#ffffff",
    },
}

# Smaller radius + padding → axis labels (Staż, Junior…) farther from radar lines
RADAR_LAYOUT = {
    "width": 760,
    "height": 560,
    "radius": 0.32,
    "appendPadding": [72, 72, 72, 72],
}

_SALARY_QUERY_HINTS = (
    "wynagrodz",
    "zarob",
    "zarab",
    "płac",
    "plac",
    "widełk",
    "widelek",
    "mediana",
    "pln",
    "salary",
    "brutto",
    "netto",
    "uop",
    "b2b",
    "pensj",
)

_BRANCH_QUERY_HINTS = (
    "branżami",
    "branzami",
    "między bran",
    "wg branży",
    "wg branzy",
    "zarobki wg bran",
    "porównaj mediany wynagrodzeń między bran",
    "poziomy kariery × bran",
    "poziomy kariery x bran",
)
_LEVEL_QUERY_HINTS = (
    "wg poziomu",
    "wg stanowiska",
    "poziom stanowiska",
    "staż, junior",
    "junior, mid",
    "mediany wynagrodzeń wg poziomu",
    "mediany wynagrodzeń w moim segmencie",
    "jak wyglądają mediany wynagrodzeń",
)

CHIP_CHART_KEYS = {
    "salary_by_pillar": "salary_by_pillar_radar",
    "salary_by_level": "salary_by_level_bar",
}

# Chips / prompts that must never auto-render a chart
NO_CHART_SUGGESTION_IDS = frozenset({
    "position_compare",
    "learning_first",
    "skills_courses",
    "market_trends",
    "segment_skills_text",
})

_NO_CHART_QUERY_HINTS = (
    "bez wykresów",
    "porównaj dwa stanowisko",
    "porównaj dwa stanowiska",
    "porównanie stanowisk",
    "kompetencyjny w segmencie",
    "czego powinienem uczyć",
    "techniczne skille warto",
    "trendy i zapotrzebowanie",
    "trendy rynku wokół",
)


def is_salary_chart_query(query: str) -> bool:
    q = (query or "").lower()
    return any(hint in q for hint in _SALARY_QUERY_HINTS)


def pick_auto_salary_chart(
    query: str,
    chart_data: dict,
    *,
    suggestion_id: str | None = None,
) -> str | None:
    """Choose which salary chart to auto-render from user message or chip id."""
    charts = (chart_data or {}).get("charts") or {}
    if not charts:
        return None

    q = (query or "").lower()

    if suggestion_id and suggestion_id in NO_CHART_SUGGESTION_IDS:
        return None

    if any(h in q for h in _NO_CHART_QUERY_HINTS):
        return None

    if suggestion_id and suggestion_id in CHIP_CHART_KEYS:
        key = CHIP_CHART_KEYS[suggestion_id]
        if key in charts:
            return key
        return None

    if not is_salary_chart_query(query):
        return None

    wants_branch = any(h in q for h in _BRANCH_QUERY_HINTS)
    wants_level = any(h in q for h in _LEVEL_QUERY_HINTS)

    if wants_branch and "salary_by_pillar_radar" in charts:
        return "salary_by_pillar_radar"
    if wants_level and "salary_by_level_bar" in charts:
        return "salary_by_level_bar"
    return None


def filter_chart_tools(tools: list) -> list:
    """Legacy — charts are server-rendered; keep empty for LLM."""
    return []


def _radar_salary_thousands(data: list[dict]) -> list[dict]:
    """Convert PLN medians to thousands of PLN without changing their common scale."""
    return [
        {
            "name": row.get("name") or "",
            "group": row.get("group") or "",
            "value": round(float(row.get("value") or 0) / 1000, 1),
        }
        for row in data
        if float(row.get("value") or 0) > 0
    ]


def apply_chart_guard_for_key(
    key: str,
    chart_data: dict,
) -> tuple[dict | None, str | None, str | None]:
    charts = (chart_data or {}).get("charts") or {}
    if key not in ALLOWED_CHART_KEYS or key not in charts:
        return None, f"Brak wykresu {key} w chart_data.", None

    spec = charts[key]
    raw_data = list(spec.get("data") or [])
    if not raw_data:
        return None, f"Brak danych o wynagrodzeniach ({key}).", None

    resolved_tool = spec.get("tool") or "generate_bar_chart"
    if resolved_tool not in ALLOWED_CHART_TOOLS:
        return None, f"Niedozwolone narzędzie wykresu: {resolved_tool}", None

    if key == "salary_by_pillar_radar":
        plot_data = _radar_salary_thousands(raw_data)
        safe = {
            "title": spec.get("title") or "Zarobki (tys. PLN/mies.)",
            "data": plot_data,
            "width": spec.get("width") or RADAR_LAYOUT["width"],
            "height": spec.get("height") or RADAR_LAYOUT["height"],
            **RADAR_CHART_STYLE,
        }
        return safe, None, "generate_radar_chart"

    data = (
        raw_data
        if spec.get("preserve_order")
        else sorted(
            raw_data,
            key=lambda d: float(d.get("value") or 0),
            reverse=True,
        )
    )
    row_count = len(data)
    safe = {
        "title": spec.get("title") or "Zarobki w PLN/miesięcznie",
        "axisXTitle": "",
        "axisYTitle": "",
        "data": data,
        "stack": False,
        "group": False,
        "width": spec.get("width") or 720,
        "height": max(spec.get("height") or 360, 52 * row_count + 120),
        **BAR_CHART_STYLE,
    }
    return safe, None, "generate_bar_chart"


def apply_chart_guard(
    tool_name: str,
    arguments: dict,
    chart_data: dict,
) -> tuple[dict | None, str | None, str | None]:
    charts = (chart_data or {}).get("charts") or {}
    if not charts:
        return (
            None,
            "Wykresy tylko dla wynagrodzeń. Opisz skilli tekstem (facts + RAG).",
            None,
        )

    title = str(arguments.get("title") or "").lower()
    key = None
    if any(h in title for h in _BRANCH_QUERY_HINTS):
        key = "salary_by_pillar_radar"
    elif any(h in title for h in _LEVEL_QUERY_HINTS):
        key = "salary_by_level_bar"
    elif tool_name == "generate_radar_chart":
        key = "salary_by_pillar_radar"
    elif tool_name == "generate_bar_chart":
        key = "salary_by_level_bar"

    if not key or key not in charts:
        key = pick_auto_salary_chart(title, chart_data)

    if not key:
        return None, "Nie rozpoznano typu wykresu wynagrodzeń.", None

    return apply_chart_guard_for_key(key, chart_data)


def render_radar_chart_url(safe_args: dict) -> str:
    """Render radar via GPT-Vis API (supports radius/padding — not exposed by MCP zod)."""
    payload = {
        "type": "radar",
        "source": "mcp-server-chart",
        "title": safe_args.get("title") or "",
        "data": safe_args.get("data") or [],
        "width": safe_args.get("width") or RADAR_LAYOUT["width"],
        "height": safe_args.get("height") or RADAR_LAYOUT["height"],
        "radius": RADAR_LAYOUT["radius"],
        "appendPadding": RADAR_LAYOUT["appendPadding"],
        "theme": safe_args.get("theme") or RADAR_CHART_STYLE["theme"],
        "style": safe_args.get("style") or RADAR_CHART_STYLE["style"],
    }
    vis_url = os.environ.get(
        "VIS_REQUEST_SERVER",
        "https://antv-studio.alipay.com/api/gpt-vis",
    )
    req = urllib.request.Request(
        vis_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Radar render failed: {exc}") from exc

    if not body.get("success"):
        raise RuntimeError(body.get("errorMessage") or "Radar render failed")
    return str(body.get("resultObj") or "")
