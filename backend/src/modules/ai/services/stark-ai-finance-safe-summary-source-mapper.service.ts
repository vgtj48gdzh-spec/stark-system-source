import { Injectable } from '@nestjs/common';
import {
  type StarkAiDatabaseSafeSummaryProviderInput,
  type StarkAiDatabaseSafeSummarySyntheticRecord,
} from './stark-ai-database-safe-summary-provider.service';

export type StarkAiFinanceSafeSummarySourceKind =
  | 'safe_input'
  | 'synthetic_fixture';

export interface StarkAiFinanceSafeSummarySourceRow {
  safeSourceName?: unknown;
  safeRecordId?: unknown;
  evidenceStatus?: unknown;
  reconciliationStatus?: unknown;
  amountBucket?: unknown;
  riskLevel?: unknown;
  blockerLabel?: unknown;
  maskedAccountTail?: unknown;
  counterpartyPresence?: unknown;
  invoiceOrReceivableState?: unknown;
  sourceFinality?: unknown;
  [key: string]: unknown;
}

export interface StarkAiFinanceSafeSummarySourceMapperOptions {
  requestedByRole?: string | null;
  requestId?: string | null;
  generatedAt?: string | Date | null;
  sourceKind?: StarkAiFinanceSafeSummarySourceKind | string | null;
  dataSourceScope?: readonly unknown[] | null;
}

interface FinanceSourceScanReport {
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
  paymentPayloadDetected: number;
  workOrderMutationDetected: number;
  executableCommandDetected: number;
}

interface MaskedTailResolution {
  value: string | null;
  blockedReason: string | null;
}

const FINANCE_SAFE_SUMMARY_TYPE = 'finance_safe_summary' as const;
const DEFAULT_REQUEST_ID = 'finance-safe-summary-source-mapper';
const DEFAULT_SAFE_SOURCE_NAME =
  'finance_safe_summary_source_mapper_synthetic_fixture';

const EMPTY_SCAN_REPORT: FinanceSourceScanReport = {
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
  paymentPayloadDetected: 0,
  workOrderMutationDetected: 0,
  executableCommandDetected: 0,
};

const NON_FINAL_STATUSES = new Set([
  'pending',
  'pending_binding',
  'pending_account_evidence',
  'unmatched_exception',
  'inferred',
  'uncertain',
  'reference_only',
  'reference-only',
  'review_only',
  'review-only',
]);

const FINAL_STATUSES = new Set([
  'confirmed',
  'matched_confirmed',
  'final',
  'settled',
]);

const REDACTED_SENSITIVE_MARKER = '[redacted_sensitive]';
const REDACTED_PHONE_MARKER = '[redacted_phone]';
const REDACTED_ACCOUNT_MARKER = '[redacted_account]';
const BLOCKED_ACTION_MARKER = '[blocked_action]';

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

@Injectable()
export class StarkAiFinanceSafeSummarySourceMapperService {
  toProviderInput(
    rows: readonly StarkAiFinanceSafeSummarySourceRow[],
    options: StarkAiFinanceSafeSummarySourceMapperOptions = {},
  ): StarkAiDatabaseSafeSummaryProviderInput {
    const sourceKind = this.resolveSourceKind(options.sourceKind);
    const syntheticRecords = rows.map((row, index) =>
      this.toSyntheticRecord(row, index),
    );
    return {
      summaryType: FINANCE_SAFE_SUMMARY_TYPE,
      requestedByRole: this.sanitizeText(options.requestedByRole, [
        'requestedByRole',
      ]) || 'finance',
      requestId:
        this.sanitizeText(options.requestId, ['requestId']) ||
        DEFAULT_REQUEST_ID,
      generatedAt: options.generatedAt ?? undefined,
      sourceKind,
      dataSourceScope: this.resolveDataSourceScope(
        options.dataSourceScope,
        syntheticRecords,
      ),
      syntheticRecords,
    };
  }

