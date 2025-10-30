"""
URL configuration for agents app
"""
from django.urls import path
from . import views

urlpatterns = [
    path('vectorize-chunks/', views.vectorize_chunks, name='vectorize-chunks'),
    path('search-similar-chunks/', views.search_similar_chunks, name='search-similar-chunks'),
    path('chat/', views.chat, name='chat'),
    path('histories/', views.histories, name='histories'),
]
