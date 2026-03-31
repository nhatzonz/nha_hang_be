import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order_id: number;

  @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['cash', 'card', 'bank_transfer', 'e_wallet'],
    default: 'cash',
  })
  payment_method: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  })
  status: string;

  @Column({ length: 50, nullable: true, unique: true })
  transaction_code: string;

  @Column({ length: 100, nullable: true })
  transfer_content: string;

  @Column({ length: 100, nullable: true })
  bank_transaction_id: string;

  @Column({ type: 'text', nullable: true })
  qr_data: string;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  expired_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
