import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatLog } from '../chat/chat-log.entity';
import { MenuService } from '../menu/menu.service';
import { TablesService } from '../tables/tables.service';
import { CustomersService } from '../customers/customers.service';
import { OrdersService } from '../orders/orders.service';
import { StatisticsService } from '../statistics/statistics.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { Order } from '../orders/order.entity';
import {
  INTENTS,
  SUGGESTIONS,
  DEFAULT_FALLBACK_REPLY,
  IntentDef,
} from './intents';
import { normalizeSearchTerm } from '../../common/utils/search.util';

export interface ChatResponse {
  reply: string;
  intent: string;
  data?: any;
  suggestions?: string[];
}

const ORDER_CODE_REGEX = /ORD-\d{8}-\d{3}/i;

@Injectable()
export class ChatbotService {
  constructor(
    @InjectRepository(ChatLog) private readonly logRepo: Repository<ChatLog>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly menuService: MenuService,
    private readonly tablesService: TablesService,
    private readonly customersService: CustomersService,
    private readonly ordersService: OrdersService,
    private readonly statsService: StatisticsService,
    private readonly restaurantService: RestaurantService,
  ) {}

  /**
   * Match intent dựa trên input đã được chuẩn hoá.
   * Trả về intent name + optional match (VD order_code).
   */
  private matchIntent(raw: string, normalized: string): {
    name: string;
    match?: string;
  } {
    // 1. Pattern match trước (regex)
    for (const intent of INTENTS) {
      if (intent.pattern) {
        const m = raw.match(intent.pattern);
        if (m) {
          return { name: intent.name, match: m[0] };
        }
      }
    }

    // 2. Keyword match (count)
    let bestIntent: IntentDef | null = null;
    let bestScore = 0;

    for (const intent of INTENTS) {
      if (!intent.keywords) continue;
      let score = 0;
      for (const kw of intent.keywords) {
        if (normalized.includes(kw)) {
          score += kw.length;
        }
      }
      if (score > 0) {
        const total = score * 1000 + intent.priority;
        const bestTotal = bestScore ? bestScore * 1000 + (bestIntent?.priority || 0) : 0;
        if (total > bestTotal) {
          bestScore = score;
          bestIntent = intent;
        }
      }
    }

    if (bestIntent) return { name: bestIntent.name };

    // 3. Fallback: nếu có > 2 chữ cái, thử search menu
    if (normalized.length >= 3) {
      return { name: 'search_menu' };
    }

    return { name: 'fallback' };
  }

  // ================ Handlers ================

  private async handleGreeting(): Promise<ChatResponse> {
    return {
      intent: 'greeting',
      reply: 'Xin chào! Tôi là trợ lý nhà hàng. Bạn cần tôi hỗ trợ gì?',
      suggestions: SUGGESTIONS.greeting,
    };
  }

  private async handleHelp(): Promise<ChatResponse> {
    return {
      intent: 'help',
      reply:
        'Tôi có thể giúp bạn:\n' +
        '• Xem menu, tìm món theo tên\n' +
        '• Kiểm tra bàn trống\n' +
        '• Tra cứu đơn hàng (nhập mã ORD-YYYYMMDD-NNN)\n' +
        '• Xem doanh thu hôm nay / món bán chạy\n' +
        '• Hỏi thông tin nhà hàng (giờ mở cửa, địa chỉ)',
      suggestions: SUGGESTIONS.help,
    };
  }

  private async handleRestaurantInfo(): Promise<ChatResponse> {
    const info = await this.restaurantService.getInfo();
    if (!info) {
      return { intent: 'restaurant_info', reply: 'Chưa có thông tin nhà hàng.' };
    }
    const openTime = info.open_time?.slice(0, 5) || '--';
    const closeTime = info.close_time?.slice(0, 5) || '--';
    return {
      intent: 'restaurant_info',
      reply:
        `🏪 ${info.name}\n` +
        `📍 ${info.address || 'Chưa cập nhật'}\n` +
        `📞 ${info.phone || '--'}\n` +
        `🕐 Giờ mở cửa: ${openTime} - ${closeTime}` +
        (info.description ? `\n\n${info.description}` : ''),
      data: { restaurant: info },
      suggestions: SUGGESTIONS.restaurant_info,
    };
  }

