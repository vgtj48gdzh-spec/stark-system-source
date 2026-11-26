import { Injectable } from '@nestjs/common';
import {
  StarkAiChatGptInteractionPacketService,
  type StarkAiChatGptInteractionPacket,
  type StarkAiChatGptInteractionReviewMode,
  type StarkAiChatGptInteractionTrustLevel,
  type StarkAiChatGptInteractionValidationIssue,
  type StarkAiChatGptInteractionValidationResult,
} from './stark-ai-chatgpt-interaction-packet.service';
import {
  StarkAiChatGptNextStepCandidateReviewHandoffService,
  type StarkAiChatGptNextStepCandidateReviewHandoff,
} from './stark-ai-chatgpt-next-step-candidate-review-handoff.service';

export type StarkAiChatGptNextStepCandidateReviewResponseType =
  | 'review_response'
  | 'clarification_request'
  | 'codex_instruction_candidate';

export type StarkAiChatGptNextStepCandidateReviewResponseStatus =
  | 'valid_review_artifact'
  | 'blocked_review_artifact';

export interface StarkAiChatGptNextStepCandidateReviewResponseValidationInput {
  generatedAt?: string | Date;
  interactionType: StarkAiChatGptNextStepCandidateReviewResponseType;
  latestVerifiedMainCommit?: string | null;
  repo?: string | null;
  reviewMode?: StarkAiChatGptInteractionReviewMode;
  trustLevel?: StarkAiChatGptInteractionTrustLevel;
  allowedOperations?: readonly unknown[] | null;
  payload?: unknown;
  recommendedCandidateId?: string | null;
}

export interface StarkAiChatGptNextStepCandidateReviewResponseZeroCounters {
  databaseReadCounter: 0;
  databaseWriteCounter: 0;
  businessWriteCounter: 0;
  businessExecutionCounter: 0;
  customerContactExecutionCounter: 0;
  dispatchCounter: 0;
  taskCreationCounter: 0;
  lifecycleMutationCounter: 0;
  liveChatGptApiCounter: 0;
  mcpGatewayCounter: 0;
  voiceIntegrationCounter: 0;
  financePaymentWorkOrderMutationCounter: 0;
}

export interface StarkAiChatGptNextStepCandidateReviewResponseValidationResult {
  contextType: 'stark_ai_chatgpt_next_step_candidate_review_response_validation_result';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  candidateOnly: true;
  syntheticOnly: true;
  nonExecutable: true;
  interactionType: StarkAiChatGptNextStepCandidateReviewResponseType;
  result: StarkAiChatGptNextStepCandidateReviewResponseStatus;
  status: StarkAiChatGptNextStepCandidateReviewResponseStatus;
  valid: boolean;
  issueCount: number;
  issues: StarkAiChatGptInteractionValidationIssue[];
  baseValidationResult: StarkAiChatGptInteractionValidationResult;
  sourceReviewRequestValidationStatus: StarkAiChatGptNextStepCandidateReviewResponseStatus;
  sourceReviewRequestInteractionType: 'review_request';
  recommendedCandidateId: string;
  allowedOperations: string[];
  forbiddenOperations: string[];
  executable: false;
  approvalGranted: false;
  dispatchAllowed: false;
  taskCreationAllowed: false;
  lifecycleMutationAllowed: false;
  databaseReadAllowed: false;
  databaseWriteAllowed: false;
  businessObjectCreationAllowed: false;
  liveChatGptApiAllowed: false;
  mcpGatewayAllowed: false;
  voiceIntegrationAllowed: false;
  zeroCounters: StarkAiChatGptNextStepCandidateReviewResponseZeroCounters;
  noWriteNoExecutionGuarantee: true;
}

const DEFAULT_REPO = 'vgtj48gdzh-spec/stark-system';

const VALIDATOR_ALLOWED_OPERATIONS = [
  'review_candidate',
  'compare_candidates',
  'request_owner_approval',
  'request_more_safe_summary',
  'draft_codex_instruction_candidate',
] as const;

