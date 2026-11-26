import { Injectable } from '@nestjs/common';

export type StarkAiDatabaseSafeSummaryType =
  | 'finance_safe_summary'
  | 'work_order_safe_summary'
  | 'customer_safe_summary'
  | 'employee_task_safe_summary'
  | 'inventory_safe_summary'
  | 'invoice_receivable_safe_summary';

export type StarkAiDatabaseSafeSummaryAggregationLevel =
  | 'aggregate'
  | 'bucketed'
  | 'redacted_item_summary';

export type StarkAiDatabaseSafeSummaryJsonValue =
  | string
  | number
  | boolean
  | null
  | StarkAiDatabaseSafeSummaryJsonValue[]
  | { [key: string]: StarkAiDatabaseSafeSummaryJsonValue };

export interface StarkAiDatabaseSafeSummarySyntheticRecord {
  sourceName?: unknown;
  safeRecordId?: unknown;
  category?: unknown;
  status?: unknown;
  riskLevel?: unknown;
  amountBucket?: unknown;
  safeLabel?: unknown;
  blockerLabel?: unknown;
  maskedAccountTail?: unknown;
  maskedCustomerId?: unknown;
  ownerRoleHint?: unknown;
  [key: string]: unknown;
}

export interface StarkAiDatabaseSafeSummaryProviderInput {
  summaryType: StarkAiDatabaseSafeSummaryType | string;
  requestedByRole?: string | null;
  requestId?: string | null;
  generatedAt?: string | Date | null;
  sourceKind?: 'synthetic_fixture' | 'safe_input' | string | null;
  dataSourceScope?: readonly unknown[] | null;
  syntheticRecords?: readonly StarkAiDatabaseSafeSummarySyntheticRecord[] | null;
}

export interface StarkAiDatabaseSafeSummaryRedactionReport
  extends Record<string, StarkAiDatabaseSafeSummaryJsonValue> {
  rawSmsIncluded: false;
  verificationCodesIncluded: false;
  fullPhoneIncluded: false;
  fullBankAccountIncluded: false;
  secretsIncluded: false;
  databaseFilesIncluded: false;
  runtimeLogsIncluded: false;
  privateKeysIncluded: false;
  certificatesIncluded: false;
  productionPayloadsIncluded: false;
  sensitiveInputDetected: boolean;
  redactionApplied: boolean;
  detectionCounts: Record<string, number>;
  redactionReasons: string[];
}

export interface StarkAiDatabaseSafeSummaryBoundaryFlags
  extends Record<string, StarkAiDatabaseSafeSummaryJsonValue> {
  databaseReadCounter: 0;
  databaseWriteCounter: 0;
  businessWriteCounter: 0;
  businessExecutionCounter: 0;
  dispatchCounter: 0;
  taskCreationCounter: 0;
  lifecycleMutationCounter: 0;
  bankSmsConfirmationCounter: 0;
  collectionOrPaymentCreationCounter: 0;
  workOrderMutationCounter: 0;
  virtualLedgerMutationCounter: 0;
  payrollBenefitCustomerRightCounter: 0;
  realWechatPayCounter: 0;
  readOnly: true;
  reviewContextOnly: true;
  directSqlAllowed: false;
  arbitraryTableReadAllowed: false;
  rawDatabaseRowsAllowed: false;
  commandPayloadAllowed: false;
  businessExecutionAllowed: false;
}

export interface StarkAiDatabaseSafeSummaryAudit
  extends Record<string, StarkAiDatabaseSafeSummaryJsonValue> {
  providerName: 'StarkAiDatabaseSafeSummaryProvider';
  providerVersion: 'v1';
  requestId: string;
  summaryType: string;
  generatedAt: string;
  requestedByRole: string;
  permissionResult: 'allowed' | 'blocked';
  blocked: boolean;
  blockedReasons: string[];
  sourceKind: string;
  syntheticOnly: boolean;
  auditPersisted: false;
}

