/**
 * Seed dữ liệu mẫu cho hệ thống quản lý nhà hàng.
 *
 * Cách chạy:
 *   npm run seed              # giữ nguyên dữ liệu cũ, chỉ thêm mới
 *   npm run seed -- --reset   # XOÁ HẾT dữ liệu rồi seed lại
 *
 * Sinh đầy đủ:
 *   - 1 admin + 2 manager + 4 staff (mật khẩu mặc định: 123456)
 *   - 6 danh mục + 24 món ăn (ảnh tải từ Unsplash)
 *   - 12 bàn (3 khu vực)
 *   - 25 khách hàng
 *   - 5 tài khoản ngân hàng (1 active)
 *   - 80 đơn hàng rải đều 60 ngày, đa dạng trạng thái
 *   - 15 reservation rải 7 ngày tới
 *   - Restaurant info
 */
import 'reflect-metadata';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { User } from '../../modules/users/user.entity';
import { Category } from '../../modules/menu/category.entity';
import { MenuItem } from '../../modules/menu/menu-item.entity';
import { Table } from '../../modules/tables/table.entity';
import { Customer } from '../../modules/customers/customer.entity';
import { Order } from '../../modules/orders/order.entity';
import { OrderDetail } from '../../modules/orders/order-detail.entity';
import { Reservation } from '../../modules/reservations/reservation.entity';
import { RestaurantInfo } from '../../modules/restaurant/restaurant-info.entity';
import { BankAccount } from '../../modules/bank/bank-account.entity';
import { Payment } from '../../modules/payments/payment.entity';
import { ChatLog } from '../../modules/chat/chat-log.entity';

const RESET = process.argv.includes('--reset');
const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads/menu');

// ===== Helpers =====
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[rand(0, arr.length - 1)];
const sample = <T>(arr: T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(rand(0, copy.length - 1), 1)[0]);
  }
  return out;
};

const fetchWithRedirect = (url: string, depth = 0): Promise<{ status: number; stream: NodeJS.ReadableStream | null }> =>
  new Promise((resolve) => {
    if (depth > 5) return resolve({ status: 0, stream: null });
    https.get(url, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        fetchWithRedirect(next, depth + 1).then(resolve);
        return;
      }
      resolve({ status, stream: res });
    }).on('error', () => resolve({ status: 0, stream: null }));
  });

const downloadImage = async (url: string, filename: string): Promise<string> => {
  const filepath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filepath) && fs.statSync(filepath).size > 1000) {
    return `uploads/menu/${filename}`;
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const { status, stream } = await fetchWithRedirect(url);
  if (status !== 200 || !stream) return '';
  return new Promise((resolve) => {
    const file = fs.createWriteStream(filepath);
    stream.pipe(file);
    file.on('finish', () => file.close(() => {
      if (fs.statSync(filepath).size < 1000) {
        try { fs.unlinkSync(filepath); } catch {}
        return resolve('');
      }
      resolve(`uploads/menu/${filename}`);
    }));
    file.on('error', () => {
      try { fs.unlinkSync(filepath); } catch {}
      resolve('');
    });
  });
};

const VN_FIRST_NAMES = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Võ','Đặng','Bùi','Đỗ','Hồ','Ngô','Dương','Lý'];
const VN_MIDDLE = ['Văn','Thị','Hoàng','Minh','Quốc','Đức','Thành','Hữu','Thanh','Ngọc','Anh','Quang','Hải','Thuỳ'];
const VN_LAST = ['An','Bình','Cường','Dũng','Duy','Giang','Hà','Hải','Hằng','Hoa','Hùng','Hương','Khánh','Lan','Long','Mai','Minh','Nam','Nga','Ngọc','Phong','Phúc','Quân','Quỳnh','Sơn','Thảo','Thắng','Thành','Trang','Trung','Tuấn','Tùng','Việt','Vy','Yến'];

