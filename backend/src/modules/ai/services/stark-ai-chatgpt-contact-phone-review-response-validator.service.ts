import { Injectable } from '@nestjs/common';
import {
  StarkAiChatGptContactPhoneSummaryHandoffService,
  type StarkAiChatGptContactPhoneSummaryHandoff,
} from './stark-ai-chatgpt-contact-phone-summary-handoff.service';
import {
  StarkAiChatGptInteractionPacketService,
  type StarkAiChatGptInteractionPacket,
  type StarkAiChatGptInteractionReviewMode,
  type StarkAiChatGptInteractionTrustLevel,
  type StarkAiChatGptInteractionValidationIssue,
  type StarkAiChatGptInteractionValidationResult,
} from './stark-ai-chatgpt-interaction-packet.service';

export type StarkAiChatGptContactPhoneReviewResponseType =
  | 'review_response'
  | 'clarification_request'
  | 'codex_instruction_candidate';

export type StarkAiChatGptContactPhoneReviewResponseStatus =
  | 'valid_review_artifact'
  | 'blocked_review_artifact';

export interface StarkAiChatGptContactPhoneReviewResponseValidationInput {
  generatedAt?: string | Date;
  interactionType: StarkAiChatGptContactPhoneReviewResponseType;
  latestVerifiedMainCommit?: string | null;
  repo?: string | null;
  reviewMode?: StarkAiChatGptInteractionReviewMode;
  trustLevel?: StarkAiChatGptInteractionTrustLevel;
  allowedOperations?: readonly unknown[] | null;
  payload?: unknown;
}

export interface StarkAiChatGptContactPhoneReviewResponseValidationResult {
  contextType: 'chatgpt_contact_phone_review_response_validation_result';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  candidateOnly: true;
  syntheticOnly: true;
  nonExecutable: true;
  result: StarkAiChatGptContactPhoneReviewResponseStatus;
  status: StarkAiChatGptContactPhoneReviewResponseStatus;
  valid: boolean;
  interactionType: StarkAiChatGptContactPhoneReviewResponseType;
  issueCount: number;
  issues: StarkAiChatGptInteractionValidationIssue[];
  baseValidationResult: StarkAiChatGptInteractionValidationResult;
  sourceReviewRequestValidationStatus: StarkAiChatGptContactPhoneReviewResponseStatus;
  sourceReviewRequestInteractionType: 'review_request';
  executable: false;
  approvalGranted: false;
  dispatchAllowed: false;
  businessObjectCreationAllowed: false;
  databaseWriteAllowed: false;
  noWriteNoExecutionGuarantee: true;
}

const DEFAULT_REPO = 'vgtj48gdzh-spec/stark-system';

const CONTACT_PHONE_FORBIDDEN_OPERATIONS = [
  'database_read',
  'database_write',
  'business_action',
  'customer_contact_execution',
  'task_creation',
  'dispatch',
  'call',
  'dial',
  'reveal',
  'export',
  'copy',
  'live_gateway',
  'real_chatgpt_api',
  'mcp_gateway',
  'voice_integration',
] as const;

const CONTACT_PHONE_BLOCKED_ALLOWED_OPERATION_TOKENS = [
  'execute',
  'dispatch',
  'call',
  'dial',
  'reveal',
  'export',
  'copy',
] as const;

const CONTACT_PHONE_ENGLISH_SENSITIVE_PHONE_REQUEST_PATTERN =
  /\b(?:customer|client)\s+(?:phone|mobile)(?:\s+number)?\b|\bcontact\s+phone(?:\s+number)?\b|\bphone\s+number\b|\bcustomer\s+contact\s+number\b|\bcontact\s+number\b|\bmobile\s+number\b/;

