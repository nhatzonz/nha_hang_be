import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantInfo } from './restaurant-info.entity';

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(RestaurantInfo)
    private readonly restaurantRepo: Repository<RestaurantInfo>,
  ) {}

  async getInfo(): Promise<RestaurantInfo | null> {
    return this.restaurantRepo.findOne({ where: {}, order: { id: 'ASC' } });
  }
}
