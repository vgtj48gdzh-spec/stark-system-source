import { Injectable } from '@nestjs/common';
import type { StarkAiDatabaseSafeSummaryEnvelope } from './stark-ai-database-safe-summary-provider.service';

export type StarkAiSyncPacketStatus =
  | 'ready_for_chatgpt_review'
  | 'blocked_from_chatgpt_handoff';

export type StarkAiSyncPacketJsonValue =
  | string
  | number
  | boolean
  | null
  | StarkAiSyncPacketJsonValue[]
  | { [key: string]: StarkAiSyncPacketJsonValue };

export interface StarkAiSyncPacketRedactionReportInput {
  rawSmsIncluded?: boolean;
  verificationCodesIncluded?: boolean;
  fullPhoneIncluded?: boolean;
  fullBankAccountIncluded?: boolean;
  secretsIncluded?: boolean;
  runtimeLogsIncluded?: boolean;
  privateKeysIncluded?: boolean;
  certificatesIncluded?: boolean;
  databaseFilesIncluded?: boolean;
  productionConnectorPayloadsIncluded?: boolean;
  forbiddenCommandPayloadIncluded?: boolean;
  [key: string]: unknown;
}

export interface StarkAiSyncPacketSafeBoundaryFlagsInput {
  databaseWriteCounter?: number;
  businessWriteCounter?: number;
  dispatchCounter?: number;
  taskCreationCounter?: number;
  lifecycleMutationCounter?: number;
  paymentOrCollectionMutationCounter?: number;
  workOrderMutationCounter?: number;
  virtualLedgerMutationCounter?: number;
  [key: string]: unknown;
}

export interface StarkAiSyncPacketInput {
  generatedAt?: string | Date;
  sourceSystem?: unknown;
  repo?: unknown;
  latestVerifiedMainCommit?: unknown;
  currentSystemState?: unknown;
  aiCapabilitySummary?: unknown;
  currentBlockers?: unknown;
  recentTaskDrafts?: unknown;
  employeeHandoffPreviewSummary?: unknown;
  supervisorReviewSummary?: unknown;
  databaseSafeSummaries?: readonly StarkAiDatabaseSafeSummaryEnvelope[] | unknown;
  contactPhonePolicySummary?: unknown;
  chatGptContactPhoneReviewResponseValidationSummary?: unknown;
  aiSelfReviewQuestions?: unknown;
  questionsForChatGPT?: unknown;
  redactionReport?: StarkAiSyncPacketRedactionReportInput | unknown;
  safeBoundaryFlags?: StarkAiSyncPacketSafeBoundaryFlagsInput | unknown;
}

export interface StarkAiSyncPacketRedactionReport
  extends Record<string, StarkAiSyncPacketJsonValue> {
  rawSmsIncluded: boolean;
  verificationCodesIncluded: boolean;
  fullPhoneIncluded: boolean;
  fullBankAccountIncluded: boolean;
  secretsIncluded: boolean;
  runtimeLogsIncluded: boolean;
  privateKeysIncluded: boolean;
  certificatesIncluded: boolean;
  databaseFilesIncluded: boolean;
  productionPayloadsIncluded: boolean;
  forbiddenCommandPayloadIncluded: boolean;
  sensitiveInputDetected: boolean;
  redactionApplied: boolean;
  blockedFromChatGptHandoff: boolean;
  detectionCounts: Record<string, number>;
  blockedReasons: string[];
}

export interface StarkAiSyncPacketSafeBoundaryFlags
  extends Record<string, StarkAiSyncPacketJsonValue> {
  databaseWriteCounter: 0;
  businessWriteCounter: 0;
  dispatchCounter: 0;
  taskCreationCounter: 0;
  lifecycleMutationCounter: 0;
  paymentOrCollectionMutationCounter: 0;
  workOrderMutationCounter: 0;
  virtualLedgerMutationCounter: 0;
  reviewOnly: true;
  commandPayloadAllowed: false;
  actionApprovalGranted: false;
  databaseReadAllowedThisRound: false;
  databaseWriteAllowed: false;
  businessExecutionAllowed: false;
  packetIsCommandBus: false;
}

export interface StarkAiSyncPacketDatabaseSafeSummarySummary
  extends Record<string, StarkAiSyncPacketJsonValue> {
  totalSummaries: number;
  allowedSummaryCount: number;
  blockedSummaryCount: number;
  blockedReviewFactCount: number;
  summaryTypes: string[];
  permissionResults: Record<string, number>;
  safeBoundaryCounterTotals: Record<string, number>;
  redactionDetectionTotals: Record<string, number>;
  allSafeSummaryCountersZero: boolean;
  allPacketCountersZero: true;
  sourcePolicy: string;
  noDatabaseReadPerformedByPacketGenerator: true;
  blockedSummariesAreReviewFactsOnly: true;
  blockedSummariesCanCreateAction: false;
  canDispatchFromPacket: false;
  canCreateTaskFromPacket: false;
  canMutateLifecycleFromPacket: false;
  canWriteDatabaseFromPacket: false;
  canExecuteBusinessActionFromPacket: false;
}

