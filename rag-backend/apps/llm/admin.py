from django.contrib import admin

from .models import Provider, ProviderApiKey, ModelCredential


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = ("slug", "display_name", "enabled")
    search_fields = ("slug", "display_name")
    list_filter = ("enabled",)


@admin.register(ProviderApiKey)
class ProviderApiKeyAdmin(admin.ModelAdmin):
    list_display = ("provider", "name", "is_selected")
    list_filter = ("provider", "is_selected")
    search_fields = ("name", "provider__slug")


@admin.register(ModelCredential)
class ModelCredentialAdmin(admin.ModelAdmin):
    list_display = (
        "provider",
        "model_id",
        "model_name",
        "model_type",
        "enabled",
    )
    list_filter = ("provider", "model_type", "enabled")
    search_fields = ("model_id", "model_name", "provider__slug")