const vnName = () => `${pick(VN_FIRST_NAMES)} ${pick(VN_MIDDLE)} ${pick(VN_LAST)}`;
const vnPhone = () => `09${rand(10,99)}${rand(100,999)}${rand(100,999)}`;
const slug = (s: string) =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ===== Master data =====
const STAFF_USERS = [
  { full_name: 'Admin Hệ thống', email: 'nhatzonz@gmail.com', phone: '0900000001', role: 'admin' },
  { full_name: 'Nguyễn Văn Quản', email: 'manager1@nhahang.vn', phone: '0900000002', role: 'manager' },
  { full_name: 'Trần Thị Lý', email: 'manager2@nhahang.vn', phone: '0900000003', role: 'manager' },
  { full_name: 'Lê Văn Hùng', email: 'staff1@nhahang.vn', phone: '0900000004', role: 'staff' },
  { full_name: 'Phạm Thị Mai', email: 'staff2@nhahang.vn', phone: '0900000005', role: 'staff' },
  { full_name: 'Hoàng Minh Tuấn', email: 'staff3@nhahang.vn', phone: '0900000006', role: 'staff' },
  { full_name: 'Vũ Ngọc Lan', email: 'staff4@nhahang.vn', phone: '0900000007', role: 'staff' },
];

// Ảnh từ Unsplash — query trực tiếp món ăn
const CATEGORIES = [
  {
    name: 'Hải sản',
    description: 'Tôm, cua, ghẹ, mực — tươi sống',
    items: [
      { name: 'Tôm hùm Alaska nướng phô mai', price: 1200000, q: 'lobster-cheese' },
      { name: 'Cua hoàng đế hấp bia', price: 1500000, q: 'king-crab' },
      { name: 'Ghẹ rang me', price: 380000, q: 'crab-tamarind' },
      { name: 'Mực ống nướng sa tế', price: 220000, q: 'grilled-squid' },
      { name: 'Sò điệp nướng mỡ hành', price: 280000, q: 'scallop' },
    ],
  },
  {
    name: 'Cá tươi',
    description: 'Cá biển, cá hồi nguyên con',
    items: [
      { name: 'Cá hồi Na Uy nướng', price: 450000, q: 'salmon-grilled' },
      { name: 'Cá mú hấp xì dầu', price: 680000, q: 'steamed-fish' },
      { name: 'Cá tuyết áp chảo', price: 520000, q: 'cod-fish' },
      { name: 'Cá lăng om chuối đậu', price: 320000, q: 'fish-stew' },
    ],
  },
  {
    name: 'Lẩu',
    description: 'Lẩu hải sản, lẩu Thái',
    items: [
      { name: 'Lẩu hải sản chua cay', price: 550000, q: 'seafood-hotpot' },
      { name: 'Lẩu Thái tomyum', price: 480000, q: 'tomyum-hotpot' },
      { name: 'Lẩu cá tầm măng chua', price: 620000, q: 'fish-hotpot' },
    ],
  },
  {
    name: 'Khai vị',
    description: 'Salad, gỏi, súp',
    items: [
      { name: 'Gỏi cuốn tôm thịt', price: 85000, q: 'spring-roll' },
      { name: 'Salad bơ tôm', price: 120000, q: 'avocado-salad' },
      { name: 'Súp hải sản kem', price: 95000, q: 'seafood-soup' },
      { name: 'Bánh mì bơ tỏi', price: 45000, q: 'garlic-bread' },
    ],
  },
  {
    name: 'Cơm & Mì',
    description: 'Món chính ăn no',
    items: [
      { name: 'Cơm chiên hải sản', price: 150000, q: 'fried-rice' },
      { name: 'Mì xào hải sản', price: 140000, q: 'seafood-noodles' },
      { name: 'Cơm chiên tỏi tôm', price: 130000, q: 'shrimp-rice' },
    ],
  },
  {
    name: 'Đồ uống',
    description: 'Nước ép, sinh tố, bia',
    items: [
      { name: 'Nước ép cam tươi', price: 45000, q: 'orange-juice' },
      { name: 'Sinh tố bơ', price: 55000, q: 'avocado-smoothie' },
      { name: 'Trà đào cam sả', price: 60000, q: 'peach-tea' },
      { name: 'Bia Heineken', price: 35000, q: 'beer' },
      { name: 'Coca-Cola', price: 25000, q: 'coca-cola' },
    ],
  },
];

