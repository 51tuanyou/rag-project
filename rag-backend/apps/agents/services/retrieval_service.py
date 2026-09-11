"""
Retrieval service for vector similarity search using langchain
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from django.db.models import Q
from apps.llm.models import ModelCredential
from apps.llm.service.llm_service import LLMService
from apps.kb.models import KnowledgeBase, Chunk


class RetrievalService:
    """Service for performing vector similarity search"""

    # Over-fetch factor before rerank; capped so we stay within rerank API limits
    RERANK_CANDIDATE_MULTIPLIER = 5
    RERANK_CANDIDATE_CAP = 50

    def __init__(self):
        self.pg_connection = None
        self.llm_service = LLMService()

    def get_pg_connection(self):
        """Get PostgreSQL connection for PGVector"""
        if self.pg_connection is None:
            # Get connection parameters from environment variables
            db_host = os.getenv('PGVECTOR_HOST', 'localhost')
            db_port = os.getenv('PGVECTOR_PORT', '5432')
            db_name = os.getenv('PGVECTOR_DB', 'rag_vectors')
            db_user = os.getenv('PGVECTOR_USER', 'postgres')
            db_password = os.getenv('PGVECTOR_PASSWORD', '')

            # If environment variables are not set, use hardcoded values for testing
            if not db_password:
                db_password = 'root-secret'

            print(f"Connecting to PostgreSQL: {db_user}@{db_host}:{db_port}/{db_name}")

            self.pg_connection = psycopg2.connect(
                host=db_host,
                port=db_port,
                database=db_name,
                user=db_user,
                password=db_password
            )
        return self.pg_connection

    def close_connection(self):
        """Close PostgreSQL connection"""
        if self.pg_connection:
            self.pg_connection.close()
            self.pg_connection = None

    def get_embedding_model_credentials(self, knowledge_base: KnowledgeBase) -> ModelCredential:
        """Get embedding model credentials for the knowledge base"""
        if not knowledge_base.embedding_model:
            raise ValueError(f"Knowledge base '{knowledge_base.name}' has no embedding model configured")

        return knowledge_base.embedding_model

    def _candidate_k(self, top_k: int, rerank_enabled: bool) -> int:
        if not rerank_enabled:
            return top_k
        return min(max(top_k * self.RERANK_CANDIDATE_MULTIPLIER, top_k), self.RERANK_CANDIDATE_CAP)

    def resolve_rerank_model(self, rerank_model_name: Optional[str]) -> ModelCredential:
        """Resolve an enabled Rerank ModelCredential by model_name or model_id."""
        name = (rerank_model_name or "").strip()
        qs = ModelCredential.objects.filter(
            enabled=True,
            model_type=ModelCredential.ModelType.RERANK,
        )
        if name:
            model = qs.filter(Q(model_name=name) | Q(model_id=name)).first()
            if not model:
                raise ValueError(
                    f"No enabled Rerank model found for '{name}'. "
                    "Add a Model credential with Model type=Rerank."
                )
            return model

        model = qs.first()
        if not model:
            raise ValueError(
                "Rerank is enabled but no Rerank model credential is configured. "
                "Add one in Django admin (Model type=Rerank)."
            )
        return model

    def apply_rerank(
        self,
        query_text: str,
        chunks: List[Dict[str, Any]],
        top_k: int,
        rerank_model_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Reorder vector-recalled chunks via the configured rerank HTTP service."""
        if not chunks:
            return []

        rerank_model = self.resolve_rerank_model(rerank_model_name)
        documents = [(c.get("content") or "") for c in chunks]
        ranked = self.llm_service.rerank(
            query=query_text,
            documents=documents,
            model=rerank_model,
            top_n=min(top_k, len(documents)),
            normalize=True,
        )

        reranked: List[Dict[str, Any]] = []
        for rank_i, item in enumerate(ranked):
            idx = item["index"]
            if idx < 0 or idx >= len(chunks):
                continue
            chunk = dict(chunks[idx])
            chunk["vector_similarity_score"] = chunk.get("similarity_score")
            chunk["similarity_score"] = round(float(item["score"]), 4)
            chunk["rank"] = rank_i + 1
            chunk["reranked"] = True
            reranked.append(chunk)

        if not reranked:
            # Fall back to original order if the service returned nothing usable
            return chunks[:top_k]
        return reranked

    def create_query_embedding(self, query_text: str, embedding_model: ModelCredential) -> List[float]:
        """Create embedding for the query text using the specified model"""
        try:
            # Create embedding using LLM service
            embeddings = self.llm_service.create_embeddings_sync(
                texts=[query_text],
                model=embedding_model
            )

            if not embeddings or len(embeddings) == 0:
                raise ValueError("Failed to create query embedding")

            return embeddings[0]

        except Exception as e:
            print(f"Error creating query embedding: {str(e)}")
            # Check if this is a network/API issue
            if "Failed to create embeddings" in str(e) or "network" in str(e).lower():
                raise Exception(f"Embedding service unavailable: {str(e)}. Please check your API configuration and network connection.")
            raise e

    def search_similar_chunks(
        self,
        query_embedding: List[float],
        knowledge_base_id: Optional[int] = None,
        top_k: int = 3,
    ) -> List[Dict[str, Any]]:
        """Search for similar chunks using vector similarity.

        If knowledge_base_id is None, search across all knowledge bases.
        """
        conn = None
        cursor = None
        try:
            conn = self.get_pg_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            # Convert embedding to string format for PGVector
            embedding_vector = np.array(query_embedding).astype(np.float32)
            embedding_str = '[' + ','.join(map(str, embedding_vector)) + ']'

            if knowledge_base_id is None:
                search_sql = """
                SELECT
                    ce.chunk_id,
                    ce.document_id,
                    ce.knowledge_base_id,
                    ce.content,
                    ce.characters,
                    1 - (ce.embedding <=> %s::vector) as similarity_score
                FROM chunk_embeddings ce
                ORDER BY ce.embedding <=> %s::vector
                LIMIT %s
                """
                cursor.execute(search_sql, (embedding_str, embedding_str, top_k))
            else:
                search_sql = """
                SELECT
                    ce.chunk_id,
                    ce.document_id,
                    ce.knowledge_base_id,
                    ce.content,
                    ce.characters,
                    1 - (ce.embedding <=> %s::vector) as similarity_score
                FROM chunk_embeddings ce
                WHERE ce.knowledge_base_id = %s
                ORDER BY ce.embedding <=> %s::vector
                LIMIT %s
                """
                cursor.execute(
                    search_sql,
                    (embedding_str, knowledge_base_id, embedding_str, top_k),
                )

            rows = cursor.fetchall()
            similar_chunks = []

            for i, row in enumerate(rows):
                # Resolve display name
                file_name = ""
                kb_name = ""
                try:
                    from apps.kb.models import Document
                    doc = Document.objects.filter(id=row["document_id"]).first()
                    if doc:
                        file_name = doc.file_name
                    if knowledge_base_id is None and row.get("knowledge_base_id"):
                        kb = KnowledgeBase.objects.filter(id=row["knowledge_base_id"]).first()
                        if kb:
                            kb_name = kb.name
                except Exception:
                    file_name = ""
                    kb_name = ""

                source = f"{kb_name} / {file_name}" if kb_name and knowledge_base_id is None else file_name

                similar_chunks.append({
                    'id': f'chunk-{row["chunk_id"]}',
                    'content': row['content'],
                    'similarity_score': round(float(row['similarity_score']), 3),
                    'source_document': source,
                    'character_count': row['characters'],
                    'rank': i + 1,
                    'chunk_id': row['chunk_id'],
                    'document_id': row['document_id'],
                    'knowledge_base_id': row.get('knowledge_base_id'),
                })

            return similar_chunks

        except Exception as e:
            print(f"Error searching similar chunks: {str(e)}")
            raise e
        finally:
            if cursor is not None:
                cursor.close()

    def perform_retrieval_test(
        self,
        query_text: str,
        knowledge_base_id: int,
        top_k: int = 3,
        rerank_enabled: bool = False,
        rerank_model_name: Optional[str] = None,
        close_connection: bool = True,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Perform complete retrieval: vector recall, optional rerank."""
        try:
            # Get knowledge base
            knowledge_base = KnowledgeBase.objects.get(id=knowledge_base_id)

            # Get embedding model credentials
            embedding_model = self.get_embedding_model_credentials(knowledge_base)

            # Create query embedding
            query_embedding = self.create_query_embedding(query_text, embedding_model)

            recall_k = self._candidate_k(top_k, rerank_enabled)
            similar_chunks = self.search_similar_chunks(query_embedding, knowledge_base_id, recall_k)

            if rerank_enabled and similar_chunks:
                similar_chunks = self.apply_rerank(
                    query_text, similar_chunks, top_k, rerank_model_name
                )
            else:
                similar_chunks = similar_chunks[:top_k]
                for i, chunk in enumerate(similar_chunks):
                    chunk["rank"] = i + 1

            # Prepare results for database storage
            db_results = []
            for chunk_data in similar_chunks:
                db_results.append({
                    'chunk_id': chunk_data['chunk_id'],
                    'similarity_score': chunk_data['similarity_score'],
                    'rank': chunk_data['rank']
                })

            return similar_chunks, db_results

        except Exception as e:
            print(f"Error in retrieval test: {str(e)}")
            raise e
        finally:
            if close_connection:
                self.close_connection()

    def count_embeddings_for_kb(self, knowledge_base_id: int) -> int:
        """Count stored vectors for a knowledge base."""
        conn = None
        cursor = None
        try:
            conn = self.get_pg_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM chunk_embeddings WHERE knowledge_base_id = %s",
                (knowledge_base_id,),
            )
            row = cursor.fetchone()
            return int(row[0]) if row else 0
        except Exception:
            return 0
        finally:
            if cursor is not None:
                cursor.close()

    def perform_retrieval_all_knowledge_bases(
        self,
        query_text: str,
        top_k: int = 3,
        rerank_enabled: bool = False,
        rerank_model_name: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
        """Retrieve across every knowledge base, then merge (and optionally rerank).

        Returns (chunks, db_results, warnings).
        """
        try:
            knowledge_bases = list(KnowledgeBase.objects.all())
            if not knowledge_bases:
                return [], [], ["没有可用的知识库"]

            per_kb_k = self._candidate_k(top_k, rerank_enabled)
            merged: List[Dict[str, Any]] = []
            errors: List[str] = []
            warnings: List[str] = []

            for kb in knowledge_bases:
                try:
                    emb_count = self.count_embeddings_for_kb(kb.id)
                    if emb_count == 0:
                        warnings.append(
                            f"{kb.name}: 向量库中无嵌入（0 条），请重新向量化该知识库"
                        )
                        print(f"KB {kb.id} ({kb.name}) has 0 embeddings in PGVector")
                        continue

                    # Per-KB vector recall only; global rerank once after merge
                    chunks, _ = self.perform_retrieval_test(
                        query_text,
                        kb.id,
                        per_kb_k,
                        rerank_enabled=False,
                        close_connection=False,
                    )
                    print(f"KB {kb.id} ({kb.name}): recalled {len(chunks)} / embeddings={emb_count}")
                    for chunk in chunks:
                        # Prefix source with KB name for clarity in all-KB mode
                        if not str(chunk.get("source_document", "")).startswith(f"{kb.name} /"):
                            chunk["source_document"] = f"{kb.name} / {chunk.get('source_document', '')}"
                        chunk["knowledge_base_id"] = kb.id
                        chunk["knowledge_base_name"] = kb.name
                    merged.extend(chunks)
                except Exception as e:
                    errors.append(f"{kb.name}: {e}")
                    print(f"Skip KB {kb.id} ({kb.name}) during all-KB retrieval: {e}")

            if errors:
                warnings.extend([f"检索失败 — {e}" for e in errors])

            merged.sort(key=lambda c: c.get("similarity_score", 0), reverse=True)
            unique_docs = {c.get("document_id") for c in merged}
            unique_kbs = {c.get("knowledge_base_id") for c in merged}
            print(
                f"All-KB merge: {len(merged)} candidates from "
                f"{len(unique_kbs)} KBs / {len(unique_docs)} documents"
            )

            if rerank_enabled and merged:
                # Cap merged candidates before a single rerank call
                candidates = merged[: self.RERANK_CANDIDATE_CAP]
                top_chunks = self.apply_rerank(
                    query_text, candidates, top_k, rerank_model_name
                )
            else:
                top_chunks = merged[:top_k]
                for i, chunk in enumerate(top_chunks):
                    chunk["rank"] = i + 1

            if not top_chunks and (errors or warnings):
                raise Exception(
                    "Failed to retrieve from all knowledge bases: "
                    + "; ".join((errors or warnings)[:3])
                )

            db_results = [
                {
                    "chunk_id": c["chunk_id"],
                    "similarity_score": c["similarity_score"],
                    "rank": c["rank"],
                }
                for c in top_chunks
            ]
            return top_chunks, db_results, warnings
        finally:
            self.close_connection()

    def get_chunk_by_id(self, chunk_id: str, document_id: int = None) -> Chunk:
        """Get chunk by ID from database"""
        try:
            # chunk_id here is actually the database primary key (id field)
            # not the business chunk_id field
            chunk = Chunk.objects.filter(id=chunk_id).first()
            if chunk is None:
                raise ValueError(f"Chunk with ID '{chunk_id}' not found")
            return chunk
        except Exception as e:
            raise ValueError(f"Error retrieving chunk '{chunk_id}': {str(e)}")
