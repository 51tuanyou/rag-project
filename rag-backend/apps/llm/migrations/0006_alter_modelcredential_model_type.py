# Generated manually for model_type choices

from django.db import migrations, models


def normalize_model_type(apps, schema_editor):
    ModelCredential = apps.get_model("llm", "ModelCredential")
    mapping = {
        "llm": "LLM",
        "text embedding": "Text Embedding",
        "text_embedding": "Text Embedding",
        "speech2text": "Speech2text",
        "speech to text": "Speech2text",
        "moderation": "Moderation",
        "tts": "TTS",
    }
    for obj in ModelCredential.objects.all():
        raw = (obj.model_type or "").strip()
        normalized = mapping.get(raw.lower(), "LLM" if not raw else None)
        if normalized is None:
            # Keep unknown values that already match a choice label/value
            if raw in {
                "LLM",
                "Text Embedding",
                "Speech2text",
                "Moderation",
                "TTS",
            }:
                continue
            normalized = "LLM"
        if obj.model_type != normalized:
            obj.model_type = normalized
            obj.save(update_fields=["model_type"])


class Migration(migrations.Migration):

    dependencies = [
        ("llm", "0005_alter_modelcredential_completion_mode"),
    ]

    operations = [
        migrations.RunPython(normalize_model_type, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="modelcredential",
            name="model_type",
            field=models.CharField(
                choices=[
                    ("LLM", "LLM"),
                    ("Text Embedding", "Text Embedding"),
                    ("Speech2text", "Speech2text"),
                    ("Moderation", "Moderation"),
                    ("TTS", "TTS"),
                ],
                default="LLM",
                max_length=50,
            ),
        ),
    ]
