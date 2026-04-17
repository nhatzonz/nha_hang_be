import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { OrderDetail } from '../orders/order-detail.entity';
import { MenuItem } from '../menu/menu-item.entity';
import { Customer } from '../customers/customer.entity';
import { User } from '../users/user.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderDetail, MenuItem, Customer, User])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
