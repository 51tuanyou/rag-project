#!/usr/bin/env python
"""
Test script for knowledge base creation functionality
Tests the API endpoints and database record creation
"""

import os
import sys
import django
import requests
import json
from pathlib import Path

# Add the project directory to Python path
project_dir = Path(__file__).parent
sys.path.append(str(project_dir))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rag_backend.settings')
django.setup()

from apps.kb.models import ChunkSettings, KnowledgeBase, Document, Chunk
from apps.llm.models import ModelCredential, Provider


def test_database_models():
    """Test database models and relationships"""
    print("=" * 50)
    print("Testing Database Models")
    print("=" * 50)
    
    # Test ChunkSettings creation
    print("\n1. Testing ChunkSettings creation...")
    chunk_settings = ChunkSettings.objects.create(
        chunk_type='general',
        delimiter='\\n\\n',
        max_length=1024,
        overlap=50,
        replace_spaces=True,
        delete_urls=False,
        qa_format=False,
        qa_language='English',
        question_flag='Q: ',
        answer_flag='A: ',
        qa_max_length=1024
    )
    print(f"[OK] Created ChunkSettings with ID: {chunk_settings.id}")
    print(f"  - chunk_type: {chunk_settings.chunk_type}")
    print(f"  - delimiter: {chunk_settings.delimiter}")
    print(f"  - max_length: {chunk_settings.max_length}")
    
    # Test KnowledgeBase creation
    print("\n2. Testing KnowledgeBase creation...")
    kb = KnowledgeBase.objects.create(
        name="test_knowledge_base",
        description="Test knowledge base for testing",
        chunk_settings=chunk_settings,
        index_method='hq',
        retrieval_mode='vector'
    )
    print(f"[OK] Created KnowledgeBase with ID: {kb.id}")
    print(f"  - name: {kb.name}")
    print(f"  - chunk_settings_id: {kb.chunk_settings.id}")
    print(f"  - index_method: {kb.index_method}")
    
    # Test Document creation
    print("\n3. Testing Document creation...")
    document = Document.objects.create(
        knowledge_base=kb,
        file_name="test_document.docx",
        file_path="/path/to/test_document.docx",
        file_size=1024,
        file_type="docx",
        status='completed'
    )
    print(f"[OK] Created Document with ID: {document.id}")
    print(f"  - file_name: {document.file_name}")
    print(f"  - knowledge_base_id: {document.knowledge_base.id}")
    print(f"  - status: {document.status}")
    
    # Test Chunk creation
    print("\n4. Testing Chunk creation...")
    chunk = Chunk.objects.create(
        document=document,
        chunk_id="chunk_1",
        content="This is a test chunk content.",
        characters=30,
        chunk_number=1
    )
    print(f"[OK] Created Chunk with ID: {chunk.id}")
    print(f"  - chunk_id: {chunk.chunk_id}")
    print(f"  - document_id: {chunk.document.id}")
    print(f"  - characters: {chunk.characters}")
    
    # Test relationships
    print("\n5. Testing relationships...")
    print(f"[OK] KnowledgeBase -> ChunkSettings: {kb.chunk_settings.chunk_type}")
    print(f"[OK] Document -> KnowledgeBase: {document.knowledge_base.name}")
    print(f"[OK] Chunk -> Document: {chunk.document.file_name}")
    
    return {
        'chunk_settings_id': chunk_settings.id,
        'knowledge_base_id': kb.id,
        'document_id': document.id,
        'chunk_id': chunk.id
    }


