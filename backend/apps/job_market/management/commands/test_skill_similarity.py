"""Quick smoke-test for per-offer sparse skill vectors.

Picks N random offers that have a skill_vector and prints their 5 nearest
neighbours by cosine similarity.

Usage (inside the backend container)::

    python manage.py test_skill_similarity
    python manage.py test_skill_similarity --count 30 --neighbors 10
"""

from django.core.management.base import BaseCommand

from apps.job_market.models import ExtractedSkills, Skill
from pgvector.django import CosineDistance


class Command(BaseCommand):
    help = "Print cosine-similarity neighbours for a sample of random offers."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count", type=int, default=15,
            help="Number of random source offers to test (default 15).",
        )
        parser.add_argument(
            "--neighbors", type=int, default=5,
            help="Nearest neighbours to show per offer (default 5).",
        )

    def handle(self, *args, **opts):
        n_offers = opts["count"]
        n_neighbors = opts["neighbors"]

        has_vector = ExtractedSkills.objects.exclude(skill_vector__isnull=True)
        total = has_vector.count()
        if total == 0:
            self.stderr.write(self.style.ERROR(
                "No offers with skill_vector found. "
                "Run load_skills + load_offers (or build_skill_vectors) first."
            ))
            return

        sample = list(
            has_vector.order_by("?").values_list("offer_id", flat=True)[:n_offers]
        )
        self.stdout.write(
            f"Testing {len(sample)} random offers out of {total} total "
            f"(showing {n_neighbors} neighbours each)\n"
        )

        for offer_id in sample:
            source = (
                ExtractedSkills.objects
                .select_related("offer")
                .get(offer_id=offer_id)
            )
            skill_names = list(
                Skill.objects
                .filter(vector_index__in=source.skill_vector.indices())
                .values_list("name", flat=True)[:6]
            )

            neighbors = (
                has_vector
                .exclude(offer_id=offer_id)
                .annotate(d=CosineDistance("skill_vector", source.skill_vector))
                .order_by("d")
                .select_related("offer")[:n_neighbors]
            )

            self.stdout.write(
                f"\n[#{offer_id}] {source.offer.job_title}"
                f"  |  {source.offer.lead_main_category}"
                f"  |  skills in vector: {source.skill_vector.indices().__len__()}"
            )
            self.stdout.write(f"  skills (sample): {', '.join(skill_names)}")
            self.stdout.write(f"  {n_neighbors} nearest neighbours:")
            for n in neighbors:
                sim = 1 - float(n.d)
                self.stdout.write(
                    f"    #{n.offer_id:<8}  sim={sim:.3f}"
                    f"  {n.offer.job_title}"
                    f"  |  {n.offer.lead_main_category}"
                )

        self.stdout.write(self.style.SUCCESS("\nDone."))
