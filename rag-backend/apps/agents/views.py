"""
API views for agents functionality
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .services.vectorization_service import VectorizationService
from .services.chat_service import as_bool, run_chat, resolve_default_llm, resolve_default_rerank_name
from .models import QueryHistory
import os


def _as_bool(value, default=False):
    return as_bool(value, default)


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


@api_view(['POST'])
def chat(request):
    """Chat API that supports both direct LLM calls and RAG retrieval"""
    try:
        data = request.data
        message = data.get('message', '').strip()
        llm_model_name = data.get('llm_model_name', '')
        knowledge_base_id = data.get('knowledge_base_id')
        chunk_count = int(data.get('chunk_count', 3))
        max_tokens = int(data.get('max_tokens', 500))
        return_original = _as_bool(data.get('return_original'))
        open_original = _as_bool(data.get('open_original'))
        rerank_enabled = _as_bool(data.get('rerank_enabled'))
        rerank_model_name = (data.get('rerank_model_name') or data.get('rerank_model') or '').strip()
        public_base_url = (os.getenv('PUBLIC_BASE_URL') or '').strip()

        status_code, payload = run_chat(
            message=message,
            llm_model_name=llm_model_name,
            knowledge_base_id=knowledge_base_id,
            chunk_count=chunk_count,
            max_tokens=max_tokens,
            return_original=return_original,
            open_original=open_original,
            rerank_enabled=rerank_enabled,
            rerank_model_name=rerank_model_name or None,
            public_base_url=public_base_url,
        )
        return Response(payload, status=status_code)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def dingtalk_chat(request):
    """
    Dedicated RAG chat API for the DingTalk glue service.

    Defaults (not taken from the web UI):
    - knowledge base: entire library
    - LLM: DINGTALK_DEFAULT_LLM or first enabled LLM
    - chunk_count: 3
    - return_original: True
    - open_original: True
    - rerank: on when a Rerank credential exists
    """
    try:
        expected = (os.getenv("DINGTALK_BRIDGE_TOKEN") or "").strip()
        if expected:
            got = (request.headers.get("X-DingTalk-Bridge-Token") or "").strip()
            if got != expected:
                return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data or {}
        message = (data.get("message") or data.get("query") or data.get("question") or "").strip()
        session_id = (data.get("session_id") or "").strip()
        preferred_llm = (data.get("llm_model_name") or "").strip()

        llm_model = resolve_default_llm(preferred_llm)
        if not llm_model:
            return Response(
                {"error": "No enabled LLM model configured. Add one in Django admin."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rerank_name = resolve_default_rerank_name()
        public_base_url = (
            (data.get("public_base_url") or os.getenv("PUBLIC_BASE_URL") or "http://llm.paoditu.com")
            .strip()
            .rstrip("/")
        )

        status_code, payload = run_chat(
            message=message,
            llm_model_name=llm_model.model_name,
            knowledge_base_id="all",
            chunk_count=3,
            max_tokens=int(data.get("max_tokens") or 2000),
            return_original=True,
            open_original=True,
            rerank_enabled=bool(rerank_name),
            rerank_model_name=rerank_name or None,
            public_base_url=public_base_url,
            session_id=session_id,
        )
        return Response(payload, status=status_code)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def histories(request):
    """List saved query histories."""
    try:
        limit = int(request.GET.get('limit', 50))
        items = QueryHistory.objects.all()[:limit]
        data = [
            {
                'id': h.id,
                'question': h.question,
                'response': h.response,
                'logs': h.logs,
                'created_at': h.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            }
            for h in items
        ]
        return Response({'results': data})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)