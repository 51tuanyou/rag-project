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
    path('get-knowledge-bases/', views.get_knowledge_bases, name='get-knowledge-bases'),
]