const TABLES = [
  ...Array.from({ length: 6 }, (_, i) => ({ name: `Bàn ${i + 1}`, capacity: 4, location: 'Tầng 1' })),
  ...Array.from({ length: 4 }, (_, i) => ({ name: `Bàn ${i + 7}`, capacity: 6, location: 'Tầng 2' })),
  { name: 'VIP 1', capacity: 10, location: 'VIP' },
  { name: 'VIP 2', capacity: 12, location: 'VIP' },
];

const BANKS = [
  { bank_name: 'Vietcombank', bank_bin: '970436', account_number: '0011004001234', account_name: 'CONG TY TNHH HAI SAN BIEN DONG', is_active: 1 },
  { bank_name: 'Techcombank', bank_bin: '970407', account_number: '19036789012345', account_name: 'CONG TY TNHH HAI SAN BIEN DONG' },
  { bank_name: 'BIDV', bank_bin: '970418', account_number: '12010001234567', account_name: 'CONG TY TNHH HAI SAN BIEN DONG' },
  { bank_name: 'MBBank', bank_bin: '970422', account_number: '0989012345', account_name: 'CONG TY TNHH HAI SAN BIEN DONG' },
  { bank_name: 'Agribank', bank_bin: '970405', account_number: '1234567890', account_name: 'CONG TY TNHH HAI SAN BIEN DONG' },
];

// ===== DataSource =====
const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    User, Category, MenuItem, Table, Customer, Order, OrderDetail,
    Reservation, RestaurantInfo, BankAccount, Payment, ChatLog,
  ],
  synchronize: false,
});

const log = (...args: any[]) => console.log('  ', ...args);

