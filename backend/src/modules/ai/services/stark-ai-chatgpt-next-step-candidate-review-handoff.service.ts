import { Injectable } from '@nestjs/common';
import {
  StarkAiChatGptInteractionPacketService,
  type StarkAiChatGptInteractionValidationResult,
} from './stark-ai-chatgpt-interaction-packet.service';
import {
  StarkAiChatGptNextStepSelectorService,
  type StarkAiChatGptNextStepCandidate,
  type StarkAiChatGptNextStepMode,
  type StarkAiChatGptNextStepSelectorInput,
  type StarkAiChatGptNextStepSelectorSource,
  type StarkAiChatGptNextStepSelectorSummary,
} from './stark-ai-chatgpt-next-step-selector.service';

export type StarkAiChatGptNextStepCandidateReviewAllowedAction =
  | 'review_candidate'
  | 'compare_candidates'
  | 'request_owner_approval'
  | 'request_more_safe_summary'
  | 'draft_codex_instruction_candidate';

export type StarkAiChatGptNextStepCandidateReviewForbiddenAction =
  | 'execute_candidate'
  | 'dispatch_codex'
  | 'create_task'
  | 'mutate_lifecycle'
  | 'read_database'
  | 'write_database'
  | 'execute_business_action'
  | 'contact_customer'
  | 'reveal_phone'
  | 'call_customer'
  | 'use_live_chatgpt_api'
  | 'use_mcp_gateway'
  | 'use_voice_integration'
  | 'finance_payment_work_order_mutation';

export interface StarkAiChatGptNextStepCandidateReviewHandoffInput
  extends StarkAiChatGptNextStepSelectorInput {
  repo?: string | null;
}

export interface StarkAiChatGptNextStepCandidateReviewHandoffSource
  extends StarkAiChatGptNextStepSelectorSource {}

export interface StarkAiChatGptNextStepCandidateReviewSelectorSummary
  extends Omit<StarkAiChatGptNextStepSelectorSummary, 'sourceChain'> {
  sourceChain: StarkAiChatGptNextStepCandidateReviewHandoffSource[];
}

export interface StarkAiChatGptNextStepCandidateReviewRedactionReport {
  smsContentIncluded: false;
  otpValuesIncluded: false;
  unredactedContactIdentifiersIncluded: false;
  rawDerivedContactHashIncluded: false;
  credentialMaterialIncluded: false;
  keyMaterialIncluded: false;
  certMaterialIncluded: false;
  runtimeTraceIncluded: false;
  unsafeExecutionDetailsIncluded: false;
}

export interface StarkAiChatGptNextStepCandidateReviewSafeBoundaryFlags {
  repositoryWrites: 0;
  databaseReads: 0;
  databaseWrites: 0;
  businessActions: 0;
  customerContactExecutions: 0;
  dispatches: 0;
  taskCreations: 0;
  lifecycleMutations: 0;
  liveChatGptApiCalls: 0;
  mcpGatewayCalls: 0;
  voiceIntegrationCalls: 0;
  financePaymentWorkOrderMutations: 0;
}

export interface StarkAiChatGptNextStepCandidateReviewHandoff {
  contextType: 'stark_ai_chatgpt_next_step_candidate_review_handoff';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  candidateOnly: true;
  noExecution: true;
  interactionType: 'review_request';
  generatedAt: string;
  repo: string;
  currentStage: string;
  currentMode: StarkAiChatGptNextStepMode;
  sourceSelectorSummary: StarkAiChatGptNextStepCandidateReviewSelectorSummary;
  candidates: StarkAiChatGptNextStepCandidate[];
  recommendedCandidateId: string;
  questionsForChatGPT: string[];
  allowedReviewerActions: StarkAiChatGptNextStepCandidateReviewAllowedAction[];
  forbiddenReviewerActions: StarkAiChatGptNextStepCandidateReviewForbiddenAction[];
  redactionReport: StarkAiChatGptNextStepCandidateReviewRedactionReport;
  safeBoundaryFlags: StarkAiChatGptNextStepCandidateReviewSafeBoundaryFlags;
  validationResult: StarkAiChatGptInteractionValidationResult;
}

const DEFAULT_REPO = 'vgtj48gdzh-spec/stark-system';

const ALLOWED_REVIEWER_ACTIONS: StarkAiChatGptNextStepCandidateReviewAllowedAction[] =
  [
    'review_candidate',
    'compare_candidates',
    'request_owner_approval',
    'request_more_safe_summary',
    'draft_codex_instruction_candidate',
  ];

const FORBIDDEN_REVIEWER_ACTIONS: StarkAiChatGptNextStepCandidateReviewForbiddenAction[] =
  [
    'execute_candidate',
    'dispatch_codex',
    'create_task',
    'mutate_lifecycle',
    'read_database',
    'write_database',
    'execute_business_action',
    'contact_customer',
    'reveal_phone',
    'call_customer',
    'use_live_chatgpt_api',
    'use_mcp_gateway',
    'use_voice_integration',
    'finance_payment_work_order_mutation',
  ];

const QUESTIONS_FOR_CHATGPT = [
  'Is the recommended candidate safe to continue?',
  'Does any candidate imply execution, dispatch, task creation, lifecycle mutation, DB access, real phone access, live ChatGPT API, MCP, or voice?',
  'Should the owner approve converting one candidate into a bounded Codex instruction?',
  'Which candidate should be paused or rejected?',
  'Is this handoff still review-only / candidate-only / non-executable?',
];

