from django.apps import AppConfig


class KbConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.kb"
    
    def ready(self):
        import apps.kb.signals