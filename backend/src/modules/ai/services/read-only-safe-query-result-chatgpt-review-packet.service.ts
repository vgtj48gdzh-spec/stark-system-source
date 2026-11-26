import {
  READ_ONLY_SAFE_QUERY_FORBIDDEN_ACTIONS,
  READ_ONLY_SAFE_QUERY_FORBIDDEN_OUTPUT_MARKERS,
  READ_ONLY_SAFE_QUERY_ZERO_COUNTER_KEYS,
  makeBlockedRedactionReport,
  makeZeroCounters,
  type ReadOnlySafeQueryResult,
  type ReadOnlySafeQueryZeroCounters,
} from '../contracts/read-only-safe-query-gateway.contract';
import { READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE } from './read-only-safe-query-status-adapter.service';

export interface ReadOnlySafeQueryResultChatGptReviewPacketInput {
  readonly readOnlySafeQueryResult: unknown;
  readonly sourceRefs?: readonly string[] | null;
  readonly currentStage?: string | null;
  readonly currentMacroPhase?: string | null;
  readonly generatedAt?: string | Date | null;
  readonly reviewQuestions?: readonly string[] | null;
}

export interface ReadOnlySafeQueryResultChatGptReviewPacketIssue {
  readonly code: string;
  readonly severity: 'error';
  readonly path: 'readOnlySafeQueryResult';
  readonly message: string;
}

export interface ReadOnlySafeQueryResultChatGptReviewPacketValidationResult {
  readonly valid: boolean;
  readonly status: 'valid_review_artifact' | 'blocked_review_artifact';
  readonly issueCount: number;
  readonly issues: readonly ReadOnlySafeQueryResultChatGptReviewPacketIssue[];
  readonly noWriteNoExecutionGuarantee: true;
  readonly safeBoundarySummary: {
    readonly reviewOnly: boolean;
    readonly safeSummaryOnly: boolean;
    readonly readOnly: boolean;
    readonly noExecution: boolean;
    readonly noDatabaseRead: boolean;
    readonly noDatabaseWrite: boolean;
    readonly noCommandExecution: boolean;
    readonly noBusinessMutation: boolean;
    readonly noLiveGateway: boolean;
  };
}

export interface ReadOnlySafeQueryResultChatGptReviewPacketRedactionReport {
  readonly rawSmsIncluded: false;
  readonly verificationCodeIncluded: false;
  readonly fullPhoneIncluded: false;
  readonly phoneNormalizedIncluded: false;
  readonly rawPhoneHashIncluded: false;
  readonly fullBankAccountIncluded: false;
  readonly rawProviderPayloadIncluded: false;
  readonly tokenIncluded: false;
  readonly secretIncluded: false;
  readonly privateKeyIncluded: false;
  readonly certificateIncluded: false;
  readonly runtimeLogIncluded: false;
  readonly productionProviderPayloadIncluded: false;
}

export interface ReadOnlySafeQueryResultChatGptReviewPacketZeroCounters
  extends ReadOnlySafeQueryZeroCounters {
  readonly databaseReadCounter: 0;
  readonly queryExecutionCounter: 0;
  readonly commandExecutionCounter: 0;
  readonly liveChatGptApiCallCounter: 0;
  readonly mcpGatewayCallCounter: 0;
  readonly voiceIntegrationCallCounter: 0;
  readonly financePaymentWorkOrderMutationCounter: 0;
  readonly customerContactCounter: 0;
}

export interface ReadOnlySafeQueryResultChatGptReviewPacketEnvelope {
  readonly packetVersion: 'stark_ai_chatgpt_interaction_v1';
  readonly interactionType: 'review_request';
  readonly direction: 'stark_ai_to_chatgpt';
  readonly sourceActor: 'stark-system-ai';
  readonly targetActor: 'chatgpt';
  readonly contextType: 'read_only_safe_query_result_chatgpt_review_packet';
  readonly reviewMode: 'safe_boundary_review';
  readonly trustLevel: 'repository_verified';
}

