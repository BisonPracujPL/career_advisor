"""Schema for job offers and the skills attached to them.

Three tables:

1. :class:`Skill`  – the LightCast skill dictionary (skill id -> English name +
   main category + subcategory). Sourced from ``lightcast_data_formatted.csv``
   (rows of ``type == 'skill'``) and ``lightcast_hier_mapper.json``.
2. :class:`JobOffer` – general information about a single offer.
3. :class:`ExtractedSkills` – one row per offer holding the whole set of
   extracted skills as a single JSON (JSONB) value::

       [{"skill_id": "KS1235V5W7TM41LP3N70", "probability": 0.62}, ...]

   Each ``skill_id`` references :class:`Skill` (the dictionary) by its id, so the
   name and categories are looked up there. Skills are *not* normalised into one
   row each — the offer's whole skill set lives in the ``skills`` JSON column.

Skills come from the ``mapped_skills`` JSON column of ``data_en_processed.csv``::

    {"match_skill": "...", "match_score": 0.62,
     "match_type": "skill",            # match_id is a LightCast skill id
     "match_id": "KS1235V5W7TM41LP3N70"}

Both match types map onto a dictionary id:
- ``match_type == 'skill'`` -> ``match_id`` is a LightCast skill id.
- ``match_type == 'most_common_level_1'`` -> ``match_id`` is a subcategory code,
  added to the dictionary as a synthetic ``is_category=True`` skill row.
"""

from django.contrib.postgres.fields import ArrayField
from django.db import models

# Probability threshold above which a skill match is considered reliable enough
# to "take". In the sample data scores range 0.1..1.0 (median ~0.75, p25 ~0.39),
# so 0.5 keeps the better half of matches. Tune as needed.
DEFAULT_SKILL_THRESHOLD = 0.5


class Skill(models.Model):
    """The LightCast skill dictionary: skill id -> name + categories.

    The primary key is the LightCast skill id itself (e.g. ``KS126XS6CQCFGC3NG79X``),
    so ``extracted_skills`` references that id directly. Each skill has at most one
    ``[main category, subcategory]`` pair in the LightCast hierarchy; both the
    code and the human-readable name are stored.
    """

    id = models.CharField(max_length=32, primary_key=True)  # LightCast skill id
    name = models.CharField(max_length=255, db_index=True)  # English description

    main_category_code = models.CharField(max_length=16, blank=True, db_index=True)
    main_category = models.CharField(max_length=128, blank=True)
    subcategory_code = models.CharField(max_length=16, blank=True, db_index=True)
    subcategory = models.CharField(max_length=128, blank=True)

    # Synthetic rows added for "most_common_level_1" matches: a subcategory used
    # as a skill (id = subcategory code). False for real LightCast skills.
    is_category = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "skills_dict"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class JobOffer(models.Model):
    """A single job offer (one CSV row)."""

    # ── Title / location ──────────────────────────────────────────────────
    job_title = models.CharField(max_length=255, db_index=True)
    workplaces = models.CharField(max_length=255, blank=True)
    district = models.CharField(max_length=255, blank=True)
    country_name = models.CharField(max_length=100, blank=True, db_index=True)
    region_name = models.CharField(max_length=100, blank=True, db_index=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # ── Categories (CSV stores comma-separated lists → arrays) ────────────
    main_category_names = ArrayField(models.CharField(max_length=128), default=list, blank=True)
    sub_category_names = ArrayField(models.CharField(max_length=128), default=list, blank=True)
    all_category_names = ArrayField(models.CharField(max_length=128), default=list, blank=True)
    lead_main_category = models.CharField(max_length=128, blank=True)
    lead_sub_category = models.CharField(max_length=128, blank=True)

    # ── Lifecycle ─────────────────────────────────────────────────────────
    start_date = models.DateTimeField(null=True, blank=True)
    expiration_date = models.DateTimeField(null=True, blank=True, db_index=True)

    # ── Free-text content ─────────────────────────────────────────────────
    requirements_optional = models.TextField(blank=True)
    requirements_expected = models.TextField(blank=True)
    responsibilities = models.TextField(blank=True)
    technologies_expected = models.TextField(blank=True)

    # ── Multi-value enums (comma-separated lists → arrays) ────────────────
    position_levels = ArrayField(models.CharField(max_length=128), default=list, blank=True)
    type_of_contract = ArrayField(models.CharField(max_length=64), default=list, blank=True)
    work_schedules = ArrayField(models.CharField(max_length=64), default=list, blank=True)
    work_modes = ArrayField(models.CharField(max_length=64), default=list, blank=True)
    keywords = ArrayField(models.CharField(max_length=128), default=list, blank=True)

    # ── Flags (CSV uses "true"/"false"/"null") ────────────────────────────
    is_remote_work = models.BooleanField(null=True, blank=True)
    is_remote_recruitment = models.BooleanField(null=True, blank=True)
    is_from_agency = models.BooleanField(null=True, blank=True)
    is_immediate_employment = models.BooleanField(null=True, blank=True)
    is_cv_optional = models.BooleanField(null=True, blank=True)
    multiple_vacancies = models.BooleanField(null=True, blank=True)
    multiple_vacancies_number = models.PositiveIntegerField(null=True, blank=True)

    language = models.CharField(max_length=8, blank=True, db_index=True)

    # ── Salary: contract of employment (umowa o pracę / "uop") ────────────
    salary_uop_from = models.DecimalField(max_digits=12, decimal_places=5, null=True, blank=True)
    salary_uop_to = models.DecimalField(max_digits=12, decimal_places=5, null=True, blank=True)
    salary_uop_currency = models.CharField(max_length=8, blank=True)
    salary_uop_duration = models.CharField(max_length=32, blank=True)
    salary_uop_kind = models.CharField(max_length=32, blank=True)

    # ── Salary: B2B contract ──────────────────────────────────────────────
    salary_b2b_from = models.DecimalField(max_digits=12, decimal_places=5, null=True, blank=True)
    salary_b2b_to = models.DecimalField(max_digits=12, decimal_places=5, null=True, blank=True)
    salary_b2b_currency = models.CharField(max_length=8, blank=True)
    salary_b2b_duration = models.CharField(max_length=32, blank=True)
    salary_b2b_kind = models.CharField(max_length=32, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "job_offer_info"
        indexes = [models.Index(fields=["lead_main_category", "lead_sub_category"])]
        ordering = ["-start_date"]

    def __str__(self) -> str:
        return self.job_title


class ExtractedSkills(models.Model):
    """The whole set of skills extracted from one offer, stored as JSON.

    One row per offer. ``skills`` is a JSONB array of objects::

        [{"skill_id": "KS1235V5W7TM41LP3N70", "probability": 0.62}, ...]

    Each ``skill_id`` references :class:`Skill` (the dictionary) by its id. The
    set is deduplicated per skill (highest probability kept) and only contains
    matches at or above the import threshold.
    """

    offer = models.OneToOneField(
        JobOffer,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="extracted",
    )
    skills = models.JSONField(default=list)

    class Meta:
        db_table = "extracted_skills"

    def __str__(self) -> str:
        return f"offer {self.offer_id}: {len(self.skills)} skills"