export interface StarkAiSyncPacketContactPhonePolicySummary
  extends Record<string, StarkAiSyncPacketJsonValue> {
  contextType: 'contact_phone_policy_safe_summary';
  fragmentCount: number;
  contextFragments: number;
  allowedCount: number;
  deniedCount: number;
  auditRequiredCount: number;
  approvalRequiredCount: number;
  fullPhoneAllowedDecisionCount: number;
  fullPhoneAllowedDecisions: number;
  maskedPhoneAllowedCount: number;
  callWithoutRevealAllowedCount: number;
  callWithoutRevealAllowed: number;
  externalSafeCount: number;
  externalFullPhoneIncludedAllowed: false;
  phoneHashExternalSafeByDefault: false;
  safeReferenceCustomerIds: string[];
  safeReferencePhoneTails: string[];
  safeReferenceMaskedPhones: string[];
  forbiddenExternalFields: string[];
  databaseReads: 0;
  databaseWrites: 0;
  businessActions: 0;
  customerContactExecutionAllowed: false;
  databaseReadAllowed: false;
  databaseWriteAllowed: false;
  businessActionAllowed: false;
  liveGatewayAllowed: false;
  mcpGatewayAllowed: false;
  voiceIntegrationAllowed: false;
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  syntheticOnly: true;
  sourcePolicy: 'contact_phone_permission_policy_safe_summary_only';
  noDatabaseReadPerformedByPacketGenerator: true;
  noDatabaseWritePerformedByPacketGenerator: true;
  canExecuteCustomerContactFromPacket: false;
  canExposeFullPhoneFromPacket: false;
  canExposePhoneHashFromPacket: false;
  canUseLiveGatewayFromPacket: false;
  canUseMcpGatewayFromPacket: false;
  canUseVoiceIntegrationFromPacket: false;
}

export interface StarkAiSyncPacketChatGptContactPhoneReviewResponseValidationSummary
  extends Record<string, StarkAiSyncPacketJsonValue> {
  contextType: 'chatgpt_contact_phone_review_response_validation_safe_summary';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  syntheticOnly: true;
  validFixtureCount: number;
  blockedFixtureCount: number;
  validArtifactCount: number;
  blockedArtifactCount: number;
  supportedInteractionTypes: string[];
  resultStatuses: string[];
  blockedReasonGroups: string[];
  databaseReads: 0;
  databaseWrites: 0;
  businessActions: 0;
  customerContactExecutionCount: 0;
  dispatchCount: 0;
  taskCreationCount: 0;
  liveGatewayCount: 0;
  mcpGatewayCount: 0;
  voiceIntegrationCount: 0;
  sourceReviewResponseValidatorPr122: 'merged_source';
  sourceAiServiceConsumptionPr123: 'merged_source';
}

export interface StarkAiSyncPacket {
  packetVersion: 'stark_ai_sync_packet_v1';
  generatedAt: string;
  sourceSystem: string;
  repo: string;
  latestVerifiedMainCommit: string;
  packetStatus: StarkAiSyncPacketStatus;
  chatGptHandoffAllowed: boolean;
  reviewOnlyNotice: string;
  blockedReasons: string[];
  currentSystemState: StarkAiSyncPacketJsonValue;
  aiCapabilitySummary: StarkAiSyncPacketJsonValue;
  currentBlockers: StarkAiSyncPacketJsonValue;
  recentTaskDrafts: StarkAiSyncPacketJsonValue;
  employeeHandoffPreviewSummary: StarkAiSyncPacketJsonValue;
  supervisorReviewSummary: StarkAiSyncPacketJsonValue;
  databaseSafeSummaryBatch: StarkAiSyncPacketJsonValue;
  databaseSafeSummarySummary: StarkAiSyncPacketDatabaseSafeSummarySummary;
  contactPhonePolicySummary: StarkAiSyncPacketContactPhonePolicySummary;
  chatGptContactPhoneReviewResponseValidationSummary: StarkAiSyncPacketChatGptContactPhoneReviewResponseValidationSummary;
  aiSelfReviewQuestions: StarkAiSyncPacketJsonValue;
  questionsForChatGPT: StarkAiSyncPacketJsonValue;
  redactionReport: StarkAiSyncPacketRedactionReport;
  safeBoundaryFlags: StarkAiSyncPacketSafeBoundaryFlags;
}

export interface StarkAiSyncPacketArtifacts {
  jsonPacket: StarkAiSyncPacket;
  markdownPacket: string;
}

interface UnsafeInputScanReport {
  rawSmsDetected: number;
  verificationCodeDetected: number;
  fullPhoneDetected: number;
  fullBankAccountDetected: number;
  secretsDetected: number;
  runtimeLogsDetected: number;
  privateKeysDetected: number;
  certificatesDetected: number;
  databaseFilesDetected: number;
  productionPayloadsDetected: number;
  forbiddenCommandPayloadDetected: number;
}

const PACKET_VERSION = 'stark_ai_sync_packet_v1' as const;
const DEFAULT_SOURCE_SYSTEM = 'stark-system-ai';
const DEFAULT_REPO = 'vgtj48gdzh-spec/stark-system';
const REVIEW_ONLY_NOTICE =
  'Review-only sync packet. This is not a command, action request, approval, dispatch, task creation, lifecycle mutation, database instruction, finance confirmation, or business execution.';

const REQUIRED_COUNTER_NAMES = [
  'databaseWriteCounter',
  'businessWriteCounter',
  'dispatchCounter',
  'taskCreationCounter',
  'lifecycleMutationCounter',
  'paymentOrCollectionMutationCounter',
  'workOrderMutationCounter',
  'virtualLedgerMutationCounter',
] as const;

const DATABASE_SAFE_SUMMARY_BOUNDARY_COUNTER_NAMES = [
  'databaseReadCounter',
  'databaseWriteCounter',
  'businessWriteCounter',
  'businessExecutionCounter',
  'dispatchCounter',
  'taskCreationCounter',
  'lifecycleMutationCounter',
  'bankSmsConfirmationCounter',
  'collectionOrPaymentCreationCounter',
  'workOrderMutationCounter',
  'virtualLedgerMutationCounter',
  'payrollBenefitCustomerRightCounter',
  'realWechatPayCounter',
] as const;

const DATABASE_SAFE_SUMMARY_REDACTION_COUNTER_NAMES = [
  'rawSmsDetected',
  'verificationCodeDetected',
  'fullPhoneDetected',
  'fullBankAccountDetected',
  'secretsDetected',
  'databaseFilesDetected',
  'runtimeLogsDetected',
  'privateKeysDetected',
  'certificatesDetected',
  'productionPayloadsDetected',
  'forbiddenActionPayloadDetected',
] as const;

