export const READ_ONLY_SAFE_QUERY_TYPES = Object.freeze([
  'finance_daily_risk_summary',
  'bank_sms_pending_match_summary',
  'receivable_overdue_summary',
  'collection_order_evidence_gap_summary',
  'payment_work_order_link_gap_summary',
  'mobile_bridge_health_summary',
  'ai_sync_packet_current_status_summary',
] as const);

export type ReadOnlySafeQueryType =
  (typeof READ_ONLY_SAFE_QUERY_TYPES)[number];

export const READ_ONLY_SAFE_QUERY_ROLES = Object.freeze([
  'owner',
  'founder',
  'finance',
  'admin',
  'customer_service',
  'employee',
  'chatgpt_external_reviewer',
  'codex_implementation_assistant',
] as const);

export type ReadOnlySafeQueryRole =
  (typeof READ_ONLY_SAFE_QUERY_ROLES)[number];

export const READ_ONLY_SAFE_QUERY_REDACTION_LEVELS = Object.freeze([
  'external_redacted',
  'internal_safe_summary',
  'aggregate_only',
  'blocked',
] as const);

export type ReadOnlySafeQueryRedactionLevel =
  (typeof READ_ONLY_SAFE_QUERY_REDACTION_LEVELS)[number];

export const READ_ONLY_SAFE_QUERY_FORBIDDEN_ACTIONS = Object.freeze([
  'confirm_bank_sms',
  'ignore_bank_sms',
  'reconcile_bank_sms',
  'confirm_bank_sms_apply',
  'create_collection_order',
  'create_payment_record',
  'update_work_order_status',
  'update_work_order_amount_received',
  'execute_payment',
  'mutate_virtual_ledger',
  'confirm_payroll',
  'issue_employee_benefits',
  'confirm_customer_rights',
  'contact_customer',
  'call_customer',
  'dispatch_codex',
  'create_task',
  'mutate_lifecycle',
] as const);

export type ReadOnlySafeQueryForbiddenAction =
  (typeof READ_ONLY_SAFE_QUERY_FORBIDDEN_ACTIONS)[number];

export const READ_ONLY_SAFE_QUERY_ZERO_COUNTER_KEYS = Object.freeze([
  'databaseWriteCounter',
  'businessWriteCounter',
  'dispatchCounter',
  'taskCreationCounter',
  'lifecycleMutationCounter',
  'bankSmsConfirmationCounter',
  'collectionOrPaymentCreationCounter',
  'paymentRecordMutationCounter',
  'workOrderMutationCounter',
  'virtualLedgerMutationCounter',
  'payrollBenefitCustomerRightCounter',
  'customerContactExecutionCounter',
] as const);

export type ReadOnlySafeQueryZeroCounterKey =
  (typeof READ_ONLY_SAFE_QUERY_ZERO_COUNTER_KEYS)[number];

export const READ_ONLY_SAFE_QUERY_FORBIDDEN_OUTPUT_MARKERS = Object.freeze([
  'raw_sms',
  'verification_code',
  'full_phone',
  'phone_normalized',
  'raw_phone_hash',
  'full_bank_account',
  'raw_provider_payload',
  'token',
  'secret',
  'private_key',
  'certificate',
  'runtime_log',
  'production_provider_payload',
] as const);

export type ReadOnlySafeQueryForbiddenOutputMarker =
  (typeof READ_ONLY_SAFE_QUERY_FORBIDDEN_OUTPUT_MARKERS)[number];

export type ReadOnlySafeQueryRiskLevel =
  | 'info'
  | 'review'
  | 'warning'
  | 'blocked';

export type ReadOnlySafeQueryJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly ReadOnlySafeQueryJsonValue[]
  | { readonly [key: string]: ReadOnlySafeQueryJsonValue };

export interface ReadOnlySafeQueryTimeRange {
  readonly from: string;
  readonly to: string;
}

export interface ReadOnlySafeQueryScopeLimit {
  readonly companyId?: string | null;
  readonly department?: string | null;
  readonly maxRows?: number;
  readonly aggregateOnly?: boolean;
  readonly [key: string]: ReadOnlySafeQueryJsonValue | undefined;
}

export interface ReadOnlySafeQueryRequest {
  readonly queryType: ReadOnlySafeQueryType;
  readonly requestedByUserId: string;
  readonly role: ReadOnlySafeQueryRole;
  readonly requestReason: string;
  readonly timeRange: ReadOnlySafeQueryTimeRange;
  readonly scopeLimit: ReadOnlySafeQueryScopeLimit;
  readonly redactionLevel: ReadOnlySafeQueryRedactionLevel;
  readonly sourceRefs: readonly string[];
  readonly ownerApprovalRequired: boolean;
  readonly noMutation: true;
}

export interface ReadOnlySafeQueryRedactionReport {
  readonly rawSmsIncluded: false;
  readonly verificationCodeIncluded: false;
  readonly fullPhoneIncluded: false;
  readonly phoneNormalizedIncluded: false;
  readonly rawPhoneHashIncluded: false;
  readonly fullBankAccountIncluded: false;
  readonly rawProviderPayloadIncluded: false;
  readonly secretIncluded: false;
  readonly runtimeLogIncluded: false;
}

