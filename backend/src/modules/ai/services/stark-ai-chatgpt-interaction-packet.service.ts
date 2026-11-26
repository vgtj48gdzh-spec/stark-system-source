import { Injectable } from '@nestjs/common';

export type StarkAiChatGptInteractionPacketVersion =
  'stark_ai_chatgpt_interaction_v1';

export type StarkAiChatGptInteractionDirection =
  | 'stark_ai_to_chatgpt'
  | 'chatgpt_to_stark_ai'
  | 'chatgpt_to_user_codex'
  | 'any_channel_to_github_status_docs';

export type StarkAiChatGptInteractionType =
  | 'review_request'
  | 'review_response'
  | 'clarification_request'
  | 'clarification_response'
  | 'codex_instruction_candidate'
  | 'status_sync_packet';

export type StarkAiChatGptInteractionReviewMode =
  | 'safe_boundary_review'
  | 'redaction_review'
  | 'missing_evidence_review'
  | 'codex_instruction_candidate_review'
  | 'status_sync_review';

export type StarkAiChatGptInteractionTrustLevel =
  | 'repository_verified'
  | 'status_doc_verified'
  | 'stark_ai_inferred'
  | 'chatgpt_inferred'
  | 'user_supplied_unverified'
  | 'unknown_or_blocked';

export type StarkAiChatGptInteractionJsonValue =
  | string
  | number
  | boolean
  | null
  | StarkAiChatGptInteractionJsonValue[]
  | { [key: string]: StarkAiChatGptInteractionJsonValue };

export interface StarkAiChatGptInteractionRedactionReport
  extends Record<string, StarkAiChatGptInteractionJsonValue> {
  rawSmsIncluded: boolean;
  verificationCodesIncluded: boolean;
  fullPhoneIncluded: boolean;
  fullBankAccountIncluded: boolean;
  rawPaymentPayloadIncluded: boolean;
  secretsIncluded: boolean;
  runtimeLogsIncluded: boolean;
  privateKeysIncluded: boolean;
  certificatesIncluded: boolean;
  databaseFilesIncluded: boolean;
  productionConnectorPayloadsIncluded: boolean;
}

export interface StarkAiChatGptInteractionSafeBoundaryFlags
  extends Record<string, StarkAiChatGptInteractionJsonValue> {
  databaseWriteCounter: 0;
  businessWriteCounter: 0;
  dispatchCounter: 0;
  taskCreationCounter: 0;
  lifecycleMutationCounter: 0;
  financeConfirmationCounter: 0;
  bankSmsConfirmationCounter: 0;
  paymentOrCollectionMutationCounter: 0;
  workOrderMutationCounter: 0;
  virtualLedgerMutationCounter: 0;
  payrollBenefitCustomerRightCounter: 0;
  realWechatPayCounter: 0;
  reviewOnly: true;
  candidateOnly: true;
  commandPayloadAllowed: false;
  actionApprovalGranted: false;
  databaseWriteAllowed: false;
  businessExecutionAllowed: false;
  liveGatewayEnabled: false;
}

export interface StarkAiChatGptInteractionEnvelope {
  packetVersion: StarkAiChatGptInteractionPacketVersion;
  interactionId: string;
  createdAt: string;
  direction: StarkAiChatGptInteractionDirection;
  sourceActor: string;
  targetActor: string;
  repo: string;
  latestVerifiedMainCommit: string;
  factSourceRank: 'github_main_pr_commit_review_first';
  interactionType: StarkAiChatGptInteractionType;
  reviewMode: StarkAiChatGptInteractionReviewMode;
  trustLevel: StarkAiChatGptInteractionTrustLevel;
  allowedOperations: string[];
  forbiddenOperations: string[];
  redactionReport: StarkAiChatGptInteractionRedactionReport;
  safeBoundaryFlags: StarkAiChatGptInteractionSafeBoundaryFlags;
}

export interface StarkAiChatGptInteractionPacket {
  envelope: StarkAiChatGptInteractionEnvelope;
  payload: StarkAiChatGptInteractionJsonValue;
}

export interface StarkAiChatGptInteractionPacketInput {
  packetVersion?: unknown;
  interactionId?: unknown;
  createdAt?: string | Date;
  direction?: unknown;
  sourceActor?: unknown;
  targetActor?: unknown;
  repo?: unknown;
  latestVerifiedMainCommit?: unknown;
  factSourceRank?: unknown;
  interactionType?: unknown;
  reviewMode?: unknown;
  trustLevel?: unknown;
  allowedOperations?: readonly unknown[] | null;
  forbiddenOperations?: readonly unknown[] | null;
  redactionReport?: Record<string, unknown> | null;
  safeBoundaryFlags?: Record<string, unknown> | null;
  payload?: unknown;
}

