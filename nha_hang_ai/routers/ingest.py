from fastapi import APIRouter, HTTPException

from core import gemini, menu_repo
from core.config import settings

router = APIRouter(tags=["ingest"])


@router.post("/ingest/full")
async def ingest_full():
    """Embedding toàn bộ menu đang bán. Gọi Gemini theo lô để tiết kiệm request."""
    items = await menu_repo.list_menu_items(only_available=True)
    if not items:
        return {"total": 0, "ingested": 0, "items": []}

    texts = [menu_repo.build_source_text(it) for it in items]
    BATCH = 50
    ingested = 0
    for i in range(0, len(items), BATCH):
        chunk = items[i : i + BATCH]
        chunk_texts = texts[i : i + BATCH]
        try:
            vectors = await gemini.embed_texts(chunk_texts)
        except gemini.GeminiError as e:
            raise HTTPException(502, f"Lỗi ở lô {i}: {e}")
        for it, txt, vec in zip(chunk, chunk_texts, vectors):
            await menu_repo.upsert_embedding(
                it["id"], vec, txt, settings.gemini_embed_model
            )
            ingested += 1

    return {"total": len(items), "ingested": ingested}


@router.post("/ingest/missing")
async def ingest_missing():
    """Chỉ embedding các món có trong menu nhưng CHƯA có vector (đồng bộ tăng dần)."""
    items = await menu_repo.list_unembedded_items(only_available=True)
    if not items:
        return {"total_missing": 0, "ingested": 0, "items": []}

    texts = [menu_repo.build_source_text(it) for it in items]
    BATCH = 50
    ingested = 0
    done_ids = []
    for i in range(0, len(items), BATCH):
        chunk = items[i : i + BATCH]
        chunk_texts = texts[i : i + BATCH]
        try:
            vectors = await gemini.embed_texts(chunk_texts)
        except gemini.GeminiError as e:
            raise HTTPException(502, f"Lỗi ở lô {i}: {e}")
        for it, txt, vec in zip(chunk, chunk_texts, vectors):
            await menu_repo.upsert_embedding(
                it["id"], vec, txt, settings.gemini_embed_model
            )
            ingested += 1
            done_ids.append(it["id"])

    return {"total_missing": len(items), "ingested": ingested, "items": done_ids}


@router.post("/ingest/{menu_id}")
async def ingest_one(menu_id: int):
    """Tạo/cập nhật embedding cho 1 món."""
    item = await menu_repo.get_menu_item(menu_id)
    if not item:
        raise HTTPException(404, f"Không tìm thấy món id={menu_id}")

    source_text = menu_repo.build_source_text(item)
    try:
        vector = await gemini.embed_text(source_text)
    except gemini.GeminiError as e:
        raise HTTPException(502, str(e))

    await menu_repo.upsert_embedding(
        menu_id, vector, source_text, settings.gemini_embed_model
    )
    return {"menu_item_id": menu_id, "dim": len(vector), "source_text": source_text}


@router.delete("/ingest/{menu_id}")
async def remove_one(menu_id: int):
    """Xóa embedding khi món bị xóa (NestJS gọi sang)."""
    deleted = await menu_repo.delete_embedding(menu_id)
    return {"menu_item_id": menu_id, "deleted": deleted}
