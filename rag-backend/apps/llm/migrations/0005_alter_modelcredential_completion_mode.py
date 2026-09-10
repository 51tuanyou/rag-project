# Generated manually for completion_mode choices

from django.db import migrations, models


def normalize_completion_mode(apps, schema_editor):
    ModelCredential = apps.get_model("llm", "ModelCredential")
    mapping = {
        "chat": "Chat",
        "completion": "completion",
        "embedding": "embedding",
    }
    for obj in ModelCredential.objects.all():
        raw = (obj.completion_mode or "").strip()
        normalized = mapping.get(raw.lower(), "Chat")
        if obj.completion_mode != normalized:
            obj.completion_mode = normalized
            obj.save(update_fields=["completion_mode"])


class Migration(migrations.Migration):

    dependencies = [
        ("llm", "0004_alter_modelcredential_base_url"),
    ]

    operations = [
        migrations.RunPython(normalize_completion_mode, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="modelcredential",
            name="completion_mode",
            field=models.CharField(
                choices=[
                    ("Chat", "Chat"),
                    ("completion", "completion"),
                    ("embedding", "embedding"),
                ],
                default="Chat",
                max_length=30,
            ),
        ),
    ]
