"""
Retrieval test API views
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import KnowledgeBase, RetrievalTestRecord, RetrievalTestResult, Chunk
from apps.agents.services.retrieval_service import RetrievalService
import random


@api_view(['POST'])
def perform_retrieval_test(request):
    """Perform retrieval test with vector similarity search"""
    try:
        data = request.data
        query_text = data.get('query_text', '').strip()
        knowledge_base_id = data.get('knowledge_base_id')
        top_k = int(data.get('top_k', 3))
        
        if not query_text:
            return Response({'error': 'Query text is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if len(query_text) > 2000:
            return Response({'error': 'Query text cannot exceed 2000 characters'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not knowledge_base_id:
            return Response({'error': 'Knowledge base ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            kb = KnowledgeBase.objects.get(id=knowledge_base_id)
        except KnowledgeBase.DoesNotExist:
            return Response({'error': 'Knowledge base not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Create retrieval test record
        test_record = RetrievalTestRecord.objects.create(
            knowledge_base=kb,
            query_text=query_text,
            created_by=request.user if request.user.is_authenticated else None
        )
        
        # Perform actual vector similarity search
        try:
            retrieval_service = RetrievalService()
            similar_chunks, db_results = retrieval_service.perform_retrieval_test(
                query_text, knowledge_base_id, top_k
            )
            
            # Store results in database
            for db_result in db_results:
                chunk = retrieval_service.get_chunk_by_id(db_result['chunk_id'])
                RetrievalTestResult.objects.create(
                    test_record=test_record,
                    chunk=chunk,
                    similarity_score=db_result['similarity_score'],
                    rank=db_result['rank']
                )
            
            return Response({
                'test_record_id': test_record.id,
                'query_text': query_text,
                'knowledge_base_id': knowledge_base_id,
                'results': similar_chunks,
                'total_results': len(similar_chunks)
            })
            
        except Exception as retrieval_error:
            print(f"Vector similarity search failed: {str(retrieval_error)}")
            # Don't use mock results, return the actual error to the frontend
            error_message = str(retrieval_error)
            
            # Check if it's an embedding service error
            if "Failed to create embeddings" in error_message or "Embedding service unavailable" in error_message:
                return Response({
                    'error': 'Embedding service is unavailable. Please check your API configuration and network connection.',
                    'error_type': 'embedding_service_error'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            else:
                return Response({
                    'error': f'Retrieval test failed: {error_message}',
                    'error_type': 'retrieval_error'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_retrieval_test_records(request, kb_id):
    """Get retrieval test records for a knowledge base"""
    try:
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
        except KnowledgeBase.DoesNotExist:
            return Response({'error': 'Knowledge base not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get test records ordered by creation time (newest first)
        test_records = RetrievalTestRecord.objects.filter(knowledge_base=kb).order_by('-created_at')
        
        records = []
        for record in test_records:
            records.append({
                'id': record.id,
                'query_text': record.query_text,
                'created_at': record.created_at.strftime('%m/%d/%Y %I:%M %p'),
                'created_by': record.created_by.username if record.created_by else 'Anonymous'
            })
        
        return Response({
            'records': records,
            'total': len(records)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_retrieval_test_results(request, test_record_id):
    """Get retrieval test results for a specific test record"""
    try:
        try:
            test_record = RetrievalTestRecord.objects.get(id=test_record_id)
        except RetrievalTestRecord.DoesNotExist:
            return Response({'error': 'Test record not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get test results ordered by similarity score (highest first)
        test_results = RetrievalTestResult.objects.filter(test_record=test_record).order_by('-similarity_score')
        
        results = []
        for result in test_results:
            results.append({
                'id': f'chunk-{result.chunk.id}',
                'content': result.chunk.content,
                'score': result.similarity_score,
                'source_document': result.chunk.document.file_name,
                'character_count': result.chunk.characters,
                'rank': result.rank
            })
        
        return Response({
            'test_record_id': test_record.id,
            'query_text': test_record.query_text,
            'knowledge_base_id': test_record.knowledge_base.id,
            'results': results,
            'total_results': len(results)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
