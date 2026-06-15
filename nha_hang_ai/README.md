# nha_hang_ai

AI-Service (FastAPI) cho hệ thống quản lý nhà hàng: Embedding + RAG chatbot dùng Gemini,
lưu vector trong MySQL (dùng chung DB nghiệp vụ `nha_hang_db`).

## Cài đặt

```bash
cd nha_hang_ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # rồi điền GEMINI_API_KEY + DB_PASSWORD
```

## Tạo bảng vector (chạy thủ công)

```bash
mysql -u root -p nha_hang_db < sql/menu_embeddings.sql
```

## Chạy service

```bash
python main.py
# hoặc: uvicorn main:app --reload --port 8000
```

Kiểm tra: http://localhost:8000/health

## API
| Method | Endpoint | Việc |
|---|---|---|
| GET | `/health` | trạng thái service + MySQL + key |
| POST | `/ingest/full` | embedding toàn menu |
| POST | `/ingest/{id}` | embedding 1 món |
| DELETE | `/ingest/{id}` | xoá vector khi xoá món |
| GET | `/similar/{id}?k=5` | món tương tự |
| GET | `/recommend/{customer_id}?k=5` | gợi ý cá nhân hoá (fallback top bán chạy) |
| POST | `/chat` | chatbot RAG `{ "message": "...", "top_k": 5 }` |

## Tiến độ (theo plan.md)
- [x] GĐ 1 — Khung FastAPI + kết nối MySQL + bảng `menu_embeddings` + `/health`
- [x] GĐ 2 — Embedding món (`/ingest`, `/ingest/full`)
- [x] GĐ 3 — `/similar/{id}`, `/recommend/{customer_id}`
- [x] GĐ 4 — `/chat` RAG (anti-hallucination + fallback)
- [ ] GĐ 5 — Tích hợp FE/BE + thay chatbot mới
- [ ] GĐ 6 — Hoàn thiện
