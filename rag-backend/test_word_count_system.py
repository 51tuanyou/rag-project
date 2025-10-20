#!/usr/bin/env python
"""
Test script for the new word count system
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rag_backend.settings')
django.setup()

from apps.kb.models import Document, Chunk
from apps.agents.services.word_count_service import WordCountService


def test_word_count_system():
    """Test the word count system"""
    print("=" * 50)
    print("Testing Word Count System")
    print("=" * 50)
    
    # Test 1: Check all documents
    documents = Document.objects.all()
    print(f"\n1. Found {documents.count()} documents")
    
    for doc in documents:
        print(f"\nDocument: {doc.file_name}")
        print(f"  Status: {doc.status}")
        print(f"  Chunks: {doc.chunks.count()}")
        
        # Calculate word count from chunks
        total_word_count = sum(chunk.word_count for chunk in doc.chunks.all())
        print(f"  Total word count: {total_word_count}")
        
        # Show chunk details
        for chunk in doc.chunks.all():
            print(f"    Chunk {chunk.chunk_number}: {chunk.word_count} words")
    
    # Test 2: Test word count service
    print(f"\n2. Testing Word Count Service")
    word_count_service = WordCountService()
    
    test_texts = [
        "Hello world!",
        "This is a longer text with multiple words and sentences. It should be counted accurately.",
        "短文本测试",
        "这是一个包含中文的测试文本，应该能够正确计算词数。",
        ""  # Empty text
    ]
    
    for i, text in enumerate(test_texts):
        word_count = word_count_service.count_words_smart(text, use_llm=False)
        print(f"  Text {i+1}: '{text[:30]}...' -> {word_count} words")
    
    # Test 3: Test signal functionality
    print(f"\n3. Testing Signal Functionality")
    
    # Create a test chunk to see if signals work
    test_doc = documents.first()
    if test_doc:
        print(f"  Creating test chunk for document: {test_doc.file_name}")
        
        # This should trigger the signal and calculate word count
        test_chunk = Chunk.objects.create(
            document=test_doc,
            chunk_id="test_chunk_001",
            content="This is a test chunk with some words to count.",
            characters=50,
            chunk_number=999  # High number to avoid conflicts
        )
        
        print(f"  Created chunk with word_count: {test_chunk.word_count}")
        
        # Clean up
        test_chunk.delete()
        print(f"  Test chunk deleted")
    
    print(f"\n" + "=" * 50)
    print("Word Count System Test Complete")
    print("=" * 50)


if __name__ == "__main__":
    test_word_count_system()
