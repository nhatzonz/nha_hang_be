import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In, Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrderDetail } from './order-detail.entity';
import { Table } from '../tables/table.entity';
import { Customer } from '../customers/customer.entity';
import { MenuItem } from '../menu/menu-item.entity';
import { Reservation } from '../reservations/reservation.entity';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { AddItemsDto } from './dto/add-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { generateOrderCode } from './order-code.util';
import {
  OrderStatus,
  canTransitionOrderStatus,
  isTerminalStatus,
} from './order-state.util';
import { buildSearchWhere } from '../../common/utils/search.util';

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
  ) {}

  /**
   * Strip password khỏi staff relation để không lộ ra response.
   */
  private sanitize(order: Order): Order {
    if (order.staff) {
      const { password, ...staff } = order.staff;
      order.staff = staff as any;
    }
    return order;
  }

  /**
   * Fetch order kèm đầy đủ relations (để trả về client).
   */
  async findOne(id: number): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: [
        'table',
        'customer',
        'staff',
        'order_details',
        'order_details.menu_item',
      ],
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return this.sanitize(order);
  }

  async findAll(query: QueryOrdersDto) {
    const {
      search,
      status,
      table_id,
      customer_id,
      from_date,
      to_date,
      page = 1,
      limit = 20,
    } = query;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.table', 'table')
      .leftJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.staff', 'staff');

    if (search) {
      const { sql, params } = buildSearchWhere(['o.order_code'], search);
      qb.andWhere(sql, params);
    }
    if (status) qb.andWhere('o.status = :status', { status });
    if (table_id) qb.andWhere('o.table_id = :tid', { tid: table_id });
    if (customer_id) qb.andWhere('o.customer_id = :cid', { cid: customer_id });
    if (from_date && to_date) {
      qb.andWhere('o.created_at BETWEEN :from AND :to', {
        from: new Date(from_date),
        to: new Date(to_date),
      });
    } else if (from_date) {
      qb.andWhere('o.created_at >= :from', { from: new Date(from_date) });
    } else if (to_date) {
      qb.andWhere('o.created_at <= :to', { to: new Date(to_date) });
    }

    qb.orderBy('o.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((o) => this.sanitize(o)),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Xác thực và fetch menu items, đồng thời build order_details.
   * Snapshot unit_price từ menu.price hiện tại.
   */
  private async buildOrderDetails(
    manager: EntityManager,
    items: CreateOrderItemDto[],
  ): Promise<{ details: Partial<OrderDetail>[]; total: number }> {
    const ids = Array.from(new Set(items.map((i) => i.menu_item_id)));
    const menuItems = await manager.find(MenuItem, { where: { id: In(ids) } });

    if (menuItems.length !== ids.length) {
      throw new BadRequestException('Có món không tồn tại trong hệ thống');
    }

    const unavailable = menuItems.filter((m) => !m.is_available);
    if (unavailable.length) {
      const names = unavailable.map((m) => m.name).join(', ');
      throw new BadRequestException(`Món đang tạm hết: ${names}`);
    }

    const menuMap = new Map(menuItems.map((m) => [m.id, m]));
    let total = 0;
    const details = items.map((item) => {
      const menu = menuMap.get(item.menu_item_id)!;
      const unitPrice = Number(menu.price);
      const subtotal = unitPrice * item.quantity;
      total += subtotal;
      return {
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
        note: item.note,
      };
    });

    return { details, total };
  }

  async create(dto: CreateOrderDto, staffId: number) {
    const orderId = await this.dataSource.transaction(async (manager) => {
      // 1. Kiểm tra bàn tồn tại và đang available
      const table = await manager.findOne(Table, { where: { id: dto.table_id } });
      if (!table) throw new NotFoundException('Không tìm thấy bàn');

      // Check active order thay vì table.status — vì bàn có thể occupied do reservation completed
      // mà chưa có order nào (staff sắp tạo ngay)
      const activeOrder = await manager
        .createQueryBuilder(Order, 'o')
        .where('o.table_id = :tid', { tid: table.id })
        .andWhere('o.status IN (:...statuses)', {
          statuses: ['pending', 'preparing', 'served'],
        })
        .getOne();

      if (activeOrder) {
        throw new ConflictException(
          `Bàn "${table.name}" đang có đơn ${activeOrder.order_code} chưa hoàn thành`,
        );
      }

      // 2. Kiểm tra khách (nếu có)
      if (dto.customer_id) {
        const exists = await manager.count(Customer, { where: { id: dto.customer_id } });
        if (!exists) throw new NotFoundException('Không tìm thấy khách hàng');
      }

      // 3. Build order_details với snapshot giá
      const { details, total } = await this.buildOrderDetails(manager, dto.items);

      // 4. Sinh mã đơn
      const order_code = await generateOrderCode(manager);

      // 5. Tạo order + order_details
      const order = manager.create(Order, {
        order_code,
        table_id: dto.table_id,
        customer_id: dto.customer_id,
        staff_id: staffId,
        status: 'pending',
        total_amount: total,
        discount_amount: 0,
        final_amount: total,
        note: dto.note,
      });
      const savedOrder = await manager.save(order);

      // Tạo order_details riêng (vì cascade không được set)
      const detailEntities = details.map((d) =>
        manager.create(OrderDetail, { ...d, order_id: savedOrder.id }),
      );
      await manager.save(detailEntities);

      // 6. Cập nhật bàn sang occupied
      await manager.update(Table, table.id, { status: 'occupied' });

      // 7. Nếu đơn này được tạo từ reservation (khách đặt bàn đã đến)
      // → đánh dấu reservation completed (atomic trong cùng transaction)
      if (dto.reservation_id) {
        const reservation = await manager.findOne(Reservation, {
          where: { id: dto.reservation_id },
        });
        if (reservation && reservation.status !== 'completed' && reservation.status !== 'cancelled') {
          reservation.status = 'completed';
          await manager.save(reservation);
        }
      }

      return savedOrder.id;
    });

    return this.findOne(orderId);
  }

  async update(id: number, dto: UpdateOrderDto) {
    const updatedId = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (isTerminalStatus(order.status as OrderStatus)) {
        throw new BadRequestException('Không thể chỉnh sửa đơn đã hoàn thành hoặc đã huỷ');
      }

      // Kiểm tra customer nếu có
      if (dto.customer_id !== undefined) {
        if (dto.customer_id) {
          const exists = await manager.count(Customer, { where: { id: dto.customer_id } });
          if (!exists) throw new NotFoundException('Không tìm thấy khách hàng');
        }
        order.customer_id = dto.customer_id || (null as any);
      }

      if (dto.note !== undefined) order.note = dto.note || (null as any);

      // Discount
      if (dto.discount_amount !== undefined) {
        if (dto.discount_amount > order.total_amount) {
          throw new BadRequestException('Giảm giá không được lớn hơn tổng tiền');
        }
        order.discount_amount = dto.discount_amount;
      }

      order.final_amount =
        Number(order.total_amount) - Number(order.discount_amount || 0);

      await manager.save(order);
      return id;
    });

    return this.findOne(updatedId);
  }

  async changeStatus(id: number, dto: ChangeStatusDto) {
    const updatedId = await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

      const from = order.status as OrderStatus;
      const to = dto.status as OrderStatus;

      if (from === to) {
        throw new BadRequestException('Đơn hàng đã ở trạng thái này');
      }

      if (!canTransitionOrderStatus(from, to)) {
        throw new BadRequestException(
          `Không thể chuyển trạng thái từ "${from}" sang "${to}"`,
        );
      }

      order.status = to;

      if (to === 'completed') {
        order.completed_at = new Date();
        // Giải phóng bàn
        if (order.table_id) {
          await manager.update(Table, order.table_id, { status: 'available' });
        }
        // Cập nhật stats khách hàng
        if (order.customer_id) {
          await manager.increment(
            Customer,
            { id: order.customer_id },
            'total_orders',
            1,
          );
          await manager.increment(
            Customer,
            { id: order.customer_id },
            'total_spent',
            Number(order.final_amount),
          );
        }
      }

      if (to === 'cancelled') {
        order.cancelled_reason = dto.cancelled_reason || 'Không có lý do';
        // Giải phóng bàn
        if (order.table_id) {
          await manager.update(Table, order.table_id, { status: 'available' });
        }
      }

      await manager.save(order);
      return id;
    });

    return this.findOne(updatedId);
  }

  async remove(id: number) {
    // Huỷ đơn = chuyển sang cancelled (soft cancel)
    // Nếu muốn xoá cứng, chỉ cho phép đơn đã cancelled
    return this.changeStatus(id, { status: 'cancelled', cancelled_reason: 'Xoá bởi nhân viên' });
  }

  /**
   * Tính lại total_amount, final_amount từ order_details hiện có và save.
   */
  private async recalcOrderTotals(manager: EntityManager, orderId: number) {
    const details = await manager.find(OrderDetail, { where: { order_id: orderId } });
    const total = details.reduce((sum, d) => sum + Number(d.subtotal), 0);

    const order = await manager.findOne(Order, { where: { id: orderId } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    order.total_amount = total;
    // Giảm giá không được lớn hơn tổng mới → clamp
    const discount = Math.min(Number(order.discount_amount || 0), total);
    order.discount_amount = discount;
    order.final_amount = total - discount;
    await manager.save(order);
  }

  /**
   * Thêm món vào đơn đang mở. Cho phép ở pending/preparing/served.
   * Snapshot unit_price tại thời điểm thêm.
   */
  async addItems(id: number, dto: AddItemsDto) {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

      const status = order.status as OrderStatus;
      if (status === 'completed' || status === 'cancelled') {
        throw new BadRequestException('Không thể thêm món vào đơn đã kết thúc');
      }

      const { details } = await this.buildOrderDetails(manager, dto.items);
      const entities = details.map((d) =>
        manager.create(OrderDetail, { ...d, order_id: id }),
      );
      await manager.save(entities);

      await this.recalcOrderTotals(manager, id);
    });

    return this.findOne(id);
  }

  /**
   * Sửa số lượng / ghi chú 1 món. Cho phép ở pending/preparing.
   * Không cho phép ở served vì món đã đưa ra bàn.
   */
  async updateItem(orderId: number, detailId: number, dto: UpdateItemDto) {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

      const status = order.status as OrderStatus;
      if (status !== 'pending' && status !== 'preparing') {
        throw new BadRequestException(
          'Chỉ có thể sửa món khi đơn đang chờ xử lý hoặc đang chế biến',
        );
      }

      const detail = await manager.findOne(OrderDetail, {
        where: { id: detailId, order_id: orderId },
      });
      if (!detail) throw new NotFoundException('Không tìm thấy món trong đơn');

      if (dto.quantity !== undefined) {
        detail.quantity = dto.quantity;
        detail.subtotal = Number(detail.unit_price) * dto.quantity;
      }
      if (dto.note !== undefined) detail.note = dto.note || (null as any);

      await manager.save(detail);
      await this.recalcOrderTotals(manager, orderId);
    });

    return this.findOne(orderId);
  }

  /**
   * Xoá 1 món khỏi đơn. Cho phép ở pending/preparing.
   * Nếu xoá món cuối cùng → throw (không được để đơn rỗng).
   */
  async removeItem(orderId: number, detailId: number) {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

      const status = order.status as OrderStatus;
      if (status !== 'pending' && status !== 'preparing') {
        throw new BadRequestException(
          'Chỉ có thể xoá món khi đơn đang chờ xử lý hoặc đang chế biến',
        );
      }

      const detail = await manager.findOne(OrderDetail, {
        where: { id: detailId, order_id: orderId },
      });
      if (!detail) throw new NotFoundException('Không tìm thấy món trong đơn');

      // Không cho xoá món cuối cùng → đơn không được rỗng
      const count = await manager.count(OrderDetail, { where: { order_id: orderId } });
      if (count <= 1) {
        throw new BadRequestException(
          'Không thể xoá món cuối cùng. Hãy huỷ toàn bộ đơn thay vì xoá hết món.',
        );
      }

      await manager.remove(detail);
      await this.recalcOrderTotals(manager, orderId);
    });

    return this.findOne(orderId);
  }
}
