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
from apps.kb.models import KnowledgeBase, Document
import asyncio
import re


def _as_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _dedupe_markdown_tables(text: str) -> str:
    """Keep only the first of consecutive near-duplicate markdown tables."""
    lines = text.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    i = 0
    prev_table_sig = None

    def is_table_line(line: str) -> bool:
        t = line.strip()
        return bool(t) and t.count("|") >= 2

    while i < len(lines):
        if is_table_line(lines[i]):
            start = i
            while i < len(lines) and (is_table_line(lines[i]) or not lines[i].strip()):
                if not lines[i].strip() and i + 1 < len(lines) and not is_table_line(lines[i + 1]):
                    break
                i += 1
            block = lines[start:i]
            # Signature: header + row count + first/last data row
            body = [ln for ln in block if ln.strip() and not re.match(r"^\s*\|?\s*[-:| ]+\s*$", ln)]
            sig = "|".join(body[:1] + [str(len(body))] + body[-1:])
            # Drop duplicate table when same header and similar size
            header = body[0] if body else ""
            if prev_table_sig and header and header in prev_table_sig:
                continue
            prev_table_sig = sig
            out.extend(block)
            continue
        # Reset table signature after non-empty non-table text that isn't a source label
        if lines[i].strip() and not lines[i].strip().startswith("【来源"):
            prev_table_sig = None
        out.append(lines[i])
        i += 1

    # Also collapse repeated 【来源：...】 blocks with identical following tables
    collapsed: list[str] = []
    seen_sources: set[str] = set()
    j = 0
    while j < len(out):
        line = out[j]
        m = re.match(r"^【来源[:：].*?】\s*$", line.strip())
        if m:
            src = line.strip()
            # peek following table
            k = j + 1
            while k < len(out) and not out[k].strip():
                k += 1
            table_header = out[k].strip() if k < len(out) else ""
            key = f"{src}::{table_header}"
            if key in seen_sources:
                # skip this source + its following table block
                j += 1
                while j < len(out) and not out[j].strip():
                    j += 1
                while j < len(out) and is_table_line(out[j]):
                    j += 1
                continue
            seen_sources.add(key)
        collapsed.append(line)
        j += 1
    return "\n".join(collapsed).strip()