const CONTACT_PHONE_FORBIDDEN_EXTERNAL_FIELDS = [
  'phone_normalized',
  'phone_hash',
  'fullPhone',
  'fullPhoneIncluded',
] as const;

const CHATGPT_REVIEW_RESPONSE_SUPPORTED_INTERACTION_TYPES = [
  'review_response',
  'clarification_request',
  'codex_instruction_candidate',
] as const;

const CHATGPT_REVIEW_RESPONSE_RESULT_STATUSES = [
  'valid_review_artifact',
  'blocked_review_artifact',
] as const;

const CHATGPT_REVIEW_RESPONSE_BLOCKED_REASON_GROUPS = [
  'english_customer_phone_request',
  'chinese_sensitive_request',
  'customer_contact_execution',
  'gateway_request',
  'allowed_operations_forbidden',
  'compact_allowed_operation_bypass',
  'unsafe_safe_boundary_bypass',
  'real_phone_like_digits',
  'forbidden_true_flags',
] as const;

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

const MARKDOWN_SECTIONS = [
  ['Current System State', 'currentSystemState'],
  ['AI Capability Summary', 'aiCapabilitySummary'],
  ['Current Blockers', 'currentBlockers'],
  ['Recent Task Drafts', 'recentTaskDrafts'],
  ['Employee Handoff Preview Summary', 'employeeHandoffPreviewSummary'],
  ['Supervisor Review Summary', 'supervisorReviewSummary'],
  ['Database Safe Summary Batch', 'databaseSafeSummaryBatch'],
  ['Database Safe Summary Summary', 'databaseSafeSummarySummary'],
  ['Contact Phone Policy Summary', 'contactPhonePolicySummary'],
  [
    'ChatGPT Contact Phone Review Response Validation Summary',
    'chatGptContactPhoneReviewResponseValidationSummary',
  ],
  ['AI Self Review Questions', 'aiSelfReviewQuestions'],
  ['Questions For ChatGPT', 'questionsForChatGPT'],
  ['Redaction Report', 'redactionReport'],
  ['SAFE Boundary Flags', 'safeBoundaryFlags'],
] as const;

const EMPTY_SCAN_REPORT: UnsafeInputScanReport = {
  rawSmsDetected: 0,
  verificationCodeDetected: 0,
  fullPhoneDetected: 0,
  fullBankAccountDetected: 0,
  secretsDetected: 0,
  runtimeLogsDetected: 0,
  privateKeysDetected: 0,
  certificatesDetected: 0,
  databaseFilesDetected: 0,
  productionPayloadsDetected: 0,
  forbiddenCommandPayloadDetected: 0,
};

const REDACTED_SENSITIVE_MARKER = '[redacted_sensitive]';
const REDACTED_PHONE_MARKER = '[redacted_phone]';
const REDACTED_ACCOUNT_MARKER = '[redacted_account]';
const BLOCKED_ACTION_MARKER = '[blocked_action]';
const REDACTED_FIELD_MARKER = 'redactedSensitiveField';

@Injectable()
export class StarkAiSyncPacketService {
  toSyncPacketArtifacts(
    input: StarkAiSyncPacketInput,
  ): StarkAiSyncPacketArtifacts {
    const jsonPacket = this.toJsonSyncPacket(input);
    return {
      jsonPacket,
      markdownPacket: this.toMarkdownFromJsonPacket(jsonPacket),
    };
  }

  toJsonSyncPacket(input: StarkAiSyncPacketInput): StarkAiSyncPacket {
    const scanReport = this.scanUnsafeInput(input);
    const counterBlockedReasons = this.resolveCounterBlockedReasons(
      input.safeBoundaryFlags,
    );
    const redactionBlockedReasons = this.resolveRedactionBlockedReasons(
      input.redactionReport,
      scanReport,
    );
    const blockedReasons = this.uniqueStrings([
      ...redactionBlockedReasons,
      ...counterBlockedReasons,
    ]);
    const packetStatus: StarkAiSyncPacketStatus =
      blockedReasons.length > 0
        ? 'blocked_from_chatgpt_handoff'
        : 'ready_for_chatgpt_review';
    const databaseSafeSummaryBatch = this.sanitizeDatabaseSafeSummaryBatch(
      input.databaseSafeSummaries,
    );
    const databaseSafeSummarySummary = this.buildDatabaseSafeSummarySummary(
      input.databaseSafeSummaries,
    );
    const contactPhonePolicySummary = this.buildContactPhonePolicySummary(
      input.contactPhonePolicySummary,
    );
    const chatGptContactPhoneReviewResponseValidationSummary =
      this.buildChatGptContactPhoneReviewResponseValidationSummary(
        input.chatGptContactPhoneReviewResponseValidationSummary,
      );

    return {
      packetVersion: PACKET_VERSION,
      generatedAt: this.resolveGeneratedAt(input.generatedAt),
      sourceSystem:
        this.sanitizeText(input.sourceSystem, ['sourceSystem']) ||
        DEFAULT_SOURCE_SYSTEM,
      repo: this.sanitizeText(input.repo, ['repo']) || DEFAULT_REPO,
      latestVerifiedMainCommit: this.sanitizeText(
        input.latestVerifiedMainCommit,
        ['latestVerifiedMainCommit'],
      ),
      packetStatus,
      chatGptHandoffAllowed: packetStatus === 'ready_for_chatgpt_review',
      reviewOnlyNotice: REVIEW_ONLY_NOTICE,
      blockedReasons,
      currentSystemState: this.sanitizeJsonValue(input.currentSystemState ?? {}, [
        'currentSystemState',
      ]),
      aiCapabilitySummary: this.sanitizeJsonValue(
        input.aiCapabilitySummary ?? {},
        ['aiCapabilitySummary'],
      ),
      currentBlockers: this.sanitizeJsonValue(input.currentBlockers ?? [], [
        'currentBlockers',
      ]),
      recentTaskDrafts: this.sanitizeJsonValue(input.recentTaskDrafts ?? [], [
        'recentTaskDrafts',
      ]),
      employeeHandoffPreviewSummary: this.sanitizeJsonValue(
        input.employeeHandoffPreviewSummary ?? {},
        ['employeeHandoffPreviewSummary'],
      ),
      supervisorReviewSummary: this.sanitizeJsonValue(
        input.supervisorReviewSummary ?? {},
        ['supervisorReviewSummary'],
      ),
      databaseSafeSummaryBatch,
      databaseSafeSummarySummary,
      contactPhonePolicySummary,
      chatGptContactPhoneReviewResponseValidationSummary,
      aiSelfReviewQuestions: this.sanitizeJsonValue(
        input.aiSelfReviewQuestions ?? [],
        ['aiSelfReviewQuestions'],
      ),
      questionsForChatGPT: this.sanitizeJsonValue(
        input.questionsForChatGPT ?? [],
        ['questionsForChatGPT'],
      ),
      redactionReport: this.buildRedactionReport(
        input.redactionReport,
        scanReport,
        packetStatus,
        blockedReasons,
      ),
      safeBoundaryFlags: this.buildSafeBoundaryFlags(),
    };
  }