export interface StarkAiChatGptInteractionValidationIssue {
  code: string;
  severity: 'error';
  path: string;
  message: string;
}

export interface StarkAiChatGptInteractionValidationResult {
  valid: boolean;
  status: 'valid_review_artifact' | 'blocked_review_artifact';
  issueCount: number;
  issues: StarkAiChatGptInteractionValidationIssue[];
  safeBoundarySummary: {
    reviewOnly: boolean;
    candidateOnly: boolean;
    noDatabaseWrite: boolean;
    noBusinessWrite: boolean;
    noDispatch: boolean;
    noTaskCreation: boolean;
    noLifecycleMutation: boolean;
    noBusinessExecution: boolean;
    noLiveGateway: boolean;
  };
  noWriteNoExecutionGuarantee: true;
}

const PACKET_VERSION: StarkAiChatGptInteractionPacketVersion =
  'stark_ai_chatgpt_interaction_v1';
const DEFAULT_REPO = 'vgtj48gdzh-spec/stark-system';
const DEFAULT_FACT_SOURCE_RANK = 'github_main_pr_commit_review_first' as const;

const ALLOWED_DIRECTIONS = [
  'stark_ai_to_chatgpt',
  'chatgpt_to_stark_ai',
  'chatgpt_to_user_codex',
  'any_channel_to_github_status_docs',
] as const;

const ALLOWED_INTERACTION_TYPES = [
  'review_request',
  'review_response',
  'clarification_request',
  'clarification_response',
  'codex_instruction_candidate',
  'status_sync_packet',
] as const;

const ALLOWED_REVIEW_MODES = [
  'safe_boundary_review',
  'redaction_review',
  'missing_evidence_review',
  'codex_instruction_candidate_review',
  'status_sync_review',
] as const;

const ALLOWED_TRUST_LEVELS = [
  'repository_verified',
  'status_doc_verified',
  'stark_ai_inferred',
  'chatgpt_inferred',
  'user_supplied_unverified',
  'unknown_or_blocked',
] as const;

const DEFAULT_ALLOWED_OPERATIONS = [
  'summarize',
  'ask_clarifying_question',
  'identify_gap',
  'draft_codex_instruction_candidate',
] as const;

const REQUIRED_FORBIDDEN_OPERATIONS = [
  'database_write',
  'business_write',
  'dispatch',
  'task_creation',
  'lifecycle_mutation',
  'finance_confirmation',
  'bank_sms_confirmation',
  'payment_or_collection_mutation',
  'work_order_mutation',
  'virtual_ledger_mutation',
  'payroll_confirmation',
  'benefit_issuance',
  'customer_right_mutation',
  'real_wechat_pay',
  'mcp_gateway',
  'voice_integration',
] as const;

const REDACTION_FLAG_NAMES = [
  'rawSmsIncluded',
  'verificationCodesIncluded',
  'fullPhoneIncluded',
  'fullBankAccountIncluded',
  'rawPaymentPayloadIncluded',
  'secretsIncluded',
  'runtimeLogsIncluded',
  'privateKeysIncluded',
  'certificatesIncluded',
  'databaseFilesIncluded',
  'productionConnectorPayloadsIncluded',
] as const;

const FORBIDDEN_COUNTER_NAMES = [
  'databaseWriteCounter',
  'businessWriteCounter',
  'dispatchCounter',
  'taskCreationCounter',
  'lifecycleMutationCounter',
  'financeConfirmationCounter',
  'bankSmsConfirmationCounter',
  'paymentOrCollectionMutationCounter',
  'workOrderMutationCounter',
  'virtualLedgerMutationCounter',
  'payrollBenefitCustomerRightCounter',
  'realWechatPayCounter',
] as const;

const SAFE_BOOLEAN_FLAG_EXPECTATIONS: Array<[
  string,
  boolean,
  string,
]> = [
  ['reviewOnly', true, 'reviewOnly_must_be_true'],
  ['candidateOnly', true, 'candidateOnly_must_be_true'],
  ['commandPayloadAllowed', false, 'commandPayloadAllowed_must_be_false'],
  ['actionApprovalGranted', false, 'actionApprovalGranted_must_be_false'],
  ['databaseWriteAllowed', false, 'databaseWriteAllowed_must_be_false'],
  [
    'businessExecutionAllowed',
    false,
    'businessExecutionAllowed_must_be_false',
  ],
  ['liveGatewayEnabled', false, 'liveGatewayEnabled_must_be_false'],
];

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

