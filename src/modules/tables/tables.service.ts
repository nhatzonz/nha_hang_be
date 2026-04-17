import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table } from './table.entity';
import { Reservation } from '../reservations/reservation.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
  ) {}

  async findAll(status?: string, includeUpcoming = false) {
    const qb = this.tableRepo.createQueryBuilder('t');
    if (status) {
      qb.where('t.status = :status', { status });
    }
    qb.orderBy('t.name', 'ASC');
    const tables = await qb.getMany();

    if (!includeUpcoming) return tables;

    // Lấy reservations trong 24h tới (pending/confirmed) gán cho bàn
    const now = new Date();
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const reservations = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.status IN (:...statuses)', { statuses: ['pending', 'confirmed'] })
      .andWhere('r.reservation_date BETWEEN :from AND :to', {
        from: toDateStr(now),
        to: toDateStr(end),
      })
      .andWhere('r.table_id IS NOT NULL')
      .orderBy('r.reservation_date', 'ASC')
      .addOrderBy('r.reservation_time', 'ASC')
      .getMany();

    // Lọc bỏ reservation đã quá giờ 30 phút
    const upcoming = reservations.filter((r) => {
      const dt = new Date(`${r.reservation_date}T${r.reservation_time}`);
      return dt.getTime() >= now.getTime() - 30 * 60 * 1000;
    });

    const byTable = new Map<number, Reservation[]>();
    for (const r of upcoming) {
      if (!r.table_id) continue;
      if (!byTable.has(r.table_id)) byTable.set(r.table_id, []);
      byTable.get(r.table_id)!.push(r);
    }

    return tables.map((t) => ({
      ...t,
      upcoming_reservations: byTable.get(t.id) || [],
    })) as any;
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
