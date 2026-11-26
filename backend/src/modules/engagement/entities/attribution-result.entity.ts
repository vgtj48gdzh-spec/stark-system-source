import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LeadCandidate } from './lead-candidate.entity';
import { PlatformInteraction } from './platform-interaction.entity';

@Entity('attribution_results')
export class AttributionResult {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'interaction_id', type: 'int' })
  interactionId!: number;

  @Column({ name: 'lead_candidate_id', type: 'int', nullable: true })
  leadCandidateId!: number | null;

  @Column({ name: 'attributed_subject_type', type: 'varchar', length: 30, nullable: true })
  attributedSubjectType!: string | null;

  @Column({ name: 'attributed_subject_id', type: 'int', nullable: true })
  attributedSubjectId!: number | null;

  @Column({ name: 'merchant_id', type: 'int', nullable: true })
  merchantId!: number | null;

  @Column({ name: 'employee_id', type: 'int', nullable: true })
  employeeId!: number | null;

  @Column({ name: 'attributed_business_type', type: 'varchar', length: 50, nullable: true })
  attributedBusinessType!: string | null;

  @Column({ name: 'attributed_business_id', type: 'varchar', length: 100, nullable: true })
  attributedBusinessId!: string | null;

  @Column({ name: 'attribution_status', type: 'varchar', length: 20 })
  attributionStatus!: string;

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

  @Column({ name: 'handled_by', type: 'int', nullable: true })
  handledBy!: number | null;

  @Column({ name: 'handled_at', type: 'datetime', nullable: true })
  handledAt!: Date | null;

  @Column({ name: 'handling_action', type: 'varchar', length: 20, nullable: true })
  handlingAction!: string | null;

  @Column({ name: 'normalized_payload', type: 'json' })
  normalizedPayload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => PlatformInteraction)
  @JoinColumn({ name: 'interaction_id' })
  interaction!: PlatformInteraction;

  @ManyToOne(() => LeadCandidate, { nullable: true })
  @JoinColumn({ name: 'lead_candidate_id' })
  leadCandidate!: LeadCandidate | null;
}
