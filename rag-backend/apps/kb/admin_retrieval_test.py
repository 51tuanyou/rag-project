"""
Admin configuration for retrieval test models
"""
from django.contrib import admin
from .models import RetrievalTestRecord, RetrievalTestResult


@admin.register(RetrievalTestRecord)
class RetrievalTestRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'knowledge_base', 'query_text_preview', 'created_at', 'created_by']
    list_filter = ['created_at', 'knowledge_base', 'created_by']
    search_fields = ['query_text', 'knowledge_base__name']
    readonly_fields = ['created_at']
    fieldsets = (
        ('Test Information', {
            'fields': ('knowledge_base', 'query_text', 'created_by')
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        })
    )
    
    def query_text_preview(self, obj):
        return obj.query_text[:50] + '...' if len(obj.query_text) > 50 else obj.query_text
    query_text_preview.short_description = 'Query Text'


@admin.register(RetrievalTestResult)
class RetrievalTestResultAdmin(admin.ModelAdmin):
    list_display = ['id', 'test_record', 'chunk', 'similarity_score', 'rank']
    list_filter = ['test_record__knowledge_base', 'test_record__created_at']
    search_fields = ['test_record__query_text', 'chunk__content', 'chunk__document__file_name']
    readonly_fields = ['similarity_score', 'rank']
    fieldsets = (
        ('Result Information', {
            'fields': ('test_record', 'chunk', 'similarity_score', 'rank')
        }),
    )
