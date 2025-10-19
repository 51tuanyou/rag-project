from typing import Optional

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from .models import ModelCredential, Provider, ProviderApiKey
from .serializers import (
    ModelCredentialSerializer,
    ProviderApiKeySerializer,
    ProviderSerializer,
)


class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    lookup_field = "slug"

    @action(detail=True, methods=["post"], url_path="toggle")
    def toggle(self, request: Request, slug: Optional[str] = None) -> Response:
        provider = self.get_object()
        provider.enabled = bool(request.data.get("enabled", True))
        provider.save(update_fields=["enabled"])
        return Response(self.get_serializer(provider).data)

    @action(detail=True, methods=["get", "post"], url_path="keys")
    def keys(self, request: Request, slug: Optional[str] = None) -> Response:
        provider = self.get_object()
        if request.method.lower() == "get":
            keys = provider.api_keys.all().order_by("-is_selected", "name")
            return Response(ProviderApiKeySerializer(keys, many=True).data)

        # POST: create a new key
        data = {**request.data, "provider": provider.id}
        if not data.get("name"):
            next_index = provider.api_keys.count() + 1
            data["name"] = f"API_KEY{next_index}"
        serializer = ProviderApiKeySerializer(data=data)
        serializer.is_valid(raise_exception=True)
        key = serializer.save()
        if provider.api_keys.filter(is_selected=True).count() == 0:
            key.is_selected = True
            key.save(update_fields=["is_selected"])
        return Response(ProviderApiKeySerializer(key).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="select-key")
    def select_key(self, request: Request, slug: Optional[str] = None) -> Response:
        provider = self.get_object()
        name = request.data.get("name")
        if not name:
            return Response({"detail": "Missing 'name'"}, status=400)
        with transaction.atomic():
            ProviderApiKey.objects.filter(provider=provider, is_selected=True).update(
                is_selected=False
            )
            key = get_object_or_404(ProviderApiKey, provider=provider, name=name)
            key.is_selected = True
            key.save(update_fields=["is_selected"])
        return Response(ProviderApiKeySerializer(key).data)

    @action(detail=True, methods=["get", "patch", "delete"], url_path=r"keys/(?P<name>[^/]+)")
    def key_detail(self, request: Request, slug: Optional[str] = None, name: Optional[str] = None) -> Response:
        provider = self.get_object()
        key = get_object_or_404(ProviderApiKey, provider=provider, name=name)
        if request.method.lower() == "get":
            return Response(ProviderApiKeySerializer(key).data)
        if request.method.lower() == "patch":
            # allow updating secret/organization/api_base only
            for field in ("secret", "organization", "api_base"):
                if field in request.data:
                    setattr(key, field, request.data.get(field))
            key.save()
            return Response(ProviderApiKeySerializer(key).data)
        # delete
        key.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ModelCredentialViewSet(viewsets.ModelViewSet):
    queryset = ModelCredential.objects.select_related("provider").all()
    serializer_class = ModelCredentialSerializer

    @action(detail=True, methods=["post"], url_path="toggle")
    def toggle(self, request: Request, pk: Optional[str] = None) -> Response:
        mc = self.get_object()
        mc.enabled = bool(request.data.get("enabled", True))
        mc.save(update_fields=["enabled"])
        return Response(self.get_serializer(mc).data)
