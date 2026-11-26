import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const HQ_FUND_APPROVAL_GUARD_TYPES = [
  'source_authority_guard',
  'company_subject_guard',
  'work_order_guard',
  'warehouse_material_guard',
  'material_usage_guard',
  'duplicate_material_payment_guard',
  'supplier_identity_guard',
  'supplier_invoice_guard',
  'supplier_account_guard',
  'merchant_identity_guard',
  'reward_withdrawal_guard',
  'amount_consistency_guard',
  'bank_account_registry_guard',
  'bank_confirmation_guard',
  'virtual_ledger_guard',
  'owner_review_guard',
  'redaction_guard',
  'audit_guard',
  'idempotency_guard',
  'rollback_guard',
] as const;

export type HqFundApprovalGuardType =
  (typeof HQ_FUND_APPROVAL_GUARD_TYPES)[number];

export const HQ_FUND_APPROVAL_GUARD_STATUSES = [
  'pending',
  'passed',
  'blocked',
  'owner_review_required',
  'not_applicable',
] as const;

export type HqFundApprovalGuardStatus =
  (typeof HQ_FUND_APPROVAL_GUARD_STATUSES)[number];

@Entity('hq_fund_approval_guard')
export class HqFundApprovalGuard {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'guard_ref', type: 'varchar', length: 80, unique: true })
  guardRef!: string;

  @Column({ name: 'candidate_ref', type: 'varchar', length: 80 })
  candidateRef!: string;

  @Column({
    name: 'guard_type',
    type: 'enum',
    enum: HQ_FUND_APPROVAL_GUARD_TYPES,
  })
  guardType!: HqFundApprovalGuardType;

  @Column({
    name: 'guard_status',
    type: 'enum',
    enum: HQ_FUND_APPROVAL_GUARD_STATUSES,
    default: 'pending',
  })
  guardStatus!: HqFundApprovalGuardStatus;

  @Column({ name: 'guard_reason', type: 'varchar', length: 500, nullable: true })
  guardReason!: string | null;

  @Column({ name: 'blocking_code', type: 'varchar', length: 120, nullable: true })
  blockingCode!: string | null;

  @Column({ name: 'evidence_refs', type: 'json', nullable: true })
  evidenceRefs!: string[] | null;

  @Column({ name: 'evaluated_at', type: 'datetime', nullable: true })
  evaluatedAt!: Date | null;

  @Column({ name: 'review_owner_ref', type: 'varchar', length: 120, nullable: true })
  reviewOwnerRef!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
