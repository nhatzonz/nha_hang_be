export type OrderStatus = 'pending' | 'preparing' | 'served' | 'completed' | 'cancelled';

/**
 * Các trạng thái có thể chuyển đến từ trạng thái hiện tại.
 * completed và cancelled là terminal.
 */
const STATE_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['served', 'cancelled'],
  served: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const canTransitionOrderStatus = (from: OrderStatus, to: OrderStatus): boolean => {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Chờ xử lý',
  preparing: 'Đang chế biến',
  served: 'Đã phục vụ',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
};

export const isTerminalStatus = (status: OrderStatus): boolean => {
  return status === 'completed' || status === 'cancelled';
};
