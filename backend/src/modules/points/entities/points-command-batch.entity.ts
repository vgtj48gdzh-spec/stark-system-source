import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PointsCommandBatchType = 'employee_monthly_welfare';
export type PointsCommandBatchStatus =
  | 'drafted'
  | 'confirmed'
  | 'executed'
  | 'cancelled'
  | 'partially_executed';

@Entity('points_command_batches')
@Index('idx_points_batch_status_period', ['batchStatus', 'periodKey'])
export class PointsCommandBatch {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'batch_type', type: 'varchar', length: 64 })
  batchType!: PointsCommandBatchType;

  @Column({ name: 'period_key', type: 'varchar', length: 20 })
  periodKey!: string;

  @Column({ name: 'company_id', type: 'int', nullable: true })
  companyId!: number | null;

  @Column({ name: 'target_employee_count', type: 'int', default: 0 })
  targetEmployeeCount!: number;

  @Column({ name: 'target_total_amount', type: 'decimal', precision: 18, scale: 2, default: 0 })
  targetTotalAmount!: string;

  @Column({ name: 'batch_status', type: 'varchar', length: 32, default: 'drafted' })
  batchStatus!: PointsCommandBatchStatus;

  @Column({ name: 'source_type', type: 'varchar', length: 64 })
  sourceType!: string;

  @Column({ name: 'requested_by', type: 'int', nullable: true })
  requestedBy!: number | null;

  @Column({ name: 'requested_by_name', type: 'varchar', length: 100, nullable: true })
  requestedByName!: string | null;

  @Column({ name: 'requested_at', type: 'datetime', nullable: true })
  requestedAt!: Date | null;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'confirmed_by_name', type: 'varchar', length: 100, nullable: true })
  confirmedByName!: string | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'executed_by', type: 'int', nullable: true })
  executedBy!: number | null;

  @Column({ name: 'executed_by_name', type: 'varchar', length: 100, nullable: true })
  executedByName!: string | null;

  @Column({ name: 'executed_at', type: 'datetime', nullable: true })
  executedAt!: Date | null;

  @Column({ name: 'cancelled_by', type: 'int', nullable: true })
  cancelledBy!: number | null;

  @Column({ name: 'cancelled_by_name', type: 'varchar', length: 100, nullable: true })
  cancelledByName!: string | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'provider_key', type: 'varchar', length: 100, nullable: true })
  providerKey!: string | null;

  @Column({ name: 'source_action_id', type: 'varchar', length: 150, nullable: true })
  sourceActionId!: string | null;

  @Column({ name: 'thread_key', type: 'varchar', length: 150, nullable: true })
  threadKey!: string | null;

  @Column({ name: 'remark', type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;
}
