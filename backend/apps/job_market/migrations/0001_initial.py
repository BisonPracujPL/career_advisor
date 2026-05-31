import django.contrib.postgres.fields
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Skill",
            fields=[
                ("id", models.CharField(max_length=32, primary_key=True, serialize=False)),
                ("name", models.CharField(db_index=True, max_length=255)),
                ("main_category_code", models.CharField(blank=True, db_index=True, max_length=16)),
                ("main_category", models.CharField(blank=True, max_length=128)),
                ("subcategory_code", models.CharField(blank=True, db_index=True, max_length=16)),
                ("subcategory", models.CharField(blank=True, max_length=128)),
                ("is_category", models.BooleanField(db_index=True, default=False)),
            ],
            options={"db_table": "skills_dict", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="JobOffer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("job_title", models.CharField(db_index=True, max_length=255)),
                ("workplaces", models.CharField(blank=True, max_length=255)),
                ("district", models.CharField(blank=True, max_length=255)),
                ("country_name", models.CharField(blank=True, db_index=True, max_length=100)),
                ("region_name", models.CharField(blank=True, db_index=True, max_length=100)),
                ("latitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("longitude", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                (
                    "main_category_names",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=128), blank=True, default=list, size=None
                    ),
                ),
                (
                    "sub_category_names",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=128), blank=True, default=list, size=None
                    ),
                ),
                (
                    "all_category_names",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=128), blank=True, default=list, size=None
                    ),
                ),
                ("lead_main_category", models.CharField(blank=True, max_length=128)),
                ("lead_sub_category", models.CharField(blank=True, max_length=128)),
                ("start_date", models.DateTimeField(blank=True, null=True)),
                ("expiration_date", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("requirements_optional", models.TextField(blank=True)),
                ("requirements_expected", models.TextField(blank=True)),
                ("responsibilities", models.TextField(blank=True)),
                ("technologies_expected", models.TextField(blank=True)),
                (
                    "position_levels",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=128), blank=True, default=list, size=None
                    ),
                ),
                (
                    "type_of_contract",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=64), blank=True, default=list, size=None
                    ),
                ),
                (
                    "work_schedules",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=64), blank=True, default=list, size=None
                    ),
                ),
                (
                    "work_modes",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=64), blank=True, default=list, size=None
                    ),
                ),
                (
                    "keywords",
                    django.contrib.postgres.fields.ArrayField(
                        base_field=models.CharField(max_length=128), blank=True, default=list, size=None
                    ),
                ),
                ("is_remote_work", models.BooleanField(blank=True, null=True)),
                ("is_remote_recruitment", models.BooleanField(blank=True, null=True)),
                ("is_from_agency", models.BooleanField(blank=True, null=True)),
                ("is_immediate_employment", models.BooleanField(blank=True, null=True)),
                ("is_cv_optional", models.BooleanField(blank=True, null=True)),
                ("multiple_vacancies", models.BooleanField(blank=True, null=True)),
                ("multiple_vacancies_number", models.PositiveIntegerField(blank=True, null=True)),
                ("language", models.CharField(blank=True, db_index=True, max_length=8)),
                ("salary_uop_from", models.DecimalField(blank=True, decimal_places=5, max_digits=12, null=True)),
                ("salary_uop_to", models.DecimalField(blank=True, decimal_places=5, max_digits=12, null=True)),
                ("salary_uop_currency", models.CharField(blank=True, max_length=8)),
                ("salary_uop_duration", models.CharField(blank=True, max_length=32)),
                ("salary_uop_kind", models.CharField(blank=True, max_length=32)),
                ("salary_b2b_from", models.DecimalField(blank=True, decimal_places=5, max_digits=12, null=True)),
                ("salary_b2b_to", models.DecimalField(blank=True, decimal_places=5, max_digits=12, null=True)),
                ("salary_b2b_currency", models.CharField(blank=True, max_length=8)),
                ("salary_b2b_duration", models.CharField(blank=True, max_length=32)),
                ("salary_b2b_kind", models.CharField(blank=True, max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"db_table": "job_offer_info", "ordering": ["-start_date"]},
        ),
        migrations.CreateModel(
            name="ExtractedSkills",
            fields=[
                (
                    "offer",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        serialize=False,
                        related_name="extracted",
                        to="job_market.joboffer",
                    ),
                ),
                ("skills", models.JSONField(default=list)),
            ],
            options={"db_table": "extracted_skills"},
        ),
        migrations.AddIndex(
            model_name="joboffer",
            index=models.Index(
                fields=["lead_main_category", "lead_sub_category"], name="job_market_job_lead_m_idx"
            ),
        ),
    ]
