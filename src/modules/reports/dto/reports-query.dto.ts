import { IsISO8601, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class DateRangeDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class SingleDateDto {
  @IsOptional()
  @IsISO8601()
  date?: string;
}

export class TopCustomersDto extends DateRangeDto {
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}
