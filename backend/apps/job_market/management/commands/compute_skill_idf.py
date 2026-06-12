"""Compute smoothed IDF weights per skill from the loaded offer corpus.

Document frequency ``df`` = number of offers whose ``extracted_skills.skills``
JSON contains the skill. Then::

    idf = log((N + 1) / (df + 1)) + 1

Rare skills get higher weight; very common skills (e.g. Communication) are
down-weighted. Run after ``load_offers``, then rebuild vectors with::

    python manage.py build_skill_vectors --vector-value tfidf
"""

import math
from collections import Counter

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.job_market.models import ExtractedSkills, Skill


class Command(BaseCommand):
    help = "Compute and store smoothed IDF weights on Skill.idf_weight."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch",
            type=int,
            default=5000,
            help="Offers per progress log line.",
        )

    def handle(self, *args, **opts):
        batch = opts["batch"]
        df: Counter[str] = Counter()
        n_offers = 0

        self.stdout.write("Counting skill document frequencies…")
        for es in ExtractedSkills.objects.only("skills").iterator(chunk_size=batch):
            n_offers += 1
            for entry in es.skills or []:
                sid = entry.get("skill_id")
                if sid:
                    df[sid] += 1
            if n_offers % batch == 0:
                self.stdout.write(f"  scanned {n_offers:,} offers…")

        if not n_offers:
            self.stderr.write(self.style.ERROR("No offers in extracted_skills."))
            return

        self.stdout.write(
            f"Corpus: {n_offers:,} offers, {len(df):,} distinct skills with df>0."
        )

        skills = list(Skill.objects.exclude(vector_index__isnull=True))
        for s in skills:
            dfi = df.get(s.id, 0)
            s.idf_weight = math.log((n_offers + 1) / (dfi + 1)) + 1.0

        with transaction.atomic():
            Skill.objects.bulk_update(skills, ["idf_weight"], batch_size=2000)

        # Quick sanity: most vs least common among skills that appear in offers
        ranked = sorted(
            ((sid, cnt) for sid, cnt in df.items()),
            key=lambda x: x[1],
            reverse=True,
        )
        idf_by_id = {s.id: s.idf_weight for s in skills}
        self.stdout.write("Top common skills (low IDF):")
        for sid, cnt in ranked[:5]:
            name = Skill.objects.filter(id=sid).values_list("name", flat=True).first()
            self.stdout.write(
                f"  df={cnt:6,} idf={idf_by_id.get(sid, 1):.3f}  {name or sid}"
            )
        self.stdout.write("Rare skills in corpus (high IDF):")
        for sid, cnt in ranked[-5:]:
            if cnt == 0:
                continue
            name = Skill.objects.filter(id=sid).values_list("name", flat=True).first()
            self.stdout.write(
                f"  df={cnt:6,} idf={idf_by_id.get(sid, 1):.3f}  {name or sid}"
            )

        self.stdout.write(
            self.style.SUCCESS(f"Updated idf_weight for {len(skills):,} indexed skills.")
        )
