"""Load job offers + their extracted skill set from data_en_processed.csv.

Usage (inside the backend container)::

    python manage.py load_offers /data/data_en_processed.csv
    python manage.py load_offers /data/data_en_processed.csv --threshold 0.6 --limit 1000

Each offer is written to ``job_offer_info`` and its whole skill set is stored as
one JSON value in ``extracted_skills`` (one row per offer). Only skill matches
whose probability (``match_score``) is >= ``--threshold`` are kept.
"""

import csv
import json
import sys
from datetime import datetime

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.dateparse import parse_datetime

from apps.job_market.models import (
    DEFAULT_SKILL_THRESHOLD,
    ExtractedSkills,
    JobOffer,
    Skill,
)
from apps.job_market.vectors import (
    VECTOR_VALUE_CHOICES,
    build_skill_vector,
    skill_index_map,
)

# Both match types resolve onto a Skill dictionary id:
#  - "skill"               -> match_id is a LightCast skill id
#  - "most_common_level_1" -> match_id is a subcategory code, present as a
#                             synthetic (is_category=True) skill row.
# A match is kept iff its match_id exists in the dictionary.

csv.field_size_limit(sys.maxsize)

# CSV column -> JobOffer field (scalar 1:1 columns)
SCALAR = {
    "jobTitle": "job_title",
    "workplaces": "workplaces",
    "district": "district",
    "countryName": "country_name",
    "regionName": "region_name",
    "leadMainCategory": "lead_main_category",
    "leadSubCategory": "lead_sub_category",
    "requirements-optional": "requirements_optional",
    "requirements-expected": "requirements_expected",
    "responsibilities": "responsibilities",
    "technologies-expected": "technologies_expected",
    "language": "language",
    "salary_uop_currency": "salary_uop_currency",
    "salary_uop_duration": "salary_uop_duration",
    "salary_uop_kind": "salary_uop_kind",
    "salary_b2b_currency": "salary_b2b_currency",
    "salary_b2b_duration": "salary_b2b_duration",
    "salary_b2b_kind": "salary_b2b_kind",
}
ARRAYS = {
    "mainCategoryNames": "main_category_names",
    "subCategoryNames": "sub_category_names",
    "allCategoryNames": "all_category_names",
    "positionLevels": "position_levels",
    "typeOfContract": "type_of_contract",
    "workSchedules": "work_schedules",
    "workModes": "work_modes",
    "keywords": "keywords",
}
BOOLS = {
    "isRemoteWork": "is_remote_work",
    "isRemoteRecruitment": "is_remote_recruitment",
    "isFromAgency": "is_from_agency",
    "isImmediateEmployment": "is_immediate_employment",
    "isCvOptional": "is_cv_optional",
    "multipleVacancies": "multiple_vacancies",
}
DECIMALS = {
    "latitude": "latitude",
    "longitude": "longitude",
    "salary_uop_from": "salary_uop_from",
    "salary_uop_to": "salary_uop_to",
    "salary_b2b_from": "salary_b2b_from",
    "salary_b2b_to": "salary_b2b_to",
}
DATES = {"startDate": "start_date", "expirationDate": "expiration_date"}


def clean(value):
    if value is None:
        return None
    v = value.strip()
    return None if v in ("", "null", "NULL") else v


def to_bool(value):
    v = clean(value)
    if v is None:
        return None
    return v.lower() == "true"


def to_list(value):
    v = clean(value)
    return [p.strip() for p in v.split(",") if p.strip()] if v else []


def to_dt(value):
    v = clean(value)
    if not v:
        return None
    return parse_datetime(v) or datetime.fromisoformat(v.replace("Z", "+00:00"))