  toMarkdownSyncPacket(input: StarkAiSyncPacketInput): string {
    return this.toMarkdownFromJsonPacket(this.toJsonSyncPacket(input));
  }

  toMarkdownFromJsonPacket(packet: StarkAiSyncPacket): string {
    const lines: string[] = [
      '# Stark AI Sync Packet',
      '',
      `- packetVersion: ${packet.packetVersion}`,
      `- generatedAt: ${packet.generatedAt}`,
      `- sourceSystem: ${packet.sourceSystem}`,
      `- repo: ${packet.repo}`,
      `- latestVerifiedMainCommit: ${packet.latestVerifiedMainCommit || 'unknown'}`,
      `- packetStatus: ${packet.packetStatus}`,
      `- chatGptHandoffAllowed: ${packet.chatGptHandoffAllowed}`,
      `- reviewOnlyNotice: ${packet.reviewOnlyNotice}`,
      '',
    ];

    for (const [title, fieldName] of MARKDOWN_SECTIONS) {
      lines.push(`## ${title}`, '');
      lines.push(...this.renderMarkdownValue(packet[fieldName], 0));
      lines.push('');
    }

    return `${lines.join('\n').trimEnd()}\n`;
  }

  private buildRedactionReport(
    inputReport: unknown,
    scanReport: UnsafeInputScanReport,
    packetStatus: StarkAiSyncPacketStatus,
    blockedReasons: readonly string[],
  ): StarkAiSyncPacketRedactionReport {
    const report = this.asRecord(inputReport);
    const rawSmsIncluded =
      this.booleanFlag(report.rawSmsIncluded) || scanReport.rawSmsDetected > 0;
    const verificationCodesIncluded =
      this.booleanFlag(report.verificationCodesIncluded) ||
      scanReport.verificationCodeDetected > 0;
    const fullPhoneIncluded =
      this.booleanFlag(report.fullPhoneIncluded) ||
      scanReport.fullPhoneDetected > 0;
    const fullBankAccountIncluded =
      this.booleanFlag(report.fullBankAccountIncluded) ||
      scanReport.fullBankAccountDetected > 0;
    const secretsIncluded =
      this.booleanFlag(report.secretsIncluded) || scanReport.secretsDetected > 0;
    const runtimeLogsIncluded =
      this.booleanFlag(report.runtimeLogsIncluded) ||
      scanReport.runtimeLogsDetected > 0;
    const privateKeysIncluded =
      this.booleanFlag(report.privateKeysIncluded) ||
      scanReport.privateKeysDetected > 0;
    const certificatesIncluded =
      this.booleanFlag(report.certificatesIncluded) ||
      scanReport.certificatesDetected > 0;
    const databaseFilesIncluded =
      this.booleanFlag(report.databaseFilesIncluded) ||
      scanReport.databaseFilesDetected > 0;
    const productionPayloadsIncluded =
      this.booleanFlag(report.productionConnectorPayloadsIncluded) ||
      scanReport.productionPayloadsDetected > 0;
    const forbiddenCommandPayloadIncluded =
      this.booleanFlag(report.forbiddenCommandPayloadIncluded) ||
      scanReport.forbiddenCommandPayloadDetected > 0;
    const sensitiveInputDetected = [
      rawSmsIncluded,
      verificationCodesIncluded,
      fullPhoneIncluded,
      fullBankAccountIncluded,
      secretsIncluded,
      runtimeLogsIncluded,
      privateKeysIncluded,
      certificatesIncluded,
      databaseFilesIncluded,
      productionPayloadsIncluded,
      forbiddenCommandPayloadIncluded,
    ].some(Boolean);

    return {
      rawSmsIncluded,
      verificationCodesIncluded,
      fullPhoneIncluded,
      fullBankAccountIncluded,
      secretsIncluded,
      runtimeLogsIncluded,
      privateKeysIncluded,
      certificatesIncluded,
      databaseFilesIncluded,
      productionPayloadsIncluded,
      forbiddenCommandPayloadIncluded,
      sensitiveInputDetected,
      redactionApplied: sensitiveInputDetected,
      blockedFromChatGptHandoff:
        packetStatus === 'blocked_from_chatgpt_handoff',
      detectionCounts: { ...scanReport },
      blockedReasons: [...blockedReasons],
    };
  }

