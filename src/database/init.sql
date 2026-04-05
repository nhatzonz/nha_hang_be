-- =============================================
-- HỆ THỐNG QUẢN LÝ NHÀ HÀNG - DATABASE SCHEMA
-- Tech: MySQL 8+ | Charset: utf8mb4
-- =============================================

CREATE DATABASE IF NOT EXISTS nha_hang_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nha_hang_db;

-- =============================================
-- 1. USERS - Quản lý nhân viên & phân quyền
-- Roles: admin, manager, staff
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  avatar VARCHAR(255) DEFAULT NULL,
  role ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- =============================================
-- 2. CATEGORIES - Danh mục món ăn
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- 3. MENU_ITEMS - Món ăn
-- =============================================
CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT DEFAULT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT DEFAULT NULL,
  price DECIMAL(12, 0) NOT NULL DEFAULT 0,
  image VARCHAR(255) DEFAULT NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_menu_category (category_id),
  INDEX idx_menu_available (is_available),
  INDEX idx_menu_price (price),
  CONSTRAINT fk_menu_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================
-- 4. TABLES - Quản lý bàn
-- Statuses: available, occupied, reserved
-- =============================================
CREATE TABLE IF NOT EXISTS tables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  capacity INT NOT NULL DEFAULT 4,
  status ENUM('available', 'occupied', 'reserved') NOT NULL DEFAULT 'available',
  location VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_tables_status (status)
) ENGINE=InnoDB;

-- =============================================
-- 5. CUSTOMERS - Quản lý khách hàng
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  total_orders INT NOT NULL DEFAULT 0,
  total_spent DECIMAL(15, 0) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_customers_phone (phone),
  INDEX idx_customers_email (email)
) ENGINE=InnoDB;

-- =============================================
-- 6. ORDERS - Đơn hàng
-- Statuses: pending, preparing, served, completed, cancelled
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_code VARCHAR(30) NOT NULL UNIQUE,
  table_id INT DEFAULT NULL,
  customer_id INT DEFAULT NULL,
  staff_id INT DEFAULT NULL,
  status ENUM('pending', 'preparing', 'served', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(15, 0) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15, 0) NOT NULL DEFAULT 0,
  final_amount DECIMAL(15, 0) NOT NULL DEFAULT 0,
  note TEXT DEFAULT NULL,
  cancelled_reason VARCHAR(255) DEFAULT NULL,
  completed_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_orders_code (order_code),
  INDEX idx_orders_status (status),
  INDEX idx_orders_table (table_id),
  INDEX idx_orders_customer (customer_id),
  INDEX idx_orders_staff (staff_id),
  INDEX idx_orders_created (created_at),
  CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================
-- 7. ORDER_DETAILS - Chi tiết đơn hàng
-- =============================================
CREATE TABLE IF NOT EXISTS order_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT DEFAULT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 0) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12, 0) NOT NULL DEFAULT 0,
  note VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_od_order (order_id),
  INDEX idx_od_menu_item (menu_item_id),
  CONSTRAINT fk_od_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_od_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================
-- 8. RESERVATIONS - Đặt bàn online
-- Statuses: pending, confirmed, cancelled, completed
-- =============================================
CREATE TABLE IF NOT EXISTS reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) DEFAULT NULL,
  table_id INT DEFAULT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  guest_count INT NOT NULL DEFAULT 2,
  status ENUM('pending', 'confirmed', 'cancelled', 'completed') NOT NULL DEFAULT 'pending',
  note TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_res_date (reservation_date),
  INDEX idx_res_status (status),
  INDEX idx_res_table (table_id),
  INDEX idx_res_phone (phone),
  CONSTRAINT fk_res_table FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================
-- 9. PAYMENTS - Thanh toán
-- Methods: cash, card, bank_transfer, e_wallet
-- Luồng QR: tạo payment → sinh QR VietQR → khách quét
-- → webhook/polling xác nhận → tự cập nhật trạng thái
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  amount DECIMAL(15, 0) NOT NULL DEFAULT 0,
  payment_method ENUM('cash', 'card', 'bank_transfer', 'e_wallet') NOT NULL DEFAULT 'cash',
  status ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  transaction_code VARCHAR(50) DEFAULT NULL UNIQUE,
  transfer_content VARCHAR(100) DEFAULT NULL,
  bank_transaction_id VARCHAR(100) DEFAULT NULL,
  qr_data TEXT DEFAULT NULL,
  paid_at TIMESTAMP DEFAULT NULL,
  expired_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_pay_order (order_id),
  INDEX idx_pay_status (status),
  INDEX idx_pay_paid_at (paid_at),
  INDEX idx_pay_transaction (transaction_code),
  INDEX idx_pay_transfer_content (transfer_content),
  CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================
-- 10. CHAT_LOGS - Lưu lịch sử chatbot
-- =============================================
CREATE TABLE IF NOT EXISTS chat_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  user_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  intent VARCHAR(50) DEFAULT NULL,
  user_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_chat_session (session_id),
  INDEX idx_chat_intent (intent),
  INDEX idx_chat_created (created_at),
  CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================
-- 11. RESTAURANT_INFO - Thông tin nhà hàng
-- Dùng cho chatbot, hiển thị UI, hoá đơn
-- =============================================
CREATE TABLE IF NOT EXISTS restaurant_info (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address TEXT DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  open_time TIME DEFAULT '08:00:00',
  close_time TIME DEFAULT '22:00:00',
  description TEXT DEFAULT NULL,
  logo VARCHAR(255) DEFAULT NULL,
  tax_code VARCHAR(50) DEFAULT NULL,
  wifi_password VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- INSERT: Thông tin nhà hàng mặc định
-- =============================================
INSERT INTO restaurant_info (name, address, phone, email, open_time, close_time, description)
VALUES (
  'Nhà hàng Hải Sản Biển Đông',
  '56 Đường Trần Phú, Quận Hải Châu, TP. Đà Nẵng',
  '0236 3888 999',
  'contact@haisan-biendong.vn',
  '09:00:00',
  '22:30:00',
  'Nhà hàng chuyên hải sản tươi sống, đặc sản miền Trung, view biển Mỹ Khê'
);

-- =============================================
-- 12. BANK_ACCOUNTS - Tài khoản ngân hàng nhận thanh toán
-- Admin thiết lập, chỉ 1 tài khoản is_active = 1 tại 1 thời điểm
-- Tài khoản active sẽ dùng sinh QR cho tất cả đơn thanh toán
-- =============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bank_name VARCHAR(100) NOT NULL,
  bank_bin VARCHAR(10) NOT NULL,
  account_number VARCHAR(30) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  bank_logo VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_bank_active (is_active),
  CONSTRAINT fk_bank_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================
-- INSERT: Tài khoản Admin mặc định
-- Password: admin123 (bcrypt hash)
-- =============================================
INSERT INTO users (full_name, email, password, phone, role, is_active)
VALUES (
  'Lê Trường',
  'nhatzonz@gmail.com',
  '$2b$10$voE7aD3lt0jR.m7Kh1vpludbgxs.4fDUIIU.5R.BoJ14mePgHQeQa',
  '0386522328',
  'admin',
  1
)
ON DUPLICATE KEY UPDATE full_name = full_name;

-- pass: admin123