export interface StarkAiDatabaseSafeSummaryEnvelope {
  summaryType: string;
  summaryVersion: 'safe_summary_v1';
  generatedAt: string;
  requestedByRole: string;
  permissionScope: string;
  readOnly: true;
  dataSourceScope: string[];
  recordsConsidered: number;
  recordsReturned: number;
  aggregationLevel: StarkAiDatabaseSafeSummaryAggregationLevel;
  redactionReport: StarkAiDatabaseSafeSummaryRedactionReport;
  safeBoundaryFlags: StarkAiDatabaseSafeSummaryBoundaryFlags;
  audit: StarkAiDatabaseSafeSummaryAudit;
  summary: StarkAiDatabaseSafeSummaryJsonValue;
}

interface SummaryTypeConfig {
  intent: string;
  defaultDataSourceScope: readonly string[];
  allowedRoles: readonly string[];
  detailRoles: readonly string[];
}

interface RoleResolution {
  normalizedRole: string;
  blockedReason: string | null;
}

interface UnsafeInputScanReport {
  rawSmsDetected: number;
  verificationCodeDetected: number;
  fullPhoneDetected: number;
  fullBankAccountDetected: number;
  secretsDetected: number;
  databaseFilesDetected: number;
  runtimeLogsDetected: number;
  privateKeysDetected: number;
  certificatesDetected: number;
  productionPayloadsDetected: number;
  forbiddenActionPayloadDetected: number;
}

interface SafeRecordSummary
  extends Record<string, StarkAiDatabaseSafeSummaryJsonValue> {
  safeRecordId: string;
  sourceName: string;
  category: string;
  status: string;
  riskLevel: string;
  amountBucket: string;
  safeLabel: string;
  blockerLabel: string;
  maskedAccountTail: string | null;
  maskedCustomerId: string | null;
  ownerRoleHint: string | null;
  finality: 'final' | 'non_final';
}

const SUMMARY_VERSION = 'safe_summary_v1' as const;
const PROVIDER_NAME = 'StarkAiDatabaseSafeSummaryProvider' as const;
const PROVIDER_VERSION = 'v1' as const;
const DEFAULT_REQUEST_ID = 'synthetic-safe-summary-request';

const ALLOWED_SUMMARY_TYPES = [
  'finance_safe_summary',
  'work_order_safe_summary',
  'customer_safe_summary',
  'employee_task_safe_summary',
  'inventory_safe_summary',
  'invoice_receivable_safe_summary',
] as const;

const SUMMARY_CONFIG: Record<StarkAiDatabaseSafeSummaryType, SummaryTypeConfig> = {
  finance_safe_summary: {
    intent:
      'Summarize finance health, unmatched evidence, pending binding, and reconciliation blockers without confirmation or ledger impact.',
    defaultDataSourceScope: [
      'synthetic_finance_health_fixture',
      'synthetic_reconciliation_blocker_fixture',
    ],
    allowedRoles: ['owner', 'admin', 'finance', 'reviewer'],
    detailRoles: ['owner', 'admin'],
  },
  work_order_safe_summary: {
    intent:
      'Summarize work-order backlog, overdue buckets, payment-state blockers, and completion risks without work-order mutation.',
    defaultDataSourceScope: [
      'synthetic_work_order_backlog_fixture',
      'synthetic_work_order_blocker_fixture',
    ],
    allowedRoles: ['owner', 'admin', 'reviewer', 'operator', 'customer_service'],
    detailRoles: ['owner', 'admin', 'reviewer'],
  },
  customer_safe_summary: {
    intent:
      'Summarize customer risk, service follow-up buckets, and masked identity context without full phone output or customer-right issuance.',
    defaultDataSourceScope: [
      'synthetic_customer_risk_fixture',
      'synthetic_customer_follow_up_fixture',
    ],
    allowedRoles: ['owner', 'admin', 'reviewer', 'customer_service'],
    detailRoles: ['owner', 'admin'],
  },
  employee_task_safe_summary: {
    intent:
      'Summarize employee task blockers, handoff readiness, overdue buckets, and review needs without dispatch or task lifecycle mutation.',
    defaultDataSourceScope: [
      'synthetic_employee_task_fixture',
      'synthetic_handoff_readiness_fixture',
    ],
    allowedRoles: ['owner', 'admin', 'reviewer', 'operator', 'employee_manager'],
    detailRoles: ['owner', 'admin', 'reviewer'],
  },
  inventory_safe_summary: {
    intent:
      'Summarize stock risk, special material flags, pending usage, and stale inventory buckets without stock, cost, or supplier mutation.',
    defaultDataSourceScope: [
      'synthetic_inventory_risk_fixture',
      'synthetic_special_material_fixture',
    ],
    allowedRoles: ['owner', 'admin', 'reviewer', 'inventory', 'warehouse'],
    detailRoles: ['owner', 'admin', 'reviewer'],
  },
  invoice_receivable_safe_summary: {
    intent:
      'Summarize missing invoice, receivable aging, paid-uninvoiced, and overdue collection buckets without invoice or payment creation.',
    defaultDataSourceScope: [
      'synthetic_invoice_gap_fixture',
      'synthetic_receivable_aging_fixture',
    ],
    allowedRoles: ['owner', 'admin', 'finance', 'reviewer'],
    detailRoles: ['owner', 'admin'],
  },
};

