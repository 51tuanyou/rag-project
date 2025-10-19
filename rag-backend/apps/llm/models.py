from django.db import models


class Provider(models.Model):
    """An LLM provider such as OpenAI, DeepSeek, Ollama, etc."""

    slug = models.SlugField(max_length=50, unique=True)
    display_name = models.CharField(max_length=100)
    enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ["slug"]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.display_name


class ProviderApiKey(models.Model):
    """Stores one or more API keys per provider; optionally selected as current."""

    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=100, help_text="Human-readable alias, e.g. API_KEY1")
    secret = models.TextField()
    is_selected = models.BooleanField(default=False)

    class Meta:
        unique_together = ("provider", "name")


class ModelCredential(models.Model):
    """Per-model connection details such as base URL and capabilities."""

    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="models")
    model_id = models.CharField(max_length=120)
    model_name = models.CharField(max_length=120)
    model_type = models.CharField(max_length=50)  # e.g. LLM, TEXT EMBEDDING
    base_url = models.URLField(max_length=300)
    context_size = models.PositiveIntegerField(default=4096)
    max_tokens = models.PositiveIntegerField(default=4096)
    completion_mode = models.CharField(max_length=30, default="Chat")  # Chat/Completion
    vision_support = models.BooleanField(default=False)
    function_call_support = models.BooleanField(default=False)
    enabled = models.BooleanField(default=True)

    class Meta:
        unique_together = ("provider", "model_id")
        ordering = ["provider__slug", "model_name"]
