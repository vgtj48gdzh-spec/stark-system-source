import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('execution_results')
export class ExecutionResult {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId!: number;

  @Column({ name: 'task_item_id', type: 'int' })
  taskItemId!: number;

  @Column({ name: 'recommendation_id', type: 'int', nullable: true })
  recommendationId!: number | null;

  @Column({ name: 'followup_feedback_id', type: 'int', nullable: true })
  followupFeedbackId!: number | null;

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

  @Column({ name: 'executed_at', type: 'datetime' })
  executedAt!: Date;

  @Column({ name: 'executed_by', type: 'int' })
  executedBy!: number;

  @Column({ name: 'replied_flag', type: 'tinyint', width: 1, default: 0 })
  repliedFlag!: boolean;

  @Column({ name: 'converted_flag', type: 'tinyint', width: 1, default: 0 })
  convertedFlag!: boolean;

  @Column({ name: 'non_conversion_reason', type: 'varchar', length: 255, nullable: true })
  nonConversionReason!: string | null;

  @Column({ name: 'result_status', type: 'varchar', length: 20, default: 'recorded' })
  resultStatus!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
