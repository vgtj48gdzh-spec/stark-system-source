import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_leads')
export class PlatformLead {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  platform!: string;

  @Column({ name: 'account_id', type: 'varchar', length: 100 })
  accountId!: string;

  @Column({ name: 'lead_ref', type: 'varchar', length: 100 })
  leadRef!: string;

  @Column({ name: 'campaign_id', type: 'varchar', length: 100, nullable: true })
  campaignId!: string | null;

  @Column({ name: 'content_id', type: 'varchar', length: 100, nullable: true })
  contentId!: string | null;

  @Column({ name: 'interaction_id', type: 'int', nullable: true })
  interactionId!: number | null;

  @Column({ name: 'lead_type', type: 'varchar', length: 50, nullable: true })
  leadType!: string | null;

  @Column({ name: 'lead_status', type: 'varchar', length: 20 })
  leadStatus!: string;

  @Column({ name: 'lead_value', type: 'varchar', length: 255, nullable: true })
  leadValue!: string | null;

  @Column({ name: 'source_user_ref', type: 'varchar', length: 100, nullable: true })
  sourceUserRef!: string | null;

  @Column({ name: 'source_session_ref', type: 'varchar', length: 100, nullable: true })
  sourceSessionRef!: string | null;

  @Column({ name: 'source_contact_ref', type: 'varchar', length: 100, nullable: true })
  sourceContactRef!: string | null;

  @Column({ name: 'subject_type', type: 'varchar', length: 30, nullable: true })
  subjectType!: string | null;

  @Column({ name: 'subject_id', type: 'int', nullable: true })
  subjectId!: number | null;

  @Column({ name: 'merchant_id', type: 'int', nullable: true })
  merchantId!: number | null;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId!: number | null;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId!: number | null;

  @Column({ name: 'linked_business_type', type: 'varchar', length: 50, nullable: true })
  linkedBusinessType!: string | null;

  @Column({ name: 'linked_business_id', type: 'varchar', length: 100, nullable: true })
  linkedBusinessId!: string | null;

  @Column({ name: 'attribution_status', type: 'varchar', length: 20, default: 'unknown' })
  attributionStatus!: string;

  @Column({ name: 'evidence_status', type: 'varchar', length: 20, default: 'uncertain' })
  evidenceStatus!: string;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: '0.0000' })
  confidenceScore!: string;

  @Column({ name: 'rule_code', type: 'varchar', length: 100, nullable: true })
  ruleCode!: string | null;

  @Column({ name: 'matched_fields', type: 'json', nullable: true })
  matchedFields!: Record<string, unknown> | null;

  @Column({ name: 'source_file', type: 'varchar', length: 255, nullable: true })
  sourceFile!: string | null;

  @Column({ name: 'import_batch_id', type: 'int', nullable: true })
  importBatchId!: number | null;

  @Column({ name: 'linked_memory_entry_id', type: 'int', nullable: true })
  linkedMemoryEntryId!: number | null;

  @Column({ name: 'linked_recommendation_id', type: 'int', nullable: true })
  linkedRecommendationId!: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
