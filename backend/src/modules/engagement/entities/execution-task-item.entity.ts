import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('execution_task_items')
export class ExecutionTaskItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId!: number;

  @Column({ name: 'recommendation_id', type: 'int', nullable: true })
  recommendationId!: number | null;

  @Column({ name: 'subject_type', type: 'varchar', length: 30 })
  subjectType!: string;

  @Column({ name: 'subject_id', type: 'int' })
  subjectId!: number;

  @Column({ name: 'merchant_id', type: 'int', nullable: true })
  merchantId!: number | null;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId!: number | null;

  @Column({ name: 'business_type', type: 'varchar', length: 50, nullable: true })
  businessType!: string | null;

  @Column({ name: 'business_id', type: 'varchar', length: 100, nullable: true })
  businessId!: string | null;

  @Column({ name: 'script_template_id', type: 'int', nullable: true })
  scriptTemplateId!: number | null;

  @Column({ name: 'evidence_status', type: 'varchar', length: 20, nullable: true })
  evidenceStatus!: string | null;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: '0.0000' })
  confidenceScore!: string;

  @Column({ name: 'matched_rule', type: 'varchar', length: 100, nullable: true })
  matchedRule!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'pending_confirmation' })
  status!: string;

  @Column({ name: 'assigned_to', type: 'int', nullable: true })
  assignedTo!: number | null;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'skipped_by', type: 'int', nullable: true })
  skippedBy!: number | null;

  @Column({ name: 'skipped_at', type: 'datetime', nullable: true })
  skippedAt!: Date | null;

  @Column({ name: 'skip_reason', type: 'varchar', length: 255, nullable: true })
  skipReason!: string | null;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