  private async handleViewMenu(): Promise<ChatResponse> {
    const { data, total } = await this.menuService.findAll({
      is_available: 1,
      limit: 20,
      page: 1,
    });
    if (total === 0) {
      return { intent: 'view_menu', reply: 'Hiện chưa có món nào trong thực đơn.' };
    }
    return {
      intent: 'view_menu',
      reply: `Thực đơn hiện có ${total} món đang bán. Đây là ${data.length} món tiêu biểu:`,
      data: { items: data.slice(0, 10) },
      suggestions: SUGGESTIONS.view_menu,
    };
  }

  private async handleTopItems(): Promise<ChatResponse> {
    const items = await this.statsService.getTopItems('month', undefined, undefined, 5);
    if (items.length === 0) {
      return {
        intent: 'top_items',
        reply: 'Chưa có đơn hàng nào trong 30 ngày gần đây để đánh giá món bán chạy.',
      };
    }
    const lines = items
      .map((m, i) => `${i + 1}. ${m.name} — ${m.quantity} lượt (${m.revenue.toLocaleString('vi-VN')}đ)`)
      .join('\n');
    return {
      intent: 'top_items',
      reply: `🔥 Top ${items.length} món bán chạy 30 ngày qua:\n\n${lines}`,
      data: { items },
      suggestions: SUGGESTIONS.top_items,
    };
  }

  private async handleCheckTable(): Promise<ChatResponse> {
    const allTables = await this.tablesService.findAll();
    const available = allTables.filter((t) => t.status === 'available');

    if (allTables.length === 0) {
      return { intent: 'check_table', reply: 'Chưa có bàn nào trong hệ thống.' };
    }

    if (available.length === 0) {
      return {
        intent: 'check_table',
        reply: `❌ Hiện không còn bàn trống (${allTables.length} bàn đều đang được sử dụng hoặc đã đặt).`,
        data: { available: [], total: allTables.length },
      };
    }

    const names = available.map((t) => `• ${t.name}${t.location ? ` (${t.location})` : ''} — ${t.capacity} người`).join('\n');
    return {
      intent: 'check_table',
      reply: `✅ Đang có ${available.length}/${allTables.length} bàn trống:\n\n${names}`,
      data: { available, total: allTables.length },
      suggestions: SUGGESTIONS.check_table,
    };
  }

  private async handleRevenueToday(): Promise<ChatResponse> {
    const overview = await this.statsService.getOverview('today');
    const revenue = overview.revenue.value;
    const orders = overview.orders.value;
    const change = overview.revenue.change;

    let changeText = '';
    if (change !== 0 && Math.abs(change) !== 100) {
      const sign = change > 0 ? '📈 tăng' : '📉 giảm';
      changeText = ` (${sign} ${Math.abs(change).toFixed(1)}% so với hôm qua)`;
    }

    return {
      intent: 'revenue_today',
      reply:
        `💰 Doanh thu hôm nay: ${revenue.toLocaleString('vi-VN')}đ${changeText}\n` +
        `📦 Số đơn hoàn thành: ${orders}\n` +
        `💳 Giá trị đơn TB: ${Math.round(overview.avgOrderValue.value).toLocaleString('vi-VN')}đ`,
      data: { overview },
      suggestions: SUGGESTIONS.revenue_today,
    };
  }

  private async handleOrderStats(): Promise<ChatResponse> {
    const stats = await this.statsService.getOrdersByStatus();
    const processing = (stats.pending || 0) + (stats.preparing || 0) + (stats.served || 0);

    return {
      intent: 'order_stats',
      reply:
        `📊 Thống kê đơn hàng:\n\n` +
        `• Đang xử lý: ${processing}\n` +
        `   - Chờ: ${stats.pending}\n` +
        `   - Chế biến: ${stats.preparing}\n` +
        `   - Đã phục vụ: ${stats.served}\n` +
        `• Hoàn thành: ${stats.completed}\n` +
        `• Đã huỷ: ${stats.cancelled}`,
      data: { stats, processing },
      suggestions: SUGGESTIONS.order_stats,
    };
  }