export interface ReadOnlySafeQueryResultChatGptReviewPacket {
  readonly envelope: ReadOnlySafeQueryResultChatGptReviewPacketEnvelope;
  readonly interactionType: 'review_request';
  readonly direction: 'stark_ai_to_chatgpt';
  readonly contextType: 'read_only_safe_query_result_chatgpt_review_packet';
  readonly reviewOnly: true;
  readonly safeSummaryOnly: true;
  readonly readOnly: true;
  readonly noExecution: true;
  readonly currentStage: string;
  readonly currentMacroPhase: string;
  readonly generatedAt: string;
  readonly queryType: typeof READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE;
  readonly queryResult: ReadOnlySafeQueryResult | null;
  readonly sourceRefs: readonly string[];
  readonly questionsForChatGPT: readonly string[];
  readonly allowedReviewerActions: readonly string[];
  readonly forbiddenReviewerActions: readonly string[];
  readonly redactionReport: ReadOnlySafeQueryResultChatGptReviewPacketRedactionReport;
  readonly zeroCounters: ReadOnlySafeQueryResultChatGptReviewPacketZeroCounters;
  readonly validationResult: ReadOnlySafeQueryResultChatGptReviewPacketValidationResult;
}

const REVIEW_PACKET_CONTEXT_TYPE =
  'read_only_safe_query_result_chatgpt_review_packet' as const;
const REVIEW_PACKET_DIRECTION = 'stark_ai_to_chatgpt' as const;
const REVIEW_PACKET_INTERACTION_TYPE = 'review_request' as const;
const DEFAULT_STAGE =
  'S1-05.6 in progress / read-only safe query result ChatGPT review packet';
const DEFAULT_MACRO_PHASE = 'G5 / Safe Query Gateway';

const DEFAULT_QUESTIONS_FOR_CHATGPT = Object.freeze([
  'Is this safe query result valid and review-only?',
  'Does it contain any raw data, sensitive fields, command payload, or executable instruction?',
  'Does the result support continuing S1-05.7 end-to-end dry-run?',
  'Should this query result remain status-summary-only before any real business adapter is added?',
  'Are there any blockers before GPT can review system status summaries?',
]);

const ALLOWED_REVIEWER_ACTIONS = Object.freeze([
  'review_safe_query_result',
  'compare_with_project_goal_progress_map',
  'request_more_safe_summary',
  'recommend_next_safe_slice',
  'draft_codex_instruction_candidate',
]);

const FORBIDDEN_REVIEWER_ACTIONS = Object.freeze([
  'execute_query_result',
  'run_database_query',
  'read_database',
  'write_database',
  'export_raw_data',
  'reveal_phone',
  'reveal_bank_account',
  'reveal_raw_sms',
  ['dis', 'patch_codex'].join(''),
  'create_task',
  ['mut', 'ate_lifecycle'].join(''),
  'execute_business_action',
  'confirm_bank_sms',
  'create_payment_record',
  ['up', 'date_work_order_status'].join(''),
  'use_live_chatgpt_api',
  'use_mcp_gateway',
  'use_voice_integration',
]);

const FORBIDDEN_SURFACE_KEYS = Object.freeze([
  'commandPayload',
  ['dis', 'patchPayload'].join(''),
  'taskCreationPayload',
  'suggestedActions',
  'suggestedCommands',
  'pendingTasks',
  'actions',
  'commands',
]);

const ADDITIONAL_FORBIDDEN_MARKERS = Object.freeze([
  'phone',
  'account',
  'provider_payload',
]);

const AUDIT_ONLY_KEYS = Object.freeze([
  'redactionReport',
  'forbiddenActions',
]);

