import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatLog } from '../chat/chat-log.entity';
import { Order } from '../orders/order.entity';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { MenuModule } from '../menu/menu.module';
import { TablesModule } from '../tables/tables.module';
import { CustomersModule } from '../customers/customers.module';
import { OrdersModule } from '../orders/orders.module';
import { StatisticsModule } from '../statistics/statistics.module';
import { RestaurantModule } from '../restaurant/restaurant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatLog, Order]),
    MenuModule,
    TablesModule,
    CustomersModule,
    OrdersModule,
    StatisticsModule,
    RestaurantModule,
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
