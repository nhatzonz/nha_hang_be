import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderDetail } from './order-detail.entity';
import { Table } from '../tables/table.entity';
import { Customer } from '../customers/customer.entity';
import { MenuItem } from '../menu/menu-item.entity';
import { Reservation } from '../reservations/reservation.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderDetail, Table, Customer, MenuItem, Reservation])],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
