export type StarkAiApprovalPaymentIntentReadonlyAdapterStatus =
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

export type StarkAiApprovalPaymentIntentReadonlyAdapterReadinessGate =
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

export type StarkAiApprovalPaymentIntentReadonlyAdapterAccountBindingStatus =
  | 'pending'
  | 'verified'
  | 'owner_confirmed'
  | 'rejected'
  | 'expired';

export type StarkAiApprovalPaymentIntentReadonlyAdapterReconciliationStatus =
  | 'not_started'
  | 'candidate'
  | 'suggested'
  | 'confirmed'
  | 'rejected'
  | 'consumed'
  | 'voided';

export interface StarkAiApprovalPaymentIntentReadonlyAdapterSyntheticRow {
  safeRecordId?: unknown;
  approvalPaymentIntentId?: unknown;
  approvalRequestId?: unknown;
  companyIdPresent?: unknown;
  businessDomain?: unknown;
  bankAccountRegistryIdPresent?: unknown;
  accountTailPresent?: unknown;
  accountBindingStatus?: unknown;
  requestedAmountPresent?: unknown;
  approvedAmountPresent?: unknown;
  plannedPayAmountPresent?: unknown;
  paidAmountPresent?: unknown;
  occupiedAmountPresent?: unknown;
  remainingAmountPresent?: unknown;
  amountBucket?: unknown;
  currency?: unknown;
  intentStatus?: unknown;
  readinessGate?: unknown;
  reconciliationStatus?: unknown;
  suggestedLinkStatus?: unknown;
  confirmedLinkStatus?: unknown;
  occupiedByReconciliation?: unknown;
  workOrderLinked?: unknown;
  materialUsageLinked?: unknown;
  supplierLinked?: unknown;
  invoiceLinked?: unknown;
  specialApprovalRequired?: unknown;
}

export interface StarkAiApprovalPaymentIntentReadonlyAdapterRow {
  safeRecordId: string;
  approvalPaymentIntentIdPresent: boolean;
  approvalRequestIdPresent: boolean;
  companyBinding: {
    companyIdPresent: boolean;
    businessDomainPresent: boolean;
  };
  accountBinding: {
    bankAccountRegistryIdPresent: boolean;
    accountTailPresent: boolean;
    accountBindingStatus: StarkAiApprovalPaymentIntentReadonlyAdapterAccountBindingStatus;
  };
  amountSemantics: {
    requestedAmountPresent: boolean;
    approvedAmountPresent: boolean;
    plannedPayAmountPresent: boolean;
    paidAmountPresent: boolean;
    occupiedAmountPresent: boolean;
    remainingAmountPresent: boolean;
    amountBucket: string;
    currency: string;
  };
  statusSemantics: {
    intentStatus: StarkAiApprovalPaymentIntentReadonlyAdapterStatus;
    readinessGate: StarkAiApprovalPaymentIntentReadonlyAdapterReadinessGate;
    reconciliationStatus: StarkAiApprovalPaymentIntentReadonlyAdapterReconciliationStatus;
    suggestedLinkStatus: string;
    confirmedLinkStatus: string;
    occupiedByReconciliation: boolean;
    allowsReadonlyCandidateAudit: boolean;
    allowsSuggestedLinkCreation: false;
    allowsBankSmsConfirmation: false;
    allowsVirtualLedgerImpact: false;
  };
  businessRelation: {
    workOrderLinked: boolean;
    materialUsageLinked: boolean;
    supplierLinked: boolean;
    invoiceLinked: boolean;
    specialApprovalRequired: boolean;
  };
}

export interface StarkAiApprovalPaymentIntentReadonlyAdapterFieldCoverage {
  identityFields: readonly string[];
  ownershipFields: readonly string[];
  accountFields: readonly string[];
  amountFields: readonly string[];
  dateFields: readonly string[];
  statusFields: readonly string[];
  businessRelationFields: readonly string[];
  auditFields: readonly string[];
}

