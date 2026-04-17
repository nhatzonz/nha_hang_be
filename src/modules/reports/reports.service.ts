import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { OrderDetail } from '../orders/order-detail.entity';
import { MenuItem } from '../menu/menu-item.entity';
import { Customer } from '../customers/customer.entity';
import { User } from '../users/user.entity';

export interface DateRange {
  from: Date;
  to: Date;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const resolveRange = (from?: string, to?: string): DateRange => {
  if (from && to) {
    return { from: startOfDay(new Date(from)), to: endOfDay(new Date(to)) };
  }
  // Mặc định 30 ngày gần nhất
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return { from: startOfDay(start), to: endOfDay(now) };
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderDetail) private readonly detailRepo: Repository<OrderDetail>,
    @InjectRepository(MenuItem) private readonly menuRepo: Repository<MenuItem>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Doanh thu theo giờ trong 1 ngày cụ thể (0-23h).
   * Dùng để tìm peak hours.
   */
  async revenueByHour(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const from = startOfDay(targetDate);
    const to = endOfDay(targetDate);

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('HOUR(o.completed_at)', 'hour')
      .addSelect('COALESCE(SUM(o.final_amount), 0)', 'revenue')
      .addSelect('COUNT(o.id)', 'orders')
      .where('o.status = :s', { s: 'completed' })
      .andWhere('o.completed_at BETWEEN :from AND :to', { from, to })
      .groupBy('hour')
      .getRawMany();

    const map = new Map(rows.map((r) => [Number(r.hour), r]));
    const data = Array.from({ length: 24 }, (_, hour) => {
      const r = map.get(hour);
      return {
        hour,
        revenue: Number(r?.revenue ?? 0),
        orders: Number(r?.orders ?? 0),
      };
    });

    return {
      date: targetDate.toISOString().slice(0, 10),
      data,
    };
  }

