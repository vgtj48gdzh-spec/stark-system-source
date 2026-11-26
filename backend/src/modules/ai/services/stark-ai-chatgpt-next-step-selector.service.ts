import { Injectable } from '@nestjs/common';

export type StarkAiChatGptNextStepMode = 'SAFE' | 'DESIGN';

export interface StarkAiChatGptNextStepCandidate {
  candidateId: string;
  title: string;
  summary: string;
  stageSuggestion: string;
  mode: StarkAiChatGptNextStepMode;
  priority: number;
  reason: string;
  recommendedScope: string;
  requiredInputs: string[];
  allowedFiles: string[];
  forbiddenScopes: string[];
  safetyBoundary: string;
  verificationPlan: string[];
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  candidateOnly: true;
  noExecution: true;
  canAutoStart: false;
  requiresOwnerApproval: true;
  canDispatchCodex: false;
  canCreateTask: false;
  canMutateLifecycle: false;
  canReadDatabase: false;
  canWriteDatabase: false;
  canExecuteBusinessAction: false;
  canUseLiveChatGptApi: false;
  canUseMcpGateway: false;
  canUseVoiceIntegration: false;
}

export interface StarkAiChatGptNextStepSelectorSource {
  sourceType:
    | 'github_pr'
    | 'status_doc'
    | 'sync_packet_safe_summary'
    | 'repo_state';
  ref: string;
  status: 'merged_source' | 'verified_status_doc_source' | 'safe_summary_source';
  summary: string;
}

