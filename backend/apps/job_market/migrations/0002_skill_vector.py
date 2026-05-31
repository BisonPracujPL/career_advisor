import pgvector.django
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("job_market", "0001_initial"),
    ]

    operations = [
        # Requires the pgvector/pgvector image (extension files available) and a
        # superuser connection. CREATE EXTENSION IF NOT EXISTS vector.
        pgvector.django.VectorExtension(),
        migrations.AddField(
            model_name="skill",
            name="vector_index",
            field=models.IntegerField(blank=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="extractedskills",
            name="skill_vector",
            field=pgvector.django.SparseVectorField(blank=True, null=True),
        ),
    ]
