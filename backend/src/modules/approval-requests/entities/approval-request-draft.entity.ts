import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ApprovalRequest } from './approval-request.entity';

export const APPROVAL_REQUEST_DRAFT_STATUSES = [
  'draft_created',
  'submitted',
  'voided',
] as const;

export type ApprovalRequestDraftStatus = (typeof APPROVAL_REQUEST_DRAFT_STATUSES)[number];

@Entity('approval_request_drafts')
@Index('idx_approval_request_drafts_candidate_ref', ['candidateRef'])
@Index('idx_approval_request_drafts_draft_status', ['draftStatus'])
@Index('idx_approval_request_drafts_source_system', ['sourceSystem'])
@Index('idx_approval_request_drafts_created_by', ['createdByUserId'])
export class ApprovalRequestDraft {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'draft_no', type: 'varchar', length: 50, unique: true })
  draftNo!: string;

  @Column({ name: 'candidate_ref', type: 'varchar', length: 160 })
  candidateRef!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 200, unique: true })
  idempotencyKey!: string;

  @Column({ name: 'candidate_type', type: 'varchar', length: 80 })
  candidateType!: string;

  @Column({ name: 'source_system', type: 'varchar', length: 80 })
  sourceSystem!: string;

  @Column({ name: 'source_entity_type', type: 'varchar', length: 120 })
  sourceEntityType!: string;

  @Column({ name: 'source_ref', type: 'varchar', length: 200 })
  sourceRef!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amount!: string | null;

  @Column({ name: 'draft_reason', type: 'varchar', length: 500, nullable: true })
  draftReason!: string | null;

  @Column({
    name: 'draft_status',
    type: 'varchar',
    length: 40,
    default: 'draft_created',
  })
  draftStatus!: ApprovalRequestDraftStatus;

  @Column({ name: 'evidence_snapshot_json', type: 'simple-json' })
  evidenceSnapshotJson!: Record<string, unknown>;

  @Column({ name: 'learning_context_json', type: 'simple-json' })
  learningContextJson!: Record<string, unknown>;

  @Column({ name: 'ai_suggestion_snapshot_json', type: 'simple-json', nullable: true })
  aiSuggestionSnapshotJson!: Record<string, unknown> | null;

  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  createdByUserId!: number | null;

  @Column({ name: 'linked_approval_request_id', type: 'int', nullable: true })
  linkedApprovalRequestId!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser!: User | null;

  @ManyToOne(() => ApprovalRequest, { nullable: true })
  @JoinColumn({ name: 'linked_approval_request_id' })
  linkedApprovalRequest!: ApprovalRequest | null;
}