  private toSyntheticRecord(
    row: StarkAiFinanceSafeSummarySourceRow,
    index: number,
  ): StarkAiDatabaseSafeSummarySyntheticRecord {
    const scanReport = this.scanUnsafeInput(row);
    const blockedReasons = this.resolveBlockedReasons(scanReport);
    const tail = this.resolveMaskedAccountTail(row.maskedAccountTail);
    if (tail.blockedReason) {
      blockedReasons.push(tail.blockedReason);
    }
    const blocked = blockedReasons.length > 0;
    const sourceName =
      this.normalizeToken(row.safeSourceName) || DEFAULT_SAFE_SOURCE_NAME;
    const status = blocked ? 'reference_only' : this.resolveStatus(row);
    const reconciliationStatus =
      this.normalizeToken(row.reconciliationStatus) || 'review_only';
    const counterpartyPresence =
      this.normalizeToken(row.counterpartyPresence) || 'not_provided';
    const invoiceOrReceivableState =
      this.normalizeToken(row.invoiceOrReceivableState) || 'not_provided';
    const sourceFinality =
      this.normalizeToken(row.sourceFinality) || 'review_only';

    return {
      safeRecordId: this.buildSafeRecordId(row.safeRecordId, index),
      sourceName,
      category: this.buildCategory(sourceName, status, reconciliationStatus),
      status,
      riskLevel: blocked
        ? 'blocked'
        : this.normalizeToken(row.riskLevel) || 'review',
      amountBucket:
        this.normalizeToken(row.amountBucket) || 'amount_bucket_not_provided',
      safeLabel: this.buildSafeLabel({
        sourceName,
        status,
        reconciliationStatus,
        counterpartyPresence,
        invoiceOrReceivableState,
        sourceFinality,
        blocked,
      }),
      blockerLabel: blocked
        ? this.buildBlockedLabel(blockedReasons)
        : this.normalizeToken(row.blockerLabel) ||
          this.defaultBlockerLabelForStatus(status),
      maskedAccountTail: blocked ? null : tail.value,
      ownerRoleHint: 'finance',
      counterpartyPresence,
      invoiceOrReceivableState,
      sourceFinality,
      mapperBlocked: blocked,
      mapperBlockedReasons: blockedReasons,
    };
  }

  private resolveStatus(row: StarkAiFinanceSafeSummarySourceRow): string {
    const candidates = [
      this.normalizeToken(row.evidenceStatus),
      this.normalizeToken(row.reconciliationStatus),
      this.normalizeToken(row.sourceFinality),
    ].filter((item) => item.length > 0);
    const nonFinal = candidates.find((item) => this.isNonFinalStatus(item));
    if (nonFinal) {
      return this.normalizeNonFinalStatus(nonFinal);
    }
    if (candidates.length > 0 && candidates.every((item) => FINAL_STATUSES.has(item))) {
      return 'confirmed';
    }
    const firstStatus = candidates[0];
    if (firstStatus && FINAL_STATUSES.has(firstStatus)) {
      return firstStatus;
    }
    return 'reference_only';
  }

  private buildSafeRecordId(value: unknown, index: number): string {
    const sanitized = this
      .sanitizeText(value, ['safeRecordId'])
      .replace(/\b\d{12,}\b/g, REDACTED_ACCOUNT_MARKER);
    return sanitized || `finance-safe-source-row-${index + 1}`;
  }

  private buildCategory(
    sourceName: string,
    status: string,
    reconciliationStatus: string,
  ): string {
    return this.normalizeToken(
      `finance_safe_summary_${sourceName}_${status}_${reconciliationStatus}`,
    );
  }

  private buildSafeLabel(input: {
    sourceName: string;
    status: string;
    reconciliationStatus: string;
    counterpartyPresence: string;
    invoiceOrReceivableState: string;
    sourceFinality: string;
    blocked: boolean;
  }): string {
    if (input.blocked) {
      return 'Blocked unsafe finance source row; sensitive details were removed before provider input.';
    }
    return this.sanitizeText(
      [
        'Safe finance source row',
        `source=${input.sourceName}`,
        `status=${input.status}`,
        `reconciliation=${input.reconciliationStatus}`,
        `counterparty=${input.counterpartyPresence}`,
        `invoice_or_receivable=${input.invoiceOrReceivableState}`,
        `finality=${input.sourceFinality}`,
      ].join('; '),
      ['safeLabel'],
    );
  }

  private buildBlockedLabel(blockedReasons: readonly string[]): string {
    const reason = blockedReasons[0] || 'unsafe_source_row_blocked';
    return this.normalizeToken(`blocked_sensitive_source_row_${reason}`);
  }

  private defaultBlockerLabelForStatus(status: string): string {
    return this.isNonFinalStatus(status)
      ? 'non_final_finance_review'
      : 'no_blocker_label';
  }

