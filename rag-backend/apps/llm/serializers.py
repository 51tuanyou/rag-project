from typing import List, Optional

from rest_framework import serializers

from .models import ModelCredential, Provider, ProviderApiKey


class ProviderApiKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderApiKey
        fields = ["id", "provider", "name", "secret", "is_selected"]
        extra_kwargs = {"secret": {"write_only": True}}


class ModelCredentialSerializer(serializers.ModelSerializer):
    # expose UI-friendly fields as well
    name = serializers.CharField(source="model_name", read_only=True)
    tags = serializers.SerializerMethodField(read_only=True)
    provider = serializers.SlugRelatedField(slug_field="slug", queryset=Provider.objects.all())

    class Meta:
        model = ModelCredential
        fields = [
            "id",
            "provider",
            "model_id",
            "model_name",
            "model_type",
            "base_url",
            "context_size",
            "max_tokens",
            "completion_mode",
            "vision_support",
            "function_call_support",
            "enabled",
            # extras for FE
            "name",
            "tags",
        ]

    def get_tags(self, obj: ModelCredential) -> List[str]:
        return [obj.model_type] if obj.model_type else []


class ProviderSerializer(serializers.ModelSerializer):
    # nested
    models = ModelCredentialSerializer(many=True, read_only=True)
    apiKeys = serializers.SerializerMethodField()
    selectedKey = serializers.SerializerMethodField()
    id = serializers.CharField(source="slug")
    name = serializers.CharField(source="display_name")
    badges = serializers.SerializerMethodField()

    class Meta:
        model = Provider
        fields = [
            "id",
            "name",
            "badges",
            "enabled",
            "models",
            # FE-convenience fields
            "apiKeys",
            "selectedKey",
        ]

    def get_apiKeys(self, obj: Provider) -> List[str]:
        return list(obj.api_keys.order_by("name").values_list("name", flat=True))

    def get_selectedKey(self, obj: Provider) -> Optional[int]:
        ordered = list(obj.api_keys.order_by("name"))
        for idx, key in enumerate(ordered):
            if key.is_selected:
                return idx
        return None

    def get_badges(self, obj: Provider) -> List[str]:
        # collect distinct model types as badges
        return sorted({m.model_type for m in obj.models.all() if m.model_type})

