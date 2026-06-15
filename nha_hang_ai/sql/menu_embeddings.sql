-- Bảng lưu vector embedding của từng món, nằm chung DB nghiệp vụ (nha_hang_db).
-- Mỗi món 1 dòng. embedding lưu dạng JSON (mảng 768 số float).
-- Chạy thủ công: mysql -u root -p nha_hang_db < menu_embeddings.sql

CREATE TABLE IF NOT EXISTS menu_embeddings (
  menu_item_id  INT          NOT NULL,
  embedding     JSON         NOT NULL,
  source_text   TEXT         NULL,
  model         VARCHAR(64)  NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (menu_item_id),
  CONSTRAINT fk_menu_embeddings_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