const FORBIDDEN_DATA_REQUEST_PATTERNS: Array<[string, RegExp]> = [
  ['raw_sms', /raw\s*sms|raw_sms|sms\s*body|原始短信|短信正文/i],
  ['verification_code', /verification\s*code|verification_code|otp|验证码/i],
  [
    'full_phone',
    /full\s*phone|full_phone|unmasked\s*phone|完整手机号|未脱敏手机号/i,
  ],
  [
    'full_bank_account',
    /full\s*bank|full_bank|bank\s*account|card\s*number|完整银行卡号|银行账号|银行卡号/i,
  ],
  [
    'raw_payment_payload',
    /raw\s*payment|provider\s*payload|原始支付回调|支付原文/i,
  ],
  [
    'token_or_secret',
    /\b(token|secret|password|private\s*key|\.env)\b|密钥|密码|私钥/i,
  ],
  ['database_file', /database\s*file|数据库文件/i],
  ['production_log', /production\s*log|生产日志/i],
];

const CHINESE_FORBIDDEN_ACTION_PATTERNS: Array<[string, RegExp]> = [
  ['confirm_bank_sms', /确认银行短信|银行短信确认/i],
  ['ignore_bank_sms', /忽略银行短信/i],
  ['create_collection_order', /创建收款(?!记录)/i],
  ['create_payment_record', /创建付款|创建付款记录/i],
  ['create_collection_order', /创建收款记录/i],
  ['execute_payment', /执行付款|发起付款/i],
  ['update_work_order_status', /修改工单|修改工单状态|修改工单收款状态/i],
  ['mutate_virtual_ledger', /写虚拟账|修改虚拟资金账户/i],
  ['confirm_payroll', /确认工资/i],
  ['issue_employee_benefits', /发放福利|发放员工福利/i],
  ['confirm_customer_rights', /改客户权益|发放客户权益/i],
  ['invoke_real_wechat_pay', /真实微信支付|调用微信支付/i],
  ['bypass_approval_or_permission', /绕过审批|绕过权限/i],
];

const INTERACTION_TYPE_DIRECTIONS: Record<
  StarkAiChatGptInteractionType,
  readonly StarkAiChatGptInteractionDirection[]
> = {
  review_request: ['stark_ai_to_chatgpt'],
  review_response: ['chatgpt_to_stark_ai'],
  clarification_request: ['chatgpt_to_stark_ai'],
  clarification_response: ['stark_ai_to_chatgpt'],
  codex_instruction_candidate: ['chatgpt_to_user_codex'],
  status_sync_packet: [
    'stark_ai_to_chatgpt',
    'chatgpt_to_stark_ai',
    'chatgpt_to_user_codex',
    'any_channel_to_github_status_docs',
  ],
};

const DIRECTION_ACTORS: Record<
  StarkAiChatGptInteractionDirection,
  { sourceActor: string; targetActor: string }
> = {
  stark_ai_to_chatgpt: {
    sourceActor: 'stark-system-ai',
    targetActor: 'chatgpt',
  },
  chatgpt_to_stark_ai: {
    sourceActor: 'chatgpt',
    targetActor: 'stark-system-ai',
  },
  chatgpt_to_user_codex: {
    sourceActor: 'chatgpt',
    targetActor: 'user-codex',
  },
  any_channel_to_github_status_docs: {
    sourceActor: 'verified-channel',
    targetActor: 'github-status-docs',
  },
};

@Injectable()
export class StarkAiChatGptInteractionPacketService {
  // Builder methods are for internal safe default review artifacts only. They
  // must not be used to sanitize external or cross-channel packets; validate
  // raw external packets directly with validateInteractionPacket(rawPacket).
  buildInteractionPacket(
    input: StarkAiChatGptInteractionPacketInput = {},
  ): StarkAiChatGptInteractionPacket {
    return {
      envelope: this.buildInteractionEnvelope(input),
      payload: this.toJsonValue(input.payload ?? {}),
    };
  }

  buildInteractionEnvelope(
    input: StarkAiChatGptInteractionPacketInput = {},
  ): StarkAiChatGptInteractionEnvelope {
    const interactionType = this.resolveInteractionType(input.interactionType);
    const direction = this.resolveDirection(
      input.direction,
      this.defaultDirectionForInteractionType(interactionType),
    );
    const actors = DIRECTION_ACTORS[direction];

    return {
      packetVersion: PACKET_VERSION,
      interactionId:
        this.sanitizeText(input.interactionId) ||
        this.buildInteractionId(interactionType, input.createdAt),
      createdAt: this.resolveCreatedAt(input.createdAt),
      direction,
      sourceActor: this.sanitizeText(input.sourceActor) || actors.sourceActor,
      targetActor: this.sanitizeText(input.targetActor) || actors.targetActor,
      repo: this.sanitizeText(input.repo) || DEFAULT_REPO,
      latestVerifiedMainCommit: this.sanitizeText(
        input.latestVerifiedMainCommit,
      ),
      factSourceRank: DEFAULT_FACT_SOURCE_RANK,
      interactionType,
      reviewMode: this.resolveReviewMode(input.reviewMode),
      trustLevel: this.resolveTrustLevel(input.trustLevel),
      allowedOperations: this.resolveAllowedOperations(input.allowedOperations),
      forbiddenOperations: this.resolveForbiddenOperations(
        input.forbiddenOperations,
      ),
      redactionReport: this.buildRedactionReport(input.redactionReport),
      safeBoundaryFlags: this.buildSafeBoundaryFlags(input.safeBoundaryFlags),
    };
  }

