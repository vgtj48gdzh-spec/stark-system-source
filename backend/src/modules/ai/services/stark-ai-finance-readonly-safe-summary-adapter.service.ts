import { Injectable } from '@nestjs/common';
import {
  StarkAiDatabaseSafeSummaryEnvelope,
  StarkAiDatabaseSafeSummaryProviderInput,
  StarkAiDatabaseSafeSummaryProviderService,
} from './stark-ai-database-safe-summary-provider.service';
import {
  StarkAiFinanceSafeSummarySourceMapperService,
  type StarkAiFinanceSafeSummarySourceRow,
} from './stark-ai-finance-safe-summary-source-mapper.service';
import {
  StarkAiSyncPacketArtifacts,
  StarkAiSyncPacketService,
} from './stark-ai-sync-packet.service';

export type StarkAiFinanceReadonlySafeSummarySourceName =
  | 'bank_sms_transaction_sms_classification_summary'
  | 'finance_reconciliation_link_summary'
  | 'finance_receivable_tracking_summary'
  | 'finance_collection_order_summary'
  | 'payment_records_summary'
  | 'work_orders_payment_collection_reference_summary';

export type StarkAiFinanceReadonlySafeSummaryEvidenceStatus =
  | 'pending'
  | 'pending_binding'
  | 'unmatched_exception'
  | 'inferred'
  | 'uncertain'
  | 'reference_only'
  | 'confirmed';

export type StarkAiFinanceReadonlySafeSummaryRiskLevel =
  | 'info'
  | 'review'
  | 'warning'
  | 'blocked';

export type StarkAiFinanceReadonlySafeSummaryCounterpartyPresence =
  | 'present'
  | 'missing'
  | 'not_provided';

export type StarkAiFinanceReadonlySafeSummarySourceFinality =
  | 'final'
  | 'non_final'
  | 'review_only';

export interface StarkAiFinanceReadonlySafeSummaryAdapterRow
  extends StarkAiFinanceSafeSummarySourceRow {
  safeSourceName: StarkAiFinanceReadonlySafeSummarySourceName;
  safeRecordId: string;
  evidenceStatus: StarkAiFinanceReadonlySafeSummaryEvidenceStatus;
  reconciliationStatus: string;
  amountBucket: string;
  riskLevel: StarkAiFinanceReadonlySafeSummaryRiskLevel;
  blockerLabel: string;
  maskedAccountTail: string | null;
  counterpartyPresence: StarkAiFinanceReadonlySafeSummaryCounterpartyPresence;
  invoiceOrReceivableState: string;
  sourceFinality: StarkAiFinanceReadonlySafeSummarySourceFinality;
  adapterBlocked: boolean;
  adapterBlockedReasons: string[];
}