def _select_chunk_indices_with_llm(message: str, similar_chunks: list, llm_service, llm_model, max_tokens: int) -> list[int]:
    """Ask LLM only for relevant chunk indexes — do not rewrite table text."""
    listing = []
    for i, chunk in enumerate(similar_chunks, 1):
        content = chunk.get("content") or ""
        preview = content[:400].replace("\n", " ")
        listing.append(
            f"{i}. [{chunk.get('source_document', '')}] "
            f"({len(content)} chars) {preview}"
        )
    prompt = f"""根据用户问题，从下列检索分块中选出真正包含答案的分块编号。
优先选择字符数更多、包含完整正文/表格的分块，不要选只有目录标题的短分块。
只输出编号，多个用逗号分隔，例如：2 或 1,3。不要输出其他文字。

用户问题：{message}

分块列表：
{chr(10).join(listing)}
"""
    try:
        raw = llm_service.generate_response(prompt, llm_model, min(max_tokens, 64))
        nums = [int(x) for x in re.findall(r"\d+", raw or "")]
        valid = [n for n in nums if 1 <= n <= len(similar_chunks)]
        seen = set()
        ordered = []
        for n in valid:
            if n not in seen:
                seen.add(n)
                ordered.append(n)
        if not ordered:
            ordered = [1]
        # Upgrade tiny stubs to the longest retrieved chunk when needed
        upgraded = []
        for n in ordered:
            chunk = similar_chunks[n - 1]
            content = chunk.get("content") or ""
            if len(content) >= 120:
                upgraded.append(n)
                continue
            # Prefer longest among retrieved
            best_i = max(
                range(len(similar_chunks)),
                key=lambda i: len(similar_chunks[i].get("content") or ""),
            )
            if len(similar_chunks[best_i].get("content") or "") > len(content):
                upgraded.append(best_i + 1)
            else:
                upgraded.append(n)
        # unique preserve order
        out = []
        seen2 = set()
        for n in upgraded:
            if n not in seen2:
                seen2.add(n)
                out.append(n)
        return out or [1]
    except Exception:
        # Fallback: longest chunk
        if not similar_chunks:
            return [1]
        best_i = max(
            range(len(similar_chunks)),
            key=lambda i: len(similar_chunks[i].get("content") or ""),
        )
        return [best_i + 1]


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
        source_documents = []
        
        # Check if knowledge base is selected
        search_all_kbs = knowledge_base_id in ("all", "ALL", -1, "-1")
        if search_all_kbs or knowledge_base_id:
            if search_all_kbs:
                logs.append("选择了知识库: 整个知识库")
                logs.append("开始在全部知识库中检索相关分块...")
            else:
                logs.append(f"选择了知识库ID: {knowledge_base_id}")
                logs.append("开始检索相关分块...")
            
            try:
                retrieval_service = RetrievalService()
                if search_all_kbs:
                    similar_chunks, db_results = retrieval_service.perform_retrieval_all_knowledge_bases(
                        message, chunk_count
                    )
                    logs.append("   检索范围: 全部知识库")
                else:
                    # Get knowledge base by ID
                    kb = KnowledgeBase.objects.filter(id=knowledge_base_id).first()
                    if not kb:
                        return Response({'error': f'Knowledge base not found: {knowledge_base_id}'}, 
                                      status=status.HTTP_404_NOT_FOUND)
                    
                    logs.append(f"   知识库名称: {kb.name}")
                    
                    # Perform retrieval
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
                    selected_indices: list[int] = []
                    llm_service = LLMService()
                    if return_original:
                        # Do NOT ask the LLM to rewrite tables — that caused duplicate
                        # incomplete tables. Select relevant chunks, return their text as-is.
                        logs.append("已启用「返回原文档」：由模型选择分块，直接返回原文（不重写表格）")
                        selected_indices = _select_chunk_indices_with_llm(
                            message, similar_chunks, llm_service, llm_model, max_tokens
                        )
                        logs.append(f"模型选中分块编号: {selected_indices}")
                        parts = []
                        for idx in selected_indices:
                            chunk = similar_chunks[idx - 1]
                            parts.append(
                                f"【来源：分块 {idx} / {chunk.get('source_document', '')}】\n"
                                f"{(chunk.get('content') or '').strip()}"
                            )
                        response_text = "\n\n".join(parts)
                        logs.append(f"原文返回完成，字符数: {len(response_text)}")
                    else:
                        rag_prompt = f"""基于以下相关文档内容回答用户的问题。请根据提供的上下文信息给出准确、有用的回答。

相关文档内容：
{context}

用户问题：{message}

请基于上述文档内容回答用户的问题，如果文档中没有相关信息，请说明无法从提供的文档中找到答案。
若答案涉及表格或表结构：
1. 使用 Markdown 表格输出（| 列 | 列 |）
2. 每个来源只输出一次，禁止重复粘贴同一张表
3. 尽量保留上下文中出现的全部列与全部行，不要省略字段
回答请控制在{max_tokens}个字符以内。"""
                    
                        logs.append(f"构建RAG提示词，包含 {len(context_parts)} 个分块")
                        logs.append(f"调用LLM生成回答...")
                        logs.append(f"   RAG提示词内容: {rag_prompt[:500]}...")  # 打印前500个字符
                        logs.append(f"   最大token数: {max_tokens}")
                    
                        response_text = llm_service.generate_response(rag_prompt, llm_model, max_tokens)
                        response_text = _dedupe_markdown_tables(response_text)
                    
                        logs.append(f"LLM回答生成完成，字符数: {len(response_text)}")
                        logs.append(f"   LLM原始回答: {response_text[:200]}...")  # 打印前200个字符

                    if len(response_text) > max_tokens * 4:
                        # allow longer for original chunk paste; soft cap
                        soft_cap = max(max_tokens * 4, 4000)
                        if len(response_text) > soft_cap:
                            response_text = response_text[:soft_cap] + "..."
                            logs.append(f"回答已截断至 {soft_cap} 个字符")
                    elif not return_original and len(response_text) > max_tokens:
                        response_text = response_text[:max_tokens] + "..."
                        logs.append(f"回答已截断至 {max_tokens} 个字符")

                    # Collect source documents for optional links
                    seen_doc_ids = set()
                    if return_original and selected_indices:
                        link_chunks = [similar_chunks[i - 1] for i in selected_indices]
                    else:
                        link_chunks = similar_chunks
                    for chunk in link_chunks:
                        doc_id = chunk.get("document_id")
                        if not doc_id or doc_id in seen_doc_ids:
                            continue
                        seen_doc_ids.add(doc_id)
                        try:
                            doc = Document.objects.get(id=doc_id)
                            source_documents.append({
                                "id": doc.id,
                                "file_name": doc.file_name,
                                "url": f"/api/kb/documents/{doc.id}/file/",
                            })
                        except Document.DoesNotExist:
                            source_documents.append({
                                "id": doc_id,
                                "file_name": chunk.get("source_document") or f"Document {doc_id}",
                                "url": f"/api/kb/documents/{doc_id}/file/",
                            })

                    if open_original and source_documents:
                        link_lines = ["", "原文档："]
                        for src in source_documents:
                            link_lines.append(f"- {src['file_name']}: {src['url']}")
                        response_text = response_text.rstrip() + "\n" + "\n".join(link_lines)
                        logs.append(f"已启用「打开原文档」，附加 {len(source_documents)} 个文档链接")
                
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
        
        # Truncate plain answers only; RAG path already truncates before appending doc links
        if not (open_original and source_documents) and len(response_text) > max_tokens:
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
            'max_tokens': max_tokens,
            'source_documents': source_documents if open_original else [],
            'return_original': return_original,
            'open_original': open_original,
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