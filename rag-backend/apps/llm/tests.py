from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Provider


class ProviderApiTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.provider = Provider.objects.create(slug="openai", display_name="OpenAI")

    def test_toggle_provider(self) -> None:
        url = reverse("provider-toggle", args=[self.provider.pk])
        res = self.client.post(url, {"enabled": False}, format="json")
        self.assertEqual(res.status_code, 200)
        self.provider.refresh_from_db()
        self.assertFalse(self.provider.enabled)
