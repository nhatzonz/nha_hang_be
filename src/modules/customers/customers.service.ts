import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { buildSearchWhere } from '../../common/utils/search.util';
import { computeCustomerGroup, groupOrdersRange } from './customer-group.util';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async findAll(query: QueryCustomersDto) {
    const { search, group, sort, page = 1, limit = 20 } = query;
    const qb = this.customerRepo.createQueryBuilder('c');

    if (search) {
      const { sql, params } = buildSearchWhere(
        ['c.full_name', 'c.phone', 'c.email'],
        search,
      );
      qb.andWhere(sql, params);
    }

    if (group) {
      const { min, max } = groupOrdersRange(group);
      qb.andWhere('c.total_orders >= :min', { min });
      if (max !== null) qb.andWhere('c.total_orders <= :max', { max });
    }

    if (sort === 'az') qb.orderBy('c.full_name', 'ASC');
    else if (sort === 'za') qb.orderBy('c.full_name', 'DESC');
    else qb.orderBy('c.created_at', 'DESC');

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((c) => ({
        ...c,
        customer_group: computeCustomerGroup(c.total_orders),
      })),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    return { ...customer, customer_group: computeCustomerGroup(customer.total_orders) };
  }

  /**
   * Tìm chính xác khách theo SĐT (unique lookup).
   * Trả null nếu không có - không throw.
   */
  async findByPhone(phone: string) {
    if (!phone) return null;
    const customer = await this.customerRepo.findOne({ where: { phone } });
    return customer || null;
  }

  async create(dto: CreateCustomerDto) {
    const customer = this.customerRepo.create(dto);
    return this.customerRepo.save(customer);
  }

  async update(id: number, dto: UpdateCustomerDto) {
    const customer = await this.findOne(id);
    Object.assign(customer, dto);
    return this.customerRepo.save(customer);
  }

  async remove(id: number) {
    const customer = await this.findOne(id);
    await this.customerRepo.remove(customer);
    return { message: 'Đã xoá khách hàng thành công' };
  }
}
