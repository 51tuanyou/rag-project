"""
Retrieval service for vector similarity search using langchain
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import numpy as np
from typing import List, Dict, Any, Tuple
from apps.llm.models import ModelCredential
from apps.llm.service.llm_service import LLMService
from apps.kb.models import KnowledgeBase, Chunk


class RetrievalService:
    """Service for performing vector similarity search"""
    
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
    
    def search_similar_chunks(self, query_embedding: List[float], knowledge_base_id: int, top_k: int = 3) -> List[Dict[str, Any]]:
        """Search for similar chunks using vector similarity"""
        conn = None
        try:
            conn = self.get_pg_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Convert embedding to string format for PGVector
            embedding_vector = np.array(query_embedding).astype(np.float32)
            embedding_str = '[' + ','.join(map(str, embedding_vector)) + ']'
            
            # Perform vector similarity search using cosine similarity
            # Note: We only get chunk info from PGVector, document info will be fetched separately
            search_sql = """
            SELECT 
                ce.id,
                ce.chunk_id,
                ce.content,
                ce.characters,
                ce.chunk_number,
                ce.document_id,
                1 - (ce.embedding <=> %s::vector) as similarity_score
            FROM chunk_embeddings ce
            WHERE ce.knowledge_base_id = %s
            ORDER BY ce.embedding <=> %s::vector
            LIMIT %s
            """
            
            cursor.execute(search_sql, (embedding_str, knowledge_base_id, embedding_str, top_k))
            results = cursor.fetchall()
            
            # Get document information from Django models
            from apps.kb.models import Document
            
            # Convert results to list of dictionaries
            similar_chunks = []
            for i, row in enumerate(results):
                try:
                    # Get document info from Django models
                    document = Document.objects.get(id=row['document_id'])
                    file_name = document.file_name
                except Document.DoesNotExist:
                    file_name = f"Document {row['document_id']}"
                
                similar_chunks.append({
                    'id': f'chunk-{row["chunk_id"]}',
                    'content': row['content'],
                    'score': round(float(row['similarity_score']), 3),
                    'source_document': file_name,
                    'character_count': row['characters'],
                    'rank': i + 1,
                    'chunk_id': row['chunk_id'],
                    'document_id': row['document_id']
                })
            
            return similar_chunks
            
        except Exception as e:
            print(f"Error searching similar chunks: {str(e)}")
            raise e
        finally:
            if conn:
                cursor.close()
    
    def perform_retrieval_test(self, query_text: str, knowledge_base_id: int, top_k: int = 3) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Perform complete retrieval test with vector similarity search"""
        try:
            # Get knowledge base
            knowledge_base = KnowledgeBase.objects.get(id=knowledge_base_id)
            
            # Get embedding model credentials
            embedding_model = self.get_embedding_model_credentials(knowledge_base)
            
            # Create query embedding
            query_embedding = self.create_query_embedding(query_text, embedding_model)
            
            # Search for similar chunks
            similar_chunks = self.search_similar_chunks(query_embedding, knowledge_base_id, top_k)
            
            # Prepare results for database storage
            db_results = []
            for chunk_data in similar_chunks:
                db_results.append({
                    'chunk_id': chunk_data['chunk_id'],
                    'similarity_score': chunk_data['score'],
                    'rank': chunk_data['rank']
                })
            
            return similar_chunks, db_results
            
        except Exception as e:
            print(f"Error in retrieval test: {str(e)}")
            raise e
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
