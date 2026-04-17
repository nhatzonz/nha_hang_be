import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  RevenueQueryDto,
  StatsPeriodDto,
  TopItemsQueryDto,
} from './dto/statistics-query.dto';

@Controller('statistics')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private readonly statsService: StatisticsService) {}

  @Get('overview')
  overview(@Query() q: StatsPeriodDto) {
    return this.statsService.getOverview(q.period, q.from, q.to);
  }

  @Get('revenue')
  revenue(@Query() q: RevenueQueryDto) {
    return this.statsService.getRevenue(q.period, q.from, q.to, q.groupBy);
  }

  @Get('top-items')
  topItems(@Query() q: TopItemsQueryDto) {
    return this.statsService.getTopItems(q.period, q.from, q.to, q.limit);
  }

  @Get('orders-by-status')
  ordersByStatus() {
    return this.statsService.getOrdersByStatus();
  }

  @Get('retention')
  retention() {
    return this.statsService.getRetention();
  }

  @Get('revenue-by-category')
  revenueByCategory(@Query() q: StatsPeriodDto) {
    return this.statsService.getRevenueByCategory(q.period, q.from, q.to);
  }
}