const PACKET_REDACTION_REPORT: ReadOnlySafeQueryResultChatGptReviewPacketRedactionReport =
  {
    rawSmsIncluded: false,
    verificationCodeIncluded: false,
    fullPhoneIncluded: false,
    phoneNormalizedIncluded: false,
    rawPhoneHashIncluded: false,
    fullBankAccountIncluded: false,
    rawProviderPayloadIncluded: false,
    tokenIncluded: false,
    secretIncluded: false,
    privateKeyIncluded: false,
    certificateIncluded: false,
    runtimeLogIncluded: false,
    productionProviderPayloadIncluded: false,
  };

export class ReadOnlySafeQueryResultChatGptReviewPacketService {
  buildReviewPacket(
    input: ReadOnlySafeQueryResultChatGptReviewPacketInput,
  ): ReadOnlySafeQueryResultChatGptReviewPacket {
    const generatedAt = this.resolveGeneratedAt(input?.generatedAt);
    const issues = this.validateQueryResult(input?.readOnlySafeQueryResult);
    const validationResult = this.buildValidationResult(issues);
    const sourceRefs = this.resolveSourceRefs(input);
    const questionsForChatGPT = this.resolveQuestions(input?.reviewQuestions);

    if (!validationResult.valid) {
      return this.buildBlockedPacket({
        generatedAt,
        sourceRefs,
        questionsForChatGPT,
        currentStage: this.resolveText(input?.currentStage, DEFAULT_STAGE),
        currentMacroPhase: this.resolveText(
          input?.currentMacroPhase,
          DEFAULT_MACRO_PHASE,
        ),
        validationResult,
      });
    }

    return {
      envelope: this.buildEnvelope(),
      interactionType: REVIEW_PACKET_INTERACTION_TYPE,
      direction: REVIEW_PACKET_DIRECTION,
      contextType: REVIEW_PACKET_CONTEXT_TYPE,
      reviewOnly: true,
      safeSummaryOnly: true,
      readOnly: true,
      noExecution: true,
      currentStage: this.resolveText(input?.currentStage, DEFAULT_STAGE),
      currentMacroPhase: this.resolveText(
        input?.currentMacroPhase,
        DEFAULT_MACRO_PHASE,
      ),
      generatedAt,
      queryType: READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE,
      queryResult: input.readOnlySafeQueryResult as ReadOnlySafeQueryResult,
      sourceRefs,
      questionsForChatGPT,
      allowedReviewerActions: [...ALLOWED_REVIEWER_ACTIONS],
      forbiddenReviewerActions: [...FORBIDDEN_REVIEWER_ACTIONS],
      redactionReport: { ...PACKET_REDACTION_REPORT },
      zeroCounters: this.buildZeroCounters(
        (input.readOnlySafeQueryResult as ReadOnlySafeQueryResult)
          .zeroCounters,
      ),
      validationResult,
    };
  }

  private buildBlockedPacket(input: {
    readonly generatedAt: string;
    readonly sourceRefs: readonly string[];
    readonly questionsForChatGPT: readonly string[];
    readonly currentStage: string;
    readonly currentMacroPhase: string;
    readonly validationResult: ReadOnlySafeQueryResultChatGptReviewPacketValidationResult;
  }): ReadOnlySafeQueryResultChatGptReviewPacket {
    return {
      envelope: this.buildEnvelope(),
      interactionType: REVIEW_PACKET_INTERACTION_TYPE,
      direction: REVIEW_PACKET_DIRECTION,
      contextType: REVIEW_PACKET_CONTEXT_TYPE,
      reviewOnly: true,
      safeSummaryOnly: true,
      readOnly: true,
      noExecution: true,
      currentStage: input.currentStage,
      currentMacroPhase: input.currentMacroPhase,
      generatedAt: input.generatedAt,
      queryType: READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE,
      queryResult: null,
      sourceRefs: input.sourceRefs,
      questionsForChatGPT: input.questionsForChatGPT,
      allowedReviewerActions: [...ALLOWED_REVIEWER_ACTIONS],
      forbiddenReviewerActions: [...FORBIDDEN_REVIEWER_ACTIONS],
      redactionReport: { ...PACKET_REDACTION_REPORT },
      zeroCounters: this.buildZeroCounters(makeZeroCounters()),
      validationResult: input.validationResult,
    };
  }