const ROLE_ALIASES: Record<string, string> = {
  owner: 'owner',
  founder: 'owner',
  boss: 'owner',
  admin: 'admin',
  system_admin: 'admin',
  super_admin: 'admin',
  finance: 'finance',
  finance_manager: 'finance',
  finance_operator: 'finance',
  reviewer: 'reviewer',
  approver: 'reviewer',
  operator: 'operator',
  ai_operator: 'operator',
  store_manager: 'operator',
  customer_service: 'customer_service',
  customer_support: 'customer_service',
  employee_manager: 'employee_manager',
  hr: 'employee_manager',
  inventory: 'inventory',
  warehouse: 'warehouse',
  warehouse_admin: 'warehouse',
};

const EMPTY_SCAN_REPORT: UnsafeInputScanReport = {
  rawSmsDetected: 0,
  verificationCodeDetected: 0,
  fullPhoneDetected: 0,
  fullBankAccountDetected: 0,
  secretsDetected: 0,
  databaseFilesDetected: 0,
  runtimeLogsDetected: 0,
  privateKeysDetected: 0,
  certificatesDetected: 0,
  productionPayloadsDetected: 0,
  forbiddenActionPayloadDetected: 0,
};

const NON_FINAL_STATUSES = new Set([
  'pending',
  'inferred',
  'uncertain',
  'reference_only',
  'reference-only',
  'pending_binding',
  'pending_account_evidence',
  'unmatched_exception',
]);

const FORBIDDEN_ACTION_CODES = [
  'confirm_bank_sms',
  'ignore_bank_sms',
  'reconcile_bank_sms',
  'confirm_bank_sms_apply',
  'create_collection_order',
  'create_confirmed_collection_order',
  'create_payment_record',
  'update_work_order_status',
  'update_work_order_amount_received',
  'execute_payment',
  'mutate_virtual_ledger',
  'confirm_payroll',
  'issue_employee_benefits',
  'confirm_customer_rights',
  'invoke_real_wechat_pay',
  'bypass_approval_or_permission',
] as const;

const REDACTED_SENSITIVE_MARKER = '[redacted_sensitive]';
const REDACTED_PHONE_MARKER = '[redacted_phone]';
const REDACTED_ACCOUNT_MARKER = '[redacted_account]';
const BLOCKED_ACTION_MARKER = '[blocked_action]';

