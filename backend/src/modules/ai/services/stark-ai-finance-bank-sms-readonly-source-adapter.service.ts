import { Injectable } from '@nestjs/common';
import {
  type StarkAiFinanceReadonlySafeSummaryReader,
  type StarkAiFinanceReadonlySafeSummaryReaderContext,
  type StarkAiFinanceReadonlySafeSummaryReaderRow,
} from './stark-ai-finance-readonly-safe-summary-adapter.service';

export interface StarkAiFinanceBankSmsReadonlySourceRepositoryContext {
  requestId: string;
  generatedAt: string;
  requestedByRole: string;
  permissionScope: string;
  sourceName: 'bank_sms_transaction_sms_classification_summary';
  maxRows: number;
}

export interface StarkAiFinanceBankSmsReadonlySourceRepositoryRow {
  safeRecordId?: unknown;
  bankSmsTransactionId?: unknown;
  smsClassificationId?: unknown;
  rawSmsId?: unknown;
  classifyType?: unknown;
  evidenceStatus?: unknown;
  reconcileStatus?: unknown;
  reconciliationStatus?: unknown;
  amount?: unknown;
  amountBucket?: unknown;
  riskLevel?: unknown;
  blockerLabel?: unknown;
  accountTail?: unknown;
  maskedAccountTail?: unknown;
  counterpartyPresent?: unknown;
  counterpartyPresence?: unknown;
  counterpartyName?: unknown;
  invoiceOrReceivableState?: unknown;
  sourceFinality?: unknown;
  [key: string]: unknown;
}

export type StarkAiFinanceBankSmsReadonlySourceRepositoryResult =
  | readonly StarkAiFinanceBankSmsReadonlySourceRepositoryRow[]
  | Promise<readonly StarkAiFinanceBankSmsReadonlySourceRepositoryRow[]>;

export interface StarkAiFinanceBankSmsReadonlySourceRepository {
  readBankSmsTransactionSmsClassificationRows(
    context: StarkAiFinanceBankSmsReadonlySourceRepositoryContext,
  ): StarkAiFinanceBankSmsReadonlySourceRepositoryResult;
}

export interface StarkAiFinanceBankSmsReadonlySourceAdapterInput {
  repository: StarkAiFinanceBankSmsReadonlySourceRepository;
  context: StarkAiFinanceReadonlySafeSummaryReaderContext;
  maxRows?: number | null;
}

export interface StarkAiFinanceBankSmsReadonlySourceAdapterAudit {
  adapterName: 'StarkAiFinanceBankSmsReadonlySourceAdapter';
  adapterVersion: 'v1';
  safeSourceName: 'bank_sms_transaction_sms_classification_summary';
  recordsConsidered: number;
  recordsReturned: number;
  blockedSourceRows: number;
  blockedReasons: string[];
  auditPersisted: false;
}

export interface StarkAiFinanceBankSmsReadonlySourceBoundaryFlags {
  databaseReadCounter: 0;
  databaseWriteCounter: 0;
  businessWriteCounter: 0;
  businessExecutionCounter: 0;
  directSqlCounter: 0;
  arbitraryTableSelectorCounter: 0;
  dataSourceInitializationCounter: 0;
  repositorySaveCounter: 0;
  repositoryInsertCounter: 0;
  repositoryUpdateCounter: 0;
  repositoryDeleteCounter: 0;
  repositoryRemoveCounter: 0;
  repositorySoftDeleteCounter: 0;
  confirmApplyCounter: 0;
  statusMutationCounter: 0;
  bankSmsConfirmationCounter: 0;
  collectionOrderCreationCounter: 0;
  paymentRecordMutationCounter: 0;
  workOrderMutationCounter: 0;
  virtualLedgerMutationCounter: 0;
  readOnly: true;
  reviewContextOnly: true;
  realRepositoryWiring: false;
}

