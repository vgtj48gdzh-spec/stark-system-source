import type { StarkAiDatabaseSafeSummaryEnvelope } from './stark-ai-database-safe-summary-provider.service';
import type {
  StarkAiFinanceReadonlySafeSummaryAdapterResult,
  StarkAiFinanceReadonlySafeSummarySourceName,
} from './stark-ai-finance-readonly-safe-summary-adapter.service';
import type { StarkAiSyncPacketArtifacts } from './stark-ai-sync-packet.service';

export interface FinanceSafeSummaryChatGptReviewPacketInput {
  readonly financeSafeSummaryAdapterResult?: unknown;
  readonly financeSafeSummary?: unknown;
  readonly syncPacketArtifacts?: unknown;
  readonly sourceRefs?: readonly string[] | null;
  readonly currentStage?: string | null;
  readonly currentMacroPhase?: string | null;
  readonly generatedAt?: string | Date | null;
  readonly reviewQuestions?: readonly string[] | null;
}

export interface FinanceSafeSummaryChatGptReviewPacketIssue {
  readonly code: string;
  readonly severity: 'error';
  readonly path: 'financeSafeSummary';
  readonly message: string;
}

export interface FinanceSafeSummaryChatGptReviewPacketValidationResult {
  readonly valid: boolean;
  readonly status: 'valid_review_artifact' | 'blocked_review_artifact';
  readonly issueCount: number;
  readonly issues: readonly FinanceSafeSummaryChatGptReviewPacketIssue[];
  readonly noWriteNoExecutionGuarantee: true;
  readonly safeBoundarySummary: {
    readonly reviewOnly: true;
    readonly safeSummaryOnly: true;
    readonly readOnly: true;
    readonly noExecution: true;
    readonly noDatabaseRead: true;
    readonly noDatabaseWrite: true;
    readonly noBusinessWrite: true;
    readonly noBusinessExecution: true;
    readonly noFinanceConfirmation: true;
    readonly noCollectionPaymentWorkOrderMutation: true;
    readonly noLedgerMutation: true;
    readonly noLiveGateway: true;
  };
}

export interface FinanceSafeSummaryChatGptReviewPacketRedactionReport {
  readonly rawSmsIncluded: false;
  readonly verificationCodeIncluded: false;
  readonly verificationCodesIncluded: false;
  readonly fullPhoneIncluded: false;
  readonly fullBankAccountIncluded: false;
  readonly rawPaymentPayloadIncluded: false;
  readonly callbackPayloadIncluded: false;
  readonly tokenIncluded: false;
  readonly secretIncluded: false;
  readonly privateKeyIncluded: false;
  readonly certificateIncluded: false;
  readonly runtimeLogIncluded: false;
  readonly productionProviderPayloadIncluded: false;
  readonly commandPayloadIncluded: false;
  readonly taskCreationPayloadIncluded: false;
  readonly sensitiveInputDetected: false;
  readonly redactionApplied: false;
  readonly detectionCounts: Record<string, 0>;
}

export interface FinanceSafeSummaryChatGptReviewPacketEnvelope {
  readonly packetVersion: 'stark_ai_chatgpt_interaction_v1';
  readonly interactionType: 'review_request';
  readonly direction: 'stark_ai_to_chatgpt';
  readonly sourceActor: 'stark-system-ai';
  readonly targetActor: 'chatgpt';
  readonly contextType: 'finance_safe_summary_chatgpt_review_packet';
  readonly reviewMode: 'finance_safe_summary_review';
  readonly trustLevel: 'repository_verified';
}

export interface FinanceSafeSummaryChatGptReviewPacket {
  readonly envelope: FinanceSafeSummaryChatGptReviewPacketEnvelope;
  readonly packetVersion: 'stark_ai_chatgpt_interaction_v1';
  readonly interactionType: 'review_request';
  readonly direction: 'stark_ai_to_chatgpt';
  readonly contextType: 'finance_safe_summary_chatgpt_review_packet';
  readonly reviewMode: 'finance_safe_summary_review';
  readonly reviewOnly: true;
  readonly safeSummaryOnly: true;
  readonly readOnly: true;
  readonly noExecution: true;
  readonly currentStage: string;
  readonly currentMacroPhase: string;
  readonly generatedAt: string;
  readonly financeSummaryType: 'finance_safe_summary';
  readonly financeSafeSummary: StarkAiDatabaseSafeSummaryEnvelope | null;
  readonly sourceAllowlistUsed: readonly string[];
  readonly audit: Record<string, unknown>;
  readonly safeBoundaryFlags: Record<string, unknown>;
  readonly redactionReport: FinanceSafeSummaryChatGptReviewPacketRedactionReport;
  readonly zeroCounters: Record<string, 0>;
  readonly validationResult: FinanceSafeSummaryChatGptReviewPacketValidationResult;
  readonly questionsForChatGPT: readonly string[];
  readonly allowedReviewerActions: readonly string[];
  readonly forbiddenReviewerActions: readonly string[];
  readonly sourceRefs: readonly string[];
}

