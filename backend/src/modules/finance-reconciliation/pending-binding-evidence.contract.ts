export type BankSmsEvidenceStatus =
  | 'pending_binding'
  | 'pending_account_evidence'
  | 'unmatched_exception';

export type BankSmsWorkflowStatus =
  | BankSmsEvidenceStatus
  | 'pending'
  | 'pending_evidence'
  | 'suggested'
  | 'confirmed'
  | 'ignored';

export type PendingBindingReleaseStepCode =
  | 'formal_account_registry_exists'
  | 'account_tail_or_mapping_evidence'
  | 'company_ownership_confirmed'
  | 'transaction_attribution_candidate_only';

export type PendingBindingReleaseMissingStep = {
  step: PendingBindingReleaseStepCode;
  reason: string;
};

export interface BankSmsEvidenceStatusContract {
  status: BankSmsEvidenceStatus;
  meaning: string;
  canEnterFormalLedger: false;
  canCreateConfirmedReconciliation: false;
  canMutatePaymentRecords: false;
  canMutateWorkOrders: false;
  suggestedNextStatus: 'pending_binding' | 'pending' | 'unmatched_exception';
}

export const BANK_SMS_EVIDENCE_STATUS_CONTRACTS: Record<
  BankSmsEvidenceStatus,
  BankSmsEvidenceStatusContract
> = {
  pending_binding: {
    status: 'pending_binding',
    meaning:
      'Basic bank_sms_transaction fields exist, but formal company account binding is incomplete or company ownership is not confirmed.',
    canEnterFormalLedger: false,
    canCreateConfirmedReconciliation: false,
    canMutatePaymentRecords: false,
    canMutateWorkOrders: false,
    suggestedNextStatus: 'pending',
  },
  pending_account_evidence: {
    status: 'pending_account_evidence',
    meaning:
      'The SMS appears to describe a bank transaction, but account tail or auditable account-mapping evidence is missing.',
    canEnterFormalLedger: false,
    canCreateConfirmedReconciliation: false,
    canMutatePaymentRecords: false,
    canMutateWorkOrders: false,
    suggestedNextStatus: 'pending_binding',
  },
  unmatched_exception: {
    status: 'unmatched_exception',
    meaning:
      'A bank transaction or classification result exists, but no safe business target such as work order, invoice, loan, repayment, approved payout, fee, or tax object can be matched.',
    canEnterFormalLedger: false,
    canCreateConfirmedReconciliation: false,
    canMutatePaymentRecords: false,
    canMutateWorkOrders: false,
    suggestedNextStatus: 'unmatched_exception',
  },
};

export interface PendingBindingTransactionEvidence {
  id?: number | null;
  currentStatus?: BankSmsWorkflowStatus | string | null;
  bankName?: string | null;
  sender?: string | null;
  accountTail?: string | null;
  companyId?: number | null;
  rawSmsId?: number | null;
  amount?: string | number | null;
  direction?: 'income' | 'expense' | string | null;
}

export interface PendingBindingRegistryEvidence {
  id?: number | null;
  status?: 'active' | 'inactive' | string | null;
  bankName?: string | null;
  smsSender?: string | null;
  accountTail?: string | null;
  companyId?: number | null;
  evidenceSource?: string | null;
  auditRef?: string | null;
  deviceId?: string | null;
  simSlot?: number | null;
}

export interface PendingBindingMappingEvidence {
  kind: 'direct_account_tail' | 'registry_mapping' | 'alias_mapping';
  accountTail?: string | null;
  registryId?: number | null;
  evidenceSource?: string | null;
  auditRef?: string | null;
  derivedFromGuess?: boolean;
}

export interface PendingBindingAttributionEvidence {
  candidateOnly: boolean;
  requiresHumanOrOwnerApproval: boolean;
  targetType?: string | null;
  targetId?: number | null;
  willCreateConfirmedReconciliation?: boolean;
  willMutatePaymentRecords?: boolean;
  willMutateWorkOrders?: boolean;
  willWriteVirtualLedger?: boolean;
}

export interface PendingBindingReleaseChecklistInput {
  transaction: PendingBindingTransactionEvidence;
  registry?: PendingBindingRegistryEvidence | null;
  mappingEvidence?: PendingBindingMappingEvidence[];
  attributionEvidence?: PendingBindingAttributionEvidence | null;
  requestedBy?: {
    operatorId?: number | null;
    operatorRole?: string | null;
  } | null;
}

export interface PendingBindingReleaseChecklistStep {
  step: PendingBindingReleaseStepCode;
  passed: boolean;
  evidence: Record<string, unknown>;
  reason: string;
}

