/**
 * Chuẩn hoá chuỗi tìm kiếm: bỏ dấu, bỏ space, lowercase
 * "Tôm Hùm Nướng" -> "tomhumnuong"
 */
export const normalizeSearchTerm = (str?: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '');
};

/**
 * Tạo WHERE clause cho search accent-insensitive trên MySQL.
 * Dùng collation utf8mb4_0900_ai_ci (MySQL 8+) để bỏ qua dấu + hoa thường.
 * @param columns Các cột cần search (vd: ['m.name', 'm.description'])
 * @returns { sql, params } để truyền vào queryBuilder.andWhere
 */
export const buildSearchWhere = (columns: string[], term: string) => {
  const normalized = normalizeSearchTerm(term);
  const pattern = `%${normalized}%`;
  const conditions = columns
    .map(
      (col, i) =>
        `LOWER(REPLACE(${col}, ' ', '')) COLLATE utf8mb4_0900_ai_ci LIKE :s${i}`,
    )
    .join(' OR ');
  const params: Record<string, string> = {};
  columns.forEach((_, i) => {
    params[`s${i}`] = pattern;
  });
  return { sql: conditions, params };
};
