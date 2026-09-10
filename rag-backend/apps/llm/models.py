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
    organization = models.CharField(max_length=120, blank=True, null=True)
    api_base = models.URLField(max_length=300, blank=True, null=True)
    is_selected = models.BooleanField(default=False)

    class Meta:
        unique_together = ("provider", "name")


class ModelCredential(models.Model):
    """Per-model connection details such as base URL and capabilities."""

    class ModelType(models.TextChoices):
        LLM = "LLM", "LLM"
        TEXT_EMBEDDING = "Text Embedding", "Text Embedding"
        RERANK = "Rerank", "Rerank"
        SPEECH2TEXT = "Speech2text", "Speech2text"
        MODERATION = "Moderation", "Moderation"
        TTS = "TTS", "TTS"

    class CompletionMode(models.TextChoices):
        CHAT = "Chat", "Chat"
        COMPLETION = "completion", "completion"
        EMBEDDING = "embedding", "embedding"
        RERANK = "rerank", "rerank"

    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="models")
    model_id = models.CharField(max_length=120)
    model_name = models.CharField(max_length=120)
    model_type = models.CharField(
        max_length=50,
        choices=ModelType.choices,
        default=ModelType.LLM,
    )
    base_url = models.URLField(max_length=300, blank=True, null=True)
    # Optional per-model overrides
    secret = models.TextField(blank=True, null=True)
    organization = models.CharField(max_length=120, blank=True, null=True)
    context_size = models.PositiveIntegerField(default=4096)
    max_tokens = models.PositiveIntegerField(default=4096)
    completion_mode = models.CharField(
        max_length=30,
        choices=CompletionMode.choices,
        default=CompletionMode.CHAT,
    )
    vision_support = models.BooleanField(default=False)
    function_call_support = models.BooleanField(default=False)
    enabled = models.BooleanField(default=True)

    class Meta:
        unique_together = ("provider", "model_id")
        ordering = ["provider__slug", "model_name"]
