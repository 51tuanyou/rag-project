"""
Vectorization service for embedding chunks and storing in PGVector
"""
import os
import asyncio
from typing import List, Dict, Any
from django.conf import settings
import psycopg2
from psycopg2.extras import RealDictCursor
import numpy as np
from apps.llm.service.llm_service import LLMService


class VectorizationService:
    """Service for vectorizing chunks and storing in PGVector"""
    
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
            print(f"Password set: {'Yes' if db_password else 'No'}")
            
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
    
    async def create_embeddings(self, chunks: List[Dict[str, Any]], embedding_model_id: int) -> List[Dict[str, Any]]:
        """Create embeddings for chunks using the specified embedding model"""
        try:
            # Get embedding model details
            from apps.llm.models import ModelCredential
            embedding_model = ModelCredential.objects.get(id=embedding_model_id)
            
            # Prepare chunks for embedding
            chunk_texts = [chunk['content'] for chunk in chunks]
            
            # Create embeddings using LLM service
            embeddings = await self.llm_service.create_embeddings(
                texts=chunk_texts,
                model=embedding_model
            )
            
            # Combine chunks with their embeddings
            result = []
            for i, chunk in enumerate(chunks):
                result.append({
                    'chunk_id': chunk['chunk_id'],
                    'content': chunk['content'],
                    'characters': chunk['characters'],
                    'chunk_number': chunk['chunk_number'],
                    'embedding': embeddings[i] if i < len(embeddings) else None
                })
            
            return result
            
        except Exception as e:
            print(f"Error creating embeddings: {str(e)}")
            raise e
    
    async def store_vectors_in_pgvector(self, chunks_with_embeddings: List[Dict[str, Any]], 
                                      knowledge_base_id: int, document_id: int):
        """Store vectors in PGVector database"""
        conn = None
        try:
            conn = self.get_pg_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Create table if not exists
            create_table_sql = """
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE TABLE IF NOT EXISTS chunk_embeddings (
                id SERIAL PRIMARY KEY,
                chunk_id VARCHAR(100) NOT NULL,
                knowledge_base_id INTEGER NOT NULL,
                document_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                characters INTEGER NOT NULL,
                chunk_number INTEGER NOT NULL,
                embedding vector(1536),  -- Adjust dimension based on your embedding model
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_kb_id ON chunk_embeddings(knowledge_base_id);
            CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_doc_id ON chunk_embeddings(document_id);
            CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_chunk_id ON chunk_embeddings(chunk_id);
            """
            
            cursor.execute(create_table_sql)
            conn.commit()
            
            # Delete existing embeddings for this document
            delete_sql = """
            DELETE FROM chunk_embeddings 
            WHERE knowledge_base_id = %s AND document_id = %s
            """
            cursor.execute(delete_sql, (knowledge_base_id, document_id))
            
            # Insert new embeddings
            insert_sql = """
            INSERT INTO chunk_embeddings 
            (chunk_id, knowledge_base_id, document_id, content, characters, chunk_number, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            for chunk in chunks_with_embeddings:
                if chunk['embedding'] is not None:
                    # Convert embedding to numpy array and then to string format for PGVector
                    embedding_vector = np.array(chunk['embedding']).astype(np.float32)
                    embedding_str = '[' + ','.join(map(str, embedding_vector)) + ']'
                    
                    cursor.execute(insert_sql, (
                        chunk['chunk_id'],
                        knowledge_base_id,
                        document_id,
                        chunk['content'],
                        chunk['characters'],
                        chunk['chunk_number'],
                        embedding_str
                    ))
            
            conn.commit()
            print(f"Successfully stored {len(chunks_with_embeddings)} vectors in PGVector")
            
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"Error storing vectors in PGVector: {str(e)}")
            raise e
        finally:
            if conn:
                cursor.close()
    
    async def vectorize_and_store_chunks(self, chunks: List[Dict[str, Any]], 
                                       embedding_model_id: int, 
                                       knowledge_base_id: int, 
                                       document_id: int):
        """Main method to vectorize chunks and store in PGVector"""
        try:
            print(f"Starting vectorization for {len(chunks)} chunks...")
            
            # Create embeddings
            chunks_with_embeddings = await self.create_embeddings(chunks, embedding_model_id)
            
            # Store in PGVector
            await self.store_vectors_in_pgvector(chunks_with_embeddings, knowledge_base_id, document_id)
            
            print("Vectorization completed successfully!")
            return True
            
        except Exception as e:
            print(f"Error in vectorization process: {str(e)}")
            raise e
        finally:
            self.close_connection()
    
    def vectorize_and_store_chunks_sync(self, chunks: List[Dict[str, Any]], 
                                       embedding_model_id: int, 
                                       knowledge_base_id: int, 
                                       document_id: int):
        """Synchronous version of vectorize_and_store_chunks"""
        try:
            print(f"Starting vectorization for {len(chunks)} chunks...")
            
            # Create embeddings synchronously
            chunks_with_embeddings = self.create_embeddings_sync(chunks, embedding_model_id)
            
            # Store in PGVector synchronously
            self.store_vectors_in_pgvector_sync(chunks_with_embeddings, knowledge_base_id, document_id)
            
            print("Vectorization completed successfully!")
            return True
            
        except Exception as e:
            print(f"Error in vectorization process: {str(e)}")
            raise e
        finally:
            self.close_connection()
    
    def create_embeddings_sync(self, chunks: List[Dict[str, Any]], embedding_model_id: int) -> List[Dict[str, Any]]:
        """Synchronous version of create_embeddings"""
        try:
            # Get embedding model details
            from apps.llm.models import ModelCredential
            embedding_model = ModelCredential.objects.get(id=embedding_model_id)
            
            # Prepare chunks for embedding
            chunk_texts = [chunk['content'] for chunk in chunks]
            
            # Create embeddings using LLM service (synchronous)
            embeddings = self.llm_service.create_embeddings_sync(
                texts=chunk_texts,
                model=embedding_model
            )
            
            # Combine chunks with their embeddings
            result = []
            for i, chunk in enumerate(chunks):
                result.append({
                    'chunk_id': chunk['chunk_id'],
                    'content': chunk['content'],
                    'characters': chunk['characters'],
                    'chunk_number': chunk['chunk_number'],
                    'embedding': embeddings[i] if i < len(embeddings) else None
                })
            
            return result
            
        except Exception as e:
            print(f"Error creating embeddings: {str(e)}")
            raise e
    
    def store_vectors_in_pgvector_sync(self, chunks_with_embeddings: List[Dict[str, Any]], 
                                      knowledge_base_id: int, document_id: int):
        """Synchronous version of store_vectors_in_pgvector"""
        conn = None
        try:
            conn = self.get_pg_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Create table if not exists
            create_table_sql = """
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE TABLE IF NOT EXISTS chunk_embeddings (
                id SERIAL PRIMARY KEY,
                chunk_id VARCHAR(100) NOT NULL,
                knowledge_base_id INTEGER NOT NULL,
                document_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                characters INTEGER NOT NULL,
                chunk_number INTEGER NOT NULL,
                embedding vector(1536),  -- Adjust dimension based on your embedding model
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_kb_id ON chunk_embeddings(knowledge_base_id);
            CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_doc_id ON chunk_embeddings(document_id);
            CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_chunk_id ON chunk_embeddings(chunk_id);
            """
            
            cursor.execute(create_table_sql)
            conn.commit()
            
            # Delete existing embeddings for this document
            delete_sql = """
            DELETE FROM chunk_embeddings 
            WHERE knowledge_base_id = %s AND document_id = %s
            """
            cursor.execute(delete_sql, (knowledge_base_id, document_id))
            
            # Insert new embeddings
            insert_sql = """
            INSERT INTO chunk_embeddings 
            (chunk_id, knowledge_base_id, document_id, content, characters, chunk_number, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            for chunk in chunks_with_embeddings:
                if chunk['embedding'] is not None:
                    # Convert embedding to numpy array and then to string format for PGVector
                    embedding_vector = np.array(chunk['embedding']).astype(np.float32)
                    embedding_str = '[' + ','.join(map(str, embedding_vector)) + ']'
                    
                    cursor.execute(insert_sql, (
                        chunk['chunk_id'],
                        knowledge_base_id,
                        document_id,
                        chunk['content'],
                        chunk['characters'],
                        chunk['chunk_number'],
                        embedding_str
                    ))
            
            conn.commit()
            print(f"Successfully stored {len(chunks_with_embeddings)} vectors in PGVector")
            
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"Error storing vectors in PGVector: {str(e)}")
            raise e
        finally:
            if conn:
                cursor.close()