export interface StarkAiApprovalPaymentIntentReadonlyAdapterSafeBoundaryFlags {
  databaseReadCounter: 0;
  databaseWriteCounter: 0;
  migrationRunCounter: 0;
  backfillCounter: 0;
  apiRouteCounter: 0;
  controllerCounter: 0;
  frontendCounter: 0;
  featureRepositoryRegistrationCounter: 0;
  serviceRuntimeBehaviorCounter: 0;
  parserMutationCounter: 0;
  matchingMutationCounter: 0;
  suggestedLinkCreationCounter: 0;
  bankSmsConfirmationCounter: 0;
  reconciliationLinkMutationCounter: 0;
  collectionOrderCreationCounter: 0;
  paymentRecordCreationCounter: 0;
  workOrderMutationCounter: 0;
  virtualLedgerMutationCounter: 0;
}

export interface StarkAiApprovalPaymentIntentReadonlyAdapterResult {
  adapterName: 'StarkAiApprovalPaymentIntentReadonlyAdapter';
  adapterVersion: 'v1';
  mode: 'synthetic_only_readonly_adapter_skeleton';
  dataMode: 'no_db_no_real_data';
  requestId: string;
  generatedAt: string;
  rows: StarkAiApprovalPaymentIntentReadonlyAdapterRow[];
  fieldCoverage: StarkAiApprovalPaymentIntentReadonlyAdapterFieldCoverage;
  safeBoundaryFlags: StarkAiApprovalPaymentIntentReadonlyAdapterSafeBoundaryFlags;
}

const ADAPTER_NAME = 'StarkAiApprovalPaymentIntentReadonlyAdapter' as const;
const ADAPTER_VERSION = 'v1' as const;
const DEFAULT_REQUEST_ID = 'approval-payment-intent-readonly-adapter';

export const APPROVAL_PAYMENT_INTENT_READONLY_ADAPTER_FIELD_COVERAGE: StarkAiApprovalPaymentIntentReadonlyAdapterFieldCoverage =
  {
    identityFields: [
      'id',
      'approval_request_id',
      'intent_no',
      'idempotency_key',
      'source_type',
      'source_ref_type',
      'source_ref_id',
      'source_ref_snapshot',
    ],
    ownershipFields: [
      'company_id',
      'business_unit',
      'business_domain',
      'project_id',
      'department_id',
      'responsible_person_id',
    ],
    accountFields: [
      'bank_account_registry_id',
      'account_tail',
      'payout_account_type',
      'account_binding_source',
      'account_binding_status',
    ],
    amountFields: [
      'requested_amount',
      'approved_amount',
      'planned_pay_amount',
      'paid_amount',
      'occupied_amount',
      'remaining_amount',
      'currency',
      'amount_source',
      'amount_snapshot',
    ],
    dateFields: [
      'approved_at',
      'planned_pay_at',
      'expected_pay_at',
      'paid_at',
      'reconciled_at',
      'status_changed_at',
    ],
    statusFields: [
      'intent_status',
      'readiness_gate',
      'reconciliation_status',
      'suggested_link_status',
      'confirmed_link_status',
      'occupied_by_reconciliation',
    ],
    businessRelationFields: [
      'work_order_id',
      'material_usage_id',
      'supplier_id',
      'invoice_id',
      'cost_category',
      'payment_reason',
      'special_flag',
      'special_approval_required',
    ],
    auditFields: [
      'created_by',
      'approved_by',
      'planned_by',
      'paid_by',
      'confirmed_by',
      'audit_reason_snapshot',
      'evidence_source',
      'redacted_evidence_ref',
      'created_at',
      'updated_at',
    ],
  };

const STATUS_ALLOWLIST = new Set<string>([
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
]);

const READINESS_GATE_ALLOWLIST = new Set<string>([
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
]);

const ACCOUNT_BINDING_STATUS_ALLOWLIST = new Set<string>([
  'pending',
  'verified',
  'owner_confirmed',
  'rejected',
  'expired',
]);

const RECONCILIATION_STATUS_ALLOWLIST = new Set<string>([
  'not_started',
  'candidate',
  'suggested',
  'confirmed',
  'rejected',
  'consumed',
  'voided',
]);

const SAFE_AMOUNT_BUCKET_ALLOWLIST = new Set<string>([
  'amount_0_1000',
  'amount_1000_5000',
  'amount_5000_10000',
  'amount_10000_plus',
  'amount_unknown_bucket',
  'amount_bucket_blocked',
]);

