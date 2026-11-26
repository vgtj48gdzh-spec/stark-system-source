import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlatformInteraction } from './platform-interaction.entity';

@Entity('lead_candidates')
export class LeadCandidate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'interaction_id', type: 'int' })
  interactionId!: number;

  @Column({ type: 'varchar', length: 50 })
  platform!: string;

  @Column({ name: 'account_id', type: 'varchar', length: 100 })
  accountId!: string;

  @Column({ name: 'content_id', type: 'varchar', length: 100, nullable: true })
  contentId!: string | null;

  @Column({ name: 'campaign_id', type: 'varchar', length: 100, nullable: true })
  campaignId!: string | null;

  @Column({ name: 'candidate_type', type: 'varchar', length: 30 })
  candidateType!: string;

  @Column({ name: 'candidate_ref', type: 'varchar', length: 100, nullable: true })
  candidateRef!: string | null;

  @Column({ name: 'merchant_id', type: 'int', nullable: true })
  merchantId!: number | null;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId!: number | null;

  @Column({ name: 'linked_subject_type', type: 'varchar', length: 30, nullable: true })
  linkedSubjectType!: string | null;

  @Column({ name: 'linked_subject_id', type: 'int', nullable: true })
  linkedSubjectId!: number | null;

  @Column({ name: 'linked_business_type', type: 'varchar', length: 50, nullable: true })
  linkedBusinessType!: string | null;

  @Column({ name: 'linked_business_id', type: 'varchar', length: 100, nullable: true })
  linkedBusinessId!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ name: 'evidence_status', type: 'varchar', length: 20 })
  evidenceStatus!: string;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, default: '0.0000' })
  confidenceScore!: string;

  @Column({ name: 'rule_code', type: 'varchar', length: 50, nullable: true })
  ruleCode!: string | null;

  @Column({ name: 'matched_fields', type: 'json' })
  matchedFields!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => PlatformInteraction)
  @JoinColumn({ name: 'interaction_id' })
  interaction!: PlatformInteraction;
}