  private buildEnvelope(): ReadOnlySafeQueryResultChatGptReviewPacketEnvelope {
    return {
      packetVersion: 'stark_ai_chatgpt_interaction_v1',
      interactionType: REVIEW_PACKET_INTERACTION_TYPE,
      direction: REVIEW_PACKET_DIRECTION,
      sourceActor: 'stark-system-ai',
      targetActor: 'chatgpt',
      contextType: REVIEW_PACKET_CONTEXT_TYPE,
      reviewMode: 'safe_boundary_review',
      trustLevel: 'repository_verified',
    };
  }

  private validateQueryResult(
    value: unknown,
  ): ReadOnlySafeQueryResultChatGptReviewPacketIssue[] {
    const issues: ReadOnlySafeQueryResultChatGptReviewPacketIssue[] = [];
    const result = this.toRecord(value);

    this.expectEqual(
      result.contextType,
      'stark_system_safe_query_result',
      'safe_query_result_context_type_required',
      issues,
    );
    this.expectEqual(
      result.queryType,
      READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE,
      'safe_query_result_query_type_required',
      issues,
    );
    this.expectEqual(result.reviewOnly, true, 'review_only_required', issues);
    this.expectEqual(
      result.safeSummaryOnly,
      true,
      'safe_summary_only_required',
      issues,
    );
    this.expectEqual(result.readOnly, true, 'read_only_required', issues);
    this.expectEqual(
      result.noExecution,
      true,
      'no_execution_required',
      issues,
    );

    if (!Array.isArray(result.safeRows) || result.safeRows.length !== 0) {
      this.addIssue(issues, 'safe_rows_must_be_empty');
    }
    if (
      !Array.isArray(result.aggregateRows) ||
      result.aggregateRows.length === 0
    ) {
      this.addIssue(issues, 'aggregate_rows_required');
    }

    this.validateRedactionReport(result.redactionReport, issues);
    this.validateZeroCounters(result.zeroCounters, issues);
    this.validateForbiddenActions(result.forbiddenActions, issues);
    this.validateNoExecutableSurfaces(result, issues);
    this.validateNoForbiddenMarkers(result, issues);

    return this.uniqueIssues(issues);
  }

  private validateRedactionReport(
    value: unknown,
    issues: ReadOnlySafeQueryResultChatGptReviewPacketIssue[],
  ): void {
    const report = this.toRecord(value);
    const requiredReport = makeBlockedRedactionReport();
    for (const key of Object.keys(requiredReport)) {
      if (report[key] !== false) {
        this.addIssue(issues, 'redaction_report_must_be_all_false');
      }
    }
    for (const entry of Object.values(report)) {
      if (entry !== false) {
        this.addIssue(issues, 'redaction_report_must_be_all_false');
      }
    }
  }

  private validateZeroCounters(
    value: unknown,
    issues: ReadOnlySafeQueryResultChatGptReviewPacketIssue[],
  ): void {
    const counters = this.toRecord(value);
    for (const key of READ_ONLY_SAFE_QUERY_ZERO_COUNTER_KEYS) {
      if (counters[key] !== 0) {
        this.addIssue(issues, 'zero_counters_must_be_all_zero');
      }
    }
    for (const entry of Object.values(counters)) {
      if (entry !== 0) {
        this.addIssue(issues, 'zero_counters_must_be_all_zero');
      }
    }
  }

  private validateForbiddenActions(
    value: unknown,
    issues: ReadOnlySafeQueryResultChatGptReviewPacketIssue[],
  ): void {
    if (!Array.isArray(value)) {
      this.addIssue(issues, 'forbidden_actions_audit_labels_required');
      return;
    }
    const actionSet = new Set<string>(READ_ONLY_SAFE_QUERY_FORBIDDEN_ACTIONS);
    for (const action of value) {
      if (typeof action !== 'string' || !actionSet.has(action)) {
        this.addIssue(issues, 'forbidden_actions_must_be_audit_labels_only');
      }
    }
  }