@Injectable()
export class StarkAiDatabaseSafeSummaryProviderService {
  toSafeSummaryEnvelope(
    input: StarkAiDatabaseSafeSummaryProviderInput,
  ): StarkAiDatabaseSafeSummaryEnvelope {
    const generatedAt = this.resolveGeneratedAt(input.generatedAt);
    const summaryType = this.normalizeSummaryType(input.summaryType);
    const sourceKind = this.normalizeToken(input.sourceKind ?? 'synthetic_fixture');
    const records = [...(input.syntheticRecords ?? [])];
    const role = this.resolveRequestedRole(input.requestedByRole);
    const scanReport = this.scanUnsafeInput(input);
    const redactionReport = this.buildRedactionReport(scanReport);
    const requestId =
      this.sanitizeText(input.requestId, ['requestId']) || DEFAULT_REQUEST_ID;
    const config = this.isAllowedSummaryType(summaryType)
      ? SUMMARY_CONFIG[summaryType]
      : null;
    const blockedReasons = this.resolveBlockedReasons(
      summaryType,
      sourceKind,
      role,
      config,
    );
    const blocked = blockedReasons.length > 0;
    const detailAllowed =
      !blocked && config
        ? config.detailRoles.includes(role.normalizedRole)
        : false;
    const aggregationLevel =
      !blocked && detailAllowed
        ? 'redacted_item_summary'
        : !blocked
          ? 'bucketed'
          : 'aggregate';
    const safeRecords = records.map((record, index) =>
      this.toSafeRecordSummary(record, index, summaryType),
    );
    const recordsReturned =
      !blocked && detailAllowed ? Math.min(safeRecords.length, 3) : 0;
    const dataSourceScope = this.resolveDataSourceScope(
      input.dataSourceScope,
      config,
    );

    return {
      summaryType: this.sanitizeText(summaryType, ['summaryType']),
      summaryVersion: SUMMARY_VERSION,
      generatedAt,
      requestedByRole: role.normalizedRole,
      permissionScope: this.buildPermissionScope(
        role.normalizedRole,
        summaryType,
        blocked,
        aggregationLevel,
      ),
      readOnly: true,
      dataSourceScope,
      recordsConsidered: blocked ? 0 : safeRecords.length,
      recordsReturned,
      aggregationLevel,
      redactionReport,
      safeBoundaryFlags: this.buildSafeBoundaryFlags(),
      audit: {
        providerName: PROVIDER_NAME,
        providerVersion: PROVIDER_VERSION,
        requestId,
        summaryType: this.sanitizeText(summaryType, ['summaryType']),
        generatedAt,
        requestedByRole: role.normalizedRole,
        permissionResult: blocked ? 'blocked' : 'allowed',
        blocked,
        blockedReasons,
        sourceKind,
        syntheticOnly: sourceKind === 'synthetic_fixture',
        auditPersisted: false,
      },
      summary: blocked
        ? this.buildBlockedSummary(summaryType, blockedReasons)
        : this.buildAllowedSummary(summaryType, config, safeRecords, detailAllowed),
    };
  }

  toSafeSummaryBatch(
    inputs: readonly StarkAiDatabaseSafeSummaryProviderInput[],
  ): StarkAiDatabaseSafeSummaryEnvelope[] {
    return inputs.map((input) => this.toSafeSummaryEnvelope(input));
  }

  allowedSummaryTypes(): StarkAiDatabaseSafeSummaryType[] {
    return [...ALLOWED_SUMMARY_TYPES];
  }

