from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Cấu hình đọc từ .env (cùng thư mục nha_hang_ai)."""

    # MySQL
    db_host: str = "localhost"
    db_port: int = 3306
    db_username: str = "root"
    db_password: str = ""
    db_name: str = "nha_hang_db"

    # Gemini
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.5-flash"
    gemini_embed_model: str = "gemini-embedding-001"
    gemini_embed_dim: int = 768

    # App
    ai_host: str = "127.0.0.1"  # chỉ nghe localhost; NestJS gọi nội bộ
    ai_port: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