export interface ReadOnlySafeQueryPermissionResult {
  readonly allowed: boolean;
  readonly role: ReadOnlySafeQueryRole;
  readonly redactionLevel: ReadOnlySafeQueryRedactionLevel;
  readonly ownerApprovalRequired: boolean;
  readonly ownerApprovalSatisfied: boolean;
  readonly deniedReason?: string;
}

export interface ReadOnlySafeQueryZeroCounters {
  readonly databaseWriteCounter: 0;
  readonly businessWriteCounter: 0;
  readonly dispatchCounter: 0;
  readonly taskCreationCounter: 0;
  readonly lifecycleMutationCounter: 0;
  readonly bankSmsConfirmationCounter: 0;
  readonly collectionOrPaymentCreationCounter: 0;
  readonly paymentRecordMutationCounter: 0;
  readonly workOrderMutationCounter: 0;
  readonly virtualLedgerMutationCounter: 0;
  readonly payrollBenefitCustomerRightCounter: 0;
  readonly customerContactExecutionCounter: 0;
}

export type ReadOnlySafeQuerySafeRow = Readonly<
  Record<string, ReadOnlySafeQueryJsonValue>
>;

export type ReadOnlySafeQueryAggregateRow = Readonly<
  Record<string, ReadOnlySafeQueryJsonValue>
>;

export interface ReadOnlySafeQueryResult {
  readonly contextType: 'stark_system_safe_query_result';
  readonly queryType: ReadOnlySafeQueryType;
  readonly generatedAt: string;
  readonly reviewOnly: true;
  readonly safeSummaryOnly: true;
  readonly readOnly: true;
  readonly noExecution: true;
  readonly redactionReport: ReadOnlySafeQueryRedactionReport;
  readonly permissionResult: ReadOnlySafeQueryPermissionResult;
  readonly safeRows: readonly ReadOnlySafeQuerySafeRow[];
  readonly aggregateRows: readonly ReadOnlySafeQueryAggregateRow[];
  readonly evidenceRefs: readonly string[];
  readonly blockerLabels: readonly string[];
  readonly riskLevel: ReadOnlySafeQueryRiskLevel;
  readonly nextSuggestedQuestions: readonly string[];
  readonly forbiddenActions: readonly ReadOnlySafeQueryForbiddenAction[];
  readonly zeroCounters: ReadOnlySafeQueryZeroCounters;
}

export function isReadOnlySafeQueryType(
  value: unknown,
): value is ReadOnlySafeQueryType {
  return (
    typeof value === 'string' &&
    READ_ONLY_SAFE_QUERY_TYPES.includes(value as ReadOnlySafeQueryType)
  );
}

export function isReadOnlySafeQueryRole(
  value: unknown,
): value is ReadOnlySafeQueryRole {
  return (
    typeof value === 'string' &&
    READ_ONLY_SAFE_QUERY_ROLES.includes(value as ReadOnlySafeQueryRole)
  );
}

export function makeZeroCounters(): ReadOnlySafeQueryZeroCounters {
  const counters = {} as Record<ReadOnlySafeQueryZeroCounterKey, 0>;
  for (const key of READ_ONLY_SAFE_QUERY_ZERO_COUNTER_KEYS) {
    counters[key] = 0;
  }
  return counters as ReadOnlySafeQueryZeroCounters;
}

export function makeBlockedRedactionReport(): ReadOnlySafeQueryRedactionReport {
  return {
    rawSmsIncluded: false,
    verificationCodeIncluded: false,
    fullPhoneIncluded: false,
    phoneNormalizedIncluded: false,
    rawPhoneHashIncluded: false,
    fullBankAccountIncluded: false,
    rawProviderPayloadIncluded: false,
    secretIncluded: false,
    runtimeLogIncluded: false,
  };
}

export function assertReadOnlySafeQueryNoMutationContractShape(
  value: unknown,
): asserts value is ReadOnlySafeQueryRequest | ReadOnlySafeQueryResult {
  if (!isPlainRecord(value)) {
    throw new TypeError('read_only_safe_query_contract_requires_object');
  }

  if ('noMutation' in value) {
    if (value.noMutation !== true) {
      throw new TypeError('read_only_safe_query_request_requires_no_mutation');
    }
    return;
  }

  if (value.contextType !== 'stark_system_safe_query_result') {
    throw new TypeError('read_only_safe_query_contract_shape_unknown');
  }

  for (const flag of [
    'reviewOnly',
    'safeSummaryOnly',
    'readOnly',
    'noExecution',
  ] as const) {
    if (value[flag] !== true) {
      throw new TypeError(`read_only_safe_query_result_requires_${flag}`);
    }
  }

  const zeroCounters = value.zeroCounters;
  if (!isPlainRecord(zeroCounters)) {
    throw new TypeError('read_only_safe_query_result_requires_zero_counters');
  }
  for (const key of READ_ONLY_SAFE_QUERY_ZERO_COUNTER_KEYS) {
    if (zeroCounters[key] !== 0) {
      throw new TypeError(`read_only_safe_query_counter_must_be_zero:${key}`);
    }
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