export interface PendingBindingReleaseChecklistResult {
  canRelease: boolean;
  currentStatus: string;
  suggestedNextStatus: 'pending_binding' | 'pending';
  missingSteps: PendingBindingReleaseMissingStep[];
  evidenceChecklist: PendingBindingReleaseChecklistStep[];
  blockers: string[];
  auditPayload: Record<string, unknown>;
  guardReason: string;
}

export interface BankAccountRegistryUpdateAuditContractInput {
  registryId: number | null;
  operatorId?: number | null;
  operatorRole?: string | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  changeReason?: string | null;
  evidenceSource?: string | null;
  approvedBy?: number | null;
  reviewedBy?: number | null;
  createdAt?: Date | string | null;
}

export interface BankAccountRegistryUpdateAuditContract {
  registryId: number | null;
  operatorId: number | null;
  operatorRole: string | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  changedFields: string[];
  changeReason: string | null;
  evidenceSource: string | null;
  approvedBy: number | null;
  reviewedBy: number | null;
  createdAt: string;
  contractOnly: true;
}

export function buildPendingBindingReleaseChecklist(
  input: PendingBindingReleaseChecklistInput,
): PendingBindingReleaseChecklistResult {
  const transaction = input.transaction;
  const registry = input.registry ?? null;
  const mappingEvidence = input.mappingEvidence ?? [];
  const attributionEvidence = input.attributionEvidence ?? null;
  const currentStatus = normalizeStatus(transaction.currentStatus) ?? 'pending_binding';
  const evidenceChecklist: PendingBindingReleaseChecklistStep[] = [];

  const registryStepPassed =
    Boolean(registry) &&
    normalizeText(registry?.status) === 'active' &&
    Boolean(trimToNull(registry?.bankName)) &&
    Boolean(trimToNull(registry?.smsSender)) &&
    Boolean(trimToNull(registry?.accountTail)) &&
    Number.isInteger(registry?.companyId) &&
    Boolean(trimToNull(registry?.evidenceSource));
  evidenceChecklist.push({
    step: 'formal_account_registry_exists',
    passed: registryStepPassed,
    evidence: {
      registryId: registry?.id ?? null,
      status: registry?.status ?? null,
      bankNameMatched: textEquals(transaction.bankName, registry?.bankName),
      smsSenderMatched: textEquals(transaction.sender, registry?.smsSender),
      accountTailPresent: Boolean(trimToNull(registry?.accountTail)),
      companyId: registry?.companyId ?? null,
      evidenceSourcePresent: Boolean(trimToNull(registry?.evidenceSource)),
    },
    reason: registryStepPassed
      ? 'active_registry_with_required_account_fields_and_evidence_source'
      : 'missing_active_registry_or_required_registry_evidence',
  });

  const directTailMatch =
    Boolean(trimToNull(transaction.accountTail)) &&
    Boolean(trimToNull(registry?.accountTail)) &&
    textEquals(transaction.accountTail, registry?.accountTail);
  const auditedMappingEvidence = mappingEvidence.some(
    (item) =>
      !item.derivedFromGuess &&
      Boolean(trimToNull(item.accountTail)) &&
      Boolean(trimToNull(item.evidenceSource)) &&
      (item.registryId === undefined ||
        item.registryId === null ||
        item.registryId === registry?.id),
  );
  const mappingStepPassed = directTailMatch || auditedMappingEvidence;
  evidenceChecklist.push({
    step: 'account_tail_or_mapping_evidence',
    passed: mappingStepPassed,
    evidence: {
      directTailMatch,
      auditedMappingEvidence,
      mappingEvidenceCount: mappingEvidence.length,
    },
    reason: mappingStepPassed
      ? 'account_tail_or_audited_mapping_evidence_present'
      : 'missing_account_tail_or_audited_mapping_evidence',
  });

  const companyStepPassed =
    Number.isInteger(transaction.companyId) &&
    Number.isInteger(registry?.companyId) &&
    transaction.companyId === registry?.companyId;
  evidenceChecklist.push({
    step: 'company_ownership_confirmed',
    passed: companyStepPassed,
    evidence: {
      transactionCompanyId: transaction.companyId ?? null,
      registryCompanyId: registry?.companyId ?? null,
      source: 'registry_only_not_sms_body_guess',
    },
    reason: companyStepPassed
      ? 'company_id_matches_active_registry'
      : 'company_id_missing_or_not_confirmed_by_registry',
  });

  const attributionStepPassed =
    Boolean(attributionEvidence?.candidateOnly) &&
    Boolean(attributionEvidence?.requiresHumanOrOwnerApproval) &&
    !attributionEvidence?.willCreateConfirmedReconciliation &&
    !attributionEvidence?.willMutatePaymentRecords &&
    !attributionEvidence?.willMutateWorkOrders &&
    !attributionEvidence?.willWriteVirtualLedger;
  evidenceChecklist.push({
    step: 'transaction_attribution_candidate_only',
    passed: attributionStepPassed,
    evidence: {
      candidateOnly: attributionEvidence?.candidateOnly ?? false,
      requiresHumanOrOwnerApproval:
        attributionEvidence?.requiresHumanOrOwnerApproval ?? false,
      targetType: attributionEvidence?.targetType ?? null,
      targetId: attributionEvidence?.targetId ?? null,
      willCreateConfirmedReconciliation:
        attributionEvidence?.willCreateConfirmedReconciliation ?? false,
      willMutatePaymentRecords: attributionEvidence?.willMutatePaymentRecords ?? false,
      willMutateWorkOrders: attributionEvidence?.willMutateWorkOrders ?? false,
      willWriteVirtualLedger: attributionEvidence?.willWriteVirtualLedger ?? false,
    },
    reason: attributionStepPassed
      ? 'candidate_only_reconciliation_path_with_human_or_owner_approval_required'
      : 'missing_candidate_only_attribution_or_formal_write_would_be_triggered',
  });

  const missingSteps = evidenceChecklist
    .filter((item) => !item.passed)
    .map((item) => ({
      step: item.step,
      reason: item.reason,
    }));
  const blockers = missingSteps.map((item) => item.reason);
  const canRelease = missingSteps.length === 0 && currentStatus === 'pending_binding';

  return {
    canRelease,
    currentStatus,
    suggestedNextStatus: canRelease ? 'pending' : 'pending_binding',
    missingSteps,
    evidenceChecklist,
    blockers,
    auditPayload: {
      transactionId: transaction.id ?? null,
      rawSmsId: transaction.rawSmsId ?? null,
      registryId: registry?.id ?? null,
      previousStatus: currentStatus,
      suggestedNextStatus: canRelease ? 'pending' : 'pending_binding',
      operatorId: input.requestedBy?.operatorId ?? null,
      operatorRole: input.requestedBy?.operatorRole ?? null,
      noConfirmedReconciliationCreated: true,
      noPaymentRecordsMutated: true,
      noWorkOrdersMutated: true,
      noVirtualLedgerWritten: true,
      evidenceChecklist,
    },
    guardReason: canRelease
      ? 'pending_binding_release_candidate_ready_for_pending_status_only'
      : 'pending_binding_release_blocked_by_evidence_contract',
  };
}