const VALIDATOR_FORBIDDEN_OPERATIONS = [
  'execute_candidate',
  'start_candidate',
  'auto_start',
  'run_candidate',
  'dispatch_codex',
  'send_to_codex',
  'start_codex',
  'create_codex_task',
  'create_task',
  'formal_task_creation',
  'mutate_lifecycle',
  'mark_in_progress',
  'mark_done',
  'read_database',
  'write_database',
  'execute_business_action',
  'business_action_allowed',
  'contact_customer',
  'call_customer',
  'reveal_phone',
  'phone_normalized',
  'phone_hash',
  'full_phone',
  'fullphone',
  'live_chatgpt_api',
  'real_chatgpt_api',
  'mcp_gateway',
  'voice_integration',
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
  'raw_sms',
  'verification_code',
  'full_bank_account',
  'token',
  'secret',
  'private_key',
  'certificate',
  'database_file',
  'runtime_log',
  'production_provider_payload',
] as const;

const VALIDATOR_FORBIDDEN_TRUE_FLAGS = new Set([
  'executable',
  'approval_granted',
  'action_approval_granted',
  'dispatch_allowed',
  'dispatch_now',
  'task_creation_allowed',
  'lifecycle_mutation_allowed',
  'database_read_allowed',
  'database_write_allowed',
  'business_action_allowed',
  'business_execution_allowed',
  'business_object_creation_allowed',
  'customer_contact_execution_allowed',
  'contact_customer_allowed',
  'call_customer_allowed',
  'reveal_phone_allowed',
  'live_chatgpt_api_allowed',
  'real_chatgpt_api_allowed',
  'mcp_gateway_allowed',
  'voice_integration_allowed',
  'finance_mutation_allowed',
  'payment_mutation_allowed',
  'work_order_mutation_allowed',
  'can_auto_start',
  'can_dispatch_codex',
  'can_create_task',
  'can_mutate_lifecycle',
  'can_read_database',
  'can_write_database',
  'can_execute_business_action',
  'can_use_live_chatgpt_api',
  'can_use_mcp_gateway',
  'can_use_voice_integration',
]);

const VALIDATOR_FORBIDDEN_FIELD_KEYS = new Set([
  'phone_normalized',
  'phone_hash',
  'full_phone',
  'full_phone_value',
  'fullphone',
  'raw_sms',
  'raw_sms_body',
  'sms_body',
  'verification_code',
  'otp',
  'full_bank_account',
  'full_bank_account_number',
  'bank_account_number',
  'token',
  'secret',
  'private_key',
  'certificate',
  'database_file',
  'runtime_log',
  'production_provider_payload',
  'provider_payload',
]);

const VALIDATOR_ZERO_COUNTERS: StarkAiChatGptNextStepCandidateReviewResponseZeroCounters =
  {
    databaseReadCounter: 0,
    databaseWriteCounter: 0,
    businessWriteCounter: 0,
    businessExecutionCounter: 0,
    customerContactExecutionCounter: 0,
    dispatchCounter: 0,
    taskCreationCounter: 0,
    lifecycleMutationCounter: 0,
    liveChatGptApiCounter: 0,
    mcpGatewayCounter: 0,
    voiceIntegrationCounter: 0,
    financePaymentWorkOrderMutationCounter: 0,
  };

const SENSITIVE_TEXT_RULES: Array<[string, RegExp]> = [
  ['raw_sms', /\braw\s*sms\b|\braw_sms\b|\bsms\s*body\b/i],
  [
    'verification_code',
    /\bverification\s*code\b|\bverification_code\b|\botp\b/i,
  ],
  [
    'full_phone',
    /\bfull\s*phone\b|\bfull_phone\b|\bunmasked\s*phone\b|\bfullphone\b/i,
  ],
  [
    'full_bank_account',
    /\bfull\s*bank\s*account\b|\bfull_bank_account\b|\bbank\s*account\s*number\b|\bcard\s*number\b/i,
  ],
  ['token', /\btoken\b/i],
  ['secret', /\bsecret\b|\bpassword\b/i],
  ['private_key', /\bprivate\s*key\b|\bprivate_key\b/i],
  ['certificate', /\bcertificate\b/i],
  ['database_file', /\bdatabase\s*file\b|\bdatabase_file\b/i],
  ['runtime_log', /\bruntime\s*log\b|\bruntime_log\b/i],
  [
    'production_provider_payload',
    /\bproduction\s*provider\s*payload\b|\bproduction_provider_payload\b|\bprovider\s*payload\b/i,
  ],
];

