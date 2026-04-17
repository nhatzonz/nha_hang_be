import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DateRangeDto,
  SingleDateDto,
  TopCustomersDto,
} from './dto/reports-query.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue-by-hour')
  revenueByHour(@Query() q: SingleDateDto) {
    return this.reportsService.revenueByHour(q.date);
  }

  @Get('revenue-by-weekday')
  revenueByWeekday(@Query() q: DateRangeDto) {
    return this.reportsService.revenueByWeekday(q.from, q.to);
  }

  @Get('revenue-by-staff')
  revenueByStaff(@Query() q: DateRangeDto) {
    return this.reportsService.revenueByStaff(q.from, q.to);
  }

  @Get('menu-performance')
  menuPerformance(@Query() q: DateRangeDto) {
    return this.reportsService.menuPerformance(q.from, q.to);
  }

  @Get('top-customers')
  topCustomers(@Query() q: TopCustomersDto) {
    return this.reportsService.topCustomers(q.from, q.to, q.limit);
  }

  @Get('customer-segmentation')
  customerSegmentation(@Query() q: DateRangeDto) {
    return this.reportsService.customerSegmentation(q.from, q.to);
  }

  @Get('cancellation-analysis')
  cancellationAnalysis(@Query() q: DateRangeDto) {
    return this.reportsService.cancellationAnalysis(q.from, q.to);
  }
}
