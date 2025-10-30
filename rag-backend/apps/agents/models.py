from django.db import models


class QueryHistory(models.Model):
    """Store homepage chat query histories for auditing and replay."""
    question = models.TextField()
    response = models.TextField()
    logs = models.TextField()  # newline-joined text
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:  # pragma: no cover
        return f"QueryHistory(id={self.id}, created_at={self.created_at:%Y-%m-%d %H:%M:%S})"