@Injectable()
export class StarkAiChatGptNextStepCandidateReviewResponseValidatorService {
  constructor(
    private readonly interactionPacketService: StarkAiChatGptInteractionPacketService = new StarkAiChatGptInteractionPacketService(),
    private readonly candidateReviewHandoffService: StarkAiChatGptNextStepCandidateReviewHandoffService = new StarkAiChatGptNextStepCandidateReviewHandoffService(),
  ) {}

  buildSyntheticReviewResponsePacket(
    input: StarkAiChatGptNextStepCandidateReviewResponseValidationInput,
  ): StarkAiChatGptInteractionPacket {
    const sourceHandoff = this.buildSourceReviewRequestHandoff(input);
    const interactionType = input.interactionType;

    return this.interactionPacketService.buildInteractionPacket({
      createdAt: input.generatedAt,
      direction: this.directionForInteractionType(interactionType),
      interactionType,
      reviewMode:
        input.reviewMode ?? this.defaultReviewModeForInteractionType(interactionType),
      trustLevel: input.trustLevel ?? 'repository_verified',
      latestVerifiedMainCommit: input.latestVerifiedMainCommit ?? '',
      repo: input.repo ?? DEFAULT_REPO,
      allowedOperations:
        input.allowedOperations ??
        this.defaultAllowedOperationsForInteractionType(interactionType),
      forbiddenOperations: VALIDATOR_FORBIDDEN_OPERATIONS,
      payload: this.buildResponsePayload(input, sourceHandoff),
    });
  }

  validateSyntheticReviewResponseArtifact(
    input: StarkAiChatGptNextStepCandidateReviewResponseValidationInput,
  ): StarkAiChatGptNextStepCandidateReviewResponseValidationResult {
    const packet = this.buildSyntheticReviewResponsePacket(input);
    return this.validateSyntheticReviewResponsePacket(packet, input);
  }

  validateSyntheticReviewResponsePacket(
    packet: unknown,
    input: Pick<
      StarkAiChatGptNextStepCandidateReviewResponseValidationInput,
      'generatedAt' | 'latestVerifiedMainCommit' | 'repo'
    > = {},
  ): StarkAiChatGptNextStepCandidateReviewResponseValidationResult {
    const packetRecord = this.asRecord(packet);
    const envelope = this.asRecord(packetRecord.envelope ?? packetRecord);
    const sourceHandoff = this.buildSourceReviewRequestHandoff(input);
    const interactionType = this.resolveResponseType(envelope.interactionType);
    const baseValidationResult =
      this.interactionPacketService.validateInteractionPacket(packet);
    const issues = [...baseValidationResult.issues];

    this.validateSupportedInteractionType(envelope.interactionType, issues);
    this.validateAllowedOperations(envelope.allowedOperations, issues);
    this.validatePayloadSafety(packetRecord.payload, issues);

    const valid = issues.length === 0;
    const status: StarkAiChatGptNextStepCandidateReviewResponseStatus = valid
      ? 'valid_review_artifact'
      : 'blocked_review_artifact';
    const allowedOperations = Array.isArray(envelope.allowedOperations)
      ? envelope.allowedOperations.map((item) => String(item))
      : [];
    const forbiddenOperations = Array.isArray(envelope.forbiddenOperations)
      ? envelope.forbiddenOperations.map((item) => String(item))
      : [];

    return {
      contextType:
        'stark_ai_chatgpt_next_step_candidate_review_response_validation_result',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      candidateOnly: true,
      syntheticOnly: true,
      nonExecutable: true,
      interactionType,
      result: status,
      status,
      valid,
      issueCount: issues.length,
      issues,
      baseValidationResult,
      sourceReviewRequestValidationStatus:
        sourceHandoff.validationResult.status,
      sourceReviewRequestInteractionType: 'review_request',
      recommendedCandidateId: sourceHandoff.recommendedCandidateId,
      allowedOperations,
      forbiddenOperations,
      executable: false,
      approvalGranted: false,
      dispatchAllowed: false,
      taskCreationAllowed: false,
      lifecycleMutationAllowed: false,
      databaseReadAllowed: false,
      databaseWriteAllowed: false,
      businessObjectCreationAllowed: false,
      liveChatGptApiAllowed: false,
      mcpGatewayAllowed: false,
      voiceIntegrationAllowed: false,
      zeroCounters: { ...VALIDATOR_ZERO_COUNTERS },
      noWriteNoExecutionGuarantee: true,
    };
  }