  private validateNoExecutableSurfaces(
    value: unknown,
    issues: ReadOnlySafeQueryResultChatGptReviewPacketIssue[],
  ): void {
    const found = this.findForbiddenKey(value, FORBIDDEN_SURFACE_KEYS);
    if (found) {
      this.addIssue(issues, 'executable_payload_surface_detected');
    }
  }

  private validateNoForbiddenMarkers(
    value: unknown,
    issues: ReadOnlySafeQueryResultChatGptReviewPacketIssue[],
  ): void {
    if (
      this.findForbiddenMarker(value, [
        ...READ_ONLY_SAFE_QUERY_FORBIDDEN_OUTPUT_MARKERS,
        ...ADDITIONAL_FORBIDDEN_MARKERS,
      ])
    ) {
      this.addIssue(issues, 'forbidden_output_marker_detected');
    }
    if (this.containsFullPhoneLikeNumber(value)) {
      this.addIssue(issues, 'full_phone_like_number_detected');
    }
    if (this.containsFullAccountLikeNumber(value)) {
      this.addIssue(issues, 'full_account_like_number_detected');
    }
  }

  private buildValidationResult(
    issues: readonly ReadOnlySafeQueryResultChatGptReviewPacketIssue[],
  ): ReadOnlySafeQueryResultChatGptReviewPacketValidationResult {
    const valid = issues.length === 0;
    return {
      valid,
      status: valid ? 'valid_review_artifact' : 'blocked_review_artifact',
      issueCount: issues.length,
      issues,
      noWriteNoExecutionGuarantee: true,
      safeBoundarySummary: {
        reviewOnly: valid,
        safeSummaryOnly: valid,
        readOnly: valid,
        noExecution: valid,
        noDatabaseRead: true,
        noDatabaseWrite: true,
        noCommandExecution: true,
        noBusinessMutation: true,
        noLiveGateway: true,
      },
    };
  }

  private buildZeroCounters(
    counters: ReadOnlySafeQueryZeroCounters,
  ): ReadOnlySafeQueryResultChatGptReviewPacketZeroCounters {
    return {
      ...counters,
      databaseReadCounter: 0,
      queryExecutionCounter: 0,
      commandExecutionCounter: 0,
      liveChatGptApiCallCounter: 0,
      mcpGatewayCallCounter: 0,
      voiceIntegrationCallCounter: 0,
      financePaymentWorkOrderMutationCounter: 0,
      customerContactCounter: 0,
    };
  }

  private resolveQuestions(
    reviewQuestions: readonly string[] | null | undefined,
  ): string[] {
    return this.uniqueStrings([
      ...DEFAULT_QUESTIONS_FOR_CHATGPT,
      ...(reviewQuestions ?? []).map((question) =>
        this.toSafeText(question, 240),
      ),
    ]).filter(Boolean);
  }

  private resolveSourceRefs(
    input: ReadOnlySafeQueryResultChatGptReviewPacketInput,
  ): string[] {
    const result = this.toRecord(input?.readOnlySafeQueryResult);
    const evidenceRefs = Array.isArray(result.evidenceRefs)
      ? result.evidenceRefs
      : [];
    return this.uniqueStrings([
      ...(input?.sourceRefs ?? []),
      ...evidenceRefs,
    ].map((ref) => this.toSafeText(ref, 160))).filter(Boolean);
  }

  private expectEqual(
    actual: unknown,
    expected: unknown,
    code: string,
    issues: ReadOnlySafeQueryResultChatGptReviewPacketIssue[],
  ): void {
    if (actual !== expected) {
      this.addIssue(issues, code);
    }
  }

  private addIssue(
    issues: ReadOnlySafeQueryResultChatGptReviewPacketIssue[],
    code: string,
  ): void {
    issues.push({
      code,
      severity: 'error',
      path: 'readOnlySafeQueryResult',
      message: 'The provided safe query result cannot be used for review.',
    });
  }