export interface StarkAiFinanceReadonlySafeSummaryReaderRow {
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

export interface StarkAiFinanceReadonlySafeSummaryReaderContext {
  requestId: string;
  generatedAt: string;
  requestedByRole: string;
  permissionScope: StarkAiFinanceReadonlySafeSummaryPermissionScope;
  sourceName: StarkAiFinanceReadonlySafeSummarySourceName;
}

export type StarkAiFinanceReadonlySafeSummaryReaderResult =
  | readonly StarkAiFinanceReadonlySafeSummaryReaderRow[]
  | Promise<readonly StarkAiFinanceReadonlySafeSummaryReaderRow[]>;

export interface StarkAiFinanceReadonlySafeSummaryReader {
  readBankSmsTransactionSmsClassificationSummary(
    context: StarkAiFinanceReadonlySafeSummaryReaderContext,
  ): StarkAiFinanceReadonlySafeSummaryReaderResult;
  readFinanceReconciliationLinkSummary(
    context: StarkAiFinanceReadonlySafeSummaryReaderContext,
  ): StarkAiFinanceReadonlySafeSummaryReaderResult;
  readFinanceReceivableTrackingSummary(
    context: StarkAiFinanceReadonlySafeSummaryReaderContext,
  ): StarkAiFinanceReadonlySafeSummaryReaderResult;
  readFinanceCollectionOrderSummary(
    context: StarkAiFinanceReadonlySafeSummaryReaderContext,
  ): StarkAiFinanceReadonlySafeSummaryReaderResult;
  readPaymentRecordsSummary(
    context: StarkAiFinanceReadonlySafeSummaryReaderContext,
  ): StarkAiFinanceReadonlySafeSummaryReaderResult;
  readWorkOrdersPaymentCollectionReferenceSummary(
    context: StarkAiFinanceReadonlySafeSummaryReaderContext,
  ): StarkAiFinanceReadonlySafeSummaryReaderResult;
}

export type StarkAiFinanceReadonlySafeSummaryPermissionScope =
  | 'global_finance_summary'
  | 'finance_scope_summary'
  | 'review_scope_summary'
  | 'blocked';

export interface StarkAiFinanceReadonlySafeSummaryAdapterInput {
  reader: StarkAiFinanceReadonlySafeSummaryReader;
  requestedByRole?: string | null;
  requestId?: string | null;
  generatedAt?: string | Date | null;
  sourceAllowlist?: readonly unknown[] | null;
  latestVerifiedMainCommit?: string | null;
}

export interface StarkAiFinanceReadonlySafeSummaryPermissionResult {
  requestedByRole: string;
  normalizedRole: string;
  permissionResult: 'allowed' | 'blocked';
  permissionScope: StarkAiFinanceReadonlySafeSummaryPermissionScope;
  blockedReasons: string[];
}

export interface StarkAiFinanceReadonlySafeSummaryAdapterAudit {
  adapterName: 'StarkAiFinanceReadonlySafeSummaryAdapter';
  adapterVersion: 'v1';
  requestId: string;
  generatedAt: string;
  requestedByRole: string;
  normalizedRole: string;
  permissionResult: 'allowed' | 'blocked';
  permissionScope: StarkAiFinanceReadonlySafeSummaryPermissionScope;
  sourceAllowlistUsed: StarkAiFinanceReadonlySafeSummarySourceName[];
  recordsConsidered: number;
  recordsReturned: number;
  blockedReasons: string[];
  auditPersisted: false;
}

export interface StarkAiFinanceReadonlySafeSummaryAdapterBoundaryFlags {
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
  dispatchCounter: 0;
  taskCreationCounter: 0;
  lifecycleMutationCounter: 0;
  payrollBenefitCustomerRightCounter: 0;
  realWechatPayCounter: 0;
  readOnly: true;
  reviewContextOnly: true;
  directSqlAllowed: false;
  arbitraryTableSelectorAllowed: false;
  rawRowsAllowed: false;
  databaseWriteAllowed: false;
  businessExecutionAllowed: false;
}

export interface StarkAiFinanceReadonlySafeSummaryAdapterResult {
  adapterName: 'StarkAiFinanceReadonlySafeSummaryAdapter';
  adapterVersion: 'v1';
  requestId: string;
  generatedAt: string;
  permission: StarkAiFinanceReadonlySafeSummaryPermissionResult;
  sourceAllowlistUsed: StarkAiFinanceReadonlySafeSummarySourceName[];
  recordsConsidered: number;
  recordsReturned: number;
  rows: StarkAiFinanceReadonlySafeSummaryAdapterRow[];
  providerInput: StarkAiDatabaseSafeSummaryProviderInput;
  safeSummary: StarkAiDatabaseSafeSummaryEnvelope;
  syncPacketArtifacts: StarkAiSyncPacketArtifacts;
  safeBoundaryFlags: StarkAiFinanceReadonlySafeSummaryAdapterBoundaryFlags;
  audit: StarkAiFinanceReadonlySafeSummaryAdapterAudit;
}

interface SourceReaderConfig {
  sourceName: StarkAiFinanceReadonlySafeSummarySourceName;
  read(
    reader: StarkAiFinanceReadonlySafeSummaryReader,
    context: StarkAiFinanceReadonlySafeSummaryReaderContext,
  ): StarkAiFinanceReadonlySafeSummaryReaderResult;
}

interface UnsafeReaderRowScanReport {
  rawSmsDetected: number;
  verificationCodeDetected: number;
  fullPhoneDetected: number;
  fullBankAccountDetected: number;
  rawPaymentPayloadDetected: number;
  callbackPayloadDetected: number;
  secretDetected: number;
  databaseFilesDetected: number;
  runtimeLogsDetected: number;
  privateKeysDetected: number;
  certificatesDetected: number;
  productionPayloadsDetected: number;
  forbiddenActionDetected: number;
}

const ADAPTER_NAME = 'StarkAiFinanceReadonlySafeSummaryAdapter' as const;
const ADAPTER_VERSION = 'v1' as const;
const FINANCE_SAFE_SUMMARY_TYPE = 'finance_safe_summary' as const;
const DEFAULT_REQUEST_ID = 'finance-readonly-safe-summary-adapter';

const SOURCE_ALLOWLIST: readonly SourceReaderConfig[] = [
  {
    sourceName: 'bank_sms_transaction_sms_classification_summary',
    read: (reader, context) =>
      reader.readBankSmsTransactionSmsClassificationSummary(context),
  },
  {
    sourceName: 'finance_reconciliation_link_summary',
    read: (reader, context) =>
      reader.readFinanceReconciliationLinkSummary(context),
  },
  {
    sourceName: 'finance_receivable_tracking_summary',
    read: (reader, context) =>
      reader.readFinanceReceivableTrackingSummary(context),
  },
  {
    sourceName: 'finance_collection_order_summary',
    read: (reader, context) => reader.readFinanceCollectionOrderSummary(context),
  },
  {
    sourceName: 'payment_records_summary',
    read: (reader, context) => reader.readPaymentRecordsSummary(context),
  },
  {
    sourceName: 'work_orders_payment_collection_reference_summary',
    read: (reader, context) =>
      reader.readWorkOrdersPaymentCollectionReferenceSummary(context),
  },
] as const;

const SOURCE_ALLOWLIST_NAMES = SOURCE_ALLOWLIST.map((source) => source.sourceName);
const SOURCE_ALLOWLIST_SET = new Set<string>(SOURCE_ALLOWLIST_NAMES);

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
  employee: 'employee',
  customer_service: 'customer_service',
  customer_support: 'customer_service',
  operator: 'operator',
  ai_operator: 'operator',
};

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

