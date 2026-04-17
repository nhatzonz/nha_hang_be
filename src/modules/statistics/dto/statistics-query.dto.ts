import { IsEnum, IsISO8601, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class StatsPeriodDto {
  @IsOptional()
  @IsEnum(['today', 'week', 'month', 'year', 'custom'])
  period?: 'today' | 'week' | 'month' | 'year' | 'custom';

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class RevenueQueryDto extends StatsPeriodDto {
  @IsOptional()
  @IsIn(['day', 'month'])
  groupBy?: 'day' | 'month' = 'day';
}

export class TopItemsQueryDto extends StatsPeriodDto {
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}
