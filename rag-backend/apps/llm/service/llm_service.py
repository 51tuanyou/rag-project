"""
LLM Service for making API calls to language models
"""
import requests
import json
from typing import Optional, Dict, Any
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