  validateInteractionPacket(
    packet: unknown,
  ): StarkAiChatGptInteractionValidationResult {
    const issues: StarkAiChatGptInteractionValidationIssue[] = [];
    const packetRecord = this.asRecord(packet);
    const envelope = this.asRecord(packetRecord.envelope ?? packetRecord);
    const payload = packetRecord.payload;

    this.validatePacketVersion(envelope.packetVersion, issues);
    this.validateDirection(envelope.direction, issues);
    this.validateInteractionType(envelope.interactionType, issues);
    this.validateReviewMode(envelope.reviewMode, issues);
    this.validateDirectionForInteractionType(
      envelope.direction,
      envelope.interactionType,
      issues,
    );
    this.validateEnvelopeTrustLevel(envelope, issues);
    this.validateTrustLevels(packet, issues);
    this.validateRedactionReport(envelope.redactionReport, issues);
    this.validateSafeBoundaryFlags(envelope.safeBoundaryFlags, issues);
    this.validateAllowedOperations(envelope.allowedOperations, issues);
    this.validateForbiddenOperations(envelope.forbiddenOperations, issues);
    this.validateForbiddenActionPayload(payload, issues);

    const interactionType = this.normalizeToken(envelope.interactionType);
    if (interactionType === 'review_response') {
      this.validateReviewResponseIsNotCommand(payload, envelope, issues);
    }
    if (interactionType === 'clarification_request') {
      this.validateClarificationRequest(payload, issues);
    }
    if (interactionType === 'codex_instruction_candidate') {
      this.validateCodexInstructionCandidate(payload, issues);
    }

    const valid = issues.length === 0;
    return {
      valid,
      status: valid ? 'valid_review_artifact' : 'blocked_review_artifact',
      issueCount: issues.length,
      issues,
      safeBoundarySummary: this.buildValidationBoundarySummary(envelope),
      noWriteNoExecutionGuarantee: true,
    };
  }

  private validatePacketVersion(
    value: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    if (value !== PACKET_VERSION) {
      this.addIssue(
        issues,
        'invalid_packet_version',
        'envelope.packetVersion',
        'packetVersion must be stark_ai_chatgpt_interaction_v1.',
      );
    }
  }

  private validateDirection(
    value: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    if (!this.isAllowedDirection(value)) {
      this.addIssue(
        issues,
        'invalid_direction',
        'envelope.direction',
        'direction is outside the approved ChatGPT/Stark AI interaction vocabulary.',
      );
    }
  }

  private validateInteractionType(
    value: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    if (!this.isAllowedInteractionType(value)) {
      this.addIssue(
        issues,
        'invalid_interaction_type',
        'envelope.interactionType',
        'interactionType is outside the approved review-artifact vocabulary.',
      );
    }
  }

  private validateReviewMode(
    value: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    if (!this.isAllowedReviewMode(value)) {
      this.addIssue(
        issues,
        'invalid_review_mode',
        'envelope.reviewMode',
        'reviewMode is outside the approved SAFE review modes.',
      );
    }
  }

  private validateDirectionForInteractionType(
    direction: unknown,
    interactionType: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    if (
      !this.isAllowedDirection(direction) ||
      !this.isAllowedInteractionType(interactionType)
    ) {
      return;
    }
    const allowedDirections =
      INTERACTION_TYPE_DIRECTIONS[
        interactionType as StarkAiChatGptInteractionType
      ];
    if (!allowedDirections.includes(direction as StarkAiChatGptInteractionDirection)) {
      this.addIssue(
        issues,
        'direction_interaction_type_mismatch',
        'envelope.direction',
        'direction does not match the approved interactionType flow.',
      );
    }
  }

  private validateTrustLevels(
    packet: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const found = this.collectValuesByKey(packet, 'trustLevel');
    for (const entry of found) {
      if (entry.path === '$.envelope.trustLevel' || entry.path === '$.trustLevel') {
        continue;
      }
      if (!this.isAllowedTrustLevel(entry.value)) {
        this.addIssue(
          issues,
          'invalid_trust_level',
          entry.path,
          'trustLevel is outside the design-approved trust vocabulary.',
        );
      }
    }
  }

