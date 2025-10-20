#!/usr/bin/env python
"""
Test script to verify the fixes for duplicate record creation
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


def test_duplicate_prevention():
    """Test that duplicate records are not created"""
    print("=" * 60)
    print("Testing Duplicate Record Prevention")
    print("=" * 60)
    
    base_url = "http://localhost:8000"
    
    # Test data for General settings
    test_data = {
        "name": "duplicate_test_knowledge_base",
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
    
    print("1. Testing first knowledge base creation...")
    try:
        response = requests.post(
            f"{base_url}/api/kb/create-knowledge-base/",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 201:
            data = response.json()
            print(f"[OK] First knowledge base created: ID {data.get('knowledge_base_id')}")
            first_kb_id = data.get('knowledge_base_id')
        else:
            print(f"[ERROR] First creation failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"[ERROR] First creation failed: {e}")
        return False
    
    print("\n2. Testing second knowledge base creation with same settings...")
    test_data["name"] = "duplicate_test_knowledge_base_2"  # Different name
    try:
        response = requests.post(
            f"{base_url}/api/kb/create-knowledge-base/",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 201:
            data = response.json()
            print(f"[OK] Second knowledge base created: ID {data.get('knowledge_base_id')}")
            second_kb_id = data.get('knowledge_base_id')
        else:
            print(f"[ERROR] Second creation failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"[ERROR] Second creation failed: {e}")
        return False
    
    print("\n3. Verifying ChunkSettings reuse...")
    try:
        # Get both knowledge bases
        kb1 = KnowledgeBase.objects.get(id=first_kb_id)
        kb2 = KnowledgeBase.objects.get(id=second_kb_id)
        
        # Check if they use the same ChunkSettings
        if kb1.chunk_settings.id == kb2.chunk_settings.id:
            print(f"[OK] ChunkSettings reused: Both KBs use ChunkSettings ID {kb1.chunk_settings.id}")
        else:
            print(f"[ERROR] ChunkSettings not reused: KB1 uses {kb1.chunk_settings.id}, KB2 uses {kb2.chunk_settings.id}")
            return False
        
        # Verify ChunkSettings count
        chunk_settings_count = ChunkSettings.objects.filter(
            chunk_type='general',
            delimiter='\\n\\n',
            max_length=1024,
            overlap=50,
            replace_spaces=True,
            delete_urls=False,
            qa_format=False
        ).count()
        
        if chunk_settings_count == 1:
            print(f"[OK] Only 1 ChunkSettings record exists for these settings")
        else:
            print(f"[ERROR] {chunk_settings_count} ChunkSettings records exist, expected 1")
            return False
            
        return True
        
    except Exception as e:
        print(f"[ERROR] Verification failed: {e}")
        return False


def test_duplicate_name_handling():
    """Test duplicate name handling with auto-increment"""
    print("\n" + "=" * 60)
    print("Testing Duplicate Name Handling")
    print("=" * 60)
    
    base_url = "http://localhost:8000"
    
    # Test data with same name
    test_data = {
        "name": "name_test_knowledge_base",
        "files": ["/path/to/test_document.docx"],
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
    
    print("1. Creating first knowledge base...")
    try:
        response = requests.post(
            f"{base_url}/api/kb/create-knowledge-base/",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 201:
            data = response.json()
            print(f"[OK] First KB created: {data.get('knowledge_base_name')}")
            first_name = data.get('knowledge_base_name')
        else:
            print(f"[ERROR] First creation failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"[ERROR] First creation failed: {e}")
        return False
    
    print("\n2. Creating second knowledge base with same name...")
    try:
        response = requests.post(
            f"{base_url}/api/kb/create-knowledge-base/",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 201:
            data = response.json()
            print(f"[OK] Second KB created: {data.get('knowledge_base_name')}")
            second_name = data.get('knowledge_base_name')
        else:
            print(f"[ERROR] Second creation failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"[ERROR] Second creation failed: {e}")
        return False
    
    print(f"\n3. Verifying names are different:")
    print(f"  - First name: {first_name}")
    print(f"  - Second name: {second_name}")
    
    if first_name != second_name:
        print("[OK] Names are different - duplicate handling working")
        return True
    else:
        print("[ERROR] Names are identical - duplicate handling not working")
        return False


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
    print("Fix Verification Test Script")
    print("=" * 60)
    
    try:
        # Test duplicate prevention
        duplicate_test = test_duplicate_prevention()
        
        # Test duplicate name handling
        name_test = test_duplicate_name_handling()
        
        print("\n" + "=" * 60)
        print("Test Results Summary")
        print("=" * 60)
        
        if duplicate_test:
            print("[OK] Duplicate prevention: PASSED")
        else:
            print("[ERROR] Duplicate prevention: FAILED")
        
        if name_test:
            print("[OK] Duplicate name handling: PASSED")
        else:
            print("[ERROR] Duplicate name handling: FAILED")
        
        if duplicate_test and name_test:
            print("\n[OK] All fixes are working correctly!")
        else:
            print("\n[ERROR] Some fixes are not working!")
        
    except Exception as e:
        print(f"\n[ERROR] Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up test data
        cleanup_test_data()


if __name__ == "__main__":
    main()
