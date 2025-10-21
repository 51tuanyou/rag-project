"""
LLM Service for making API calls to language models
"""
import requests
import json
import asyncio
import numpy as np
from typing import Optional, Dict, Any, List
from apps.llm.models import ModelCredential


class LLMService:
    def __init__(self):
        pass
    
    def generate_response(self, prompt: str, model_credential: ModelCredential, max_tokens: int = 100) -> str:
        """
        Generate response using the specified model credential
        """
        try:
            # For now, use a simple fallback method
            # In a real implementation, this would call the actual LLM API
            return self._fallback_response(prompt)
        except Exception as e:
            print(f"LLM API call failed: {e}")
            return self._fallback_response(prompt)
    
    def _fallback_response(self, prompt: str) -> str:
        """
        Fallback response when LLM is not available
        """
        # Simple word counting fallback
        import re
        words = [word for word in re.split(r'\s+', prompt.strip()) if word]
        words = [word for word in words if re.search(r'[a-zA-Z0-9\u4e00-\u9fff]', word)]
        return str(len(words))
    
    async def create_embeddings(self, texts: List[str], model: ModelCredential) -> List[List[float]]:
        """
        Create embeddings for a list of texts using the specified model
        """
        try:
            # For now, create dummy embeddings for testing
            # In a real implementation, this would call the actual embedding API
            embeddings = []
            for text in texts:
                # Create a dummy embedding vector of dimension 1536 (OpenAI standard)
                # This is just for testing - replace with actual API call
                dummy_embedding = np.random.rand(1536).tolist()
                embeddings.append(dummy_embedding)
            
            print(f"Created {len(embeddings)} dummy embeddings for {len(texts)} texts")
            return embeddings
            
        except Exception as e:
            print(f"Error creating embeddings: {str(e)}")
            # Return zero vectors as fallback
            return [[0.0] * 1536 for _ in texts]
    
    def create_embeddings_sync(self, texts: List[str], model: ModelCredential) -> List[List[float]]:
        """
        Synchronous version of create_embeddings
        """
        try:
            # For now, create dummy embeddings for testing
            # In a real implementation, this would call the actual embedding API
            embeddings = []
            for text in texts:
                # Create a dummy embedding vector of dimension 1536 (OpenAI standard)
                # This is just for testing - replace with actual API call
                dummy_embedding = np.random.rand(1536).tolist()
                embeddings.append(dummy_embedding)
            
            print(f"Created {len(embeddings)} dummy embeddings for {len(texts)} texts")
            return embeddings
            
        except Exception as e:
            print(f"Error creating embeddings: {str(e)}")
            # Return zero vectors as fallback
            return [[0.0] * 1536 for _ in texts]