const EMPTY_SCAN_REPORT: UnsafeReaderRowScanReport = {
  rawSmsDetected: 0,
  verificationCodeDetected: 0,
  fullPhoneDetected: 0,
  fullBankAccountDetected: 0,
  rawPaymentPayloadDetected: 0,
  callbackPayloadDetected: 0,
  secretDetected: 0,
  databaseFilesDetected: 0,
  runtimeLogsDetected: 0,
  privateKeysDetected: 0,
  certificatesDetected: 0,
  productionPayloadsDetected: 0,
  forbiddenActionDetected: 0,
};

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
export class StarkAiFinanceReadonlySafeSummaryAdapterService {
  constructor(
    private readonly financeSafeSummarySourceMapperService: StarkAiFinanceSafeSummarySourceMapperService = new StarkAiFinanceSafeSummarySourceMapperService(),
    private readonly databaseSafeSummaryProviderService: StarkAiDatabaseSafeSummaryProviderService = new StarkAiDatabaseSafeSummaryProviderService(),
    private readonly starkAiSyncPacketService: StarkAiSyncPacketService = new StarkAiSyncPacketService(),
  ) {}

  async buildFinanceSafeSummary(
    input: StarkAiFinanceReadonlySafeSummaryAdapterInput,
  ): Promise<StarkAiFinanceReadonlySafeSummaryAdapterResult> {
    const requestId = this.resolveRequestId(input.requestId);
    const generatedAt = this.resolveGeneratedAt(input.generatedAt);
    const permission = this.resolvePermission(input.requestedByRole);
    const sourceSelection = this.resolveSourceAllowlist(input.sourceAllowlist);
    const sourceAllowlistUsed = sourceSelection.sources.map(
      (source) => source.sourceName,
    );
    const blockedReasons = this.uniqueStrings([
      ...permission.blockedReasons,
      ...sourceSelection.blockedReasons,
    ]);

    const rows =
      permission.permissionResult === 'allowed' && blockedReasons.length === 0
        ? await this.readAndNormalizeRows(
            input.reader,
            requestId,
            generatedAt,
            permission,
            sourceSelection.sources,
          )
        : [];
    const rowBlockedReasons = rows.flatMap((row) => row.adapterBlockedReasons);
    const allBlockedReasons = this.uniqueStrings([
      ...blockedReasons,
      ...rowBlockedReasons,
    ]);
    const providerInput =
      this.financeSafeSummarySourceMapperService.toProviderInput(
        this.toMapperSafeRows(rows),
        {
        requestedByRole: permission.normalizedRole,
        requestId,
        generatedAt,
        sourceKind: 'safe_input',
        dataSourceScope: [
          ADAPTER_NAME,
          ADAPTER_VERSION,
          ...sourceAllowlistUsed,
        ],
        },
      );
    const safeSummary =
      this.databaseSafeSummaryProviderService.toSafeSummaryEnvelope(providerInput);
    const syncPacketArtifacts =
      this.starkAiSyncPacketService.toSyncPacketArtifacts({
        generatedAt,
        repo: 'vgtj48gdzh-spec/stark-system',
        latestVerifiedMainCommit: input.latestVerifiedMainCommit ?? 'unknown',
        currentSystemState: {
          stage: 'S1-04 / SAFE',
          mode: 'SAFE',
          activeModule: 'Finance read-only safe summary adapter skeleton',
          adapterName: ADAPTER_NAME,
          adapterVersion: ADAPTER_VERSION,
          permissionScope: permission.permissionScope,
        },
        aiCapabilitySummary: {
          financeReadonlySafeSummaryAdapter: 'available',
          summaryType: FINANCE_SAFE_SUMMARY_TYPE,
          outputPath:
            'safe_reader_rows_to_finance_mapper_to_database_safe_summary_provider',
          canWriteDatabase: false,
          canExecuteBusinessAction: false,
        },
        currentBlockers: allBlockedReasons,
        databaseSafeSummaries: [safeSummary],
        redactionReport: {
          rawSmsIncluded: false,
          verificationCodesIncluded: false,
          fullPhoneIncluded: false,
          fullBankAccountIncluded: false,
          secretsIncluded: false,
          runtimeLogsIncluded: false,
          privateKeysIncluded: false,
          certificatesIncluded: false,
          databaseFilesIncluded: false,
          productionConnectorPayloadsIncluded: false,
          forbiddenCommandPayloadIncluded: false,
        },
        safeBoundaryFlags: this.buildSyncPacketBoundaryFlags(),
      });

    return {
      adapterName: ADAPTER_NAME,
      adapterVersion: ADAPTER_VERSION,
      requestId,
      generatedAt,
      permission,
      sourceAllowlistUsed,
      recordsConsidered: rows.length,
      recordsReturned: rows.length,
      rows,
      providerInput,
      safeSummary,
      syncPacketArtifacts,
      safeBoundaryFlags: this.buildSafeBoundaryFlags(),
      audit: {
        adapterName: ADAPTER_NAME,
        adapterVersion: ADAPTER_VERSION,
        requestId,
        generatedAt,
        requestedByRole: permission.requestedByRole,
        normalizedRole: permission.normalizedRole,
        permissionResult: permission.permissionResult,
        permissionScope: permission.permissionScope,
        sourceAllowlistUsed,
        recordsConsidered: rows.length,
        recordsReturned: rows.length,
        blockedReasons: allBlockedReasons,
        auditPersisted: false,
      },
    };
  }