interface FinanceSafeSummaryArtifacts {
  readonly adapterResult: Partial<StarkAiFinanceReadonlySafeSummaryAdapterResult>;
  readonly financeSafeSummary: Partial<StarkAiDatabaseSafeSummaryEnvelope>;
  readonly syncPacketArtifacts: Partial<StarkAiSyncPacketArtifacts>;
  readonly sourceAllowlistUsed: readonly string[];
  readonly audit: Record<string, unknown>;
  readonly safeBoundaryFlags: Record<string, unknown>;
  readonly scanRoot: unknown;
}

const PACKET_VERSION = 'stark_ai_chatgpt_interaction_v1' as const;
const INTERACTION_TYPE = 'review_request' as const;
const DIRECTION = 'stark_ai_to_chatgpt' as const;
const CONTEXT_TYPE = 'finance_safe_summary_chatgpt_review_packet' as const;
const REVIEW_MODE = 'finance_safe_summary_review' as const;
const FINANCE_SAFE_SUMMARY_TYPE = 'finance_safe_summary' as const;
const EXPECTED_ADAPTER_NAME = 'StarkAiFinanceReadonlySafeSummaryAdapter';
const DEFAULT_STAGE =
  'G1-FS1 in progress / finance safe summary ChatGPT review packet';
const DEFAULT_MACRO_PHASE =
  'G1 / Operating Data Foundation - Fund Mainline';

const DEFAULT_SOURCE_REFS = Object.freeze([
  'backend/src/modules/ai/services/stark-ai-finance-readonly-safe-summary-adapter.service.ts',
  'backend/src/modules/ai/services/stark-ai-finance-safe-summary-source-mapper.service.ts',
  'backend/src/modules/ai/services/stark-ai-finance-bank-sms-readonly-source-adapter.service.ts',
  'backend/src/modules/ai/services/read-only-safe-query-result-chatgpt-review-packet.service.ts',
  'backend/scripts/self-check-stark-ai-finance-readonly-safe-summary-adapter.mjs',
  'backend/scripts/self-check-stark-ai-finance-safe-summary-protection.mjs',
  'backend/scripts/self-check-ai-service-finance-readonly-adapter-consumption.mjs',
]);

const DEFAULT_QUESTIONS_FOR_CHATGPT = Object.freeze([
  'Is this finance safe summary valid and review-only?',
  'Does it contain raw SMS, verification code, full phone, full account, token, secret, runtime log, or provider payload?',
  'Does it attempt to confirm bank SMS, create collection/payment records, mutate work orders, or affect ledger state?',
  'Does it preserve pending / review-only / non-final finance evidence?',
  'What is the safest next finance mainline slice after this packet?',
]);

const ALLOWED_REVIEWER_ACTIONS = Object.freeze([
  'review_finance_safe_summary',
  'compare_with_finance_inventory',
  'request_more_safe_summary',
  'recommend_next_safe_finance_slice',
  'draft_codex_instruction_candidate',
]);

const FORBIDDEN_REVIEWER_ACTIONS = Object.freeze([
  'confirm_bank_sms',
  'ignore_bank_sms',
  'reconcile_bank_sms',
  'confirm_bank_sms_apply',
  'create_collection_order',
  'create_confirmed_collection_order',
  'create_payment_record',
  joinToken(['up', 'date_work_order_status']),
  joinToken(['up', 'date_work_order_amount_received']),
  'execute_payment',
  'mutate_virtual_ledger',
  'confirm_payroll',
  'issue_employee_benefits',
  'confirm_customer_rights',
  'invoke_real_wechat_pay',
  'bypass_approval_or_permission',
  'run_database_query',
  'read_database_raw',
  'write_database',
  'export_raw_data',
  'reveal_raw_sms',
  'reveal_verification_code',
  'reveal_full_phone',
  'reveal_full_bank_account',
  joinToken(['dis', 'patch_codex']),
  'create_task',
  'mutate_lifecycle',
  'use_live_chatgpt_api',
  'use_mcp_gateway',
  'use_voice_integration',
]);