  private buildSafeBoundaryFlags(): StarkAiSyncPacketSafeBoundaryFlags {
    return {
      databaseWriteCounter: 0,
      businessWriteCounter: 0,
      dispatchCounter: 0,
      taskCreationCounter: 0,
      lifecycleMutationCounter: 0,
      paymentOrCollectionMutationCounter: 0,
      workOrderMutationCounter: 0,
      virtualLedgerMutationCounter: 0,
      reviewOnly: true,
      commandPayloadAllowed: false,
      actionApprovalGranted: false,
      databaseReadAllowedThisRound: false,
      databaseWriteAllowed: false,
      businessExecutionAllowed: false,
      packetIsCommandBus: false,
    };
  }

  private sanitizeDatabaseSafeSummaryBatch(
    input: unknown,
  ): StarkAiSyncPacketJsonValue[] {
    if (!Array.isArray(input)) {
      return [];
    }
    return input.map((entry) =>
      this.sanitizeJsonValue(entry, ['databaseSafeSummaryBatch']),
    );
  }

  private buildDatabaseSafeSummarySummary(
    input: unknown,
  ): StarkAiSyncPacketDatabaseSafeSummarySummary {
    const envelopes = Array.isArray(input) ? input : [];
    const summaryTypes: string[] = [];
    const permissionResults: Record<string, number> = {};
    const safeBoundaryCounterTotals = this.zeroCounterTotals(
      DATABASE_SAFE_SUMMARY_BOUNDARY_COUNTER_NAMES,
    );
    const redactionDetectionTotals = this.zeroCounterTotals(
      DATABASE_SAFE_SUMMARY_REDACTION_COUNTER_NAMES,
    );
    let blockedSummaryCount = 0;

    for (const envelope of envelopes) {
      const record = this.asRecord(envelope);
      const audit = this.asRecord(record.audit);
      const summary = this.asRecord(record.summary);
      const summaryType =
        this.sanitizeText(record.summaryType, [
          'databaseSafeSummarySummary',
          'summaryType',
        ]) || 'unknown';
      const permissionResult =
        this.sanitizeText(audit.permissionResult, [
          'databaseSafeSummarySummary',
          'permissionResult',
        ]) || 'unknown';
      const blocked =
        audit.blocked === true ||
        audit.permissionResult === 'blocked' ||
        summary.outputSuppressed === true;

      summaryTypes.push(summaryType);
      permissionResults[permissionResult] =
        (permissionResults[permissionResult] ?? 0) + 1;
      if (blocked) {
        blockedSummaryCount += 1;
      }

      const safeBoundaryFlags = this.asRecord(record.safeBoundaryFlags);
      for (const counterName of DATABASE_SAFE_SUMMARY_BOUNDARY_COUNTER_NAMES) {
        safeBoundaryCounterTotals[counterName] += this.numericCounter(
          safeBoundaryFlags[counterName],
        );
      }

      const redactionReport = this.asRecord(record.redactionReport);
      const detectionCounts = this.asRecord(redactionReport.detectionCounts);
      for (const counterName of DATABASE_SAFE_SUMMARY_REDACTION_COUNTER_NAMES) {
        redactionDetectionTotals[counterName] += this.numericCounter(
          detectionCounts[counterName],
        );
      }
    }

    const allSafeSummaryCountersZero = [
      ...Object.values(safeBoundaryCounterTotals),
      ...Object.values(redactionDetectionTotals),
    ].every((count) => count === 0);

    return {
      totalSummaries: envelopes.length,
      allowedSummaryCount: envelopes.length - blockedSummaryCount,
      blockedSummaryCount,
      blockedReviewFactCount: blockedSummaryCount,
      summaryTypes: this.uniqueStrings(summaryTypes),
      permissionResults,
      safeBoundaryCounterTotals,
      redactionDetectionTotals,
      allSafeSummaryCountersZero,
      allPacketCountersZero: true,
      sourcePolicy: 'already_safe_summary_envelopes_only',
      noDatabaseReadPerformedByPacketGenerator: true,
      blockedSummariesAreReviewFactsOnly: true,
      blockedSummariesCanCreateAction: false,
      canDispatchFromPacket: false,
      canCreateTaskFromPacket: false,
      canMutateLifecycleFromPacket: false,
      canWriteDatabaseFromPacket: false,
      canExecuteBusinessActionFromPacket: false,
    };
  }

