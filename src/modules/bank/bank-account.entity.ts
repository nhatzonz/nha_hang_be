import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('bank_accounts')
export class BankAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  bank_name: string;

  @Column({ length: 10 })
  bank_bin: string;

  @Column({ length: 30 })
  account_number: string;

  @Column({ length: 100 })
  account_name: string;

  @Column({ length: 255, nullable: true })
  bank_logo: string;

  @Column({ type: 'tinyint', default: 0 })
  is_active: number;

  @Column({ nullable: true })
  created_by: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;
}
