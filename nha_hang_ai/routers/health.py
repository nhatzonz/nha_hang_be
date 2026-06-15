from fastapi import APIRouter

from core import db
from core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Kiểm tra service sống + kết nối MySQL + đã có Gemini key chưa."""
    try:
        db_ok = await db.ping()
    except Exception as e:  # noqa: BLE001
        db_ok = False
        db_error = str(e)
    else:
        db_error = None

    return {
        "status": "ok" if db_ok else "degraded",
        "mysql": db_ok,
        "mysql_error": db_error,
        "gemini_key_configured": bool(settings.gemini_api_key),
    }
