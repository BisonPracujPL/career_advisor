"""Word cloud image generation — same library & style as streamlit_prototyp."""

from __future__ import annotations

import base64
import io
import random

from wordcloud import WordCloud


def _blue_color(*_args, **_kwargs):
    return f"hsl(214, 78%, {random.randint(34, 62)}%)"


def build_skills_wordcloud_png(skills: list[dict], max_words: int = 45) -> str | None:
    """Return base64 PNG for top skills (name + offer_count or rank order)."""
    if not skills:
        return None
    ranked = skills[:max_words]
    n = len(ranked)
    freqs = {}
    for i, s in enumerate(ranked):
        name = (s.get("name") or "").strip()
        if not name:
            continue
        weight = float(s.get("offer_count") or (n - i))
        freqs[name] = max(weight, 1.0)
    if not freqs:
        return None
    wc = WordCloud(
        width=820,
        height=420,
        background_color="white",
        prefer_horizontal=0.92,
        max_words=max_words,
        min_font_size=11,
        relative_scaling=0.5,
        color_func=_blue_color,
    ).generate_from_frequencies(freqs)
    buf = io.BytesIO()
    wc.to_image().save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")
