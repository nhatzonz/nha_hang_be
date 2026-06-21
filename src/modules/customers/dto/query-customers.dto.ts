import { IsIn, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryCustomersDto {
  @IsOptional()
  @IsString()
  search?: string;

  /** Lọc theo nhóm khách (tính từ số đơn). Bỏ trống = tất cả. */
  @IsOptional()
  @IsIn(['new', 'regular', 'vip'])
  group?: 'new' | 'regular' | 'vip';

  /** Sắp xếp theo tên: az = A→Z, za = Z→A. Bỏ trống = mới nhất trước. */
  @IsOptional()
  @IsIn(['az', 'za'])
  sort?: 'az' | 'za';

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
