import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'Giờ mở cửa không hợp lệ' })
  open_time?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'Giờ đóng cửa không hợp lệ' })
  close_time?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tax_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  wifi_password?: string;
}
