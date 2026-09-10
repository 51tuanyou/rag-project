from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("kb", "0011_retrieval_test_models"),
    ]

    operations = [
        migrations.AlterField(
            model_name="chunksettings",
            name="chunk_type",
            field=models.CharField(
                choices=[
                    ("general", "General"),
                    ("qa", "Using Q&A"),
                    ("toc", "按目录结构"),
                ],
                help_text="Type of chunking: General, Q&A, or TOC",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="chunk",
            name="embedding_text",
            field=models.TextField(
                blank=True,
                help_text="Text used for vector embedding",
                null=True,
            ),
        ),
    ]
