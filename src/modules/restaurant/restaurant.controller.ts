import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  // Public — lấy thông tin nhà hàng (hiện trên login page, hoá đơn...)
  @Get('info')
  getInfo() {
    return this.restaurantService.getInfo();
  }

  // Admin only — sửa thông tin nhà hàng
  @Patch('info')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Body() dto: UpdateRestaurantDto) {
    return this.restaurantService.update(dto);
  }
}
