import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateTableDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên bàn không được để trống' })
  @MaxLength(50, { message: 'Tên bàn tối đa 50 ký tự' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Sức chứa phải là số' })
  @Min(1, { message: 'Sức chứa tối thiểu 1 người' })
  capacity: number;

  @IsOptional()
  @IsEnum(['available', 'occupied', 'reserved'], { message: 'Trạng thái không hợp lệ' })
  status?: 'available' | 'occupied' | 'reserved';

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Vị trí tối đa 100 ký tự' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  location?: string;
}
