import { EntityManager } from 'typeorm';
import { Order } from './order.entity';

/**
 * Sinh mã đơn hàng dạng ORD-YYYYMMDD-NNN.
 * NNN reset mỗi ngày, padding 3 chữ số.
 * Gọi trong transaction để tránh race condition.
 */
export const generateOrderCode = async (manager: EntityManager): Promise<string> => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;
  const prefix = `ORD-${datePart}-`;

  const lastOrder = await manager
    .createQueryBuilder(Order, 'o')
    .where('o.order_code LIKE :p', { p: `${prefix}%` })
    .orderBy('o.order_code', 'DESC')
    .getOne();

  let seq = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.order_code.substring(prefix.length), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
};
