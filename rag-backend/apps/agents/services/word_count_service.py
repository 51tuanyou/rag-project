"""
Word count service using LLM for accurate word counting
"""
import re
from typing import Optional
from apps.llm.models import ModelCredential
from apps.llm.service.llm_service import LLMService


class WordCountService:
    def __init__(self):
        self.llm_service = LLMService()
    
    def count_words_llm(self, text: str, model_credential: Optional[ModelCredential] = None) -> int:
        """
        Use LLM to count words accurately
        """
        if not text.strip():
            return 0
        
        # Try to get a default model if none provided
        if not model_credential:
            try:
                model_credential = ModelCredential.objects.filter(enabled=True).first()
            except:
                return self._fallback_word_count(text)
        
        if not model_credential:
            return self._fallback_word_count(text)
        
        prompt = f"""Please count the exact number of words in the following text. 
Return only the number, no explanation.

Text:
{text}

Word count:"""
        
        try:
            response = self.llm_service.generate_response(
                prompt=prompt,
                model_credential=model_credential,
                max_tokens=10
            )
            
            # Extract number from response
            word_count = self._extract_number_from_response(response)
            return word_count if word_count > 0 else self._fallback_word_count(text)
            
        except Exception as e:
            print(f"LLM word count failed: {e}")
            return self._fallback_word_count(text)
    
    def _extract_number_from_response(self, response: str) -> int:
        """Extract number from LLM response"""
        # Remove any non-digit characters except for the number
        numbers = re.findall(r'\d+', response.strip())
        if numbers:
            return int(numbers[0])
        return 0
    
    def _fallback_word_count(self, text: str) -> int:
        """
        Fallback word counting method using regex
        More accurate than simple character division
        """
        if not text.strip():
            return 0
        
        # Split by whitespace and filter out empty strings
        words = [word for word in re.split(r'\s+', text.strip()) if word]
        
        # Filter out pure punctuation
        words = [word for word in words if re.search(r'[a-zA-Z0-9\u4e00-\u9fff]', word)]
        
        return len(words)
    
    def count_words_smart(self, text: str, use_llm: bool = True, model_credential: Optional[ModelCredential] = None) -> int:
        """
        Smart word counting with LLM fallback
        """
        if not text.strip():
            return 0
        
        # For short texts, use regex method
        if len(text) < 100:
            return self._fallback_word_count(text)
        
        # For longer texts, use LLM if available
        if use_llm:
            return self.count_words_llm(text, model_credential)
        else:
            return self._fallback_word_count(text)