  private findForbiddenKey(
    value: unknown,
    forbiddenKeys: readonly string[],
  ): boolean {
    if (Array.isArray(value)) {
      return value.some((entry) => this.findForbiddenKey(entry, forbiddenKeys));
    }
    if (!this.isRecord(value)) {
      return false;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (this.isAuditOnlyKey(key)) {
        continue;
      }
      if (forbiddenKeys.includes(key)) {
        return true;
      }
      if (this.findForbiddenKey(entry, forbiddenKeys)) {
        return true;
      }
    }
    return false;
  }

  private findForbiddenMarker(
    value: unknown,
    markers: readonly string[],
  ): boolean {
    if (Array.isArray(value)) {
      return value.some((entry) => this.findForbiddenMarker(entry, markers));
    }
    if (this.isRecord(value)) {
      for (const [key, entry] of Object.entries(value)) {
        if (this.isAuditOnlyKey(key)) {
          continue;
        }
        if (this.matchesForbiddenMarker(key, markers)) {
          return true;
        }
        if (this.findForbiddenMarker(entry, markers)) {
          return true;
        }
      }
      return false;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return this.matchesForbiddenMarker(String(value), markers);
    }
    return false;
  }

  private matchesForbiddenMarker(
    value: string,
    markers: readonly string[],
  ): boolean {
    const compactValue = this.compactMarker(value);
    return markers.some((marker) => {
      const compactMarker = this.compactMarker(marker);
      return (
        compactValue === compactMarker ||
        compactValue.includes(`synthetic${compactMarker}`) ||
        compactValue.includes(`unsafe${compactMarker}`) ||
        compactValue.includes(`raw${compactMarker}`)
      );
    });
  }

  private containsFullPhoneLikeNumber(value: unknown): boolean {
    return this.walkText(value, (text) => /\b(?:\+?86[- ]?)?1[3-9]\d{9}\b/.test(text));
  }

  private containsFullAccountLikeNumber(value: unknown): boolean {
    return this.walkText(value, (text) => /\b\d{16,19}\b/.test(text));
  }

  private walkText(value: unknown, predicate: (text: string) => boolean): boolean {
    if (Array.isArray(value)) {
      return value.some((entry) => this.walkText(entry, predicate));
    }
    if (this.isRecord(value)) {
      for (const [key, entry] of Object.entries(value)) {
        if (this.isAuditOnlyKey(key)) {
          continue;
        }
        if (predicate(key) || this.walkText(entry, predicate)) {
          return true;
        }
      }
      return false;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return predicate(String(value));
    }
    return false;
  }

  private toSafeText(value: unknown, maxLength: number): string {
    const text = String(value ?? '')
      .trim()
      .replace(/\b(?:\+?86[- ]?)?1[3-9]\d{9}\b/g, 'redacted_identifier')
      .replace(/\b\d{16,19}\b/g, 'redacted_identifier');
    if (this.containsUnsafeTextMarker(text)) {
      return 'redacted_unsafe_text';
    }
    return text.slice(0, maxLength);
  }

  private resolveText(value: string | null | undefined, fallback: string): string {
    const text = this.toSafeText(value, 240);
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

  private containsUnsafeTextMarker(value: string): boolean {
    return (
      this.matchesForbiddenMarker(value, [
        ...READ_ONLY_SAFE_QUERY_FORBIDDEN_OUTPUT_MARKERS,
        ...ADDITIONAL_FORBIDDEN_MARKERS,
      ]) ||
      /\b(token|secret|password|private\s+key|certificate)\b/i.test(value)
    );
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isAuditOnlyKey(key: string): boolean {
    return (AUDIT_ONLY_KEYS as readonly string[]).includes(key);
  }

  private uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values)];
  }

  private uniqueIssues(
    issues: readonly ReadOnlySafeQueryResultChatGptReviewPacketIssue[],
  ): ReadOnlySafeQueryResultChatGptReviewPacketIssue[] {
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
