"""
API views for agents functionality
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .services.vectorization_service import VectorizationService
import asyncio


@api_view(['POST'])
def vectorize_chunks(request):
    """Vectorize chunks and store in PGVector"""
    try:
        data = request.data
        
        chunks = data.get('chunks', [])
        embedding_model_id = data.get('embedding_model_id')
        knowledge_base_id = data.get('knowledge_base_id')
        document_id = data.get('document_id')
        
        if not chunks:
            return Response({'error': 'No chunks provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not embedding_model_id:
            return Response({'error': 'Embedding model ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not knowledge_base_id:
            return Response({'error': 'Knowledge base ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not document_id:
            return Response({'error': 'Document ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Initialize vectorization service
        vectorization_service = VectorizationService()
        
        # Run vectorization synchronously
        try:
            result = vectorization_service.vectorize_and_store_chunks_sync(
                chunks=chunks,
                embedding_model_id=embedding_model_id,
                knowledge_base_id=knowledge_base_id,
                document_id=document_id
            )
            
            return Response({
                'message': 'Chunks vectorized and stored successfully',
                'chunks_processed': len(chunks),
                'knowledge_base_id': knowledge_base_id,
                'document_id': document_id
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': f'Vectorization failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def search_similar_chunks(request):
    """Search for similar chunks using vector similarity"""
    try:
        query_text = request.GET.get('query', '')
        knowledge_base_id = request.GET.get('kb_id')
        limit = int(request.GET.get('limit', 5))
        
        if not query_text:
            return Response({'error': 'Query text is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not knowledge_base_id:
            return Response({'error': 'Knowledge base ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # This would require implementing similarity search in the vectorization service
        # For now, return a placeholder response
        return Response({
            'message': 'Similarity search not yet implemented',
            'query': query_text,
            'knowledge_base_id': knowledge_base_id,
            'limit': limit
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)