class Command(BaseCommand):
    help = "Load job offers and extracted skills from the processed CSV."

    def add_arguments(self, parser):
        parser.add_argument("csv_path")
        parser.add_argument("--threshold", type=float, default=DEFAULT_SKILL_THRESHOLD)
        parser.add_argument(
            "--limit", type=int, default=None, help="Stop after N rows."
        )
        parser.add_argument(
            "--batch", type=int, default=1000, help="Offers per DB batch."
        )
        parser.add_argument(
            "--vector-value",
            choices=VECTOR_VALUE_CHOICES,
            default="binary",
            help="Value stored per present skill in skill_vector: "
            "'binary' (1.0) or 'probability' (match score).",
        )

    def handle(self, *args, **opts):
        path, threshold, limit = opts["csv_path"], opts["threshold"], opts["limit"]
        batch_size = opts["batch"]
        self.vector_value = opts["vector_value"]
        # The Skill dictionary (LightCast) must be loaded first; we only keep
        # skills that exist there.
        known_skill_ids = set(Skill.objects.values_list("id", flat=True))
        if not known_skill_ids:
            self.stderr.write(
                self.style.WARNING(
                    "Skill dictionary is empty. Run `load_skills` first, "
                    "otherwise no skills will be stored."
                )
            )
        # skill_id -> vector position; the vector's dimension is the dictionary size.
        self.index_map = skill_index_map()
        self.vector_dim = len(self.index_map)
        if known_skill_ids and not self.vector_dim:
            self.stderr.write(
                self.style.WARNING(
                    "Skills have no vector_index yet. Re-run `load_skills` so "
                    "skill vectors can be built; storing offers without vectors."
                )
            )
        self.n_offers = self.n_skills = self.n_skipped = 0
        batch = []  # list of (JobOffer, skills_json)

        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if limit and i >= limit:
                    break
                offer = self._build_offer(row)
                skills = self._build_skill_set(row, threshold, known_skill_ids)
                batch.append((offer, skills))
                if len(batch) >= batch_size:
                    self._flush(batch)
                    batch = []
        self._flush(batch)

        self.stdout.write(
            self.style.SUCCESS(
                f"Done: {self.n_offers} offers, {self.n_skills} skills stored "
                f"(threshold={threshold}); {self.n_skipped} matches skipped "
                f"(unknown skill id)."
            )
        )

    @transaction.atomic
    def _flush(self, batch):
        if not batch:
            return
        offers = JobOffer.objects.bulk_create([offer for offer, _ in batch])
        extracted = [
            ExtractedSkills(
                offer=offer,
                skills=skills,
                skill_vector=build_skill_vector(
                    skills, self.index_map, self.vector_dim, self.vector_value
                ),
            )
            for offer, (_, skills) in zip(offers, batch)
        ]
        ExtractedSkills.objects.bulk_create(extracted)
        self.n_offers += len(offers)
        self.n_skills += sum(len(e.skills) for e in extracted)
        self.stdout.write(f"  {self.n_offers} offers…")

    def _build_offer(self, row):
        from decimal import Decimal, InvalidOperation

        data = {field: clean(row.get(col)) or "" for col, field in SCALAR.items()}

        # Automatyczne przycinanie zbyt długich tekstów do limitów bazy danych (np. 255 znaków)
        for field, value in list(data.items()):
            max_len = JobOffer._meta.get_field(field).max_length
            if max_len and len(value) > max_len:
                data[field] = value[:max_len]

        data.update({field: to_list(row.get(col)) for col, field in ARRAYS.items()})
        data.update({field: to_bool(row.get(col)) for col, field in BOOLS.items()})

        # Bezpieczne wczytywanie liczb dziesiętnych (Decimal) z zabezpieczeniem przed overflow
        decimal_data = {}
        for col, field in DECIMALS.items():
            val_str = clean(row.get(col))
            if val_str:
                try:
                    # Usunięcie spacji (np. "12 000") i zamiana przecinków na kropki
                    cleaned_val_str = val_str.replace(" ", "").replace(",", ".")
                    val_dec = Decimal(cleaned_val_str)

                    # Dynamiczne sprawdzanie limitów zdefiniowanych w modelu Django
                    model_field = JobOffer._meta.get_field(field)
                    max_digits = model_field.max_digits
                    decimal_places = model_field.decimal_places
                    max_integer_digits = max_digits - decimal_places

                    # Jeśli wartość wykracza poza dozwolony limit (np. >= 10^7 dla salary uop/b2b), przycinamy ją
                    limit_value = 10**max_integer_digits
                    if abs(val_dec) >= limit_value:
                        sign = -1 if val_dec < 0 else 1
                        val_dec = Decimal(limit_value - 1) * sign

                    decimal_data[field] = val_dec
                except (InvalidOperation, ValueError):
                    decimal_data[field] = None
            else:
                decimal_data[field] = None
        data.update(decimal_data)

        data.update({field: to_dt(row.get(col)) for col, field in DATES.items()})
        mvn = clean(row.get("multipleVacanciesNumber"))
        data["multiple_vacancies_number"] = int(mvn) if mvn and mvn.isdigit() else None
        return JobOffer(**data)

    def _build_skill_set(self, row, threshold, known_skill_ids):
        """Return the offer's skill set as a JSON-ready list of dicts.

        ``[{"skill_id": "...", "probability": 0.62}, ...]`` — deduplicated per
        skill (highest probability), only matches >= threshold with a known id.
        """
        raw = clean(row.get("mapped_skills"))
        if not raw:
            return []
        try:
            items = json.loads(raw)
        except json.JSONDecodeError:
            return []

        best = {}  # skill_id -> highest score
        for obj in items:
            if not isinstance(obj, dict):
                continue
            score = obj.get("match_score")
            if score is None or score < threshold:
                continue
            skill_id = str(obj.get("match_id"))
            if skill_id not in known_skill_ids:
                self.n_skipped += 1
                continue
            if skill_id not in best or score > best[skill_id]:
                best[skill_id] = score

        return [{"skill_id": sid, "probability": score} for sid, score in best.items()]