  private buildContactPhonePolicySummary(
    input: unknown,
  ): StarkAiSyncPacketContactPhonePolicySummary {
    const record = this.asRecord(input);
    const fragmentCount = this.numericCounter(
      record.fragmentCount ?? record.contextFragments,
    );
    const fullPhoneAllowedDecisionCount = this.numericCounter(
      record.fullPhoneAllowedDecisionCount ??
        record.fullPhoneAllowedDecisions,
    );
    const callWithoutRevealAllowedCount = this.numericCounter(
      record.callWithoutRevealAllowedCount ?? record.callWithoutRevealAllowed,
    );

    return {
      contextType: 'contact_phone_policy_safe_summary',
      fragmentCount,
      contextFragments: fragmentCount,
      allowedCount: this.numericCounter(record.allowedCount),
      deniedCount: this.numericCounter(record.deniedCount),
      auditRequiredCount: this.numericCounter(record.auditRequiredCount),
      approvalRequiredCount: this.numericCounter(record.approvalRequiredCount),
      fullPhoneAllowedDecisionCount,
      fullPhoneAllowedDecisions: fullPhoneAllowedDecisionCount,
      maskedPhoneAllowedCount: this.numericCounter(
        record.maskedPhoneAllowedCount,
      ),
      callWithoutRevealAllowedCount,
      callWithoutRevealAllowed: callWithoutRevealAllowedCount,
      externalSafeCount: this.numericCounter(record.externalSafeCount),
      externalFullPhoneIncludedAllowed: false,
      phoneHashExternalSafeByDefault: false,
      safeReferenceCustomerIds: this.sanitizeStringArray(
        record.safeReferenceCustomerIds,
        ['contactPhonePolicySummary', 'safeReferenceCustomerIds'],
      ),
      safeReferencePhoneTails: this.sanitizeStringArray(
        record.safeReferencePhoneTails,
        ['contactPhonePolicySummary', 'safeReferencePhoneTails'],
      ),
      safeReferenceMaskedPhones: this.sanitizeStringArray(
        record.safeReferenceMaskedPhones,
        ['contactPhonePolicySummary', 'safeReferenceMaskedPhones'],
      ),
      forbiddenExternalFields: this.buildContactPhoneForbiddenExternalFields(
        record.forbiddenExternalFields,
      ),
      databaseReads: 0,
      databaseWrites: 0,
      businessActions: 0,
      customerContactExecutionAllowed: false,
      databaseReadAllowed: false,
      databaseWriteAllowed: false,
      businessActionAllowed: false,
      liveGatewayAllowed: false,
      mcpGatewayAllowed: false,
      voiceIntegrationAllowed: false,
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      syntheticOnly: true,
      sourcePolicy: 'contact_phone_permission_policy_safe_summary_only',
      noDatabaseReadPerformedByPacketGenerator: true,
      noDatabaseWritePerformedByPacketGenerator: true,
      canExecuteCustomerContactFromPacket: false,
      canExposeFullPhoneFromPacket: false,
      canExposePhoneHashFromPacket: false,
      canUseLiveGatewayFromPacket: false,
      canUseMcpGatewayFromPacket: false,
      canUseVoiceIntegrationFromPacket: false,
    };
  }

  private buildContactPhoneForbiddenExternalFields(input: unknown): string[] {
    const allowed = new Set<string>(CONTACT_PHONE_FORBIDDEN_EXTERNAL_FIELDS);
    const fields = this.sanitizeStringArray(input, [
      'contactPhonePolicySummary',
      'forbiddenExternalFields',
    ]).filter((field) => allowed.has(field));
    return this.uniqueStrings([
      ...CONTACT_PHONE_FORBIDDEN_EXTERNAL_FIELDS,
      ...fields,
    ]);
  }

  private buildChatGptContactPhoneReviewResponseValidationSummary(
    input: unknown,
  ): StarkAiSyncPacketChatGptContactPhoneReviewResponseValidationSummary {
    const record = this.asRecord(input);
    const validFixtureCount = this.numericCounter(record.validFixtureCount);
    const blockedFixtureCount = this.numericCounter(record.blockedFixtureCount);
    const validArtifactCount = this.numericCounter(
      record.validArtifactCount ?? record.validFixtureCount,
    );
    const blockedArtifactCount = this.numericCounter(
      record.blockedArtifactCount ?? record.blockedFixtureCount,
    );

    return {
      contextType: 'chatgpt_contact_phone_review_response_validation_safe_summary',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      syntheticOnly: true,
      validFixtureCount,
      blockedFixtureCount,
      validArtifactCount,
      blockedArtifactCount,
      supportedInteractionTypes: this.orderAllowedStrings(
        record.supportedInteractionTypes,
        CHATGPT_REVIEW_RESPONSE_SUPPORTED_INTERACTION_TYPES,
        [
          'chatGptContactPhoneReviewResponseValidationSummary',
          'supportedInteractionTypes',
        ],
      ),
      resultStatuses: this.orderAllowedStrings(
        record.resultStatuses,
        CHATGPT_REVIEW_RESPONSE_RESULT_STATUSES,
        ['chatGptContactPhoneReviewResponseValidationSummary', 'resultStatuses'],
      ),
      blockedReasonGroups: this.orderAllowedStrings(
        record.blockedReasonGroups,
        CHATGPT_REVIEW_RESPONSE_BLOCKED_REASON_GROUPS,
        [
          'chatGptContactPhoneReviewResponseValidationSummary',
          'blockedReasonGroups',
        ],
      ),
      databaseReads: 0,
      databaseWrites: 0,
      businessActions: 0,
      customerContactExecutionCount: 0,
      dispatchCount: 0,
      taskCreationCount: 0,
      liveGatewayCount: 0,
      mcpGatewayCount: 0,
      voiceIntegrationCount: 0,
      sourceReviewResponseValidatorPr122: 'merged_source',
      sourceAiServiceConsumptionPr123: 'merged_source',
    };
  }

