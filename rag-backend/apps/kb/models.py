from django.db import models
from django.contrib.auth.models import User
from apps.llm.models import ModelCredential


class ChunkSettings(models.Model):
    """Chunk settings model to store chunking configuration"""
    CHUNK_TYPE_CHOICES = [
        ('general', 'General'),
        ('qa', 'Using Q&A'),
    ]
    
    chunk_type = models.CharField(max_length=10, choices=CHUNK_TYPE_CHOICES, help_text="Type of chunking: General or Q&A")
    
    # General settings (used for both types)
    delimiter = models.CharField(max_length=100, default='\\n\\n')
    max_length = models.IntegerField(default=1024)
    overlap = models.IntegerField(default=50)
    replace_spaces = models.BooleanField(default=True)
    delete_urls = models.BooleanField(default=False)
    
    # Q&A specific settings (only used when chunk_type='qa')
    qa_format = models.BooleanField(default=False)
    qa_language = models.CharField(max_length=50, default='English')
    question_flag = models.CharField(max_length=50, default='Q: ')
    answer_flag = models.CharField(max_length=50, default='A: ')
    qa_max_length = models.IntegerField(default=1024)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'kb_chunk_settings'
        verbose_name = 'Chunk Settings'
        verbose_name_plural = 'Chunk Settings'
    
    def __str__(self):
        return f"{self.get_chunk_type_display()} Settings"


class KnowledgeBase(models.Model):
    """Knowledge base model to store knowledge base information"""
    name = models.CharField(max_length=255, help_text="Knowledge base name")
    description = models.TextField(blank=True, null=True, help_text="Knowledge base description")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    
    # Chunk settings reference
    chunk_settings = models.ForeignKey(ChunkSettings, on_delete=models.CASCADE, null=True, blank=True, help_text="Chunking configuration")
    
    # Index and retrieval settings
    index_method = models.CharField(max_length=10, choices=[('hq', 'High Quality'), ('eco', 'Economical')], default='hq')
    retrieval_mode = models.CharField(max_length=20, choices=[('vector', 'Vector'), ('fulltext', 'Full-Text'), ('hybrid', 'Hybrid')], default='vector')
    embedding_model = models.ForeignKey(ModelCredential, on_delete=models.CASCADE, null=True, blank=True)
    
    class Meta:
        db_table = 'kb_knowledge_base'
        verbose_name = 'Knowledge Base'
        verbose_name_plural = 'Knowledge Bases'
    
    def __str__(self):
        return self.name


class Document(models.Model):
    """Document model to store document information"""
    knowledge_base = models.ForeignKey(KnowledgeBase, on_delete=models.CASCADE, related_name='documents')
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size = models.BigIntegerField()
    file_type = models.CharField(max_length=50)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('uploaded', 'Uploaded'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ], default='uploaded')
    
    class Meta:
        db_table = 'kb_document'
        verbose_name = 'Document'
        verbose_name_plural = 'Documents'
    
    def __str__(self):
        return f"{self.file_name} ({self.knowledge_base.name})"


class Chunk(models.Model):
    """Chunk model to store document chunks"""
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='chunks')
    chunk_id = models.CharField(max_length=100)
    content = models.TextField()
    characters = models.IntegerField()
    chunk_number = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'kb_chunk'
        verbose_name = 'Chunk'
        verbose_name_plural = 'Chunks'
        ordering = ['chunk_number']
    
    def __str__(self):
        return f"Chunk {self.chunk_number} of {self.document.file_name}"
