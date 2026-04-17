import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChangeStatusDto {
  @IsEnum(['pending', 'preparing', 'served', 'completed', 'cancelled'], {
    message: 'Trạng thái không hợp lệ',
  })
  status: 'pending' | 'preparing' | 'served' | 'completed' | 'cancelled';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  cancelled_reason?: string;
}
