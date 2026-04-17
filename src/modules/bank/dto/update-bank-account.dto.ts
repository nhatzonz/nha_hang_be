import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  bank_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6,10}$/, { message: 'Mã BIN không hợp lệ' })
  bank_bin?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6,30}$/, { message: 'Số tài khoản không hợp lệ' })
  account_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  account_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bank_logo?: string;
}
