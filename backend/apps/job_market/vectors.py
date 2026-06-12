"""Helpers for turning an offer's skill set into a sparse skill vector.

Each offer gets a ``sparsevec`` whose dimension is the number of skills in the
dictionary (real + synthetic). A coordinate is non-zero iff the offer requires
that skill. Coordinate ``i`` corresponds to ``Skill.objects.get(vector_index=i)``,
so the vector and the dictionary stay in sync through ``Skill.vector_index``.

``sparsevec`` (not a dense ``vector``) is used on purpose: the dictionary has
~32k skills, well over pgvector's 16k dense-dimension limit, while a single offer
only references a handful of them — so storing just the non-zero entries is both
necessary and far cheaper.
"""

from pgvector import SparseVector

# How to fill a present skill's coordinate.
VECTOR_VALUE_CHOICES = ("binary", "probability", "tfidf")


def skill_index_map():
    """``{skill_id: vector_index}`` for every skill that has an index assigned."""
    from .models import Skill

    return dict(
        Skill.objects.exclude(vector_index__isnull=True).values_list("id", "vector_index")
    )


def skill_idf_map():
    """``{skill_id: idf_weight}`` for TF-IDF weighting (defaults to 1.0)."""
    from .models import Skill

    return {
        sid: float(w or 1.0)
        for sid, w in Skill.objects.exclude(vector_index__isnull=True).values_list(
            "id", "idf_weight"
        )
    }


def _coordinate_value(skill_entry, value: str, idf_map: dict[str, float] | None) -> float:
    """Single sparse-vector coordinate from one skill JSON entry."""
    if value == "probability":
        return float(skill_entry.get("probability") or 0.0)
    if value == "tfidf":
        tf = float(skill_entry.get("probability") or 1.0)
        idf = (idf_map or {}).get(skill_entry.get("skill_id"), 1.0)
        return tf * idf
    return 1.0


def build_skill_vector(skills, index_map, dim, value="binary", idf_map=None):
    """Build a :class:`SparseVector` for one offer's skill set.

    ``skills``    – list of ``{"skill_id": ..., "probability": ...}`` (the offer's set).
    ``index_map`` – ``{skill_id: vector_index}`` (see :func:`skill_index_map`).
    ``dim``       – total number of skills (the vector's length).
    ``value``     – ``"binary"`` (1.0), ``"probability"`` (match score), or
                    ``"tfidf"`` (probability or 1.0 × smoothed IDF per skill).

    Skills whose id is not in ``index_map`` are skipped. Returns ``None`` when
    ``dim`` is 0 (dictionary not loaded yet).
    """
    if not dim:
        return None
    if value == "tfidf" and idf_map is None:
        idf_map = skill_idf_map()
    elements = {}
    for s in skills:
        idx = index_map.get(s.get("skill_id"))
        if idx is None:
            continue
        elements[idx] = _coordinate_value(s, value, idf_map)
    return SparseVector(elements, dim)