  private async readAndNormalizeRows(
    reader: StarkAiFinanceReadonlySafeSummaryReader,
    requestId: string,
    generatedAt: string,
    permission: StarkAiFinanceReadonlySafeSummaryPermissionResult,
    sources: readonly SourceReaderConfig[],
  ): Promise<StarkAiFinanceReadonlySafeSummaryAdapterRow[]> {
    const rows: StarkAiFinanceReadonlySafeSummaryAdapterRow[] = [];
    for (const source of sources) {
      const context: StarkAiFinanceReadonlySafeSummaryReaderContext = {
        requestId,
        generatedAt,
        requestedByRole: permission.normalizedRole,
        permissionScope: permission.permissionScope,
        sourceName: source.sourceName,
      };
      const readerRows = await source.read(reader, context);
      readerRows.forEach((row, index) => {
        rows.push(this.normalizeReaderRow(row, source.sourceName, index));
      });
    }
    return rows;
  }

  private normalizeReaderRow(
    row: StarkAiFinanceReadonlySafeSummaryReaderRow,
    expectedSourceName: StarkAiFinanceReadonlySafeSummarySourceName,
    index: number,
  ): StarkAiFinanceReadonlySafeSummaryAdapterRow {
    const scanReport = this.scanUnsafeReaderRow(row);
    const blockedReasons = this.resolveBlockedReasons(scanReport);
    const normalizedSourceName = this.normalizeToken(row.safeSourceName);
    if (
      normalizedSourceName &&
      normalizedSourceName !== expectedSourceName
    ) {
      blockedReasons.push('reader_source_name_not_allowlisted');
    }
    const maskedTail = this.resolveMaskedAccountTail(row.maskedAccountTail);
    if (maskedTail.blockedReason) {
      blockedReasons.push(maskedTail.blockedReason);
    }
    const evidenceStatus = this.resolveEvidenceStatus(row.evidenceStatus);
    const adapterBlocked = blockedReasons.length > 0;
    const sourceFinality = this.resolveSourceFinality(
      row.sourceFinality,
      evidenceStatus,
      adapterBlocked,
    );
    return {
      safeSourceName: expectedSourceName,
      safeRecordId: adapterBlocked
        ? `${expectedSourceName}-blocked-${index + 1}`
        : this.resolveSafeRecordId(row.safeRecordId, expectedSourceName, index),
      evidenceStatus: adapterBlocked ? 'reference_only' : evidenceStatus,
      reconciliationStatus: adapterBlocked
        ? 'blocked_sensitive_reader_row'
        : this.normalizeToken(row.reconciliationStatus) || 'review_only',
      amountBucket: adapterBlocked
        ? 'amount_bucket_blocked'
        : this.normalizeToken(row.amountBucket) || 'amount_bucket_not_provided',
      riskLevel: adapterBlocked
        ? 'blocked'
        : this.resolveRiskLevel(row.riskLevel, evidenceStatus),
      blockerLabel: adapterBlocked
        ? this.buildBlockedLabel(blockedReasons)
        : this.normalizeToken(row.blockerLabel) ||
          this.defaultBlockerLabel(evidenceStatus),
      maskedAccountTail: adapterBlocked ? null : maskedTail.value,
      counterpartyPresence: adapterBlocked
        ? 'not_provided'
        : this.resolveCounterpartyPresence(row.counterpartyPresence),
      invoiceOrReceivableState: adapterBlocked
        ? 'review_only'
        : this.normalizeToken(row.invoiceOrReceivableState) || 'not_provided',
      sourceFinality,
      adapterBlocked,
      adapterBlockedReasons: this.uniqueStrings(blockedReasons),
    };
  }

