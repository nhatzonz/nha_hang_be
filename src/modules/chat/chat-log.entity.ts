import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('chat_logs')
export class ChatLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  session_id: string;

  @Column({ type: 'text' })
  user_message: string;

  @Column({ type: 'text' })
  bot_response: string;

  @Column({ length: 50, nullable: true })
  intent: string;

  @Column({ nullable: true })
  user_id: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
