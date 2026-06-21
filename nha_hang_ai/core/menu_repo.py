import json

from . import db

# Truy vấn món + danh mục từ MySQL nghiệp vụ.
_MENU_SELECT = """
    SELECT m.id, m.name, m.description, m.price, m.image,
           m.is_available, c.name AS category_name
    FROM menu_items m
    LEFT JOIN categories c ON c.id = m.category_id
"""


async def get_menu_item(menu_id: int) -> dict | None:
    return await db.fetch_one(_MENU_SELECT + " WHERE m.id = %s", (menu_id,))


async def list_menu_items(only_available: bool = True) -> list[dict]:
    sql = _MENU_SELECT
    if only_available:
        sql += " WHERE m.is_available = 1"
    sql += " ORDER BY m.id"
    return await db.fetch_all(sql)


async def list_unembedded_items(only_available: bool = True) -> list[dict]:
    """Các món có trong menu nhưng CHƯA có embedding (để đồng bộ tăng dần)."""
    sql = _MENU_SELECT + " LEFT JOIN menu_embeddings e ON e.menu_item_id = m.id"
    sql += " WHERE e.menu_item_id IS NULL"
    if only_available:
        sql += " AND m.is_available = 1"
    sql += " ORDER BY m.id"
    return await db.fetch_all(sql)


def build_source_text(item: dict) -> str:
    """Ghép text mô tả món để embedding (tên + danh mục + giá + mô tả)."""
    parts = [f"Tên món: {item['name']}"]
    if item.get("category_name"):
        parts.append(f"Danh mục: {item['category_name']}")
    if item.get("price") is not None:
        parts.append(f"Giá: {int(item['price'])}đ")
    if item.get("description"):
        parts.append(f"Mô tả: {item['description']}")
    return ". ".join(parts)


async def upsert_embedding(
    menu_item_id: int, embedding: list[float], source_text: str, model: str
) -> None:
    await db.execute(
        """
        INSERT INTO menu_embeddings (menu_item_id, embedding, source_text, model)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            embedding = VALUES(embedding),
            source_text = VALUES(source_text),
            model = VALUES(model)
        """,
        (menu_item_id, json.dumps(embedding), source_text, model),
    )


async def delete_embedding(menu_item_id: int) -> int:
    return await db.execute(
        "DELETE FROM menu_embeddings WHERE menu_item_id = %s", (menu_item_id,)
    )


async def count_embeddings() -> int:
    row = await db.fetch_one("SELECT COUNT(*) AS n FROM menu_embeddings")
    return int(row["n"]) if row else 0


async def load_all_embeddings() -> list[dict]:
    """Đọc toàn bộ vector (cho GĐ 3: similar/recommend). Parse JSON sẵn."""
    rows = await db.fetch_all(
        """
        SELECT e.menu_item_id, e.embedding,
               m.name, m.description, m.price, m.image, m.category_id,
               c.name AS category_name
        FROM menu_embeddings e
        JOIN menu_items m ON m.id = e.menu_item_id
        LEFT JOIN categories c ON c.id = m.category_id
        WHERE m.is_available = 1
        """
    )
    for r in rows:
        r["embedding"] = json.loads(r["embedding"])
    return rows
