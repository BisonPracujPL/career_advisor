"""(Re)build the per-offer sparse skill vector for already-loaded offers.

Use this when offers are already in the database (so you don't want to reload),
e.g. after adding the ``skill_vector`` column or after re-indexing the skill
dictionary. It reads each offer's ``skills`` JSON and writes ``skill_vector``.

Usage (inside the backend container)::

    python manage.py build_skill_vectors
    python manage.py build_skill_vectors --vector-value tfidf --batch 2000

Requires the skill dictionary to be loaded and indexed first (``load_skills``),
otherwise there is no ``vector_index`` mapping to build vectors from.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.job_market.models import ExtractedSkills
from apps.job_market.vectors import (
    VECTOR_VALUE_CHOICES,
    build_skill_vector,
    skill_idf_map,
    skill_index_map,
)


class Command(BaseCommand):
    help = "Rebuild ExtractedSkills.skill_vector for existing offers."

    def add_arguments(self, parser):
        parser.add_argument(
            "--vector-value",
            choices=VECTOR_VALUE_CHOICES,
            default="binary",
            help="Value per skill: 'binary' (1.0), 'probability' (match score), "
            "or 'tfidf' (probability×IDF; run compute_skill_idf first).",
        )
        parser.add_argument("--batch", type=int, default=1000, help="Rows per DB batch.")

    def handle(self, *args, **opts):
        value, batch_size = opts["vector_value"], opts["batch"]

        index_map = skill_index_map()
        idf_map = skill_idf_map() if value == "tfidf" else None
        dim = len(index_map)
        if not dim:
            self.stderr.write(
                self.style.ERROR(
                    "No skill has a vector_index. Run `load_skills` first."
                )
            )
            return

        total = 0
        bucket = []
        qs = ExtractedSkills.objects.all().iterator(chunk_size=batch_size)
        for es in qs:
            es.skill_vector = build_skill_vector(
                es.skills, index_map, dim, value, idf_map=idf_map
            )
            bucket.append(es)
            if len(bucket) >= batch_size:
                total += self._flush(bucket)
                bucket = []
        total += self._flush(bucket)

        self.stdout.write(
            self.style.SUCCESS(
                f"Rebuilt skill_vector for {total} offers "
                f"(dimension={dim}, value={value})."
            )
        )

    @staticmethod
    @transaction.atomic
    def _flush(bucket):
        if not bucket:
            return 0
        ExtractedSkills.objects.bulk_update(bucket, ["skill_vector"])
        return len(bucket)