  private validateEnvelopeTrustLevel(
    envelope: Record<string, unknown>,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    if (!Object.prototype.hasOwnProperty.call(envelope, 'trustLevel')) {
      this.addIssue(
        issues,
        'missing_envelope_trust_level',
        'envelope.trustLevel',
        'envelope.trustLevel is required for provenance validation.',
      );
      return;
    }
    if (envelope.trustLevel === undefined) {
      this.addIssue(
        issues,
        'missing_envelope_trust_level',
        'envelope.trustLevel',
        'envelope.trustLevel is required for provenance validation.',
      );
      return;
    }
    if (!this.isAllowedTrustLevel(envelope.trustLevel)) {
      this.addIssue(
        issues,
        'invalid_envelope_trust_level',
        'envelope.trustLevel',
        'envelope.trustLevel must use the design-approved trust vocabulary.',
      );
    }
  }

  private validateRedactionReport(
    value: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const report = this.asRecord(value);
    for (const flagName of REDACTION_FLAG_NAMES) {
      if (report[flagName] !== false) {
        this.addIssue(
          issues,
          `${flagName}_must_be_false`,
          `envelope.redactionReport.${flagName}`,
          'redactionReport sensitive flags must remain false before handoff.',
        );
      }
    }
  }

  private validateSafeBoundaryFlags(
    value: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const flags = this.asRecord(value);
    for (const counterName of FORBIDDEN_COUNTER_NAMES) {
      if (flags[counterName] !== 0) {
        this.addIssue(
          issues,
          `${counterName}_must_be_zero`,
          `envelope.safeBoundaryFlags.${counterName}`,
          'SAFE boundary forbidden counters must all be exactly 0.',
        );
      }
    }
    for (const [
      flagName,
      expectedValue,
      issueCode,
    ] of SAFE_BOOLEAN_FLAG_EXPECTATIONS) {
      if (flags[flagName] !== expectedValue) {
        this.addIssue(
          issues,
          issueCode,
          `envelope.safeBoundaryFlags.${flagName}`,
          `SAFE boundary flag ${flagName} must be exactly ${expectedValue}.`,
        );
      }
    }
  }

  private validateAllowedOperations(
    value: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const normalizedOperations = this.normalizeOperationList(value);
    const operationSet = new Set(normalizedOperations);
    if (this.operationListContainsExecutableVerb(value)) {
      this.addIssue(
        issues,
        'allowed_operations_must_not_execute',
        'envelope.allowedOperations',
        'allowedOperations must stay review-only and cannot include executable verbs.',
      );
    }
    for (const operation of REQUIRED_FORBIDDEN_OPERATIONS) {
      if (operationSet.has(operation)) {
        this.addIssue(
          issues,
          'allowed_operations_must_not_include_forbidden_operation',
          'envelope.allowedOperations',
          'allowedOperations cannot include required forbidden operation tokens.',
        );
      }
    }
    for (const actionCode of FORBIDDEN_ACTION_CODES) {
      if (operationSet.has(actionCode)) {
        this.addIssue(
          issues,
          'allowed_operations_must_not_include_forbidden_action',
          'envelope.allowedOperations',
          'allowedOperations cannot include high-risk forbidden action tokens.',
        );
      }
    }
  }

  private validateForbiddenOperations(
    value: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const normalizedOperations = new Set(
      Array.isArray(value)
        ? value.map((item) => this.normalizeToken(item)).filter(Boolean)
        : [],
    );
    for (const operation of REQUIRED_FORBIDDEN_OPERATIONS) {
      if (!normalizedOperations.has(operation)) {
        this.addIssue(
          issues,
          `missing_forbidden_operation:${operation}`,
          'envelope.forbiddenOperations',
          'forbiddenOperations must include every high-risk blocked operation.',
        );
      }
    }
  }

  private validateReviewResponseIsNotCommand(
    payload: unknown,
    envelope: Record<string, unknown>,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const commandPaths = this.collectCommandLikePaths(payload);
    for (const path of commandPaths) {
      this.addIssue(
        issues,
        'review_response_must_not_be_command',
        path,
        'review_response may contain advice only and cannot become a command payload.',
      );
    }
    if (this.operationListContainsExecutableVerb(envelope.allowedOperations)) {
      this.addIssue(
        issues,
        'review_response_allowed_operations_must_not_execute',
        'envelope.allowedOperations',
        'review_response allowedOperations cannot include execute, approve, dispatch, or mutate verbs.',
      );
    }
  }

