import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Giảm giá không được âm' })
  discount_amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customer_id?: number;
}
