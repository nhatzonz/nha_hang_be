import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  @MaxLength(500, { message: 'Câu hỏi tối đa 500 ký tự' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  session_id?: string;
}
