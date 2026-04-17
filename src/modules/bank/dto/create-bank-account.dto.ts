import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên ngân hàng' })
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  bank_name: string;

  @IsString()
  @Matches(/^[0-9]{6,10}$/, { message: 'Mã BIN ngân hàng không hợp lệ' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  bank_bin: string;

  @IsString()
  @Matches(/^[0-9]{6,30}$/, { message: 'Số tài khoản không hợp lệ' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  account_number: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập chủ tài khoản' })
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  account_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bank_logo?: string;
}