  private buildAllowedSummary(
    summaryType: string,
    config: SummaryTypeConfig | null,
    safeRecords: readonly SafeRecordSummary[],
    detailAllowed: boolean,
  ): StarkAiDatabaseSafeSummaryJsonValue {
    return {
      summaryTypeSupported: true,
      summaryIntent: config?.intent ?? 'Safe summary type.',
      sourceMode: 'synthetic_fixture_or_safe_input_only',
      finalityNotice:
        'pending, inferred, uncertain, and reference-only facts remain non-final review context.',
      statusBuckets: this.countBy(safeRecords, (record) => record.status),
      categoryBuckets: this.countBy(safeRecords, (record) => record.category),
      riskBuckets: this.countBy(safeRecords, (record) => record.riskLevel),
      amountBuckets: this.countBy(safeRecords, (record) => record.amountBucket),
      blockerBuckets: this.countBy(safeRecords, (record) => record.blockerLabel),
      nonFinalRecordCount: safeRecords.filter(
        (record) => record.finality === 'non_final',
      ).length,
      safeReviewItems: detailAllowed ? safeRecords.slice(0, 3) : [],
      permissionFilteredDetailCount: detailAllowed ? 0 : safeRecords.length,
      prohibitedActionNotice:
        'Summary output is review context only and cannot execute, approve, confirm, dispatch, mutate, or create business records.',
      summaryBoundary: {
        canReadDatabase: false,
        canWriteDatabase: false,
        canConfirmFinance: false,
        canCreatePaymentOrCollection: false,
        canMutateWorkOrder: false,
        canMutateVirtualLedger: false,
        canDispatchTask: false,
        canCreateTask: false,
        canMutateLifecycle: false,
        canIssuePayrollBenefitsOrCustomerRights: false,
        canExecuteRealWechatPay: false,
      },
      summaryType,
    };
  }

  private buildBlockedSummary(
    summaryType: string,
    blockedReasons: readonly string[],
  ): StarkAiDatabaseSafeSummaryJsonValue {
    return {
      summaryTypeSupported: this.isAllowedSummaryType(summaryType),
      outputSuppressed: true,
      blockedReasons: [...blockedReasons],
      allowedSummaryTypes: [...ALLOWED_SUMMARY_TYPES],
      safeReviewItems: [],
      permissionFilteredDetailCount: 0,
      blockedBoundaryNotice:
        'Blocked summaries do not expose source records and keep all mutation counters at zero.',
    };
  }

  private resolveBlockedReasons(
    summaryType: string,
    sourceKind: string,
    role: RoleResolution,
    config: SummaryTypeConfig | null,
  ): string[] {
    const reasons: string[] = [];
    if (!config) {
      reasons.push('summary_type_not_allowlisted');
    }
    if (role.blockedReason) {
      reasons.push(role.blockedReason);
    }
    if (!['synthetic_fixture', 'safe_input'].includes(sourceKind)) {
      reasons.push('source_kind_not_allowed_in_skeleton');
    }
    if (
      config &&
      !role.blockedReason &&
      !config.allowedRoles.includes(role.normalizedRole)
    ) {
      reasons.push('summary_type_not_allowed_for_role');
    }
    return this.uniqueStrings(reasons);
  }

  private resolveRequestedRole(role: string | null | undefined): RoleResolution {
    const normalized = this.normalizeToken(role);
    if (!normalized) {
      return {
        normalizedRole: 'missing',
        blockedReason: 'requested_role_missing',
      };
    }
    const canonicalRole = ROLE_ALIASES[normalized];
    if (!canonicalRole) {
      return {
        normalizedRole: normalized,
        blockedReason: 'requested_role_unknown',
      };
    }
    return {
      normalizedRole: canonicalRole,
      blockedReason: null,
    };
  }

  private resolveDataSourceScope(
    inputScope: readonly unknown[] | null | undefined,
    config: SummaryTypeConfig | null,
  ): string[] {
    const scope = inputScope?.length
      ? inputScope
      : (config?.defaultDataSourceScope ?? ['synthetic_safe_summary_fixture']);
    return this.uniqueStrings(
      scope
        .map((item) => this.sanitizeText(item, ['dataSourceScope']))
        .filter((item) => item.length > 0),
    );
  }

  private buildPermissionScope(
    role: string,
    summaryType: string,
    blocked: boolean,
    aggregationLevel: StarkAiDatabaseSafeSummaryAggregationLevel,
  ): string {
    const status = blocked ? 'blocked' : 'allowed';
    return `${role}:${summaryType}:${status}:${aggregationLevel}`;
  }

