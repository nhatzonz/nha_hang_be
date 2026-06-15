from fastapi import APIRouter, HTTPException

from core import menu_repo, order_repo, similarity

router = APIRouter(tags=["recommend"])


def _present(row: dict) -> dict:
    """Chuẩn hoá 1 món để trả về FE."""
    return {
        "menu_item_id": row["menu_item_id"],
        "name": row.get("name"),
        "price": int(row["price"]) if row.get("price") is not None else None,
        "image": row.get("image"),
        "category_name": row.get("category_name"),
        "score": row.get("score"),
    }


@router.get("/similar/{menu_id}")
async def similar(menu_id: int, k: int = 5):
    """Món tương tự món `menu_id` (cosine trên embedding)."""
    rows = await menu_repo.load_all_embeddings()
    target = next((r for r in rows if r["menu_item_id"] == menu_id), None)
    if target is None:
        raise HTTPException(
            404, f"Món id={menu_id} chưa có embedding (chạy /ingest/{menu_id} trước)"
        )

    results = similarity.top_k(
        target["embedding"], rows, k=k, exclude_ids={menu_id}
    )
    return {"menu_item_id": menu_id, "results": [_present(r) for r in results]}


@router.get("/recommend/{customer_id}")
async def recommend(customer_id: int, k: int = 5):
    """Gợi ý cá nhân hoá: trung bình vector lịch sử, loại món đã ăn.

    Khách mới (chưa có lịch sử) → fallback top bán chạy.
    """
    rows = await menu_repo.load_all_embeddings()
    if not rows:
        raise HTTPException(404, "Chưa có embedding nào. Chạy /ingest/full trước.")

    ordered_ids = await order_repo.get_customer_item_ids(customer_id)

    # Khách mới → top bán chạy.
    if not ordered_ids:
        top_ids = await order_repo.top_selling_item_ids(limit=k)
        by_id = {r["menu_item_id"]: r for r in rows}
        results = [_present(by_id[i]) for i in top_ids if i in by_id]
        return {"customer_id": customer_id, "strategy": "popular", "results": results}

    # Có lịch sử → trung bình vector các món đã đặt.
    history_vectors = [
        r["embedding"] for r in rows if r["menu_item_id"] in set(ordered_ids)
    ]
    avg = similarity.average_vector(history_vectors)
    if avg is None:
        # Đã đặt món nhưng các món đó chưa có embedding → fallback popular.
        top_ids = await order_repo.top_selling_item_ids(limit=k)
        by_id = {r["menu_item_id"]: r for r in rows}
        results = [_present(by_id[i]) for i in top_ids if i in by_id]
        return {"customer_id": customer_id, "strategy": "popular", "results": results}

    results = similarity.top_k(avg, rows, k=k, exclude_ids=set(ordered_ids))
    return {
        "customer_id": customer_id,
        "strategy": "personalized",
        "results": [_present(r) for r in results],
    }
