import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { MenuItem } from './menu-item.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepo: Repository<MenuItem>,
  ) {}

  async findAll() {
    return this.categoryRepo.find({
      order: { created_at: 'ASC' },
    });
  }

  async findOne(id: number) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.categoryRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Tên danh mục đã tồn tại');

    const category = this.categoryRepo.create({
      ...dto,
      is_active: dto.is_active ?? 1,
    });
    return this.categoryRepo.save(category);
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (dto.name && dto.name !== category.name) {
      const duplicate = await this.categoryRepo.findOne({ where: { name: dto.name } });
      if (duplicate) throw new ConflictException('Tên danh mục đã tồn tại');
    }

    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async remove(id: number) {
    const category = await this.findOne(id);

    // Đếm món ăn đang thuộc danh mục này
    const itemCount = await this.menuItemRepo.count({ where: { category_id: id } });
    if (itemCount > 0) {
      throw new ConflictException(
        `Không thể xoá danh mục đang chứa ${itemCount} món ăn. Vui lòng chuyển hoặc xoá các món trước.`,
      );
    }

    await this.categoryRepo.remove(category);
    return { message: 'Đã xoá danh mục thành công' };
  }
}