export interface StarkAiChatGptNextStepSelectorZeroCounters {
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

export interface StarkAiChatGptNextStepSelectorSummary {
  contextType: 'stark_ai_chatgpt_next_step_selector_summary';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  candidateOnly: true;
  noExecution: true;
  candidateCount: number;
  safeCandidateCount: number;
  blockedCandidateCount: number;
  recommendedCandidateId: string;
  sourceChain: StarkAiChatGptNextStepSelectorSource[];
  zeroCounters: StarkAiChatGptNextStepSelectorZeroCounters;
}

export interface StarkAiChatGptNextStepSelectorResult {
  contextType: 'stark_ai_chatgpt_next_step_selector_result';
  reviewOnly: true;
  safeSummaryOnly: true;
  draftOnly: true;
  candidateOnly: true;
  noExecution: true;
  generatedAt: string;
  candidates: StarkAiChatGptNextStepCandidate[];
  summary: StarkAiChatGptNextStepSelectorSummary;
}

export interface StarkAiChatGptNextStepSelectorInput {
  generatedAt?: string | Date;
  currentStage?: string | null;
  currentMode?: StarkAiChatGptNextStepMode | null;
  latestVerifiedMainCommit?: string | null;
  latestMergedPr?: string | null;
  currentOpenPr?: string | null;
  statusDocs?: readonly string[] | null;
  syncPacketSafeSummaryRefs?: readonly string[] | null;
}

const DEFAULT_SOURCE_CHAIN: StarkAiChatGptNextStepSelectorSource[] = [
  {
    sourceType: 'github_pr',
    ref: 'PR #116',
    status: 'merged_source',
    summary: 'ChatGPT and Stark AI interaction packet validation boundary.',
  },
  {
    sourceType: 'github_pr',
    ref: 'PR #117',
    status: 'merged_source',
    summary: 'Redacted contact policy and external review boundary.',
  },
  {
    sourceType: 'github_pr',
    ref: 'PR #118',
    status: 'merged_source',
    summary: 'Backend-only policy contract helper.',
  },
  {
    sourceType: 'github_pr',
    ref: 'PR #119',
    status: 'merged_source',
    summary: 'AiService internal policy consumption summary.',
  },
  {
    sourceType: 'github_pr',
    ref: 'PR #120',
    status: 'merged_source',
    summary: 'Stark AI sync packet contact policy safe summary.',
  },
  {
    sourceType: 'github_pr',
    ref: 'PR #121',
    status: 'merged_source',
    summary: 'ChatGPT interaction handoff safe summary.',
  },
  {
    sourceType: 'github_pr',
    ref: 'PR #122',
    status: 'merged_source',
    summary: 'ChatGPT review response validator and blocked fixtures.',
  },
  {
    sourceType: 'github_pr',
    ref: 'PR #123',
    status: 'merged_source',
    summary: 'AiService review response validation consumption.',
  },
  {
    sourceType: 'github_pr',
    ref: 'PR #124',
    status: 'merged_source',
    summary: 'Sync packet review response validation summary.',
  },
  {
    sourceType: 'github_pr',
    ref: 'PR #125',
    status: 'merged_source',
    summary: 'AiService sync packet consumption self-check hardening.',
  },
  {
    sourceType: 'github_pr',
    ref: 'PR #126',
    status: 'merged_source',
    summary: 'Status document stale line cleanup.',
  },
  {
    sourceType: 'status_doc',
    ref: 'docs/chatgpt-sync.md',
    status: 'verified_status_doc_source',
    summary: 'Current short sync packet and latest next-goal wording.',
  },
  {
    sourceType: 'status_doc',
    ref: 'docs/system-state.md',
    status: 'verified_status_doc_source',
    summary: 'Current stage, mode, active module, and protected scope.',
  },
  {
    sourceType: 'status_doc',
    ref: 'docs/active-task.md',
    status: 'verified_status_doc_source',
    summary: 'Current bounded task and acceptance scope.',
  },
  {
    sourceType: 'sync_packet_safe_summary',
    ref: 'starkAiSyncPacketSummary',
    status: 'safe_summary_source',
    summary: 'Already-safe review packet summary counters and source names.',
  },
];

const DEFAULT_FORBIDDEN_SCOPES = [
  'API, controller, frontend, route, menu, or page changes',
  'migration, entity, table, DataSource initialization, or database access',
  'customer contact execution or unredacted customer contact identifiers',
  'dispatch, formal task creation, lifecycle mutation, or business execution',
  'finance, payment, or work-order mutation path',
  'live ChatGPT API, MCP gateway, or voice integration',
  'production connector payloads or sensitive credential material',
];

const DEFAULT_ZERO_COUNTERS: StarkAiChatGptNextStepSelectorZeroCounters = {
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

@Injectable()
export class StarkAiChatGptNextStepSelectorService {
  buildNextStepSelector(
    input: StarkAiChatGptNextStepSelectorInput = {},
  ): StarkAiChatGptNextStepSelectorResult {
    const candidates = this.buildCandidates(input);
    const safeCandidateCount = candidates.filter((candidate) =>
      this.isSafeCandidate(candidate),
    ).length;
    const recommendedCandidate =
      candidates.find((candidate) => this.isSafeCandidate(candidate)) ??
      candidates[candidates.length - 1];

    return {
      contextType: 'stark_ai_chatgpt_next_step_selector_result',
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      candidateOnly: true,
      noExecution: true,
      generatedAt: this.resolveGeneratedAt(input.generatedAt),
      candidates,
      summary: {
        contextType: 'stark_ai_chatgpt_next_step_selector_summary',
        reviewOnly: true,
        safeSummaryOnly: true,
        draftOnly: true,
        candidateOnly: true,
        noExecution: true,
        candidateCount: candidates.length,
        safeCandidateCount,
        blockedCandidateCount: candidates.length - safeCandidateCount,
        recommendedCandidateId: recommendedCandidate.candidateId,
        sourceChain: this.buildSourceChain(input),
        zeroCounters: { ...DEFAULT_ZERO_COUNTERS },
      },
    };
  }

  private buildCandidates(
    input: StarkAiChatGptNextStepSelectorInput,
  ): StarkAiChatGptNextStepCandidate[] {
    const stage = input.currentStage ?? 'S1-04.10';
    const mode = input.currentMode ?? 'SAFE';

    return [
      this.withSafeBoundary({
        candidateId: 'ai-review-loop-continuation',
        title: 'AI review loop continuation',
        summary:
          'Continue the ChatGPT and Stark AI review loop with one backend-only helper or self-check hardening slice.',
        stageSuggestion: `${stage} / review loop continuation`,
        mode,
        priority: 1,
        reason:
          'The latest AI mainline already has safe packet, handoff, validator, and consumption layers; the next useful step is a bounded helper candidate.',
        recommendedScope:
          'Backend-only service or self-check that strengthens review artifact summaries without creating executable work.',
        requiredInputs: [
          'GitHub latest merged PR chain PR #116 through PR #126',
          'docs/chatgpt-sync.md current snapshot',
          'docs/system-state.md protected scope',
          'docs/active-task.md next single goal',
          'starkAiSyncPacketSummary safe counters',
        ],
        allowedFiles: [
          'backend/src/modules/ai/services/*.ts',
          'backend/src/modules/ai/ai.service.ts',
          'backend/src/modules/ai/ai.module.ts',
          'backend/scripts/self-check-*.mjs',
          'backend/package.json',
          'docs/active-task.md',
          'docs/chatgpt-sync.md',
          'docs/system-state.md',
        ],
        forbiddenScopes: DEFAULT_FORBIDDEN_SCOPES,
        safetyBoundary:
          'Candidate-only review helper; no automatic start, no task creation, and no lifecycle transition.',
        verificationPlan: [
          'npm.cmd run build',
          'npm.cmd run self-check:stark-ai-chatgpt-next-step-selector',
          'npm.cmd run self-check:stark-ai-sync-packet',
          'npm.cmd run self-check:ai-service-stark-sync-packet-consumption',
          'npm.cmd run self-check:backend-runtime-preflight',
        ],
      }),
      this.withSafeBoundary({
        candidateId: 'status-docs-governance-continuation',
        title: 'Status docs governance continuation',
        summary:
          'Continue docs-only cleanup of stale status wording or compress old historical checkpoints.',
        stageSuggestion: `${stage} / docs governance continuation`,
        mode: 'DESIGN',
        priority: 2,
        reason:
          'PR #126 cleaned stale status lines; follow-up governance can keep current facts short and audit-friendly.',
        recommendedScope:
          'Docs-only status packet hygiene that preserves GitHub as the primary fact source.',
        requiredInputs: [
          'GitHub main and open PR state',
          'docs/chatgpt-sync.md',
          'docs/system-state.md',
          'docs/active-task.md',
        ],
        allowedFiles: [
          'docs/active-task.md',
          'docs/chatgpt-sync.md',
          'docs/system-state.md',
        ],
        forbiddenScopes: DEFAULT_FORBIDDEN_SCOPES,
        safetyBoundary:
          'Documentation-only candidate; it cannot alter code, runtime behavior, or business state.',
        verificationPlan: ['git diff --check', 'git diff --name-only'],
      }),
      this.withSafeBoundary({
        candidateId: 'finance-safe-summary-protection',
        title: 'Finance-safe summary protection',
        summary:
          'Strengthen the finance safe-summary read-only adapter protection net with synthetic review checks.',
        stageSuggestion: `${stage} / finance safe summary protection`,
        mode,
        priority: 3,
        reason:
          'The finance read-only adapter chain is a high-value protected surface for Stark AI summaries.',
        recommendedScope:
          'Backend-only synthetic self-check around already-safe finance summary envelopes and blocked mutation categories.',
        requiredInputs: [
          'finance safe-summary adapter contract',
          'Stark AI database safe-summary provider contract',
          'current sync packet safe summary counters',
        ],
        allowedFiles: [
          'backend/src/modules/ai/services/stark-ai-finance-safe-summary-source-mapper.service.ts',
          'backend/src/modules/ai/services/stark-ai-finance-readonly-safe-summary-adapter.service.ts',
          'backend/src/modules/ai/services/stark-ai-database-safe-summary-provider.service.ts',
          'backend/scripts/self-check-stark-ai-finance-*.mjs',
          'backend/package.json',
          'docs/active-task.md',
          'docs/chatgpt-sync.md',
          'docs/system-state.md',
        ],
        forbiddenScopes: DEFAULT_FORBIDDEN_SCOPES,
        safetyBoundary:
          'Read-only safe-summary candidate only; no finance confirmation, payment action, or work-order mutation.',
        verificationPlan: [
          'npm.cmd run build',
          'npm.cmd run self-check:stark-ai-finance-safe-summary-source-mapper',
          'npm.cmd run self-check:stark-ai-finance-readonly-safe-summary-adapter',
          'npm.cmd run self-check:stark-ai-sync-packet',
        ],
      }),
      this.withSafeBoundary({
        candidateId: 'mobile-bridge-operational-diagnostics',
        title: 'Mobile bridge operational diagnostics',
        summary:
          'Summarize mobile bridge upload-link and carrier-state facts as operations diagnostics only.',
        stageSuggestion: `${stage} / mobile diagnostics continuation`,
        mode,
        priority: 4,
        reason:
          'Mobile bridge diagnostics are useful operational facts but must stay separate from finance confirmation.',
        recommendedScope:
          'Backend-only or docs-only diagnostic summary guard that reports already-redacted operational states.',
        requiredInputs: [
          'mobile bridge diagnostics protected boundary',
          'latest mobile bridge merged PR context',
          'current status docs protected scope',
        ],
        allowedFiles: [
          'backend/src/modules/mobile-bridge/**/*.ts',
          'backend/scripts/self-check-mobile-bridge-*.mjs',
          'docs/active-task.md',
          'docs/chatgpt-sync.md',
          'docs/system-state.md',
        ],
        forbiddenScopes: DEFAULT_FORBIDDEN_SCOPES,
        safetyBoundary:
          'Operational diagnostics only; no bank message confirmation and no finance lifecycle effect.',
        verificationPlan: [
          'npm.cmd run build',
          'npm.cmd run self-check:mobile-bridge-carrier-unavailable',
          'npm.cmd run self-check:mobile-bridge-pending-queue-drain',
        ],
      }),
      this.withSafeBoundary({
        candidateId: 'pause-no-op-candidate',
        title: 'Pause / no-op candidate',
        summary:
          'Pause instead of opening a new implementation slice when no bounded SAFE candidate is approved.',
        stageSuggestion: `${stage} / pause for owner decision`,
        mode: 'DESIGN',
        priority: 5,
        reason:
          'A safe selector must be able to recommend waiting rather than converting suggestions into work.',
        recommendedScope:
          'No file change and no PR until the owner approves one candidate explicitly.',
        requiredInputs: [
          'owner decision',
          'GitHub open PR state',
          'current status docs',
        ],
        allowedFiles: ['no files - pause candidate only'],
        forbiddenScopes: DEFAULT_FORBIDDEN_SCOPES,
        safetyBoundary:
          'No-op candidate; it exists only to prevent automatic continuation.',
        verificationPlan: ['No repository change; report no-op decision only.'],
      }),
    ];
  }

  private withSafeBoundary(
    candidate: Omit<
      StarkAiChatGptNextStepCandidate,
      | 'reviewOnly'
      | 'safeSummaryOnly'
      | 'draftOnly'
      | 'candidateOnly'
      | 'noExecution'
      | 'canAutoStart'
      | 'requiresOwnerApproval'
      | 'canDispatchCodex'
      | 'canCreateTask'
      | 'canMutateLifecycle'
      | 'canReadDatabase'
      | 'canWriteDatabase'
      | 'canExecuteBusinessAction'
      | 'canUseLiveChatGptApi'
      | 'canUseMcpGateway'
      | 'canUseVoiceIntegration'
    >,
  ): StarkAiChatGptNextStepCandidate {
    return {
      ...candidate,
      reviewOnly: true,
      safeSummaryOnly: true,
      draftOnly: true,
      candidateOnly: true,
      noExecution: true,
      canAutoStart: false,
      requiresOwnerApproval: true,
      canDispatchCodex: false,
      canCreateTask: false,
      canMutateLifecycle: false,
      canReadDatabase: false,
      canWriteDatabase: false,
      canExecuteBusinessAction: false,
      canUseLiveChatGptApi: false,
      canUseMcpGateway: false,
      canUseVoiceIntegration: false,
    };
  }

  private buildSourceChain(
    input: StarkAiChatGptNextStepSelectorInput,
  ): StarkAiChatGptNextStepSelectorSource[] {
    const statusDocs = new Set(input.statusDocs ?? []);
    const syncPacketSafeSummaryRefs = new Set(
      input.syncPacketSafeSummaryRefs ?? [],
    );

    return DEFAULT_SOURCE_CHAIN.filter((source) => {
      if (source.sourceType === 'status_doc' && statusDocs.size > 0) {
        return statusDocs.has(source.ref);
      }
      if (
        source.sourceType === 'sync_packet_safe_summary' &&
        syncPacketSafeSummaryRefs.size > 0
      ) {
        return syncPacketSafeSummaryRefs.has(source.ref);
      }
      return true;
    });
  }

  private isSafeCandidate(candidate: StarkAiChatGptNextStepCandidate): boolean {
    return (
      candidate.reviewOnly === true &&
      candidate.safeSummaryOnly === true &&
      candidate.draftOnly === true &&
      candidate.candidateOnly === true &&
      candidate.noExecution === true &&
      candidate.canAutoStart === false &&
      candidate.requiresOwnerApproval === true &&
      candidate.canDispatchCodex === false &&
      candidate.canCreateTask === false &&
      candidate.canMutateLifecycle === false &&
      candidate.canReadDatabase === false &&
      candidate.canWriteDatabase === false &&
      candidate.canExecuteBusinessAction === false &&
      candidate.canUseLiveChatGptApi === false &&
      candidate.canUseMcpGateway === false &&
      candidate.canUseVoiceIntegration === false &&
      candidate.allowedFiles !== undefined &&
      candidate.forbiddenScopes.length > 0
    );
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