export function assertPendingBindingReleaseReady(
  input: PendingBindingReleaseChecklistInput,
): PendingBindingReleaseChecklistResult {
  const checklist = buildPendingBindingReleaseChecklist(input);
  if (!checklist.canRelease) {
    throw new Error(
      `pending_binding_release_not_ready:${checklist.blockers.join('|') || 'unknown_blocker'}`,
    );
  }

  return checklist;
}

export function buildBankAccountRegistryUpdateAuditContract(
  input: BankAccountRegistryUpdateAuditContractInput,
): BankAccountRegistryUpdateAuditContract {
  const changedFields = resolveChangedFields(input.beforeSnapshot, input.afterSnapshot);

  return {
    registryId: input.registryId,
    operatorId: input.operatorId ?? null,
    operatorRole: trimToNull(input.operatorRole),
    beforeSnapshot: input.beforeSnapshot,
    afterSnapshot: input.afterSnapshot,
    changedFields,
    changeReason: trimToNull(input.changeReason),
    evidenceSource: trimToNull(input.evidenceSource),
    approvedBy: input.approvedBy ?? null,
    reviewedBy: input.reviewedBy ?? null,
    createdAt: input.createdAt ? new Date(input.createdAt).toISOString() : new Date().toISOString(),
    contractOnly: true,
  };
}

function resolveChangedFields(
  beforeSnapshot: Record<string, unknown> | null,
  afterSnapshot: Record<string, unknown> | null,
) {
  const keys = new Set([
    ...Object.keys(beforeSnapshot ?? {}),
    ...Object.keys(afterSnapshot ?? {}),
  ]);

  return [...keys].filter(
    (key) => stableStringify(beforeSnapshot?.[key]) !== stableStringify(afterSnapshot?.[key]),
  );
}

function trimToNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeText(value?: string | null) {
  return trimToNull(value)?.toLowerCase() ?? null;
}

function normalizeStatus(value?: string | null) {
  return trimToNull(value) ?? null;
}

function textEquals(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
