from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("kb", "0012_toc_chunk_type_and_embedding_text"),
    ]

    operations = [
        migrations.AddField(
            model_name="chunksettings",
            name="toc_level",
            field=models.IntegerField(
                default=3,
                help_text="Directory depth used as the chunk boundary, 1 to 6",
            ),
        ),
    ]
