from rest_framework.routers import DefaultRouter

from .views import ModelCredentialViewSet, ProviderViewSet


router = DefaultRouter()
router.register(r"providers", ProviderViewSet, basename="provider")
router.register(r"models", ModelCredentialViewSet, basename="model-credential")

urlpatterns = router.urls