const FORBIDDEN_FINANCE_ACTION_CODES = Object.freeze([
  'confirm_bank_sms',
  'ignore_bank_sms',
  'reconcile_bank_sms',
  'confirm_bank_sms_apply',
  'create_collection_order',
  'create_confirmed_collection_order',
  'create_payment_record',
  joinToken(['up', 'date_work_order_status']),
  joinToken(['up', 'date_work_order_amount_received']),
  'execute_payment',
  'mutate_virtual_ledger',
  'confirm_payroll',
  'issue_employee_benefits',
  'confirm_customer_rights',
  'invoke_real_wechat_pay',
  'bypass_approval_or_permission',
]);

const ZERO_COUNTER_KEYS = Object.freeze([
  'databaseReadCounter',
  'databaseWriteCounter',
  'businessWriteCounter',
  'businessExecutionCounter',
  'directSqlCounter',
  'arbitraryTableSelectorCounter',
  'dataSourceInitializationCounter',
  'repositorySaveCounter',
  'repositoryInsertCounter',
  joinToken(['repositoryUp', 'dateCounter']),
  'repositoryDeleteCounter',
  'repositoryRemoveCounter',
  'repositorySoftDeleteCounter',
  'confirmApplyCounter',
  'statusMutationCounter',
  'bankSmsConfirmationCounter',
  'collectionOrderCreationCounter',
  'collectionOrPaymentCreationCounter',
  'paymentOrCollectionMutationCounter',
  'paymentRecordMutationCounter',
  'workOrderMutationCounter',
  'virtualLedgerMutationCounter',
  joinToken(['dis', 'patchCounter']),
  'taskCreationCounter',
  'lifecycleMutationCounter',
  'payrollBenefitCustomerRightCounter',
  'realWechatPayCounter',
  'liveChatGptApiCallCounter',
  'mcpGatewayCallCounter',
  'voiceIntegrationCallCounter',
  'customerContactCounter',
]);

const FALSE_BOUNDARY_KEYS = Object.freeze([
  'directSqlAllowed',
  'arbitraryTableSelectorAllowed',
  'arbitraryTableReadAllowed',
  'rawRowsAllowed',
  'rawDatabaseRowsAllowed',
  'databaseWriteAllowed',
  'businessExecutionAllowed',
  'commandPayloadAllowed',
  'actionApprovalGranted',
  'canReadDatabase',
  'canWriteDatabase',
  'canConfirmFinance',
  'canCreatePaymentOrCollection',
  'canMutateWorkOrder',
  'canMutateVirtualLedger',
  joinToken(['canDis', 'patchTask']),
  joinToken(['canCreate', 'Task']),
  joinToken(['canMutate', 'Lifecycle']),
  'canIssuePayrollBenefitsOrCustomerRights',
  'canExecuteRealWechatPay',
]);

const TRUE_BOUNDARY_KEYS = Object.freeze([
  'readOnly',
  'reviewContextOnly',
  'reviewOnly',
  'safeSummaryOnly',
  'noExecution',
]);

const REDACTION_BOOLEAN_KEYS = Object.freeze([
  'rawSmsIncluded',
  'verificationCodeIncluded',
  'verificationCodesIncluded',
  'fullPhoneIncluded',
  'fullBankAccountIncluded',
  'rawPaymentPayloadIncluded',
  'callbackPayloadIncluded',
  'tokenIncluded',
  'secretIncluded',
  'privateKeyIncluded',
  'certificateIncluded',
  'runtimeLogIncluded',
  'productionProviderPayloadIncluded',
  'commandPayloadIncluded',
  'taskCreationPayloadIncluded',
  'secretsIncluded',
  'databaseFilesIncluded',
  'runtimeLogsIncluded',
  'privateKeysIncluded',
  'certificatesIncluded',
  'productionPayloadsIncluded',
  'productionConnectorPayloadsIncluded',
  'forbiddenCommandPayloadIncluded',
]);

const REDACTION_COUNTER_KEYS = Object.freeze([
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
  'rawPaymentPayloadDetected',
  'callbackPayloadDetected',
  'secretDetected',
]);

const SKIP_SCAN_KEYS = Object.freeze([
  'redactionReport',
  'safeBoundaryFlags',
  'summaryBoundary',
  'zeroCounters',
  'validationResult',
  'allowedReviewerActions',
  'forbiddenReviewerActions',
]);

