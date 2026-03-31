import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  category_id: number;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  price: number;

  @Column({ length: 255, nullable: true })
  image: string;

  @Column({ type: 'tinyint', default: 1 })
  is_available: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Category, (cat) => cat.menu_items, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category;
}
