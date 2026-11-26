import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type ApprovalPaymentIntentStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'payment_planned'
  | 'partially_paid'
  | 'paid'
  | 'cancelled'
  | 'rejected'
  | 'reconciliation_pending'
  | 'reconciliation_confirmed'
  | 'voided';

export type ApprovalPaymentIntentReadinessGate =
  | 'schema_not_ready'
  | 'binding_not_ready'
  | 'account_not_ready'
  | 'amount_not_ready'
  | 'status_not_ready'
  | 'payout_occupation_not_ready'
  | 'business_relation_not_ready'
  | 'idempotency_not_ready'
  | 'ready_for_readonly_candidate_audit'
  | 'ready_for_suggested_link_design'
  | 'ready_for_owner_approved_runtime_trial';

export type ApprovalPaymentIntentAccountBindingStatus =
  | 'pending'
  | 'verified'
  | 'owner_confirmed'
  | 'rejected'
  | 'expired';

export type ApprovalPaymentIntentReconciliationStatus =
  | 'not_started'
  | 'candidate'
  | 'suggested'
  | 'confirmed'
  | 'rejected'
  | 'consumed'
  | 'voided';

export type ApprovalPaymentIntentSuggestedLinkStatus =
  | 'not_available'
  | 'not_started'
  | 'candidate'
  | 'rejected'
  | 'voided';

export type ApprovalPaymentIntentConfirmedLinkStatus =
  | 'not_confirmed'
  | 'confirmed'
  | 'rejected'
  | 'voided';

