import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { MenuItem } from './menu-item.entity';
import { Category } from './category.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { QueryMenuDto } from './dto/query-menu.dto';
import { buildSearchWhere } from '../../common/utils/search.util';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuRepo: Repository<MenuItem>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  private async validateCategory(categoryId?: number) {
    if (!categoryId) return;
    const category = await this.categoryRepo.findOne({ where: { id: categoryId } });
    if (!category) throw new BadRequestException('Danh mục không tồn tại');
  }

  private deleteImageFile(imagePath?: string | null) {
    if (!imagePath) return;
    // imagePath dạng "uploads/menu/abc.jpg" -> resolve từ project root
    const fullPath = path.join(process.cwd(), imagePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // Ignore nếu xoá không được (ví dụ đang bị lock)
      }
    }
  }

  async findAll(query: QueryMenuDto) {
    const { search, category_id, is_available, page = 1, limit = 20 } = query;
    const qb = this.menuRepo.createQueryBuilder('m')
      .leftJoinAndSelect('m.category', 'category');

    if (search) {
      const { sql, params } = buildSearchWhere(['m.name', 'm.description'], search);
      qb.andWhere(`(${sql})`, params);
    }
    if (category_id) {
      qb.andWhere('m.category_id = :cid', { cid: category_id });
    }
    if (is_available !== undefined) {
      qb.andWhere('m.is_available = :a', { a: is_available });
    }

    qb.orderBy('m.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const item = await this.menuRepo.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!item) throw new NotFoundException('Không tìm thấy món');
    return item;
  }

  async create(dto: CreateMenuItemDto, imagePath?: string) {
    await this.validateCategory(dto.category_id);

    const item = this.menuRepo.create({
      ...dto,
      image: imagePath,
      is_available: dto.is_available ?? 1,
    });
    return this.menuRepo.save(item);
  }

  async update(id: number, dto: UpdateMenuItemDto, imagePath?: string) {
    const item = await this.findOne(id);
    await this.validateCategory(dto.category_id);

    const oldImage = item.image;

    Object.assign(item, dto);
    if (imagePath) {
      item.image = imagePath;
    }

    const saved = await this.menuRepo.save(item);

    // Xoá ảnh cũ sau khi save thành công
    if (imagePath && oldImage && oldImage !== imagePath) {
      this.deleteImageFile(oldImage);
    }

    return saved;
  }

  async remove(id: number) {
    const item = await this.findOne(id);
    this.deleteImageFile(item.image);
    await this.menuRepo.remove(item);
    return { message: 'Đã xoá món thành công' };
  }
}