export class StarkAiApprovalPaymentIntentReadonlyAdapterService {
  buildEmptyReadonlySummary(
    input?: { requestId?: string | null; generatedAt?: string | Date | null },
  ): StarkAiApprovalPaymentIntentReadonlyAdapterResult {
    return this.buildReadonlySummary({
      requestId: input?.requestId,
      generatedAt: input?.generatedAt,
      syntheticRows: [],
    });
  }

  buildReadonlySummary(input?: {
    requestId?: string | null;
    generatedAt?: string | Date | null;
    syntheticRows?: readonly StarkAiApprovalPaymentIntentReadonlyAdapterSyntheticRow[] | null;
    maxRows?: number | null;
  }): StarkAiApprovalPaymentIntentReadonlyAdapterResult {
    const maxRows = this.resolveMaxRows(input?.maxRows);
    const rows = [...(input?.syntheticRows ?? [])]
      .slice(0, maxRows)
      .map((row, index) => this.normalizeSyntheticRow(row, index));

    return {
      adapterName: ADAPTER_NAME,
      adapterVersion: ADAPTER_VERSION,
      mode: 'synthetic_only_readonly_adapter_skeleton',
      dataMode: 'no_db_no_real_data',
      requestId: this.normalizeToken(input?.requestId) || DEFAULT_REQUEST_ID,
      generatedAt: this.resolveGeneratedAt(input?.generatedAt),
      rows,
      fieldCoverage: APPROVAL_PAYMENT_INTENT_READONLY_ADAPTER_FIELD_COVERAGE,
      safeBoundaryFlags: this.buildSafeBoundaryFlags(),
    };
  }

  private normalizeSyntheticRow(
    row: StarkAiApprovalPaymentIntentReadonlyAdapterSyntheticRow,
    index: number,
  ): StarkAiApprovalPaymentIntentReadonlyAdapterRow {
    const intentStatus = this.resolveIntentStatus(row.intentStatus);
    const readinessGate = this.resolveReadinessGate(row.readinessGate);
    const reconciliationStatus = this.resolveReconciliationStatus(
      row.reconciliationStatus,
    );

    return {
      safeRecordId:
        this.normalizeToken(row.safeRecordId) ||
        `approval_payment_intent_synthetic_${index + 1}`,
      approvalPaymentIntentIdPresent: this.toBoolean(
        row.approvalPaymentIntentId,
      ),
      approvalRequestIdPresent: this.toBoolean(row.approvalRequestId),
      companyBinding: {
        companyIdPresent: this.toBoolean(row.companyIdPresent),
        businessDomainPresent: Boolean(this.normalizeToken(row.businessDomain)),
      },
      accountBinding: {
        bankAccountRegistryIdPresent: this.toBoolean(
          row.bankAccountRegistryIdPresent,
        ),
        accountTailPresent: this.toBoolean(row.accountTailPresent),
        accountBindingStatus: this.resolveAccountBindingStatus(
          row.accountBindingStatus,
        ),
      },
      amountSemantics: {
        requestedAmountPresent: this.toBoolean(row.requestedAmountPresent),
        approvedAmountPresent: this.toBoolean(row.approvedAmountPresent),
        plannedPayAmountPresent: this.toBoolean(row.plannedPayAmountPresent),
        paidAmountPresent: this.toBoolean(row.paidAmountPresent),
        occupiedAmountPresent: this.toBoolean(row.occupiedAmountPresent),
        remainingAmountPresent: this.toBoolean(row.remainingAmountPresent),
        amountBucket: this.resolveAmountBucket(row.amountBucket),
        currency: this.normalizeCurrency(row.currency),
      },
      statusSemantics: {
        intentStatus,
        readinessGate,
        reconciliationStatus,
        suggestedLinkStatus:
          this.normalizeToken(row.suggestedLinkStatus) || 'not_available',
        confirmedLinkStatus:
          this.normalizeToken(row.confirmedLinkStatus) || 'not_confirmed',
        occupiedByReconciliation: this.toBoolean(row.occupiedByReconciliation),
        allowsReadonlyCandidateAudit:
          readinessGate === 'ready_for_readonly_candidate_audit' &&
          (intentStatus === 'approved' ||
            intentStatus === 'payment_planned' ||
            intentStatus === 'partially_paid'),
        allowsSuggestedLinkCreation: false,
        allowsBankSmsConfirmation: false,
        allowsVirtualLedgerImpact: false,
      },
      businessRelation: {
        workOrderLinked: this.toBoolean(row.workOrderLinked),
        materialUsageLinked: this.toBoolean(row.materialUsageLinked),
        supplierLinked: this.toBoolean(row.supplierLinked),
        invoiceLinked: this.toBoolean(row.invoiceLinked),
        specialApprovalRequired: this.toBoolean(row.specialApprovalRequired),
      },
    };
  }

