import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryOrdersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['pending', 'preparing', 'served', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  table_id?: number;

  @IsOptional()
  @Type(() => Number)
  customer_id?: number;

  @IsOptional()
  @IsISO8601()
  from_date?: string;

  @IsOptional()
  @IsISO8601()
  to_date?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