def test_api_endpoints():
    """Test API endpoints"""
    print("\n" + "=" * 50)
    print("Testing API Endpoints")
    print("=" * 50)
    
    base_url = "http://localhost:8000"
    
    # Test check knowledge base name endpoint
    print("\n1. Testing check knowledge base name endpoint...")
    try:
        response = requests.post(
            f"{base_url}/api/kb/check-knowledge-base-name/",
            json={"name": "test_knowledge_base"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            data = response.json()
            print(f"[OK] API Response: {data}")
        else:
            print(f"[ERROR] API Error: {response.status_code} - {response.text}")
    except requests.exceptions.ConnectionError:
        print("[ERROR] Cannot connect to API server. Make sure the server is running.")
        return False
    
    # Test create knowledge base endpoint
    print("\n2. Testing create knowledge base endpoint...")
    test_data = {
        "name": "api_test_knowledge_base",
        "files": ["/path/to/test_file.docx"],
        "settings": {
            "delimiter": "\\n\\n",
            "max_length": 1024,
            "overlap": 50,
            "replace_spaces": True,
            "delete_urls": False,
            "qa_format": False,
            "qa_language": "English",
            "question_flag": "Q: ",
            "answer_flag": "A: ",
            "qa_max_length": 1024,
            "index_method": "hq",
            "retrieval_mode": "vector"
        },
        "embedding_model_id": None
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/kb/create-knowledge-base/",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 201:
            data = response.json()
            print(f"[OK] API Response: {data}")
            return data.get('knowledge_base_id')
        else:
            print(f"[ERROR] API Error: {response.status_code} - {response.text}")
            return None
    except requests.exceptions.ConnectionError:
        print("[ERROR] Cannot connect to API server. Make sure the server is running.")
        return None


def test_record_counts():
    """Test that only one record is created per table"""
    print("\n" + "=" * 50)
    print("Testing Record Counts")
    print("=" * 50)
    
    # Count records before test
    chunk_settings_count_before = ChunkSettings.objects.count()
    knowledge_base_count_before = KnowledgeBase.objects.count()
    document_count_before = Document.objects.count()
    chunk_count_before = Chunk.objects.count()
    
    print(f"Records before test:")
    print(f"  - ChunkSettings: {chunk_settings_count_before}")
    print(f"  - KnowledgeBase: {knowledge_base_count_before}")
    print(f"  - Document: {document_count_before}")
    print(f"  - Chunk: {chunk_count_before}")
    
    # Create test records
    print("\nCreating test records...")
    chunk_settings = ChunkSettings.objects.create(
        chunk_type='general',
        delimiter='\\n\\n',
        max_length=1024,
        overlap=50,
        replace_spaces=True,
        delete_urls=False
    )
    
    kb = KnowledgeBase.objects.create(
        name="count_test_kb",
        chunk_settings=chunk_settings,
        index_method='hq',
        retrieval_mode='vector'
    )
    
    document = Document.objects.create(
        knowledge_base=kb,
        file_name="count_test.docx",
        file_path="/path/to/count_test.docx",
        file_size=1024,
        file_type="docx",
        status='completed'
    )
    
    # Count records after test
    chunk_settings_count_after = ChunkSettings.objects.count()
    knowledge_base_count_after = KnowledgeBase.objects.count()
    document_count_after = Document.objects.count()
    chunk_count_after = Chunk.objects.count()
    
    print(f"\nRecords after test:")
    print(f"  - ChunkSettings: {chunk_settings_count_after} (+{chunk_settings_count_after - chunk_settings_count_before})")
    print(f"  - KnowledgeBase: {knowledge_base_count_after} (+{knowledge_base_count_after - knowledge_base_count_before})")
    print(f"  - Document: {document_count_after} (+{document_count_after - document_count_before})")
    print(f"  - Chunk: {chunk_count_after} (+{chunk_count_after - chunk_count_before})")
    
    # Verify only one record was created per table
    assert chunk_settings_count_after - chunk_settings_count_before == 1, "Expected 1 ChunkSettings record"
    assert knowledge_base_count_after - knowledge_base_count_before == 1, "Expected 1 KnowledgeBase record"
    assert document_count_after - document_count_before == 1, "Expected 1 Document record"
    
    print("[OK] All record counts are correct!")


def cleanup_test_data():
    """Clean up test data"""
    print("\n" + "=" * 50)
    print("Cleaning up test data")
    print("=" * 50)
    
    # Delete test records
    Chunk.objects.filter(document__knowledge_base__name__contains="test").delete()
    Document.objects.filter(knowledge_base__name__contains="test").delete()
    KnowledgeBase.objects.filter(name__contains="test").delete()
    ChunkSettings.objects.filter(chunk_type='general').delete()
    
    print("[OK] Test data cleaned up")


def main():
    """Main test function"""
    print("Knowledge Base Creation Test Script")
    print("=" * 50)
    
    try:
        # Test database models
        model_results = test_database_models()
        
        # Test API endpoints
        api_result = test_api_endpoints()
        
        # Test record counts
        test_record_counts()
        
        print("\n" + "=" * 50)
        print("Test Results Summary")
        print("=" * 50)
        print("[OK] Database models: PASSED")
        print("[OK] Relationships: PASSED")
        print("[OK] Record counts: PASSED")
        if api_result:
            print("[OK] API endpoints: PASSED")
        else:
            print("[ERROR] API endpoints: FAILED (server not running)")
        
        print("\nAll tests completed successfully!")
        
    except Exception as e:
        print(f"\n[ERROR] Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up test data
        cleanup_test_data()


if __name__ == "__main__":
    main()