  private validateClarificationRequest(
    payload: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const detections = this.detectForbiddenDataRequests(payload);
    for (const detection of detections) {
      this.addIssue(
        issues,
        `clarification_request_forbidden_data:${detection.code}`,
        detection.path,
        'clarification_request cannot ask Stark AI for forbidden private or secret data.',
      );
    }
  }

  private validateCodexInstructionCandidate(
    payload: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const payloadRecord = this.asRecord(payload);
    const candidate = this.asRecord(
      payloadRecord.codexInstructionCandidate ?? payloadRecord,
    );
    if (candidate.candidateOnly !== true) {
      this.addIssue(
        issues,
        'codex_instruction_candidate_must_be_candidate_only',
        'payload.codexInstructionCandidate.candidateOnly',
        'codex_instruction_candidate must be marked candidateOnly=true.',
      );
    }
    if (candidate.executable !== false) {
      this.addIssue(
        issues,
        'codex_instruction_candidate_must_not_be_executable',
        'payload.codexInstructionCandidate.executable',
        'codex_instruction_candidate must be non-executable.',
      );
    }
    if (
      candidate.executionStatus !== undefined &&
      candidate.executionStatus !== 'candidate_only'
    ) {
      this.addIssue(
        issues,
        'codex_instruction_candidate_execution_status_invalid',
        'payload.codexInstructionCandidate.executionStatus',
        'codex_instruction_candidate executionStatus must stay candidate_only.',
      );
    }
    for (const path of this.collectCommandLikePaths(payload)) {
      this.addIssue(
        issues,
        'codex_instruction_candidate_must_not_contain_command_payload',
        path,
        'codex_instruction_candidate cannot contain command, dispatch, tool, or execution payload fields.',
      );
    }
  }

  private validateForbiddenActionPayload(
    payload: unknown,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const detections = this.detectForbiddenActionCodes(payload);
    for (const detection of detections) {
      this.addIssue(
        issues,
        `forbidden_action_payload_detected:${detection.code}`,
        detection.path,
        'payload cannot contain direct high-risk business action codes.',
      );
    }
  }

  private buildValidationBoundarySummary(
    envelope: Record<string, unknown>,
  ): StarkAiChatGptInteractionValidationResult['safeBoundarySummary'] {
    const flags = this.asRecord(envelope.safeBoundaryFlags);
    return {
      reviewOnly: flags.reviewOnly === true,
      candidateOnly: flags.candidateOnly === true,
      noDatabaseWrite: flags.databaseWriteCounter === 0,
      noBusinessWrite: flags.businessWriteCounter === 0,
      noDispatch: flags.dispatchCounter === 0,
      noTaskCreation: flags.taskCreationCounter === 0,
      noLifecycleMutation: flags.lifecycleMutationCounter === 0,
      noBusinessExecution:
        flags.businessExecutionAllowed === false &&
        flags.actionApprovalGranted === false,
      noLiveGateway: flags.liveGatewayEnabled === false,
    };
  }

  private buildRedactionReport(
    input: Record<string, unknown> | null | undefined,
  ): StarkAiChatGptInteractionRedactionReport {
    const report = this.asRecord(input);
    return {
      rawSmsIncluded: report.rawSmsIncluded === true,
      verificationCodesIncluded: report.verificationCodesIncluded === true,
      fullPhoneIncluded: report.fullPhoneIncluded === true,
      fullBankAccountIncluded: report.fullBankAccountIncluded === true,
      rawPaymentPayloadIncluded: report.rawPaymentPayloadIncluded === true,
      secretsIncluded: report.secretsIncluded === true,
      runtimeLogsIncluded: report.runtimeLogsIncluded === true,
      privateKeysIncluded: report.privateKeysIncluded === true,
      certificatesIncluded: report.certificatesIncluded === true,
      databaseFilesIncluded: report.databaseFilesIncluded === true,
      productionConnectorPayloadsIncluded:
        report.productionConnectorPayloadsIncluded === true,
    };
  }

