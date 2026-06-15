import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiChatResult {
  reply: string;
  items: any[];
  used_fallback: boolean;
}

/**
 * Cầu nối từ NestJS sang AI-Service (FastAPI).
 * Mọi lỗi mạng/timeout được nuốt và trả null để caller tự fallback,
 * tránh làm sập luồng nghiệp vụ chính.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config
      .get<string>('AI_SERVICE_URL', 'http://localhost:8000')
      .replace(/\/$/, '');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 15000,
  ): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`AI ${method} ${path} → HTTP ${res.status}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      this.logger.warn(`AI ${method} ${path} lỗi: ${(err as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Chatbot RAG tư vấn món. */
  chat(message: string, topK = 5): Promise<AiChatResult | null> {
    return this.request<AiChatResult>('POST', '/chat', {
      message,
      top_k: topK,
    });
  }

  /** Món tương tự. */
  similar(menuId: number, k = 5): Promise<any | null> {
    return this.request('GET', `/similar/${menuId}?k=${k}`);
  }

  /** Gợi ý cá nhân hoá theo khách. */
  recommend(customerId: number, k = 5): Promise<any | null> {
    return this.request('GET', `/recommend/${customerId}?k=${k}`);
  }

  /** Đồng bộ embedding 1 món (gọi khi thêm/sửa món). Fire-and-forget. */
  ingestItem(menuId: number): void {
    void this.request('POST', `/ingest/${menuId}`).catch(() => null);
  }

  /** Xoá embedding khi xoá món. Fire-and-forget. */
  removeIngest(menuId: number): void {
    void this.request('DELETE', `/ingest/${menuId}`).catch(() => null);
  }
}