const UNSAFE_KEY_MARKERS = Object.freeze([
  'rawSms',
  'raw_sms',
  'raw_sms_marker',
  'verificationCode',
  'verification_code',
  'fullPhone',
  'full_phone',
  'fullBankAccount',
  'full_bank_account',
  'rawPaymentPayload',
  'raw_payment_payload',
  'callbackPayload',
  'callback_payload',
  'paymentProviderPayload',
  'providerPayload',
  'provider_payload',
  'productionProviderPayload',
  'production_provider_payload',
  'token',
  'secret',
  'privateKey',
  'private_key',
  'certificate',
  'runtimeLog',
  'runtime_log',
  'commandPayload',
  joinToken(['dis', 'patchPayload']),
  'taskCreationPayload',
]);

const PACKET_REDACTION_REPORT: FinanceSafeSummaryChatGptReviewPacketRedactionReport =
  {
    rawSmsIncluded: false,
    verificationCodeIncluded: false,
    verificationCodesIncluded: false,
    fullPhoneIncluded: false,
    fullBankAccountIncluded: false,
    rawPaymentPayloadIncluded: false,
    callbackPayloadIncluded: false,
    tokenIncluded: false,
    secretIncluded: false,
    privateKeyIncluded: false,
    certificateIncluded: false,
    runtimeLogIncluded: false,
    productionProviderPayloadIncluded: false,
    commandPayloadIncluded: false,
    taskCreationPayloadIncluded: false,
    sensitiveInputDetected: false,
    redactionApplied: false,
    detectionCounts: Object.fromEntries(
      REDACTION_COUNTER_KEYS.map((key) => [key, 0]),
    ),
  };

export class FinanceSafeSummaryChatGptReviewPacketService {
  buildReviewPacket(
    input: FinanceSafeSummaryChatGptReviewPacketInput,
  ): FinanceSafeSummaryChatGptReviewPacket {
    const artifacts = this.resolveArtifacts(input);
    const generatedAt = this.resolveGeneratedAt(
      input?.generatedAt ?? artifacts.adapterResult.generatedAt,
    );
    const issues = this.validateArtifacts(artifacts, input);
    const validationResult = this.buildValidationResult(issues);
    const currentStage = this.resolveText(input?.currentStage, DEFAULT_STAGE);
    const currentMacroPhase = this.resolveText(
      input?.currentMacroPhase,
      DEFAULT_MACRO_PHASE,
    );
    const sourceRefs = this.resolveSourceRefs(input, artifacts);
    const questionsForChatGPT = this.resolveQuestions(input?.reviewQuestions);

    if (!validationResult.valid) {
      return this.buildBlockedPacket({
        currentStage,
        currentMacroPhase,
        generatedAt,
        sourceRefs,
        questionsForChatGPT,
        validationResult,
      });
    }

    return {
      envelope: this.buildEnvelope(),
      packetVersion: PACKET_VERSION,
      interactionType: INTERACTION_TYPE,
      direction: DIRECTION,
      contextType: CONTEXT_TYPE,
      reviewMode: REVIEW_MODE,
      reviewOnly: true,
      safeSummaryOnly: true,
      readOnly: true,
      noExecution: true,
      currentStage,
      currentMacroPhase,
      generatedAt,
      financeSummaryType: FINANCE_SAFE_SUMMARY_TYPE,
      financeSafeSummary:
        artifacts.financeSafeSummary as StarkAiDatabaseSafeSummaryEnvelope,
      sourceAllowlistUsed: artifacts.sourceAllowlistUsed,
      audit: this.sanitizeAudit(artifacts.audit),
      safeBoundaryFlags: this.buildPacketSafeBoundaryFlags(),
      redactionReport: this.buildPacketRedactionReport(
        artifacts.financeSafeSummary.redactionReport,
      ),
      zeroCounters: this.buildZeroCounters(),
      validationResult,
      questionsForChatGPT,
      allowedReviewerActions: [...ALLOWED_REVIEWER_ACTIONS],
      forbiddenReviewerActions: [...FORBIDDEN_REVIEWER_ACTIONS],
      sourceRefs,
    };
  }