  private toMapperSafeRows(
    rows: readonly StarkAiFinanceReadonlySafeSummaryAdapterRow[],
  ): StarkAiFinanceSafeSummarySourceRow[] {
    return rows.map((row) => {
      if (!row.adapterBlocked) {
        return row;
      }
      return {
        safeSourceName: row.safeSourceName,
        safeRecordId: row.safeRecordId,
        evidenceStatus: 'reference_only',
        reconciliationStatus: 'blocked_review_fact_only',
        amountBucket: 'amount_bucket_blocked',
        riskLevel: 'blocked',
        blockerLabel: 'blocked_sensitive_reader_row',
        maskedAccountTail: 'blocked_tail_not_available',
        counterpartyPresence: 'not_provided',
        invoiceOrReceivableState: 'review_only',
        sourceFinality: 'review_only',
      };
    });
  }

  private resolvePermission(
    role: string | null | undefined,
  ): StarkAiFinanceReadonlySafeSummaryPermissionResult {
    const requestedByRole = this.sanitizeText(role, ['requestedByRole']);
    const normalized = this.normalizeToken(requestedByRole);
    if (!normalized) {
      return {
        requestedByRole: 'missing',
        normalizedRole: 'missing',
        permissionResult: 'blocked',
        permissionScope: 'blocked',
        blockedReasons: ['requested_role_missing'],
      };
    }
    const canonicalRole = ROLE_ALIASES[normalized];
    if (!canonicalRole) {
      return {
        requestedByRole: normalized,
        normalizedRole: normalized,
        permissionResult: 'blocked',
        permissionScope: 'blocked',
        blockedReasons: ['requested_role_unknown'],
      };
    }
    if (canonicalRole === 'owner' || canonicalRole === 'admin') {
      return {
        requestedByRole: normalized,
        normalizedRole: canonicalRole,
        permissionResult: 'allowed',
        permissionScope: 'global_finance_summary',
        blockedReasons: [],
      };
    }
    if (canonicalRole === 'finance') {
      return {
        requestedByRole: normalized,
        normalizedRole: canonicalRole,
        permissionResult: 'allowed',
        permissionScope: 'finance_scope_summary',
        blockedReasons: [],
      };
    }
    if (canonicalRole === 'reviewer') {
      return {
        requestedByRole: normalized,
        normalizedRole: canonicalRole,
        permissionResult: 'allowed',
        permissionScope: 'review_scope_summary',
        blockedReasons: [],
      };
    }
    return {
      requestedByRole: normalized,
      normalizedRole: canonicalRole,
      permissionResult: 'blocked',
      permissionScope: 'blocked',
      blockedReasons: ['role_not_allowed_for_finance_summary'],
    };
  }

