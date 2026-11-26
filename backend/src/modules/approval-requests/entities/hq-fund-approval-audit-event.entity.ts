import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  HQ_FUND_APPROVAL_CANDIDATE_STATUSES,
  HqFundApprovalCandidateStatus,
} from './hq-fund-approval-candidate.entity';

export const HQ_FUND_APPROVAL_AUDIT_EVENT_TYPES = [
  'candidate_discovered',
  'evidence_attached',
  'evidence_rejected',
  'guard_evaluated',
  'owner_review_requested',
  'owner_review_completed',
  'candidate_rejected',
  'candidate_approved_for_draft',
  'candidate_converted_to_payment_intent',
  'candidate_blocked_by_guard',
  'redaction_policy_applied',
] as const;

export type HqFundApprovalAuditEventType =
  (typeof HQ_FUND_APPROVAL_AUDIT_EVENT_TYPES)[number];

@Entity('hq_fund_approval_audit_event')
export class HqFundApprovalAuditEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'audit_event_ref', type: 'varchar', length: 80, unique: true })
  auditEventRef!: string;

  @Column({ name: 'candidate_ref', type: 'varchar', length: 80 })
  candidateRef!: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: HQ_FUND_APPROVAL_AUDIT_EVENT_TYPES,
  })
  eventType!: HqFundApprovalAuditEventType;

  @Column({ name: 'actor_ref', type: 'varchar', length: 120, nullable: true })
  actorRef!: string | null;

  @Column({ name: 'event_reason', type: 'varchar', length: 500, nullable: true })
  eventReason!: string | null;

  @Column({
    name: 'before_status',
    type: 'enum',
    enum: HQ_FUND_APPROVAL_CANDIDATE_STATUSES,
    nullable: true,
  })
  beforeStatus!: HqFundApprovalCandidateStatus | null;

  @Column({
    name: 'after_status',
    type: 'enum',
    enum: HQ_FUND_APPROVAL_CANDIDATE_STATUSES,
    nullable: true,
  })
  afterStatus!: HqFundApprovalCandidateStatus | null;

  @Column({ name: 'guard_refs', type: 'json', nullable: true })
  guardRefs!: string[] | null;

  @Column({ name: 'evidence_refs', type: 'json', nullable: true })
  evidenceRefs!: string[] | null;

  @Column({ name: 'safe_payload_summary', type: 'text', nullable: true })
  safePayloadSummary!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
