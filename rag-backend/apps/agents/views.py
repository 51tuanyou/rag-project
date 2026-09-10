"""
API views for agents functionality
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .services.vectorization_service import VectorizationService
from .services.retrieval_service import RetrievalService
from apps.llm.service.llm_service import LLMService
from apps.llm.models import ModelCredential
from .models import QueryHistory
from apps.kb.models import KnowledgeBase
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
        
        if not message:
            return Response({'error': 'Message is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not llm_model_name:
            return Response({'error': 'LLM model is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get LLM model credential
        try:
            llm_model = ModelCredential.objects.filter(
                model_name=llm_model_name,
                enabled=True,
                model_type='LLM'
            ).first()
            
            if not llm_model:
                return Response({'error': f'No enabled LLM model found: {llm_model_name}'}, 
                              status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Error finding LLM model: {str(e)}'}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        logs = []
        response_text = ""
        
        # Check if knowledge base is selected
        if knowledge_base_id:
            logs.append(f"选择了知识库ID: {knowledge_base_id}")
            logs.append(f"开始检索相关分块...")
            
            try:
                # Get knowledge base by ID
                kb = KnowledgeBase.objects.filter(id=knowledge_base_id).first()
                if not kb:
                    return Response({'error': f'Knowledge base not found: {knowledge_base_id}'}, 
                                  status=status.HTTP_404_NOT_FOUND)
                
                logs.append(f"   知识库名称: {kb.name}")
                
                # Perform retrieval
                retrieval_service = RetrievalService()
                similar_chunks, db_results = retrieval_service.perform_retrieval_test(
                    message, kb.id, chunk_count
                )
                
                logs.append(f"检索到 {len(similar_chunks)} 个相关分块")
                
                # Prepare context from retrieved chunks
                context_parts = []
                chunk_log_lines = []
                for i, chunk in enumerate(similar_chunks, 1):
                    context_parts.append(f"分块 {i} (相似度: {chunk['similarity_score']:.3f}):\n{chunk['content']}")
                    # 将各分块信息汇总到一条日志中，避免前端对每行单独编号
                    chunk_log_lines.append(f"   - 分块 {i}: {chunk['source_document']} (相似度: {chunk['similarity_score']:.3f})")
                if chunk_log_lines:
                    logs.append("\n".join(chunk_log_lines))
                
                context = "\n\n".join(context_parts)
                
                # Handle response based on whether chunks were found
                if len(context_parts) == 0:
                    # No relevant chunks found - return English message directly
                    logs.append(f"没有检索到相关分块，直接返回英文提示")
                    response_text = "No relevant document chunks found"
                    logs.append(f"返回英文提示: {response_text}")
                else:
                    # Create RAG prompt with context
                    rag_prompt = f"""基于以下相关文档内容回答用户的问题。请根据提供的上下文信息给出准确、有用的回答。

相关文档内容：
{context}

用户问题：{message}

请基于上述文档内容回答用户的问题，如果文档中没有相关信息，请说明无法从提供的文档中找到答案。回答请控制在{max_tokens}个字符以内。"""
                    
                    logs.append(f"构建RAG提示词，包含 {len(context_parts)} 个分块")
                    logs.append(f"调用LLM生成回答...")
                    logs.append(f"   RAG提示词内容: {rag_prompt[:500]}...")  # 打印前500个字符
                    logs.append(f"   最大token数: {max_tokens}")
                    
                    # Generate response using LLM
                    llm_service = LLMService()
                    response_text = llm_service.generate_response(rag_prompt, llm_model, max_tokens)
                    
                    logs.append(f"LLM回答生成完成，字符数: {len(response_text)}")
                    logs.append(f"   LLM原始回答: {response_text[:200]}...")  # 打印前200个字符
                
            except Exception as e:
                error_msg = str(e)
                logs.append(f"检索过程出错: {error_msg}")
                
                # Check if it's a model-related error
                if "模型" in error_msg or "model" in error_msg.lower():
                    return Response({
                        'error': f'LLM模型错误: {error_msg}',
                        'logs': logs,
                        'error_type': 'model_error'
                    }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({
                        'error': f'检索失败: {error_msg}',
                        'logs': logs,
                        'error_type': 'retrieval_error'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            logs.append(f"未选择知识库，直接调用LLM")
            logs.append(f"调用LLM生成回答...")
            
            # Direct LLM call without RAG
            try:
                llm_service = LLMService()
                response_text = llm_service.generate_response(message, llm_model, max_tokens)
                
                logs.append(f"LLM回答生成完成，字符数: {len(response_text)}")
            except Exception as e:
                error_msg = str(e)
                logs.append(f"LLM调用出错: {error_msg}")
                
                # Check if it's a model-related error
                if "模型" in error_msg or "model" in error_msg.lower():
                    return Response({
                        'error': f'LLM模型错误: {error_msg}',
                        'logs': logs,
                        'error_type': 'model_error'
                    }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({
                        'error': f'LLM调用失败: {error_msg}',
                        'logs': logs,
                        'error_type': 'llm_error'
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Ensure response doesn't exceed max_tokens
        if len(response_text) > max_tokens:
            response_text = response_text[:max_tokens] + "..."
            logs.append(f"回答已截断至 {max_tokens} 个字符")
        
        # Persist query history (best-effort)
        try:
            QueryHistory.objects.create(
                question=message,
                response=response_text,
                logs="\n".join(logs),
            )
        except Exception:
            pass
        
        return Response({
            'response': response_text,
            'logs': logs,
            'character_count': len(response_text),
            'max_tokens': max_tokens
        })
        
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