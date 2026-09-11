"""
DingTalk enterprise robot HTTP callback glue.

DingTalk → this service → POST /api/agents/dingtalk-chat/ → sessionWebhook reply.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import re
import threading
import time
from typing import Any, Dict, Optional

import requests
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("dingtalk-bridge")

app = FastAPI(title="DingTalk RAG Bridge", version="1.0.0")

DINGTALK_APP_SECRET = os.getenv("DINGTALK_APP_SECRET", "").strip()
RAG_API_BASE = os.getenv("RAG_API_BASE", "http://backend:8000").rstrip("/")
DINGTALK_BRIDGE_TOKEN = os.getenv("DINGTALK_BRIDGE_TOKEN", "").strip()
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://llm.paoditu.com").rstrip("/")
RAG_TIMEOUT = int(os.getenv("RAG_TIMEOUT", "180"))
SIGN_WINDOW_MS = int(os.getenv("DINGTALK_SIGN_WINDOW_MS", "3600000"))


def _verify_sign(timestamp: Optional[str], sign: Optional[str]) -> None:
    if not DINGTALK_APP_SECRET:
        logger.warning("DINGTALK_APP_SECRET is empty; skipping signature check (dev only)")
        return
    if not timestamp or not sign:
        raise HTTPException(status_code=401, detail="Missing timestamp or sign")
    try:
        ts = int(timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid timestamp") from exc
    now_ms = int(time.time() * 1000)
    if abs(now_ms - ts) > SIGN_WINDOW_MS:
        raise HTTPException(status_code=401, detail="Timestamp expired")

    string_to_sign = f"{timestamp}\n{DINGTALK_APP_SECRET}"
    digest = hmac.new(
        DINGTALK_APP_SECRET.encode("utf-8"),
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    try:
        ok = hmac.compare_digest(expected, sign)
    except Exception:
        ok = False
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid sign")


def _extract_question(event: Dict[str, Any]) -> str:
    text = event.get("text") or {}
    content = ""
    if isinstance(text, dict):
        content = text.get("content") or ""
    elif isinstance(text, str):
        content = text
    content = str(content).strip()
    # Strip leading @mentions in group chats
    content = re.sub(r"^(@\S+\s*)+", "", content).strip()
    return content


def _call_rag(question: str, session_id: str) -> str:
    url = f"{RAG_API_BASE}/api/agents/dingtalk-chat/"
    headers = {"Content-Type": "application/json"}
    if DINGTALK_BRIDGE_TOKEN:
        headers["X-DingTalk-Bridge-Token"] = DINGTALK_BRIDGE_TOKEN
    payload = {
        "message": question,
        "session_id": session_id,
        "public_base_url": PUBLIC_BASE_URL,
    }
    logger.info("Calling RAG %s session=%s q=%s", url, session_id, question[:80])
    resp = requests.post(url, json=payload, headers=headers, timeout=RAG_TIMEOUT)
    try:
        data = resp.json()
    except Exception:
        data = {"error": resp.text[:500]}
    if resp.status_code >= 400:
        err = data.get("error") if isinstance(data, dict) else str(data)
        return f"知识库接口错误（{resp.status_code}）：{err}"
    answer = (data.get("response") or "").strip()
    return answer or "知识库没有返回内容。"


def _send_session_webhook(webhook: str, text: str, at_user_id: str = "") -> None:
    if not webhook:
        logger.warning("No sessionWebhook; cannot reply")
        return
    # DingTalk markdown content is capped around 20k characters
    body_text = text if len(text) <= 18000 else text[:17990] + "\n…"
    if at_user_id:
        body_text = f"@{at_user_id}\n\n{body_text}"
    payload: Dict[str, Any] = {
        "msgtype": "markdown",
        "markdown": {
            "title": "知识库回答",
            "text": body_text,
        },
    }
    if at_user_id:
        payload["at"] = {"atUserIds": [at_user_id]}
    try:
        resp = requests.post(webhook, json=payload, timeout=20)
        if resp.status_code >= 400:
            logger.error("sessionWebhook failed %s %s", resp.status_code, resp.text[:300])
        else:
            logger.info("Replied via sessionWebhook (%s chars)", len(body_text))
    except Exception as exc:
        logger.exception("sessionWebhook error: %s", exc)


def _handle_event(event: Dict[str, Any]) -> None:
    conversation_type = str(event.get("conversationType") or "")
    if conversation_type == "2" and event.get("isInAtList") is False:
        logger.info("Group message without @bot, skip")
        return
    question = _extract_question(event)
    if not question:
        logger.info("Empty question, skip")
        return
    session_id = str(
        event.get("conversationId")
        or event.get("openConversationId")
        or event.get("chatbotUserId")
        or ""
    )
    webhook = event.get("sessionWebhook") or ""
    at_user = str(event.get("senderStaffId") or "") if conversation_type == "2" else ""
    try:
        answer = _call_rag(question, session_id)
    except Exception as exc:
        logger.exception("RAG call failed")
        answer = f"查询知识库失败：{exc}"
    _send_session_webhook(webhook, answer, at_user_id=at_user)


@app.get("/health")
def health():
    return {"status": "ok", "service": "dingtalk-bridge"}


@app.get("/dingtalk/callback")
def dingtalk_callback_probe():
    return JSONResponse({"success": True})


@app.post("/dingtalk/callback")
async def dingtalk_callback(
    request: Request,
    timestamp: Optional[str] = Header(default=None),
    sign: Optional[str] = Header(default=None),
):
    """
    DingTalk robot HTTP callback.

    Returns 200 immediately (DingTalk times out ~3–5s). The RAG call + reply
    run in a background thread via sessionWebhook.
    """
    ts = timestamp or request.headers.get("timestamp")
    sg = sign or request.headers.get("sign")
    _verify_sign(ts, sg)
    try:
        event = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    if not isinstance(event, dict):
        return JSONResponse({"success": True})

    # Ignore non-text / empty events
    msgtype = (event.get("msgtype") or event.get("msgType") or "").lower()
    if msgtype and msgtype not in {"text", ""}:
        logger.info("Ignore msgtype=%s", msgtype)
        return JSONResponse({"success": True})

    threading.Thread(target=_handle_event, args=(event,), daemon=True).start()
    return JSONResponse({"success": True})
