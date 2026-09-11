# DingTalk RAG glue service

Independent HTTP callback for **企业内部机器人**. It does **not** contain RAG logic.

```
DingTalk → POST /dingtalk/callback → this service
  → POST rag-backend /api/agents/dingtalk-chat/
  → reply via sessionWebhook
```

## Callback URL (no ngrok)

Use the public site already on the server:

| Env | DingTalk 消息接收 URL |
|-----|------------------------|
| Production (via frontend nginx) | `http://llm.paoditu.com/dingtalk/callback` |
| Direct glue port | `http://llm.paoditu.com:8010/dingtalk/callback` |
| Local Docker | `http://localhost/dingtalk/callback` |

DingTalk may require **HTTPS** for some app types. If HTTP is rejected, put TLS in front of nginx.

## Configure

1. 钉钉开放平台 → 企业内部应用 → 添加**机器人**能力 → 开启消息接收  
2. 填回调地址如上  
3. Copy **AppSecret** into root `.env`:

```
DINGTALK_APP_SECRET=your_app_secret
DINGTALK_DEFAULT_LLM=doubao-seed-2-1-pro-260628
PUBLIC_BASE_URL=http://llm.paoditu.com
DINGTALK_BRIDGE_TOKEN=optional-shared-secret
```

4. `docker compose up -d --build dingtalk-bridge frontend backend`

## Defaults on `/api/agents/dingtalk-chat/`

Shared pipeline with web chat (`run_chat`):

- Knowledge base: **整个知识库**
- LLM: `DINGTALK_DEFAULT_LLM` or first enabled LLM
- Chunk count: **3**
- 返回原文档: **on**
- 打开原文档: **on** (absolute links using `PUBLIC_BASE_URL`)
- Rerank: on if a Rerank credential exists
