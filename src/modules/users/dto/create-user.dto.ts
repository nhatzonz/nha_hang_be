import { IsEmail, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @MaxLength(100, { message: 'Tên tối đa 100 ký tự' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  full_name: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(100, { message: 'Email tối đa 100 ký tự' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^0[0-9]{9}$/, { message: 'Số điện thoại phải có 10 chữ số và bắt đầu bằng 0' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  phone?: string;

  @IsOptional()
  @IsEnum(['admin', 'manager', 'staff'], { message: 'Vai trò không hợp lệ' })
  role?: 'admin' | 'manager' | 'staff';

  @IsOptional()
  @IsIn([0, 1], { message: 'Trạng thái không hợp lệ' })
  is_active?: number;
}
