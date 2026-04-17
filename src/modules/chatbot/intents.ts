export interface IntentDef {
  name: string;
  pattern?: RegExp;
  keywords?: string[];
  priority: number;
}

/**
 * Danh sách intents. Matching flow:
 * 1. Pattern có priority cao nhất (regex match chuỗi đặc biệt như order_code)
 * 2. Keywords: normalize input (bỏ dấu, space), đếm keyword nào match
 * 3. Pick intent có (priority, score) cao nhất
 *
 * Keywords đều viết ở dạng đã normalize: lowercase, không dấu, không space.
 */
export const INTENTS: IntentDef[] = [
  // 1. Pattern-based (priority cao)
  {
    name: 'check_order_by_code',
    pattern: /ORD-\d{8}-\d{3}/i,
    priority: 100,
  },

  // 2. Keyword-based
  {
    name: 'view_menu',
    keywords: ['xemmenu', 'thucdon', 'comongi', 'danhsachmon', 'cacmonan', 'menu'],
    priority: 50,
  },
  {
    name: 'top_items',
    keywords: ['topmon', 'monbanchay', 'monhot', 'banchay', 'monngon', 'goyimon', 'goy', 'topban'],
    priority: 55,
  },
  {
    name: 'check_table',
    keywords: ['bantrong', 'conban', 'bannao', 'kiemtraban', 'tinhtrangban', 'banavailable', 'conchoban'],
    priority: 55,
  },
  {
    name: 'revenue_today',
    keywords: ['doanhthuhomnay', 'doanhthu', 'tongthu', 'doanhsohomnay', 'doanhso'],
    priority: 60,
  },
  {
    name: 'order_stats',
    keywords: ['thongkedon', 'sodondonhang', 'donhom', 'tongdon', 'baonhieudon'],
    priority: 55,
  },
  {
    name: 'restaurant_info',
    keywords: ['giomocua', 'mocua', 'giolamviec', 'diachi', 'thongtinnhahang', 'lienhe', 'sdt', 'sodienthoai', 'nhahangodau'],
    priority: 60,
  },
  {
    name: 'greeting',
    keywords: ['xinchao', 'hello', 'hi', 'chaoban', 'chaobot', 'helo', 'chao'],
    priority: 40,
  },
  {
    name: 'help',
    keywords: ['giup', 'help', 'lamgi', 'huongdan', 'chuc nang', 'banbiet', 'banlamduocgi', 'biet gi'],
    priority: 40,
  },
  {
    name: 'search_customer',
    keywords: ['timkhach', 'tinkhach', 'khachhang', 'khachten', 'tra cuukhach'],
    priority: 45,
  },

  // 3. Fallback: tìm món theo tên (không cần keyword, match tự do)
  // Xử lý riêng trong service
];

/**
 * Gợi ý câu hỏi tiếp theo sau mỗi intent.
 */
export const SUGGESTIONS: Record<string, string[]> = {
  greeting: ['Xem menu', 'Còn bàn trống không?', 'Doanh thu hôm nay', 'Món bán chạy'],
  help: ['Xem menu', 'Còn bàn trống không?', 'Đơn ORD-20260417-001', 'Doanh thu hôm nay'],
  view_menu: ['Món bán chạy', 'Tìm món Tôm hùm', 'Doanh thu hôm nay'],
  top_items: ['Xem menu', 'Doanh thu hôm nay', 'Còn bàn trống không?'],
  check_table: ['Xem menu', 'Doanh thu hôm nay', 'Giờ mở cửa'],
  revenue_today: ['Thống kê đơn hàng', 'Món bán chạy', 'Còn bàn trống không?'],
  order_stats: ['Doanh thu hôm nay', 'Xem menu', 'Còn bàn trống không?'],
  check_order_by_code: ['Doanh thu hôm nay', 'Thống kê đơn hàng'],
  restaurant_info: ['Xem menu', 'Còn bàn trống không?', 'Doanh thu hôm nay'],
  search_customer: ['Xem menu', 'Doanh thu hôm nay'],
  search_menu: ['Xem menu', 'Món bán chạy', 'Còn bàn trống không?'],
  fallback: ['Xem menu', 'Còn bàn trống không?', 'Giờ mở cửa', 'Bạn làm được gì?'],
};

export const DEFAULT_FALLBACK_REPLY =
  'Xin lỗi, tôi chưa hiểu câu hỏi. Hãy thử một trong các gợi ý bên dưới, hoặc hỏi tôi: "Bạn làm được gì?"';
