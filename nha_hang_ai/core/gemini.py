import asyncio

import httpx

from .config import settings

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

# Retry khi gặp lỗi tạm thời (rate limit / quá tải) — hay xảy ra ở free tier.
_RETRY_STATUS = {429, 500, 503}
_MAX_RETRIES = 2  # tổng cộng 3 lần thử
_BACKOFF_SEC = 1.5


def _headers() -> dict:
    # Key dạng AIza... dùng header x-goog-api-key.
    return {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.gemini_api_key,
    }


class GeminiError(RuntimeError):
    pass


async def _post(url: str, payload: dict, timeout: int = 60) -> dict:
    """POST tới Gemini, tự retry với backoff khi gặp lỗi tạm thời."""
    last_text = ""
    for attempt in range(_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(url, headers=_headers(), json=payload)
        except httpx.HTTPError as e:
            last_text = str(e)
            resp = None
        if resp is not None:
            if resp.status_code == 200:
                return resp.json()
            last_text = f"{resp.status_code}: {resp.text[:300]}"
            if resp.status_code not in _RETRY_STATUS:
                raise GeminiError(last_text)
        if attempt < _MAX_RETRIES:
            await asyncio.sleep(_BACKOFF_SEC * (attempt + 1))
    raise GeminiError(f"Gemini lỗi tạm thời sau {_MAX_RETRIES + 1} lần thử — {last_text}")


# Task type giúp Gemini tối ưu vector theo mục đích:
#  - RETRIEVAL_DOCUMENT: text được lập chỉ mục (món ăn khi ingest)
#  - RETRIEVAL_QUERY: câu truy vấn của người dùng (câu hỏi chatbot)
TASK_DOCUMENT = "RETRIEVAL_DOCUMENT"
TASK_QUERY = "RETRIEVAL_QUERY"


async def embed_text(text: str, task_type: str = TASK_DOCUMENT) -> list[float]:
    """Tạo embedding 1 đoạn text → vector (mặc định 768 chiều)."""
    vectors = await embed_texts([text], task_type=task_type)
    return vectors[0]


async def embed_texts(
    texts: list[str], task_type: str = TASK_DOCUMENT
) -> list[list[float]]:
    """Tạo embedding cho nhiều text trong 1 lần gọi (batchEmbedContents)."""
    if not settings.gemini_api_key:
        raise GeminiError("Chưa cấu hình GEMINI_API_KEY trong .env")
    if not texts:
        return []

    model = settings.gemini_embed_model
    url = f"{BASE_URL}/models/{model}:batchEmbedContents"
    payload = {
        "requests": [
            {
                "model": f"models/{model}",
                "content": {"parts": [{"text": t}]},
                "taskType": task_type,
                "outputDimensionality": settings.gemini_embed_dim,
            }
            for t in texts
        ]
    }

    data = await _post(url, payload)
    embeddings = data.get("embeddings", [])
    if len(embeddings) != len(texts):
        raise GeminiError(
            f"Số embedding trả về ({len(embeddings)}) khác số text ({len(texts)})"
        )
    return [e["values"] for e in embeddings]


async def generate(prompt: str, system: str | None = None) -> str:
    """Gọi Gemini chat sinh câu trả lời (dùng cho GĐ 4 - RAG)."""
    if not settings.gemini_api_key:
        raise GeminiError("Chưa cấu hình GEMINI_API_KEY trong .env")

    model = settings.gemini_chat_model
    url = f"{BASE_URL}/models/{model}:generateContent"
    payload: dict = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}

    data = await _post(url, payload)
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise GeminiError(f"Phản hồi chat không hợp lệ: {str(data)[:300]}")
