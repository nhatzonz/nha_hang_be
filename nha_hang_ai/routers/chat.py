from fastapi import APIRouter
from pydantic import BaseModel, Field

from core import rag

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Câu hỏi của khách")
    top_k: int = Field(5, ge=1, le=10, description="Số món truy hồi tối đa")


class ChatResponse(BaseModel):
    reply: str
    items: list
    used_fallback: bool


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Chatbot RAG: tư vấn món bám dữ liệu thật, chống bịa."""
    return await rag.answer(req.message.strip(), top_k=req.top_k)
