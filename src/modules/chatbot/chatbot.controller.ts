import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('chatbot')
@UseGuards(JwtAuthGuard)
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('message')
  async message(@Body() dto: ChatMessageDto, @CurrentUser() user: User) {
    const sessionId = dto.session_id || `user-${user.id}`;
    return this.chatbotService.processMessage(dto.message, sessionId, user.id);
  }

  @Get('history')
  history(@Query('session_id') sessionId: string) {
    return this.chatbotService.getHistory(sessionId);
  }
}
