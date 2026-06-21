/**
 * Phân nhóm khách hàng theo SỐ ĐƠN HÀNG đã hoàn thành (total_orders).
 *
 * Nhóm được tính ĐỘNG mỗi lần đọc khách hàng, KHÔNG lưu vào DB — nên khi
 * đổi ngưỡng dưới đây, toàn bộ khách hàng tự cập nhật nhóm ngay, không cần
 * chạy lại dữ liệu.
 *
 * Muốn đổi quy tắc phân nhóm: chỉ cần sửa 2 hằng số bên dưới.
 */
export const CUSTOMER_GROUP_THRESHOLDS = {
  /** Từ số đơn này trở lên = Khách thường (dưới mức này = Khách mới) */
  REGULAR_MIN_ORDERS: 3,
  /** Từ số đơn này trở lên = Khách VIP */
  VIP_MIN_ORDERS: 10,
};

export type CustomerGroup = 'new' | 'regular' | 'vip';

/** Suy ra nhóm khách hàng từ tổng số đơn. */
export function computeCustomerGroup(totalOrders: number): CustomerGroup {
  const orders = Number(totalOrders) || 0;
  if (orders >= CUSTOMER_GROUP_THRESHOLDS.VIP_MIN_ORDERS) return 'vip';
  if (orders >= CUSTOMER_GROUP_THRESHOLDS.REGULAR_MIN_ORDERS) return 'regular';
  return 'new';
}

/**
 * Khoảng số đơn tương ứng một nhóm — dùng để LỌC ở DB (vì nhóm không lưu cột).
 * max = null nghĩa là không giới hạn trên.
 */
export function groupOrdersRange(
  group: CustomerGroup,
): { min: number; max: number | null } {
  const { REGULAR_MIN_ORDERS, VIP_MIN_ORDERS } = CUSTOMER_GROUP_THRESHOLDS;
  if (group === 'vip') return { min: VIP_MIN_ORDERS, max: null };
  if (group === 'regular')
    return { min: REGULAR_MIN_ORDERS, max: VIP_MIN_ORDERS - 1 };
  return { min: 0, max: REGULAR_MIN_ORDERS - 1 };
}
