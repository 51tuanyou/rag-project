#!/usr/bin/env python
"""
Test script for retrieval service functionality
"""
import os
import sys
import django
from pathlib import Path

# Add the project directory to Python path
project_dir = Path(__file__).parent
sys.path.append(str(project_dir))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rag_backend.settings')
django.setup()

from apps.kb.models import KnowledgeBase, Chunk, Document
from apps.agents.services.retrieval_service import RetrievalService
from apps.llm.models import Provider, ModelCredential


def test_retrieval_service():
    """Test the retrieval service functionality"""
    print("=" * 50)
    print("Testing Retrieval Service")
    print("=" * 50)
    
    try:
        # Get a knowledge base
        kb = KnowledgeBase.objects.first()
        if not kb:
            print("No knowledge base found. Please create one first.")
            return
        
        print(f"Testing with knowledge base: {kb.name}")
        
        # Check if knowledge base has embedding model
        if not kb.embedding_model:
            print("Knowledge base has no embedding model configured.")
            return
        
        print(f"Using embedding model: {kb.embedding_model.model_name}")
        
        # Test retrieval service
        retrieval_service = RetrievalService()
        
        # Test query
        query_text = "Python多进程和多线程的区别"
        print(f"Testing query: {query_text}")
        
        # Perform retrieval test
        similar_chunks, db_results = retrieval_service.perform_retrieval_test(
            query_text, kb.id, top_k=3
        )
        
        print(f"Found {len(similar_chunks)} similar chunks:")
        for i, chunk in enumerate(similar_chunks):
            print(f"  {i+1}. Score: {chunk['score']:.3f}")
            print(f"     Content: {chunk['content'][:100]}...")
            print(f"     Source: {chunk['source_document']}")
            print()
        
        print("Retrieval service test completed successfully!")
        
    except Exception as e:
        print(f"Error testing retrieval service: {str(e)}")
        import traceback
        traceback.print_exc()


def test_embedding_model():
    """Test embedding model configuration"""
    print("\n" + "=" * 50)
    print("Testing Embedding Model Configuration")
    print("=" * 50)
    
    try:
        # Check providers
        providers = Provider.objects.all()
        print(f"Available providers: {[p.slug for p in providers]}")
        
        # Check model credentials
        models = ModelCredential.objects.filter(model_type='TEXT EMBEDDING')
        print(f"Available embedding models: {[m.model_name for m in models]}")
        
        # Check knowledge bases with embedding models
        kbs_with_models = KnowledgeBase.objects.filter(embedding_model__isnull=False)
        print(f"Knowledge bases with embedding models: {[kb.name for kb in kbs_with_models]}")
        
    except Exception as e:
        print(f"Error checking embedding models: {str(e)}")


if __name__ == "__main__":
    test_embedding_model()
    test_retrieval_service()