  private buildSourceReviewRequestHandoff(
    input: Pick<
      StarkAiChatGptNextStepCandidateReviewResponseValidationInput,
      'generatedAt' | 'latestVerifiedMainCommit' | 'repo'
    >,
  ): StarkAiChatGptNextStepCandidateReviewHandoff {
    return this.candidateReviewHandoffService.buildCandidateReviewRequestHandoff(
      {
        generatedAt: input.generatedAt,
        latestVerifiedMainCommit: input.latestVerifiedMainCommit,
        repo: input.repo,
        currentStage:
          'S1-04.12 completed / finance safe-summary protection hardening',
        currentMode: 'SAFE',
        latestMergedPr: 'PR #129',
        currentOpenPr: 'none',
        statusDocs: [
          'docs/chatgpt-sync.md',
          'docs/system-state.md',
          'docs/active-task.md',
        ],
        syncPacketSafeSummaryRefs: ['starkAiSyncPacketSummary'],
      },
    );
  }

  private buildResponsePayload(
    input: StarkAiChatGptNextStepCandidateReviewResponseValidationInput,
    sourceHandoff: StarkAiChatGptNextStepCandidateReviewHandoff,
  ): Record<string, unknown> {
    const payloadRecord = this.asRecord(input.payload);

    return {
      contextType:
        'stark_ai_chatgpt_next_step_candidate_review_response_synthetic_artifact',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      candidateOnly: true,
      syntheticOnly: true,
      nonExecutable: true,
      sourceInteractionPacketValidatorPr116: 'merged_source',
      sourceNextStepSelectorPr127: 'merged_source',
      sourceReviewRequestHandoffPr128: 'merged_source',
      sourceReviewRequestValidationStatus:
        sourceHandoff.validationResult.status,
      sourceReviewRequestInteractionType: sourceHandoff.interactionType,
      recommendedCandidateId:
        input.recommendedCandidateId?.trim() ||
        sourceHandoff.recommendedCandidateId,
      sourceCandidateReviewReference: {
        contextType:
          'stark_ai_chatgpt_next_step_candidate_review_request_reference',
        candidateCount: sourceHandoff.candidates.length,
        recommendedCandidateId: sourceHandoff.recommendedCandidateId,
        validationStatus: sourceHandoff.validationResult.status,
        reviewOnly: sourceHandoff.reviewOnly,
        safeSummaryOnly: sourceHandoff.safeSummaryOnly,
        draftOnly: sourceHandoff.draftOnly,
        candidateOnly: sourceHandoff.candidateOnly,
        noExecution: sourceHandoff.noExecution,
      },
      customerContactExecutionAllowed: false,
      dispatchAllowed: false,
      taskCreationAllowed: false,
      lifecycleMutationAllowed: false,
      databaseReadAllowed: false,
      databaseWriteAllowed: false,
      businessActionAllowed: false,
      liveChatGptApiAllowed: false,
      mcpGatewayAllowed: false,
      voiceIntegrationAllowed: false,
      financePaymentWorkOrderMutationAllowed: false,
      ...payloadRecord,
    };
  }