const HANDOFF_SAFE_BOUNDARY_FLAGS: StarkAiChatGptNextStepCandidateReviewSafeBoundaryFlags =
  {
    repositoryWrites: 0,
    databaseReads: 0,
    databaseWrites: 0,
    businessActions: 0,
    customerContactExecutions: 0,
    dispatches: 0,
    taskCreations: 0,
    lifecycleMutations: 0,
    liveChatGptApiCalls: 0,
    mcpGatewayCalls: 0,
    voiceIntegrationCalls: 0,
    financePaymentWorkOrderMutations: 0,
  };

const HANDOFF_REDACTION_REPORT: StarkAiChatGptNextStepCandidateReviewRedactionReport =
  {
    smsContentIncluded: false,
    otpValuesIncluded: false,
    unredactedContactIdentifiersIncluded: false,
    rawDerivedContactHashIncluded: false,
    credentialMaterialIncluded: false,
    keyMaterialIncluded: false,
    certMaterialIncluded: false,
    runtimeTraceIncluded: false,
    unsafeExecutionDetailsIncluded: false,
  };

@Injectable()
export class StarkAiChatGptNextStepCandidateReviewHandoffService {
  constructor(
    private readonly selectorService: StarkAiChatGptNextStepSelectorService = new StarkAiChatGptNextStepSelectorService(),
    private readonly interactionPacketService: StarkAiChatGptInteractionPacketService = new StarkAiChatGptInteractionPacketService(),
  ) {}

  buildCandidateReviewRequestHandoff(
    input: StarkAiChatGptNextStepCandidateReviewHandoffInput = {},
  ): StarkAiChatGptNextStepCandidateReviewHandoff {
    const selectorResult = this.selectorService.buildNextStepSelector({
      ...input,
      currentStage:
        input.currentStage ??
        'S1-04.10 completed / Stark AI ChatGPT next-step selector',
      currentMode: input.currentMode ?? 'SAFE',
      latestMergedPr: input.latestMergedPr ?? 'PR #127',
      currentOpenPr: input.currentOpenPr ?? 'none',
      statusDocs: input.statusDocs ?? [
        'docs/chatgpt-sync.md',
        'docs/system-state.md',
        'docs/active-task.md',
      ],
      syncPacketSafeSummaryRefs:
        input.syncPacketSafeSummaryRefs ?? ['starkAiSyncPacketSummary'],
    });
    const generatedAt = this.resolveGeneratedAt(input.generatedAt);
    const repo = input.repo?.trim() || DEFAULT_REPO;
    const sourceSelectorSummary = this.buildSourceSelectorSummary(
      selectorResult.summary,
    );
    const payload = this.buildPayload({
      generatedAt,
      repo,
      currentStage:
        input.currentStage ??
        'S1-04.10 completed / Stark AI ChatGPT next-step selector',
      currentMode: input.currentMode ?? 'SAFE',
      sourceSelectorSummary,
      candidates: selectorResult.candidates,
      recommendedCandidateId: selectorResult.summary.recommendedCandidateId,
    });
    const validationResult = this.interactionPacketService.validateInteractionPacket(
      this.interactionPacketService.buildInteractionPacket({
        createdAt: generatedAt,
        direction: 'stark_ai_to_chatgpt',
        interactionType: 'review_request',
        reviewMode: 'codex_instruction_candidate_review',
        trustLevel: 'repository_verified',
        repo,
        latestVerifiedMainCommit: input.latestVerifiedMainCommit ?? '',
        allowedOperations: ALLOWED_REVIEWER_ACTIONS,
        forbiddenOperations: FORBIDDEN_REVIEWER_ACTIONS,
        payload,
      }),
    );

    return {
      ...payload,
      validationResult,
    };
  }

  private buildPayload(input: {
    generatedAt: string;
    repo: string;
    currentStage: string;
    currentMode: StarkAiChatGptNextStepMode;
    sourceSelectorSummary: StarkAiChatGptNextStepCandidateReviewSelectorSummary;
    candidates: StarkAiChatGptNextStepCandidate[];
    recommendedCandidateId: string;
  }): Omit<StarkAiChatGptNextStepCandidateReviewHandoff, 'validationResult'> {
    return {
      contextType: 'stark_ai_chatgpt_next_step_candidate_review_handoff',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      candidateOnly: true,
      noExecution: true,
      interactionType: 'review_request',
      generatedAt: input.generatedAt,
      repo: input.repo,
      currentStage: input.currentStage,
      currentMode: input.currentMode,
      sourceSelectorSummary: input.sourceSelectorSummary,
      candidates: input.candidates,
      recommendedCandidateId: input.recommendedCandidateId,
      questionsForChatGPT: [...QUESTIONS_FOR_CHATGPT],
      allowedReviewerActions: [...ALLOWED_REVIEWER_ACTIONS],
      forbiddenReviewerActions: [...FORBIDDEN_REVIEWER_ACTIONS],
      redactionReport: { ...HANDOFF_REDACTION_REPORT },
      safeBoundaryFlags: { ...HANDOFF_SAFE_BOUNDARY_FLAGS },
    };
  }

  private buildSourceSelectorSummary(
    summary: StarkAiChatGptNextStepSelectorSummary,
  ): StarkAiChatGptNextStepCandidateReviewSelectorSummary {
    return {
      ...summary,
      sourceChain: this.buildSourceChain(summary.sourceChain),
    };
  }

  private buildSourceChain(
    sourceChain: readonly StarkAiChatGptNextStepSelectorSource[],
  ): StarkAiChatGptNextStepCandidateReviewHandoffSource[] {
    const chain = [...sourceChain];
    if (!chain.some((source) => source.ref === 'PR #127')) {
      chain.push({
        sourceType: 'github_pr',
        ref: 'PR #127',
        status: 'merged_source',
        summary:
          'Backend-only SAFE Stark AI ChatGPT next-step selector output source.',
      });
    }
    return chain;
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
}