  private resolveMaskedAccountTail(value: unknown): MaskedTailResolution {
    const text = this.sanitizeText(value, ['maskedAccountTail']);
    if (!text) {
      return { value: null, blockedReason: null };
    }
    if (
      text.includes(REDACTED_ACCOUNT_MARKER) ||
      text.includes(REDACTED_PHONE_MARKER) ||
      text.includes(REDACTED_SENSITIVE_MARKER)
    ) {
      return {
        value: null,
        blockedReason: 'masked_account_tail_contains_sensitive_value',
      };
    }
    const compact = text.toLowerCase().replace(/\s+/g, '');
    const tailMatch = compact.match(/^(?:tail|account_tail|masked_tail)_?(\d{1,4})$/);
    if (tailMatch) {
      return { value: `tail_${tailMatch[1]}`, blockedReason: null };
    }
    const maskedMatch = compact.match(/^\*{2,}(\d{1,4})$/);
    if (maskedMatch) {
      return { value: `tail_${maskedMatch[1]}`, blockedReason: null };
    }
    if (/^\d{1,4}$/.test(compact)) {
      return { value: `tail_${compact}`, blockedReason: null };
    }
    return {
      value: null,
      blockedReason: 'masked_account_tail_not_tail_or_masked',
    };
  }

  private resolveSourceKind(
    value: StarkAiFinanceSafeSummarySourceKind | string | null | undefined,
  ): StarkAiFinanceSafeSummarySourceKind {
    const normalized = this.normalizeToken(value);
    return normalized === 'synthetic_fixture' ? 'synthetic_fixture' : 'safe_input';
  }

  private resolveDataSourceScope(
    inputScope: readonly unknown[] | null | undefined,
    records: readonly StarkAiDatabaseSafeSummarySyntheticRecord[],
  ): string[] {
    const rawScope = inputScope?.length
      ? inputScope
      : [
          'finance_safe_summary_source_mapper',
          ...records.map((record) => record.sourceName),
        ];
    return this.uniqueStrings(
      rawScope
        .map((item) => this.normalizeToken(item))
        .filter((item) => item.length > 0),
    );
  }

  private resolveBlockedReasons(scanReport: FinanceSourceScanReport): string[] {
    const reasons: string[] = [];
    if (scanReport.rawSmsDetected > 0) {
      reasons.push('raw_sms_redacted');
    }
    if (scanReport.verificationCodeDetected > 0) {
      reasons.push('verification_code_redacted');
    }
    if (scanReport.fullPhoneDetected > 0) {
      reasons.push('full_phone_redacted');
    }
    if (scanReport.fullBankAccountDetected > 0) {
      reasons.push('full_bank_account_redacted');
    }
    if (scanReport.secretsDetected > 0) {
      reasons.push('secret_redacted');
    }
    if (scanReport.databaseFilesDetected > 0) {
      reasons.push('database_file_redacted');
    }
    if (scanReport.runtimeLogsDetected > 0) {
      reasons.push('runtime_log_redacted');
    }
    if (scanReport.privateKeysDetected > 0) {
      reasons.push('private_key_redacted');
    }
    if (scanReport.certificatesDetected > 0) {
      reasons.push('certificate_redacted');
    }
    if (scanReport.productionPayloadsDetected > 0) {
      reasons.push('production_payload_redacted');
    }
    if (scanReport.paymentPayloadDetected > 0) {
      reasons.push('payment_payload_blocked');
    }
    if (scanReport.workOrderMutationDetected > 0) {
      reasons.push('work_order_mutation_field_blocked');
    }
    if (scanReport.executableCommandDetected > 0) {
      reasons.push('executable_command_blocked');
    }
    return this.uniqueStrings(reasons);
  }

  private scanUnsafeInput(input: unknown): FinanceSourceScanReport {
    const scanReport: FinanceSourceScanReport = { ...EMPTY_SCAN_REPORT };
    this.scanValue(input, scanReport, []);
    return scanReport;
  }

