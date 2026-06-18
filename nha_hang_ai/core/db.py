import aiomysql

from .config import settings

# Pool kết nối MySQL dùng chung toàn app. Khởi tạo ở startup (main.py).
_pool: aiomysql.Pool | None = None


async def init_pool() -> None:
    global _pool
    if _pool is not None:
        return
    _pool = await aiomysql.create_pool(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_username,
        password=settings.db_password,
        db=settings.db_name,
        autocommit=True,
        charset="utf8mb4",
        minsize=1,
        maxsize=5,
    )


async def ensure_schema() -> None:
    """Tạo bảng menu_embeddings nếu chưa có (chạy lúc startup).

    Không đặt FOREIGN KEY tới menu_items để khỏi phụ thuộc thứ tự khởi động
    giữa các container — NestJS đã chủ động gọi DELETE /ingest/{id} khi xoá món.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS menu_embeddings (
                  menu_item_id  INT          NOT NULL,
                  embedding     JSON         NOT NULL,
                  source_text   TEXT         NULL,
                  model         VARCHAR(64)  NULL,
                  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (menu_item_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()
        _pool = None


def get_pool() -> aiomysql.Pool:
    if _pool is None:
        raise RuntimeError("MySQL pool chưa được khởi tạo. Gọi init_pool() trước.")
    return _pool


async def fetch_all(sql: str, args: tuple | None = None) -> list[dict]:
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(sql, args or ())
            return await cur.fetchall()


async def fetch_one(sql: str, args: tuple | None = None) -> dict | None:
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(sql, args or ())
            return await cur.fetchone()


async def execute(sql: str, args: tuple | None = None) -> int:
    """Chạy INSERT/UPDATE/DELETE. Trả về số dòng bị ảnh hưởng."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, args or ())
            return cur.rowcount


async def ping() -> bool:
    """Kiểm tra kết nối DB cho /health."""
    row = await fetch_one("SELECT 1 AS ok")
    return bool(row and row.get("ok") == 1)
