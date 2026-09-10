from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("llm", "0006_alter_modelcredential_model_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="modelcredential",
            name="model_type",
            field=models.CharField(
                choices=[
                    ("LLM", "LLM"),
                    ("Text Embedding", "Text Embedding"),
                    ("Rerank", "Rerank"),
                    ("Speech2text", "Speech2text"),
                    ("Moderation", "Moderation"),
                    ("TTS", "TTS"),
                ],
                default="LLM",
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name="modelcredential",
            name="completion_mode",
            field=models.CharField(
                choices=[
                    ("Chat", "Chat"),
                    ("completion", "completion"),
                    ("embedding", "embedding"),
                    ("rerank", "rerank"),
                ],
                default="Chat",
                max_length=30,
            ),
        ),
    ]