  private buildSafeBoundaryFlags(
    input: Record<string, unknown> | null | undefined,
  ): StarkAiChatGptInteractionSafeBoundaryFlags {
    const flags = this.asRecord(input);
    // Internal builder output is deliberately normalized to safe defaults.
    // Validate raw external or cross-channel packets directly instead of using
    // this builder as a sanitizer for unsafe counters or boolean flags.
    return {
      databaseWriteCounter: this.zeroCounter(flags.databaseWriteCounter),
      businessWriteCounter: this.zeroCounter(flags.businessWriteCounter),
      dispatchCounter: this.zeroCounter(flags.dispatchCounter),
      taskCreationCounter: this.zeroCounter(flags.taskCreationCounter),
      lifecycleMutationCounter: this.zeroCounter(flags.lifecycleMutationCounter),
      financeConfirmationCounter: this.zeroCounter(
        flags.financeConfirmationCounter,
      ),
      bankSmsConfirmationCounter: this.zeroCounter(
        flags.bankSmsConfirmationCounter,
      ),
      paymentOrCollectionMutationCounter: this.zeroCounter(
        flags.paymentOrCollectionMutationCounter,
      ),
      workOrderMutationCounter: this.zeroCounter(flags.workOrderMutationCounter),
      virtualLedgerMutationCounter: this.zeroCounter(
        flags.virtualLedgerMutationCounter,
      ),
      payrollBenefitCustomerRightCounter: this.zeroCounter(
        flags.payrollBenefitCustomerRightCounter,
      ),
      realWechatPayCounter: this.zeroCounter(flags.realWechatPayCounter),
      reviewOnly: true,
      candidateOnly: true,
      commandPayloadAllowed: false,
      actionApprovalGranted: false,
      databaseWriteAllowed: false,
      businessExecutionAllowed: false,
      liveGatewayEnabled: false,
    };
  }

  private zeroCounter(value: unknown): 0 {
    return value === 0 ? 0 : 0;
  }

  private resolveAllowedOperations(
    input: readonly unknown[] | null | undefined,
  ): string[] {
    const operations = Array.isArray(input) ? input : DEFAULT_ALLOWED_OPERATIONS;
    return this.unique(
      operations.map((item) => this.normalizeToken(item)).filter(Boolean),
    );
  }

  private resolveForbiddenOperations(
    input: readonly unknown[] | null | undefined,
  ): string[] {
    const provided = Array.isArray(input)
      ? input.map((item) => this.normalizeToken(item)).filter(Boolean)
      : [];
    return this.unique([...REQUIRED_FORBIDDEN_OPERATIONS, ...provided]);
  }

  private resolveInteractionType(
    value: unknown,
  ): StarkAiChatGptInteractionType {
    return this.isAllowedInteractionType(value)
      ? (value as StarkAiChatGptInteractionType)
      : 'review_request';
  }

  private resolveDirection(
    value: unknown,
    fallback: StarkAiChatGptInteractionDirection,
  ): StarkAiChatGptInteractionDirection {
    return this.isAllowedDirection(value)
      ? (value as StarkAiChatGptInteractionDirection)
      : fallback;
  }

  private resolveReviewMode(
    value: unknown,
  ): StarkAiChatGptInteractionReviewMode {
    return this.isAllowedReviewMode(value)
      ? (value as StarkAiChatGptInteractionReviewMode)
      : 'safe_boundary_review';
  }

  private resolveTrustLevel(
    value: unknown,
  ): StarkAiChatGptInteractionTrustLevel {
    return this.isAllowedTrustLevel(value)
      ? (value as StarkAiChatGptInteractionTrustLevel)
      : 'unknown_or_blocked';
  }

  private defaultDirectionForInteractionType(
    interactionType: StarkAiChatGptInteractionType,
  ): StarkAiChatGptInteractionDirection {
    return INTERACTION_TYPE_DIRECTIONS[interactionType][0];
  }

  private buildInteractionId(
    interactionType: StarkAiChatGptInteractionType,
    createdAt: string | Date | undefined,
  ): string {
    return `stark-ai-chatgpt:${interactionType}:${this.resolveCreatedAt(
      createdAt,
    ).replace(/[^0-9a-z]+/gi, '')}`;
  }

