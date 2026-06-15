from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core import db
from core.config import settings
from routers import chat, health, ingest, recommend


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo pool MySQL khi service start, đóng khi shutdown.
    await db.init_pool()
    yield
    await db.close_pool()


app = FastAPI(title="nha_hang_ai", version="0.1.0", lifespan=lifespan)

# Cho phép FE/BE gọi sang (sẽ siết origin khi production).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(recommend.router)
app.include_router(chat.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.ai_host, port=settings.ai_port, reload=True)