  private validateSupportedInteractionType(
    value: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    if (
      value !== 'review_response' &&
      value !== 'clarification_request' &&
      value !== 'codex_instruction_candidate'
    ) {
      this.addIssue(
        issues,
        'next_step_candidate_unsupported_review_response_type',
        'envelope.interactionType',
        'Next-step candidate review response validator only accepts review_response, clarification_request, or codex_instruction_candidate.',
      );
    }
  }

  private validateAllowedOperations(
    value: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    if (!Array.isArray(value)) {
      return;
    }

    value.forEach((entry, index) => {
      const normalized = this.normalizeToken(entry);
      for (const forbiddenOperation of VALIDATOR_FORBIDDEN_OPERATIONS) {
        if (this.tokenMatchesForbiddenToken(normalized, forbiddenOperation)) {
          this.addIssue(
            issues,
            `next_step_candidate_allowed_operation_forbidden:${forbiddenOperation}`,
            `envelope.allowedOperations[${index}]`,
            'Next-step candidate review responses cannot allow execution, dispatch, task, DB, customer contact, gateway, finance mutation, or sensitive data operations.',
          );
        }
      }
    });
  }

  private validatePayloadSafety(
    payload: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    this.walkEntries(payload, 'payload', (path, key, value) => {
      const normalizedKey = this.normalizeToken(key);

      if (
        VALIDATOR_FORBIDDEN_TRUE_FLAGS.has(normalizedKey) &&
        value === true
      ) {
        this.addIssue(
          issues,
          `next_step_candidate_forbidden_true_flag:${normalizedKey}`,
          path,
          'Next-step candidate review response payload cannot enable execution, dispatch, task, lifecycle, DB, business, contact, gateway, voice, or finance mutation flags.',
        );
      }

      if (VALIDATOR_FORBIDDEN_FIELD_KEYS.has(normalizedKey)) {
        this.addIssue(
          issues,
          `next_step_candidate_forbidden_field:${normalizedKey}`,
          path,
          'Next-step candidate review response payload cannot include sensitive raw field names or values.',
        );
      }

      if (
        this.isTruthyUnsafeValue(value) &&
        this.matchesAnyForbiddenOperation(normalizedKey)
      ) {
        this.addIssue(
          issues,
          `next_step_candidate_forbidden_operation:${normalizedKey}`,
          path,
          'Next-step candidate review response payload cannot include executable, dispatch, task, DB, contact, gateway, voice, finance mutation, or sensitive operation keys.',
        );
      }
    });

    this.walkText(payload, 'payload', (path, text) => {
      this.detectForbiddenText(path, text, issues);
      this.detectSensitiveDigitRuns(path, text, issues);
    });
  }

  private detectForbiddenText(
    path: string,
    text: string,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const normalized = this.normalizeToken(text);
    for (const forbiddenOperation of VALIDATOR_FORBIDDEN_OPERATIONS) {
      if (this.tokenMatchesForbiddenToken(normalized, forbiddenOperation)) {
        this.addIssue(
          issues,
          `next_step_candidate_forbidden_operation:${forbiddenOperation}`,
          path,
          'Next-step candidate review response text cannot include executable, dispatch, task, DB, contact, gateway, voice, finance mutation, or sensitive operation tokens.',
        );
      }
    }

    for (const [code, pattern] of SENSITIVE_TEXT_RULES) {
      if (pattern.test(text)) {
        this.addIssue(
          issues,
          `next_step_candidate_sensitive_payload:${code}`,
          path,
          'Next-step candidate review response text cannot include sensitive payload requests or markers.',
        );
      }
    }
  }

