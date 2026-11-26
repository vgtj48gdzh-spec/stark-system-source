import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('followup_feedback')
export class FollowupFeedback {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'recommendation_id', type: 'int', nullable: true })
  recommendationId!: number | null;

  @Column({ name: 'recommendation_rule_id', type: 'int', nullable: true })
  recommendationRuleId!: number | null;

  @Column({ name: 'script_template_id', type: 'int', nullable: true })
  scriptTemplateId!: number | null;

  @Column({ name: 'script_experiment_id', type: 'int', nullable: true })
  scriptExperimentId!: number | null;

  @Column({ name: 'script_experiment_result_id', type: 'int', nullable: true })
  scriptExperimentResultId!: number | null;

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

  @Column({ name: 'followed_up_flag', type: 'tinyint', width: 1, default: 0 })
  followedUpFlag!: boolean;

  @Column({ name: 'followup_at', type: 'datetime', nullable: true })
  followupAt!: Date | null;

  @Column({ name: 'customer_replied_flag', type: 'tinyint', width: 1, default: 0 })
  customerRepliedFlag!: boolean;

  @Column({ name: 'converted_flag', type: 'tinyint', width: 1, default: 0 })
  convertedFlag!: boolean;

  @Column({ name: 'non_conversion_reason', type: 'varchar', length: 255, nullable: true })
  nonConversionReason!: string | null;

  @Column({ name: 'employee_remark', type: 'varchar', length: 500, nullable: true })
  employeeRemark!: string | null;

  @Column({ name: 'feedback_status', type: 'varchar', length: 20, default: 'recorded' })
  feedbackStatus!: string;

  @Column({ name: 'normalized_payload', type: 'json', nullable: true })
  normalizedPayload!: Record<string, unknown> | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
