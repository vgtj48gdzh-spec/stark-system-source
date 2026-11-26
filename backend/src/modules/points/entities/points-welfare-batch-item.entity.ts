import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PointsWelfareBatchItemAllocationMode =
  | 'default'
  | 'custom'
  | 'hold'
  | 'excluded';

export type PointsWelfareBatchItemBasisType = 'manual' | 'ai_suggested' | 'rule';

@Entity('points_welfare_batch_items')
@Index('idx_points_welfare_batch_item_batch_mode', ['batchId', 'allocationMode'])
@Index('idx_points_welfare_batch_item_employee', ['employeeId'])
export class PointsWelfareBatchItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'batch_id', type: 'int' })
  batchId!: number;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId!: number | null;

  @Column({ name: 'command_id', type: 'int', nullable: true })
  commandId!: number | null;

  @Column({ name: 'employee_name_snapshot', type: 'varchar', length: 100 })
  employeeNameSnapshot!: string;

  @Column({ name: 'employee_mobile_snapshot', type: 'varchar', length: 32, nullable: true })
  employeeMobileSnapshot!: string | null;

  @Column({ name: 'company_name_snapshot', type: 'varchar', length: 150, nullable: true })
  companyNameSnapshot!: string | null;

  @Column({ name: 'position_name_snapshot', type: 'varchar', length: 150, nullable: true })
  positionNameSnapshot!: string | null;

  @Column({ name: 'allocation_mode', type: 'varchar', length: 32 })
  allocationMode!: PointsWelfareBatchItemAllocationMode;

  @Column({ name: 'default_amount', type: 'decimal', precision: 18, scale: 2, default: 0 })
  defaultAmount!: string;

  @Column({ name: 'final_amount', type: 'decimal', precision: 18, scale: 2, default: 0 })
  finalAmount!: string;

  @Column({ name: 'exclusion_reason', type: 'varchar', length: 64, nullable: true })
  exclusionReason!: string | null;

  @Column({ name: 'adjustment_reason_code', type: 'varchar', length: 100, nullable: true })
  adjustmentReasonCode!: string | null;

  @Column({ name: 'adjustment_remark', type: 'varchar', length: 500, nullable: true })
  adjustmentRemark!: string | null;

  @Column({ name: 'basis_type', type: 'varchar', length: 32, nullable: true })
  basisType!: PointsWelfareBatchItemBasisType | null;

  @Column({ name: 'decision_scope', type: 'varchar', length: 32, nullable: true })
  decisionScope!: string | null;

  @Column({ name: 'ai_learning_mode', type: 'varchar', length: 64, nullable: true })
  aiLearningMode!: string | null;

  @Column({ name: 'decided_by', type: 'int', nullable: true })
  decidedBy!: number | null;

  @Column({ name: 'decided_at', type: 'datetime', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;
}