  private toSafeRecordSummary(
    record: StarkAiDatabaseSafeSummarySyntheticRecord,
    index: number,
    summaryType: string,
  ): SafeRecordSummary {
    const sourceName =
      this.sanitizeText(record.sourceName, ['sourceName']) ||
      `synthetic_${summaryType}_fixture`;
    const status =
      this.normalizeToken(record.status) || 'reference_only';
    return {
      safeRecordId:
        this.sanitizeText(record.safeRecordId, ['safeRecordId']) ||
        `synthetic-${summaryType}-${index + 1}`,
      sourceName,
      category:
        this.normalizeToken(record.category) || `${summaryType}_review_bucket`,
      status,
      riskLevel: this.normalizeToken(record.riskLevel) || 'review',
      amountBucket: this.normalizeToken(record.amountBucket) || 'aggregate_only',
      safeLabel:
        this.sanitizeText(record.safeLabel, ['safeLabel']) ||
        'Safe redacted summary item',
      blockerLabel:
        this.normalizeToken(record.blockerLabel) || 'no_blocker_label',
      maskedAccountTail: this.sanitizeNullableText(record.maskedAccountTail, [
        'maskedAccountTail',
      ]),
      maskedCustomerId: this.sanitizeNullableText(record.maskedCustomerId, [
        'maskedCustomerId',
      ]),
      ownerRoleHint: this.sanitizeNullableText(record.ownerRoleHint, [
        'ownerRoleHint',
      ]),
      finality: NON_FINAL_STATUSES.has(status) ? 'non_final' : 'final',
    };
  }

  private buildRedactionReport(
    scanReport: UnsafeInputScanReport,
  ): StarkAiDatabaseSafeSummaryRedactionReport {
    const redactionReasons: string[] = [];
    const detectionMap: Array<[keyof UnsafeInputScanReport, string]> = [
      ['rawSmsDetected', 'raw_sms_redacted'],
      ['verificationCodeDetected', 'verification_code_redacted'],
      ['fullPhoneDetected', 'full_phone_redacted'],
      ['fullBankAccountDetected', 'full_bank_account_redacted'],
      ['secretsDetected', 'secret_redacted'],
      ['databaseFilesDetected', 'database_file_redacted'],
      ['runtimeLogsDetected', 'runtime_log_redacted'],
      ['privateKeysDetected', 'private_key_redacted'],
      ['certificatesDetected', 'certificate_redacted'],
      ['productionPayloadsDetected', 'production_payload_redacted'],
      ['forbiddenActionPayloadDetected', 'forbidden_action_payload_redacted'],
    ];
    for (const [field, reason] of detectionMap) {
      if (scanReport[field] > 0) {
        redactionReasons.push(reason);
      }
    }
    return {
      rawSmsIncluded: false,
      verificationCodesIncluded: false,
      fullPhoneIncluded: false,
      fullBankAccountIncluded: false,
      secretsIncluded: false,
      databaseFilesIncluded: false,
      runtimeLogsIncluded: false,
      privateKeysIncluded: false,
      certificatesIncluded: false,
      productionPayloadsIncluded: false,
      sensitiveInputDetected: redactionReasons.length > 0,
      redactionApplied: redactionReasons.length > 0,
      detectionCounts: { ...scanReport },
      redactionReasons,
    };
  }

  private buildSafeBoundaryFlags(): StarkAiDatabaseSafeSummaryBoundaryFlags {
    return {
      databaseReadCounter: 0,
      databaseWriteCounter: 0,
      businessWriteCounter: 0,
      businessExecutionCounter: 0,
      dispatchCounter: 0,
      taskCreationCounter: 0,
      lifecycleMutationCounter: 0,
      bankSmsConfirmationCounter: 0,
      collectionOrPaymentCreationCounter: 0,
      workOrderMutationCounter: 0,
      virtualLedgerMutationCounter: 0,
      payrollBenefitCustomerRightCounter: 0,
      realWechatPayCounter: 0,
      readOnly: true,
      reviewContextOnly: true,
      directSqlAllowed: false,
      arbitraryTableReadAllowed: false,
      rawDatabaseRowsAllowed: false,
      commandPayloadAllowed: false,
      businessExecutionAllowed: false,
    };
  }

