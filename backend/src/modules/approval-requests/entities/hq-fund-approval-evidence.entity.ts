import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const HQ_FUND_APPROVAL_EVIDENCE_TYPES = [
  'work_order_record',
  'staff_work_record',
  'warehouse_material_record',
  'material_usage_record',
  'supplier_profile',
  'supplier_invoice',
  'supplier_quote',
  'purchase_or_receipt_record',
  'merchant_settlement_record',
  'reward_withdrawal_request',
  'bank_sms_evidence',
  'payment_callback_reference',
  'card_or_deposit_record',
  'public_car_apply_record',
  'supermarket_order_record',
  'attachment_metadata',
  'legacy_context_reference',
] as const;

export type HqFundApprovalEvidenceType =
  (typeof HQ_FUND_APPROVAL_EVIDENCE_TYPES)[number];

export const HQ_FUND_APPROVAL_REDACTION_STATUSES = [
  'redacted',
  'metadata_only',
  'blocked_sensitive_source',
] as const;

export type HqFundApprovalRedactionStatus =
  (typeof HQ_FUND_APPROVAL_REDACTION_STATUSES)[number];

@Entity('hq_fund_approval_evidence')
export class HqFundApprovalEvidence {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'evidence_ref', type: 'varchar', length: 80, unique: true })
  evidenceRef!: string;

  @Column({ name: 'candidate_ref', type: 'varchar', length: 80 })
  candidateRef!: string;

  @Column({
    name: 'evidence_type',
    type: 'enum',
    enum: HQ_FUND_APPROVAL_EVIDENCE_TYPES,
  })
  evidenceType!: HqFundApprovalEvidenceType;

  @Column({ name: 'source_system', type: 'varchar', length: 120, nullable: true })
  sourceSystem!: string | null;

  @Column({ name: 'source_surface', type: 'varchar', length: 160, nullable: true })
  sourceSurface!: string | null;

  @Column({ name: 'source_ref_redacted', type: 'varchar', length: 160, nullable: true })
  sourceRefRedacted!: string | null;

  @Column({ name: 'evidence_summary', type: 'text', nullable: true })
  evidenceSummary!: string | null;

  @Column({ name: 'evidence_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  evidenceAmount!: string | null;

  @Column({ name: 'evidence_time', type: 'datetime', nullable: true })
  evidenceTime!: Date | null;

  @Column({
    name: 'redaction_status',
    type: 'enum',
    enum: HQ_FUND_APPROVAL_REDACTION_STATUSES,
    default: 'metadata_only',
  })
  redactionStatus!: HqFundApprovalRedactionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
