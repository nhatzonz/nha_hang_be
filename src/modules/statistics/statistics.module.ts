import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { OrderDetail } from '../orders/order-detail.entity';
import { Customer } from '../customers/customer.entity';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderDetail, Customer])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
