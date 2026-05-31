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
VECTOR_VALUE_CHOICES = ("binary", "probability")


def skill_index_map():
    """``{skill_id: vector_index}`` for every skill that has an index assigned."""
    from .models import Skill

    return dict(
        Skill.objects.exclude(vector_index__isnull=True).values_list("id", "vector_index")
    )


def build_skill_vector(skills, index_map, dim, value="binary"):
    """Build a :class:`SparseVector` for one offer's skill set.

    ``skills``    – list of ``{"skill_id": ..., "probability": ...}`` (the offer's set).
    ``index_map`` – ``{skill_id: vector_index}`` (see :func:`skill_index_map`).
    ``dim``       – total number of skills (the vector's length).
    ``value``     – ``"binary"`` (1.0 per present skill) or ``"probability"``
                    (store the match probability).

    Skills whose id is not in ``index_map`` (e.g. not in the dictionary) are
    skipped. Returns ``None`` when ``dim`` is 0 (dictionary not loaded yet).
    """
    if not dim:
        return None
    elements = {}
    for s in skills:
        idx = index_map.get(s.get("skill_id"))
        if idx is None:
            continue
        if value == "probability":
            elements[idx] = float(s.get("probability") or 0.0)
        else:
            elements[idx] = 1.0
    return SparseVector(elements, dim)
