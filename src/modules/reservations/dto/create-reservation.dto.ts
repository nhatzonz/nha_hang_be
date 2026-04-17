import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên khách không được để trống' })
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  customer_name: string;

  @IsString()
  @Matches(/^0[0-9]{9}$/, { message: 'SĐT phải 10 chữ số bắt đầu bằng 0' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  table_id?: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày không hợp lệ (YYYY-MM-DD)' })
  reservation_date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'Giờ không hợp lệ (HH:mm)' })
  reservation_time: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Số khách tối thiểu 1' })
  guest_count: number;

  @IsOptional()
  @IsEnum(['pending', 'confirmed'], { message: 'Trạng thái chỉ được pending hoặc confirmed khi tạo' })
  status?: 'pending' | 'confirmed';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  note?: string;
}
