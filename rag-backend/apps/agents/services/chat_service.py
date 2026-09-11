"""
Shared RAG chat pipeline used by the web chat API and the DingTalk chat API.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urljoin

from apps.kb.models import Document, KnowledgeBase
from apps.llm.models import ModelCredential
from apps.llm.service.llm_service import LLMService
from apps.agents.models import QueryHistory
from apps.agents.services.retrieval_service import RetrievalService


def as_bool(value, default=False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def dedupe_markdown_tables(text: str) -> str:
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
            body = [ln for ln in block if ln.strip() and not re.match(r"^\s*\|?\s*[-:| ]+\s*$", ln)]
            sig = "|".join(body[:1] + [str(len(body))] + body[-1:])
            header = body[0] if body else ""
            if prev_table_sig and header and header in prev_table_sig:
                continue
            prev_table_sig = sig
            out.extend(block)
            continue
        if lines[i].strip() and not lines[i].strip().startswith("【来源"):
            prev_table_sig = None
        out.append(lines[i])
        i += 1

    collapsed: list[str] = []
    seen_sources: set[str] = set()
    j = 0
    while j < len(out):
        line = out[j]
        m = re.match(r"^【来源[:：].*?】\s*$", line.strip())
        if m:
            src = line.strip()
            k = j + 1
            while k < len(out) and not out[k].strip():
                k += 1
            table_header = out[k].strip() if k < len(out) else ""
            key = f"{src}::{table_header}"
            if key in seen_sources:
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


def resolve_default_llm(preferred_name: str = "") -> Optional[ModelCredential]:
    """Pick an enabled LLM: explicit name, then env, then first enabled LLM."""
    qs = ModelCredential.objects.filter(enabled=True, model_type="LLM")
    name = (preferred_name or os.getenv("DINGTALK_DEFAULT_LLM") or "").strip()
    if name:
        model = qs.filter(model_name=name).first() or qs.filter(model_id=name).first()
        if model:
            return model
    return qs.order_by("id").first()


def resolve_default_rerank_name() -> str:
    model = ModelCredential.objects.filter(enabled=True, model_type="Rerank").first()
    return (model.model_name if model else "") or ""


def _absolute_url(path: str, public_base_url: str) -> str:
    if not path:
        return path
    if path.startswith("http://") or path.startswith("https://"):
        return path
    base = (public_base_url or "").rstrip("/") + "/"
    if not base.startswith("http"):
        return path
    return urljoin(base, path.lstrip("/"))


def run_chat(
    message: str,
    llm_model_name: str,
    knowledge_base_id: Any = None,
    chunk_count: int = 3,
    max_tokens: int = 2000,
    return_original: bool = False,
    open_original: bool = False,
    rerank_enabled: bool = False,
    rerank_model_name: Optional[str] = None,
    public_base_url: str = "",
    persist_history: bool = True,
    session_id: str = "",
) -> Tuple[int, Dict[str, Any]]:
    """
    Shared RAG/LLM chat pipeline.

    Returns (http_status, payload_dict).
    """
    message = (message or "").strip()
    llm_model_name = (llm_model_name or "").strip()
    rerank_model_name = (rerank_model_name or "").strip() or None

    if not message:
        return 400, {"error": "Message is required"}
    if not llm_model_name:
        return 400, {"error": "LLM model is required"}

    try:
        llm_model = ModelCredential.objects.filter(
            model_name=llm_model_name,
            enabled=True,
            model_type="LLM",
        ).first()
        if not llm_model:
            return 400, {"error": f"No enabled LLM model found: {llm_model_name}"}
    except Exception as e:
        return 500, {"error": f"Error finding LLM model: {e}"}

    logs: list[str] = []
    if session_id:
        logs.append(f"会话 ID: {session_id}")
    response_text = ""
    source_documents: list[dict] = []
    retrieved_chunks: list[dict] = []

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
                if rerank_enabled:
                    logs.append(f"Rerank 已启用，模型: {rerank_model_name or '(默认 Rerank 凭证)'}")
                similar_chunks, _db_results, kb_warnings = retrieval_service.perform_retrieval_all_knowledge_bases(
                    message,
                    chunk_count,
                    rerank_enabled=rerank_enabled,
                    rerank_model_name=rerank_model_name,
                )
                logs.append("   检索范围: 全部知识库（共扫描后召回候选）")
                for w in kb_warnings:
                    logs.append(f"   警告: {w}")
            else:
                kb = KnowledgeBase.objects.filter(id=knowledge_base_id).first()
                if not kb:
                    return 404, {"error": f"Knowledge base not found: {knowledge_base_id}", "logs": logs}
                logs.append(f"   知识库名称: {kb.name}")
                if rerank_enabled:
                    logs.append(f"Rerank 已启用，模型: {rerank_model_name or '(默认 Rerank 凭证)'}")
                similar_chunks, _db_results = retrieval_service.perform_retrieval_test(
                    message,
                    kb.id,
                    chunk_count,
                    rerank_enabled=rerank_enabled,
                    rerank_model_name=rerank_model_name,
                )

            logs.append(f"检索到 {len(similar_chunks)} 个相关分块")
            if similar_chunks and similar_chunks[0].get("reranked"):
                logs.append("分块顺序已按 Rerank 分数重排")

            context_parts = []
            chunk_log_lines = []
            retrieved_chunks = []
            for i, chunk in enumerate(similar_chunks, 1):
                content = chunk.get("content") or ""
                retrieved_chunks.append({
                    "index": i,
                    "source_document": chunk.get("source_document") or "",
                    "similarity_score": chunk.get("similarity_score"),
                    "content": content,
                    "chunk_id": chunk.get("chunk_id"),
                    "document_id": chunk.get("document_id"),
                })
                context_parts.append(f"分块 {i} (相似度: {chunk['similarity_score']:.3f}):\n{content}")
                chunk_log_lines.append(
                    f"   - 分块 {i}: {chunk['source_document']} (相似度: {chunk['similarity_score']:.3f})"
                )
            if chunk_log_lines:
                logs.append("\n".join(chunk_log_lines))
                logs.append("__RETRIEVED_CHUNKS__" + json.dumps(retrieved_chunks, ensure_ascii=False))

            context = "\n\n".join(context_parts)

            if len(context_parts) == 0:
                logs.append("没有检索到相关分块，直接返回英文提示")
                response_text = "No relevant document chunks found"
                logs.append(f"返回英文提示: {response_text}")
            else:
                selected_indices: list[int] = []
                llm_service = LLMService()
                if return_original:
                    top_n = max(1, min(len(similar_chunks), 1))
                    selected_indices = list(range(1, top_n + 1))
                    logs.append(
                        "已启用「返回原文档」：按检索/Rerank 排序直接返回原文"
                        f"（分块 {selected_indices}，不重写表格）"
                    )
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
                    logs.append("调用LLM生成回答...")
                    logs.append(f"   RAG提示词内容: {rag_prompt[:500]}...")
                    logs.append(f"   最大token数: {max_tokens}")

                    response_text = llm_service.generate_response(rag_prompt, llm_model, max_tokens)
                    response_text = dedupe_markdown_tables(response_text)

                    logs.append(f"LLM回答生成完成，字符数: {len(response_text)}")
                    logs.append(f"   LLM原始回答: {response_text[:200]}...")

                if len(response_text) > max_tokens * 4:
                    soft_cap = max(max_tokens * 4, 4000)
                    if len(response_text) > soft_cap:
                        response_text = response_text[:soft_cap] + "..."
                        logs.append(f"回答已截断至 {soft_cap} 个字符")
                elif not return_original and len(response_text) > max_tokens:
                    response_text = response_text[:max_tokens] + "..."
                    logs.append(f"回答已截断至 {max_tokens} 个字符")

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
                    rel_url = f"/api/kb/documents/{doc_id}/file/"
                    abs_url = _absolute_url(rel_url, public_base_url)
                    try:
                        doc = Document.objects.get(id=doc_id)
                        source_documents.append({
                            "id": doc.id,
                            "file_name": doc.file_name,
                            "url": abs_url if public_base_url else rel_url,
                        })
                    except Document.DoesNotExist:
                        source_documents.append({
                            "id": doc_id,
                            "file_name": chunk.get("source_document") or f"Document {doc_id}",
                            "url": abs_url if public_base_url else rel_url,
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
            if "模型" in error_msg or "model" in error_msg.lower():
                return 400, {"error": f"LLM模型错误: {error_msg}", "logs": logs, "error_type": "model_error"}
            return 500, {"error": f"检索失败: {error_msg}", "logs": logs, "error_type": "retrieval_error"}
    else:
        logs.append("未选择知识库，直接调用LLM")
        logs.append("调用LLM生成回答...")
        try:
            llm_service = LLMService()
            response_text = llm_service.generate_response(message, llm_model, max_tokens)
            logs.append(f"LLM回答生成完成，字符数: {len(response_text)}")
        except Exception as e:
            error_msg = str(e)
            logs.append(f"LLM调用出错: {error_msg}")
            if "模型" in error_msg or "model" in error_msg.lower():
                return 400, {"error": f"LLM模型错误: {error_msg}", "logs": logs, "error_type": "model_error"}
            return 500, {"error": f"LLM调用失败: {error_msg}", "logs": logs, "error_type": "llm_error"}

    if not (open_original and source_documents) and len(response_text) > max_tokens:
        response_text = response_text[:max_tokens] + "..."
        logs.append(f"回答已截断至 {max_tokens} 个字符")

    if persist_history:
        try:
            QueryHistory.objects.create(
                question=message,
                response=response_text,
                logs="\n".join(logs),
            )
        except Exception:
            pass

    return 200, {
        "response": response_text,
        "logs": logs,
        "character_count": len(response_text),
        "max_tokens": max_tokens,
        "source_documents": source_documents if open_original else [],
        "retrieved_chunks": retrieved_chunks,
        "return_original": return_original,
        "open_original": open_original,
        "session_id": session_id or None,
        "llm_model_name": llm_model_name,
        "knowledge_base_id": knowledge_base_id,
    }
