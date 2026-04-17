import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Tên tối đa 100 ký tự' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  full_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^0[0-9]{9}$/, { message: 'SĐT phải có 10 chữ số và bắt đầu bằng 0' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  phone?: string;
}
