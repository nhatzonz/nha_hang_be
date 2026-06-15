import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /** Món tương tự một món cho trước. */
  @Get('similar/:menuId')
  async similar(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Query('k') k?: string,
  ) {
    const data = await this.aiService.similar(menuId, k ? Number(k) : 5);
    return data ?? { menu_item_id: menuId, results: [] };
  }

  /** Gợi ý cá nhân hoá theo khách hàng. */
  @Get('recommend/:customerId')
  async recommend(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('k') k?: string,
  ) {
    const data = await this.aiService.recommend(customerId, k ? Number(k) : 5);
    return data ?? { customer_id: customerId, strategy: 'none', results: [] };
  }
}