  /**
   * Doanh thu theo ngày trong tuần (T2-CN).
   * MySQL DAYOFWEEK: 1=CN, 2=T2, ..., 7=T7
   */
  async revenueByWeekday(from?: string, to?: string) {
    const range = resolveRange(from, to);

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('DAYOFWEEK(o.completed_at)', 'dow')
      .addSelect('COALESCE(SUM(o.final_amount), 0)', 'revenue')
      .addSelect('COUNT(o.id)', 'orders')
      .where('o.status = :s', { s: 'completed' })
      .andWhere('o.completed_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('dow')
      .getRawMany();

    // Chuẩn hoá về T2-CN (JS: 1=T2, 7=CN)
    const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const map = new Map(rows.map((r) => [Number(r.dow), r]));

    const data = labels.map((label, i) => {
      // MySQL DAYOFWEEK: 2=T2, 3=T3, ..., 7=T7, 1=CN
      const mysqlDow = i === 6 ? 1 : i + 2;
      const r = map.get(mysqlDow);
      return {
        weekday: label,
        revenue: Number(r?.revenue ?? 0),
        orders: Number(r?.orders ?? 0),
      };
    });

    return { period: range, data };
  }

  /**
   * Doanh thu theo nhân viên.
   */
  async revenueByStaff(from?: string, to?: string) {
    const range = resolveRange(from, to);

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.staff', 'u')
      .select('u.id', 'id')
      .addSelect('u.full_name', 'full_name')
      .addSelect('u.role', 'role')
      .addSelect('COALESCE(SUM(o.final_amount), 0)', 'revenue')
      .addSelect('COUNT(o.id)', 'orders')
      .where('o.status = :s', { s: 'completed' })
      .andWhere('o.completed_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere('u.id IS NOT NULL')
      .groupBy('u.id')
      .addGroupBy('u.full_name')
      .addGroupBy('u.role')
      .orderBy('revenue', 'DESC')
      .getRawMany();

    return {
      period: range,
      data: rows.map((r) => ({
        id: Number(r.id),
        full_name: r.full_name,
        role: r.role,
        revenue: Number(r.revenue),
        orders: Number(r.orders),
        avg_order_value: r.orders > 0 ? Number(r.revenue) / Number(r.orders) : 0,
      })),
    };
  }

  /**
   * Hiệu suất menu: best sellers + worst sellers + chưa từng được bán.
   */
  async menuPerformance(from?: string, to?: string) {
    const range = resolveRange(from, to);

    // Aggregate theo từng món
    const aggRows = await this.detailRepo
      .createQueryBuilder('od')
      .innerJoin('od.order', 'o')
      .select('od.menu_item_id', 'menu_item_id')
      .addSelect('SUM(od.quantity)', 'quantity')
      .addSelect('SUM(od.subtotal)', 'revenue')
      .where('o.status = :s', { s: 'completed' })
      .andWhere('o.completed_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere('od.menu_item_id IS NOT NULL')
      .groupBy('od.menu_item_id')
      .getRawMany();

    const allMenuItems = await this.menuRepo.find({ relations: ['category'] });
    const aggMap = new Map(
      aggRows.map((r) => [Number(r.menu_item_id), r]),
    );

    const withStats = allMenuItems.map((m) => {
      const agg = aggMap.get(m.id);
      return {
        id: m.id,
        name: m.name,
        image: m.image,
        price: Number(m.price),
        category: m.category?.name || null,
        is_available: Boolean(m.is_available),
        quantity: agg ? Number(agg.quantity) : 0,
        revenue: agg ? Number(agg.revenue) : 0,
      };
    });

    const sold = withStats.filter((m) => m.quantity > 0);
    const neverSold = withStats.filter((m) => m.quantity === 0);

    return {
      period: range,
      best_sellers: sold.sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      worst_sellers: sold.sort((a, b) => a.quantity - b.quantity).slice(0, 10),
      never_sold: neverSold,
      summary: {
        total_items: allMenuItems.length,
        sold_items: sold.length,
        never_sold_count: neverSold.length,
      },
    };
  }

  /**
   * Top khách hàng theo tổng chi tiêu trong kỳ.
   */
  async topCustomers(from?: string, to?: string, limit = 10) {
    const range = resolveRange(from, to);

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.customer', 'c')
      .select('c.id', 'id')
      .addSelect('c.full_name', 'full_name')
      .addSelect('c.phone', 'phone')
      .addSelect('COALESCE(SUM(o.final_amount), 0)', 'spent')
      .addSelect('COUNT(o.id)', 'orders')
      .addSelect('MAX(o.completed_at)', 'last_visit')
      .where('o.status = :s', { s: 'completed' })
      .andWhere('o.completed_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere('c.id IS NOT NULL')
      .groupBy('c.id')
      .addGroupBy('c.full_name')
      .addGroupBy('c.phone')
      .orderBy('spent', 'DESC')
      .limit(limit)
      .getRawMany();

    return {
      period: range,
      data: rows.map((r) => ({
        id: Number(r.id),
        full_name: r.full_name,
        phone: r.phone,
        spent: Number(r.spent),
        orders: Number(r.orders),
        last_visit: r.last_visit,
        avg_order: r.orders > 0 ? Number(r.spent) / Number(r.orders) : 0,
      })),
    };
  }

  /**
   * Khách mới (first order trong kỳ) vs Khách cũ.
   */
  async customerSegmentation(from?: string, to?: string) {
    const range = resolveRange(from, to);

    // Lấy mọi khách có đơn completed trong kỳ
    const inRange = await this.orderRepo
      .createQueryBuilder('o')
      .select('DISTINCT o.customer_id', 'customer_id')
      .where('o.status = :s', { s: 'completed' })
      .andWhere('o.customer_id IS NOT NULL')
      .andWhere('o.completed_at BETWEEN :from AND :to', {
        first: range.from,
        to: range.to,
        from: range.from,
      })
      .getRawMany();

    const customerIds = inRange.map((r) => Number(r.customer_id));
    if (customerIds.length === 0) {
      return {
        period: range,
        new_customers: 0,
        returning_customers: 0,
        total: 0,
        new_rate: 0,
      };
    }

    // Với mỗi khách, check có đơn completed trước range không
    const hadBefore = await this.orderRepo
      .createQueryBuilder('o')
      .select('DISTINCT o.customer_id', 'customer_id')
      .where('o.status = :s', { s: 'completed' })
      .andWhere('o.customer_id IN (:...ids)', { ids: customerIds })
      .andWhere('o.completed_at < :from', { from: range.from })
      .getRawMany();

    const returningSet = new Set(hadBefore.map((r) => Number(r.customer_id)));
    const returning = customerIds.filter((id) => returningSet.has(id)).length;
    const newCustomers = customerIds.length - returning;
    const total = customerIds.length;

    return {
      period: range,
      new_customers: newCustomers,
      returning_customers: returning,
      total,
      new_rate: total > 0 ? (newCustomers / total) * 100 : 0,
      returning_rate: total > 0 ? (returning / total) * 100 : 0,
    };
  }

  /**
   * Phân tích đơn huỷ: tổng số, tỷ lệ, nhóm theo lý do.
   */
  async cancellationAnalysis(from?: string, to?: string) {
    const range = resolveRange(from, to);

    const completed = await this.orderRepo.count({
      where: {
        status: 'completed' as any,
      },
    });

    const totalInRange = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .getCount();

    const cancelledInRange = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.status = :s', { s: 'cancelled' })
      .andWhere('o.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .getCount();

    // Group by lý do
    const reasons = await this.orderRepo
      .createQueryBuilder('o')
      .select(`COALESCE(o.cancelled_reason, 'Không có lý do')`, 'reason')
      .addSelect('COUNT(o.id)', 'count')
      .where('o.status = :s', { s: 'cancelled' })
      .andWhere('o.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('reason')
      .orderBy('count', 'DESC')
      .getRawMany();

    // Recent cancelled orders (top 20)
    const recent = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.table', 'table')
      .leftJoinAndSelect('o.staff', 'staff')
      .where('o.status = :s', { s: 'cancelled' })
      .andWhere('o.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .orderBy('o.created_at', 'DESC')
      .limit(20)
      .getMany();

    return {
      period: range,
      total_orders: totalInRange,
      cancelled_count: cancelledInRange,
      cancellation_rate:
        totalInRange > 0 ? (cancelledInRange / totalInRange) * 100 : 0,
      reasons: reasons.map((r) => ({
        reason: r.reason,
        count: Number(r.count),
      })),
      recent: recent.map((o) => {
        const { staff, ...rest } = o;
        return {
          ...rest,
          staff: staff ? { id: staff.id, full_name: staff.full_name } : null,
        };
      }),
    };
  }
}