  private async handleCheckOrderByCode(orderCode: string): Promise<ChatResponse> {
    const order = await this.orderRepo.findOne({
      where: { order_code: orderCode },
      relations: ['table', 'customer', 'order_details', 'order_details.menu_item'],
    });

    if (!order) {
      return {
        intent: 'check_order_by_code',
        reply: `❌ Không tìm thấy đơn ${orderCode}.`,
      };
    }

    const statusLabel: Record<string, string> = {
      pending: '⏳ Chờ xử lý',
      preparing: '👨‍🍳 Đang chế biến',
      served: '🍽 Đã phục vụ',
      completed: '✅ Hoàn thành',
      cancelled: '❌ Đã huỷ',
    };

    const itemsText = order.order_details
      .map((d) => `  • ${d.menu_item?.name || 'Món đã xoá'} × ${d.quantity}`)
      .join('\n');

    return {
      intent: 'check_order_by_code',
      reply:
        `📋 Đơn ${order.order_code}\n` +
        `${statusLabel[order.status] || order.status}\n` +
        `🪑 Bàn: ${order.table?.name || '--'}\n` +
        `👤 Khách: ${order.customer?.full_name || 'Khách lẻ'}\n\n` +
        `🍽 Chi tiết (${order.order_details.length} món):\n${itemsText}\n\n` +
        `💵 Thành tiền: ${Number(order.final_amount).toLocaleString('vi-VN')}đ`,
      data: { order },
      suggestions: SUGGESTIONS.check_order_by_code,
    };
  }

  private async handleSearchCustomer(query: string): Promise<ChatResponse> {
    // Nếu query chứa số thì search SĐT, ngược lại search tên
    const { data, total } = await this.customersService.findAll({
      search: query,
      limit: 5,
      page: 1,
    });

    if (total === 0) {
      return {
        intent: 'search_customer',
        reply: `Không tìm thấy khách hàng khớp với "${query}".`,
      };
    }

    const lines = data
      .map((c) => `• ${c.full_name}${c.phone ? ' · ' + c.phone : ''} — ${c.total_orders} đơn, ${Number(c.total_spent).toLocaleString('vi-VN')}đ`)
      .join('\n');

    return {
      intent: 'search_customer',
      reply: `Tìm được ${total} khách:\n\n${lines}`,
      data: { customers: data },
      suggestions: SUGGESTIONS.search_customer,
    };
  }

  private async handleSearchMenu(query: string): Promise<ChatResponse> {
    const { data, total } = await this.menuService.findAll({
      search: query,
      is_available: 1,
      limit: 5,
      page: 1,
    });

    if (total === 0) {
      return {
        intent: 'search_menu',
        reply: `Không tìm thấy món nào khớp với "${query}". Bạn có thể hỏi "xem menu" để xem toàn bộ.`,
        suggestions: SUGGESTIONS.fallback,
      };
    }

    const lines = data
      .map((m) => `• ${m.name} — ${Number(m.price).toLocaleString('vi-VN')}đ`)
      .join('\n');

    return {
      intent: 'search_menu',
      reply: `Tìm được ${total} món khớp với "${query}":\n\n${lines}`,
      data: { items: data },
      suggestions: SUGGESTIONS.search_menu,
    };
  }

  private async handleFallback(): Promise<ChatResponse> {
    return {
      intent: 'fallback',
      reply: DEFAULT_FALLBACK_REPLY,
      suggestions: SUGGESTIONS.fallback,
    };
  }

  // ================ Public API ================

  async processMessage(
    message: string,
    sessionId: string,
    userId?: number,
  ): Promise<ChatResponse> {
    const normalized = normalizeSearchTerm(message);
    const { name, match } = this.matchIntent(message, normalized);

    let response: ChatResponse;
    try {
      switch (name) {
        case 'greeting':
          response = await this.handleGreeting();
          break;
        case 'help':
          response = await this.handleHelp();
          break;
        case 'restaurant_info':
          response = await this.handleRestaurantInfo();
          break;
        case 'view_menu':
          response = await this.handleViewMenu();
          break;
        case 'top_items':
          response = await this.handleTopItems();
          break;
        case 'check_table':
          response = await this.handleCheckTable();
          break;
        case 'revenue_today':
          response = await this.handleRevenueToday();
          break;
        case 'order_stats':
          response = await this.handleOrderStats();
          break;
        case 'check_order_by_code':
          response = await this.handleCheckOrderByCode(match!.toUpperCase());
          break;
        case 'search_customer':
          // Lấy token có ý nghĩa (phần sau keyword)
          response = await this.handleSearchCustomer(message);
          break;
        case 'search_menu':
          response = await this.handleSearchMenu(message);
          break;
        default:
          response = await this.handleFallback();
      }
    } catch (err) {
      response = {
        intent: 'error',
        reply: 'Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại.',
      };
    }

    // Lưu log (fire & forget)
    this.logRepo
      .save({
        session_id: sessionId,
        user_message: message,
        bot_response: response.reply,
        intent: response.intent,
        user_id: userId ?? (null as any),
      })
      .catch(() => {});

    return response;
  }

  async getHistory(sessionId: string, limit = 50) {
    return this.logRepo.find({
      where: { session_id: sessionId },
      order: { created_at: 'ASC' },
      take: limit,
    });
  }
}