const CONTACT_PHONE_CHINESE_FORBIDDEN_TEXT_PATTERNS: Array<[
  string,
  RegExp,
]> = [
  [
    'full_phone_request',
    /(请)?(提供|显示).*(完整手机号|未脱敏手机号|原始手机号|电话号码|客户电话)|\b(provide|show|reveal)\b.*(完整手机号|未脱敏手机号|原始手机号|电话号码|客户电话)|提供客户电话|提供电话号码/i,
  ],
  [
    'raw_phone_hash_request',
    /(请)?(提供|显示).*(手机号哈希|原始\s*phone_hash|原始电话哈希|电话哈希)/i,
  ],
  ['phone_normalized_request', /(请)?(提供|显示).*(phone_normalized)/i],
  ['call_or_dial_request', /(请)?(拨打客户电话|给客户打电话)/],
  ['customer_contact_execution_request', /(请)?(联系客户|触达客户)/],
  ['copy_or_export_request', /(请)?(导出客户电话|导出联系方式|复制客户电话|复制联系方式)/],
  ['formal_task_creation_request', /(请)?(创建正式任务|派发任务)/],
  [
    'real_chatgpt_api_request',
    /(请)?(接入真实\s*chatgpt\s*api|调用真实\s*chatgpt\s*api)/i,
  ],
  ['mcp_gateway_request', /(请)?接入\s*mcp\s*网关/i],
  ['voice_integration_request', /(请)?(接入语音|语音集成)/],
  ['live_gateway_request', /(请)?(开启\s*live\s*gateway|开启实时网关)/i],
];

const CONTACT_PHONE_FORBIDDEN_TRUE_FLAGS = new Set([
  'full_phone_included',
  'phone_hash_included',
  'phone_normalized_included',
  'customer_contact_execution_allowed',
  'database_read_allowed',
  'database_write_allowed',
  'business_action_allowed',
  'live_gateway_allowed',
  'mcp_gateway_allowed',
  'voice_integration_allowed',
  'executable',
  'approval_granted',
  'action_approval_granted',
  'dispatch_allowed',
  'dispatch_now',
  'task_creation_allowed',
  'business_object_creation_allowed',
]);

const CONTACT_PHONE_FORBIDDEN_FIELD_KEYS = new Set([
  'phone_normalized',
  'phone_normalized_value',
  'phone_hash',
  'phone_hash_value',
  'raw_phone_hash',
  'raw_phone_hash_value',
  'full_phone',
  'full_phone_value',
]);

@Injectable()
export class StarkAiChatGptContactPhoneReviewResponseValidatorService {
  constructor(
    private readonly interactionPacketService: StarkAiChatGptInteractionPacketService = new StarkAiChatGptInteractionPacketService(),
    private readonly contactPhoneSummaryHandoffService: StarkAiChatGptContactPhoneSummaryHandoffService = new StarkAiChatGptContactPhoneSummaryHandoffService(),
  ) {}

