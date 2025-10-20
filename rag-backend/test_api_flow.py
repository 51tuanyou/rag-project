#!/usr/bin/env python
"""
Test script for complete API flow
Tests the frontend-to-backend knowledge base creation process
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


def test_complete_flow():
    """Test the complete knowledge base creation flow"""
    print("=" * 60)
    print("Testing Complete Knowledge Base Creation Flow")
    print("=" * 60)
    
    base_url = "http://localhost:8000"
    
    # Test data simulating frontend request
    test_data = {
        "name": "flow_test_knowledge_base",
        "files": ["/path/to/test_document.docx"],
        "settings": {
            "delimiter": "\\n\\n",
            "max_length": 1024,
            "overlap": 50,
            "replace_spaces": True,
            "delete_urls": False,
            "qa_format": False,  # General settings
            "qa_language": "English",
            "question_flag": "Q: ",
            "answer_flag": "A: ",
            "qa_max_length": 1024,
            "index_method": "hq",
            "retrieval_mode": "vector"
        },
        "embedding_model_id": None
    }
    
    print("1. Testing knowledge base name check...")
    try:
        response = requests.post(
            f"{base_url}/api/kb/check-knowledge-base-name/",
            json={"name": test_data["name"]},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            data = response.json()
            print(f"[OK] Name check response: {data}")
        else:
            print(f"[ERROR] Name check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("[ERROR] Cannot connect to API server")
        return False
    
    print("\n2. Testing knowledge base creation...")
    try:
        response = requests.post(
            f"{base_url}/api/kb/create-knowledge-base/",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 201:
            data = response.json()
            print(f"[OK] Knowledge base created successfully!")
            print(f"  - Knowledge Base ID: {data.get('knowledge_base_id')}")
            print(f"  - Knowledge Base Name: {data.get('knowledge_base_name')}")
            print(f"  - Documents: {data.get('total_documents')}")
            print(f"  - Created At: {data.get('created_at')}")
            
            # Verify database records
            kb_id = data.get('knowledge_base_id')
            if kb_id:
                verify_database_records(kb_id)
            
            return kb_id
        else:
            print(f"[ERROR] Knowledge base creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except requests.exceptions.ConnectionError:
        print("[ERROR] Cannot connect to API server")
        return None


def verify_database_records(kb_id):
    """Verify that the correct database records were created"""
    print("\n3. Verifying database records...")
    
    try:
        # Check KnowledgeBase record
        kb = KnowledgeBase.objects.get(id=kb_id)
        print(f"[OK] KnowledgeBase record found:")
        print(f"  - ID: {kb.id}")
        print(f"  - Name: {kb.name}")
        print(f"  - Chunk Settings ID: {kb.chunk_settings.id}")
        print(f"  - Index Method: {kb.index_method}")
        print(f"  - Retrieval Mode: {kb.retrieval_mode}")
        
        # Check ChunkSettings record
        chunk_settings = kb.chunk_settings
        print(f"\n[OK] ChunkSettings record found:")
        print(f"  - ID: {chunk_settings.id}")
        print(f"  - Chunk Type: {chunk_settings.chunk_type}")
        print(f"  - Delimiter: {chunk_settings.delimiter}")
        print(f"  - Max Length: {chunk_settings.max_length}")
        print(f"  - Overlap: {chunk_settings.overlap}")
        print(f"  - Replace Spaces: {chunk_settings.replace_spaces}")
        print(f"  - Delete URLs: {chunk_settings.delete_urls}")
        print(f"  - QA Format: {chunk_settings.qa_format}")
        
        # Check Document records
        documents = Document.objects.filter(knowledge_base=kb)
        print(f"\n[OK] Document records found: {documents.count()}")
        for doc in documents:
            print(f"  - Document ID: {doc.id}")
            print(f"  - File Name: {doc.file_name}")
            print(f"  - File Path: {doc.file_path}")
            print(f"  - Status: {doc.status}")
            print(f"  - Knowledge Base ID: {doc.knowledge_base.id}")
        
        # Check Chunk records
        chunks = Chunk.objects.filter(document__knowledge_base=kb)
        print(f"\n[OK] Chunk records found: {chunks.count()}")
        for chunk in chunks:
            print(f"  - Chunk ID: {chunk.id}")
            print(f"  - Chunk ID: {chunk.chunk_id}")
            print(f"  - Content: {chunk.content[:50]}...")
            print(f"  - Characters: {chunk.characters}")
            print(f"  - Document ID: {chunk.document.id}")
        
        # Verify relationships
        print(f"\n[OK] Relationship verification:")
        print(f"  - KnowledgeBase -> ChunkSettings: {kb.chunk_settings.chunk_type}")
        print(f"  - Document -> KnowledgeBase: {documents.first().knowledge_base.name if documents.exists() else 'No documents'}")
        print(f"  - Chunk -> Document: {chunks.first().document.file_name if chunks.exists() else 'No chunks'}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Database verification failed: {e}")
        return False


def test_qa_settings():
    """Test Q&A settings creation"""
    print("\n" + "=" * 60)
    print("Testing Q&A Settings Creation")
    print("=" * 60)
    
    base_url = "http://localhost:8000"
    
    # Test data for Q&A settings
    qa_test_data = {
        "name": "qa_test_knowledge_base",
        "files": ["/path/to/qa_document.docx"],
        "settings": {
            "delimiter": "\\n\\n",
            "max_length": 1024,
            "overlap": 50,
            "replace_spaces": True,
            "delete_urls": False,
            "qa_format": True,  # Q&A settings
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
            json=qa_test_data,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 201:
            data = response.json()
            print(f"[OK] Q&A Knowledge base created successfully!")
            print(f"  - Knowledge Base ID: {data.get('knowledge_base_id')}")
            
            # Verify Q&A settings
            kb_id = data.get('knowledge_base_id')
            if kb_id:
                kb = KnowledgeBase.objects.get(id=kb_id)
                chunk_settings = kb.chunk_settings
                print(f"\n[OK] Q&A Settings verification:")
                print(f"  - Chunk Type: {chunk_settings.chunk_type}")
                print(f"  - QA Format: {chunk_settings.qa_format}")
                print(f"  - QA Language: {chunk_settings.qa_language}")
                print(f"  - Question Flag: {chunk_settings.question_flag}")
                print(f"  - Answer Flag: {chunk_settings.answer_flag}")
                print(f"  - QA Max Length: {chunk_settings.qa_max_length}")
                
                return kb_id
        else:
            print(f"[ERROR] Q&A Knowledge base creation failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"[ERROR] Q&A test failed: {e}")
        return None


def cleanup_test_data():
    """Clean up test data"""
    print("\n" + "=" * 60)
    print("Cleaning up test data")
    print("=" * 60)
    
    try:
        # Delete test records
        Chunk.objects.filter(document__knowledge_base__name__contains="test").delete()
        Document.objects.filter(knowledge_base__name__contains="test").delete()
        KnowledgeBase.objects.filter(name__contains="test").delete()
        ChunkSettings.objects.filter(chunk_type__in=['general', 'qa']).delete()
        
        print("[OK] Test data cleaned up")
        return True
    except Exception as e:
        print(f"[ERROR] Cleanup failed: {e}")
        return False


def main():
    """Main test function"""
    print("Complete API Flow Test Script")
    print("=" * 60)
    
    try:
        # Test General settings flow
        kb_id = test_complete_flow()
        
        # Test Q&A settings flow
        qa_kb_id = test_qa_settings()
        
        print("\n" + "=" * 60)
        print("Test Results Summary")
        print("=" * 60)
        
        if kb_id:
            print("[OK] General settings flow: PASSED")
        else:
            print("[ERROR] General settings flow: FAILED")
        
        if qa_kb_id:
            print("[OK] Q&A settings flow: PASSED")
        else:
            print("[ERROR] Q&A settings flow: FAILED")
        
        if kb_id and qa_kb_id:
            print("\n[OK] All tests completed successfully!")
        else:
            print("\n[ERROR] Some tests failed!")
        
    except Exception as e:
        print(f"\n[ERROR] Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up test data
        cleanup_test_data()


if __name__ == "__main__":
    main()
