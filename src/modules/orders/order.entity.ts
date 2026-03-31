import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Table } from '../tables/table.entity';
import { Customer } from '../customers/customer.entity';
import { User } from '../users/user.entity';
import { OrderDetail } from './order-detail.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 30, unique: true })
  order_code: string;

  @Column({ nullable: true })
  table_id: number;

  @Column({ nullable: true })
  customer_id: number;

  @Column({ nullable: true })
  staff_id: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'preparing', 'served', 'completed', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
  total_amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
  discount_amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
  final_amount: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ length: 255, nullable: true })
  cancelled_reason: string;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Table, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'table_id' })
  table: Table;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'staff_id' })
  staff: User;

  @OneToMany(() => OrderDetail, (detail) => detail.order)
  order_details: OrderDetail[];
}
