import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { MenuItem } from '../menu/menu-item.entity';

@Entity('order_details')
export class OrderDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order_id: number;

  @Column({ nullable: true })
  menu_item_id: number;

  @Column({ default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  unit_price: number;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  subtotal: number;

  @Column({ length: 255, nullable: true })
  note: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Order, (order) => order.order_details, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => MenuItem, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'menu_item_id' })
  menu_item: MenuItem;
}
