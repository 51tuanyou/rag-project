from django.contrib import admin
from .models import ChunkSettings, KnowledgeBase, Document, Chunk


@admin.register(ChunkSettings)
class ChunkSettingsAdmin(admin.ModelAdmin):
    list_display = ['chunk_type', 'delimiter', 'max_length', 'overlap', 'created_at']
    list_filter = ['chunk_type', 'created_at']
    search_fields = ['chunk_type']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Information', {
            'fields': ('chunk_type',)
        }),
        ('General Settings', {
            'fields': ('delimiter', 'max_length', 'overlap', 'replace_spaces', 'delete_urls')
        }),
        ('Q&A Settings', {
            'fields': ('qa_format', 'qa_language', 'question_flag', 'answer_flag', 'qa_max_length'),
            'description': 'These settings are only used when chunk_type is "Using Q&A"'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(KnowledgeBase)
class KnowledgeBaseAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at', 'index_method', 'retrieval_mode', 'embedding_model', 'chunk_settings']
    list_filter = ['index_method', 'retrieval_mode', 'created_at', 'chunk_settings__chunk_type']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'created_by')
        }),
        ('Chunk Settings', {
            'fields': ('chunk_settings',)
        }),
        ('Index & Retrieval Settings', {
            'fields': ('index_method', 'retrieval_mode', 'embedding_model')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'knowledge_base', 'status', 'file_size', 'get_word_count', 'get_chunk_count', 'uploaded_at', 'processed_at']
    list_filter = ['status', 'file_type', 'uploaded_at', 'knowledge_base']
    search_fields = ['file_name', 'file_path', 'knowledge_base__name']
    readonly_fields = ['uploaded_at', 'processed_at']
    fieldsets = (
        ('Document Information', {
            'fields': ('knowledge_base', 'file_name', 'file_path', 'file_size', 'file_type')
        }),
        ('Processing Status', {
            'fields': ('status', 'uploaded_at', 'processed_at')
        })
    )
    
    def get_word_count(self, obj):
        return sum(chunk.word_count for chunk in obj.chunks.all())
    get_word_count.short_description = 'Word Count'
    
    def get_chunk_count(self, obj):
        return obj.chunks.count()
    get_chunk_count.short_description = 'Chunk Count'


@admin.register(Chunk)
class ChunkAdmin(admin.ModelAdmin):
    list_display = ['chunk_id', 'document', 'chunk_number', 'characters', 'word_count', 'created_at']
    list_filter = ['created_at', 'document__knowledge_base', 'document__file_name']
    search_fields = ['chunk_id', 'content', 'document__file_name', 'document__knowledge_base__name']
    readonly_fields = ['created_at', 'word_count']
    fieldsets = (
        ('Chunk Information', {
            'fields': ('document', 'chunk_id', 'chunk_number', 'characters', 'word_count')
        }),
        ('Content', {
            'fields': ('content',)
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        })
    )