  buildSyntheticReviewResponsePacket(
    input: StarkAiChatGptContactPhoneReviewResponseValidationInput,
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
      forbiddenOperations: CONTACT_PHONE_FORBIDDEN_OPERATIONS,
      payload: this.buildResponsePayload(input, sourceHandoff),
    });
  }

  validateSyntheticReviewResponseArtifact(
    input: StarkAiChatGptContactPhoneReviewResponseValidationInput,
  ): StarkAiChatGptContactPhoneReviewResponseValidationResult {
    const packet = this.buildSyntheticReviewResponsePacket(input);
    return this.validateSyntheticReviewResponsePacket(packet, input);
  }

  validateSyntheticReviewResponsePacket(
    packet: unknown,
    input: Pick<
      StarkAiChatGptContactPhoneReviewResponseValidationInput,
      'generatedAt' | 'latestVerifiedMainCommit' | 'repo'
    > = {},
  ): StarkAiChatGptContactPhoneReviewResponseValidationResult {
    const packetRecord = this.asRecord(packet);
    const envelope = this.asRecord(packetRecord.envelope ?? packetRecord);
    const interactionType = this.resolveResponseType(envelope.interactionType);
    const sourceHandoff = this.buildSourceReviewRequestHandoff({
      generatedAt: input.generatedAt,
      latestVerifiedMainCommit: input.latestVerifiedMainCommit,
      repo: input.repo,
    });

    const baseValidationResult =
      this.interactionPacketService.validateInteractionPacket(packet);
    const issues = [...baseValidationResult.issues];

    this.validateSupportedInteractionType(envelope.interactionType, issues);
    this.validateAllowedOperations(envelope.allowedOperations, issues);
    this.validatePayloadSafety(packetRecord.payload, issues);

    const valid = issues.length === 0;
    const status: StarkAiChatGptContactPhoneReviewResponseStatus = valid
      ? 'valid_review_artifact'
      : 'blocked_review_artifact';

    return {
      contextType: 'chatgpt_contact_phone_review_response_validation_result',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      candidateOnly: true,
      syntheticOnly: true,
      nonExecutable: true,
      result: status,
      status,
      valid,
      interactionType,
      issueCount: issues.length,
      issues,
      baseValidationResult,
      sourceReviewRequestValidationStatus:
        sourceHandoff.validationResult.status,
      sourceReviewRequestInteractionType: 'review_request',
      executable: false,
      approvalGranted: false,
      dispatchAllowed: false,
      businessObjectCreationAllowed: false,
      databaseWriteAllowed: false,
      noWriteNoExecutionGuarantee: true,
    };
  }

  private buildSourceReviewRequestHandoff(
    input: Pick<
      StarkAiChatGptContactPhoneReviewResponseValidationInput,
      'generatedAt' | 'latestVerifiedMainCommit' | 'repo'
    >,
  ): StarkAiChatGptContactPhoneSummaryHandoff {
    return this.contactPhoneSummaryHandoffService.buildContactPhoneSummaryReviewRequestHandoff(
      {
        generatedAt: input.generatedAt,
        latestVerifiedMainCommit: input.latestVerifiedMainCommit,
        repo: input.repo,
      },
    );
  }

  private buildResponsePayload(
    input: StarkAiChatGptContactPhoneReviewResponseValidationInput,
    sourceHandoff: StarkAiChatGptContactPhoneSummaryHandoff,
  ): Record<string, unknown> {
    const payloadRecord = this.asRecord(input.payload);

    return {
      contextType: 'chatgpt_contact_phone_review_response_synthetic_artifact',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      candidateOnly: true,
      syntheticOnly: true,
      nonExecutable: true,
      sourcePacketValidatorPr116: 'merged_source',
      sourceReviewRequestHandoffPr121: 'merged_source',
      sourceReviewRequestValidationStatus:
        sourceHandoff.validationResult.status,
      sourceReviewRequestInteractionType:
        sourceHandoff.interactionPacket.envelope.interactionType,
      sourceContactSummaryReference:
        this.buildSourceContactSummaryReference(sourceHandoff),
      customerContactExecutionAllowed: false,
      databaseReadAllowed: false,
      databaseWriteAllowed: false,
      businessActionAllowed: false,
      liveGatewayAllowed: false,
      mcpGatewayAllowed: false,
      voiceIntegrationAllowed: false,
      ...payloadRecord,
    };
  }

  private buildSourceContactSummaryReference(
    sourceHandoff: StarkAiChatGptContactPhoneSummaryHandoff,
  ): Record<string, unknown> {
    const summary = sourceHandoff.contactPhonePolicySummary;

    return {
      contextType: 'contact_phone_policy_safe_summary_reference',
      fragmentCount: summary.fragmentCount,
      contextFragments: summary.contextFragments,
      sensitiveContactValueAllowedDecisionCount:
        summary.fullPhoneAllowedDecisions,
      callWithoutRevealAllowed: summary.callWithoutRevealAllowed,
      maskedReadAllowedCount: summary.maskedPhoneAllowedCount,
      externalSensitiveContactValueIncludedAllowed:
        summary.externalFullPhoneIncludedAllowed,
      rawHashExternalSafeByDefault: summary.phoneHashExternalSafeByDefault,
      databaseWrites: summary.databaseWrites,
      businessActions: summary.businessActions,
      customerContactExecutionAllowed:
        summary.customerContactExecutionAllowed,
      databaseReadAllowed: summary.databaseReadAllowed,
      databaseWriteAllowed: summary.databaseWriteAllowed,
      businessActionAllowed: summary.businessActionAllowed,
      liveGatewayAllowed: summary.liveGatewayAllowed,
      mcpGatewayAllowed: summary.mcpGatewayAllowed,
      voiceIntegrationAllowed: summary.voiceIntegrationAllowed,
      safeReferenceCustomerIds: [...summary.safeReferenceCustomerIds],
      safeReferencePhoneTails: [...summary.safeReferencePhoneTails],
      safeReferenceMaskedPhones: [...summary.safeReferenceMaskedPhones],
      forbiddenExternalFieldLabels: [
        'normalized_contact_value',
        'raw_hash',
        'complete_contact_value',
      ],
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
        'unsupported_contact_phone_review_response_type',
        'envelope.interactionType',
        'Contact phone review response validator only accepts review_response, clarification_request, or codex_instruction_candidate.',
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
      const compactOperation = this.compactToken(normalized);
      const operationTokens = normalized.split('_').filter(Boolean);
      for (const forbiddenToken of CONTACT_PHONE_BLOCKED_ALLOWED_OPERATION_TOKENS) {
        const compactForbiddenToken = this.compactToken(forbiddenToken);
        if (
          normalized === forbiddenToken ||
          normalized.startsWith(`${forbiddenToken}_`) ||
          normalized.endsWith(`_${forbiddenToken}`) ||
          operationTokens.includes(forbiddenToken) ||
          compactOperation === compactForbiddenToken ||
          compactOperation.includes(compactForbiddenToken)
        ) {
          this.addIssue(
            issues,
            `contact_phone_allowed_operation_blocked:${forbiddenToken}`,
            `envelope.allowedOperations[${index}]`,
            'Contact phone review response artifacts cannot allow execute, dispatch, call, dial, reveal, or export operations.',
          );
        }
      }
      for (const forbiddenOperation of CONTACT_PHONE_FORBIDDEN_OPERATIONS) {
        if (this.operationMatchesForbiddenOperation(normalized, forbiddenOperation)) {
          this.addIssue(
            issues,
            `contact_phone_allowed_operation_forbidden:${forbiddenOperation}`,
            `envelope.allowedOperations[${index}]`,
            'Contact phone review response artifacts cannot allow protected contact-phone operations.',
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
        CONTACT_PHONE_FORBIDDEN_TRUE_FLAGS.has(normalizedKey) &&
        value === true
      ) {
        this.addIssue(
          issues,
          `contact_phone_forbidden_true_flag:${normalizedKey}`,
          path,
          'Contact phone review response payload cannot enable protected phone, database, gateway, execution, approval, or dispatch flags.',
        );
      }

      if (CONTACT_PHONE_FORBIDDEN_FIELD_KEYS.has(normalizedKey)) {
        this.addIssue(
          issues,
          `contact_phone_forbidden_raw_field:${normalizedKey}`,
          path,
          'Contact phone review response payload cannot include raw phone fields.',
        );
      }
    });

    this.walkText(payload, 'payload', (path, text) => {
      if (this.isAllowedForbiddenFieldLabel(path)) {
        return;
      }
      this.detectForbiddenText(path, text, issues);
      this.detectRealPhoneLikeDigits(path, text, issues);
    });
  }

  private detectForbiddenText(
    path: string,
    text: string,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    const lower = text.toLowerCase();
    const normalized = lower.replace(/[_-]+/g, ' ');
    const unsafeRequest = this.hasUnsafeRequestVerb(normalized);
    const sensitivePhoneDataRequest =
      this.hasSensitivePhoneDataRequestVerb(normalized);
    const safeBoundaryReference = this.isSafeBoundaryReference(normalized);

    if (
      !safeBoundaryReference &&
      ((unsafeRequest && /\b(full phone|unmasked phone)\b/.test(normalized)) ||
        (sensitivePhoneDataRequest &&
          CONTACT_PHONE_ENGLISH_SENSITIVE_PHONE_REQUEST_PATTERN.test(
            normalized,
          )))
    ) {
      this.addForbiddenTextIssue(issues, 'full_phone_request', path);
    }

    if (
      unsafeRequest &&
      !safeBoundaryReference &&
      /\bphone normalized\b|\bphone_normalized\b/.test(lower)
    ) {
      this.addForbiddenTextIssue(issues, 'phone_normalized_request', path);
    }

    if (
      unsafeRequest &&
      !safeBoundaryReference &&
      /\b(raw phone hash|phone hash|phone_hash)\b/.test(normalized)
    ) {
      this.addForbiddenTextIssue(issues, 'raw_phone_hash_request', path);
    }

    for (const [code, pattern] of CONTACT_PHONE_CHINESE_FORBIDDEN_TEXT_PATTERNS) {
      if (!safeBoundaryReference && pattern.test(text)) {
        this.addForbiddenTextIssue(issues, code, path);
      }
    }

    if (
      !safeBoundaryReference &&
      /\breveal\b.*\b(phone|full phone)\b|\bplease reveal full phone\b/.test(
        normalized,
      )
    ) {
      this.addForbiddenTextIssue(issues, 'reveal_phone_request', path);
    }

    if (
      unsafeRequest &&
      !safeBoundaryReference &&
      /\b(call|dial)\b.*\b(customer|phone|contact)\b/.test(normalized)
    ) {
      this.addForbiddenTextIssue(issues, 'call_or_dial_request', path);
    }

    if (
      unsafeRequest &&
      !safeBoundaryReference &&
      /\b(copy|export)\b.*\b(phone|contact|customer|summary)\b/.test(
        normalized,
      )
    ) {
      this.addForbiddenTextIssue(issues, 'copy_or_export_request', path);
    }

    if (
      unsafeRequest &&
      !safeBoundaryReference &&
      /\b(create|open|dispatch)\b.*\b(formal|official|real)\b.*\btask\b/.test(
        normalized,
      )
    ) {
      this.addForbiddenTextIssue(issues, 'formal_task_creation_request', path);
    }

    if (
      unsafeRequest &&
      !safeBoundaryReference &&
      /\b(contact|message|reach out to)\b.*\bcustomer\b/.test(normalized)
    ) {
      this.addForbiddenTextIssue(
        issues,
        'customer_contact_execution_request',
        path,
      );
    }

    if (
      unsafeRequest &&
      !safeBoundaryReference &&
      /\b(real|live)?\s*chatgpt api\b|\bopenai api\b/.test(normalized)
    ) {
      this.addForbiddenTextIssue(issues, 'real_chatgpt_api_request', path);
    }

    if (
      unsafeRequest &&
      !safeBoundaryReference &&
      /\bmcp gateway\b|\bmcp\b.*\bgateway\b/.test(normalized)
    ) {
      this.addForbiddenTextIssue(issues, 'mcp_gateway_request', path);
    }

    if (
      unsafeRequest &&
      !safeBoundaryReference &&
      /\bvoice integration\b|\bvoice\b.*\bintegration\b/.test(normalized)
    ) {
      this.addForbiddenTextIssue(issues, 'voice_integration_request', path);
    }
  }

  private detectRealPhoneLikeDigits(
    path: string,
    text: string,
    issues: StarkAiChatGptInteractionValidationIssue[],
  ): void {
    if (/(?:\+?86[- ]?)?1[3-9]\d{9}\b/.test(text)) {
      this.addIssue(
        issues,
        'contact_phone_real_phone_like_digits',
        path,
        'Contact phone review response payload cannot include real-phone-like long digit runs.',
      );
    }
  }

  private addForbiddenTextIssue(
    issues: StarkAiChatGptInteractionValidationIssue[],
    code: string,
    path: string,
  ): void {
    this.addIssue(
      issues,
      `contact_phone_forbidden_text:${code}`,
      path,
      'Contact phone review response payload cannot request sensitive contact data, contact execution, export, live gateway, MCP, voice, or real ChatGPT API behavior.',
    );
  }

  private hasUnsafeRequestVerb(text: string): boolean {
    return (
      /\b(please|request|ask|need|want|provide|include|show|reveal|return|send|give|expose|print|enable|use|call|invoke|connect|implement|add|create|open|dispatch|run|start|copy|export|dial|contact|message)\b/.test(
        text,
      ) ||
      /(需要|提供|显示|拨打|导出|复制|创建|派发|联系|触达|接入|调用|开启)/.test(
        text,
      )
    );
  }

  private hasSensitivePhoneDataRequestVerb(text: string): boolean {
    return /\b(please|request|ask|need|want|provide|include|show|reveal|return|send|give|expose|print)\b/.test(
      text,
    );
  }

  private isSafeBoundaryReference(text: string): boolean {
    if (this.hasUnsafeRequestVerb(text)) {
      return this.hasExplicitSafetyNegation(text);
    }

    return (
      this.hasExplicitSafetyNegation(text) ||
      /\b(no|not|never|without|blocked|forbidden|denied|redacted|safe summary|summary only|false)\b/.test(
        text,
      )
    );
  }

  private hasExplicitSafetyNegation(text: string): boolean {
    if (this.hasUnsafeContrastRequest(text)) {
      return false;
    }

    return (
      /\b(must not|cannot|can not|do not|should not|not allowed to|forbidden to|blocked from)\b.*\b(reveal|provide|show|export|copy|call|dial|contact|message|create|dispatch|connect|invoke|enable)\b/.test(
        text,
      ) ||
      /\b(fullphoneincluded|full phone included)\s*=\s*false\b.*\b(no|not|without)\b.*\b(full phone|phone)\b/.test(
        text,
      ) ||
      /(完整手机号|未脱敏手机号|原始手机号|客户电话|电话号码).*(不得|不能|不可|不允许|不应|禁止).*(提供|显示|导出|复制|拨打|联系|触达)?/.test(
        text,
      ) ||
      /(不得|不能|不可|不允许|不应|禁止).*(提供|显示|导出|复制|拨打|联系|触达).*(完整手机号|未脱敏手机号|原始手机号|客户电话|电话号码|电话|联系方式|客户)/.test(
        text,
      )
    );
  }

  private hasUnsafeContrastRequest(text: string): boolean {
    return /\b(but|however|though|although)\b.*\b(please|request|ask|need|want|provide|include|show|reveal|return|send|give|expose|print|enable|use|call|invoke|connect|implement|add|create|open|dispatch|run|start|copy|export|dial|contact|message)\b/.test(
      text,
    ) || /(但|但是|不过|然而).*(需要|提供|显示|拨打|导出|复制|创建|派发|联系|触达|接入|调用|开启)/.test(
      text,
    );
  }

  private operationMatchesForbiddenOperation(
    operation: string,
    forbiddenOperation: string,
  ): boolean {
    const compactOperation = this.compactToken(operation);
    const compactForbiddenOperation = this.compactToken(forbiddenOperation);

    return (
      operation === forbiddenOperation ||
      operation.startsWith(`${forbiddenOperation}_`) ||
      operation.endsWith(`_${forbiddenOperation}`) ||
      operation.includes(`_${forbiddenOperation}_`) ||
      compactOperation === compactForbiddenOperation ||
      compactOperation.includes(compactForbiddenOperation)
    );
  }

  private isAllowedForbiddenFieldLabel(path: string): boolean {
    return path.includes('.forbiddenExternalFields[');
  }

  private defaultAllowedOperationsForInteractionType(
    interactionType: StarkAiChatGptContactPhoneReviewResponseType,
  ): string[] {
    if (interactionType === 'review_response') {
      return ['summarize', 'identify_gap'];
    }
    if (interactionType === 'clarification_request') {
      return ['ask_clarifying_question'];
    }
    return ['draft_codex_instruction_candidate'];
  }

  private defaultReviewModeForInteractionType(
    interactionType: StarkAiChatGptContactPhoneReviewResponseType,
  ): StarkAiChatGptInteractionReviewMode {
    if (interactionType === 'clarification_request') {
      return 'missing_evidence_review';
    }
    if (interactionType === 'codex_instruction_candidate') {
      return 'codex_instruction_candidate_review';
    }
    return 'redaction_review';
  }

  private directionForInteractionType(
    interactionType: StarkAiChatGptContactPhoneReviewResponseType,
  ): 'chatgpt_to_stark_ai' | 'chatgpt_to_user_codex' {
    if (interactionType === 'codex_instruction_candidate') {
      return 'chatgpt_to_user_codex';
    }
    return 'chatgpt_to_stark_ai';
  }

  private resolveResponseType(
    value: unknown,
  ): StarkAiChatGptContactPhoneReviewResponseType {
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
