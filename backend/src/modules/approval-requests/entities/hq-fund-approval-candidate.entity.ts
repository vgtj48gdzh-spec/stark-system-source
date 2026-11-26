import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const HQ_FUND_APPROVAL_CANDIDATE_STATUSES = [
  'discovered',
  'evidence_ready',
  'owner_review_required',
  'rejected',
  'approved_for_draft',
  'converted_to_payment_intent',
] as const;

export type HqFundApprovalCandidateStatus =
  (typeof HQ_FUND_APPROVAL_CANDIDATE_STATUSES)[number];

export const HQ_FUND_APPROVAL_CANDIDATE_TYPES = [
  'work_order_reimbursement',
  'material_payment',
  'supplier_payment',
  'merchant_settlement',
  'reward_withdrawal',
  'top_up_reconciliation_evidence',
  'deposit_reconciliation_evidence',
  'shopping_card_reconciliation_evidence',
  'public_car_expense',
  'supermarket_retail_settlement',
] as const;

export type HqFundApprovalCandidateType =
  (typeof HQ_FUND_APPROVAL_CANDIDATE_TYPES)[number];

export const HQ_FUND_APPROVAL_PAYMENT_DIRECTIONS = [
  'inbound',
  'outbound',
  'internal',
] as const;

export type HqFundApprovalPaymentDirection =
  (typeof HQ_FUND_APPROVAL_PAYMENT_DIRECTIONS)[number];

@Entity('hq_fund_approval_candidate')
export class HqFundApprovalCandidate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'candidate_ref', type: 'varchar', length: 80, unique: true })
  candidateRef!: string;

  @Column({
    name: 'candidate_type',
    type: 'enum',
    enum: HQ_FUND_APPROVAL_CANDIDATE_TYPES,
  })
  candidateType!: HqFundApprovalCandidateType;

  @Column({
    name: 'candidate_status',
    type: 'enum',
    enum: HQ_FUND_APPROVAL_CANDIDATE_STATUSES,
    default: 'discovered',
  })
  candidateStatus!: HqFundApprovalCandidateStatus;

  @Column({ name: 'business_domain', type: 'varchar', length: 80 })
  businessDomain!: string;

  @Column({ name: 'company_ref', type: 'varchar', length: 120, nullable: true })
  companyRef!: string | null;

  @Column({ name: 'source_context_system', type: 'varchar', length: 120, nullable: true })
  sourceContextSystem!: string | null;

  @Column({ name: 'source_context_ref', type: 'varchar', length: 160, nullable: true })
  sourceContextRef!: string | null;

  @Column({ name: 'work_order_ref', type: 'varchar', length: 120, nullable: true })
  workOrderRef!: string | null;

  @Column({ name: 'warehouse_material_ref', type: 'varchar', length: 120, nullable: true })
  warehouseMaterialRef!: string | null;

  @Column({ name: 'supplier_ref', type: 'varchar', length: 120, nullable: true })
  supplierRef!: string | null;

  @Column({ name: 'merchant_ref', type: 'varchar', length: 120, nullable: true })
  merchantRef!: string | null;

  @Column({ name: 'reward_withdrawal_ref', type: 'varchar', length: 120, nullable: true })
  rewardWithdrawalRef!: string | null;

  @Column({ name: 'amount_claimed', type: 'decimal', precision: 12, scale: 2, nullable: true })
  amountClaimed!: string | null;

  @Column({ type: 'varchar', length: 12, default: 'CNY' })
  currency!: string;

  @Column({
    name: 'payment_direction',
    type: 'enum',
    enum: HQ_FUND_APPROVAL_PAYMENT_DIRECTIONS,
    default: 'outbound',
  })
  paymentDirection!: HqFundApprovalPaymentDirection;

  @Column({ name: 'bank_account_registry_ref', type: 'varchar', length: 120, nullable: true })
  bankAccountRegistryRef!: string | null;

  @Column({
    name: 'redaction_policy',
    type: 'varchar',
    length: 120,
    default: 'safe_reference_only',
  })
  redactionPolicy!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 160, unique: true })
  idempotencyKey!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
