# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Cài dependencies (tận dụng cache layer)
COPY package*.json ./
RUN npm ci

# Build NestJS -> dist/
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Chỉ cài dependencies production
COPY package*.json ./
RUN npm ci --omit=dev

# Copy bản build từ stage trước
COPY --from=build /app/dist ./dist

# Thư mục ảnh upload (sẽ được mount volume trong docker-compose)
RUN mkdir -p uploads

EXPOSE 3001
CMD ["node", "dist/main"]
