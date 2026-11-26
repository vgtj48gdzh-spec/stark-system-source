import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('ai_action_states')
export class AiActionState {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'action_id', type: 'varchar', length: 191 })
  actionId!: string;

  @Column({ name: 'source_key', type: 'varchar', length: 191, nullable: true })
  sourceKey!: string | null;

  @Column({ name: 'task_type', type: 'varchar', length: 64 })
  taskType!: string;

  @Column({ name: 'owner_role', type: 'varchar', length: 64 })
  ownerRole!: string;

  @Column({ name: 'processing_status', type: 'varchar', length: 32 })
  processingStatus!: string;

  @Column({ name: 'defer_until', type: 'datetime', nullable: true })
  deferUntil!: Date | null;

  @Column({ name: 'defer_reason', type: 'varchar', length: 200, nullable: true })
  deferReason!: string | null;

  @Column({ name: 'marked_by', type: 'int' })
  markedBy!: number;

  @Column({ name: 'marked_by_name', type: 'varchar', length: 120, nullable: true })
  markedByName!: string | null;

  @CreateDateColumn({ name: 'marked_at' })
  markedAt!: Date;

  @Column({ name: 'reopen_at', type: 'datetime', nullable: true })
  reopenAt!: Date | null;

  @Column({ name: 'status_remark', type: 'varchar', length: 500, nullable: true })
  statusRemark!: string | null;

  @Column({ name: 'time_bucket', type: 'varchar', length: 32, nullable: true })
  timeBucket!: string | null;

  @Column({ name: 'bucket_label', type: 'varchar', length: 60, nullable: true })
  bucketLabel!: string | null;

  @Column({ name: 'time_anchor_type', type: 'varchar', length: 64, nullable: true })
  timeAnchorType!: string | null;

  @Column({ name: 'time_anchor_date', type: 'datetime', nullable: true })
  timeAnchorDate!: Date | null;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'marked_by' })
  markedByUser!: User;
}