  private scanValue(
    value: unknown,
    scanReport: FinanceSourceScanReport,
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
    scanReport: FinanceSourceScanReport,
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
      (/\b\d{12,}\b/.test(text) && this.hasAccountContext(contextPath, text))
    ) {
      scanReport.fullBankAccountDetected += 1;
    }
    if (
      /<SECRET_BLOCKED>|secret[_\s-]?(marker|value|payload)?|token=|password=|\.env|private[_\s-]?key|certificate/i.test(
        text,
      )
    ) {
      scanReport.secretsDetected += 1;
    }
    if (/database[_\s-]?file|db[_\s-]?file|\.(sqlite|db)\b/i.test(text)) {
      scanReport.databaseFilesDetected += 1;
    }
    if (/runtime[_\s-]?log|\.(log)\b/i.test(text)) {
      scanReport.runtimeLogsDetected += 1;
    }
    if (/private[_\s-]?key|BEGIN PRIVATE KEY/i.test(text)) {
      scanReport.privateKeysDetected += 1;
    }
    if (/certificate|cert[_\s-]?marker|BEGIN CERTIFICATE/i.test(text)) {
      scanReport.certificatesDetected += 1;
    }
    if (
      /productionConnector|production[_\s-]?connector|production[_\s-]?provider|provider[_\s-]?payload/i.test(
        text,
      )
    ) {
      scanReport.productionPayloadsDetected += 1;
    }
    if (/payment[_\s-]?(payload|provider|record)|real[_\s-]?payment/i.test(text)) {
      scanReport.paymentPayloadDetected += 1;
    }
    if (/work[_\s-]?order[_\s-]?(mutation|status|amount)/i.test(text)) {
      scanReport.workOrderMutationDetected += 1;
    }
    if (
      this.hasForbiddenActionCode(text) ||
      (this.isCommandContext(contextPath) && /execute|command|payload/i.test(text))
    ) {
      scanReport.executableCommandDetected += 1;
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
        this.hasAccountContext(contextPath, text) ? REDACTED_ACCOUNT_MARKER : match,
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
      .replace(/BEGIN PRIVATE KEY/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/certificate[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/cert[_\s-]?marker[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/BEGIN CERTIFICATE/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/database[_\s-]?file[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/db[_\s-]?file[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/\.(sqlite|db)\b/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/runtime[_\s-]?log[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/\.log\b/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /productionConnector[_\s:a-z0-9-]*|production[_\s-]?(connector|provider)[_\s:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(/provider[_\s-]?payload[_\s:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /paymentProviderPayload|payment[_\s-]?(provider[_\s-]?)?payload[_\s:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(
        /work[_\s-]?order[_\s-]?(mutation|status|amount)[_\s:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(/\.env/gi, REDACTED_SENSITIVE_MARKER)
      .trim();
  }

  private normalizeToken(value: unknown): string {
    return this.sanitizeText(value, ['token'])
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalizeNonFinalStatus(value: string): string {
    if (value === 'reference-only' || value === 'review-only') {
      return value.replace('-', '_');
    }
    return value;
  }

  private isNonFinalStatus(value: string): boolean {
    return (
      NON_FINAL_STATUSES.has(value) ||
      value.includes('pending') ||
      value.includes('inferred') ||
      value.includes('uncertain') ||
      value.includes('reference')
    );
  }

  private hasForbiddenActionCode(text: string): boolean {
    return FORBIDDEN_ACTION_CODES.some((code) =>
      new RegExp(this.escapeRegExp(code), 'i').test(text),
    );
  }

  private isCommandContext(contextPath: readonly string[]): boolean {
    return contextPath.some((key) => {
      const normalized = this.normalizeContextKey(key);
      return (
        normalized.includes('command') ||
        normalized.includes('action') ||
        normalized.includes('payload') ||
        normalized.includes('instruction') ||
        normalized.includes('executable')
      );
    });
  }

  private hasAccountContext(
    contextPath: readonly string[],
    text: string,
  ): boolean {
    const normalizedContext = contextPath
      .map((key) => this.normalizeContextKey(key))
      .join(' ');
    return (
      /bank[_\s-]?account|full[_\s-]?(bank[_\s-]?)?account|account[_\s-]?(number|no)|card[_\s-]?(number|no)|masked[_\s-]?account[_\s-]?tail|\bbank\b|\baccount\b|\bcard\b/i.test(
        text,
      ) ||
      normalizedContext.split(/\s+/).some(
        (key) =>
          key.includes('account') ||
          key.includes('bank') ||
          key.includes('card') ||
          key.includes('maskedaccounttail'),
      )
    );
  }

  private normalizeContextKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private uniqueStrings(items: readonly string[]): string[] {
    return [...new Set(items)];
  }
}