  private resolveSourceAllowlist(
    requestedSources: readonly unknown[] | null | undefined,
  ): {
    sources: SourceReaderConfig[];
    blockedReasons: string[];
  } {
    if (!requestedSources || requestedSources.length === 0) {
      return {
        sources: [...SOURCE_ALLOWLIST],
        blockedReasons: [],
      };
    }
    const blockedReasons: string[] = [];
    const selectedSources: SourceReaderConfig[] = [];
    for (const source of requestedSources) {
      const normalizedSource = this.normalizeToken(source);
      if (!SOURCE_ALLOWLIST_SET.has(normalizedSource)) {
        blockedReasons.push(`source_not_allowlisted:${normalizedSource || 'empty'}`);
        continue;
      }
      const sourceConfig = SOURCE_ALLOWLIST.find(
        (item) => item.sourceName === normalizedSource,
      );
      if (sourceConfig) {
        selectedSources.push(sourceConfig);
      }
    }
    return {
      sources: this.uniqueSources(selectedSources),
      blockedReasons: this.uniqueStrings(blockedReasons),
    };
  }

  private scanUnsafeReaderRow(
    input: unknown,
  ): UnsafeReaderRowScanReport {
    const scanReport: UnsafeReaderRowScanReport = { ...EMPTY_SCAN_REPORT };
    this.scanValue(input, scanReport, []);
    return scanReport;
  }

  private scanValue(
    value: unknown,
    scanReport: UnsafeReaderRowScanReport,
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
    scanReport: UnsafeReaderRowScanReport,
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
      /<SECRET_BLOCKED>|secret[_\s-]?(marker|value|payload)?|token=|password=|\.env|private[_\s-]?key|certificate/i.test(
        text,
      )
    ) {
      scanReport.secretDetected += 1;
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
    if (
      FORBIDDEN_ACTION_CODES.some((code) =>
        new RegExp(this.escapeRegExp(code), 'i').test(text),
      ) ||
      (this.isCommandContext(contextPath) && /execute|command|payload/i.test(text))
    ) {
      scanReport.forbiddenActionDetected += 1;
    }
  }

  private resolveBlockedReasons(
    scanReport: UnsafeReaderRowScanReport,
  ): string[] {
    const reasons: string[] = [];
    if (scanReport.rawSmsDetected > 0) {
      reasons.push('raw_sms_blocked');
    }
    if (scanReport.verificationCodeDetected > 0) {
      reasons.push('verification_code_blocked');
    }
    if (scanReport.fullPhoneDetected > 0) {
      reasons.push('full_phone_blocked');
    }
    if (scanReport.fullBankAccountDetected > 0) {
      reasons.push('full_bank_account_blocked');
    }
    if (scanReport.rawPaymentPayloadDetected > 0) {
      reasons.push('raw_payment_payload_blocked');
    }
    if (scanReport.callbackPayloadDetected > 0) {
      reasons.push('callback_payload_blocked');
    }
    if (scanReport.secretDetected > 0) {
      reasons.push('secret_blocked');
    }
    if (scanReport.databaseFilesDetected > 0) {
      reasons.push('database_file_blocked');
    }
    if (scanReport.runtimeLogsDetected > 0) {
      reasons.push('runtime_log_blocked');
    }
    if (scanReport.privateKeysDetected > 0) {
      reasons.push('private_key_blocked');
    }
    if (scanReport.certificatesDetected > 0) {
      reasons.push('certificate_blocked');
    }
    if (scanReport.productionPayloadsDetected > 0) {
      reasons.push('production_payload_blocked');
    }
    if (scanReport.forbiddenActionDetected > 0) {
      reasons.push('forbidden_action_blocked');
    }
    return reasons;
  }