  private resolveCreatedAt(value: string | Date | undefined): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value.trim() : date.toISOString();
    }
    return new Date().toISOString();
  }

  private isAllowedDirection(
    value: unknown,
  ): value is StarkAiChatGptInteractionDirection {
    return ALLOWED_DIRECTIONS.includes(
      value as StarkAiChatGptInteractionDirection,
    );
  }

  private isAllowedInteractionType(
    value: unknown,
  ): value is StarkAiChatGptInteractionType {
    return ALLOWED_INTERACTION_TYPES.includes(
      value as StarkAiChatGptInteractionType,
    );
  }

  private isAllowedReviewMode(
    value: unknown,
  ): value is StarkAiChatGptInteractionReviewMode {
    return ALLOWED_REVIEW_MODES.includes(
      value as StarkAiChatGptInteractionReviewMode,
    );
  }

  private isAllowedTrustLevel(
    value: unknown,
  ): value is StarkAiChatGptInteractionTrustLevel {
    return ALLOWED_TRUST_LEVELS.includes(
      value as StarkAiChatGptInteractionTrustLevel,
    );
  }

  private collectValuesByKey(
    value: unknown,
    keyName: string,
    path = '$',
  ): Array<{ path: string; value: unknown }> {
    if (!value || typeof value !== 'object') {
      return [];
    }
    if (Array.isArray(value)) {
      return value.flatMap((entry, index) =>
        this.collectValuesByKey(entry, keyName, `${path}[${index}]`),
      );
    }
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, entry]) => {
        const currentPath = `${path}.${key}`;
        const ownMatch =
          key === keyName ? [{ path: currentPath, value: entry }] : [];
        return [
          ...ownMatch,
          ...this.collectValuesByKey(entry, keyName, currentPath),
        ];
      },
    );
  }

  private collectCommandLikePaths(value: unknown, path = 'payload'): string[] {
    if (!value || typeof value !== 'object') {
      return [];
    }
    if (Array.isArray(value)) {
      return value.flatMap((entry, index) =>
        this.collectCommandLikePaths(entry, `${path}[${index}]`),
      );
    }

    const paths: string[] = [];
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const currentPath = `${path}.${key}`;
      const normalizedKey = this.normalizeToken(key);
      if (this.isCommandLikeKey(normalizedKey) && this.isTruthyCommandValue(entry)) {
        paths.push(currentPath);
      }
      paths.push(...this.collectCommandLikePaths(entry, currentPath));
    }
    return this.unique(paths);
  }

  private isCommandLikeKey(normalizedKey: string): boolean {
    return [
      'command',
      'commands',
      'command_payload',
      'tool_call',
      'tool_payload',
      'execute',
      'execution_request',
      'dispatch_now',
      'approval_granted',
      'action_payload',
    ].includes(normalizedKey);
  }

  private isTruthyCommandValue(value: unknown): boolean {
    if (value === false || value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0 && value.trim() !== 'false';
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return Boolean(value);
  }

  private operationListContainsExecutableVerb(value: unknown): boolean {
    return this.normalizeOperationList(value).some((operation) => {
      return [
        'execute',
        'approve',
        'dispatch',
        'mutate',
        'write',
        'confirm',
        'pay',
      ].some((verb) => operation === verb || operation.startsWith(verb));
    });
  }

  private normalizeOperationList(value: unknown): string[] {
    return Array.isArray(value)
      ? value.map((item) => this.normalizeToken(item)).filter(Boolean)
      : [];
  }

  private detectForbiddenDataRequests(
    value: unknown,
    path = 'payload',
  ): Array<{ code: string; path: string }> {
    const detections: Array<{ code: string; path: string }> = [];
    this.walkText(value, path, (text, currentPath) => {
      for (const [code, pattern] of FORBIDDEN_DATA_REQUEST_PATTERNS) {
        if (pattern.test(text)) {
          detections.push({ code, path: currentPath });
        }
      }
    });
    return this.uniqueDetections(detections);
  }

  private detectForbiddenActionCodes(
    value: unknown,
    path = 'payload',
  ): Array<{ code: string; path: string }> {
    const detections: Array<{ code: string; path: string }> = [];
    this.walkText(value, path, (text, currentPath) => {
      for (const actionCode of FORBIDDEN_ACTION_CODES) {
        if (new RegExp(this.escapeRegExp(actionCode), 'i').test(text)) {
          detections.push({ code: actionCode, path: currentPath });
        }
      }
      for (const [actionCode, pattern] of CHINESE_FORBIDDEN_ACTION_PATTERNS) {
        if (pattern.test(text)) {
          detections.push({ code: actionCode, path: currentPath });
        }
      }
    });
    return this.uniqueDetections(detections);
  }

  private walkText(
    value: unknown,
    path: string,
    visitor: (text: string, path: string) => void,
  ): void {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      visitor(String(value), path);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        this.walkText(entry, `${path}[${index}]`, visitor),
      );
      return;
    }
    if (typeof value === 'object') {
      for (const [key, entry] of Object.entries(
        value as Record<string, unknown>,
      )) {
        visitor(key, `${path}.${key}`);
        this.walkText(entry, `${path}.${key}`, visitor);
      }
    }
  }

  private toJsonValue(value: unknown): StarkAiChatGptInteractionJsonValue {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((entry) => this.toJsonValue(entry));
    }
    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          this.sanitizeObjectKey(key),
          this.toJsonValue(entry),
        ]),
      );
    }
    return this.sanitizeText(value);
  }

  private sanitizeObjectKey(key: string): string {
    return this.sanitizeText(key).replace(/[^a-zA-Z0-9_:-]+/g, '_') || 'field';
  }

  private sanitizeText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeToken(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
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

  private unique<T>(items: readonly T[]): T[] {
    return [...new Set(items)];
  }

  private uniqueDetections(
    items: readonly { code: string; path: string }[],
  ): Array<{ code: string; path: string }> {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.code}:${item.path}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