  private detectSensitiveDigitRuns(
    path: string,
    text: string,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    if (/(?:\+?86[- ]?)?1[3-9]\d{9}\b/.test(text)) {
      this.addIssue(
        issues,
        'next_step_candidate_sensitive_payload:real_phone_like_digits',
        path,
        'Next-step candidate review response payload cannot include real-phone-like long digit runs.',
      );
    }

    if (/\b\d{16,19}\b/.test(text)) {
      this.addIssue(
        issues,
        'next_step_candidate_sensitive_payload:full_bank_account_digits',
        path,
        'Next-step candidate review response payload cannot include bank-account-like long digit runs.',
      );
    }
  }

  private matchesAnyForbiddenOperation(value: string): boolean {
    return VALIDATOR_FORBIDDEN_OPERATIONS.some((operation) =>
      this.tokenMatchesForbiddenToken(value, operation),
    );
  }

  private tokenMatchesForbiddenToken(value: string, forbidden: string): boolean {
    const compactValue = this.compactToken(value);
    const compactForbidden = this.compactToken(forbidden);

    return (
      value === forbidden ||
      value.startsWith(`${forbidden}_`) ||
      value.endsWith(`_${forbidden}`) ||
      value.includes(`_${forbidden}_`) ||
      value.includes(forbidden) ||
      compactValue === compactForbidden ||
      compactValue.includes(compactForbidden)
    );
  }

  private isTruthyUnsafeValue(value: unknown): boolean {
    if (value === false || value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0 && value.trim().toLowerCase() !== 'false';
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return Boolean(value);
  }

  private defaultAllowedOperationsForInteractionType(
    interactionType: StarkAiChatGptNextStepCandidateReviewResponseType,
  ): string[] {
    if (interactionType === 'review_response') {
      return ['review_candidate', 'compare_candidates'];
    }
    if (interactionType === 'clarification_request') {
      return ['request_more_safe_summary'];
    }
    return ['draft_codex_instruction_candidate'];
  }

  private defaultReviewModeForInteractionType(
    interactionType: StarkAiChatGptNextStepCandidateReviewResponseType,
  ): StarkAiChatGptInteractionReviewMode {
    if (interactionType === 'clarification_request') {
      return 'missing_evidence_review';
    }
    if (interactionType === 'codex_instruction_candidate') {
      return 'codex_instruction_candidate_review';
    }
    return 'safe_boundary_review';
  }

  private directionForInteractionType(
    interactionType: StarkAiChatGptNextStepCandidateReviewResponseType,
  ): 'chatgpt_to_stark_ai' | 'chatgpt_to_user_codex' {
    if (interactionType === 'codex_instruction_candidate') {
      return 'chatgpt_to_user_codex';
    }
    return 'chatgpt_to_stark_ai';
  }

  private resolveResponseType(
    value: unknown,
  ): StarkAiChatGptNextStepCandidateReviewResponseType {
    if (
      value === 'review_response' ||
      value === 'clarification_request' ||
      value === 'codex_instruction_candidate'
    ) {
      return value;
    }
    return 'review_response';
  }

  private walkEntries(
    value: unknown,
    path: string,
    visitor: (path: string, key: string, value: unknown) => void,
  ): void {
    if (!value || typeof value !== 'object') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        this.walkEntries(entry, `${path}[${index}]`, visitor),
      );
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      const currentPath = `${path}.${key}`;
      visitor(currentPath, key, entry);
      this.walkEntries(entry, currentPath, visitor);
    }
  }

  private walkText(
    value: unknown,
    path: string,
    visitor: (path: string, text: string) => void,
  ): void {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      visitor(path, String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        this.walkText(entry, `${path}[${index}]`, visitor),
      );
      return;
    }
    if (typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) {
        this.walkText(entry, `${path}.${key}`, visitor);
      }
    }
  }

  private normalizeToken(value: unknown): string {
    return String(value ?? '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private compactToken(value: unknown): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private addIssue(
    issues: StarkAiChatGptInteractionValidationIssue[],
    code: string,
    path: string,
    message: string,
  ): void {
    issues.push({
      code,
      severity: 'error',
      path,
      message,
    });
  }
}