export interface StarkAiFinanceBankSmsReadonlySourceAdapterResult {
  adapterName: 'StarkAiFinanceBankSmsReadonlySourceAdapter';
  adapterVersion: 'v1';
  safeSourceName: 'bank_sms_transaction_sms_classification_summary';
  rows: StarkAiFinanceReadonlySafeSummaryReaderRow[];
  safeBoundaryFlags: StarkAiFinanceBankSmsReadonlySourceBoundaryFlags;
  audit: StarkAiFinanceBankSmsReadonlySourceAdapterAudit;
}

interface UnsafeBankSmsSourceScanReport {
  rawSmsDetected: number;
  verificationCodeDetected: number;
  fullPhoneDetected: number;
  fullBankAccountDetected: number;
  rawPaymentPayloadDetected: number;
  callbackPayloadDetected: number;
  secretDetected: number;
  forbiddenActionDetected: number;
}

const ADAPTER_NAME = 'StarkAiFinanceBankSmsReadonlySourceAdapter' as const;
const ADAPTER_VERSION = 'v1' as const;
const SAFE_SOURCE_NAME =
  'bank_sms_transaction_sms_classification_summary' as const;
const DEFAULT_MAX_ROWS = 100;

const EVIDENCE_STATUS_ALLOWLIST = new Set([
  'pending',
  'pending_binding',
  'unmatched_exception',
  'inferred',
  'uncertain',
  'reference_only',
  'reference-only',
  'confirmed',
]);

const NON_FINAL_STATUSES = new Set([
  'pending',
  'pending_binding',
  'unmatched_exception',
  'inferred',
  'uncertain',
  'reference_only',
  'reference-only',
  'review_only',
  'review-only',
]);

const RISK_LEVEL_ALLOWLIST = new Set(['info', 'review', 'warning', 'blocked']);
const COUNTERPARTY_PRESENCE_ALLOWLIST = new Set([
  'present',
  'missing',
  'not_provided',
]);
const SOURCE_FINALITY_ALLOWLIST = new Set([
  'final',
  'non_final',
  'review_only',
]);

