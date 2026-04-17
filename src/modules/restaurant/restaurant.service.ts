import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantInfo } from './restaurant-info.entity';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(RestaurantInfo)
    private readonly restaurantRepo: Repository<RestaurantInfo>,
  ) {}

  async getInfo(): Promise<RestaurantInfo | null> {
    return this.restaurantRepo.findOne({ where: {}, order: { id: 'ASC' } });
  }

  async update(dto: UpdateRestaurantDto) {
    let info = await this.restaurantRepo.findOne({ where: {}, order: { id: 'ASC' } });
    if (!info) {
      // Nếu chưa có bản ghi thì tạo mới
      info = this.restaurantRepo.create({ name: dto.name || 'Nhà hàng', ...dto });
      return this.restaurantRepo.save(info);
    }
    Object.assign(info, dto);
    return this.restaurantRepo.save(info);
  }
}
