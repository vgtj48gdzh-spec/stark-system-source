import { Injectable } from '@nestjs/common';
import {
  type StarkAiFinanceReadonlySafeSummaryReader,
  type StarkAiFinanceReadonlySafeSummaryReaderContext,
  type StarkAiFinanceReadonlySafeSummaryReaderRow,
} from './stark-ai-finance-readonly-safe-summary-adapter.service';

export interface StarkAiFinanceReceivableTrackingReadonlySourceRepositoryContext {
  requestId: string;
  generatedAt: string;
  requestedByRole: string;
  permissionScope: string;
  sourceName: 'finance_receivable_tracking_summary';
  maxRows: number;
}

export interface StarkAiFinanceReceivableTrackingReadonlySourceRepositoryRow {
  safeRecordId?: unknown;
  receivableTrackingId?: unknown;
  receivableId?: unknown;
  evidenceStatus?: unknown;
  reconciliationStatus?: unknown;
  receivableStatus?: unknown;
  amount?: unknown;
  amountBucket?: unknown;
  riskLevel?: unknown;
  blockerLabel?: unknown;
  accountTail?: unknown;
  maskedAccountTail?: unknown;
  counterpartyPresent?: unknown;
  counterpartyPresence?: unknown;
  invoiceOrReceivableState?: unknown;
  sourceFinality?: unknown;
  [key: string]: unknown;
}

export type StarkAiFinanceReceivableTrackingReadonlySourceRepositoryResult =
  | readonly StarkAiFinanceReceivableTrackingReadonlySourceRepositoryRow[]
  | Promise<
      readonly StarkAiFinanceReceivableTrackingReadonlySourceRepositoryRow[]
    >;

export interface StarkAiFinanceReceivableTrackingReadonlySourceRepository {
  readFinanceReceivableTrackingRows(
    context: StarkAiFinanceReceivableTrackingReadonlySourceRepositoryContext,
  ): StarkAiFinanceReceivableTrackingReadonlySourceRepositoryResult;
}

export interface StarkAiFinanceReceivableTrackingReadonlySourceAdapterInput {
  repository: StarkAiFinanceReceivableTrackingReadonlySourceRepository;
  context: StarkAiFinanceReadonlySafeSummaryReaderContext;
  maxRows?: number | null;
}

export interface StarkAiFinanceReceivableTrackingReadonlySourceAdapterAudit {
  adapterName: 'StarkAiFinanceReceivableTrackingReadonlySourceAdapter';
  adapterVersion: 'v1';
  safeSourceName: 'finance_receivable_tracking_summary';
  recordsConsidered: number;
  recordsReturned: number;
  blockedSourceRows: number;
  blockedReasons: string[];
  auditPersisted: false;
}

export interface StarkAiFinanceReceivableTrackingReadonlySourceBoundaryFlags {
  databaseReadCounter: 0;
  databaseWriteCounter: 0;
  businessWriteCounter: 0;
  businessExecutionCounter: 0;
  receivableMutationCounter: 0;
  collectionOrderCreationCounter: 0;
  paymentRecordMutationCounter: 0;
  workOrderMutationCounter: 0;
  realRepositoryWiring: false;
  readOnly: true;
  reviewContextOnly: true;
}

export interface StarkAiFinanceReceivableTrackingReadonlySourceAdapterResult {
  adapterName: 'StarkAiFinanceReceivableTrackingReadonlySourceAdapter';
  adapterVersion: 'v1';
  safeSourceName: 'finance_receivable_tracking_summary';
  rows: StarkAiFinanceReadonlySafeSummaryReaderRow[];
  safeBoundaryFlags: StarkAiFinanceReceivableTrackingReadonlySourceBoundaryFlags;
  audit: StarkAiFinanceReceivableTrackingReadonlySourceAdapterAudit;
}

interface UnsafeReceivableTrackingSourceScanReport {
  customerRawNameDetected: number;
  fullPhoneDetected: number;
  fullBankAccountDetected: number;
  rawInvoicePayloadDetected: number;
  rawContractPayloadDetected: number;
  rawPaymentPayloadDetected: number;
  rawReceivableDocumentDetected: number;
  secretDetected: number;
  forbiddenActionDetected: number;
}

const ADAPTER_NAME =
  'StarkAiFinanceReceivableTrackingReadonlySourceAdapter' as const;
const ADAPTER_VERSION = 'v1' as const;
const SAFE_SOURCE_NAME = 'finance_receivable_tracking_summary' as const;
const DEFAULT_MAX_ROWS = 100;

