"""Load the LightCast skill dictionary into the Skill table.

Sources:
- ``lightcast_data_formatted.csv``  (rows of type 'skill': id, description,
  hierarchy_levels)
- ``lightcast_hier_mapper.json``    (hierarchy code -> human-readable name)

Usage (inside the backend container)::

    python manage.py load_skills /data/lightcast_data_formatted.csv /data/lightcast_hier_mapper.json
"""

import ast
import csv
import json
import sys

from django.core.management.base import BaseCommand

from apps.job_market.models import Skill

csv.field_size_limit(sys.maxsize)


class Command(BaseCommand):
    help = "Load the LightCast skill dictionary (id -> name + categories)."

    def add_arguments(self, parser):
        parser.add_argument("skills_csv")
        parser.add_argument("hier_mapper_json")
        parser.add_argument("--batch", type=int, default=5000)

    def handle(self, *args, **opts):
        mapper = json.load(open(opts["hier_mapper_json"], encoding="utf-8"))

        batch, total = [], 0
        with open(opts["skills_csv"], newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["type"] != "skill":  # skip category / subcategory rows
                    continue
                main_code, sub_code = self._hierarchy(row["hierarchy_levels"])
                batch.append(
                    Skill(
                        id=row["id"],
                        name=row["description"],
                        main_category_code=main_code,
                        main_category=mapper.get(main_code, ""),
                        subcategory_code=sub_code,
                        subcategory=mapper.get(sub_code, ""),
                        is_category=False,
                    )
                )
                if len(batch) >= opts["batch"]:
                    total += self._flush(batch)
                    batch = []
        total += self._flush(batch)
        self.stdout.write(self.style.SUCCESS(f"Loaded {total} LightCast skills."))

        synthetic = self._synthetic_subcategory_skills(mapper)
        self._flush(synthetic)
        self.stdout.write(
            self.style.SUCCESS(
                f"Added {len(synthetic)} synthetic subcategory-as-skill rows "
                f"(for 'most_common_level_1' matches)."
            )
        )

    @staticmethod
    def _synthetic_subcategory_skills(mapper):
        """One Skill per subcategory (3-part code, e.g. '19.0.511.0').

        The subcategory becomes the skill itself; the main category stays the real
        parent category derived from the code prefix (e.g. '19.0').
        """
        rows = []
        for code, name in mapper.items():
            if code.count(".") != 3:  # only subcategory codes
                continue
            parts = code.split(".")
            main_code = f"{parts[0]}.{parts[1]}"
            rows.append(
                Skill(
                    id=code,
                    name=name,
                    main_category_code=main_code,
                    main_category=mapper.get(main_code, ""),
                    subcategory_code=code,
                    subcategory=name,
                    is_category=True,
                )
            )
        return rows

    @staticmethod
    def _hierarchy(raw):
        """Return (main_category_code, subcategory_code) from a hierarchy_levels cell.

        The cell looks like ``[['17.0', '17.0.442.0']]`` or is empty. Each skill
        has at most one pair: [main category code, subcategory code].
        """
        raw = (raw or "").strip()
        if not raw:
            return "", ""
        try:
            pairs = ast.literal_eval(raw)
        except (ValueError, SyntaxError):
            return "", ""
        if not pairs:
            return "", ""
        pair = pairs[0]
        main_code = pair[0] if len(pair) > 0 else ""
        sub_code = pair[1] if len(pair) > 1 else ""
        return main_code, sub_code

    def _flush(self, batch):
        if not batch:
            return 0
        Skill.objects.bulk_create(
            batch,
            update_conflicts=True,
            unique_fields=["id"],
            update_fields=[
                "name", "main_category_code", "main_category",
                "subcategory_code", "subcategory", "is_category",
            ],
        )
        return len(batch)
