from . import gemini, menu_repo, similarity

SYSTEM_PROMPT = (
    "Bạn là trợ lý tư vấn món ăn của một nhà hàng, tên 'Trợ lý nhà hàng'. "
    "Nhiệm vụ: tư vấn, gợi ý món dựa CHỈ trên danh sách món được cung cấp bên dưới. "
    "QUY TẮC BẮT BUỘC:\n"
    "1. CHỈ nói về các món có trong 'DANH SÁCH MÓN'. Tuyệt đối KHÔNG bịa tên món, "
    "giá, hay mô tả không có trong danh sách.\n"
    "2. Khi gợi ý, nêu tên món kèm giá (đơn vị đồng).\n"
    "3. Nếu câu hỏi không liên quan đến món ăn/nhà hàng, lịch sự nói bạn chỉ hỗ trợ "
    "tư vấn món của nhà hàng.\n"
    "4. Nếu không có món nào phù hợp trong danh sách, nói thẳng là hiện chưa có món phù hợp.\n"
    "5. Trả lời ngắn gọn, thân thiện, bằng tiếng Việt."
)


def _format_context(items: list[dict]) -> str:
    if not items:
        return "(không có món nào phù hợp)"
    lines = []
    for it in items:
        price = f"{int(it['price'])}đ" if it.get("price") is not None else "?"
        cat = it.get("category_name") or "khác"
        lines.append(
            f"- [id {it['menu_item_id']}] {it.get('name')} | danh mục: {cat} | giá: {price}"
        )
    return "\n".join(lines)


def _present(item: dict) -> dict:
    return {
        "menu_item_id": item["menu_item_id"],
        "name": item.get("name"),
        "price": int(item["price"]) if item.get("price") is not None else None,
        "image": item.get("image"),
        "category_name": item.get("category_name"),
        "score": item.get("score"),
    }


async def answer(message: str, top_k: int = 5) -> dict:
    """Luồng RAG: embed câu hỏi → top-k món → ghép prompt → Gemini trả lời.

    Trả về {reply, items, used_fallback}. Không bao giờ raise ra ngoài —
    lỗi Gemini sẽ rơi vào fallback để chatbot vẫn phản hồi được.
    """
    rows = await menu_repo.load_all_embeddings()
    if not rows:
        return {
            "reply": "Hiện chưa có dữ liệu món ăn. Vui lòng thử lại sau.",
            "items": [],
            "used_fallback": True,
        }

    # 1. Embed câu hỏi để truy hồi (dùng task type QUERY).
    try:
        q_vec = await gemini.embed_text(message, task_type=gemini.TASK_QUERY)
    except gemini.GeminiError:
        return _fallback(rows, top_k)

    # 2. Truy hồi top-k món liên quan.
    retrieved = similarity.top_k(q_vec, rows, k=top_k)

    # 3. Ghép prompt + gọi Gemini sinh câu trả lời.
    context = _format_context(retrieved)
    prompt = (
        f"DANH SÁCH MÓN (kết quả truy hồi liên quan câu hỏi):\n{context}\n\n"
        f"Câu hỏi của khách: {message}\n\n"
        "Hãy tư vấn dựa trên danh sách trên."
    )
    try:
        reply = await gemini.generate(prompt, system=SYSTEM_PROMPT)
    except gemini.GeminiError:
        return _fallback(rows, top_k, retrieved=retrieved)

    return {
        "reply": reply.strip(),
        "items": [_present(it) for it in retrieved],
        "used_fallback": False,
    }


def _fallback(
    rows: list[dict], top_k: int, retrieved: list[dict] | None = None
) -> dict:
    """Khi Gemini lỗi: trả lời cơ bản (liệt kê món truy hồi được), không bịa."""
    items = retrieved if retrieved is not None else []
    if items:
        names = ", ".join(i.get("name", "") for i in items[:top_k])
        reply = (
            "Hiện trợ lý AI đang bận, nhưng bạn có thể tham khảo một vài món: "
            f"{names}."
        )
    else:
        reply = "Xin lỗi, trợ lý đang tạm gián đoạn. Vui lòng thử lại sau ít phút."
    return {
        "reply": reply,
        "items": [_present(it) for it in items],
        "used_fallback": True,
    }