@Entity('approval_payment_intent')
export class ApprovalPaymentIntent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'approval_request_id', type: 'int', nullable: true })
  approvalRequestId!: number | null;

  @Column({ name: 'intent_no', type: 'varchar', length: 50, unique: true })
  intentNo!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120, unique: true, nullable: true })
  idempotencyKey!: string | null;

  @Column({ name: 'source_type', type: 'varchar', length: 80, nullable: true })
  sourceType!: string | null;

  @Column({ name: 'source_ref_type', type: 'varchar', length: 80, nullable: true })
  sourceRefType!: string | null;

  @Column({ name: 'source_ref_id', type: 'varchar', length: 100, nullable: true })
  sourceRefId!: string | null;

  @Column({ name: 'source_ref_snapshot', type: 'json', nullable: true })
  sourceRefSnapshot!: Record<string, unknown> | null;

  @Column({ name: 'company_id', type: 'int', nullable: true })
  companyId!: number | null;

  @Column({ name: 'business_unit', type: 'varchar', length: 80, nullable: true })
  businessUnit!: string | null;

  @Column({ name: 'business_domain', type: 'varchar', length: 80, nullable: true })
  businessDomain!: string | null;

  @Column({ name: 'project_id', type: 'int', nullable: true })
  projectId!: number | null;

  @Column({ name: 'department_id', type: 'int', nullable: true })
  departmentId!: number | null;

  @Column({ name: 'responsible_person_id', type: 'int', nullable: true })
  responsiblePersonId!: number | null;

  @Column({ name: 'bank_account_registry_id', type: 'int', nullable: true })
  bankAccountRegistryId!: number | null;

  @Column({ name: 'account_tail', type: 'varchar', length: 8, nullable: true })
  accountTail!: string | null;

  @Column({ name: 'payout_account_type', type: 'varchar', length: 80, nullable: true })
  payoutAccountType!: string | null;

  @Column({ name: 'account_binding_source', type: 'varchar', length: 80, nullable: true })
  accountBindingSource!: string | null;

  @Column({
    name: 'account_binding_status',
    type: 'enum',
    enum: ['pending', 'verified', 'owner_confirmed', 'rejected', 'expired'],
    default: 'pending',
  })
  accountBindingStatus!: ApprovalPaymentIntentAccountBindingStatus;

  @Column({ name: 'requested_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  requestedAmount!: string | null;

  @Column({ name: 'approved_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  approvedAmount!: string | null;

  @Column({ name: 'planned_pay_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  plannedPayAmount!: string | null;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, nullable: true, default: '0.00' })
  paidAmount!: string | null;

  @Column({
    name: 'occupied_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    default: '0.00',
  })
  occupiedAmount!: string | null;

  @Column({ name: 'remaining_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  remainingAmount!: string | null;

  @Column({ type: 'varchar', length: 12, default: 'CNY' })
  currency!: string;

  @Column({ name: 'amount_source', type: 'varchar', length: 80, nullable: true })
  amountSource!: string | null;

  @Column({ name: 'amount_snapshot', type: 'json', nullable: true })
  amountSnapshot!: Record<string, unknown> | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'planned_pay_at', type: 'datetime', nullable: true })
  plannedPayAt!: Date | null;

  @Column({ name: 'expected_pay_at', type: 'datetime', nullable: true })
  expectedPayAt!: Date | null;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'reconciled_at', type: 'datetime', nullable: true })
  reconciledAt!: Date | null;

  @Column({ name: 'status_changed_at', type: 'datetime', nullable: true })
  statusChangedAt!: Date | null;

  @Column({
    name: 'intent_status',
    type: 'enum',
    enum: [
      'draft',
      'pending_approval',
      'approved',
      'payment_planned',
      'partially_paid',
      'paid',
      'cancelled',
      'rejected',
      'reconciliation_pending',
      'reconciliation_confirmed',
      'voided',
    ],
    default: 'draft',
  })
  intentStatus!: ApprovalPaymentIntentStatus;

  @Column({
    name: 'readiness_gate',
    type: 'enum',
    enum: [
      'schema_not_ready',
      'binding_not_ready',
      'account_not_ready',
      'amount_not_ready',
      'status_not_ready',
      'payout_occupation_not_ready',
      'business_relation_not_ready',
      'idempotency_not_ready',
      'ready_for_readonly_candidate_audit',
      'ready_for_suggested_link_design',
      'ready_for_owner_approved_runtime_trial',
    ],
    default: 'schema_not_ready',
  })
  readinessGate!: ApprovalPaymentIntentReadinessGate;

  @Column({
    name: 'reconciliation_status',
    type: 'enum',
    enum: ['not_started', 'candidate', 'suggested', 'confirmed', 'rejected', 'consumed', 'voided'],
    default: 'not_started',
  })
  reconciliationStatus!: ApprovalPaymentIntentReconciliationStatus;

  @Column({
    name: 'suggested_link_status',
    type: 'enum',
    enum: ['not_available', 'not_started', 'candidate', 'rejected', 'voided'],
    default: 'not_available',
  })
  suggestedLinkStatus!: ApprovalPaymentIntentSuggestedLinkStatus;

  @Column({
    name: 'confirmed_link_status',
    type: 'enum',
    enum: ['not_confirmed', 'confirmed', 'rejected', 'voided'],
    default: 'not_confirmed',
  })
  confirmedLinkStatus!: ApprovalPaymentIntentConfirmedLinkStatus;

  @Column({ name: 'occupied_by_reconciliation', type: 'boolean', default: false })
  occupiedByReconciliation!: boolean;

  @Column({ name: 'work_order_id', type: 'int', nullable: true })
  workOrderId!: number | null;

  @Column({ name: 'material_usage_id', type: 'int', nullable: true })
  materialUsageId!: number | null;

  @Column({ name: 'supplier_id', type: 'int', nullable: true })
  supplierId!: number | null;

  @Column({ name: 'invoice_id', type: 'int', nullable: true })
  invoiceId!: number | null;

  @Column({ name: 'cost_category', type: 'varchar', length: 80, nullable: true })
  costCategory!: string | null;

  @Column({ name: 'payment_reason', type: 'varchar', length: 500, nullable: true })
  paymentReason!: string | null;

  @Column({ name: 'special_flag', type: 'varchar', length: 80, nullable: true })
  specialFlag!: string | null;

  @Column({ name: 'special_approval_required', type: 'boolean', default: false })
  specialApprovalRequired!: boolean;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @Column({ name: 'approved_by', type: 'int', nullable: true })
  approvedBy!: number | null;

  @Column({ name: 'planned_by', type: 'int', nullable: true })
  plannedBy!: number | null;

  @Column({ name: 'paid_by', type: 'int', nullable: true })
  paidBy!: number | null;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'audit_reason_snapshot', type: 'json', nullable: true })
  auditReasonSnapshot!: Record<string, unknown> | null;

  @Column({ name: 'evidence_source', type: 'varchar', length: 80, nullable: true })
  evidenceSource!: string | null;

  @Column({ name: 'redacted_evidence_ref', type: 'varchar', length: 200, nullable: true })
  redactedEvidenceRef!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
