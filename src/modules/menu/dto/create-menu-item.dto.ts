import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên món không được để trống' })
  @MaxLength(150, { message: 'Tên món tối đa 150 ký tự' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  description?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Giá phải là số' })
  @Min(0, { message: 'Giá không được âm' })
  price: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Danh mục không hợp lệ' })
  category_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1], { message: 'Trạng thái không hợp lệ' })
  is_available?: number;
}
