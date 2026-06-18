FROM python:3.12-slim
WORKDIR /app

# Cài dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

EXPOSE 8000
# Bind 0.0.0.0 để các container khác (NestJS) gọi được; không dùng --reload ở prod
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
