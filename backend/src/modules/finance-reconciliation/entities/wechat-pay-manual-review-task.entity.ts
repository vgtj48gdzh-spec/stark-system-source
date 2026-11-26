import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { WechatPayEvidenceProvider } from './wechat-pay-callback-evidence.entity';

export type WechatPayManualReviewTaskStatus =
  | 'pending_review'
  | 'assigned'
  | 'reviewed'
  | 'approved_candidate'
  | 'rejected'
  | 'needs_more_evidence'
  | 'closed';

export type WechatPayManualReviewTaskType =
  | 'callback_evidence'
  | 'settlement_evidence'
  | 'exception';

export type WechatPayManualReviewReason =
  | 'amount_mismatch'
  | 'missing_payment_request'
  | 'missing_collection_order'
  | 'paid_after_expired'
  | 'paid_after_cancelled'
  | 'decrypt_failed'
  | 'invalid_signature'
  | 'duplicate_conflict'
  | 'bank_settlement_missing'
  | 'fee_mismatch';

@Entity('wechat_pay_manual_review_task')
@Index('idx_wechat_pay_manual_review_provider_status', ['provider', 'status'])
@Index('idx_wechat_pay_manual_review_callback', ['callbackEvidenceId'])
@Index('idx_wechat_pay_manual_review_settlement', ['settlementEvidenceId'])
@Index('idx_wechat_pay_manual_review_reason', ['reviewReason'])
@Index('idx_wechat_pay_manual_review_created_at', ['createdAt'])
export class WechatPayManualReviewTask {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 80 })
  source!: string;

  @Column({
    type: 'enum',
    enum: ['wechat_pay_v3', 'wechat_pay_v3_official_like_dummy'],
  })
  provider!: WechatPayEvidenceProvider;

  @Column({
    type: 'enum',
    enum: [
      'pending_review',
      'assigned',
      'reviewed',
      'approved_candidate',
      'rejected',
      'needs_more_evidence',
      'closed',
    ],
    default: 'pending_review',
  })
  status!: WechatPayManualReviewTaskStatus;

  @Column({
    name: 'task_type',
    type: 'enum',
    enum: ['callback_evidence', 'settlement_evidence', 'exception'],
  })
  taskType!: WechatPayManualReviewTaskType;

  @Column({
    name: 'review_reason',
    type: 'enum',
    enum: [
      'amount_mismatch',
      'missing_payment_request',
      'missing_collection_order',
      'paid_after_expired',
      'paid_after_cancelled',
      'decrypt_failed',
      'invalid_signature',
      'duplicate_conflict',
      'bank_settlement_missing',
      'fee_mismatch',
    ],
  })
  reviewReason!: WechatPayManualReviewReason;

  @Column({ name: 'callback_evidence_id', type: 'int', nullable: true })
  callbackEvidenceId!: number | null;

  @Column({ name: 'settlement_evidence_id', type: 'int', nullable: true })
  settlementEvidenceId!: number | null;

  @Column({ name: 'finance_payment_request_id', type: 'int', nullable: true })
  financePaymentRequestId!: number | null;

  @Column({ name: 'finance_collection_order_id', type: 'int', nullable: true })
  financeCollectionOrderId!: number | null;

  @Column({ name: 'bank_sms_transaction_id', type: 'int', nullable: true })
  bankSmsTransactionId!: number | null;

  @Column({ name: 'finance_reconciliation_link_id', type: 'int', nullable: true })
  financeReconciliationLinkId!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  priority!: string;

  @Column({ name: 'evidence_fingerprint', type: 'varchar', length: 128 })
  evidenceFingerprint!: string;

  @Column({ name: 'payload_hash', type: 'varchar', length: 128 })
  payloadHash!: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  fingerprint!: string;

  @Column({ name: 'sanitized_payload', type: 'json', nullable: true })
  sanitizedPayload!: Record<string, unknown> | null;

  @Column({ name: 'redaction_version', type: 'varchar', length: 40 })
  redactionVersion!: string;

  @Column({ name: 'assigned_to_role', type: 'varchar', length: 80, nullable: true })
  assignedToRole!: string | null;

  @Column({ name: 'review_summary_redacted', type: 'varchar', length: 500, nullable: true })
  reviewSummaryRedacted!: string | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'error_code', type: 'varchar', length: 80, nullable: true })
  errorCode!: string | null;

  @Column({ name: 'error_reason', type: 'varchar', length: 500, nullable: true })
  errorReason!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
