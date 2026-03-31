import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Table } from '../tables/table.entity';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  customer_name: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ nullable: true })
  table_id: number;

  @Column({ type: 'date' })
  reservation_date: string;

  @Column({ type: 'time' })
  reservation_time: string;

  @Column({ default: 2 })
  guest_count: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Table, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'table_id' })
  table: Table;
}
