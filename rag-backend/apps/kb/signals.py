"""
Signal handlers for KB models
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Chunk, Document
from apps.agents.services.word_count_service import WordCountService


@receiver(post_save, sender=Chunk)
def calculate_chunk_word_count(sender, instance, created, **kwargs):
    """
    Calculate and save word count when chunk is created or updated.

    Never call an external LLM here: create-knowledge-base saves many chunks in one
    request, and per-chunk LLM calls hang/timeout (504) when the model is slow or
    unreachable (common on local Docker).
    """
    if instance.content:
        word_count_service = WordCountService()
        word_count = word_count_service.count_words_smart(
            text=instance.content,
            use_llm=False,
        )

        # Update the word_count field if it's different
        if instance.word_count != word_count:
            # Use update to avoid re-entering this signal via instance.save()
            Chunk.objects.filter(id=instance.id).update(word_count=word_count)


@receiver(post_save, sender=Chunk)
@receiver(post_delete, sender=Chunk)
def update_document_statistics(sender, instance, **kwargs):
    """
    Update document statistics when chunks are modified
    """
    document = instance.document
    
    # Calculate total word count from all chunks
    total_word_count = sum(chunk.word_count for chunk in document.chunks.all())
    
    # Update document's word_count if it has changed
    # Note: We'll store this in a custom field or calculate on demand
    # For now, we'll just ensure chunks are properly calculated
    pass
