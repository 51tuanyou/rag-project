"""
LLM Service for making API calls to language models
"""
import requests
import numpy as np
from typing import Any, Dict, List, Optional
from apps.llm.models import ModelCredential


class LLMService:
    # Providers that speak the OpenAI Chat Completions / Embeddings API shape
    OPENAI_COMPATIBLE_PROVIDERS = {
        "openai",
        "deepseek",
        "tongyi",
        "doubao",
        "custom",
    }
    # Local / self-hosted providers that often run without an API key
    KEYLESS_PROVIDERS = {
        "ollama",
        "custom",
    }

    # Local / self-hosted embedding servers (e.g. TEI/Xinference) often cap batch size
    EMBEDDING_BATCH_SIZE = 64

    def __init__(self):
        pass

    def _iter_batches(self, items: List[Any], batch_size: int):
        size = max(1, int(batch_size))
        for i in range(0, len(items), size):
            yield items[i : i + size]

    def _is_openai_compatible(self, provider_slug: str) -> bool:
        # Native Ollama uses /api/*; other providers use OpenAI-shaped HTTP APIs.
        return provider_slug != "ollama"

    def _requires_api_key(self, provider_slug: str) -> bool:
        return provider_slug not in self.KEYLESS_PROVIDERS

    def _auth_headers(self, api_key: Optional[str] = None) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        key = (api_key or "").strip()
        if key and key.lower() not in {"ollama", "dummy", "none", "n/a"}:
            headers["Authorization"] = f"Bearer {key}"
        return headers

    def _normalize_model_id(self, model_id: str) -> str:
        """Strip accidental quotes/backticks from DB-entered model ids."""
        return (model_id or "").strip().strip("'\"`")

    def _normalize_base_url(self, base_url: str, provider_slug: str) -> str:
        """Normalize base URL for the provider's expected API path."""
        import re

        url = (base_url or "").rstrip("/")
        # Native Ollama endpoints are /api/*, not /v1/*
        if provider_slug == "ollama" and url.endswith("/v1"):
            return url[:-3].rstrip("/")

        # OpenAI-compatible roots that already include a version suffix
        # (e.g. .../v1, Volcengine Ark .../api/v3) must not get another /v1.
        if provider_slug != "ollama" and not re.search(r"/v\d+$", url):
            url = f"{url}/v1"
        return url

    def generate_response(self, prompt: str, model_credential: ModelCredential, max_tokens: int = 100) -> str:
        """
        Generate response using the specified model credential
        """
        try:
            provider_slug = model_credential.provider.slug
            api_key = self._get_api_key(
                model_credential, required=self._requires_api_key(provider_slug)
            )
            base_url = self._get_base_url(model_credential)

            if self._is_openai_compatible(provider_slug):
                return self._call_openai_chat(prompt, api_key, base_url, model_credential, max_tokens)
            if provider_slug == "ollama":
                return self._call_ollama_chat(prompt, base_url, model_credential, max_tokens)

            return self._fallback_response(prompt)
        except Exception as e:
            error_msg = str(e)
            print(f"LLM API call failed for model {model_credential.model_name}: {error_msg}")

            if "model_not_found" in error_msg.lower() or "does not exist" in error_msg.lower():
                return f"错误：模型 '{model_credential.model_name}' 不存在。请选择其他可用的模型。"
            if "invalid_api_key" in error_msg.lower() or "unauthorized" in error_msg.lower():
                return f"错误：API密钥无效。请检查 {model_credential.provider.display_name} 的API配置。"
            if "rate_limit" in error_msg.lower():
                return f"错误：API调用频率超限。请稍后再试。"
            return f"错误：调用模型 '{model_credential.model_name}' 时发生错误：{error_msg}"

    def _fallback_response(self, prompt: str) -> str:
        """
        Fallback response when LLM is not available
        """
        return "抱歉，当前选择的LLM模型不可用。请检查模型配置或选择其他可用的模型。"

    def _clean_response(self, content: str) -> str:
        """
        Clean response content by removing thinking tags and reasoning
        """
        import re

        patterns = [
            r"<think>.*?</think>",
            r"<think>.*?</think>",
            r"<reasoning>.*?</reasoning>",
            r"<think>.*?",
            r"<think>.*?",
            r"<reasoning>.*?",
        ]

        for pattern in patterns:
            content = re.sub(pattern, "", content, flags=re.DOTALL)

        return content.strip()

    async def create_embeddings(self, texts: List[str], model: ModelCredential) -> List[List[float]]:
        """
        Create embeddings for a list of texts using the specified model
        """
        try:
            provider_slug = model.provider.slug
            api_key = self._get_api_key(model, required=self._requires_api_key(provider_slug))
            base_url = self._get_base_url(model)

            if self._is_openai_compatible(provider_slug):
                return await self._call_openai_embeddings_async(texts, api_key, base_url, model)
            if provider_slug == "ollama":
                return await self._call_ollama_embeddings_async(texts, base_url, model)

            raise Exception(
                f"Unsupported embedding provider: {provider_slug}. "
                "Please use an OpenAI-compatible or Ollama embedding model."
            )
        except Exception as e:
            print(f"Error creating embeddings: {str(e)}")
            raise Exception(
                f"Failed to create embeddings: {str(e)}. "
                "Please check your API configuration and network connection."
            )

    def create_embeddings_sync(self, texts: List[str], model: ModelCredential) -> List[List[float]]:
        """
        Synchronous version of create_embeddings with real API calls
        """
        try:
            provider_slug = model.provider.slug
            api_key = self._get_api_key(model, required=self._requires_api_key(provider_slug))
            base_url = self._get_base_url(model)

            if self._is_openai_compatible(provider_slug):
                return self._call_openai_embeddings(texts, api_key, base_url, model)
            if provider_slug == "ollama":
                return self._call_ollama_embeddings(texts, base_url, model)

            raise Exception(
                f"Unsupported embedding provider: {provider_slug}. "
                "Please use an OpenAI-compatible or Ollama embedding model."
            )
        except Exception as e:
            print(f"Error creating embeddings: {str(e)}")
            raise Exception(
                f"Failed to create embeddings: {str(e)}. "
                "Please check your API configuration and network connection."
            )

    def rerank(
        self,
        query: str,
        documents: List[str],
        model: ModelCredential,
        top_n: Optional[int] = None,
        normalize: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Call a local/OpenAI-style rerank HTTP service (POST {base}/v1/rerank).

        Returns a list of {"index", "score", "document"} sorted by score desc.
        """
        if not documents:
            return []

        base_url = self._get_base_url(model).rstrip("/")
        model_id = self._normalize_model_id(model.model_id or model.model_name)
        endpoint = f"{base_url}/rerank" if base_url.endswith("/v1") else f"{base_url}/v1/rerank"

        payload: Dict[str, Any] = {
            "model": model_id,
            "query": query,
            "documents": documents,
            "normalize": normalize,
        }
        if top_n is not None:
            payload["top_n"] = top_n

        headers = self._auth_headers(self._get_api_key(model, required=False))

        print(f"Rerank API call - model={model_id}, url={endpoint}, docs={len(documents)}, top_n={top_n}")
        response = requests.post(endpoint, json=payload, headers=headers, timeout=120)
        if response.status_code != 200:
            raise Exception(f"Rerank API error: {response.status_code} - {response.text[:500]}")

        body = response.json()
        data = body.get("data") if isinstance(body, dict) else None
        if not isinstance(data, list):
            raise Exception(f"Rerank API returned unexpected payload: {str(body)[:300]}")

        results: List[Dict[str, Any]] = []
        for item in data:
            if not isinstance(item, dict) or "index" not in item:
                continue
            results.append(
                {
                    "index": int(item["index"]),
                    "score": float(item.get("score", 0.0)),
                    "document": item.get("document", ""),
                }
            )
        results.sort(key=lambda r: r["score"], reverse=True)
        return results

    def _get_api_key(self, model: ModelCredential, required: bool = True) -> str:
        """Get API key for the model"""
        if model.secret:
            return model.secret

        api_key = model.provider.api_keys.filter(is_selected=True).first()
        if api_key:
            return api_key.secret

        if not required:
            return "ollama"

        raise ValueError(f"No API key found for model {model.model_name}")

    def _get_base_url(self, model: ModelCredential) -> str:
        """Get base URL for the model"""
        provider_slug = model.provider.slug
        raw_url = None

        if model.base_url:
            raw_url = model.base_url
        else:
            api_key = model.provider.api_keys.filter(is_selected=True).first()
            if api_key and api_key.api_base:
                raw_url = api_key.api_base

        if not raw_url:
            defaults = {
                "openai": "https://api.openai.com/v1",
                "deepseek": "https://api.deepseek.com",
                "ollama": "http://localhost:11434",
            }
            raw_url = defaults.get(provider_slug)
            if not raw_url:
                raise ValueError(f"No base URL found for model {model.model_name}")

        return self._normalize_base_url(raw_url, provider_slug)

    def _call_openai_embeddings(
        self, texts: List[str], api_key: str, base_url: str, model: ModelCredential
    ) -> List[List[float]]:
        """Call OpenAI-compatible embeddings API in batches (max 64 texts/request)."""
        if not texts:
            return []

        headers = self._auth_headers(api_key)
        model_id = self._normalize_model_id(model.model_id)
        all_embeddings: List[List[float]] = []
        batches = list(self._iter_batches(texts, self.EMBEDDING_BATCH_SIZE))

        for batch_idx, batch in enumerate(batches, start=1):
            print(
                f"Embedding batch {batch_idx}/{len(batches)}: "
                f"{len(batch)} texts (model={model_id})"
            )
            response = requests.post(
                f"{base_url}/embeddings",
                headers=headers,
                json={"input": batch, "model": model_id},
                timeout=120,
            )
            if response.status_code != 200:
                raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")

            result = response.json()
            data = result.get("data") if isinstance(result, dict) else None
            if not isinstance(data, list) or len(data) != len(batch):
                raise Exception(
                    f"Embedding API returned unexpected payload for batch {batch_idx}: "
                    f"expected {len(batch)} vectors"
                )
            # Providers usually return objects with an index; sort to be safe
            ordered = sorted(data, key=lambda item: item.get("index", 0))
            all_embeddings.extend(item["embedding"] for item in ordered)

        return all_embeddings

    def _call_ollama_embeddings(
        self, texts: List[str], base_url: str, model: ModelCredential
    ) -> List[List[float]]:
        """Call Ollama embeddings API"""
        embeddings = []
        model_id = self._normalize_model_id(model.model_id)
        for text in texts:
            data = {
                "model": model_id,
                "prompt": text,
            }

            response = requests.post(
                f"{base_url}/api/embeddings",
                json=data,
                timeout=30,
            )

            if response.status_code == 200:
                result = response.json()
                embeddings.append(result["embedding"])
            else:
                raise Exception(f"Ollama API error: {response.status_code} - {response.text}")

        return embeddings

    def _create_dummy_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Create dummy embeddings for testing - WARNING: These are not meaningful for similarity search"""
        embeddings = []
        for text in texts:
            import hashlib

            text_hash = hashlib.md5(text.encode("utf-8")).hexdigest()
            np.random.seed(int(text_hash[:8], 16))
            dummy_embedding = np.random.rand(1536).tolist()
            embeddings.append(dummy_embedding)

        print(f"WARNING: Created {len(embeddings)} dummy embeddings for {len(texts)} texts")
        print("These embeddings are not suitable for meaningful similarity search!")
        return embeddings

    async def _call_openai_embeddings_async(
        self, texts: List[str], api_key: str, base_url: str, model: ModelCredential
    ) -> List[List[float]]:
        """Call OpenAI-compatible embeddings API asynchronously in batches."""
        import aiohttp

        if not texts:
            return []

        headers = self._auth_headers(api_key)
        model_id = self._normalize_model_id(model.model_id)
        all_embeddings: List[List[float]] = []
        batches = list(self._iter_batches(texts, self.EMBEDDING_BATCH_SIZE))

        async with aiohttp.ClientSession() as session:
            for batch_idx, batch in enumerate(batches, start=1):
                print(
                    f"Embedding batch {batch_idx}/{len(batches)}: "
                    f"{len(batch)} texts (model={model_id})"
                )
                async with session.post(
                    f"{base_url}/embeddings",
                    headers=headers,
                    json={"input": batch, "model": model_id},
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"OpenAI API error {response.status}: {error_text}")

                    result = await response.json()
                    data = result.get("data") if isinstance(result, dict) else None
                    if not isinstance(data, list) or len(data) != len(batch):
                        raise Exception(
                            f"Embedding API returned unexpected payload for batch {batch_idx}: "
                            f"expected {len(batch)} vectors"
                        )
                    ordered = sorted(data, key=lambda item: item.get("index", 0))
                    all_embeddings.extend(item["embedding"] for item in ordered)

        print(f"Successfully created {len(all_embeddings)} OpenAI embeddings")
        return all_embeddings

    async def _call_ollama_embeddings_async(
        self, texts: List[str], base_url: str, model: ModelCredential
    ) -> List[List[float]]:
        """Call Ollama embeddings API asynchronously"""
        import aiohttp

        embeddings = []
        model_id = self._normalize_model_id(model.model_id)

        async with aiohttp.ClientSession() as session:
            for text in texts:
                data = {
                    "model": model_id,
                    "prompt": text,
                }

                async with session.post(
                    f"{base_url}/api/embeddings",
                    json=data,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        embeddings.append(result["embedding"])
                    else:
                        error_text = await response.text()
                        print(f"Ollama API error for text: {error_text}")
                        raise Exception(f"Ollama API error: {response.status} - {error_text}")

        print(f"Successfully created {len(embeddings)} Ollama embeddings")
        return embeddings

    def _extract_chat_message_text(self, message: dict) -> str:
        """
        Extract user-visible text from an OpenAI-compatible chat message.
        Thinking models may put text in reasoning_content while content is empty/null.
        """
        if not isinstance(message, dict):
            return ""

        candidates = [
            message.get("content"),
            message.get("reasoning_content"),
            message.get("reasoning"),
        ]
        for value in candidates:
            if isinstance(value, str) and value.strip():
                return self._clean_response(value)
            # Some providers return content as a list of parts
            if isinstance(value, list):
                parts = []
                for part in value:
                    if isinstance(part, str):
                        parts.append(part)
                    elif isinstance(part, dict) and part.get("text"):
                        parts.append(str(part["text"]))
                joined = "".join(parts).strip()
                if joined:
                    return self._clean_response(joined)
        return ""

    def _call_openai_chat(
        self, prompt: str, api_key: str, base_url: str, model: ModelCredential, max_tokens: int
    ) -> str:
        """Call OpenAI-compatible chat completion API"""
        model_id = self._normalize_model_id(model.model_id)
        headers = self._auth_headers(api_key)

        # Do NOT send stop sequences like <think>: thinking models often begin
        # with those tags, which would immediately stop generation (empty answer).
        data = {
            "model": model_id,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.3,
        }

        print(f"OpenAI-compatible chat - provider={model.provider.slug}, model={model_id}, url={base_url}")

        response = requests.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=data,
            timeout=120,
        )

        if response.status_code == 200:
            result = response.json()
            choice = (result.get("choices") or [{}])[0]
            message = choice.get("message") or {}
            finish_reason = choice.get("finish_reason")
            print(
                f"OpenAI-compatible chat response - finish_reason={finish_reason}, "
                f"message_keys={list(message.keys())}"
            )

            content = self._extract_chat_message_text(message)
            if content:
                return content

            raise Exception(
                f"Model '{model_id}' returned empty content "
                f"(finish_reason={finish_reason}). "
                "If this is a Volcengine Ark endpoint, ensure model_id is the "
                "endpoint id (ep-...), and try increasing max_tokens."
            )

        error_detail = response.text
        print(f"OpenAI API error for model {model_id}: {response.status_code} - {error_detail}")
        raise Exception(f"OpenAI API error: {response.status_code} - {error_detail}")

    def _call_ollama_chat(
        self, prompt: str, base_url: str, model: ModelCredential, max_tokens: int
    ) -> str:
        """Call Ollama native generate API"""
        model_id = self._normalize_model_id(model.model_id)
        data = {
            "model": model_id,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": 0.3,
            },
        }

        print(f"Ollama API call - Model: {model_id}, Base URL: {base_url}")
        print(f"Ollama API call - Prompt length: {len(prompt)}")
        print(f"Ollama API call - Max tokens: {max_tokens}")

        response = requests.post(
            f"{base_url}/api/generate",
            json=data,
            timeout=120,
        )

        print(f"Ollama API response - Status: {response.status_code}")
        print(f"Ollama API response - Text: {response.text[:500]}...")

        if response.status_code == 200:
            result = response.json()
            content = (result.get("response") or "").strip()
            content = self._clean_response(content)
            if content:
                return content
            raise Exception(f"Ollama model '{model_id}' returned empty content")

        raise Exception(f"Ollama API error: {response.status_code} - {response.text}")
