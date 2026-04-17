import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Reservation } from './reservation.entity';
import { Table } from '../tables/table.entity';
import { Customer } from '../customers/customer.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';
import { buildSearchWhere } from '../../common/utils/search.util';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    @InjectRepository(Table) private readonly tableRepo: Repository<Table>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async findAll(query: QueryReservationsDto) {
    const { search, status, from_date, to_date, page = 1, limit = 20 } = query;

    const qb = this.reservationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.table', 'table')
      .leftJoinAndSelect('r.customer', 'customer');

    if (search) {
      const { sql, params } = buildSearchWhere(
        ['r.customer_name', 'r.phone', 'r.email'],
        search,
      );
      qb.andWhere(sql, params);
    }
    if (status) qb.andWhere('r.status = :s', { s: status });
    if (from_date) qb.andWhere('r.reservation_date >= :fd', { fd: from_date });
    if (to_date) qb.andWhere('r.reservation_date <= :td', { td: to_date });

    qb.orderBy('r.reservation_date', 'ASC')
      .addOrderBy('r.reservation_time', 'ASC')
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
    const res = await this.reservationRepo.findOne({
      where: { id },
      relations: ['table', 'customer'],
    });
    if (!res) throw new NotFoundException('Không tìm thấy đặt bàn');
    return res;
  }

  /**
   * Public lookup: trả customer theo SĐT exact, null nếu không có.
   */
  async findCustomerByPhone(phone: string) {
    if (!phone || !/^0[0-9]{9}$/.test(phone)) return null;
    const customer = await this.customerRepo.findOne({ where: { phone } });
    return customer || null;
  }

  async create(dto: CreateReservationDto) {
    // Kiểm tra ngày đặt không nằm trong quá khứ (cùng ngày vẫn OK)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resDate = new Date(dto.reservation_date);
    if (resDate < today) {
      throw new BadRequestException('Ngày đặt bàn không được trong quá khứ');
    }

    if (dto.table_id) {
      const table = await this.tableRepo.findOne({ where: { id: dto.table_id } });
      if (!table) throw new NotFoundException('Không tìm thấy bàn');
      if (dto.guest_count > table.capacity) {
        throw new BadRequestException(
          `Bàn "${table.name}" chỉ chứa tối đa ${table.capacity} người`,
        );
      }
    }

    // Tự động link/tạo customer theo SĐT
    let customerId: number | undefined;
    if (dto.phone) {
      let customer = await this.customerRepo.findOne({ where: { phone: dto.phone } });
      if (!customer) {
        customer = await this.customerRepo.save(
          this.customerRepo.create({
            full_name: dto.customer_name,
            phone: dto.phone,
            email: dto.email,
          }),
        );
      }
      customerId = customer.id;
    }

    const initialStatus = dto.status || 'pending';
    const reservation = this.reservationRepo.create({
      ...dto,
      customer_id: customerId,
      status: initialStatus,
    });
    const saved = await this.reservationRepo.save(reservation);

    // Side effect: nếu tạo đã confirmed + có bàn → block bàn ngay
    if (initialStatus === 'confirmed' && saved.table_id) {
      const table = await this.tableRepo.findOne({ where: { id: saved.table_id } });
      if (table && table.status === 'available') {
        await this.tableRepo.update(table.id, { status: 'reserved' });
      }
    }

    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateReservationDto) {
    const reservation = await this.findOne(id);

    // Terminal: cancelled/completed không cho sửa
    if (reservation.status === 'cancelled' || reservation.status === 'completed') {
      throw new BadRequestException('Không thể chỉnh sửa đặt bàn đã kết thúc');
    }

    if (dto.table_id !== undefined && dto.table_id !== reservation.table_id) {
      if (dto.table_id) {
        const table = await this.tableRepo.findOne({ where: { id: dto.table_id } });
        if (!table) throw new NotFoundException('Không tìm thấy bàn');
      }
    }

    Object.assign(reservation, dto);
    return this.reservationRepo.save(reservation);
  }

  /**
   * Đổi status với side effects rõ ràng:
   * - confirmed: bàn → reserved (đã đặt, chưa có khách)
   * - cancelled: nếu bàn đang reserved → về available
   * - completed (khách đến): bàn → occupied (có khách ngồi)
   */
  async changeStatus(id: number, status: 'pending' | 'confirmed' | 'cancelled' | 'completed') {
    const savedId = await this.dataSource.transaction(async (manager) => {
      const reservation = await manager.findOne(Reservation, {
        where: { id },
      });
      if (!reservation) throw new NotFoundException('Không tìm thấy đặt bàn');

      if (reservation.status === 'cancelled' || reservation.status === 'completed') {
        throw new BadRequestException('Đặt bàn đã kết thúc, không đổi trạng thái được');
      }

      reservation.status = status;
      await manager.save(reservation);

      // Side effects với bàn
      if (reservation.table_id) {
        const table = await manager.findOne(Table, { where: { id: reservation.table_id } });
        if (table) {
          if (status === 'confirmed' && table.status === 'available') {
            // Xác nhận đặt → block bàn sang reserved
            await manager.update(Table, table.id, { status: 'reserved' });
          } else if (status === 'cancelled' && table.status === 'reserved') {
            // Huỷ đặt → trả bàn về available (chỉ nếu đang reserved do đặt này)
            await manager.update(Table, table.id, { status: 'available' });
          } else if (status === 'completed' && table.status !== 'occupied') {
            // Khách đến → bàn có khách
            await manager.update(Table, table.id, { status: 'occupied' });
          }
        }
      }

      return reservation.id;
    });

    return this.findOne(savedId);
  }

  /**
   * Lấy các reservation sắp tới trong N giờ tới (confirmed/pending).
   * Dùng cho FE hiển thị badge trên card bàn.
   */
  async findUpcoming(hours = 24): Promise<Reservation[]> {
    const now = new Date();
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const reservations = await this.reservationRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.table', 'table')
      .where('r.status IN (:...statuses)', { statuses: ['pending', 'confirmed'] })
      .andWhere('r.reservation_date BETWEEN :from AND :to', {
        from: toDateStr(now),
        to: toDateStr(end),
      })
      .andWhere('r.table_id IS NOT NULL')
      .orderBy('r.reservation_date', 'ASC')
      .addOrderBy('r.reservation_time', 'ASC')
      .getMany();

    // Lọc bỏ reservation đã qua giờ
    return reservations.filter((r) => {
      const dt = new Date(`${r.reservation_date}T${r.reservation_time}`);
      return dt.getTime() >= now.getTime() - 30 * 60 * 1000; // giữ lại reservation quá giờ < 30 phút (vẫn đang đợi khách)
    });
  }

  async remove(id: number) {
    // Huỷ mềm thay vì xoá cứng. Xoá cứng chỉ cho phép ở cancelled.
    const reservation = await this.findOne(id);
    if (reservation.status !== 'cancelled') {
      throw new BadRequestException(
        'Chỉ xoá được đặt bàn đã huỷ. Hãy huỷ trước khi xoá.',
      );
    }
    await this.reservationRepo.remove(reservation);
    return { message: 'Đã xoá đặt bàn' };
  }
}