const FORBIDDEN_ACTION_CODES = [
  'confirm_bank_sms',
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

const EMPTY_SCAN_REPORT: UnsafeBankSmsSourceScanReport = {
  rawSmsDetected: 0,
  verificationCodeDetected: 0,
  fullPhoneDetected: 0,
  fullBankAccountDetected: 0,
  rawPaymentPayloadDetected: 0,
  callbackPayloadDetected: 0,
  secretDetected: 0,
  forbiddenActionDetected: 0,
};

@Injectable()
export class StarkAiFinanceBankSmsReadonlySourceAdapterService {
  createFinanceReadonlyReader(
    repository: StarkAiFinanceBankSmsReadonlySourceRepository,
    options?: { maxRows?: number | null },
  ): StarkAiFinanceReadonlySafeSummaryReader {
    return {
      readBankSmsTransactionSmsClassificationSummary: (context) =>
        this.buildBankSmsTransactionSmsClassificationSummary({
          repository,
          context,
          maxRows: options?.maxRows,
        }).then((result) => result.rows),
      readFinanceReconciliationLinkSummary: () => [],
      readFinanceReceivableTrackingSummary: () => [],
      readFinanceCollectionOrderSummary: () => [],
      readPaymentRecordsSummary: () => [],
      readWorkOrdersPaymentCollectionReferenceSummary: () => [],
    };
  }

  async buildBankSmsTransactionSmsClassificationSummary(
    input: StarkAiFinanceBankSmsReadonlySourceAdapterInput,
  ): Promise<StarkAiFinanceBankSmsReadonlySourceAdapterResult> {
    const maxRows = this.resolveMaxRows(input.maxRows);
    const repositoryRows =
      await input.repository.readBankSmsTransactionSmsClassificationRows({
        requestId: input.context.requestId,
        generatedAt: input.context.generatedAt,
        requestedByRole: input.context.requestedByRole,
        permissionScope: input.context.permissionScope,
        sourceName: SAFE_SOURCE_NAME,
        maxRows,
      });
    const normalizedRows = [...repositoryRows]
      .slice(0, maxRows)
      .map((row, index) => this.normalizeSourceRow(row, index));
    const blockedReasons = this.uniqueStrings(
      normalizedRows.flatMap((row) =>
        row.blockerLabel === 'blocked_sensitive_source_row'
          ? ['blocked_sensitive_source_row']
          : [],
      ),
    );

    return {
      adapterName: ADAPTER_NAME,
      adapterVersion: ADAPTER_VERSION,
      safeSourceName: SAFE_SOURCE_NAME,
      rows: normalizedRows,
      safeBoundaryFlags: this.buildSafeBoundaryFlags(),
      audit: {
        adapterName: ADAPTER_NAME,
        adapterVersion: ADAPTER_VERSION,
        safeSourceName: SAFE_SOURCE_NAME,
        recordsConsidered: normalizedRows.length,
        recordsReturned: normalizedRows.length,
        blockedSourceRows: normalizedRows.filter(
          (row) => row.blockerLabel === 'blocked_sensitive_source_row',
        ).length,
        blockedReasons,
        auditPersisted: false,
      },
    };
  }

  private normalizeSourceRow(
    row: StarkAiFinanceBankSmsReadonlySourceRepositoryRow,
    index: number,
  ): StarkAiFinanceReadonlySafeSummaryReaderRow {
    const scanReport = this.scanUnsafeSourceRow(row);
    const blockedReasons = this.resolveBlockedReasons(scanReport);
    const maskedTail = this.resolveMaskedAccountTail(
      row.maskedAccountTail ?? row.accountTail,
    );
    if (maskedTail.blockedReason) {
      blockedReasons.push(maskedTail.blockedReason);
    }
    if (blockedReasons.length > 0) {
      return this.buildBlockedRow(index);
    }

    const evidenceStatus = this.resolveEvidenceStatus(row);
    const reconciliationStatus =
      this.normalizeToken(row.reconciliationStatus) ||
      this.normalizeToken(row.reconcileStatus) ||
      this.defaultReconciliationStatus(row.classifyType);
    return {
      safeSourceName: SAFE_SOURCE_NAME,
      safeRecordId: this.resolveSafeRecordId(row, index),
      evidenceStatus,
      reconciliationStatus,
      amountBucket: this.resolveAmountBucket(row.amountBucket, row.amount),
      riskLevel: this.resolveRiskLevel(row.riskLevel, evidenceStatus),
      blockerLabel:
        this.normalizeToken(row.blockerLabel) ||
        this.defaultBlockerLabel(evidenceStatus),
      maskedAccountTail: maskedTail.value,
      counterpartyPresence: this.resolveCounterpartyPresence(row),
      invoiceOrReceivableState:
        this.normalizeToken(row.invoiceOrReceivableState) || 'not_provided',
      sourceFinality: this.resolveSourceFinality(
        row.sourceFinality,
        evidenceStatus,
      ),
    };
  }

  private buildBlockedRow(index: number): StarkAiFinanceReadonlySafeSummaryReaderRow {
    return {
      safeSourceName: SAFE_SOURCE_NAME,
      safeRecordId: `${SAFE_SOURCE_NAME}-blocked-${index + 1}`,
      evidenceStatus: 'reference_only',
      reconciliationStatus: 'blocked_sensitive_source_row',
      amountBucket: 'amount_bucket_blocked',
      riskLevel: 'blocked',
      blockerLabel: 'blocked_sensitive_source_row',
      maskedAccountTail: null,
      counterpartyPresence: 'not_provided',
      invoiceOrReceivableState: 'review_only',
      sourceFinality: 'review_only',
    };
  }

  private scanUnsafeSourceRow(
    input: unknown,
  ): UnsafeBankSmsSourceScanReport {
    const scanReport: UnsafeBankSmsSourceScanReport = { ...EMPTY_SCAN_REPORT };
    this.scanValue(input, scanReport, []);
    return scanReport;
  }

  private scanValue(
    value: unknown,
    scanReport: UnsafeBankSmsSourceScanReport,
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
    scanReport: UnsafeBankSmsSourceScanReport,
    contextPath: readonly string[],
  ): void {
    if (!text) {
      return;
    }
    if (this.hasRawSmsContext(contextPath, text)) {
      scanReport.rawSmsDetected += 1;
    }
    if (/verification[_\s-]?(code|marker|value)|verificationCodeValue/i.test(text)) {
      scanReport.verificationCodeDetected += 1;
    }
    if (/full[_\s-]?phone|\b1[3-9]\d{9}\b/i.test(text)) {
      scanReport.fullPhoneDetected += 1;
    }
    if (
      /full[_\s-]?(bank[_\s-]?)?account/i.test(text) ||
      (/\b\d{12,}\b/.test(text) && this.hasAccountContext(contextPath, text))
    ) {
      scanReport.fullBankAccountDetected += 1;
    }
    if (
      /raw[_\s-]?payment[_\s-]?payload|paymentProviderPayload|payment[_\s-]?(provider[_\s-]?)?payload/i.test(
        text,
      )
    ) {
      scanReport.rawPaymentPayloadDetected += 1;
    }
    if (/callback[_\s-]?payload|provider[_\s-]?callback/i.test(text)) {
      scanReport.callbackPayloadDetected += 1;
    }
    if (
      /secret[_\s-]?(marker|value|payload)?|token=|password=|\.env|private[_\s-]?key|certificate/i.test(
        text,
      )
    ) {
      scanReport.secretDetected += 1;
    }
    if (
      FORBIDDEN_ACTION_CODES.some((code) =>
        new RegExp(this.escapeRegExp(code), 'i').test(text),
      ) ||
      (this.isCommandContext(contextPath) && /execute|command|payload/i.test(text))
    ) {
      scanReport.forbiddenActionDetected += 1;
    }
  }

  private hasRawSmsContext(
    contextPath: readonly string[],
    text: string,
  ): boolean {
    const normalizedText = this.normalizeContextKey(text);
    if (normalizedText === 'rawsmsid') {
      return false;
    }
    const normalizedContext = contextPath
      .map((key) => this.normalizeContextKey(key))
      .join(' ');
    return (
      /raw[_\s-]?sms[_\s-]?body|full[_\s-]?sms[_\s-]?body|rawSmsBody|fullSmsBody|smsBody|raw_sms_marker_must_not_pass/i.test(
        text,
      ) ||
      normalizedContext.split(/\s+/).some((key) =>
        ['rawsmsbody', 'fullsmsbody', 'smsbody', 'body'].includes(key),
      )
    );
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

  private resolveBlockedReasons(
    scanReport: UnsafeBankSmsSourceScanReport,
  ): string[] {
    const reasons: string[] = [];
    if (scanReport.rawSmsDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.verificationCodeDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.fullPhoneDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.fullBankAccountDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.rawPaymentPayloadDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.callbackPayloadDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.secretDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.forbiddenActionDetected > 0) {
      reasons.push('source_forbidden_action_blocked');
    }
    return this.uniqueStrings(reasons);
  }

  private resolveEvidenceStatus(
    row: StarkAiFinanceBankSmsReadonlySourceRepositoryRow,
  ): string {
    const explicit = this.normalizeToken(row.evidenceStatus).replace('-', '_');
    if (EVIDENCE_STATUS_ALLOWLIST.has(explicit)) {
      return explicit === 'reference-only' ? 'reference_only' : explicit;
    }
    const reconcileStatus = this
      .normalizeToken(row.reconcileStatus ?? row.reconciliationStatus)
      .replace('-', '_');
    if (reconcileStatus === 'confirmed') {
      return 'confirmed';
    }
    if (reconcileStatus === 'pending_binding') {
      return 'pending_binding';
    }
    if (reconcileStatus.includes('unmatched')) {
      return 'unmatched_exception';
    }
    if (reconcileStatus.includes('pending')) {
      return 'pending';
    }
    const classifyType = this.normalizeToken(row.classifyType);
    return classifyType === 'bank_transaction' ? 'inferred' : 'reference_only';
  }

  private resolveRiskLevel(value: unknown, evidenceStatus: string): string {
    const normalized = this.normalizeToken(value);
    if (RISK_LEVEL_ALLOWLIST.has(normalized)) {
      return normalized;
    }
    if (evidenceStatus === 'confirmed') {
      return 'info';
    }
    if (
      evidenceStatus === 'pending_binding' ||
      evidenceStatus === 'unmatched_exception'
    ) {
      return 'warning';
    }
    return 'review';
  }

  private resolveCounterpartyPresence(
    row: StarkAiFinanceBankSmsReadonlySourceRepositoryRow,
  ): string {
    const explicit = this.normalizeToken(row.counterpartyPresence);
    if (COUNTERPARTY_PRESENCE_ALLOWLIST.has(explicit)) {
      return explicit;
    }
    if (typeof row.counterpartyPresent === 'boolean') {
      return row.counterpartyPresent ? 'present' : 'missing';
    }
    const counterpartyName = this.sanitizeText(row.counterpartyName, [
      'counterpartyName',
    ]);
    return counterpartyName ? 'present' : 'missing';
  }

  private resolveSourceFinality(value: unknown, evidenceStatus: string): string {
    const normalized = this.normalizeToken(value).replace('-', '_');
    if (this.isNonFinalStatus(evidenceStatus)) {
      return evidenceStatus === 'reference_only' ? 'review_only' : 'non_final';
    }
    return SOURCE_FINALITY_ALLOWLIST.has(normalized) ? normalized : 'final';
  }

  private resolveMaskedAccountTail(value: unknown): {
    value: string | null;
    blockedReason: string | null;
  } {
    const text = this.sanitizeText(value, ['maskedAccountTail']);
    if (!text) {
      return { value: null, blockedReason: null };
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
      blockedReason: 'source_sensitive_row_blocked',
    };
  }

  private resolveAmountBucket(amountBucket: unknown, amount: unknown): string {
    const explicit = this.normalizeToken(amountBucket);
    if (explicit) {
      return explicit;
    }
    const numericAmount = this.toNumber(amount);
    if (numericAmount === null) {
      return 'amount_unknown_bucket';
    }
    if (numericAmount < 1000) {
      return 'amount_0_1000';
    }
    if (numericAmount < 5000) {
      return 'amount_1000_5000';
    }
    if (numericAmount < 10000) {
      return 'amount_5000_10000';
    }
    return 'amount_10000_plus';
  }

  private resolveSafeRecordId(
    row: StarkAiFinanceBankSmsReadonlySourceRepositoryRow,
    index: number,
  ): string {
    const explicit = this.normalizeToken(row.safeRecordId);
    if (explicit) {
      return explicit;
    }
    const bankSmsTransactionId = this.normalizeSmallId(row.bankSmsTransactionId);
    const smsClassificationId = this.normalizeSmallId(row.smsClassificationId);
    if (bankSmsTransactionId || smsClassificationId) {
      return [
        'bank_sms_transaction',
        bankSmsTransactionId || 'none',
        'sms_classification',
        smsClassificationId || 'none',
      ].join('_');
    }
    return `${SAFE_SOURCE_NAME}_row_${index + 1}`;
  }

  private normalizeSmallId(value: unknown): string {
    const text = this.sanitizeText(value, ['safeRecordId']);
    if (/^\d{1,11}$/.test(text)) {
      return text;
    }
    return this.normalizeToken(text);
  }

  private defaultReconciliationStatus(classifyType: unknown): string {
    return this.normalizeToken(classifyType) === 'bank_transaction'
      ? 'sms_classified_bank_transaction_review_only'
      : 'sms_classification_reference_only';
  }

  private defaultBlockerLabel(evidenceStatus: string): string {
    if (evidenceStatus === 'confirmed') {
      return 'no_blocker_label';
    }
    if (evidenceStatus === 'pending_binding') {
      return 'formal_account_binding_required';
    }
    if (evidenceStatus === 'unmatched_exception') {
      return 'unmatched_bank_sms_exception_review';
    }
    if (evidenceStatus === 'inferred') {
      return 'bank_sms_classification_review_only';
    }
    if (evidenceStatus === 'uncertain') {
      return 'sms_classification_confidence_review';
    }
    if (evidenceStatus === 'reference_only') {
      return 'bank_sms_reference_only';
    }
    return 'manual_reconciliation_required';
  }

  private resolveMaxRows(value: number | null | undefined): number {
    if (!Number.isFinite(value) || !value || value <= 0) {
      return DEFAULT_MAX_ROWS;
    }
    return Math.min(Math.floor(value), DEFAULT_MAX_ROWS);
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
      text = text.replace(new RegExp(this.escapeRegExp(code), 'gi'), 'blocked_action');
    }
    return text
      .replace(/\b1[3-9]\d{9}\b/g, 'redacted_phone')
      .replace(/\b\d{12,}\b/g, (match) =>
        this.hasAccountContext(contextPath, text) ? 'redacted_account' : match,
      )
      .replace(/verificationCodeValue/gi, 'redacted_sensitive')
      .replace(/rawSmsBody|fullSmsBody|smsBody/gi, 'redacted_sensitive')
      .replace(/raw[_\s-]?payment[_\s-]?payload/gi, 'redacted_sensitive')
      .replace(/paymentProviderPayload/gi, 'redacted_sensitive')
      .replace(/callback[_\s-]?payload/gi, 'redacted_sensitive')
      .replace(/secret[_\s-]?(marker|value|payload)?/gi, 'redacted_sensitive')
      .replace(/token=[^\s,;]+/gi, 'redacted_sensitive')
      .replace(/password=[^\s,;]+/gi, 'redacted_sensitive')
      .replace(/private[_\s-]?key/gi, 'redacted_sensitive')
      .replace(/certificate/gi, 'redacted_sensitive')
      .replace(/\.env/gi, 'redacted_sensitive')
      .trim();
  }

  private normalizeToken(value: unknown): string {
    return this.sanitizeText(value, ['token'])
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.abs(value);
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/,/g, ''));
      return Number.isFinite(parsed) ? Math.abs(parsed) : null;
    }
    return null;
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

  private isCommandContext(contextPath: readonly string[]): boolean {
    return contextPath.some((key) => {
      const normalized = this.normalizeContextKey(key);
      return (
        normalized.includes('command') ||
        normalized.includes('action') ||
        normalized.includes('payload') ||
        normalized.includes('instruction') ||
        normalized.includes('executable') ||
        normalized.includes('mutation')
      );
    });
  }

  private normalizeContextKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values.filter(Boolean))];
  }

  private buildSafeBoundaryFlags(): StarkAiFinanceBankSmsReadonlySourceBoundaryFlags {
    return {
      databaseReadCounter: 0,
      databaseWriteCounter: 0,
      businessWriteCounter: 0,
      businessExecutionCounter: 0,
      directSqlCounter: 0,
      arbitraryTableSelectorCounter: 0,
      dataSourceInitializationCounter: 0,
      repositorySaveCounter: 0,
      repositoryInsertCounter: 0,
      repositoryUpdateCounter: 0,
      repositoryDeleteCounter: 0,
      repositoryRemoveCounter: 0,
      repositorySoftDeleteCounter: 0,
      confirmApplyCounter: 0,
      statusMutationCounter: 0,
      bankSmsConfirmationCounter: 0,
      collectionOrderCreationCounter: 0,
      paymentRecordMutationCounter: 0,
      workOrderMutationCounter: 0,
      virtualLedgerMutationCounter: 0,
      readOnly: true,
      reviewContextOnly: true,
      realRepositoryWiring: false,
    };
  }
}