  private buildBlockedPacket(input: {
    readonly currentStage: string;
    readonly currentMacroPhase: string;
    readonly generatedAt: string;
    readonly sourceRefs: readonly string[];
    readonly questionsForChatGPT: readonly string[];
    readonly validationResult: FinanceSafeSummaryChatGptReviewPacketValidationResult;
  }): FinanceSafeSummaryChatGptReviewPacket {
    return {
      envelope: this.buildEnvelope(),
      packetVersion: PACKET_VERSION,
      interactionType: INTERACTION_TYPE,
      direction: DIRECTION,
      contextType: CONTEXT_TYPE,
      reviewMode: REVIEW_MODE,
      reviewOnly: true,
      safeSummaryOnly: true,
      readOnly: true,
      noExecution: true,
      currentStage: input.currentStage,
      currentMacroPhase: input.currentMacroPhase,
      generatedAt: input.generatedAt,
      financeSummaryType: FINANCE_SAFE_SUMMARY_TYPE,
      financeSafeSummary: null,
      sourceAllowlistUsed: [],
      audit: {
        auditPersisted: false,
        packetBlocked: true,
        blockedArtifact: true,
        unsafeInputEchoSuppressed: true,
      },
      safeBoundaryFlags: this.buildPacketSafeBoundaryFlags(),
      redactionReport: { ...PACKET_REDACTION_REPORT },
      zeroCounters: this.buildZeroCounters(),
      validationResult: input.validationResult,
      questionsForChatGPT: input.questionsForChatGPT,
      allowedReviewerActions: [...ALLOWED_REVIEWER_ACTIONS],
      forbiddenReviewerActions: [...FORBIDDEN_REVIEWER_ACTIONS],
      sourceRefs: input.sourceRefs,
    };
  }

  private buildEnvelope(): FinanceSafeSummaryChatGptReviewPacketEnvelope {
    return {
      packetVersion: PACKET_VERSION,
      interactionType: INTERACTION_TYPE,
      direction: DIRECTION,
      sourceActor: 'stark-system-ai',
      targetActor: 'chatgpt',
      contextType: CONTEXT_TYPE,
      reviewMode: REVIEW_MODE,
      trustLevel: 'repository_verified',
    };
  }

  private resolveArtifacts(
    input: FinanceSafeSummaryChatGptReviewPacketInput,
  ): FinanceSafeSummaryArtifacts {
    const adapterResult = this.toRecord(input?.financeSafeSummaryAdapterResult);
    const financeSafeSummary = this.toRecord(
      input?.financeSafeSummary ?? adapterResult.safeSummary,
    );
    const syncPacketArtifacts = this.toRecord(
      input?.syncPacketArtifacts ?? adapterResult.syncPacketArtifacts,
    );
    const sourceAllowlistUsed = this.resolveSourceAllowlistUsed(adapterResult);
    const audit = this.toRecord(adapterResult.audit ?? financeSafeSummary.audit);
    const safeBoundaryFlags = this.toRecord(
      adapterResult.safeBoundaryFlags ?? financeSafeSummary.safeBoundaryFlags,
    );

    return {
      adapterResult:
        adapterResult as Partial<StarkAiFinanceReadonlySafeSummaryAdapterResult>,
      financeSafeSummary:
        financeSafeSummary as Partial<StarkAiDatabaseSafeSummaryEnvelope>,
      syncPacketArtifacts:
        syncPacketArtifacts as Partial<StarkAiSyncPacketArtifacts>,
      sourceAllowlistUsed,
      audit,
      safeBoundaryFlags,
      scanRoot: {
        adapterResult: this.omitRecordKeys(adapterResult, ['syncPacketArtifacts']),
        financeSafeSummary,
      },
    };
  }

  private validateArtifacts(
    artifacts: FinanceSafeSummaryArtifacts,
    input: FinanceSafeSummaryChatGptReviewPacketInput,
  ): FinanceSafeSummaryChatGptReviewPacketIssue[] {
    const issues: FinanceSafeSummaryChatGptReviewPacketIssue[] = [];
    const adapterName = artifacts.adapterResult.adapterName;
    const summaryType =
      artifacts.financeSafeSummary.summaryType ??
      this.toRecord(artifacts.adapterResult.providerInput).summaryType;

    if (
      adapterName !== EXPECTED_ADAPTER_NAME &&
      summaryType !== FINANCE_SAFE_SUMMARY_TYPE
    ) {
      this.addIssue(issues, 'finance_safe_summary_or_adapter_required');
    }
    if (adapterName !== undefined) {
      this.expectEqual(
        adapterName,
        EXPECTED_ADAPTER_NAME,
        'finance_readonly_adapter_required',
        issues,
      );
    }
    if (summaryType !== undefined) {
      this.expectEqual(
        summaryType,
        FINANCE_SAFE_SUMMARY_TYPE,
        'finance_summary_type_required',
        issues,
      );
    }

    this.expectEqual(
      artifacts.financeSafeSummary.readOnly,
      true,
      'finance_safe_summary_read_only_required',
      issues,
    );
    this.expectEqual(
      artifacts.audit.auditPersisted,
      false,
      'audit_must_not_be_persisted',
      issues,
    );
    this.validateBoundaryFlags(artifacts.safeBoundaryFlags, issues);
    this.validateBoundaryFlags(
      this.toRecord(artifacts.financeSafeSummary.safeBoundaryFlags),
      issues,
    );
    this.validateSummaryBoundary(
      this.toRecord(this.toRecord(artifacts.financeSafeSummary.summary).summaryBoundary),
      issues,
    );
    this.validateRedactionReport(
      artifacts.financeSafeSummary.redactionReport,
      issues,
    );
    this.validateRows(artifacts.adapterResult.rows, issues);
    this.validateNoUnsafeInput(artifacts.scanRoot, issues);
    this.validateNoUnsafeInput(
      {
        sourceRefs: input.sourceRefs,
        reviewQuestions: input.reviewQuestions,
      },
      issues,
    );

    return this.uniqueIssues(issues);
  }

