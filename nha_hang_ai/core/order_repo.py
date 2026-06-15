from . import db

# Lịch sử đặt món của khách (bỏ đơn đã huỷ).
_NOT_CANCELLED = "o.status <> 'cancelled'"


async def get_customer_item_ids(customer_id: int) -> list[int]:
    """Danh sách menu_item_id khách từng đặt (distinct)."""
    rows = await db.fetch_all(
        f"""
        SELECT DISTINCT d.menu_item_id
        FROM orders o
        JOIN order_details d ON d.order_id = o.id
        WHERE o.customer_id = %s
          AND d.menu_item_id IS NOT NULL
          AND {_NOT_CANCELLED}
        """,
        (customer_id,),
    )
    return [r["menu_item_id"] for r in rows]


async def top_selling_item_ids(limit: int = 10) -> list[int]:
    """Top món bán chạy (theo tổng số lượng) — fallback cho khách mới."""
    rows = await db.fetch_all(
        f"""
        SELECT d.menu_item_id, SUM(d.quantity) AS qty
        FROM order_details d
        JOIN orders o ON o.id = d.order_id
        JOIN menu_items m ON m.id = d.menu_item_id
        WHERE d.menu_item_id IS NOT NULL
          AND m.is_available = 1
          AND {_NOT_CANCELLED}
        GROUP BY d.menu_item_id
        ORDER BY qty DESC
        LIMIT %s
        """,
        (limit,),
    )
    return [r["menu_item_id"] for r in rows]
