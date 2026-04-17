import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table } from './table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
  ) {}

  async findAll(status?: string) {
    const qb = this.tableRepo.createQueryBuilder('t');
    if (status) {
      qb.where('t.status = :status', { status });
    }
    qb.orderBy('t.name', 'ASC');
    return qb.getMany();
  }

  async findOne(id: number) {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException('Không tìm thấy bàn');
    return table;
  }

  async create(dto: CreateTableDto) {
    const existing = await this.tableRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Tên bàn đã tồn tại');

    const table = this.tableRepo.create({
      ...dto,
      status: dto.status || 'available',
    });
    return this.tableRepo.save(table);
  }

  async update(id: number, dto: UpdateTableDto) {
    const table = await this.findOne(id);

    if (dto.name && dto.name !== table.name) {
      const duplicate = await this.tableRepo.findOne({ where: { name: dto.name } });
      if (duplicate) throw new ConflictException('Tên bàn đã tồn tại');
    }

    Object.assign(table, dto);
    return this.tableRepo.save(table);
  }

  async updateStatus(id: number, status: string) {
    return this.update(id, { status: status as any });
  }

  async remove(id: number) {
    const table = await this.findOne(id);

    if (table.status === 'occupied') {
      throw new ConflictException('Không thể xoá bàn đang có khách');
    }

    await this.tableRepo.remove(table);
    return { message: 'Đã xoá bàn thành công' };
  }
}