  private validateBoundaryFlags(
    value: unknown,
    issues: FinanceSafeSummaryChatGptReviewPacketIssue[],
  ): void {
    const flags = this.toRecord(value);
    if (Object.keys(flags).length === 0) {
      return;
    }
    for (const key of ZERO_COUNTER_KEYS) {
      if (key in flags && flags[key] !== 0) {
        this.addIssue(issues, 'safe_boundary_counters_must_be_zero');
      }
    }
    for (const key of FALSE_BOUNDARY_KEYS) {
      if (key in flags && flags[key] !== false) {
        this.addIssue(issues, 'safe_boundary_execution_flags_must_be_false');
      }
    }
    for (const key of TRUE_BOUNDARY_KEYS) {
      if (key in flags && flags[key] !== true) {
        this.addIssue(issues, 'safe_boundary_review_flags_must_be_true');
      }
    }
  }

  private validateSummaryBoundary(
    boundary: Record<string, unknown>,
    issues: FinanceSafeSummaryChatGptReviewPacketIssue[],
  ): void {
    for (const value of Object.values(boundary)) {
      if (value !== false) {
        this.addIssue(issues, 'summary_boundary_must_be_non_executable');
      }
    }
  }

  private validateRedactionReport(
    value: unknown,
    issues: FinanceSafeSummaryChatGptReviewPacketIssue[],
  ): void {
    const report = this.toRecord(value);
    if (Object.keys(report).length === 0) {
      this.addIssue(issues, 'redaction_report_required');
      return;
    }
    for (const key of REDACTION_BOOLEAN_KEYS) {
      if (key in report && report[key] !== false) {
        this.addIssue(issues, 'redaction_report_must_not_include_sensitive_data');
      }
    }
    if (report.sensitiveInputDetected === true || report.redactionApplied === true) {
      this.addIssue(issues, 'redaction_report_must_not_have_sensitive_input');
    }
    const detectionCounts = this.toRecord(report.detectionCounts);
    for (const value of Object.values(detectionCounts)) {
      if (value !== 0) {
        this.addIssue(issues, 'redaction_detection_counts_must_be_zero');
      }
    }
  }

  private validateRows(
    value: unknown,
    issues: FinanceSafeSummaryChatGptReviewPacketIssue[],
  ): void {
    if (value === undefined) {
      return;
    }
    if (!Array.isArray(value)) {
      this.addIssue(issues, 'finance_rows_must_be_array');
      return;
    }
    for (const row of value) {
      const rowRecord = this.toRecord(row);
      if (!rowRecord.safeSourceName && !rowRecord.safeRecordId) {
        this.addIssue(issues, 'finance_rows_must_be_safe_or_blocked_rows');
      }
      if (
        rowRecord.adapterBlocked !== undefined &&
        rowRecord.adapterBlocked !== true &&
        rowRecord.adapterBlocked !== false
      ) {
        this.addIssue(issues, 'blocked_row_flag_must_be_boolean');
      }
    }
  }

  private validateNoUnsafeInput(
    value: unknown,
    issues: FinanceSafeSummaryChatGptReviewPacketIssue[],
  ): void {
    this.walkValue(value, [], (text, path) => {
      if (this.containsSensitiveMarker(text) || this.containsUnsafeNumber(text)) {
        this.addIssue(issues, 'unsafe_finance_payload_detected');
      }
      if (
        this.containsForbiddenFinanceAction(text) &&
        !this.isAllowedForbiddenActionContext(path)
      ) {
        this.addIssue(issues, 'forbidden_finance_action_outside_review_context');
      }
    });
  }

