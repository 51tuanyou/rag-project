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
    def toggle(self, request: Request, pk: Optional[str] = None) -> Response:
        provider = self.get_object()
        provider.enabled = bool(request.data.get("enabled", True))
        provider.save(update_fields=["enabled"])
        return Response(self.get_serializer(provider).data)

    @action(detail=True, methods=["post"], url_path="keys")
    def add_key(self, request: Request, pk: Optional[str] = None) -> Response:
        provider = self.get_object()
        serializer = ProviderApiKeySerializer(data={**request.data, "provider": provider.id})
        serializer.is_valid(raise_exception=True)
        key = serializer.save()
        return Response(ProviderApiKeySerializer(key).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="keys")
    def list_keys(self, request: Request, pk: Optional[str] = None) -> Response:
        provider = self.get_object()
        keys = provider.api_keys.all().order_by("-is_selected", "name")
        return Response(ProviderApiKeySerializer(keys, many=True).data)

    @action(detail=True, methods=["post"], url_path="select-key")
    def select_key(self, request: Request, pk: Optional[str] = None) -> Response:
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

    @action(detail=True, methods=["delete"], url_path=r"keys/(?P<name>[^/]+)")
    def delete_key(self, request: Request, pk: Optional[str] = None, name: Optional[str] = None) -> Response:
        provider = self.get_object()
        key = get_object_or_404(ProviderApiKey, provider=provider, name=name)
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
