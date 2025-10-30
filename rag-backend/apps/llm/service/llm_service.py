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
            # Get API credentials
            api_key = self._get_api_key(model_credential)
            base_url = self._get_base_url(model_credential)
            
            # Call the appropriate chat API based on provider
            if model_credential.provider.slug == 'openai':
                return self._call_openai_chat(prompt, api_key, base_url, model_credential, max_tokens)
            elif model_credential.provider.slug == 'ollama':
                return self._call_ollama_chat(prompt, base_url, model_credential, max_tokens)
            else:
                # Fallback for unsupported providers
                return self._fallback_response(prompt)
        except Exception as e:
            error_msg = str(e)
            print(f"LLM API call failed for model {model_credential.model_name}: {error_msg}")
            
            # Check if it's a model not found error
            if "model_not_found" in error_msg.lower() or "does not exist" in error_msg.lower():
                return f"错误：模型 '{model_credential.model_name}' 不存在。请选择其他可用的模型。"
            elif "invalid_api_key" in error_msg.lower() or "unauthorized" in error_msg.lower():
                return f"错误：API密钥无效。请检查 {model_credential.provider.name} 的API配置。"
            elif "rate_limit" in error_msg.lower():
                return f"错误：API调用频率超限。请稍后再试。"
            else:
                return f"错误：调用模型 '{model_credential.model_name}' 时发生错误：{error_msg}"
    
    def _fallback_response(self, prompt: str) -> str:
        """
        Fallback response when LLM is not available
        """
        # Return a more informative error message instead of word count
        return "抱歉，当前选择的LLM模型不可用。请检查模型配置或选择其他可用的模型。"
    
    def _clean_response(self, content: str) -> str:
        """
        Clean response content by removing thinking tags and reasoning
        """
        import re
        
        # 移除各种思考标签
        patterns = [
            r'<think>.*?</think>',
            r'<think>.*?</think>',
            r'<reasoning>.*?</reasoning>',
            r'<think>.*?',
            r'<think>.*?',
            r'<reasoning>.*?',
        ]
        
        for pattern in patterns:
            content = re.sub(pattern, '', content, flags=re.DOTALL)
        
        # 清理多余的空白
        content = content.strip()
        
        return content
    
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
    
    def _call_openai_chat(self, prompt: str, api_key: str, base_url: str, model: ModelCredential, max_tokens: int) -> str:
        """Call OpenAI chat completion API"""
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'model': model.model_id,
            'messages': [
                {'role': 'user', 'content': prompt}
            ],
            'max_tokens': max_tokens,
            'temperature': 0.3,  # 降低温度以获得更稳定的回答
            'stop': ['<think>', '<think>', '<reasoning>']  # 阻止生成思考标签
        }
        
        response = requests.post(
            f'{base_url}/chat/completions',
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            content = result['choices'][0]['message']['content'].strip()
            # 清理任何可能生成的思考标签
            content = self._clean_response(content)
            return content
        else:
            error_detail = response.text
            print(f"OpenAI API error for model {model.model_id}: {response.status_code} - {error_detail}")
            raise Exception(f"OpenAI API error: {response.status_code} - {error_detail}")
    
    def _call_ollama_chat(self, prompt: str, base_url: str, model: ModelCredential, max_tokens: int) -> str:
        """Call Ollama chat API"""
        data = {
            'model': model.model_id,
            'prompt': prompt,
            'stream': False,
            'options': {
                'num_predict': max_tokens,
                'temperature': 0.3,  # 降低温度以获得更稳定的回答
                'stop': ['<think>', '<think>', '<reasoning>']  # 阻止生成思考标签
            }
        }
        
        print(f"Ollama API call - Model: {model.model_id}, Base URL: {base_url}")
        print(f"Ollama API call - Prompt length: {len(prompt)}")
        print(f"Ollama API call - Max tokens: {max_tokens}")
        
        response = requests.post(
            f'{base_url}/api/generate',
            json=data,
            timeout=30
        )
        
        print(f"Ollama API response - Status: {response.status_code}")
        print(f"Ollama API response - Text: {response.text[:500]}...")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Ollama API result keys: {result.keys()}")
            content = result['response'].strip()
            print(f"Ollama API raw response: {content[:200]}...")
            # 清理任何可能生成的思考标签
            content = self._clean_response(content)
            print(f"Ollama API cleaned response: {content[:200]}...")
            return content
        else:
            raise Exception(f"Ollama API error: {response.status_code} - {response.text}")