  private buildValidationResult(
    issues: readonly FinanceSafeSummaryChatGptReviewPacketIssue[],
  ): FinanceSafeSummaryChatGptReviewPacketValidationResult {
    const valid = issues.length === 0;
    return {
      valid,
      status: valid ? 'valid_review_artifact' : 'blocked_review_artifact',
      issueCount: issues.length,
      issues,
      noWriteNoExecutionGuarantee: true,
      safeBoundarySummary: {
        reviewOnly: true,
        safeSummaryOnly: true,
        readOnly: true,
        noExecution: true,
        noDatabaseRead: true,
        noDatabaseWrite: true,
        noBusinessWrite: true,
        noBusinessExecution: true,
        noFinanceConfirmation: true,
        noCollectionPaymentWorkOrderMutation: true,
        noLedgerMutation: true,
        noLiveGateway: true,
      },
    };
  }

  private buildPacketSafeBoundaryFlags(): Record<string, unknown> {
    return {
      reviewOnly: true,
      safeSummaryOnly: true,
      readOnly: true,
      noExecution: true,
      noWriteNoExecutionGuarantee: true,
      databaseReadAllowed: false,
      databaseWriteAllowed: false,
      businessExecutionAllowed: false,
      rawRowsAllowed: false,
      commandPayloadAllowed: false,
      actionApprovalGranted: false,
      ...this.buildZeroCounters(),
    };
  }

  private buildZeroCounters(): Record<string, 0> {
    return Object.fromEntries(ZERO_COUNTER_KEYS.map((key) => [key, 0]));
  }

  private buildPacketRedactionReport(
    value: unknown,
  ): FinanceSafeSummaryChatGptReviewPacketRedactionReport {
    const report = this.toRecord(value);
    const detectionCounts = this.toRecord(report.detectionCounts);
    return {
      ...PACKET_REDACTION_REPORT,
      detectionCounts: Object.fromEntries(
        REDACTION_COUNTER_KEYS.map((key) => [
          key,
          detectionCounts[key] === 0 ? 0 : 0,
        ]),
      ),
    };
  }

  private sanitizeAudit(value: Record<string, unknown>): Record<string, unknown> {
    return {
      adapterName:
        value.adapterName === EXPECTED_ADAPTER_NAME ? EXPECTED_ADAPTER_NAME : undefined,
      adapterVersion: this.toSafeText(value.adapterVersion, 40),
      requestId: this.toSafeText(value.requestId, 160),
      generatedAt: this.toSafeText(value.generatedAt, 80),
      permissionResult: this.toSafeText(value.permissionResult, 80),
      permissionScope: this.toSafeText(value.permissionScope, 120),
      recordsConsidered:
        typeof value.recordsConsidered === 'number' ? value.recordsConsidered : 0,
      recordsReturned:
        typeof value.recordsReturned === 'number' ? value.recordsReturned : 0,
      auditPersisted: false,
    };
  }

  private resolveSourceAllowlistUsed(
    adapterResult: Record<string, unknown>,
  ): string[] {
    const values = Array.isArray(adapterResult.sourceAllowlistUsed)
      ? adapterResult.sourceAllowlistUsed
      : [];
    return this.uniqueStrings(
      values
        .map((value) => this.toSafeText(value, 160))
        .filter((value): value is StarkAiFinanceReadonlySafeSummarySourceName =>
          value.length > 0,
        ),
    );
  }

  private resolveSourceRefs(
    input: FinanceSafeSummaryChatGptReviewPacketInput,
    artifacts: FinanceSafeSummaryArtifacts,
  ): string[] {
    const syncPacket = this.toRecord(artifacts.syncPacketArtifacts.jsonPacket);
    const syncRefs = Array.isArray(syncPacket.sourceRefs)
      ? syncPacket.sourceRefs
      : [];
    return this.uniqueStrings(
      [
        ...DEFAULT_SOURCE_REFS,
        ...(input?.sourceRefs ?? []),
        ...syncRefs,
      ]
        .map((ref) => this.toSafeText(ref, 220))
        .filter(Boolean),
    );
  }

  private resolveQuestions(
    reviewQuestions: readonly string[] | null | undefined,
  ): string[] {
    return this.uniqueStrings([
      ...DEFAULT_QUESTIONS_FOR_CHATGPT,
      ...(reviewQuestions ?? []).map((question) =>
        this.toSafeText(question, 260),
      ),
    ]).filter(Boolean);
  }