  private resolveSafeRecordId(
    value: unknown,
    sourceName: StarkAiFinanceReadonlySafeSummarySourceName,
    index: number,
  ): string {
    const sanitized = this
      .sanitizeText(value, ['safeRecordId'])
      .replace(/\b\d{12,}\b/g, 'redacted_numeric_id');
    return this.normalizeToken(sanitized) || `${sourceName}_row_${index + 1}`;
  }

  private resolveEvidenceStatus(
    value: unknown,
  ): StarkAiFinanceReadonlySafeSummaryEvidenceStatus {
    const normalized = this.normalizeToken(value).replace('-', '_');
    return EVIDENCE_STATUS_ALLOWLIST.has(normalized)
      ? (normalized as StarkAiFinanceReadonlySafeSummaryEvidenceStatus)
      : 'reference_only';
  }

  private resolveRiskLevel(
    value: unknown,
    evidenceStatus: StarkAiFinanceReadonlySafeSummaryEvidenceStatus,
  ): StarkAiFinanceReadonlySafeSummaryRiskLevel {
    const normalized = this.normalizeToken(value);
    if (RISK_LEVEL_ALLOWLIST.has(normalized)) {
      return normalized as StarkAiFinanceReadonlySafeSummaryRiskLevel;
    }
    return this.isNonFinalStatus(evidenceStatus) ? 'review' : 'info';
  }

  private resolveCounterpartyPresence(
    value: unknown,
  ): StarkAiFinanceReadonlySafeSummaryCounterpartyPresence {
    const normalized = this.normalizeToken(value);
    return COUNTERPARTY_PRESENCE_ALLOWLIST.has(normalized)
      ? (normalized as StarkAiFinanceReadonlySafeSummaryCounterpartyPresence)
      : 'not_provided';
  }

