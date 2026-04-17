import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { OrderDetail } from '../orders/order-detail.entity';
import { Customer } from '../customers/customer.entity';
import {
  DateRange,
  PeriodType,
  calcChangePercent,
  getPreviousRange,
  resolvePeriod,
} from './date-range.util';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderDetail) private readonly detailRepo: Repository<OrderDetail>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
  ) {}

  /**
   * Raw sum of revenue + count of orders trong range (chỉ tính completed).
   */
  private async aggregateOrders(range: DateRange) {
    const row = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.final_amount), 0)', 'revenue')
      .addSelect('COUNT(o.id)', 'orders')
      .where('o.status = :status', { status: 'completed' })
      .andWhere('o.completed_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .getRawOne();

    return {
      revenue: Number(row?.revenue ?? 0),
      orders: Number(row?.orders ?? 0),
    };
  }

  /**
   * Overview: 3 KPIs với compare kỳ trước.
   */
  async getOverview(period?: PeriodType, from?: string, to?: string) {
    const current = resolvePeriod(period, from, to);
    const previous = getPreviousRange(current);

    const [cur, prev] = await Promise.all([
      this.aggregateOrders(current),
      this.aggregateOrders(previous),
    ]);

    // Retention: khách có >=2 đơn completed / khách có >=1 đơn completed
    const retentionRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.customer_id', 'customer_id')
      .addSelect('COUNT(o.id)', 'cnt')
      .where('o.status = :status', { status: 'completed' })
      .andWhere('o.customer_id IS NOT NULL')
      .groupBy('o.customer_id')
      .getRawMany();

    const totalCustomers = retentionRow.length;
    const repeatCustomers = retentionRow.filter((r) => Number(r.cnt) >= 2).length;
    const retentionRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

    // Avg order value trong kỳ
    const avgOrderValue = cur.orders > 0 ? cur.revenue / cur.orders : 0;
    const prevAvg = prev.orders > 0 ? prev.revenue / prev.orders : 0;

    return {
      period: { from: current.from, to: current.to },
      revenue: {
        value: cur.revenue,
        change: calcChangePercent(cur.revenue, prev.revenue),
      },
      orders: {
        value: cur.orders,
        change: calcChangePercent(cur.orders, prev.orders),
      },
      avgOrderValue: {
        value: avgOrderValue,
        change: calcChangePercent(avgOrderValue, prevAvg),
      },
      retention: {
        rate: retentionRate,
        repeat_customers: repeatCustomers,
        total_customers: totalCustomers,
      },
    };
  }

  /**
   * Doanh thu theo timeseries, group by day hoặc month.
   */
  async getRevenue(
    period?: PeriodType,
    from?: string,
    to?: string,
    groupBy: 'day' | 'month' = 'day',
  ) {
    const range = resolvePeriod(period, from, to);
    const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select(`DATE_FORMAT(o.completed_at, '${dateFormat}')`, 'bucket')
      .addSelect('COALESCE(SUM(o.final_amount), 0)', 'revenue')
      .addSelect('COUNT(o.id)', 'orders')
      .where('o.status = :status', { status: 'completed' })
      .andWhere('o.completed_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany();

    // Fill missing buckets
    const data: { bucket: string; revenue: number; orders: number }[] = [];
    const map = new Map(rows.map((r) => [r.bucket, r]));

    if (groupBy === 'day') {
      const cur = new Date(range.from);
      while (cur <= range.to) {
        // Dùng local date để khớp với MySQL DATE_FORMAT (session timezone)
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        const r = map.get(key);
        data.push({
          bucket: key,
          revenue: Number(r?.revenue ?? 0),
          orders: Number(r?.orders ?? 0),
        });
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      const cur = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
      const end = new Date(range.to);
      while (cur <= end) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        const r = map.get(key);
        data.push({
          bucket: key,
          revenue: Number(r?.revenue ?? 0),
          orders: Number(r?.orders ?? 0),
        });
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    return { groupBy, data };
  }

  /**
   * Top món bán chạy: group by menu_item, sum quantity từ order_details.
   */
  async getTopItems(period?: PeriodType, from?: string, to?: string, limit = 10) {
    const range = resolvePeriod(period, from, to);

    const rows = await this.detailRepo
      .createQueryBuilder('od')
      .innerJoin('od.order', 'o')
      .leftJoin('od.menu_item', 'm')
      .leftJoin('m.category', 'c')
      .select('m.id', 'id')
      .addSelect('m.name', 'name')
      .addSelect('m.image', 'image')
      .addSelect('c.name', 'category')
      .addSelect('SUM(od.quantity)', 'quantity')
      .addSelect('SUM(od.subtotal)', 'revenue')
      .where('o.status = :status', { status: 'completed' })
      .andWhere('o.completed_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere('m.id IS NOT NULL')
      .groupBy('m.id')
      .addGroupBy('m.name')
      .addGroupBy('m.image')
      .addGroupBy('c.name')
      .orderBy('quantity', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      image: r.image,
      category: r.category,
      quantity: Number(r.quantity),
      revenue: Number(r.revenue),
    }));
  }

  /**
   * Đếm đơn theo từng status (toàn hệ thống).
   */
  async getOrdersByStatus() {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(o.id)', 'count')
      .groupBy('o.status')
      .getRawMany();

    const result: Record<string, number> = {
      pending: 0,
      preparing: 0,
      served: 0,
      completed: 0,
      cancelled: 0,
    };
    rows.forEach((r) => {
      result[r.status] = Number(r.count);
    });
    return result;
  }

  /**
   * Retention chi tiết hơn.
   */
  async getRetention() {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.customer_id', 'customer_id')
      .addSelect('COUNT(o.id)', 'cnt')
      .where('o.status = :status', { status: 'completed' })
      .andWhere('o.customer_id IS NOT NULL')
      .groupBy('o.customer_id')
      .getRawMany();

    const total = rows.length;
    const repeat = rows.filter((r) => Number(r.cnt) >= 2).length;
    return {
      total_customers: total,
      repeat_customers: repeat,
      rate: total > 0 ? (repeat / total) * 100 : 0,
    };
  }

  /**
   * Doanh thu theo danh mục món.
   */
  async getRevenueByCategory(period?: PeriodType, from?: string, to?: string) {
    const range = resolvePeriod(period, from, to);

    const rows = await this.detailRepo
      .createQueryBuilder('od')
      .innerJoin('od.order', 'o')
      .leftJoin('od.menu_item', 'm')
      .leftJoin('m.category', 'c')
      .select('c.id', 'id')
      .addSelect('COALESCE(c.name, :uncat)', 'name')
      .addSelect('SUM(od.subtotal)', 'revenue')
      .addSelect('SUM(od.quantity)', 'quantity')
      .where('o.status = :status', { status: 'completed' })
      .andWhere('o.completed_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .setParameter('uncat', 'Chưa phân loại')
      .groupBy('c.id')
      .addGroupBy('c.name')
      .orderBy('revenue', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      id: r.id ? Number(r.id) : null,
      name: r.name,
      revenue: Number(r.revenue),
      quantity: Number(r.quantity),
    }));
  }
}
