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
            # Get API credentials
            api_key = self._get_api_key(model)
            base_url = self._get_base_url(model)
            
            # Call the appropriate embedding API based on provider
            if model.provider.slug == 'openai':
                return await self._call_openai_embeddings_async(texts, api_key, base_url, model)
            elif model.provider.slug == 'ollama':
                return await self._call_ollama_embeddings_async(texts, base_url, model)
            else:
                # Fallback to dummy embeddings for unsupported providers
                print(f"Unsupported provider: {model.provider.slug}, using dummy embeddings")
                return self._create_dummy_embeddings(texts)
            
        except Exception as e:
            print(f"Error creating embeddings: {str(e)}")
            # For production use, we should not fallback to dummy embeddings
            # Instead, we should raise the error to let the caller handle it
            raise Exception(f"Failed to create embeddings: {str(e)}. Please check your API configuration and network connection.")
    
    def create_embeddings_sync(self, texts: List[str], model: ModelCredential) -> List[List[float]]:
        """
        Synchronous version of create_embeddings with real API calls
        """
        try:
            # Get API credentials
            api_key = self._get_api_key(model)
            base_url = self._get_base_url(model)
            
            # Call the appropriate embedding API based on provider
            if model.provider.slug == 'openai':
                return self._call_openai_embeddings(texts, api_key, base_url, model)
            elif model.provider.slug == 'ollama':
                return self._call_ollama_embeddings(texts, base_url, model)
            else:
                # Fallback to dummy embeddings for unsupported providers
                print(f"Unsupported provider: {model.provider.slug}, using dummy embeddings")
                return self._create_dummy_embeddings(texts)
            
        except Exception as e:
            print(f"Error creating embeddings: {str(e)}")
            # For production use, we should not fallback to dummy embeddings
            # Instead, we should raise the error to let the caller handle it
            raise Exception(f"Failed to create embeddings: {str(e)}. Please check your API configuration and network connection.")
    
    def _get_api_key(self, model: ModelCredential) -> str:
        """Get API key for the model"""
        if model.secret:
            return model.secret
        
        # Try to get from provider API keys
        api_key = model.provider.api_keys.filter(is_selected=True).first()
        if api_key:
            return api_key.secret
        
        raise ValueError(f"No API key found for model {model.model_name}")
    
    def _get_base_url(self, model: ModelCredential) -> str:
        """Get base URL for the model"""
        if model.base_url:
            return model.base_url
        
        # Try to get from provider API keys
        api_key = model.provider.api_keys.filter(is_selected=True).first()
        if api_key and api_key.api_base:
            return api_key.api_base
        
        # Default URLs based on provider
        if model.provider.slug == 'openai':
            return 'https://api.openai.com/v1'
        elif model.provider.slug == 'ollama':
            return 'http://localhost:11434'
        
        raise ValueError(f"No base URL found for model {model.model_name}")
    
    def _call_openai_embeddings(self, texts: List[str], api_key: str, base_url: str, model: ModelCredential) -> List[List[float]]:
        """Call OpenAI embeddings API"""
        import requests
        
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'input': texts,
            'model': model.model_id
        }
        
        response = requests.post(
            f'{base_url}/embeddings',
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return [item['embedding'] for item in result['data']]
        else:
            raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")
    
    def _call_ollama_embeddings(self, texts: List[str], base_url: str, model: ModelCredential) -> List[List[float]]:
        """Call Ollama embeddings API"""
        import requests
        
        embeddings = []
        for text in texts:
            data = {
                'model': model.model_id,
                'prompt': text
            }
            
            response = requests.post(
                f'{base_url}/api/embeddings',
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                embeddings.append(result['embedding'])
            else:
                raise Exception(f"Ollama API error: {response.status_code} - {response.text}")
        
        return embeddings
    
    def _create_dummy_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Create dummy embeddings for testing - WARNING: These are not meaningful for similarity search"""
        embeddings = []
        for i, text in enumerate(texts):
            # Create a deterministic dummy embedding based on text content
            # This ensures the same text always gets the same embedding
            import hashlib
            text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
            # Use hash to seed random number generator for deterministic results
            np.random.seed(int(text_hash[:8], 16))
            dummy_embedding = np.random.rand(1536).tolist()
            embeddings.append(dummy_embedding)
        
        print(f"WARNING: Created {len(embeddings)} dummy embeddings for {len(texts)} texts")
        print("These embeddings are not suitable for meaningful similarity search!")
        return embeddings
    
    async def _call_openai_embeddings_async(self, texts: List[str], api_key: str, base_url: str, model: ModelCredential) -> List[List[float]]:
        """Call OpenAI embeddings API asynchronously"""
        import aiohttp
        
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'input': texts,
            'model': model.model_id
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{base_url}/embeddings',
                headers=headers,
                json=data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    embeddings = [item['embedding'] for item in result['data']]
                    print(f"Successfully created {len(embeddings)} OpenAI embeddings")
                    return embeddings
                else:
                    error_text = await response.text()
                    raise Exception(f"OpenAI API error {response.status}: {error_text}")
    
    async def _call_ollama_embeddings_async(self, texts: List[str], base_url: str, model: ModelCredential) -> List[List[float]]:
        """Call Ollama embeddings API asynchronously"""
        import aiohttp
        
        embeddings = []
        
        async with aiohttp.ClientSession() as session:
            for text in texts:
                data = {
                    'model': model.model_id,
                    'prompt': text
                }
                
                async with session.post(
                    f'{base_url}/api/embeddings',
                    json=data,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        embeddings.append(result['embedding'])
                    else:
                        error_text = await response.text()
                        print(f"Ollama API error for text: {error_text}")
                        # Don't use dummy embeddings, raise error instead
                        raise Exception(f"Ollama API error: {response.status} - {error_text}")
        
        print(f"Successfully created {len(embeddings)} Ollama embeddings")
        return embeddings
