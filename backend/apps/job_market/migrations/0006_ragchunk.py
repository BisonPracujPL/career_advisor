import django.db.models.deletion
from django.db import migrations, models
import pgvector.django


class Migration(migrations.Migration):

    dependencies = [
        ("job_market", "0005_alter_skill_idf_weight_userprofile"),
    ]

    operations = [
        migrations.CreateModel(
            name="RagChunk",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "source",
                    models.CharField(
                        db_index=True,
                        help_text="PDF filename stem (without .pdf), e.g. 'Hays-Poland_Raport-placowy-2026'",
                        max_length=255,
                    ),
                ),
                (
                    "chunk_idx",
                    models.PositiveIntegerField(
                        help_text="Position of this chunk within its source document (0-based).",
                    ),
                ),
                (
                    "text",
                    models.TextField(
                        help_text="Raw extracted text content of the chunk.",
                    ),
                ),
                (
                    "embedding",
                    pgvector.django.VectorField(
                        blank=True,
                        dimensions=384,
                        help_text="Embedding from paraphrase-multilingual-MiniLM-L12-v2 (384-dim).",
                        null=True,
                    ),
                ),
            ],
            options={
                "db_table": "rag_chunks",
            },
        ),
        migrations.AlterUniqueTogether(
            name="ragchunk",
            unique_together={("source", "chunk_idx")},
        ),
        migrations.AddIndex(
            model_name="ragchunk",
            index=models.Index(fields=["source"], name="rag_chunks_source_idx"),
        ),
    ]
