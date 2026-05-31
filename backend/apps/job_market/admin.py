from django.contrib import admin

from .models import ExtractedSkills, JobOffer, Skill


class ExtractedSkillsInline(admin.StackedInline):
    model = ExtractedSkills
    extra = 0


@admin.register(JobOffer)
class JobOfferAdmin(admin.ModelAdmin):
    list_display = ["job_title", "lead_main_category", "region_name", "country_name", "start_date"]
    list_filter = ["lead_main_category", "country_name", "language", "is_remote_work"]
    search_fields = ["job_title", "responsibilities", "requirements_expected"]
    date_hierarchy = "start_date"
    inlines = [ExtractedSkillsInline]


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ["vector_index", "id", "name", "main_category", "subcategory", "is_category"]
    list_filter = ["is_category", "main_category"]
    search_fields = ["id", "name"]
    ordering = ["vector_index"]


@admin.register(ExtractedSkills)
class ExtractedSkillsAdmin(admin.ModelAdmin):
    list_display = ["offer", "skill_count", "has_vector"]
    search_fields = ["offer__job_title"]

    @admin.display(description="skills")
    def skill_count(self, obj):
        return len(obj.skills or [])

    @admin.display(description="vector", boolean=True)
    def has_vector(self, obj):
        return obj.skill_vector is not None
