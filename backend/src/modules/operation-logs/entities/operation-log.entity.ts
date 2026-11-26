import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('operation_logs')
@Index('idx_operation_logs_module_target_action_id', [
  'module',
  'targetId',
  'action',
  'id',
])
export class OperationLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  module!: string;

  @Column({ name: 'target_id' })
  targetId!: number;

  @Column({ type: 'varchar', length: 50 })
  action!: string;

  @Column({ name: 'operator_id', type: 'int', nullable: true })
  operatorId!: number | null;

  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: ['human', 'system'],
    default: 'human',
  })
  actorType!: 'human' | 'system';

  @Column({ name: 'actor_ref', type: 'varchar', length: 100, nullable: true })
  actorRef!: string | null;

  @Column({ type: 'text', nullable: true })
  detail!: string | null;

  @Column({ name: 'detail_json', type: 'json', nullable: true })
  detailJson!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.operationLogs, { nullable: true })
  @JoinColumn({ name: 'operator_id' })
  operator!: User | null;
}