async function main() {
  await dataSource.initialize();
  console.log('✓ Kết nối DB thành công\n');

  if (RESET) {
    console.log('⚠ Đang xoá toàn bộ dữ liệu...');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tbl of [
      'order_details','orders','reservations','payments','chat_logs',
      'menu_items','categories','tables','customers','bank_accounts',
      'restaurant_info','users',
    ]) {
      await dataSource.query(`TRUNCATE TABLE \`${tbl}\``).catch(() => {});
    }
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Đã xoá dữ liệu cũ\n');
  }

  // 1. Restaurant info
  console.log('1/9 Restaurant info...');
  const infoRepo = dataSource.getRepository(RestaurantInfo);
  if ((await infoRepo.count()) === 0) {
    await infoRepo.save({
      name: 'Hải Sản Biển Đông',
      address: '123 Nguyễn Văn Linh, Phú Mỹ Hưng, Q.7, TP.HCM',
      phone: '02838123456',
      email: 'lienhe@haisanbiendong.vn',
      open_time: '10:00:00',
      close_time: '23:00:00',
      description: 'Nhà hàng hải sản tươi sống cao cấp',
      tax_code: '0301234567',
      wifi_password: 'biendong2026',
    } as any);
    log('✓ Đã tạo thông tin nhà hàng');
  } else log('• Đã có, bỏ qua');

  // 2. Users
  console.log('2/9 Users...');
  const userRepo = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash('123456', 10);
  const userMap = new Map<string, User>();
  for (const u of STAFF_USERS) {
    const existed = await userRepo.findOne({ where: { email: u.email } });
    if (existed) { userMap.set(u.email, existed); continue; }
    const created = await userRepo.save({ ...u, password: passwordHash, is_active: 1 } as any);
    userMap.set(u.email, created as User);
  }
  log(`✓ ${userMap.size} users (mật khẩu mặc định: 123456)`);

  // 3. Bank accounts
  console.log('3/9 Bank accounts...');
  const bankRepo = dataSource.getRepository(BankAccount);
  if ((await bankRepo.count()) === 0) {
    const admin = Array.from(userMap.values()).find((u) => u.role === 'admin')!;
    for (const b of BANKS) await bankRepo.save({ ...b, created_by: admin.id } as any);
    log(`✓ ${BANKS.length} tài khoản ngân hàng (Vietcombank active)`);
  } else log('• Đã có, bỏ qua');

  // 4. Categories + menu items (kèm ảnh)
  console.log('4/9 Categories + menu...');
  const catRepo = dataSource.getRepository(Category);
  const menuRepo = dataSource.getRepository(MenuItem);
  const allItems: MenuItem[] = [];
  for (const c of CATEGORIES) {
    let cat = await catRepo.findOne({ where: { name: c.name } });
    if (!cat) cat = await catRepo.save({ name: c.name, description: c.description, is_active: 1 } as any);
    for (const item of c.items) {
      const existed = await menuRepo.findOne({ where: { name: item.name } });
      const filename = `seed-${slug(item.name)}.jpg`;
      const imageUrl = `https://loremflickr.com/600/600/${item.q},food?lock=${slug(item.name).length * 7}`;
      let image = '';
      try {
        image = await downloadImage(imageUrl, filename);
      } catch { /* ignore */ }

      if (existed) {
        // Bổ sung ảnh nếu trước đó chưa có
        if (image && !existed.image) {
          await menuRepo.update(existed.id, { image });
          existed.image = image;
        }
        allItems.push(existed);
        process.stdout.write('.');
        continue;
      }

      const m = await menuRepo.save({
        category_id: cat!.id,
        name: item.name,
        price: item.price,
        description: `${item.name} — chế biến tươi từ nguyên liệu chọn lọc`,
        image: image || null,
        is_available: Math.random() > 0.1 ? 1 : 0,
      } as any);
      allItems.push(m as MenuItem);
      process.stdout.write('.');
    }
  }
  console.log(`\n   ✓ ${CATEGORIES.length} danh mục, ${allItems.length} món`);

  // 5. Tables
  console.log('5/9 Tables...');
  const tableRepo = dataSource.getRepository(Table);
  const tables: Table[] = [];
  for (const t of TABLES) {
    let tb = await tableRepo.findOne({ where: { name: t.name } });
    if (!tb) tb = await tableRepo.save({ ...t, status: 'available' } as any);
    tables.push(tb as Table);
  }
  log(`✓ ${tables.length} bàn`);

  // 6. Customers
  console.log('6/9 Customers...');
  const customerRepo = dataSource.getRepository(Customer);
  const existingCustomers = await customerRepo.find();
  const customers: Customer[] = [...existingCustomers];
  const NEED_CUSTOMERS = 25;
  for (let i = customers.length; i < NEED_CUSTOMERS; i++) {
    const c = await customerRepo.save({
      full_name: vnName(),
      phone: vnPhone(),
      email: Math.random() > 0.5 ? `khach${i}@gmail.com` : null,
      total_orders: 0,
      total_spent: 0,
    } as any);
    customers.push(c as Customer);
  }
  log(`✓ ${customers.length} khách hàng`);

  // 7. Orders + details (rải đều 60 ngày qua)
  console.log('7/9 Orders + details...');
  const orderRepo = dataSource.getRepository(Order);
  const detailRepo = dataSource.getRepository(OrderDetail);
  const staffUsers = Array.from(userMap.values()).filter((u) => u.role === 'staff' || u.role === 'manager');
  const NEED_ORDERS = 80;
  const STATUS_DIST = ['completed','completed','completed','completed','completed','completed','completed','cancelled','served','preparing','pending'];
  const counterByDate = new Map<string, number>();

  // Lấy counter cao nhất hiện có từ DB cho từng ngày (tránh trùng order_code)
  const existingCodes = await dataSource.query(
    `SELECT order_code FROM orders WHERE order_code LIKE 'ORD-%'`,
  );
  for (const r of existingCodes) {
    const parts = (r.order_code as string).split('-');
    if (parts.length === 3) {
      const ymd = parts[1];
      const num = parseInt(parts[2], 10);
      if (!isNaN(num)) counterByDate.set(ymd, Math.max(counterByDate.get(ymd) || 0, num));
    }
  }

  if ((await orderRepo.count()) < NEED_ORDERS) {
    for (let i = 0; i < NEED_ORDERS; i++) {
      const daysAgo = rand(0, 59);
      const created = new Date();
      created.setDate(created.getDate() - daysAgo);
      created.setHours(rand(10, 22), rand(0, 59), 0, 0);

      const ymd = `${created.getFullYear()}${String(created.getMonth()+1).padStart(2,'0')}${String(created.getDate()).padStart(2,'0')}`;
      const counter = (counterByDate.get(ymd) || 0) + 1;
      counterByDate.set(ymd, counter);
      const order_code = `ORD-${ymd}-${String(counter).padStart(3,'0')}`;

      const status = pick(STATUS_DIST);
      const itemsInOrder = sample(allItems.filter((it) => it.is_available || status === 'cancelled'), rand(1, 5));
      let total = 0;
      const detailsToCreate: any[] = [];
      for (const it of itemsInOrder) {
        const qty = rand(1, 3);
        const sub = Number(it.price) * qty;
        total += sub;
        detailsToCreate.push({ menu_item_id: it.id, quantity: qty, unit_price: it.price, subtotal: sub });
      }

      const useCustomer = Math.random() > 0.3;
      const customer = useCustomer ? pick(customers) : null;
      const discount = Math.random() > 0.85 ? rand(20, 100) * 1000 : 0;
      const final = Math.max(0, total - discount);

      const order = await orderRepo.save({
        order_code,
        table_id: pick(tables).id,
        customer_id: customer?.id || null,
        staff_id: pick(staffUsers).id,
        status,
        total_amount: total,
        discount_amount: discount,
        final_amount: final,
        cancelled_reason: status === 'cancelled' ? pick(['Khách đổi ý','Hết món','Khách rời quán','Trùng đơn']) : null,
        completed_at: status === 'completed' ? created : null,
        note: Math.random() > 0.8 ? 'Ít cay' : null,
        created_at: created,
      } as any);

      for (const d of detailsToCreate) {
        await detailRepo.save({ ...d, order_id: order.id });
      }

      // Cộng dồn vào customer nếu completed
      if (status === 'completed' && customer) {
        await customerRepo.increment({ id: customer.id }, 'total_orders', 1);
        await customerRepo.increment({ id: customer.id }, 'total_spent', final);
      }

      if ((i + 1) % 10 === 0) process.stdout.write('.');
    }
    console.log(`\n   ✓ ${NEED_ORDERS} đơn hàng (rải 60 ngày)`);
  } else log('• Đã có ≥80 đơn, bỏ qua');

  // 8. Reservations (7 ngày tới)
  console.log('8/9 Reservations...');
  const resRepo = dataSource.getRepository(Reservation);
  if ((await resRepo.count()) < 15) {
    const RES_STATUSES = ['pending','pending','confirmed','confirmed','confirmed','completed','cancelled'];
    for (let i = 0; i < 15; i++) {
      const d = new Date();
      d.setDate(d.getDate() + rand(0, 7));
      const dateStr = d.toISOString().slice(0, 10);
      const timeStr = `${String(rand(11, 21)).padStart(2,'0')}:${pick(['00','30'])}:00`;
      const useExisting = Math.random() > 0.4;
      const customer = useExisting ? pick(customers) : null;
      await resRepo.save({
        customer_name: customer?.full_name || vnName(),
        phone: customer?.phone || vnPhone(),
        email: null,
        table_id: Math.random() > 0.2 ? pick(tables).id : null,
        customer_id: customer?.id || null,
        reservation_date: dateStr,
        reservation_time: timeStr,
        guest_count: rand(2, 8),
        status: pick(RES_STATUSES),
        note: Math.random() > 0.7 ? 'Cần bàn gần cửa sổ' : null,
      } as any);
    }
    log('✓ 15 đặt bàn (7 ngày tới)');
  } else log('• Đã có, bỏ qua');

  // 9. Update bàn theo đơn active
  console.log('9/9 Sync trạng thái bàn...');
  await dataSource.query(`
    UPDATE tables t
    LEFT JOIN (
      SELECT table_id FROM orders
      WHERE status IN ('pending','preparing','served') AND table_id IS NOT NULL
      GROUP BY table_id
    ) o ON o.table_id = t.id
    SET t.status = IF(o.table_id IS NOT NULL, 'occupied', t.status)
  `);
  log('✓ Đã đồng bộ');

  console.log('\n========================================');
  console.log('✓ SEED HOÀN TẤT');
  console.log('========================================');
  console.log('Đăng nhập:');
  const adminEmail = STAFF_USERS.find((u) => u.role === 'admin')?.email;
  console.log(`  Admin:   ${adminEmail}   / 123456`);
  console.log('  Manager: manager1@nhahang.vn / 123456');
  console.log('  Staff:   staff1@nhahang.vn   / 123456');
  console.log('========================================');

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('\n✗ SEED FAILED:', err);
  process.exit(1);
});