  private sanitizeStringArray(
    value: unknown,
    contextPath: readonly string[],
  ): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return this.uniqueStrings(
      value
        .map((entry) => this.sanitizeText(entry, contextPath))
        .filter((entry) => entry.length > 0),
    );
  }

  private orderAllowedStrings(
    value: unknown,
    allowedValues: readonly string[],
    contextPath: readonly string[],
  ): string[] {
    const presentValues = new Set(
      this.sanitizeStringArray(value, contextPath).filter((entry) =>
        allowedValues.includes(entry),
      ),
    );
    return allowedValues.filter((entry) => presentValues.has(entry));
  }

  private zeroCounterTotals(
    counterNames: readonly string[],
  ): Record<string, number> {
    return Object.fromEntries(
      counterNames.map((counterName) => [counterName, 0]),
    );
  }

  private numericCounter(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private resolveRedactionBlockedReasons(
    inputReport: unknown,
    scanReport: UnsafeInputScanReport,
  ): string[] {
    const report = this.asRecord(inputReport);
    const reasons: string[] = [];
    const redactionFlagMap: Array<[string, unknown, number]> = [
      ['raw_sms_detected', report.rawSmsIncluded, scanReport.rawSmsDetected],
      [
        'verification_code_detected',
        report.verificationCodesIncluded,
        scanReport.verificationCodeDetected,
      ],
      [
        'full_phone_detected',
        report.fullPhoneIncluded,
        scanReport.fullPhoneDetected,
      ],
      [
        'full_bank_account_detected',
        report.fullBankAccountIncluded,
        scanReport.fullBankAccountDetected,
      ],
      ['secret_detected', report.secretsIncluded, scanReport.secretsDetected],
      [
        'runtime_log_detected',
        report.runtimeLogsIncluded,
        scanReport.runtimeLogsDetected,
      ],
      [
        'private_key_detected',
        report.privateKeysIncluded,
        scanReport.privateKeysDetected,
      ],
      [
        'certificate_detected',
        report.certificatesIncluded,
        scanReport.certificatesDetected,
      ],
      [
        'database_file_detected',
        report.databaseFilesIncluded,
        scanReport.databaseFilesDetected,
      ],
      [
        'production_connector_payload_detected',
        report.productionConnectorPayloadsIncluded,
        scanReport.productionPayloadsDetected,
      ],
      [
        'forbidden_command_payload_detected',
        report.forbiddenCommandPayloadIncluded,
        scanReport.forbiddenCommandPayloadDetected,
      ],
    ];

    for (const [reason, flag, detectedCount] of redactionFlagMap) {
      if (this.booleanFlag(flag) || detectedCount > 0) {
        reasons.push(reason);
      }
    }

    return this.uniqueStrings(reasons);
  }

  private resolveCounterBlockedReasons(safeBoundaryFlags: unknown): string[] {
    const flags = this.asRecord(safeBoundaryFlags);
    return REQUIRED_COUNTER_NAMES.filter(
      (counterName) =>
        typeof flags[counterName] === 'number' && flags[counterName] !== 0,
    ).map((counterName) => `${counterName}_must_remain_zero`);
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
      Object.entries(value as Record<string, unknown>).forEach(([key, entry]) =>
        this.scanValue(entry, scanReport, [...contextPath, key]),
      );
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
    if (this.isContactPhoneForbiddenExternalFieldLabel(contextPath, text)) {
      return;
    }
    if (/<RAW_SMS_BODY_BLOCKED>|raw[_-]?sms|rawSmsBody/i.test(text)) {
      scanReport.rawSmsDetected += 1;
    }
    if (
      /<VERIFICATION_CODE_BLOCKED>|verification[_-]?(code|marker|value)|verificationCodeValue/i.test(
        text,
      )
    ) {
      scanReport.verificationCodeDetected += 1;
    }
    if (/<FULL_PHONE_BLOCKED>|full[_-]?phone|\b1[3-9]\d{9}\b/i.test(text)) {
      scanReport.fullPhoneDetected += 1;
    }
    if (
      /<FULL_BANK_ACCOUNT_BLOCKED>|full[_-]?(bank[_-]?)?account/i.test(text) ||
      (/\b\d{12,}\b/.test(text) &&
        this.hasBankAccountContext(contextPath, text))
    ) {
      scanReport.fullBankAccountDetected += 1;
    }
    if (
      /<SECRET_BLOCKED>|secret[_-]?(marker|value|payload)|token=|password=|\.env/i.test(
        text,
      )
    ) {
      scanReport.secretsDetected += 1;
    }
    if (/runtime[_-]?log/i.test(text)) {
      scanReport.runtimeLogsDetected += 1;
    }
    if (/private[_-]?key/i.test(text)) {
      scanReport.privateKeysDetected += 1;
    }
    if (/certificate|cert[_-]?marker/i.test(text)) {
      scanReport.certificatesDetected += 1;
    }
    if (/database[_-]?file|db[_-]?file/i.test(text)) {
      scanReport.databaseFilesDetected += 1;
    }
    if (
      /productionConnector|production[_-]?connector|payment[_-]?provider[_-]?payload/i.test(
        text,
      )
    ) {
      scanReport.productionPayloadsDetected += 1;
    }
    if (this.shouldBlockForbiddenActionCode(text, contextPath)) {
      scanReport.forbiddenCommandPayloadDetected += 1;
    }
  }

  private sanitizeJsonValue(
    value: unknown,
    contextPath: readonly string[],
  ): StarkAiSyncPacketJsonValue {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === 'string') {
      return this.sanitizeText(value, contextPath);
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeJsonValue(item, contextPath));
    }
    if (typeof value === 'object') {
      const sanitizedEntries = Object.entries(value as Record<string, unknown>).map(
        ([key, entry]) => [
          this.sanitizeObjectKey(key),
          this.sanitizeJsonValue(entry, [...contextPath, key]),
        ],
      );
      return Object.fromEntries(sanitizedEntries);
    }
    return this.sanitizeText(value, contextPath);
  }

  private sanitizeObjectKey(key: string): string {
    const sanitizedKey = this.sanitizeText(key, ['fieldName'])
      .replace(/rawSmsBody|raw[_-]?sms/gi, REDACTED_FIELD_MARKER)
      .replace(
        /verificationCodeValue|verification[_-]?(code|marker|value)/gi,
        REDACTED_FIELD_MARKER,
      )
      .replace(/full[_-]?phone/gi, REDACTED_FIELD_MARKER)
      .replace(/full[_-]?(bank[_-]?)?account/gi, REDACTED_FIELD_MARKER)
      .replace(/secret[_-]?(marker|value|payload)?/gi, REDACTED_FIELD_MARKER)
      .replace(/private[_-]?key/gi, REDACTED_FIELD_MARKER)
      .replace(/certificate|cert[_-]?marker/gi, REDACTED_FIELD_MARKER)
      .replace(/database[_-]?file|db[_-]?file/gi, REDACTED_FIELD_MARKER)
      .replace(/runtime[_-]?log/gi, REDACTED_FIELD_MARKER)
      .replace(
        /productionConnector|production[_-]?connector/gi,
        REDACTED_FIELD_MARKER,
      );
    return sanitizedKey || REDACTED_FIELD_MARKER;
  }

  private sanitizeText(value: unknown, contextPath: readonly string[]): string {
    if (value === undefined || value === null) {
      return '';
    }
    let text = String(value).trim();
    if (!text) {
      return '';
    }
    if (this.isContactPhoneForbiddenExternalFieldLabel(contextPath, text)) {
      return text;
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
      .replace(/raw[_-]?sms[_:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /verificationCodeValue|verification[_-]?(code|marker|value)[_:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(/full[_-]?phone[_:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /full[_-]?(bank[_-]?)?account[_:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(
        /secret[_-]?(marker|value|payload)?[_:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(/token=[^\s,;]+/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/password=[^\s,;]+/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/private[_-]?key[_:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/certificate[_:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/cert[_-]?marker[_:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/database[_-]?file[_:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/db[_-]?file[_:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(/runtime[_-]?log[_:a-z0-9-]*/gi, REDACTED_SENSITIVE_MARKER)
      .replace(
        /productionConnector[_:a-z0-9-]*|production[_-]?connector[_:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(
        /payment[_-]?provider[_-]?payload[_:a-z0-9-]*/gi,
        REDACTED_SENSITIVE_MARKER,
      )
      .replace(/\.env/gi, REDACTED_SENSITIVE_MARKER)
      .trim();
  }

  private renderMarkdownValue(
    value: StarkAiSyncPacketJsonValue,
    depth: number,
  ): string[] {
    const prefix = '  '.repeat(depth);
    if (value === null) {
      return [`${prefix}- none`];
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return [`${prefix}- ${this.markdownScalar(value)}`];
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [`${prefix}- none`];
      }
      return value.flatMap((entry, index) => {
        if (this.isScalar(entry)) {
          return [`${prefix}- ${this.markdownScalar(entry)}`];
        }
        return [
          `${prefix}- item ${index + 1}:`,
          ...this.renderMarkdownValue(entry, depth + 1),
        ];
      });
    }

    const entries = Object.entries(value);
    if (entries.length === 0) {
      return [`${prefix}- none`];
    }
    return entries.flatMap(([key, entry]) => {
      if (this.isScalar(entry)) {
        return [`${prefix}- ${key}: ${this.markdownScalar(entry)}`];
      }
      return [
        `${prefix}- ${key}:`,
        ...this.renderMarkdownValue(entry, depth + 1),
      ];
    });
  }

  private isScalar(value: StarkAiSyncPacketJsonValue): boolean {
    return (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }

  private markdownScalar(value: StarkAiSyncPacketJsonValue): string {
    if (value === null || value === '') {
      return 'none';
    }
    return String(value).replace(/\r?\n/g, ' ');
  }

  private resolveGeneratedAt(value: string | Date | undefined): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value.trim() : date.toISOString();
    }
    return new Date().toISOString();
  }

  private booleanFlag(value: unknown): boolean {
    return value === true;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private hasForbiddenActionCode(text: string): boolean {
    return FORBIDDEN_ACTION_CODES.some((code) =>
      new RegExp(this.escapeRegExp(code), 'i').test(text),
    );
  }

  private shouldBlockForbiddenActionCode(
    text: string,
    contextPath: readonly string[],
  ): boolean {
    if (!this.hasForbiddenActionCode(text)) {
      return false;
    }
    if (this.isForbiddenActionAuditFactContext(contextPath)) {
      return false;
    }
    return this.isExecutableInstructionContext(contextPath);
  }

  private isForbiddenActionAuditFactContext(
    contextPath: readonly string[],
  ): boolean {
    return contextPath.some((key) =>
      [
        'forbiddenactioncodes',
        'forbiddenactioncodecount',
        'forbiddenactionsareauditfactsonly',
      ].includes(this.normalizeContextKey(key)),
    );
  }

  private isExecutableInstructionContext(
    contextPath: readonly string[],
  ): boolean {
    return contextPath.some((key) => {
      const normalizedKey = this.normalizeContextKey(key);
      return (
        normalizedKey.includes('command') ||
        normalizedKey.includes('executable') ||
        normalizedKey.includes('toolpayload') ||
        normalizedKey.includes('actionpayload') ||
        normalizedKey.includes('instruction') ||
        normalizedKey.includes('unsafefreetext') ||
        normalizedKey.includes('unsafeinstruction') ||
        normalizedKey.includes('suggestedcommanddraft') ||
        normalizedKey.includes('forbiddenactionpayload')
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
    return (
      /\b(bank|account|card)\b|bank[_\s-]?account|full[_\s-]?(bank[_\s-]?)?account|account[_\s-]?(number|no)|card[_\s-]?(number|no)|银行卡|银行账号|账号|卡号/i.test(
        lowerText,
      ) ||
      normalizedContext.split(/\s+/).some(
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
            '银行卡',
            '银行账号',
            '账号',
            '卡号',
          ].includes(key) ||
          key.includes('bankaccount') ||
          key.includes('fullbankaccount') ||
          key.includes('accountnumber') ||
          key.includes('cardnumber'),
      )
    );
  }

  private normalizeContextKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
  }

  private isContactPhoneForbiddenExternalFieldLabel(
    contextPath: readonly string[],
    text: string,
  ): boolean {
    if (
      !contextPath.some(
        (key) => this.normalizeContextKey(key) === 'forbiddenexternalfields',
      )
    ) {
      return false;
    }
    return CONTACT_PHONE_FORBIDDEN_EXTERNAL_FIELDS.some(
      (fieldName) => fieldName === text,
    );
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private uniqueStrings(items: readonly string[]): string[] {
    return [...new Set(items)];
  }
}