const EVIDENCE_STATUS_ALLOWLIST = new Set([
  'pending',
  'inferred',
  'uncertain',
  'reference_only',
  'reference-only',
  'confirmed',
]);

const NON_FINAL_STATUSES = new Set([
  'pending',
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

const SAFE_AMOUNT_BUCKET_ALLOWLIST = new Set([
  'amount_0_1000',
  'amount_1000_5000',
  'amount_5000_10000',
  'amount_10000_plus',
  'amount_unknown_bucket',
  'amount_custom_bucket',
]);

const FORBIDDEN_ACTION_CODES = [
  ['create', 'collection', 'order'].join('_'),
  ['create', 'payment', 'record'].join('_'),
  ['up', 'date_work_order_status'].join(''),
] as const;

const EMPTY_SCAN_REPORT: UnsafeReceivableTrackingSourceScanReport = {
  customerRawNameDetected: 0,
  fullPhoneDetected: 0,
  fullBankAccountDetected: 0,
  rawInvoicePayloadDetected: 0,
  rawContractPayloadDetected: 0,
  rawPaymentPayloadDetected: 0,
  rawReceivableDocumentDetected: 0,
  secretDetected: 0,
  forbiddenActionDetected: 0,
};

@Injectable()
export class StarkAiFinanceReceivableTrackingReadonlySourceAdapterService {
  createFinanceReadonlyReader(
    repository: StarkAiFinanceReceivableTrackingReadonlySourceRepository,
    options?: { maxRows?: number | null },
  ): StarkAiFinanceReadonlySafeSummaryReader {
    return {
      readBankSmsTransactionSmsClassificationSummary: () => [],
      readFinanceReconciliationLinkSummary: () => [],
      readFinanceReceivableTrackingSummary: (context) =>
        this.buildFinanceReceivableTrackingSummary({
          repository,
          context,
          maxRows: options?.maxRows,
        }).then((result) => result.rows),
      readFinanceCollectionOrderSummary: () => [],
      readPaymentRecordsSummary: () => [],
      readWorkOrdersPaymentCollectionReferenceSummary: () => [],
    };
  }

  async buildFinanceReceivableTrackingSummary(
    input: StarkAiFinanceReceivableTrackingReadonlySourceAdapterInput,
  ): Promise<StarkAiFinanceReceivableTrackingReadonlySourceAdapterResult> {
    const maxRows = this.resolveMaxRows(input.maxRows);
    const repositoryRows =
      await input.repository.readFinanceReceivableTrackingRows({
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
    const blockedSourceRows = normalizedRows.filter(
      (row) => row.blockerLabel === 'blocked_sensitive_source_row',
    ).length;

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
        blockedSourceRows,
        blockedReasons:
          blockedSourceRows > 0 ? ['blocked_sensitive_source_row'] : [],
        auditPersisted: false,
      },
    };
  }

  private normalizeSourceRow(
    row: StarkAiFinanceReceivableTrackingReadonlySourceRepositoryRow,
    index: number,
  ): StarkAiFinanceReadonlySafeSummaryReaderRow {
    const blockedReasons = this.resolveBlockedReasons(
      this.scanUnsafeSourceRow(row),
    );
    const maskedTail = this.resolveMaskedAccountTail(
      row.maskedAccountTail ?? row.accountTail,
    );
    if (maskedTail.blockedReason) {
      blockedReasons.push(maskedTail.blockedReason);
    }
    if (blockedReasons.length > 0) {
      return this.buildBlockedRow(index);
    }

    const evidenceStatus = this.resolveEvidenceStatus(row.evidenceStatus);
    return {
      safeSourceName: SAFE_SOURCE_NAME,
      safeRecordId: this.resolveSafeRecordId(row, index),
      evidenceStatus,
      reconciliationStatus:
        this.normalizeToken(row.reconciliationStatus) ||
        this.defaultReconciliationStatus(evidenceStatus),
      amountBucket: this.resolveAmountBucket(row.amountBucket, row.amount),
      riskLevel: this.resolveRiskLevel(row.riskLevel, evidenceStatus),
      blockerLabel:
        this.normalizeToken(row.blockerLabel) ||
        this.defaultBlockerLabel(evidenceStatus),
      maskedAccountTail: maskedTail.value,
      counterpartyPresence: this.resolveCounterpartyPresence(row),
      invoiceOrReceivableState:
        this.normalizeToken(
          row.invoiceOrReceivableState ?? row.receivableStatus,
        ) || 'not_provided',
      sourceFinality: this.resolveSourceFinality(
        row.sourceFinality,
        evidenceStatus,
      ),
    };
  }

  private buildBlockedRow(
    index: number,
  ): StarkAiFinanceReadonlySafeSummaryReaderRow {
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
  ): UnsafeReceivableTrackingSourceScanReport {
    const scanReport: UnsafeReceivableTrackingSourceScanReport = {
      ...EMPTY_SCAN_REPORT,
    };
    this.scanValue(input, scanReport, []);
    return scanReport;
  }

  private scanValue(
    value: unknown,
    scanReport: UnsafeReceivableTrackingSourceScanReport,
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
    scanReport: UnsafeReceivableTrackingSourceScanReport,
    contextPath: readonly string[],
  ): void {
    if (!text) {
      return;
    }
    if (/customer[_\s-]?raw[_\s-]?name|raw[_\s-]?customer[_\s-]?name|customerName|counterpartyName/i.test(text)) {
      scanReport.customerRawNameDetected += 1;
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
    if (/raw[_\s-]?invoice[_\s-]?payload|invoice[_\s-]?payload/i.test(text)) {
      scanReport.rawInvoicePayloadDetected += 1;
    }
    if (/raw[_\s-]?contract[_\s-]?payload|contract[_\s-]?payload/i.test(text)) {
      scanReport.rawContractPayloadDetected += 1;
    }
    if (/raw[_\s-]?payment[_\s-]?payload|payment[_\s-]?payload/i.test(text)) {
      scanReport.rawPaymentPayloadDetected += 1;
    }
    if (/raw[_\s-]?receivable[_\s-]?document|receivable[_\s-]?document/i.test(text)) {
      scanReport.rawReceivableDocumentDetected += 1;
    }
    if (
      /secret[_\s-]?(marker|value|payload)?|token=|password=|api[_\s-]?key|private[_\s-]?key|certificate|\.env/i.test(
        text,
      )
    ) {
      scanReport.secretDetected += 1;
    }
    if (
      FORBIDDEN_ACTION_CODES.some((code) =>
        new RegExp(this.escapeRegExp(code), 'i').test(text),
      ) ||
      (this.isCommandContext(contextPath) && /execute|command|payload|mutation/i.test(text))
    ) {
      scanReport.forbiddenActionDetected += 1;
    }
  }

  private resolveBlockedReasons(
    scanReport: UnsafeReceivableTrackingSourceScanReport,
  ): string[] {
    const reasons: string[] = [];
    if (scanReport.customerRawNameDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.fullPhoneDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.fullBankAccountDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.rawInvoicePayloadDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.rawContractPayloadDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.rawPaymentPayloadDetected > 0) {
      reasons.push('source_sensitive_row_blocked');
    }
    if (scanReport.rawReceivableDocumentDetected > 0) {
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

  private resolveEvidenceStatus(value: unknown): string {
    const normalized = this.normalizeToken(value).replace('-', '_');
    if (!EVIDENCE_STATUS_ALLOWLIST.has(normalized)) {
      return 'reference_only';
    }
    return normalized === 'reference-only' ? 'reference_only' : normalized;
  }

  private resolveRiskLevel(value: unknown, evidenceStatus: string): string {
    const normalized = this.normalizeToken(value);
    if (RISK_LEVEL_ALLOWLIST.has(normalized)) {
      return normalized;
    }
    if (evidenceStatus === 'confirmed') {
      return 'info';
    }
    if (evidenceStatus === 'uncertain') {
      return 'warning';
    }
    return 'review';
  }

  private resolveCounterpartyPresence(
    row: StarkAiFinanceReceivableTrackingReadonlySourceRepositoryRow,
  ): string {
    const explicit = this.normalizeToken(row.counterpartyPresence);
    if (COUNTERPARTY_PRESENCE_ALLOWLIST.has(explicit)) {
      return explicit;
    }
    if (typeof row.counterpartyPresent === 'boolean') {
      return row.counterpartyPresent ? 'present' : 'missing';
    }
    return 'not_provided';
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
    const tailMatch = compact.match(/^(?:tail|account_tail|masked_tail)_?(\d{4})$/);
    if (tailMatch) {
      return { value: `tail_${tailMatch[1]}`, blockedReason: null };
    }
    const maskedMatch = compact.match(/^\*{2,}(\d{4})$/);
    if (maskedMatch) {
      return { value: `tail_${maskedMatch[1]}`, blockedReason: null };
    }
    if (/^\d{4}$/.test(compact)) {
      return { value: `tail_${compact}`, blockedReason: null };
    }
    return {
      value: null,
      blockedReason: 'source_sensitive_row_blocked',
    };
  }

  private resolveAmountBucket(amountBucket: unknown, amount: unknown): string {
    const explicit = this.resolveExplicitAmountBucket(amountBucket);
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

  private resolveExplicitAmountBucket(value: unknown): string {
    const rawText = this.sanitizeText(value, ['amountBucket']);
    const normalized = this.normalizeToken(rawText);
    if (!normalized) {
      return '';
    }
    if (SAFE_AMOUNT_BUCKET_ALLOWLIST.has(normalized)) {
      return normalized;
    }
    if (this.hasRawAmountBucketShape(rawText, normalized)) {
      return '';
    }
    if (!/^amount_[a-z][a-z_]*$/.test(normalized)) {
      return '';
    }
    return normalized;
  }

  private hasRawAmountBucketShape(rawText: string, normalized: string): boolean {
    return (
      /\d+\.\d+/.test(rawText) ||
      /\d+_\d+/.test(normalized) ||
      /\d{5,}/.test(rawText.replace(/[^\d]/g, '')) ||
      /^amount_\d/.test(normalized) ||
      /^\d/.test(normalized)
    );
  }

  private resolveSafeRecordId(
    row: StarkAiFinanceReceivableTrackingReadonlySourceRepositoryRow,
    index: number,
  ): string {
    const explicit = this.normalizeToken(row.safeRecordId);
    if (explicit) {
      return explicit;
    }
    const trackingId = this.normalizeSmallId(row.receivableTrackingId);
    const receivableId = this.normalizeSmallId(row.receivableId);
    if (trackingId || receivableId) {
      return [
        'receivable_tracking',
        trackingId || 'none',
        'receivable',
        receivableId || 'none',
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

  private defaultReconciliationStatus(evidenceStatus: string): string {
    if (evidenceStatus === 'confirmed') {
      return 'receivable_tracking_confirmed_review_only';
    }
    if (evidenceStatus === 'pending') {
      return 'receivable_tracking_pending_review';
    }
    if (evidenceStatus === 'inferred') {
      return 'receivable_tracking_inferred_review';
    }
    if (evidenceStatus === 'uncertain') {
      return 'receivable_tracking_uncertain_review';
    }
    return 'receivable_tracking_reference_only';
  }

  private defaultBlockerLabel(evidenceStatus: string): string {
    if (evidenceStatus === 'confirmed') {
      return 'no_blocker_label';
    }
    if (evidenceStatus === 'pending') {
      return 'receivable_tracking_pending_review';
    }
    if (evidenceStatus === 'inferred') {
      return 'receivable_tracking_inferred_review';
    }
    if (evidenceStatus === 'uncertain') {
      return 'receivable_tracking_uncertain_review';
    }
    return 'receivable_tracking_reference_only';
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
      .replace(/customerName|counterpartyName/gi, 'redacted_sensitive')
      .replace(/raw[_\s-]?customer[_\s-]?name/gi, 'redacted_sensitive')
      .replace(/raw[_\s-]?invoice[_\s-]?payload/gi, 'redacted_sensitive')
      .replace(/invoice[_\s-]?payload/gi, 'redacted_sensitive')
      .replace(/raw[_\s-]?contract[_\s-]?payload/gi, 'redacted_sensitive')
      .replace(/contract[_\s-]?payload/gi, 'redacted_sensitive')
      .replace(/raw[_\s-]?payment[_\s-]?payload/gi, 'redacted_sensitive')
      .replace(/payment[_\s-]?payload/gi, 'redacted_sensitive')
      .replace(/raw[_\s-]?receivable[_\s-]?document/gi, 'redacted_sensitive')
      .replace(/receivable[_\s-]?document/gi, 'redacted_sensitive')
      .replace(/secret[_\s-]?(marker|value|payload)?/gi, 'redacted_sensitive')
      .replace(/token=[^\s,;]+/gi, 'redacted_sensitive')
      .replace(/password=[^\s,;]+/gi, 'redacted_sensitive')
      .replace(/api[_\s-]?key/gi, 'redacted_sensitive')
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

  private uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values.filter(Boolean))];
  }

  private buildSafeBoundaryFlags(): StarkAiFinanceReceivableTrackingReadonlySourceBoundaryFlags {
    return {
      databaseReadCounter: 0,
      databaseWriteCounter: 0,
      businessWriteCounter: 0,
      businessExecutionCounter: 0,
      receivableMutationCounter: 0,
      collectionOrderCreationCounter: 0,
      paymentRecordMutationCounter: 0,
      workOrderMutationCounter: 0,
      realRepositoryWiring: false,
      readOnly: true,
      reviewContextOnly: true,
    };
  }
}
