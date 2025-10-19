from django.apps import AppConfig
from django.db.models.signals import post_migrate


class LlmConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.llm"

    def ready(self) -> None:  # noqa: D401
        from .models import Provider

        def seed_default_providers(**kwargs):
            defaults = [
                ("openai", "OpenAI"),
                ("deepseek", "deepseek"),
                ("tongyi", "TONGYI"),
                ("ollama", "Ollama"),
            ]
            for slug, name in defaults:
                Provider.objects.get_or_create(slug=slug, defaults={"display_name": name})

        post_migrate.connect(seed_default_providers, sender=self)
