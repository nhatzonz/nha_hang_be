import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateOrderItemDto {
  @Type(() => Number)
  @IsInt()
  menu_item_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Số lượng tối thiểu 1' })
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  note?: string;
}

export class CreateOrderDto {
  @Type(() => Number)
  @IsInt({ message: 'Vui lòng chọn bàn' })
  table_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customer_id?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Đơn phải có ít nhất 1 món' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  note?: string;
}