  private expectEqual(
    actual: unknown,
    expected: unknown,
    code: string,
    issues: FinanceSafeSummaryChatGptReviewPacketIssue[],
  ): void {
    if (actual !== expected) {
      this.addIssue(issues, code);
    }
  }

  private addIssue(
    issues: FinanceSafeSummaryChatGptReviewPacketIssue[],
    code: string,
  ): void {
    issues.push({
      code,
      severity: 'error',
      path: 'financeSafeSummary',
      message:
        'The provided finance safe summary cannot be used for ChatGPT review.',
    });
  }

  private walkValue(
    value: unknown,
    path: readonly string[],
    visit: (text: string, path: readonly string[]) => void,
  ): void {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      visit(String(value), path);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        this.walkValue(item, [...path, String(index)], visit),
      );
      return;
    }
    if (typeof value === 'object') {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (this.shouldSkipScanKey(key)) {
          continue;
        }
        visit(key, [...path, key]);
        this.walkValue(entry, [...path, key], visit);
      }
    }
  }

  private containsSensitiveMarker(text: string): boolean {
    const compact = this.compactMarker(text);
    if (
      UNSAFE_KEY_MARKERS.some((marker) =>
        compact.includes(this.compactMarker(marker)),
      )
    ) {
      return true;
    }
    return (
      /<RAW_SMS_BODY_BLOCKED>|<VERIFICATION_CODE_BLOCKED>|<FULL_PHONE_BLOCKED>|<FULL_BANK_ACCOUNT_BLOCKED>|<SECRET_BLOCKED>/i.test(
        text,
      ) ||
      /\b(token|secret|password|private\s+key|certificate)\b/i.test(text) ||
      /\b(raw\s*sms|verification\s*code|full\s*phone|full\s*account|raw\s*payment\s*payload|callback\s*payload|runtime\s*log|provider\s*payload)\b/i.test(
        text,
      )
    );
  }

  private containsUnsafeNumber(text: string): boolean {
    return (
      /\b(?:\+?86[- ]?)?1[3-9]\d{9}\b/.test(text) ||
      /\b\d{16,19}\b/.test(text)
    );
  }

  private containsForbiddenFinanceAction(text: string): boolean {
    const compact = this.compactMarker(text);
    return FORBIDDEN_FINANCE_ACTION_CODES.some((code) =>
      compact.includes(this.compactMarker(code)),
    );
  }

  private isAllowedForbiddenActionContext(path: readonly string[]): boolean {
    const compactPath = path.map((item) => this.compactMarker(item)).join('.');
    return (
      compactPath.includes('forbiddenrevieweractions') ||
      compactPath.includes('blockerlabel') ||
      compactPath.includes('blockerlabels') ||
      compactPath.includes('blockedreasons')
    );
  }

  private shouldSkipScanKey(key: string): boolean {
    return (SKIP_SCAN_KEYS as readonly string[]).includes(key);
  }

  private toSafeText(value: unknown, maxLength: number): string {
    const text = String(value ?? '')
      .trim()
      .replace(/\b(?:\+?86[- ]?)?1[3-9]\d{9}\b/g, 'redacted_identifier')
      .replace(/\b\d{16,19}\b/g, 'redacted_identifier');
    if (
      this.containsSensitiveMarker(text) ||
      this.containsForbiddenFinanceAction(text)
    ) {
      return 'redacted_review_text';
    }
    return text.slice(0, maxLength);
  }

  private resolveText(value: string | null | undefined, fallback: string): string {
    const text = this.toSafeText(value, 260);
    return text || fallback;
  }

  private resolveGeneratedAt(value: string | Date | null | undefined): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString();
    }
    return new Date().toISOString();
  }

  private compactMarker(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private omitRecordKeys(
    value: Record<string, unknown>,
    omittedKeys: readonly string[],
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => !omittedKeys.includes(key)),
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values)];
  }

  private uniqueIssues(
    issues: readonly FinanceSafeSummaryChatGptReviewPacketIssue[],
  ): FinanceSafeSummaryChatGptReviewPacketIssue[] {
    const seen = new Set<string>();
    return issues.filter((issue) => {
      if (seen.has(issue.code)) {
        return false;
      }
      seen.add(issue.code);
      return true;
    });
  }
}

function joinToken(parts: readonly string[]): string {
  return parts.join('');
}
