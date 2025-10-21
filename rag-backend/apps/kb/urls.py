"""
URL configuration for kb app
"""
from django.urls import path
from . import views

urlpatterns = [
    path('upload-file/', views.upload_file, name='upload-file'),
    path('preview-chunks/', views.preview_chunks, name='preview-chunks'),
    path('update-chunk/', views.update_chunk, name='update-chunk'),
    path('delete-chunk/<str:chunk_id>/', views.delete_chunk, name='delete-chunk'),
    path('add-chunk/', views.add_chunk, name='add-chunk'),
    path('create-knowledge-base/', views.create_knowledge_base, name='create-knowledge-base'),
    path('check-knowledge-base-name/', views.check_knowledge_base_name, name='check-knowledge-base-name'),
    path('get-chunk-settings/<int:kb_id>/', views.get_chunk_settings, name='get-chunk-settings'),
    path('get-documents/', views.get_documents, name='get-documents'),
    path('update-document-status/<int:doc_id>/', views.update_document_status, name='update-document-status'),
    path('update-document-name/<int:doc_id>/', views.update_document_name, name='update-document-name'),
    path('delete-document/<int:doc_id>/', views.delete_document, name='delete-document'),
    path('get-knowledge-bases/', views.get_knowledge_bases, name='get-knowledge-bases'),
    path('get-knowledge-bases-dropdown/', views.get_knowledge_bases_for_dropdown, name='get-knowledge-bases-dropdown'),
    path('update-knowledge-base/<int:kb_id>/', views.update_knowledge_base, name='update-knowledge-base'),
    path('delete-knowledge-base/<int:kb_id>/', views.delete_knowledge_base, name='delete-knowledge-base'),
    # Tag-related URLs
    path('get-tags/', views.get_tags, name='get-tags'),
    path('create-tag/', views.create_tag, name='create-tag'),
    path('update-tag/<int:tag_id>/', views.update_tag, name='update-tag'),
    path('delete-tag/<int:tag_id>/', views.delete_tag, name='delete-tag'),
    path('get-kb-tags/<int:kb_id>/', views.get_kb_tags, name='get-kb-tags'),
    path('add-tag-to-kb/<int:kb_id>/', views.add_tag_to_kb, name='add-tag-to-kb'),
    path('remove-tag-from-kb/<int:kb_id>/<int:tag_id>/', views.remove_tag_from_kb, name='remove-tag-from-kb'),
    path('get-chunks/', views.get_chunks, name='get-chunks'),
    path('clear-document-chunks/<int:document_id>/', views.clear_document_chunks, name='clear-document-chunks'),
    path('process-document/', views.process_document, name='process-document'),
    path('save-document-chunks/', views.save_document_chunks, name='save-document-chunks'),
]
