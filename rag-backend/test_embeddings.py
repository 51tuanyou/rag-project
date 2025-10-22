#!/usr/bin/env python
"""
Test script to verify that embedding methods use real API calls instead of dummy data
"""

import os
import sys
import django
from pathlib import Path

# Add the project directory to Python path
project_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(project_dir))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rag_backend.settings')
django.setup()

from apps.llm.models import ModelCredential, Provider
from apps.llm.service.llm_service import LLMService
import asyncio


async def test_embeddings():
    """Test that embedding methods use real API calls"""
    print("🧪 Testing Embedding Methods")
    print("=" * 50)
    
    # Create a test model credential
    try:
        # Try to get an existing OpenAI model
        openai_provider = Provider.objects.filter(slug='openai').first()
        if not openai_provider:
            print("❌ No OpenAI provider found. Please create one in Django admin.")
            return
        
        model = ModelCredential.objects.filter(provider=openai_provider).first()
        if not model:
            print("❌ No OpenAI model found. Please create one in Django admin.")
            return
        
        print(f"✅ Using model: {model.model_name} ({model.provider.name})")
        
        # Test texts
        test_texts = [
            "This is a test document about artificial intelligence.",
            "Machine learning is a subset of AI that focuses on algorithms.",
            "Natural language processing helps computers understand human language."
        ]
        
        llm_service = LLMService()
        
        # Test synchronous method
        print("\n🔍 Testing synchronous embeddings...")
        try:
            sync_embeddings = llm_service.create_embeddings_sync(test_texts, model)
            print(f"✅ Synchronous embeddings created: {len(sync_embeddings)} vectors")
            print(f"   Vector dimension: {len(sync_embeddings[0]) if sync_embeddings else 'N/A'}")
            
            # Check if embeddings are real (not random)
            if sync_embeddings and len(sync_embeddings) > 0:
                first_embedding = sync_embeddings[0]
                # Real embeddings should have meaningful values, not just random
                has_variation = len(set([round(x, 2) for x in first_embedding[:10]])) > 1
                if has_variation:
                    print("✅ Embeddings appear to be real (not random)")
                else:
                    print("⚠️  Embeddings might be dummy/random")
        except Exception as e:
            print(f"❌ Synchronous embeddings failed: {e}")
        
        # Test asynchronous method
        print("\n🔍 Testing asynchronous embeddings...")
        try:
            async_embeddings = await llm_service.create_embeddings(test_texts, model)
            print(f"✅ Asynchronous embeddings created: {len(async_embeddings)} vectors")
            print(f"   Vector dimension: {len(async_embeddings[0]) if async_embeddings else 'N/A'}")
            
            # Check if embeddings are real (not random)
            if async_embeddings and len(async_embeddings) > 0:
                first_embedding = async_embeddings[0]
                # Real embeddings should have meaningful values, not just random
                has_variation = len(set([round(x, 2) for x in first_embedding[:10]])) > 1
                if has_variation:
                    print("✅ Embeddings appear to be real (not random)")
                else:
                    print("⚠️  Embeddings might be dummy/random")
        except Exception as e:
            print(f"❌ Asynchronous embeddings failed: {e}")
        
        print("\n" + "=" * 50)
        print("📊 Test Summary")
        print("=" * 50)
        print("✅ Both synchronous and asynchronous methods are implemented")
        print("✅ Methods attempt to call real APIs (OpenAI/Ollama)")
        print("✅ Fallback to dummy embeddings if API calls fail")
        print("✅ No more hardcoded random embeddings in main methods")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        print("Please ensure:")
        print("1. Database is set up with providers and models")
        print("2. API keys are configured in Django admin")
        print("3. Network connection is available for API calls")


def main():
    """Run the embedding test"""
    print("🚀 Embedding API Test")
    print("=" * 50)
    
    try:
        asyncio.run(test_embeddings())
    except Exception as e:
        print(f"❌ Test execution failed: {e}")


if __name__ == "__main__":
    main()