  private resolveIntentStatus(
    value: unknown,
  ): StarkAiApprovalPaymentIntentReadonlyAdapterStatus {
    const normalized = this.normalizeToken(value);
    return STATUS_ALLOWLIST.has(normalized)
      ? (normalized as StarkAiApprovalPaymentIntentReadonlyAdapterStatus)
      : 'draft';
  }

  private resolveReadinessGate(
    value: unknown,
  ): StarkAiApprovalPaymentIntentReadonlyAdapterReadinessGate {
    const normalized = this.normalizeToken(value);
    return READINESS_GATE_ALLOWLIST.has(normalized)
      ? (normalized as StarkAiApprovalPaymentIntentReadonlyAdapterReadinessGate)
      : 'schema_not_ready';
  }

  private resolveAccountBindingStatus(
    value: unknown,
  ): StarkAiApprovalPaymentIntentReadonlyAdapterAccountBindingStatus {
    const normalized = this.normalizeToken(value);
    return ACCOUNT_BINDING_STATUS_ALLOWLIST.has(normalized)
      ? (normalized as StarkAiApprovalPaymentIntentReadonlyAdapterAccountBindingStatus)
      : 'pending';
  }

  private resolveReconciliationStatus(
    value: unknown,
  ): StarkAiApprovalPaymentIntentReadonlyAdapterReconciliationStatus {
    const normalized = this.normalizeToken(value);
    return RECONCILIATION_STATUS_ALLOWLIST.has(normalized)
      ? (normalized as StarkAiApprovalPaymentIntentReadonlyAdapterReconciliationStatus)
      : 'not_started';
  }

  private resolveAmountBucket(value: unknown): string {
    const normalized = this.normalizeToken(value);
    return SAFE_AMOUNT_BUCKET_ALLOWLIST.has(normalized)
      ? normalized
      : 'amount_unknown_bucket';
  }

  private normalizeCurrency(value: unknown): string {
    const normalized = this.normalizeToken(value).toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : 'CNY';
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value > 0;
    }
    const normalized = this.normalizeToken(value);
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }

  private resolveMaxRows(value: number | null | undefined): number {
    if (!Number.isFinite(value) || !value || value <= 0) {
      return 50;
    }
    return Math.min(Math.floor(value), 50);
  }

  private resolveGeneratedAt(value: string | Date | null | undefined): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value.trim() : date.toISOString();
    }
    return '2026-06-02T00:00:00.000Z';
  }

  private normalizeToken(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value)
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private buildSafeBoundaryFlags(): StarkAiApprovalPaymentIntentReadonlyAdapterSafeBoundaryFlags {
    return {
      databaseReadCounter: 0,
      databaseWriteCounter: 0,
      migrationRunCounter: 0,
      backfillCounter: 0,
      apiRouteCounter: 0,
      controllerCounter: 0,
      frontendCounter: 0,
      featureRepositoryRegistrationCounter: 0,
      serviceRuntimeBehaviorCounter: 0,
      parserMutationCounter: 0,
      matchingMutationCounter: 0,
      suggestedLinkCreationCounter: 0,
      bankSmsConfirmationCounter: 0,
      reconciliationLinkMutationCounter: 0,
      collectionOrderCreationCounter: 0,
      paymentRecordCreationCounter: 0,
      workOrderMutationCounter: 0,
      virtualLedgerMutationCounter: 0,
    };
  }
}
