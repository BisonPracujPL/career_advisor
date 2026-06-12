from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("job_market", "0003_rename_job_market_job_lead_m_idx_job_offer_i_lead_ma_e9c987_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="skill",
            name="idf_weight",
            field=models.FloatField(
                default=1.0,
                help_text="Smoothed IDF weight for TF-IDF skill vectors (log((N+1)/(df+1))+1).",
            ),
        ),
    ]
