import { IsIn, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMenuDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  category_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  is_available?: number;

  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