  private scanUnsafeInput(input: unknown): UnsafeInputScanReport {
    const scanReport: UnsafeInputScanReport = { ...EMPTY_SCAN_REPORT };
    this.scanValue(input, scanReport, []);
    return scanReport;
  }

  private scanValue(
    value: unknown,
    scanReport: UnsafeInputScanReport,
    contextPath: readonly string[],
  ): void {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      this.scanText(String(value), scanReport, contextPath);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => this.scanValue(item, scanReport, contextPath));
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
        this.scanText(key, scanReport, [...contextPath, 'fieldName']);
        this.scanValue(entry, scanReport, [...contextPath, key]);
      });
    }
  }

  private scanText(
    text: string,
    scanReport: UnsafeInputScanReport,
    contextPath: readonly string[],
  ): void {
    if (!text) {
      return;
    }
    if (/<RAW_SMS_BODY_BLOCKED>|raw[_\s-]?sms|rawSmsBody/i.test(text)) {
      scanReport.rawSmsDetected += 1;
    }
    if (
      /<VERIFICATION_CODE_BLOCKED>|verification[_\s-]?(code|marker|value)|verificationCodeValue/i.test(
        text,
      )
    ) {
      scanReport.verificationCodeDetected += 1;
    }
    if (/<FULL_PHONE_BLOCKED>|full[_\s-]?phone|\b1[3-9]\d{9}\b/i.test(text)) {
      scanReport.fullPhoneDetected += 1;
    }
    if (
      /<FULL_BANK_ACCOUNT_BLOCKED>|full[_\s-]?(bank[_\s-]?)?account/i.test(
        text,
      ) ||
      (/\b\d{12,}\b/.test(text) &&
        this.hasBankAccountContext(contextPath, text))
    ) {
      scanReport.fullBankAccountDetected += 1;
    }
    if (
      /<SECRET_BLOCKED>|secret[_\s-]?(marker|value|payload)?|token=|password=|\.env/i.test(
        text,
      )
    ) {
      scanReport.secretsDetected += 1;
    }
    if (/database[_\s-]?file|db[_\s-]?file/i.test(text)) {
      scanReport.databaseFilesDetected += 1;
    }
    if (/runtime[_\s-]?log/i.test(text)) {
      scanReport.runtimeLogsDetected += 1;
    }
    if (/private[_\s-]?key/i.test(text)) {
      scanReport.privateKeysDetected += 1;
    }
    if (/certificate|cert[_\s-]?marker/i.test(text)) {
      scanReport.certificatesDetected += 1;
    }
    if (
      /productionConnector|production[_\s-]?connector|payment[_\s-]?provider[_\s-]?payload/i.test(
        text,
      )
    ) {
      scanReport.productionPayloadsDetected += 1;
    }
    if (this.hasForbiddenActionCode(text) && this.isActionPayloadContext(contextPath)) {
      scanReport.forbiddenActionPayloadDetected += 1;
    }
  }

  private sanitizeText(value: unknown, contextPath: readonly string[]): string {
    if (value === undefined || value === null) {
      return '';
    }
    let text = String(value).trim();
    if (!text) {
      return '';
    }
    for (const code of FORBIDDEN_ACTION_CODES) {
      text = text.replace(
        new RegExp(this.escapeRegExp(code), 'gi'),
        BLOCKED_ACTION_MARKER,
      );
    }
    return text
      .replace(/\b1[3-9]\d{9}\b/g, REDACTED_PHONE_MARKER)
      .replace(/\b\d{12,}\b/g, (match) =>
        this.hasBankAccountContext(contextPath, text)
          ? REDACTED_ACCOUNT_MARKER
          : match,
      )
      .replace(/<RAW_SMS_BODY_BLOCKED>/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/<VERIFICATION_CODE_BLOCKED>/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/<FULL_PHONE_BLOCKED>/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/<FULL_BANK_ACCOUNT_BLOCKED>/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/<SECRET_BLOCKED>/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/rawSmsBody/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/raw[_\s-]?sms[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /verificationCodeValue|verification[_\s-]?(code|marker|value)[_\s:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(/full[_\s-]?phone[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /full[_\s-]?(bank[_\s-]?)?account[_\s:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(
        /secret[_\s-]?(marker|value|payload)?[_\s:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(/token=[^\s,;]+/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/password=[^\s,;]+/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/private[_\s-]?key[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/certificate[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/cert[_\s-]?marker[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/database[_\s-]?file[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/db[_\s-]?file[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/runtime[_\s-]?log[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /productionConnector[_\s:a-z0-9-]*|production[_\s-]?connector[_\s:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(
        /payment[_\s-]?provider[_\s-]?payload[_\s:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(/\.env/gi, REDACTED_SENSITIVE_MARKER)
      .trim();
  }

  private sanitizeNullableText(
    value: unknown,
    contextPath: readonly string[],
  ): string | null {
    const sanitized = this.sanitizeText(value, contextPath);
    return sanitized || null;
  }

  private normalizeSummaryType(value: unknown): string {
    return this.normalizeToken(value);
  }

  private normalizeToken(value: unknown): string {
    return this.sanitizeText(value, ['token'])
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private resolveGeneratedAt(value: string | Date | null | undefined): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value.trim() : date.toISOString();
    }
    return new Date().toISOString();
  }

  private countBy<T>(
    items: readonly T[],
    getKey: (item: T) => string,
  ): Record<string, number> {
    return items.reduce<Record<string, number>>((buckets, item) => {
      const key = getKey(item) || 'unknown';
      buckets[key] = (buckets[key] ?? 0) + 1;
      return buckets;
    }, {});
  }

  private isAllowedSummaryType(
    value: string,
  ): value is StarkAiDatabaseSafeSummaryType {
    return ALLOWED_SUMMARY_TYPES.includes(value as StarkAiDatabaseSafeSummaryType);
  }

  private hasForbiddenActionCode(text: string): boolean {
    return FORBIDDEN_ACTION_CODES.some((code) =>
      new RegExp(this.escapeRegExp(code), 'i').test(text),
    );
  }

  private isActionPayloadContext(contextPath: readonly string[]): boolean {
    return contextPath.some((key) => {
      const normalized = this.normalizeToken(key);
      return (
        normalized.includes('command') ||
        normalized.includes('action') ||
        normalized.includes('payload') ||
        normalized.includes('instruction') ||
        normalized.includes('executable')
      );
    });
  }

  private hasBankAccountContext(
    contextPath: readonly string[],
    text: string,
  ): boolean {
    const normalizedContext = contextPath
      .map((key) => this.normalizeContextKey(key))
      .join(' ');
    const lowerText = text.toLowerCase();
    const bankContextPattern =
      /bank[_\s-]?account|full[_\s-]?(bank[_\s-]?)?account|account[_\s-]?(number|no)|card[_\s-]?(number|no)|\bbank\b|\baccount\b|\bcard\b|银行|银行账户|银行账号|银行卡|账户|账号|卡号/i;
    if (bankContextPattern.test(lowerText)) {
      return true;
    }
    return normalizedContext.split(/\s+/).some(
      (key) =>
        [
          'bank',
          'account',
          'card',
          'bankaccount',
          'fullbankaccount',
          'fullaccount',
          'accountnumber',
          'accountno',
          'cardnumber',
          'cardno',
          '银行',
          '银行账户',
          '银行账号',
          '银行卡',
          '账户',
          '账号',
          '卡号',
        ].includes(key) ||
        key.includes('account') ||
        key.includes('bank') ||
        key.includes('bankaccount') ||
        key.includes('fullbankaccount') ||
        key.includes('accountnumber') ||
        key.includes('bankcard') ||
        key.includes('fullcard') ||
        key.includes('cardnumber'),
    );
  }

  private normalizeContextKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private uniqueStrings(items: readonly string[]): string[] {
    return [...new Set(items)];
  }
}