  private resolveSourceFinality(
    value: unknown,
    evidenceStatus: StarkAiFinanceReadonlySafeSummaryEvidenceStatus,
    adapterBlocked: boolean,
  ): StarkAiFinanceReadonlySafeSummarySourceFinality {
    if (adapterBlocked) {
      return 'review_only';
    }
    const normalized = this.normalizeToken(value).replace('-', '_');
    if (this.isNonFinalStatus(evidenceStatus)) {
      return evidenceStatus === 'reference_only' ? 'review_only' : 'non_final';
    }
    return SOURCE_FINALITY_ALLOWLIST.has(normalized)
      ? (normalized as StarkAiFinanceReadonlySafeSummarySourceFinality)
      : 'final';
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
      blockedReason: 'masked_account_tail_not_tail_or_masked',
    };
  }

  private defaultBlockerLabel(
    evidenceStatus: StarkAiFinanceReadonlySafeSummaryEvidenceStatus,
  ): string {
    return this.isNonFinalStatus(evidenceStatus)
      ? 'non_final_finance_review'
      : 'no_blocker_label';
  }

  private buildBlockedLabel(blockedReasons: readonly string[]): string {
    return `blocked_sensitive_reader_row_${this.normalizeToken(
      blockedReasons[0] ?? 'unknown',
    )}`;
  }

  private resolveRequestId(value: string | null | undefined): string {
    return this.normalizeToken(value) || DEFAULT_REQUEST_ID;
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
      .replace(/<RAW_SMS_BODY_BLOCKED>/gi, 'redacted_sensitive')
      .replace(/<VERIFICATION_CODE_BLOCKED>/gi, 'redacted_sensitive')
      .replace(/<FULL_PHONE_BLOCKED>/gi, 'redacted_sensitive')
      .replace(/<FULL_BANK_ACCOUNT_BLOCKED>/gi, 'redacted_sensitive')
      .replace(/<SECRET_BLOCKED>/gi, 'redacted_sensitive')
      .replace(/rawSmsBody/gi, 'redacted_sensitive')
      .replace(/raw[_\s-]?sms[_\s:a-z0-9-]*/gi, 'redacted_sensitive')
      .replace(
        /verificationCodeValue|verification[_\s-]?(code|marker|value)[_\s:a-z0-9-]*/gi,
        'redacted_sensitive',
      )
      .replace(/full[_\s-]?phone[_\s:a-z0-9-]*/gi, 'redacted_sensitive')
      .replace(
        /full[_\s-]?(bank[_\s-]?)?account[_\s:a-z0-9-]*/gi,
        'redacted_sensitive',
      )
      .replace(
        /raw[_\s-]?payment[_\s-]?payload[_\s:a-z0-9-]*/gi,
        'redacted_sensitive',
      )
      .replace(
        /paymentProviderPayload|payment[_\s-]?(provider[_\s-]?)?payload[_\s:a-z0-9-]*/gi,
        'redacted_sensitive',
      )
      .replace(/callback[_\s-]?payload[_\s:a-z0-9-]*/gi, 'redacted_sensitive')
      .replace(
        /secret[_\s-]?(marker|value|payload)?[_\s:a-z0-9-]*/gi,
        'redacted_sensitive',
      )
      .replace(/token=[^\s,;]+/gi, 'redacted_sensitive')
      .replace(/password=[^\s,;]+/gi, 'redacted_sensitive')
      .replace(/private[_\s-]?key[_\s:a-z0-9-]*/gi, 'redacted_sensitive')
      .replace(/BEGIN PRIVATE KEY/gi, 'redacted_sensitive')
      .replace(/certificate[_\s:a-z0-9-]*/gi, 'redacted_sensitive')
      .replace(/cert[_\s-]?marker[_\s:a-z0-9-]*/gi, 'redacted_sensitive')
      .replace(/BEGIN CERTIFICATE/gi, 'redacted_sensitive')
      .replace(/database[_\s-]?file[_\s:a-z0-9-]*/gi, 'redacted_sensitive')
      .replace(/db[_\s-]?file[_\s:a-z0-9-]*/gi, 'redacted_sensitive')
      .replace(/\.(sqlite|db)\b/gi, 'redacted_sensitive')
      .replace(/runtime[_\s-]?log[_\s:a-z0-9-]*/gi, 'redacted_sensitive')
      .replace(/\.log\b/gi, 'redacted_sensitive')
      .replace(
        /productionConnector[_\s:a-z0-9-]*|production[_\s-]?(connector|provider)[_\s:a-z0-9-]*/gi,
        'redacted_sensitive',
      )
      .replace(/provider[_\s-]?payload[_\s:a-z0-9-]*/gi, 'redacted_sensitive')
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

  private buildSafeBoundaryFlags(): StarkAiFinanceReadonlySafeSummaryAdapterBoundaryFlags {
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
      dispatchCounter: 0,
      taskCreationCounter: 0,
      lifecycleMutationCounter: 0,
      payrollBenefitCustomerRightCounter: 0,
      realWechatPayCounter: 0,
      readOnly: true,
      reviewContextOnly: true,
      directSqlAllowed: false,
      arbitraryTableSelectorAllowed: false,
      rawRowsAllowed: false,
      databaseWriteAllowed: false,
      businessExecutionAllowed: false,
    };
  }

  private buildSyncPacketBoundaryFlags(): Record<string, 0 | false> {
    return {
      databaseWriteCounter: 0,
      businessWriteCounter: 0,
      dispatchCounter: 0,
      taskCreationCounter: 0,
      lifecycleMutationCounter: 0,
      paymentOrCollectionMutationCounter: 0,
      workOrderMutationCounter: 0,
      virtualLedgerMutationCounter: 0,
      commandPayloadAllowed: false,
      actionApprovalGranted: false,
      databaseWriteAllowed: false,
      businessExecutionAllowed: false,
    };
  }

  private uniqueSources(
    sources: readonly SourceReaderConfig[],
  ): SourceReaderConfig[] {
    const seen = new Set<string>();
    return sources.filter((source) => {
      if (seen.has(source.sourceName)) {
        return false;
      }
      seen.add(source.sourceName);
      return true;
    });
  }

  private uniqueStrings(items: readonly string[]): string[] {
    return [...new Set(items)];
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
