import { createHash } from 'crypto';
import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  PaginationResult,
  buildPaginationResult,
} from '../../common/utils/pagination.util';
import { ApprovalRequestsService } from '../approval-requests/approval-requests.service';
import { BusinessStatTag } from '../business-stats/entities/business-stat-tag.entity';
import { RewardEvent } from '../business-stats/entities/reward-event.entity';
import { BusinessStatsService } from '../business-stats/business-stats.service';
import { QueryBusinessStatSummariesDto } from '../business-stats/dto/query-business-stat-summaries.dto';
import { QueryBusinessStatSummaryDetailDto } from '../business-stats/dto/query-business-stat-summary-detail.dto';
import { QueryStatPendingItemsDto } from '../business-stats/dto/query-stat-pending-items.dto';
import { PaymentRecordsService } from '../payment-records/payment-records.service';
import { PerformanceEvent } from '../performance/entities/performance-event.entity';
import { ExternalCardSalesStaging } from '../performance/entities/external-card-sales-staging.entity';
import { Employee } from '../performance/entities/employee.entity';
import { PerformanceSummaryManualDecision } from '../performance/entities/performance-summary-manual-decision.entity';
import { QueryPendingPerformanceItemsDto } from '../performance/dto/query-pending-performance-items.dto';
import { QueryPerformanceSummaryDetailDto } from '../performance/dto/query-performance-summary-detail.dto';
import { QueryPerformanceSummariesDto } from '../performance/dto/query-performance-summaries.dto';
import { PerformanceService } from '../performance/performance.service';
import { PointsService } from '../points/points.service';
import { AbcPointsCommandRequest } from '../points/entities/abc-points-command-request.entity';
import { PointsCommandBatch } from '../points/entities/points-command-batch.entity';
import { PointsCommandRequest } from '../points/entities/points-command-request.entity';
import { PointsLedgerEntry } from '../points/entities/points-ledger-entry.entity';
import { PointsRedeemable } from '../points/entities/points-redeemable.entity';
import { PointsRedemptionRequest } from '../points/entities/points-redemption-request.entity';
import { PointsWelfareBatchItem } from '../points/entities/points-welfare-batch-item.entity';
import { OperationLog } from '../operation-logs/entities/operation-log.entity';
import { AiAssistantReplyDto } from './dto/ai-assistant-reply.dto';
import { CreateAiMemoryEntryDto } from './dto/create-ai-memory-entry.dto';
import { QueryAiConsoleOverviewDto } from './dto/query-ai-console-overview.dto';
import { MarkAiActionStateDto } from './dto/mark-ai-action-state.dto';
import { QueryAiMemoryEntriesDto } from './dto/query-ai-memory-entries.dto';
import { QueryAiNextActionsDto } from './dto/query-ai-next-actions.dto';
import { QueryAiOwnerMemoryProjectionDto } from './dto/query-ai-owner-memory-projection.dto';
import { QueryAiPageContextDto } from './dto/query-ai-page-context.dto';
import { QueryAiSummaryContextDto } from './dto/query-ai-summary-context.dto';
import { ToggleAiMemoryEntryDto } from './dto/toggle-ai-memory-entry.dto';
import { UpdateAiMemoryEntryDto } from './dto/update-ai-memory-entry.dto';
import { AiActionState } from './entities/ai-action-state.entity';
import { AiAssistantInteraction } from './entities/ai-assistant-interaction.entity';
import { AiKnowledgeEntry } from './entities/ai-knowledge-entry.entity';
import { AiMemoryEntry } from './entities/ai-memory-entry.entity';
import {
  AiReadableOperationLogContextService,
  type AiReadableOperationLogContextBundle,
  type AiReadableOperationLogLike,
} from './services/ai-readable-operation-log-context.service';
import {
  AiActionPermissionMatrixService,
  type AiActionPermissionMatrixResult,
  type AiActionPermissionLevel,
} from './services/ai-action-permission-matrix.service';
import {
  AiTaskDraftOrchestrationService,
  type AiTaskDraftReviewArtifact,
} from './services/ai-task-draft-orchestration.service';
import {
  AiTaskDraftReviewArtifactReadAuditService,
  type AiTaskDraftReviewArtifactReadAuditView,
} from './services/ai-task-draft-review-artifact-read-audit.service';
import {
  AiManualTaskBridgeCandidateService,
  type AiManualTaskBridgeCandidate,
} from './services/ai-manual-task-bridge-candidate.service';
import {
  AiManualTaskBridgeDispatchReadinessService,
  type AiManualTaskBridgeDispatchReadiness,
  type AiManualTaskBridgeDispatchReadinessSummary,
} from './services/ai-manual-task-bridge-dispatch-readiness.service';
import {
  AiManualTaskBridgeEmployeeHandoffPreviewService,
  type AiManualTaskBridgeEmployeeHandoffPreview,
  type AiManualTaskBridgeEmployeeHandoffPreviewSummary,
} from './services/ai-manual-task-bridge-employee-handoff-preview.service';
import { AiOwnerMemoryProjectionService } from './services/ai-owner-memory-projection.service';
import {
  StarkAiDatabaseSafeSummaryProviderService,
  type StarkAiDatabaseSafeSummaryEnvelope,
  type StarkAiDatabaseSafeSummaryProviderInput,
  type StarkAiDatabaseSafeSummaryType,
} from './services/stark-ai-database-safe-summary-provider.service';
import {
  StarkAiFinanceSafeSummarySourceMapperService,
  type StarkAiFinanceSafeSummarySourceRow,
} from './services/stark-ai-finance-safe-summary-source-mapper.service';
import {
  StarkAiFinanceReadonlySafeSummaryAdapterService,
  type StarkAiFinanceReadonlySafeSummaryAdapterResult,
  type StarkAiFinanceReadonlySafeSummaryReader,
} from './services/stark-ai-finance-readonly-safe-summary-adapter.service';
import {
  StarkAiSyncPacketService,
  type StarkAiSyncPacket,
} from './services/stark-ai-sync-packet.service';
import {
  AiContactPhonePolicyConsumptionService,
  type AiContactPhonePolicyConsumption,
  type AiContactPhonePolicyConsumptionInput,
  type AiContactPhonePolicyContextFragment,
} from './services/ai-contact-phone-policy-consumption.service';
import {
  AiChatGptContactPhoneReviewResponseConsumptionService,
  type AiChatGptContactPhoneReviewResponseConsumption,
  type AiChatGptContactPhoneReviewResponseConsumptionArtifact,
  type AiChatGptContactPhoneReviewResponseConsumptionSummary,
} from './services/ai-chatgpt-contact-phone-review-response-consumption.service';
import {
  StarkAiChatGptNextStepSelectorService,
  type StarkAiChatGptNextStepCandidate,
  type StarkAiChatGptNextStepSelectorResult,
  type StarkAiChatGptNextStepSelectorSummary,
} from './services/stark-ai-chatgpt-next-step-selector.service';
import {
  READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE,
  ReadOnlySafeQueryStatusAdapterService,
} from './services/read-only-safe-query-status-adapter.service';
import {
  type ReadOnlySafeQueryRequest,
  type ReadOnlySafeQueryResult,
} from './contracts/read-only-safe-query-gateway.contract';

export type AiNextActionTaskType =
  | 'customer_binding_task'
  | 'data_cleanup_task'
  | 'sheet_repair_task'
  | 'performance_confirmation_task'
  | 'redemption_reconciliation_task'
  | 'abc_score_command_blocked_task';

export type AiActionOwnerRole =
  | 'founder'
  | 'finance'
  | 'admin'
  | 'approver'
  | 'operator'
  | 'store_manager'
  | 'customer_service';

export type AiActionDueLevel =
  | 'must_handle_today'
  | 'should_handle_this_week'
  | 'can_defer';

export type AiActionImpactType =
  | 'payroll_blocking'
  | 'data_accuracy'
  | 'customer_binding'
  | 'financial_reconciliation'
  | 'bcard_reconciliation'
  | 'performance_confirmation'
  | 'audit_cleanup';

export type AiTimeBucket =
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'future'
  | 'backlog_history'
  | 'custom_range';

export type AiPeriodMode = 'week' | 'month';

export type AiActionProcessingStatus =
  | 'active'
  | 'in_progress'
  | 'deferred'
  | 'waiting_review'
  | 'done'
  | 'ignored';

export type AiAssistantQuestionType =
  | 'why_blocked'
  | 'what_to_do'
  | 'can_affect_payroll'
  | 'same_or_special_case'
  | 'what_missing'
  | 'draft_action'
  | 'explain_rule';

type AiAssistantConfidenceLevel = 'high' | 'medium' | 'low';

interface AiKnowledgeReference {
  id: number;
  knowledgeType: string;
  scopeType: string;
  scopeKey: string | null;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  sourceType: string | null;
  aiLearningMode: string | null;
}

interface AiMemoryReference {
  id: number;
  memoryType: string;
  scopeType: string;
  scopeKey: string | null;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  priorityLevel: number;
  sourceType: string | null;
  generalizationMode: string | null;
  aiUsageMode: string | null;
  memoryBucket: 'founder' | 'role';
}

interface AiManualDecisionReference {
  id: number;
  sourceSummaryId: number;
  actionType: string;
  reasonCode: string | null;
  decisionScope: string | null;
  judgmentBasis: string[];
  aiLearningMode: string | null;
  finalClassification: string | null;
  finalBindingStatus: string | null;
  operatorName: string | null;
  operatedAt: string;
  matchType: 'direct' | 'similar_pattern';
  summary: string;
}

interface AiAssistantAnswerSection {
  sectionKey: string;
  title: string;
  content: string;
}

interface AiTaskSourceRecord {
  source: string;
  record: Record<string, unknown>;
  amountField: string;
  timeAnchorType?: string | null;
}

interface AiPointsWelfareEmployeePreview {
  employeeId: number;
  employeeName: string;
  employeeMobile: string | null;
  companyName: string | null;
  positionName: string | null;
  enabledFlag: boolean;
  suggestedAmount: string;
  reasonSummary: string;
}

interface AiPointsWelfareExcludedEmployeePreview
  extends AiPointsWelfareEmployeePreview {
  exclusionReason: string;
  exclusionDetail: string | null;
}

interface AiTaskAggregate {
  taskType: AiNextActionTaskType;
  relatedCount: number;
  relatedAmount: string | null;
  timeBucket: AiTimeBucket;
  bucketLabel: string;
  timeAnchorType: string | null;
  timeAnchorDate: string | null;
  sourceBreakdown: Array<{
    source: string;
    count: number;
    amount: string | null;
  }>;
}

interface AiCalculationContext {
  anchorNow: Date;
  generatedAt: string;
  periodMode: AiPeriodMode;
  requestedTimeBucket: AiTimeBucket | null;
  periodLabel: string;
  calculationFingerprint: string;
}

interface AiActionTemplate {
  ownerRole: AiActionOwnerRole;
  impactType: AiActionImpactType;
  impactTags: AiActionImpactType[];
  dueLevel: AiActionDueLevel;
  directTargetType: string;
  relatedPagePath: string;
  relatedPageQuery: Record<string, string | number | undefined>;
  suggestedFilterLabel: string;
  deadlineOffsetDays: number;
  actionTitle: string;
  actionSummary: (aggregate: AiTaskAggregate, periodLabel: string) => string;
  whyNow: (aggregate: AiTaskAggregate, periodLabel: string) => string;
  suggestedAction: (aggregate: AiTaskAggregate, periodLabel: string) => string;
  blockers: (aggregate: AiTaskAggregate) => string[];
  nextStepAfterDone: (aggregate: AiTaskAggregate) => string;
}

export interface AiActionItem {
  actionId: string;
  ownerRole: AiActionOwnerRole;
  ownerRoleLabel: string;
  taskType: AiNextActionTaskType;
  actionTitle: string;
  actionSummary: string;
  whyNow: string;
  impactType: AiActionImpactType;
  impactTags: AiActionImpactType[];
  relatedCount: number;
  relatedAmount: string | null;
  dueLevel: AiActionDueLevel;
  suggestedAction: string;
  directTargetType: string;
  relatedPagePath: string;
  relatedPageQuery: Record<string, string | number | undefined>;
  suggestedFilterLabel: string;
  deadline: string;
  timeBucket: AiTimeBucket;
  bucketLabel: string;
  timeAnchorType: string | null;
  timeAnchorDate: string | null;
  processingStatus: AiActionProcessingStatus;
  deferUntil: string | null;
  deferReason: string | null;
  markedBy: number | null;
  markedByName: string | null;
  markedAt: string | null;
  reopenAt: string | null;
  statusRemark: string | null;
  shouldReopen: boolean;
  blockers: string[];
  nextStepAfterDone: string;
  sourceBreakdown: Array<{
    source: string;
    count: number;
    amount: string | null;
  }>;
}

interface AiNextActionsResponse {
  generatedAt: string;
  calculationAnchorAt: string;
  calculationFingerprint: string;
  filtersApplied: {
    role: AiActionOwnerRole | null;
    dueLevel: AiActionDueLevel | null;
    onlyBlocking: boolean;
    includeDone: boolean;
    includeDeferred: boolean;
    backlogOnly: boolean;
    timeBucket: AiTimeBucket | null;
    periodMode: AiPeriodMode;
    dateFrom: string | null;
    dateTo: string | null;
    periodKey: string | null;
  };
  stagingWindow: {
    periodStart: string;
    periodEnd: string;
    recordCount: number;
    latestImportBatchNo: string | null;
    latestImportedAt: string | null;
  };
  mustHandleToday: AiActionItem[];
  recommended: AiActionItem[];
  canDefer: AiActionItem[];
  actionItems: AiActionItem[];
}

type AiConsoleScene =
  | 'global'
  | 'customer_binding'
  | 'sheet_repair'
  | 'performance_confirmation'
  | 'data_cleanup';

type AiConsoleChannel =
  | 'web_console'
  | 'management_command'
  | 'mobile_assistant'
  | 'finance_review';

interface AiProviderProfile {
  providerKey: string;
  providerType: string;
  displayName: string;
  roleScope: AiActionOwnerRole[];
  channelScope: AiConsoleChannel[];
  capabilitySet: string[];
  enabledFlag: boolean;
  fallbackOrder: number;
}

interface AiConsoleSummaryCard {
  key: string;
  title: string;
  value: string;
  subtitle: string;
}

interface AiConsoleRiskCard {
  key: string;
  title: string;
  summary: string;
  dueLevel: AiActionDueLevel;
  impactType: AiActionImpactType;
  relatedPagePath: string;
  relatedPageQuery: Record<string, string | number | undefined>;
}

interface AiConsoleFocusObject {
  summaryType: 'performance' | 'business_stats';
  summaryId: number;
  title: string;
  subtitle: string;
  blocker: string;
  relatedPagePath: string;
  relatedPageQuery: Record<string, string | number | undefined>;
}

interface AiConsoleRecentDecision {
  id: number;
  sourceSummaryId: number;
  actionType: string;
  operatorName: string | null;
  operatedAt: string;
  reasonCode: string | null;
  decisionScope: string | null;
  judgmentBasis: string[];
  aiLearningMode: string | null;
  finalClassification: string | null;
  finalBindingStatus: string | null;
  affectPerformanceFlag: boolean;
  affectBCardFlag: boolean;
  remark: string;
}

interface AiConsoleRecentBlocker {
  key: string;
  summaryType: 'performance' | 'business_stats';
  summaryId: number;
  title: string;
  blockerReason: string;
  updatedAt: string | null;
  relatedPagePath: string;
  relatedPageQuery: Record<string, string | number | undefined>;
}

interface AiConsoleOverviewResponse {
  generatedAt: string;
  calculationAnchorAt: string;
  calculationFingerprint: string;
  role: AiActionOwnerRole;
  scene: AiConsoleScene;
  channel: AiConsoleChannel;
  provider: AiProviderProfile;
  providerOptions: AiProviderProfile[];
  filtersApplied: AiNextActionsResponse['filtersApplied'];
  summaryCards: AiConsoleSummaryCard[];
  riskCards: AiConsoleRiskCard[];
  currentFocus: AiConsoleFocusObject | null;
  nextActions: AiNextActionsResponse;
  recentDecisions: AiConsoleRecentDecision[];
  recentBlockers: AiConsoleRecentBlocker[];
  recentActionStates: Array<{
    id: number;
    actionId: string;
    taskType: string;
    ownerRole: string;
    processingStatus: string;
    timeBucket: string | null;
    markedByName: string | null;
    markedAt: string;
    deferUntil: string | null;
    reopenAt: string | null;
    statusRemark: string | null;
  }>;
}

interface AiSummaryContextResponse {
  generatedAt: string;
  summaryType: 'performance' | 'business_stats';
  basicInfo: Record<string, unknown>;
  customerIdentity: Record<string, unknown>;
  paymentAndReconciliation: Record<string, unknown>;
  productAndBundle: Record<string, unknown>;
  pointsSummary: Record<string, unknown> | null;
  manualDecision: Record<string, unknown> | null;
  blockers: string[];
  suggestedNextStep: string;
  relatedRecordsPreview: unknown[];
}

interface AiPointsCommandContextResponse {
  generatedAt: string;
  provider: AiProviderProfile;
  commandId: number;
  basicInfo: Record<string, unknown>;
  ownerInfo: Record<string, unknown>;
  sourceInfo: Record<string, unknown>;
  statusInfo: Record<string, unknown>;
  approvalInfo: Record<string, unknown>;
  ledgerImpact: Record<string, unknown>;
  commandOrigin: Record<string, unknown>;
  blockers: string[];
  founderMemories: AiMemoryReference[];
  roleMemories: AiMemoryReference[];
  citedKnowledge: AiKnowledgeReference[];
  citedManualDecisions: AiManualDecisionReference[];
  suggestedQuestions: string[];
  suggestedActions: Array<Record<string, unknown>>;
  whyNow: string;
  nextStepAfterDone: string;
  commandExplanation: string;
  answerSections: AiAssistantAnswerSection[];
  confidenceLevel: AiAssistantConfidenceLevel;
  memoryInfluenceSummary: string;
  founderPrinciplesApplied: string[];
  rolePlaybookApplied: string[];
  generalizationBoundary: string;
  handlingPlan: Record<string, unknown> | null;
  relatedLedgerEntries: Array<Record<string, unknown>>;
  executionTrace: Record<string, unknown>;
}

interface AiPointsRedemptionContextResponse {
  generatedAt: string;
  provider: AiProviderProfile;
  redemptionId: number;
  basicInfo: Record<string, unknown>;
  ownerInfo: Record<string, unknown>;
  sourceInfo: Record<string, unknown>;
  statusInfo: Record<string, unknown>;
  approvalInfo: Record<string, unknown>;
  ledgerImpact: Record<string, unknown>;
  commandOrigin: Record<string, unknown>;
  blockers: string[];
  founderMemories: AiMemoryReference[];
  roleMemories: AiMemoryReference[];
  citedKnowledge: AiKnowledgeReference[];
  citedManualDecisions: AiManualDecisionReference[];
  suggestedQuestions: string[];
  suggestedActions: Array<Record<string, unknown>>;
  whyNow: string;
  nextStepAfterDone: string;
  commandExplanation: string;
  answerSections: AiAssistantAnswerSection[];
  confidenceLevel: AiAssistantConfidenceLevel;
  memoryInfluenceSummary: string;
  founderPrinciplesApplied: string[];
  rolePlaybookApplied: string[];
  generalizationBoundary: string;
  relatedLedgerEntries: Array<Record<string, unknown>>;
  reconciliationStatus: string | null;
  reconciliationReason: string | null;
  consumeLedgerEntry: Record<string, unknown> | null;
  matchedAbcShadowRecord: Record<string, unknown> | null;
  abcFulfillmentSummary: Record<string, unknown> | null;
  exceptionFlags: string[];
  suggestedAction: string | null;
  auditTrail: Array<Record<string, unknown>>;
  executionTrace: Record<string, unknown>;
}

interface AiTaskContextResponse {
  generatedAt: string;
  actionId: string;
  role: AiActionOwnerRole;
  scene: AiConsoleScene;
  channel: AiConsoleChannel;
  provider: AiProviderProfile;
  taskType: AiNextActionTaskType;
  ownerRole: AiActionOwnerRole;
  ownerRoleLabel: string;
  actionTitle: string;
  actionSummary: string;
  whyNow: string;
  relatedCount: number;
  relatedAmount: string | null;
  impactType: AiActionImpactType;
  blockers: string[];
  suggestedAction: string;
  suggestedFilterLabel: string;
  nextStepAfterDone: string;
  directTargetType: string;
  relatedPagePath: string;
  relatedPageQuery: Record<string, string | number | undefined>;
  timeBucket: AiTimeBucket;
  bucketLabel: string;
  timeAnchorType: string | null;
  timeAnchorDate: string | null;
  processingStatus: AiActionProcessingStatus;
  deferUntil: string | null;
  deferReason: string | null;
  markedByName: string | null;
  markedAt: string | null;
  reopenAt: string | null;
  statusRemark: string | null;
  shouldReopen: boolean;
  sourceBreakdown: AiActionItem['sourceBreakdown'];
}

interface AiAssistantFilterSummary {
  periodKey: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  filters: Record<string, unknown>;
  sourceActionId: string | null;
}

interface AiAssistantFocusObject {
  entityType: string | null;
  entityId: string | null;
  label: string;
  subtitle: string;
  sourceTable: string | null;
  sourceId: string | null;
  summaryType: 'performance' | 'business_stats' | null;
  keyFacts: Array<{ label: string; value: string }>;
  rawContext: Record<string, unknown> | null;
}

interface AiAssistantInteractionRecord {
  id: number;
  threadKey: string;
  routePath: string;
  entityType: string | null;
  entityId: string | null;
  roleCode: string | null;
  sourceActionId: string | null;
  userMessage: string;
  assistantReply: string;
  suggestedActions: Array<Record<string, unknown>>;
  suggestedCommandDraft: Record<string, unknown> | null;
  providerKey: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  questionType: AiAssistantQuestionType | null;
  answerSections: AiAssistantAnswerSection[];
  citedKnowledge: AiKnowledgeReference[];
  citedManualDecisions: AiManualDecisionReference[];
  citedMemories: AiMemoryReference[];
  memoryInfluenceSummary: string;
  founderPrinciplesApplied: string[];
  rolePlaybookApplied: string[];
  generalizationBoundary: string;
  confidenceLevel: AiAssistantConfidenceLevel | null;
  missingContext: string[];
  handlingPlan: Record<string, unknown> | null;
}

interface AiPageContextResponse {
  generatedAt: string;
  provider: AiProviderProfile;
  threadKey: string;
  rewardDomain: string | null;
  sourceOfTruth: string | null;
  pageInfo: {
    routePath: string;
    pageLabel: string;
    sourceActionId: string | null;
    pageEntityType: string | null;
    pageEntityId: string | null;
  };
  roleInfo: {
    role: AiActionOwnerRole;
    roleLabel: string;
    scene: AiConsoleScene;
    channel: AiConsoleChannel;
  };
  filterSummary: AiAssistantFilterSummary;
  focusObject: AiAssistantFocusObject | null;
  blockers: string[];
  evidenceSummary: string[];
  pointsSummary: Record<string, unknown> | null;
  manualDecisionSummary: Record<string, unknown> | null;
  citedMemories: AiMemoryReference[];
  founderMemories: AiMemoryReference[];
  roleMemories: AiMemoryReference[];
  knowledgeHints: AiKnowledgeReference[];
  manualDecisionMatches: AiManualDecisionReference[];
  memoryInfluenceSummary: string;
  founderPrinciplesApplied: string[];
  rolePlaybookApplied: string[];
  generalizationBoundary: string;
  handlingPlan: Record<string, unknown> | null;
  taskStateSummary: Record<string, unknown> | null;
  suggestedQuestions: string[];
  suggestedActions: Array<Record<string, unknown>>;
  interactionHistory: AiAssistantInteractionRecord[];
}

interface AiAssistantReplyResponse {
  generatedAt: string;
  providerKey: string | null;
  threadKey: string;
  rewardDomain: string | null;
  sourceOfTruth: string | null;
  replyType: 'analysis' | 'guidance';
  questionType: AiAssistantQuestionType;
  confidence: number;
  confidenceLevel: AiAssistantConfidenceLevel;
  assistantReply: string;
  answerSections: AiAssistantAnswerSection[];
  citedContextBlocks: string[];
  citedKnowledge: AiKnowledgeReference[];
  citedManualDecisions: AiManualDecisionReference[];
  citedMemories: AiMemoryReference[];
  memoryInfluenceSummary: string;
  founderPrinciplesApplied: string[];
  rolePlaybookApplied: string[];
  generalizationBoundary: string;
  missingContext: string[];
  suggestedActions: Array<Record<string, unknown>>;
  suggestedCommandDraft: Record<string, unknown> | null;
  suggestedActionsPolicyTrace: Array<Record<string, unknown>>;
  blockedSuggestedActions: Array<Record<string, unknown>>;
  suggestedCommandDraftPolicy: Record<string, unknown> | null;
  boundaryExplanations: Array<Record<string, unknown>>;
  taskDraftReviewArtifacts: AiTaskDraftReviewArtifact[];
  taskDraftReviewArtifactSummary: Record<string, unknown>;
  taskDraftReviewPolicyTrace: Array<Record<string, unknown>>;
  taskDraftReviewReadAuditViews: AiTaskDraftReviewArtifactReadAuditView[];
  taskDraftReviewReadAuditSummary: Record<string, unknown>;
  manualTaskBridgeCandidates: AiManualTaskBridgeCandidate[];
  manualTaskBridgeCandidateSummary: Record<string, unknown>;
  manualTaskBridgeDispatchReadiness: AiManualTaskBridgeDispatchReadiness[];
  manualTaskBridgeDispatchReadinessSummary: AiManualTaskBridgeDispatchReadinessSummary;
  manualTaskBridgeEmployeeHandoffPreviews: AiManualTaskBridgeEmployeeHandoffPreview[];
  manualTaskBridgeEmployeeHandoffPreviewSummary: AiManualTaskBridgeEmployeeHandoffPreviewSummary;
  contactPhonePolicyContexts: AiContactPhonePolicyContextFragment[];
  contactPhonePolicySummary: Record<string, unknown>;
  chatGptContactPhoneReviewResponseValidationArtifacts: AiChatGptContactPhoneReviewResponseConsumptionArtifact[];
  chatGptContactPhoneReviewResponseValidationSummary: AiChatGptContactPhoneReviewResponseConsumptionSummary;
  starkAiChatGptNextStepCandidates: StarkAiChatGptNextStepCandidate[];
  starkAiChatGptNextStepSelectorSummary: StarkAiChatGptNextStepSelectorSummary;
  readOnlySafeQueryStatusSummary: ReadOnlySafeQueryResult;
  readOnlySafeQueryStatusSummaryResult: ReadOnlySafeQueryResult;
  readOnlySafeQueryStatusSummarySource: Record<string, unknown>;
  databaseSafeSummaryBatch: StarkAiDatabaseSafeSummaryEnvelope[];
  databaseSafeSummarySummary: Record<string, unknown>;
  starkAiSyncPacketJson: StarkAiSyncPacket;
  starkAiSyncPacketMarkdown: string;
  starkAiSyncPacketSummary: Record<string, unknown>;
  shouldEscalateToHumanReview: boolean;
  handlingPlan: Record<string, unknown> | null;
  interactionRecord: AiAssistantInteractionRecord;
}

interface AiOperationLogContextBundleSourceRule {
  module: string;
  actions?: readonly string[];
  eventTypes?: readonly string[];
}

interface AiOperationLogContextBundleSummary {
  riskSummaries: string[];
  blockedActions: string[];
  missingEvidence: string[];
  suggestedNextSteps: string[];
  forbiddenActions: string[];
}

interface AiOperationLogContextBundleConsumption {
  operationLogContextBundles: AiReadableOperationLogContextBundle[];
  operationLogContextBundleSummary: AiOperationLogContextBundleSummary;
}

interface AiSuggestedActionPolicyContext {
  currentUserRoleCodes?: readonly string[] | null;
  source?: string | null;
  operationLogContextBundles?: readonly AiReadableOperationLogContextBundle[] | null;
}

interface AiSuggestedActionPolicyCandidate {
  candidateId: string;
  source: string;
  sourceModule: string | null;
  sourceEntityType: string | null;
  eventType: string | null;
  riskLevel: string | null;
  proposedAssistantActionCode: string;
  proposedAssistantSurface: string;
  proposedDraftType: string | null;
  touchesMoney: boolean;
  touchesWorkOrderStatus: boolean;
  touchesCustomerRights: boolean;
  touchesPayroll: boolean;
  touchesBenefits: boolean;
  touchesVirtualLedger: boolean;
  createsBusinessObject: boolean;
  mutatesBusinessState: boolean;
  usesProductionConnector: boolean;
  sourceBundleIds: string[];
  targetEntityType: string | null;
  targetEntityId: string | number | null;
  currentStatus: string | null;
  missingEvidence: string[];
  suggestedNextSteps: string[];
  forbiddenActions: string[];
  currentUserRoleCodes: string[];
  reason: string | null;
}

interface AiSuggestedActionPolicyEvaluation {
  candidate: AiSuggestedActionPolicyCandidate;
  policy: AiActionPermissionMatrixResult;
}

interface AiSuggestedActionPolicyApplication {
  allowedSuggestedActions: Array<Record<string, unknown>>;
  blockedSuggestedActions: Array<Record<string, unknown>>;
  boundaryExplanations: Array<Record<string, unknown>>;
  suggestedActionsPolicyTrace: Array<Record<string, unknown>>;
  suggestedCommandDraftPolicy: Record<string, unknown> | null;
  suggestedCommandDraft: Record<string, unknown> | null;
  taskDraftReviewArtifacts: AiTaskDraftReviewArtifact[];
  taskDraftReviewArtifactSummary: Record<string, unknown>;
  taskDraftReviewPolicyTrace: Array<Record<string, unknown>>;
  taskDraftReviewReadAuditViews: AiTaskDraftReviewArtifactReadAuditView[];
  taskDraftReviewReadAuditSummary: Record<string, unknown>;
  manualTaskBridgeCandidates: AiManualTaskBridgeCandidate[];
  manualTaskBridgeCandidateSummary: Record<string, unknown>;
  manualTaskBridgeDispatchReadiness: AiManualTaskBridgeDispatchReadiness[];
  manualTaskBridgeDispatchReadinessSummary: AiManualTaskBridgeDispatchReadinessSummary;
  manualTaskBridgeEmployeeHandoffPreviews: AiManualTaskBridgeEmployeeHandoffPreview[];
  manualTaskBridgeEmployeeHandoffPreviewSummary: AiManualTaskBridgeEmployeeHandoffPreviewSummary;
}

interface AiStarkSyncPacketConsumption {
  starkAiSyncPacketJson: StarkAiSyncPacket;
  starkAiSyncPacketMarkdown: string;
  starkAiSyncPacketSummary: Record<string, unknown>;
}

interface AiDatabaseSafeSummaryConsumption {
  databaseSafeSummaryBatch: StarkAiDatabaseSafeSummaryEnvelope[];
  databaseSafeSummarySummary: Record<string, unknown>;
}

interface AiReadOnlySafeQueryStatusSummaryConsumption {
  readOnlySafeQueryStatusSummary: ReadOnlySafeQueryResult;
  readOnlySafeQueryStatusSummaryResult: ReadOnlySafeQueryResult;
  readOnlySafeQueryStatusSummarySource: Record<string, unknown>;
}

type AiOperationLogContextSourceLog = Partial<
  Pick<
    OperationLog,
    | 'id'
    | 'module'
    | 'targetId'
    | 'action'
    | 'operatorId'
    | 'actorType'
    | 'detail'
    | 'detailJson'
    | 'createdAt'
  >
>;

const AI_SERVICE_OPERATION_LOG_CONTEXT_SOURCE_SAFELIST: readonly AiOperationLogContextBundleSourceRule[] = [
  {
    module: 'finance_bank_sms',
    eventTypes: [
      'bank_sms_reconciliation_no_candidate',
      'bank_sms_reconciliation_suggestion_created',
    ],
  },
  {
    module: 'finance_reconciliation',
    eventTypes: [
      'bank_sms_confirm_apply_attempted',
      'bank_sms_confirm_apply_blocked',
      'bank_sms_collection_bridge_helper_result',
      'bank_sms_confirm_apply_succeeded',
    ],
  },
  {
    module: 'payment_record',
    actions: ['create_payment_record'],
  },
  {
    module: 'work_order',
    actions: ['create_work_order', 'update_work_order', 'payment_success'],
  },
  {
    module: 'engagement',
    actions: [
      'create_execution_task',
      'confirm_execution_task',
      'close_execution_task',
      'record_execution_result',
    ],
  },
  {
    module: 'points_commands',
  },
  {
    module: 'points_welfare_batches',
  },
];

const OWNER_ROLE_LABELS: Record<AiActionOwnerRole, string> = {
  founder: '创始人',
  finance: '财务',
  admin: '管理员',
  approver: '审批人',
  operator: '操作员',
  store_manager: '门店负责人',
  customer_service: '客服',
};

const BLOCKING_IMPACT_TAGS = new Set<AiActionImpactType>([
  'payroll_blocking',
  'customer_binding',
  'financial_reconciliation',
  'performance_confirmation',
]);

const AI_PROVIDER_PROFILES: AiProviderProfile[] = [
  {
    providerKey: 'stark_local_default',
    providerType: 'local_guidance',
    displayName: 'Stark 本地引导',
    roleScope: [
      'founder',
      'finance',
      'admin',
      'approver',
      'operator',
      'store_manager',
      'customer_service',
    ],
    channelScope: ['web_console', 'management_command', 'mobile_assistant', 'finance_review'],
    capabilitySet: ['next_actions', 'summary_context', 'task_context', 'manual_decision_read'],
    enabledFlag: true,
    fallbackOrder: 1,
  },
  {
    providerKey: 'stark_review_guard',
    providerType: 'review_guard',
    displayName: 'Stark 审核参考',
    roleScope: ['founder', 'finance', 'admin', 'approver'],
    channelScope: ['web_console', 'finance_review', 'management_command'],
    capabilitySet: ['blocking_review', 'payroll_prep_blocking', 'risk_summary'],
    enabledFlag: true,
    fallbackOrder: 2,
  },
];

@Injectable()
export class AiService {
  constructor(
    @Inject(forwardRef(() => PointsService))
    private readonly pointsService: PointsService,
    private readonly performanceService: PerformanceService,
    private readonly businessStatsService: BusinessStatsService,
    private readonly approvalRequestsService: ApprovalRequestsService,
    private readonly paymentRecordsService: PaymentRecordsService,
    private readonly operationLogContextService: AiReadableOperationLogContextService,
    private readonly actionPermissionMatrixService: AiActionPermissionMatrixService,
    private readonly taskDraftOrchestrationService: AiTaskDraftOrchestrationService,
    private readonly taskDraftReviewArtifactReadAuditService: AiTaskDraftReviewArtifactReadAuditService,
    private readonly manualTaskBridgeCandidateService: AiManualTaskBridgeCandidateService,
    private readonly manualTaskBridgeDispatchReadinessService: AiManualTaskBridgeDispatchReadinessService,
    private readonly manualTaskBridgeEmployeeHandoffPreviewService: AiManualTaskBridgeEmployeeHandoffPreviewService,
    private readonly ownerMemoryProjectionService: AiOwnerMemoryProjectionService,
    private readonly financeSafeSummarySourceMapperService: StarkAiFinanceSafeSummarySourceMapperService,
    private readonly financeReadonlySafeSummaryAdapterService: StarkAiFinanceReadonlySafeSummaryAdapterService,
    private readonly databaseSafeSummaryProviderService: StarkAiDatabaseSafeSummaryProviderService,
    private readonly starkAiSyncPacketService: StarkAiSyncPacketService,
    private readonly contactPhonePolicyConsumptionService: AiContactPhonePolicyConsumptionService,
    private readonly chatGptContactPhoneReviewResponseConsumptionService: AiChatGptContactPhoneReviewResponseConsumptionService,
    private readonly starkAiChatGptNextStepSelectorService: StarkAiChatGptNextStepSelectorService,
    @InjectRepository(AiActionState)
    private readonly aiActionStateRepository: Repository<AiActionState>,
    @InjectRepository(AiAssistantInteraction)
    private readonly aiAssistantInteractionRepository: Repository<AiAssistantInteraction>,
    @InjectRepository(AiKnowledgeEntry)
    private readonly aiKnowledgeEntryRepository: Repository<AiKnowledgeEntry>,
    @InjectRepository(AiMemoryEntry)
    private readonly aiMemoryEntryRepository: Repository<AiMemoryEntry>,
    @InjectRepository(ExternalCardSalesStaging)
    private readonly externalCardSalesStagingRepository: Repository<ExternalCardSalesStaging>,
    @InjectRepository(PerformanceSummaryManualDecision)
    private readonly performanceSummaryManualDecisionRepository: Repository<PerformanceSummaryManualDecision>,
    @InjectRepository(PerformanceEvent)
    private readonly performanceEventRepository: Repository<PerformanceEvent>,
    @InjectRepository(RewardEvent)
    private readonly rewardEventRepository: Repository<RewardEvent>,
    @InjectRepository(BusinessStatTag)
    private readonly businessStatTagRepository: Repository<BusinessStatTag>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(AbcPointsCommandRequest)
    private readonly abcPointsCommandRepository: Repository<AbcPointsCommandRequest>,
    @InjectRepository(PointsCommandBatch)
    private readonly pointsBatchRepository: Repository<PointsCommandBatch>,
    @InjectRepository(PointsCommandRequest)
    private readonly pointsCommandRepository: Repository<PointsCommandRequest>,
    @InjectRepository(PointsLedgerEntry)
    private readonly pointsLedgerRepository: Repository<PointsLedgerEntry>,
    @InjectRepository(PointsRedeemable)
    private readonly pointsRedeemableRepository: Repository<PointsRedeemable>,
    @InjectRepository(PointsRedemptionRequest)
    private readonly pointsRedemptionRepository: Repository<PointsRedemptionRequest>,
    @InjectRepository(PointsWelfareBatchItem)
    private readonly pointsWelfareBatchItemRepository: Repository<PointsWelfareBatchItem>,
    @InjectRepository(OperationLog)
    private readonly operationLogRepository: Repository<OperationLog>,
  ) {}

  private loadOperationLogContextBundles(input: {
    operationLogs: readonly AiOperationLogContextSourceLog[];
    allowedSources?: readonly AiOperationLogContextBundleSourceRule[];
  }): AiOperationLogContextBundleConsumption {
    const allowedSources =
      input.allowedSources ?? AI_SERVICE_OPERATION_LOG_CONTEXT_SOURCE_SAFELIST;
    const filteredLogs = input.operationLogs
      .filter((log) => this.isOperationLogContextSourceAllowed(log, allowedSources))
      .map((log) => log as unknown as AiReadableOperationLogLike);
    const operationLogContextBundles =
      this.operationLogContextService.toContextBundles(filteredLogs);

    return {
      operationLogContextBundles,
      operationLogContextBundleSummary:
        this.buildOperationLogContextBundleSummary(operationLogContextBundles),
    };
  }

  private isOperationLogContextSourceAllowed(
    log: AiOperationLogContextSourceLog,
    allowedSources: readonly AiOperationLogContextBundleSourceRule[],
  ): boolean {
    const sourceModule = this.readOperationLogText(log.module)?.toLowerCase();
    if (!sourceModule) {
      return false;
    }
    const action = this.readOperationLogText(log.action)?.toLowerCase() ?? null;
    const detail = this.readOperationLogDetailRecord(log.detailJson);
    const eventType = this.readObjectString(detail, 'eventType')?.toLowerCase() ?? action;

    return allowedSources.some((rule) => {
      if (rule.module.toLowerCase() !== sourceModule) {
        return false;
      }
      const allowedActions = rule.actions?.map((item) => item.toLowerCase());
      const allowedEventTypes = rule.eventTypes?.map((item) => item.toLowerCase());
      if (allowedActions && (!action || !allowedActions.includes(action))) {
        return false;
      }
      if (allowedEventTypes && (!eventType || !allowedEventTypes.includes(eventType))) {
        return false;
      }
      return true;
    });
  }

  private buildOperationLogContextBundleSummary(
    bundles: readonly AiReadableOperationLogContextBundle[],
  ): AiOperationLogContextBundleSummary {
    const riskSummaries: string[] = [];
    const blockedActions: string[] = [];
    const missingEvidence: string[] = [];
    const suggestedNextSteps: string[] = [];
    const forbiddenActions: string[] = [];

    for (const bundle of bundles) {
      this.appendUnique(
        riskSummaries,
        `${bundle.sourceModule}:${bundle.eventType}:${bundle.riskLevel}`,
      );
      for (const item of bundle.missingEvidence) {
        this.appendUnique(missingEvidence, item);
      }
      for (const item of bundle.suggestedNextSteps) {
        this.appendUnique(suggestedNextSteps, item);
      }
      for (const item of bundle.forbiddenActions) {
        this.appendUnique(forbiddenActions, item);
      }
      if (
        bundle.permissionHints.requiresHumanApproval ||
        bundle.riskLevel === 'finance_blocked' ||
        bundle.riskLevel === 'forbidden_for_ai_action'
      ) {
        this.appendUnique(
          blockedActions,
          `${bundle.sourceModule}:${bundle.riskLevel}:human_action_required`,
        );
      }
    }

    return {
      riskSummaries,
      blockedActions,
      missingEvidence,
      suggestedNextSteps,
      forbiddenActions,
    };
  }

  private readOperationLogDetailRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private readOperationLogText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized || null;
  }

  private appendUnique(target: string[], value: string | null | undefined): void {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || target.includes(normalized)) {
      return;
    }
    target.push(normalized);
  }

  private buildSuggestedActionPolicyCandidates(input: {
    rawSuggestedActions?: readonly Record<string, unknown>[];
    rawSuggestedCommandDraft?: Record<string, unknown> | null;
    focusObject?: AiAssistantFocusObject | null;
    blockers?: readonly string[];
    sourceActionId?: string | null;
    currentUserRoleCodes?: readonly string[] | null;
    operationLogContextBundles?: readonly AiReadableOperationLogContextBundle[] | null;
    source?: string | null;
    questionType?: AiAssistantQuestionType | null;
    primarySuggestion?: string | null;
  }): AiSuggestedActionPolicyCandidate[] {
    const candidates: AiSuggestedActionPolicyCandidate[] = [];
    const roleCodes = this.normalizeAssistantPolicyRoleCodes(input.currentUserRoleCodes);
    const source = input.source?.trim() || 'ai_service_suggested_action';
    const focusObject = input.focusObject ?? null;
    const blockers = input.blockers ?? [];

    (input.rawSuggestedActions ?? []).forEach((action, index) => {
      const actionType = this.readObjectString(action, 'actionType') ?? 'review_context';
      const targetEntityType =
        this.readObjectString(action, 'targetEntityType') ??
        focusObject?.entityType ??
        null;
      const targetEntityId =
        this.readObjectString(action, 'targetEntityId') ??
        this.readObjectNumber(action, 'targetEntityId') ??
        focusObject?.entityId ??
        null;
      const proposedActionCode = this.resolveSuggestedActionPolicyActionCode(
        actionType,
        targetEntityType,
        false,
      );
      candidates.push(
        this.createSuggestedActionPolicyCandidate({
          candidateId: `${source}:action:${index}:${this.normalizePolicyToken(actionType) || 'review_context'}`,
          source,
          actionCode: actionType,
          proposedAssistantActionCode: proposedActionCode,
          proposedAssistantSurface: 'safe_suggestion_label',
          proposedDraftType: this.resolveSuggestedActionPolicyDraftType(
            actionType,
            proposedActionCode,
          ),
          focusObject,
          targetEntityType,
          targetEntityId,
          blockers,
          sourceActionId: input.sourceActionId ?? this.readObjectString(action, 'sourceActionId'),
          sourceBundleIds: this.readObjectArray(action, 'sourceBundleIds').filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0,
          ),
          currentUserRoleCodes: roleCodes,
          reason:
            this.readObjectString(action, 'reason') ??
            this.readObjectString(action, 'label') ??
            this.resolveSuggestedActionPolicyReason(actionType),
        }),
      );
    });

    if (input.rawSuggestedCommandDraft) {
      const rawDraft = input.rawSuggestedCommandDraft;
      const draftType = this.readObjectString(rawDraft, 'draftType') ?? 'review_context';
      const targetEntity = this.readObjectObject(rawDraft, 'targetEntity');
      const targetEntityType =
        this.readObjectString(targetEntity, 'entityType') ??
        focusObject?.entityType ??
        null;
      const targetEntityId =
        this.readObjectString(targetEntity, 'entityId') ??
        this.readObjectNumber(targetEntity, 'entityId') ??
        focusObject?.entityId ??
        null;
      const proposedActionCode = this.resolveSuggestedActionPolicyActionCode(
        draftType,
        targetEntityType,
        true,
      );
      candidates.push(
        this.createSuggestedActionPolicyCandidate({
          candidateId: `${source}:command-draft:${this.normalizePolicyToken(draftType) || 'review_context'}`,
          source: 'ai_service_suggested_command_draft',
          actionCode: draftType,
          proposedAssistantActionCode: proposedActionCode,
          proposedAssistantSurface: this.resolveSuggestedCommandDraftSurface(proposedActionCode),
          proposedDraftType: this.resolveSuggestedCommandDraftPolicyDraftType(
            proposedActionCode,
            draftType,
          ),
          focusObject,
          targetEntityType,
          targetEntityId,
          blockers,
          sourceActionId:
            this.readObjectString(rawDraft, 'sourceActionId') ??
            this.readObjectString(targetEntity, 'sourceActionId') ??
            input.sourceActionId ??
            null,
          sourceBundleIds: this.readObjectArray(rawDraft, 'sourceBundleIds').filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0,
          ),
          currentUserRoleCodes: roleCodes,
          reason:
            this.readObjectString(rawDraft, 'suggestedReason') ??
            this.readObjectString(rawDraft, 'suggestedAction') ??
            input.primarySuggestion ??
            null,
          questionType: input.questionType ?? null,
        }),
      );
    }

    for (const bundle of input.operationLogContextBundles ?? []) {
      const bundleId = this.buildOperationLogContextBundleId(bundle);
      const safeActionCode = this.resolveContextBundleSuggestedActionCode(bundle);
      candidates.push(
        this.createSuggestedActionPolicyCandidate({
          candidateId: `${source}:context-bundle:${bundleId}`,
          source: 'operation_log_context_bundle',
          actionCode: bundle.action,
          proposedAssistantActionCode: safeActionCode,
          proposedAssistantSurface:
            safeActionCode === 'review_context' ||
            safeActionCode === 'explain_historical_result'
              ? 'answer_section'
              : 'safe_suggestion_label',
          proposedDraftType:
            safeActionCode === 'collect_evidence'
              ? 'evidence_collection_checklist'
              : safeActionCode === 'request_manual_review'
                ? 'manual_review_task'
                : null,
          focusObject,
          targetEntityType: bundle.sourceEntityType,
          targetEntityId: bundle.sourceEntityId,
          blockers,
          sourceActionId: input.sourceActionId ?? null,
          sourceModule: bundle.sourceModule,
          eventType: bundle.eventType,
          riskLevel: bundle.riskLevel,
          currentStatus: bundle.currentStatus,
          missingEvidence: bundle.missingEvidence,
          suggestedNextSteps: bundle.suggestedNextSteps,
          forbiddenActions: bundle.forbiddenActions,
          sourceBundleIds: [bundleId],
          currentUserRoleCodes: roleCodes,
          reason: `${bundle.sourceModule}:${bundle.eventType}:${bundle.riskLevel}`,
        }),
      );
    }

    return candidates;
  }

  private evaluateSuggestedActionPolicyCandidates(
    candidates: readonly AiSuggestedActionPolicyCandidate[],
  ): AiSuggestedActionPolicyEvaluation[] {
    return candidates.map((candidate) => ({
      candidate,
      policy: this.actionPermissionMatrixService.evaluate({
        sourceModule: candidate.sourceModule,
        sourceEntityType: candidate.sourceEntityType,
        eventType: candidate.eventType,
        action: candidate.proposedAssistantActionCode,
        riskLevel: candidate.riskLevel,
        forbiddenActions: candidate.forbiddenActions,
        currentStatus: candidate.currentStatus,
        missingEvidence: candidate.missingEvidence,
        suggestedNextSteps: candidate.suggestedNextSteps,
        currentUserRoleCodes: candidate.currentUserRoleCodes,
        proposedAssistantActionCode: candidate.proposedAssistantActionCode,
        proposedAssistantSurface: candidate.proposedAssistantSurface,
        proposedDraftType: candidate.proposedDraftType,
        touchesMoney: candidate.touchesMoney,
        touchesWorkOrderStatus: candidate.touchesWorkOrderStatus,
        touchesCustomerRights: candidate.touchesCustomerRights,
        touchesPayroll: candidate.touchesPayroll,
        touchesBenefits: candidate.touchesBenefits,
        touchesVirtualLedger: candidate.touchesVirtualLedger,
        createsBusinessObject: candidate.createsBusinessObject,
        mutatesBusinessState: candidate.mutatesBusinessState,
        usesProductionConnector: candidate.usesProductionConnector,
      }),
    }));
  }

  private applySuggestedActionPolicyResults(
    evaluations: readonly AiSuggestedActionPolicyEvaluation[],
    rawSuggestedCommandDraft: Record<string, unknown> | null = null,
    questionType: AiAssistantQuestionType | null = null,
  ): AiSuggestedActionPolicyApplication {
    const allowedSuggestedActions: Array<Record<string, unknown>> = [];
    const blockedSuggestedActions: Array<Record<string, unknown>> = [];
    const boundaryExplanations: Array<Record<string, unknown>> = [];
    const suggestedActionsPolicyTrace: Array<Record<string, unknown>> = [];
    let suggestedCommandDraftPolicy: Record<string, unknown> | null = null;
    let suggestedCommandDraft: Record<string, unknown> | null = null;

    for (const evaluation of evaluations) {
      suggestedActionsPolicyTrace.push(
        this.buildSuggestedActionPolicyTrace(evaluation),
      );

      if (evaluation.policy.actionPermissionLevel === 'forbidden_for_ai') {
        blockedSuggestedActions.push(this.buildBlockedSuggestedAction(evaluation));
        boundaryExplanations.push(this.buildBoundaryExplanation(evaluation));
        continue;
      }

      if (evaluation.candidate.source === 'ai_service_suggested_command_draft') {
        suggestedCommandDraftPolicy = this.buildSuggestedCommandDraftPolicy(evaluation);
        suggestedCommandDraft = this.buildPolicyGatedSuggestedCommandDraft(
          rawSuggestedCommandDraft,
          evaluation,
          questionType,
        );
        if (!suggestedCommandDraft) {
          boundaryExplanations.push(this.buildBoundaryExplanation(evaluation));
        }
        continue;
      }

      const safeAction = this.buildPolicyGatedSuggestedAction(evaluation);
      if (safeAction) {
        allowedSuggestedActions.push(safeAction);
      }
      if (
        evaluation.policy.actionPermissionLevel === 'human_confirmation_required'
      ) {
        boundaryExplanations.push(this.buildBoundaryExplanation(evaluation));
      }
    }
    const taskDraftReview = this.buildTaskDraftReviewArtifactsForPolicyEvaluations(
      evaluations,
    );
    const taskDraftReviewReadAudit = this.buildTaskDraftReviewReadAuditViews(
      taskDraftReview.artifacts,
      taskDraftReview.summary,
      taskDraftReview.policyTrace,
    );
    const manualTaskBridge = this.buildManualTaskBridgeCandidates(
      taskDraftReviewReadAudit.views,
      taskDraftReview.artifacts,
    );
    const manualTaskBridgeDispatchReadiness =
      this.buildManualTaskBridgeDispatchReadiness(manualTaskBridge.candidates);
    const manualTaskBridgeEmployeeHandoffViewerRoles =
      this.buildManualTaskBridgeEmployeeHandoffViewerRoles(
        manualTaskBridge.candidates,
        evaluations,
      );
    const manualTaskBridgeEmployeeHandoffPreview =
      this.buildManualTaskBridgeEmployeeHandoffPreviews(
        manualTaskBridge.candidates,
        manualTaskBridgeDispatchReadiness.readinessItems,
        manualTaskBridgeEmployeeHandoffViewerRoles,
      );

    return {
      allowedSuggestedActions,
      blockedSuggestedActions,
      boundaryExplanations,
      suggestedActionsPolicyTrace,
      suggestedCommandDraftPolicy,
      suggestedCommandDraft,
      taskDraftReviewArtifacts: taskDraftReview.artifacts,
      taskDraftReviewArtifactSummary: taskDraftReview.summary,
      taskDraftReviewPolicyTrace: taskDraftReview.policyTrace,
      taskDraftReviewReadAuditViews: taskDraftReviewReadAudit.views,
      taskDraftReviewReadAuditSummary: taskDraftReviewReadAudit.summary,
      manualTaskBridgeCandidates: manualTaskBridge.candidates,
      manualTaskBridgeCandidateSummary: manualTaskBridge.summary,
      manualTaskBridgeDispatchReadiness:
        manualTaskBridgeDispatchReadiness.readinessItems,
      manualTaskBridgeDispatchReadinessSummary:
        manualTaskBridgeDispatchReadiness.summary,
      manualTaskBridgeEmployeeHandoffPreviews:
        manualTaskBridgeEmployeeHandoffPreview.previews,
      manualTaskBridgeEmployeeHandoffPreviewSummary:
        manualTaskBridgeEmployeeHandoffPreview.summary,
    };
  }

  private buildTaskDraftReviewArtifactsForPolicyEvaluations(
    evaluations: readonly AiSuggestedActionPolicyEvaluation[],
  ): {
    artifacts: AiTaskDraftReviewArtifact[];
    summary: Record<string, unknown>;
    policyTrace: Array<Record<string, unknown>>;
  } {
    if (evaluations.length === 0) {
      const policyTrace: Array<Record<string, unknown>> = [];
      return {
        artifacts: [],
        summary: this.buildTaskDraftReviewArtifactSummary([], policyTrace),
        policyTrace,
      };
    }

    const orchestrationService = this.resolveTaskDraftOrchestrationService();
    const results = evaluations.map((evaluation) =>
      orchestrationService.orchestrate({
        candidate: {
          candidateId: evaluation.candidate.candidateId,
          source: 'ai_service_policy_gated_suggested_action',
          sourceModule: evaluation.candidate.sourceModule,
          sourceEntityType: evaluation.candidate.sourceEntityType,
          sourceEntityId: null,
          targetEntityType: evaluation.candidate.targetEntityType,
          targetEntityId: evaluation.candidate.targetEntityId,
          sourceBundleIds: evaluation.candidate.sourceBundleIds,
          proposedDraftType:
            this.resolveTaskDraftReviewProposedDraftType(evaluation),
          currentUserRoleCodes: evaluation.candidate.currentUserRoleCodes,
          title: this.buildTaskDraftReviewCandidateTitle(evaluation),
          summary: this.buildTaskDraftReviewCandidateSummary(evaluation),
          reason: evaluation.candidate.reason,
          checklistItems: this.buildTaskDraftReviewChecklistItems(evaluation),
          missingEvidence: evaluation.candidate.missingEvidence,
          boundaryExplanations:
            this.buildTaskDraftReviewBoundaryExplanations(evaluation),
        },
        policyResult: evaluation.policy,
        policyTrace: {
          candidateId: evaluation.candidate.candidateId,
          sourceBundleIds: evaluation.candidate.sourceBundleIds,
        },
      }),
    );
    const artifacts = results
      .map((result) => result.draft)
      .filter((draft): draft is AiTaskDraftReviewArtifact => Boolean(draft));
    const policyTrace = results.map((result, index) => ({
      candidateId: evaluations[index]?.candidate.candidateId ?? 'unknown_candidate',
      actionPermissionLevel: result.policyTrace.actionPermissionLevel,
      draftCreated: Boolean(result.draft),
      draftType: result.draft?.draftType ?? null,
      blockedActionCount: result.blockedActionCodes.length,
      boundaryExplanations: result.boundaryExplanations,
      sourceBundleIds: result.policyTrace.sourceBundleIds,
      reasonCodes: result.policyTrace.reasonCodes,
    }));

    return {
      artifacts,
      summary: this.buildTaskDraftReviewArtifactSummary(artifacts, policyTrace),
      policyTrace,
    };
  }

  private resolveTaskDraftOrchestrationService(): AiTaskDraftOrchestrationService {
    return (
      this.taskDraftOrchestrationService ??
      new AiTaskDraftOrchestrationService(this.actionPermissionMatrixService)
    );
  }

  private buildTaskDraftReviewArtifactSummary(
    artifacts: readonly AiTaskDraftReviewArtifact[],
    policyTrace: readonly Record<string, unknown>[],
  ): Record<string, unknown> {
    const draftTypes = this.uniqueStrings(artifacts.map((artifact) => artifact.draftType));
    const actionPermissionLevels = this.uniqueStrings(
      policyTrace
        .map((trace) => this.readObjectString(trace, 'actionPermissionLevel'))
        .filter((level): level is string => Boolean(level)),
    );
    return {
      artifactCount: artifacts.length,
      draftTypes,
      actionPermissionLevels,
      requiresHumanConfirmationCount: artifacts.filter(
        (artifact) => artifact.requiresHumanConfirmation,
      ).length,
      executableArtifactCount: artifacts.filter((artifact) => artifact.executable).length,
      executionStatuses: this.uniqueStrings(
        artifacts.map((artifact) => artifact.executionStatus),
      ),
    };
  }

  private buildTaskDraftReviewReadAuditViews(
    artifacts: readonly AiTaskDraftReviewArtifact[],
    taskDraftReviewArtifactSummary: Record<string, unknown>,
    taskDraftReviewPolicyTrace: readonly Record<string, unknown>[],
  ): {
    views: AiTaskDraftReviewArtifactReadAuditView[];
    summary: Record<string, unknown>;
  } {
    if (artifacts.length === 0) {
      const views: AiTaskDraftReviewArtifactReadAuditView[] = [];
      return {
        views,
        summary: this.buildTaskDraftReviewReadAuditSummary(views),
      };
    }

    const readAuditService =
      this.resolveTaskDraftReviewArtifactReadAuditService();
    const views = readAuditService.toReadAuditViews(
      artifacts.map((artifact) => ({
        artifact,
        taskDraftReviewArtifactSummary,
        taskDraftReviewPolicyTrace,
      })),
    );

    return {
      views,
      summary: this.buildTaskDraftReviewReadAuditSummary(views),
    };
  }

  private resolveTaskDraftReviewArtifactReadAuditService(): AiTaskDraftReviewArtifactReadAuditService {
    return (
      this.taskDraftReviewArtifactReadAuditService ??
      new AiTaskDraftReviewArtifactReadAuditService()
    );
  }

  private buildTaskDraftReviewReadAuditSummary(
    views: readonly AiTaskDraftReviewArtifactReadAuditView[],
  ): Record<string, unknown> {
    return {
      viewCount: views.length,
      artifactTypes: this.uniqueStrings(
        views.map((view) => view.artifactType),
      ),
      requiresHumanConfirmationCount: views.filter(
        (view) => view.requiresHumanConfirmation,
      ).length,
      requiresOwnerApprovalCount: views.filter(
        (view) => view.requiresOwnerApproval,
      ).length,
      executableViewCount: views.filter((view) => view.executable).length,
      lifecycleStatuses: this.uniqueStrings(
        views.map((view) => view.lifecycleStatus),
      ),
      forbiddenActionCodeCount: views.reduce(
        (count, view) => count + view.forbiddenActionCodes.length,
        0,
      ),
    };
  }

  private buildManualTaskBridgeCandidates(
    views: readonly AiTaskDraftReviewArtifactReadAuditView[],
    artifacts: readonly AiTaskDraftReviewArtifact[] = [],
  ): {
    candidates: AiManualTaskBridgeCandidate[];
    summary: Record<string, unknown>;
  } {
    if (views.length === 0) {
      const candidates: AiManualTaskBridgeCandidate[] = [];
      return {
        candidates,
        summary: this.buildManualTaskBridgeCandidateSummary(candidates),
      };
    }

    const bridgeService = this.resolveManualTaskBridgeCandidateService();
    const candidates = bridgeService.toManualTaskBridgeCandidates(
      views.map((view, index) => {
        const sourceArtifact = artifacts[index];
        return {
          readAuditView: view,
          safeInteractionMetadata: {
            sourceAiInteractionId: view.createdByAiInteractionId,
          },
          safeAssignmentHints: {
            assigneeRoleCodes: sourceArtifact?.requiredHumanRoleCodes ?? [],
            candidateAssigneeEmployeeIds: [],
          },
        };
      }),
    );

    return {
      candidates,
      summary: this.buildManualTaskBridgeCandidateSummary(candidates),
    };
  }

  private resolveManualTaskBridgeCandidateService(): AiManualTaskBridgeCandidateService {
    return (
      this.manualTaskBridgeCandidateService ??
      new AiManualTaskBridgeCandidateService()
    );
  }

  private buildManualTaskBridgeCandidateSummary(
    candidates: readonly AiManualTaskBridgeCandidate[],
  ): Record<string, unknown> {
    return {
      candidateCount: candidates.length,
      recommendedTaskTypes: this.uniqueStrings(
        candidates.map((candidate) => candidate.recommendedTaskType),
      ),
      draftTypes: this.uniqueStrings(
        candidates.map((candidate) => candidate.draftType),
      ),
      requiresHumanConfirmationCount: candidates.filter(
        (candidate) => candidate.requiresHumanConfirmation,
      ).length,
      requiresOwnerApprovalCount: candidates.filter(
        (candidate) => candidate.requiresOwnerApproval,
      ).length,
      executableCandidateCount: candidates.filter(
        (candidate) => candidate.executable,
      ).length,
      taskLifecycleStatuses: this.uniqueStrings(
        candidates.map((candidate) => candidate.taskLifecycleStatus),
      ),
      forbiddenActionCodeCount: candidates.reduce(
        (count, candidate) => count + candidate.forbiddenActionCodes.length,
        0,
      ),
      assignmentCandidateCount: candidates.filter(
        (candidate) =>
          candidate.assigneeRoleCodes.length > 0 ||
          candidate.candidateAssigneeEmployeeIds.length > 0,
      ).length,
    };
  }

  private buildManualTaskBridgeDispatchReadiness(
    candidates: readonly AiManualTaskBridgeCandidate[],
  ): {
    readinessItems: AiManualTaskBridgeDispatchReadiness[];
    summary: AiManualTaskBridgeDispatchReadinessSummary;
  } {
    const dispatchReadinessService =
      this.resolveManualTaskBridgeDispatchReadinessService();
    return dispatchReadinessService.toDispatchReadinessBatch(candidates);
  }

  private resolveManualTaskBridgeDispatchReadinessService(): AiManualTaskBridgeDispatchReadinessService {
    return (
      this.manualTaskBridgeDispatchReadinessService ??
      new AiManualTaskBridgeDispatchReadinessService()
    );
  }

  private buildManualTaskBridgeEmployeeHandoffPreviews(
    candidates: readonly AiManualTaskBridgeCandidate[],
    dispatchReadinessItems: readonly AiManualTaskBridgeDispatchReadiness[],
    viewerRoles: readonly (string | null | undefined)[] = [],
  ): {
    previews: AiManualTaskBridgeEmployeeHandoffPreview[];
    summary: AiManualTaskBridgeEmployeeHandoffPreviewSummary;
  } {
    const previewService =
      this.resolveManualTaskBridgeEmployeeHandoffPreviewService();
    const inputs = candidates.flatMap((candidate, index) => {
      const dispatchReadiness = dispatchReadinessItems[index];
      if (!dispatchReadiness) {
        return [];
      }
      return [
        {
          candidate,
          dispatchReadiness,
          viewerRole: index < viewerRoles.length ? viewerRoles[index] : null,
        },
      ];
    });
    return previewService.toEmployeeHandoffPreviewBatch(inputs);
  }

  private buildManualTaskBridgeEmployeeHandoffViewerRoles(
    candidates: readonly AiManualTaskBridgeCandidate[],
    evaluations: readonly AiSuggestedActionPolicyEvaluation[],
  ): Array<string | null> {
    const rolesByCandidateId = new Map(
      evaluations.map((evaluation) => [
        evaluation.candidate.candidateId,
        this.resolveEmployeeHandoffPreviewViewerRoleFromCurrentUserRoles(
          evaluation.candidate.currentUserRoleCodes,
        ),
      ]),
    );
    return candidates.map(
      (candidate) =>
        rolesByCandidateId.get(candidate.policyTraceSummary.candidateId) ?? null,
    );
  }

  private resolveManualTaskBridgeEmployeeHandoffPreviewService(): AiManualTaskBridgeEmployeeHandoffPreviewService {
    return (
      this.manualTaskBridgeEmployeeHandoffPreviewService ??
      new AiManualTaskBridgeEmployeeHandoffPreviewService()
    );
  }

  private buildContactPhonePolicyConsumption(): AiContactPhonePolicyConsumption {
    return this.resolveContactPhonePolicyConsumptionService().toContextBundle(
      this.buildAiServiceContactPhonePolicyInputs(),
    );
  }

  private buildChatGptContactPhoneReviewResponseConsumption(): AiChatGptContactPhoneReviewResponseConsumption {
    return this.resolveChatGptContactPhoneReviewResponseConsumptionService().buildSyntheticValidationConsumption(
      {
        latestVerifiedMainCommit:
          'verified_by_github_main_pr_122_validator_source',
        repo: 'vgtj48gdzh-spec/stark-system',
      },
    );
  }

  private buildStarkAiChatGptNextStepSelector(
    starkAiSyncPacketSummary?: Record<string, unknown> | null,
  ): StarkAiChatGptNextStepSelectorResult {
    return this.resolveStarkAiChatGptNextStepSelectorService().buildNextStepSelector(
      {
        currentStage:
          'S1-04.10 in progress / Stark AI ChatGPT next-step selector',
        currentMode: 'SAFE',
        latestVerifiedMainCommit: 'a3873ca10e3335db1af6a35d96a2ed92f64344f5',
        latestMergedPr: 'PR #126',
        currentOpenPr: 'pending',
        statusDocs: [
          'docs/chatgpt-sync.md',
          'docs/system-state.md',
          'docs/active-task.md',
        ],
        syncPacketSafeSummaryRefs: starkAiSyncPacketSummary
          ? ['starkAiSyncPacketSummary']
          : [],
      },
    );
  }

  private buildReadOnlySafeQueryStatusSummaryForAiReview(): AiReadOnlySafeQueryStatusSummaryConsumption {
    const request: ReadOnlySafeQueryRequest = {
      queryType: READ_ONLY_SAFE_QUERY_STATUS_ADAPTER_QUERY_TYPE,
      requestedByUserId: 'ai-service-read-only-safe-query-status-review',
      role: 'codex_implementation_assistant',
      requestReason:
        'review current S1-05.5 SAFE implementation status summary',
      timeRange: {
        from: '2026-05-25T00:00:00.000Z',
        to: '2026-05-26T23:59:59.000Z',
      },
      scopeLimit: {
        companyId: null,
        department: null,
        maxRows: 1,
        aggregateOnly: true,
      },
      redactionLevel: 'external_redacted',
      sourceRefs: [
        'github-main-ce751a3',
        'github-pr-134',
        'docs/chatgpt-sync.md',
        'docs/system-state.md',
        'docs/active-task.md',
        'docs/strategy/read-only-safe-query-gateway-contract.md',
        'starkAiSyncPacketSummary',
      ],
      ownerApprovalRequired: false,
      noMutation: true,
    };
    const result =
      this.resolveReadOnlySafeQueryStatusAdapterService().buildAiSyncPacketCurrentStatusSummary(
        {
          request,
          currentStage:
            'S1-05.5 in progress / AiService read-only safe query status summary consumption',
          currentMode: 'SAFE',
          latestMergedPr: {
            number: 134,
            title: '[codex] Add read-only safe query status adapter skeleton',
            finalHead: '03ad4727a566283d2067ce1049155201d7847864',
            mergeCommit: '1e3cfbcd9044f5c842033a37ef8d764dfd40c270',
          },
          currentOpenPr: 'PR #135',
          implementationBranch:
            'codex/ai-service-read-only-safe-query-status-consumption',
          sourceRefs: [
            'backend/src/modules/ai/services/read-only-safe-query-status-adapter.service.ts',
            'backend/src/modules/ai/contracts/read-only-safe-query-gateway.contract.ts',
            'backend/scripts/self-check-read-only-safe-query-status-adapter.mjs',
          ],
          blockers: [],
          nextSingleGoal:
            'complete AiService read-only safe query status summary consumption',
          generatedAt: '2026-05-26T00:00:00.000Z',
        },
      );

    return {
      readOnlySafeQueryStatusSummary: result,
      readOnlySafeQueryStatusSummaryResult: result,
      readOnlySafeQueryStatusSummarySource: {
        sourceKind: 'synthetic_provided_status_input_only',
        adapter:
          'ReadOnlySafeQueryStatusAdapterService.buildAiSyncPacketCurrentStatusSummary',
        queryType: result.queryType,
        contextType: result.contextType,
        currentSafeSyncPacketSummaryRefs: ['starkAiSyncPacketSummary'],
        sourceRefs: result.evidenceRefs,
      },
    };
  }

  private resolveReadOnlySafeQueryStatusAdapterService(): ReadOnlySafeQueryStatusAdapterService {
    return new ReadOnlySafeQueryStatusAdapterService();
  }

  private resolveContactPhonePolicyConsumptionService(): AiContactPhonePolicyConsumptionService {
    return (
      this.contactPhonePolicyConsumptionService ??
      new AiContactPhonePolicyConsumptionService()
    );
  }

  private resolveChatGptContactPhoneReviewResponseConsumptionService(): AiChatGptContactPhoneReviewResponseConsumptionService {
    return (
      this.chatGptContactPhoneReviewResponseConsumptionService ??
      new AiChatGptContactPhoneReviewResponseConsumptionService()
    );
  }

  private resolveStarkAiChatGptNextStepSelectorService(): StarkAiChatGptNextStepSelectorService {
    return (
      this.starkAiChatGptNextStepSelectorService ??
      new StarkAiChatGptNextStepSelectorService()
    );
  }

  private buildAiServiceContactPhonePolicyInputs(): AiContactPhonePolicyConsumptionInput[] {
    return [
      {
        contextId: 'owner_contact_full_read_review',
        actor: 'owner',
        permission: 'contact_full_read',
      },
      {
        contextId: 'owner_ai_contact_ai_use_internal_review_only',
        actor: 'owner_ai',
        permission: 'contact_ai_use_internal',
      },
      {
        contextId: 'operator_call_without_reveal_assigned_task',
        actor: 'operator',
        permission: 'contact_call_without_reveal',
        taskAssigned: true,
      },
      {
        contextId: 'operator_call_without_reveal_role_permission',
        actor: 'operator',
        permission: 'contact_call_without_reveal',
        hasExplicitRolePermission: true,
      },
      {
        contextId: 'chatgpt_external_masked_read_safe_summary',
        actor: 'chatgpt_external',
        permission: 'contact_masked_read',
      },
      {
        contextId: 'chatgpt_external_full_read_denied_redacted',
        actor: 'chatgpt_external',
        permission: 'contact_full_read',
        fullPhoneIncluded: true,
      },
      {
        contextId: 'sync_packet_phone_hash_denied',
        actor: 'sync_packet',
        permission: 'contact_masked_read',
        phoneHashRequested: true,
      },
      {
        contextId: 'ai_memory_internal_use_denied_redacted',
        actor: 'ai_memory',
        permission: 'contact_ai_use_internal',
      },
    ];
  }

  private buildStarkAiSyncPacketConsumption(input: {
    taskDraftReviewReadAuditSummary: Record<string, unknown>;
    manualTaskBridgeCandidateSummary: Record<string, unknown>;
    manualTaskBridgeDispatchReadinessSummary: AiManualTaskBridgeDispatchReadinessSummary;
    manualTaskBridgeEmployeeHandoffPreviewSummary: AiManualTaskBridgeEmployeeHandoffPreviewSummary;
    contactPhonePolicySummary?: Record<string, unknown> | null;
    chatGptContactPhoneReviewResponseValidationSummary?: unknown;
    databaseSafeSummaryBatch?: StarkAiDatabaseSafeSummaryEnvelope[] | null;
    databaseSafeSummarySummary?: Record<string, unknown> | null;
    currentSystemState?: Record<string, unknown> | null;
  }): AiStarkSyncPacketConsumption {
    const databaseSafeSummary =
      input.databaseSafeSummaryBatch && input.databaseSafeSummarySummary
        ? {
            databaseSafeSummaryBatch: input.databaseSafeSummaryBatch,
            databaseSafeSummarySummary: input.databaseSafeSummarySummary,
          }
        : this.buildDatabaseSafeSummaryConsumption();
    const sourceSummaryNames = [
      'taskDraftReviewReadAuditSummary',
      'manualTaskBridgeCandidateSummary',
      'manualTaskBridgeDispatchReadinessSummary',
      'manualTaskBridgeEmployeeHandoffPreviewSummary',
      'contactPhonePolicySummary',
      'chatGptContactPhoneReviewResponseValidationSummary',
      'databaseSafeSummarySummary',
    ];
    const currentSystemState =
      input.currentSystemState ?? this.buildStarkAiSyncPacketCurrentSystemState();
    const artifacts = this.resolveStarkAiSyncPacketService().toSyncPacketArtifacts({
      sourceSystem: 'stark-system-ai-service',
      repo: 'vgtj48gdzh-spec/stark-system',
      latestVerifiedMainCommit: 'verified_by_github_main_and_status_files',
      currentSystemState,
      aiCapabilitySummary: {
        landedAiMainlineSummary: this.buildStarkAiSyncPacketLandedAiMainlineSummary(),
        sourceSummaryNames,
        safeSummaryInputsOnly: true,
        databaseSafeSummaryProviderIncluded: true,
        contactPhonePolicySummaryIncluded: Boolean(
          input.contactPhonePolicySummary,
        ),
        chatGptContactPhoneReviewResponseValidationSummaryIncluded: Boolean(
          input.chatGptContactPhoneReviewResponseValidationSummary,
        ),
        databaseSafeSummarySummary:
          databaseSafeSummary.databaseSafeSummarySummary,
        databaseReadAllowedThisRound: false,
        databaseWriteAllowed: false,
        businessExecutionAllowed: false,
      },
      currentBlockers: [],
      recentTaskDrafts: [
        {
          summaryName: 'taskDraftReviewReadAuditSummary',
          summary: input.taskDraftReviewReadAuditSummary,
        },
        {
          summaryName: 'manualTaskBridgeCandidateSummary',
          summary: input.manualTaskBridgeCandidateSummary,
        },
        {
          summaryName: 'manualTaskBridgeDispatchReadinessSummary',
          summary: input.manualTaskBridgeDispatchReadinessSummary,
        },
      ],
      employeeHandoffPreviewSummary:
        input.manualTaskBridgeEmployeeHandoffPreviewSummary,
      supervisorReviewSummary: {
        reviewArtifactOnly: true,
        sourceSummaryNames,
        draftOnly: true,
        executable: false,
        forbiddenActionsAreAuditFactsOnly: true,
        databaseSafeSummaryBatchIncluded:
          databaseSafeSummary.databaseSafeSummaryBatch.length > 0,
        contactPhonePolicySummaryIncluded: Boolean(
          input.contactPhonePolicySummary,
        ),
        chatGptContactPhoneReviewResponseValidationSummaryIncluded: Boolean(
          input.chatGptContactPhoneReviewResponseValidationSummary,
        ),
        databaseSafeSummarySummary:
          databaseSafeSummary.databaseSafeSummarySummary,
      },
      databaseSafeSummaries: databaseSafeSummary.databaseSafeSummaryBatch,
      contactPhonePolicySummary: input.contactPhonePolicySummary ?? null,
      chatGptContactPhoneReviewResponseValidationSummary:
        input.chatGptContactPhoneReviewResponseValidationSummary ?? null,
      aiSelfReviewQuestions: [
        'Are all Stark AI sync packet inputs already-safe summaries?',
        'Did AiService build database safe summaries only from synthetic or already-safe inputs?',
        'Does the contact phone policy summary stay synthetic-only and redacted?',
        'Does the ChatGPT review response validation summary stay synthetic-only and redacted?',
        'Are blocked database safe summaries treated only as review facts?',
        'Do all SAFE counters remain zero before ChatGPT handoff?',
        'Does this output stay review-only instead of executable?',
      ],
      questionsForChatGPT: [
        'Is this the smallest backend-only Stark AI sync packet review response validation summary slice?',
        'Are there any SAFE boundary gaps before PR review?',
      ],
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
      safeBoundaryFlags: this.buildStarkAiSyncPacketZeroSafeBoundaryFlags(),
    });

    return {
      starkAiSyncPacketJson: artifacts.jsonPacket,
      starkAiSyncPacketMarkdown: artifacts.markdownPacket,
      starkAiSyncPacketSummary: this.buildStarkAiSyncPacketSummary(
        artifacts.jsonPacket,
        artifacts.markdownPacket,
        sourceSummaryNames,
      ),
    };
  }

  private resolveStarkAiSyncPacketService(): StarkAiSyncPacketService {
    return this.starkAiSyncPacketService ?? new StarkAiSyncPacketService();
  }

  private buildDatabaseSafeSummaryConsumption(
    generatedAt = '2026-05-20T12:00:00.000Z',
  ): AiDatabaseSafeSummaryConsumption {
    const provider = this.resolveDatabaseSafeSummaryProviderService();
    const databaseSafeSummaryBatch = provider.toSafeSummaryBatch(
      this.buildDatabaseSafeSummaryProviderInputs(generatedAt),
    );

    return {
      databaseSafeSummaryBatch,
      databaseSafeSummarySummary:
        this.buildDatabaseSafeSummaryBatchSummary(databaseSafeSummaryBatch),
    };
  }

  private resolveDatabaseSafeSummaryProviderService(): StarkAiDatabaseSafeSummaryProviderService {
    return (
      this.databaseSafeSummaryProviderService ??
      new StarkAiDatabaseSafeSummaryProviderService()
    );
  }

  private buildDatabaseSafeSummaryProviderInputs(
    generatedAt: string,
  ): StarkAiDatabaseSafeSummaryProviderInput[] {
    return [
      this.buildFinanceSafeSummaryProviderInput(generatedAt),
      ...this.buildNonFinanceDatabaseSafeSummaryProviderInputs(generatedAt),
    ];
  }

  private buildNonFinanceDatabaseSafeSummaryProviderInputs(
    generatedAt: string,
  ): StarkAiDatabaseSafeSummaryProviderInput[] {
    const summaryTypes: StarkAiDatabaseSafeSummaryType[] = [
      'work_order_safe_summary',
      'customer_safe_summary',
      'employee_task_safe_summary',
      'inventory_safe_summary',
      'invoice_receivable_safe_summary',
    ];

    return summaryTypes.map((summaryType, index) => ({
      summaryType,
      requestedByRole:
        summaryType === 'invoice_receivable_safe_summary'
          ? 'operator'
          : 'owner',
      requestId: `ai-service-database-safe-summary-${index + 2}`,
      generatedAt,
      sourceKind: 'synthetic_fixture',
      syntheticRecords: [
        {
          sourceName: `${summaryType}_ai_service_synthetic_fixture`,
          safeRecordId: `${summaryType}-safe-review-${index + 2}`,
          category: `${summaryType}_review_bucket`,
          status: index % 2 === 0 ? 'pending' : 'reference_only',
          riskLevel: index % 2 === 0 ? 'review' : 'low',
          amountBucket: index % 2 === 0 ? 'bucket_1' : 'aggregate_only',
          safeLabel: `${summaryType} synthetic review fact`,
          blockerLabel:
            summaryType === 'invoice_receivable_safe_summary'
              ? 'blocked_permission_review_fact'
              : 'needs_human_review',
          maskedCustomerId:
            summaryType === 'customer_safe_summary'
              ? 'customer_masked_001'
              : null,
          ownerRoleHint: 'owner',
        },
      ],
    }));
  }

  private buildFinanceSafeSummaryProviderInput(
    generatedAt: string,
  ): StarkAiDatabaseSafeSummaryProviderInput {
    const mapper = this.resolveFinanceSafeSummarySourceMapperService();
    return mapper.toProviderInput(this.buildAiServiceFinanceSafeSummarySourceRows(), {
      requestedByRole: 'owner',
      requestId: 'ai-service-finance-safe-summary-mapper-consumption',
      generatedAt,
      sourceKind: 'synthetic_fixture',
      dataSourceScope: [
        'ai_service_finance_safe_summary_mapper_fixture',
      ],
    });
  }

  private resolveFinanceSafeSummarySourceMapperService(): StarkAiFinanceSafeSummarySourceMapperService {
    return (
      this.financeSafeSummarySourceMapperService ??
      new StarkAiFinanceSafeSummarySourceMapperService()
    );
  }

  private buildAiServiceFinanceSafeSummarySourceRows(): StarkAiFinanceSafeSummarySourceRow[] {
    return [
      {
        safeSourceName: 'ai_service_finance_safe_summary_mapper_fixture',
        safeRecordId: 'ai-service-finance-safe-summary-mapper-row-1',
        evidenceStatus: 'pending',
        reconciliationStatus: 'inferred',
        amountBucket: 'amount_bucket_review_only',
        riskLevel: 'review',
        blockerLabel: 'non_final_finance_review',
        maskedAccountTail: 'tail_1234',
        counterpartyPresence: 'masked_present',
        invoiceOrReceivableState: 'reference_only',
        sourceFinality: 'reference_only',
      },
    ];
  }

  private async buildDatabaseSafeSummaryConsumptionFromFinanceReadonlyAdapterAsync(
    generatedAt?: string,
  ): Promise<AiDatabaseSafeSummaryConsumption> {
    const provider = this.resolveDatabaseSafeSummaryProviderService();
    const financeSafeSummary =
      await this.buildFinanceReadonlyAdapterConsumptionAsync(generatedAt);
    const databaseSafeSummaryBatch = [
      financeSafeSummary.safeSummary,
      ...provider.toSafeSummaryBatch(
        this.buildNonFinanceDatabaseSafeSummaryProviderInputs(
          financeSafeSummary.generatedAt,
        ),
      ),
    ];

    return {
      databaseSafeSummaryBatch,
      databaseSafeSummarySummary:
        this.buildDatabaseSafeSummaryBatchSummary(databaseSafeSummaryBatch),
    };
  }

  private async buildFinanceReadonlyAdapterConsumptionAsync(
    generatedAt?: string,
  ): Promise<StarkAiFinanceReadonlySafeSummaryAdapterResult> {
    return this.resolveFinanceReadonlySafeSummaryAdapterService().buildFinanceSafeSummary({
      reader: this.buildAiServiceFinanceReadonlySafeSummaryMockedReader(),
      requestedByRole: 'owner',
      requestId: 'ai-service-finance-readonly-adapter-consumption',
      generatedAt,
      latestVerifiedMainCommit: 'verified_by_github_main_and_status_files',
    });
  }

  private resolveFinanceReadonlySafeSummaryAdapterService(): StarkAiFinanceReadonlySafeSummaryAdapterService {
    return (
      this.financeReadonlySafeSummaryAdapterService ??
      new StarkAiFinanceReadonlySafeSummaryAdapterService()
    );
  }

  private buildAiServiceFinanceReadonlySafeSummaryMockedReader(): StarkAiFinanceReadonlySafeSummaryReader {
    return {
      readBankSmsTransactionSmsClassificationSummary: () => [
        {
          safeSourceName: 'bank_sms_transaction_sms_classification_summary',
          safeRecordId:
            'bank-sms-transaction-sms-classification-safe-review-1',
          evidenceStatus: 'pending',
          reconciliationStatus: 'sms_classified_pending_binding',
          amountBucket: 'amount_bucket_review_only',
          riskLevel: 'review',
          blockerLabel: 'formal_account_binding_required',
          maskedAccountTail: 'tail_8030',
          counterpartyPresence: 'present',
          invoiceOrReceivableState: 'not_provided',
          sourceFinality: 'non_final',
        },
      ],
      readFinanceReconciliationLinkSummary: () => [
        {
          safeSourceName: 'finance_reconciliation_link_summary',
          safeRecordId: 'finance-reconciliation-link-safe-review-1',
          evidenceStatus: 'confirmed',
          reconciliationStatus: 'matched_confirmed',
          amountBucket: 'amount_bucket_confirmed_aggregate',
          riskLevel: 'info',
          blockerLabel: 'no_blocker_label',
          maskedAccountTail: 'tail_9012',
          counterpartyPresence: 'present',
          invoiceOrReceivableState: 'receivable_linked',
        },
      ],
      readFinanceReceivableTrackingSummary: () => [
        {
          safeSourceName: 'finance_receivable_tracking_summary',
          safeRecordId: 'finance-receivable-tracking-safe-review-1',
          evidenceStatus: 'inferred',
          reconciliationStatus: 'aging_review',
          amountBucket: 'amount_bucket_overdue_review',
          riskLevel: 'warning',
          blockerLabel: 'receivable_overdue_review',
          maskedAccountTail: null,
          counterpartyPresence: 'missing',
          invoiceOrReceivableState: 'receivable_overdue',
          sourceFinality: 'non_final',
        },
      ],
      readFinanceCollectionOrderSummary: () => [
        {
          safeSourceName: 'finance_collection_order_summary',
          safeRecordId: 'finance-collection-order-safe-review-1',
          evidenceStatus: 'reference_only',
          reconciliationStatus: 'collection_order_review',
          amountBucket: 'amount_bucket_reference_only',
          riskLevel: 'review',
          blockerLabel: 'association_coverage_missing',
          maskedAccountTail: '1234',
          counterpartyPresence: 'present',
          invoiceOrReceivableState: 'collection_review_only',
          sourceFinality: 'review_only',
        },
      ],
      readPaymentRecordsSummary: () => [
        {
          safeSourceName: 'payment_records_summary',
          safeRecordId: 'payment-records-safe-review-1',
          evidenceStatus: 'pending',
          reconciliationStatus: 'payment_state_review',
          amountBucket: 'amount_bucket_payment_review',
          riskLevel: 'review',
          blockerLabel: 'provider_safe_aggregate_only',
          maskedAccountTail: null,
          counterpartyPresence: 'not_provided',
          invoiceOrReceivableState: 'payment_record_review_only',
          sourceFinality: 'non_final',
        },
        {
          safeSourceName: 'payment_records_summary',
          safeRecordId: 'payment-records-blocked-review-fact-1',
          evidenceStatus: 'pending',
          reconciliationStatus: 'payment_state_review',
          amountBucket: 'amount_bucket_payment_review',
          riskLevel: 'warning',
          blockerLabel: 'safe_reader_blocked_review_fact',
          maskedAccountTail: 'account_tail_needs_review',
          counterpartyPresence: 'not_provided',
          invoiceOrReceivableState: 'payment_record_review_only',
          sourceFinality: 'reference_only',
        },
      ],
      readWorkOrdersPaymentCollectionReferenceSummary: () => [
        {
          safeSourceName:
            'work_orders_payment_collection_reference_summary',
          safeRecordId: 'work-orders-payment-reference-safe-review-1',
          evidenceStatus: 'uncertain',
          reconciliationStatus: 'work_order_reference_review',
          amountBucket: 'amount_bucket_unknown',
          riskLevel: 'warning',
          blockerLabel: 'payment_collection_reference_gap',
          maskedAccountTail: null,
          counterpartyPresence: 'missing',
          invoiceOrReceivableState: 'work_order_reference_only',
          sourceFinality: 'review_only',
        },
      ],
    };
  }

  private buildDatabaseSafeSummaryBatchSummary(
    batch: readonly StarkAiDatabaseSafeSummaryEnvelope[],
  ): Record<string, unknown> {
    const permissionResults = batch.reduce<Record<string, number>>(
      (results, envelope) => {
        const key = envelope.audit.permissionResult;
        results[key] = (results[key] ?? 0) + 1;
        return results;
      },
      {},
    );
    const blockedSummaryCount = batch.filter(
      (envelope) => envelope.audit.blocked === true,
    ).length;
    const safeBoundaryCounterTotals = this.sumDatabaseSafeSummaryCounters(
      batch,
      [
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
      ],
      (envelope) => envelope.safeBoundaryFlags,
    );
    const redactionDetectionTotals = this.sumDatabaseSafeSummaryCounters(
      batch,
      [
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
      ],
      (envelope) => envelope.redactionReport.detectionCounts,
    );

    return {
      totalSummaries: batch.length,
      allowedSummaryCount: batch.length - blockedSummaryCount,
      blockedSummaryCount,
      blockedReviewFactCount: blockedSummaryCount,
      summaryTypes: [...new Set(batch.map((envelope) => envelope.summaryType))],
      permissionResults,
      safeBoundaryCounterTotals,
      redactionDetectionTotals,
      allSafeSummaryCountersZero: [
        ...Object.values(safeBoundaryCounterTotals),
        ...Object.values(redactionDetectionTotals),
      ].every((count) => count === 0),
      sourcePolicy: 'synthetic_or_already_safe_inputs_only',
      noRealDatabaseReadPerformed: true,
      noDatabaseWritePerformed: true,
      blockedSummariesAreReviewFactsOnly: true,
      blockedSummariesCanCreateAction: false,
      canDispatchFromSummary: false,
      canCreateTaskFromSummary: false,
      canMutateLifecycleFromSummary: false,
      canWriteDatabaseFromSummary: false,
      canExecuteBusinessActionFromSummary: false,
    };
  }

  private sumDatabaseSafeSummaryCounters(
    batch: readonly StarkAiDatabaseSafeSummaryEnvelope[],
    counterNames: readonly string[],
    getCounters: (
      envelope: StarkAiDatabaseSafeSummaryEnvelope,
    ) => Record<string, unknown>,
  ): Record<string, number> {
    const totals = Object.fromEntries(
      counterNames.map((counterName) => [counterName, 0]),
    ) as Record<string, number>;

    for (const envelope of batch) {
      const counters = getCounters(envelope);
      for (const counterName of counterNames) {
        const value = counters[counterName];
        totals[counterName] +=
          typeof value === 'number' && Number.isFinite(value) ? value : 0;
      }
    }

    return totals;
  }

  private buildStarkAiSyncPacketCurrentSystemState(): Record<string, unknown> {
    return {
      stage: 'S1-04 / SAFE',
      mode: 'SAFE',
      activeModule:
        'Stark AI sync packet ChatGPT review response validation safe summary',
      source: 'ai_service_internal_safe_summaries',
      landedAiMainlineSummary: this.buildStarkAiSyncPacketLandedAiMainlineSummary(),
      protectedScope: [
        'backend-only',
        'internal assistant output',
        'normalizedPayload review artifact',
        'contact phone policy safe summary only',
        'ChatGPT review response validation safe summary only',
        'synthetic fixtures only',
        'no API',
        'no frontend',
        'no MCP gateway',
        'no live gateway',
        'no voice integration',
        'no database read or write',
        'no business execution',
        'no customer contact execution',
        'no real phone data',
        'database safe summaries are synthetic or already-safe inputs only',
      ],
    };
  }

  private buildStarkAiSyncPacketLandedAiMainlineSummary(): Record<string, unknown> {
    return {
      summaryName: 'landed_ai_mainline_summary',
      landedInternalSurfaces: [
        'taskDraftReviewReadAuditSummary',
        'manualTaskBridgeCandidateSummary',
        'manualTaskBridgeDispatchReadinessSummary',
        'manualTaskBridgeEmployeeHandoffPreviewSummary',
        'contactPhonePolicySummary',
        'chatGptContactPhoneReviewResponseValidationSummary',
        'databaseSafeSummaryBatch',
        'databaseSafeSummarySummary',
        'starkAiSyncPacketJson',
        'starkAiSyncPacketMarkdown',
        'starkAiSyncPacketSummary',
      ],
      reviewOnly: true,
      draftOnly: true,
      executable: false,
      databaseReadAllowedThisRound: false,
      databaseWriteAllowed: false,
      businessExecutionAllowed: false,
    };
  }

  private buildStarkAiSyncPacketZeroSafeBoundaryFlags(): Record<string, number> {
    return {
      databaseWriteCounter: 0,
      businessWriteCounter: 0,
      dispatchCounter: 0,
      taskCreationCounter: 0,
      lifecycleMutationCounter: 0,
      paymentOrCollectionMutationCounter: 0,
      workOrderMutationCounter: 0,
      virtualLedgerMutationCounter: 0,
    };
  }

  private buildStarkAiSyncPacketSummary(
    packet: StarkAiSyncPacket,
    markdown: string,
    sourceSummaryNames: readonly string[],
  ): Record<string, unknown> {
    return {
      packetVersion: packet.packetVersion,
      packetStatus: packet.packetStatus,
      chatGptHandoffAllowed: packet.chatGptHandoffAllowed,
      jsonFieldCount: Object.keys(packet).length,
      markdownLength: markdown.length,
      blockedReasonCount: packet.blockedReasons.length,
      blockedReasons: packet.blockedReasons,
      sourceSummaryNames: [...sourceSummaryNames],
      employeeHandoffPreviewSummaryIncluded:
        packet.employeeHandoffPreviewSummary !== null,
      landedAiMainlineSummaryIncluded: JSON.stringify(
        packet.aiCapabilitySummary,
      ).includes('landed_ai_mainline_summary'),
      contactPhonePolicySummaryIncluded:
        packet.contactPhonePolicySummary.fragmentCount > 0,
      contactPhonePolicySummary: packet.contactPhonePolicySummary,
      chatGptContactPhoneReviewResponseValidationSummaryIncluded:
        packet.chatGptContactPhoneReviewResponseValidationSummary
          .validFixtureCount > 0 ||
        packet.chatGptContactPhoneReviewResponseValidationSummary
          .blockedFixtureCount > 0,
      chatGptContactPhoneReviewResponseValidationSummary:
        packet.chatGptContactPhoneReviewResponseValidationSummary,
      databaseSafeSummaryBatchIncluded:
        Array.isArray(packet.databaseSafeSummaryBatch) &&
        packet.databaseSafeSummaryBatch.length > 0,
      databaseSafeSummarySummary: packet.databaseSafeSummarySummary,
      redactionApplied: packet.redactionReport.redactionApplied,
      sensitiveInputDetected: packet.redactionReport.sensitiveInputDetected,
      safeBoundaryFlags: {
        databaseWriteCounter: packet.safeBoundaryFlags.databaseWriteCounter,
        businessWriteCounter: packet.safeBoundaryFlags.businessWriteCounter,
        dispatchCounter: packet.safeBoundaryFlags.dispatchCounter,
        taskCreationCounter: packet.safeBoundaryFlags.taskCreationCounter,
        lifecycleMutationCounter: packet.safeBoundaryFlags.lifecycleMutationCounter,
        paymentOrCollectionMutationCounter:
          packet.safeBoundaryFlags.paymentOrCollectionMutationCounter,
        workOrderMutationCounter: packet.safeBoundaryFlags.workOrderMutationCounter,
        virtualLedgerMutationCounter:
          packet.safeBoundaryFlags.virtualLedgerMutationCounter,
      },
      reviewOnly: packet.safeBoundaryFlags.reviewOnly,
      databaseReadAllowedThisRound:
        packet.safeBoundaryFlags.databaseReadAllowedThisRound,
      databaseWriteAllowed: packet.safeBoundaryFlags.databaseWriteAllowed,
      businessExecutionAllowed: packet.safeBoundaryFlags.businessExecutionAllowed,
    };
  }

  private resolveEmployeeHandoffPreviewViewerRoleFromCurrentUserRoles(
    roleCodes: readonly string[] | null | undefined,
  ): string | null {
    const aliases: Record<string, string> = {
      owner: 'owner',
      founder: 'owner',
      admin: 'admin',
      system_admin: 'admin',
      super_admin: 'admin',
      finance: 'finance',
      finance_manager: 'finance',
      finance_operator: 'finance',
      reviewer: 'reviewer',
      approver: 'reviewer',
      operator: 'operator',
      ai_operator: 'operator',
      store_manager: 'operator',
      customer_service: 'customer_service',
      customer_support: 'customer_service',
    };
    for (const roleCode of roleCodes ?? []) {
      const normalized = this.normalizePolicyToken(roleCode);
      const viewerRole = aliases[normalized];
      if (viewerRole) {
        return viewerRole;
      }
    }
    return null;
  }

  private buildTaskDraftReviewCandidateTitle(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): string {
    const draftType = this.resolveTaskDraftReviewProposedDraftType(evaluation);
    if (draftType === 'evidence_collection_checklist') {
      return 'Evidence collection checklist draft';
    }
    if (draftType === 'investigation_task') {
      return 'Investigation task draft';
    }
    if (draftType === 'handoff_note') {
      return 'Human handoff note draft';
    }
    if (draftType === 'approval_prefill') {
      return 'Approval prefill draft';
    }
    if (draftType === 'confirmation_required_draft') {
      return 'Confirmation required draft';
    }
    return 'Manual review task draft';
  }

  private buildTaskDraftReviewCandidateSummary(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): string {
    if (evaluation.policy.actionPermissionLevel === 'human_confirmation_required') {
      return 'Prepare non-executable review material that requires explicit human confirmation and backend authorization.';
    }
    if (evaluation.candidate.reason) {
      return evaluation.candidate.reason;
    }
    return 'Prepare a non-executable review artifact from a policy-gated suggested action.';
  }

  private buildTaskDraftReviewChecklistItems(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): string[] {
    if (evaluation.candidate.missingEvidence.length > 0) {
      return evaluation.candidate.missingEvidence.map(
        (item) => `Collect safe evidence category: ${item}`,
      );
    }
    if (evaluation.policy.actionPermissionLevel === 'human_confirmation_required') {
      return [
        'Review policy trace.',
        'Require explicit human confirmation before any business action.',
      ];
    }
    return ['Review policy trace and source context.'];
  }

  private buildTaskDraftReviewBoundaryExplanations(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): string[] {
    const explanations = [
      this.resolveBoundaryExplanationText(evaluation.policy.actionPermissionLevel),
    ];
    if (evaluation.policy.actionPermissionLevel === 'human_confirmation_required') {
      explanations.push(
        'Human confirmation and backend permission checks are required before any business action.',
      );
    }
    return this.uniqueStrings(explanations);
  }

  private resolveTaskDraftReviewProposedDraftType(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): string | null {
    const level = evaluation.policy.actionPermissionLevel;
    const proposedDraftType = this.normalizePolicyToken(
      evaluation.candidate.proposedDraftType,
    );
    if (proposedDraftType) {
      return proposedDraftType;
    }
    const actionCode = this.normalizePolicyToken(
      evaluation.candidate.proposedAssistantActionCode,
    );

    if (level === 'human_confirmation_required') {
      if (actionCode === 'prepare_approval_material') {
        return 'approval_prefill';
      }
      return 'confirmation_required_draft';
    }
    if (actionCode === 'collect_evidence') {
      return 'evidence_collection_checklist';
    }
    if (actionCode === 'handoff_to_finance') {
      return 'handoff_note';
    }
    if (actionCode.includes('investigation') || actionCode.includes('diagnostic')) {
      return 'investigation_task';
    }
    if (
      actionCode === 'request_manual_review' ||
      actionCode === 'draft_review_task' ||
      actionCode === 'create_manual_review_draft'
    ) {
      return 'manual_review_task';
    }
    return null;
  }

  private resolveSuggestedActionPolicyDraftType(
    rawActionCode: string,
    proposedActionCode: string,
  ): string | null {
    const raw = this.normalizePolicyToken(rawActionCode);
    const proposed = this.normalizePolicyToken(proposedActionCode);
    const signal = `${raw}_${proposed}`;

    if (proposed === 'prepare_approval_material') {
      return 'approval_prefill';
    }
    if (
      this.policyTextHasAny(signal, [
        'prepare_collection_order_draft_material',
        'prepare_payment_request_draft_material',
        'prepare_work_order_update_material',
        'prepare_virtual_ledger_adjustment_material',
        'prepare_employee_benefit_issue_draft',
      ])
    ) {
      return 'confirmation_required_draft';
    }
    if (proposed === 'collect_evidence') {
      return 'evidence_collection_checklist';
    }
    if (proposed === 'handoff_to_finance') {
      return 'handoff_note';
    }
    if (this.policyTextHasAny(signal, ['investigation', 'diagnostic'])) {
      return 'investigation_task';
    }
    if (
      proposed === 'request_manual_review' ||
      proposed === 'draft_review_task' ||
      proposed === 'create_manual_review_draft'
    ) {
      return 'manual_review_task';
    }
    return null;
  }

  private uniqueStrings(values: readonly (string | null | undefined)[]): string[] {
    return [
      ...new Set(
        values
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0),
      ),
    ];
  }

  private createSuggestedActionPolicyCandidate(input: {
    candidateId: string;
    source: string;
    actionCode: string;
    proposedAssistantActionCode: string;
    proposedAssistantSurface: string;
    proposedDraftType: string | null;
    focusObject: AiAssistantFocusObject | null;
    targetEntityType: string | null;
    targetEntityId: string | number | null;
    blockers: readonly string[];
    sourceActionId?: string | null;
    sourceModule?: string | null;
    eventType?: string | null;
    riskLevel?: string | null;
    currentStatus?: string | null;
    missingEvidence?: readonly string[] | null;
    suggestedNextSteps?: readonly string[] | null;
    forbiddenActions?: readonly string[] | null;
    sourceBundleIds?: readonly string[] | null;
    currentUserRoleCodes: string[];
    reason?: string | null;
    questionType?: AiAssistantQuestionType | null;
  }): AiSuggestedActionPolicyCandidate {
    const targetEntityType = input.targetEntityType ?? input.focusObject?.entityType ?? null;
    const riskText = this.normalizePolicyToken(input.riskLevel);
    const actionCodeForDomain = this.resolveDomainSignalActionCode(input.actionCode);
    const domainSignalText = [
      actionCodeForDomain,
      targetEntityType,
      input.focusObject?.sourceTable,
      input.sourceModule,
      input.eventType,
      input.currentStatus,
      input.questionType,
      ...input.blockers,
    ]
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => this.normalizePolicyToken(item))
      .join('_');
    const signalText = [
      domainSignalText,
      this.normalizePolicyToken(input.proposedAssistantActionCode),
      this.normalizePolicyToken(input.proposedDraftType),
    ]
      .filter((item) => item.length > 0)
      .join('_');

    let touchesMoney = this.policyTextHasAny(domainSignalText, [
      'finance',
      'payment',
      'bank',
      'sms',
      'collection',
      'payout',
      'reconcile',
      'approval_request',
      'receivable',
      'amount',
    ]);
    let touchesWorkOrderStatus = this.policyTextHasAny(domainSignalText, [
      'work_order',
      'work_orders',
      'status',
      'amount_received',
    ]);
    let touchesCustomerRights = this.policyTextHasAny(domainSignalText, [
      'customer_right',
      'customer_rights',
      'customer_binding',
      'confirm_binding',
    ]);
    let touchesPayroll = this.policyTextHasAny(domainSignalText, ['payroll', 'salary', 'wage']);
    let touchesBenefits = this.policyTextHasAny(domainSignalText, [
      'benefit',
      'benefits',
      'welfare',
      'employee_benefit',
    ]);
    let touchesVirtualLedger = this.policyTextHasAny(domainSignalText, [
      'virtual_ledger',
      'ledger',
      'points',
      'point',
      'abc_score',
      'redemption',
    ]);
    let createsBusinessObject = this.policyTextHasAny(signalText, [
      'create',
      'issue',
      'draft_material',
    ]);
    let mutatesBusinessState = this.policyTextHasAny(signalText, [
      'confirm',
      'execute',
      'update',
      'mutate',
      'ignore',
      'reconcile',
      'mark',
      'adjust',
      'revoke',
      'apply',
      'fulfill',
    ]);
    let usesProductionConnector = this.policyTextHasAny(signalText, [
      'wechat',
      'real_pay',
      'production_connector',
    ]);
    const readOnlyCandidate = [
      'explain',
      'explain_context',
      'explain_blocker',
      'explain_historical_result',
      'explain_no_candidate_diagnostic',
      'review_context',
      'summarize_history',
      'suggest_next_steps',
      'suggest_missing_evidence',
      'suggest_manual_review',
    ].includes(this.normalizePolicyToken(input.proposedAssistantActionCode));
    if (readOnlyCandidate) {
      touchesMoney = false;
      touchesWorkOrderStatus = false;
      touchesCustomerRights = false;
      touchesPayroll = false;
      touchesBenefits = false;
      touchesVirtualLedger = false;
      createsBusinessObject = false;
      mutatesBusinessState = false;
      usesProductionConnector = false;
    }

    return {
      candidateId: input.candidateId,
      source: input.source,
      sourceModule:
        input.sourceModule ??
        this.resolveSuggestedActionPolicySourceModule(input.actionCode, targetEntityType),
      sourceEntityType: targetEntityType,
      eventType: input.eventType ?? this.normalizePolicyToken(input.actionCode),
      riskLevel: input.riskLevel ?? (riskText || null),
      proposedAssistantActionCode: input.proposedAssistantActionCode,
      proposedAssistantSurface: input.proposedAssistantSurface,
      proposedDraftType: input.proposedDraftType,
      touchesMoney,
      touchesWorkOrderStatus,
      touchesCustomerRights,
      touchesPayroll,
      touchesBenefits,
      touchesVirtualLedger,
      createsBusinessObject,
      mutatesBusinessState,
      usesProductionConnector,
      sourceBundleIds: [...(input.sourceBundleIds ?? [])],
      targetEntityType,
      targetEntityId: input.targetEntityId ?? input.focusObject?.entityId ?? null,
      currentStatus: input.currentStatus ?? null,
      missingEvidence: [...(input.missingEvidence ?? [])].filter(
        (item) => typeof item === 'string' && item.trim().length > 0,
      ),
      suggestedNextSteps: [...(input.suggestedNextSteps ?? [])].filter(
        (item) => typeof item === 'string' && item.trim().length > 0,
      ),
      forbiddenActions: [...(input.forbiddenActions ?? [])],
      currentUserRoleCodes: input.currentUserRoleCodes,
      reason: input.reason ?? null,
    };
  }

  private resolveDomainSignalActionCode(actionCode: string): string | null {
    const normalized = this.normalizePolicyToken(actionCode);
    if (
      [
        'collect_evidence',
        'create_evidence_collection_task_draft',
        'draft_review_task',
        'create_manual_review_draft',
        'request_manual_review',
        'handoff_to_finance',
        'draft_engagement_task',
      ].includes(normalized)
    ) {
      return null;
    }
    return actionCode;
  }

  private buildSuggestedActionsPolicyForAssistantOutput(input: {
    rawSuggestedActions: readonly Record<string, unknown>[];
    focusObject: AiAssistantFocusObject | null;
    blockers: readonly string[];
    sourceActionId: string | null;
    policyContext?: AiSuggestedActionPolicyContext | null;
  }): AiSuggestedActionPolicyApplication {
    const operationLogContextBundles =
      input.policyContext?.operationLogContextBundles ??
      this.readOperationLogContextBundlesFromFocusObject(input.focusObject);
    const candidates = this.buildSuggestedActionPolicyCandidates({
      rawSuggestedActions: input.rawSuggestedActions,
      focusObject: input.focusObject,
      blockers: input.blockers,
      sourceActionId: input.sourceActionId,
      currentUserRoleCodes: input.policyContext?.currentUserRoleCodes ?? null,
      operationLogContextBundles,
      source: input.policyContext?.source ?? 'ai_service_suggested_action',
    });

    return this.applySuggestedActionPolicyResults(
      this.evaluateSuggestedActionPolicyCandidates(candidates),
    );
  }

  private buildSuggestedCommandDraftPolicyForAssistantOutput(input: {
    rawSuggestedCommandDraft: Record<string, unknown> | null;
    focusObject: AiAssistantFocusObject | null;
    pageContext: AiPageContextResponse;
    primarySuggestion: string;
    questionType: AiAssistantQuestionType;
    currentUserRoleCodes?: readonly string[] | null;
  }): AiSuggestedActionPolicyApplication {
    if (!input.rawSuggestedCommandDraft) {
      const manualTaskBridgeDispatchReadiness =
        this.buildManualTaskBridgeDispatchReadiness([]);
      const manualTaskBridgeEmployeeHandoffPreview =
        this.buildManualTaskBridgeEmployeeHandoffPreviews(
          [],
          manualTaskBridgeDispatchReadiness.readinessItems,
        );
      return {
        allowedSuggestedActions: [],
        blockedSuggestedActions: [],
        boundaryExplanations: [],
        suggestedActionsPolicyTrace: [],
        suggestedCommandDraftPolicy: null,
        suggestedCommandDraft: null,
        taskDraftReviewArtifacts: [],
        taskDraftReviewArtifactSummary: this.buildTaskDraftReviewArtifactSummary(
          [],
          [],
        ),
        taskDraftReviewPolicyTrace: [],
        taskDraftReviewReadAuditViews: [],
        taskDraftReviewReadAuditSummary:
          this.buildTaskDraftReviewReadAuditSummary([]),
        manualTaskBridgeCandidates: [],
        manualTaskBridgeCandidateSummary:
          this.buildManualTaskBridgeCandidateSummary([]),
        manualTaskBridgeDispatchReadiness:
          manualTaskBridgeDispatchReadiness.readinessItems,
        manualTaskBridgeDispatchReadinessSummary:
          manualTaskBridgeDispatchReadiness.summary,
        manualTaskBridgeEmployeeHandoffPreviews:
          manualTaskBridgeEmployeeHandoffPreview.previews,
        manualTaskBridgeEmployeeHandoffPreviewSummary:
          manualTaskBridgeEmployeeHandoffPreview.summary,
      };
    }
    const candidates = this.buildSuggestedActionPolicyCandidates({
      rawSuggestedCommandDraft: input.rawSuggestedCommandDraft,
      focusObject: input.focusObject,
      blockers: input.pageContext.blockers,
      sourceActionId: input.pageContext.pageInfo.sourceActionId,
      currentUserRoleCodes: input.currentUserRoleCodes ?? null,
      source: 'ai_service_suggested_command_draft',
      questionType: input.questionType,
      primarySuggestion: input.primarySuggestion,
    });

    return this.applySuggestedActionPolicyResults(
      this.evaluateSuggestedActionPolicyCandidates(candidates),
      input.rawSuggestedCommandDraft,
      input.questionType,
    );
  }

  private buildPolicyGatedSuggestedAction(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): Record<string, unknown> | null {
    const level = evaluation.policy.actionPermissionLevel;
    if (level === 'explain_only' || level === 'forbidden_for_ai') {
      return null;
    }

    const safeLabel = this.pickSafeSuggestedActionLabel(evaluation);
    const actionType =
      level === 'human_confirmation_required'
        ? 'request_human_confirmation'
        : safeLabel;
    return {
      actionType,
      label: safeLabel,
      policyLevel: level,
      allowedAssistantSurface: evaluation.policy.allowedAssistantSurface,
      requiresHumanConfirmation: evaluation.policy.requiresHumanConfirmation,
      requiresOwnerApproval: evaluation.policy.requiresOwnerApproval,
      targetEntityType: evaluation.candidate.targetEntityType,
      targetEntityId: evaluation.candidate.targetEntityId,
      sourceBundleIds: evaluation.candidate.sourceBundleIds,
      policyCandidateId: evaluation.candidate.candidateId,
      reasonCodes: evaluation.policy.reasonCodes,
    };
  }

  private buildPolicyGatedSuggestedCommandDraft(
    rawDraft: Record<string, unknown> | null,
    evaluation: AiSuggestedActionPolicyEvaluation,
    questionType: AiAssistantQuestionType | null,
  ): Record<string, unknown> | null {
    const level = evaluation.policy.actionPermissionLevel;
    if (!rawDraft || level === 'explain_only' || level === 'suggest_only' || level === 'forbidden_for_ai') {
      return null;
    }
    const base = this.sanitizeSuggestedCommandDraft(rawDraft);
    const draftType =
      level === 'human_confirmation_required'
        ? 'confirmation_required_draft'
        : 'task_draft';

    return {
      ...base,
      draftType,
      policyLevel: level,
      policyCandidateId: evaluation.candidate.candidateId,
      requiresHumanConfirmation: evaluation.policy.requiresHumanConfirmation,
      requiresOwnerApproval: evaluation.policy.requiresOwnerApproval,
      allowedDraftTypes: evaluation.policy.allowedDraftTypes,
      allowedAssistantSurface: evaluation.policy.allowedAssistantSurface,
      reasonCodes: evaluation.policy.reasonCodes,
      questionType,
    };
  }

  private sanitizeSuggestedCommandDraft(
    rawDraft: Record<string, unknown>,
  ): Record<string, unknown> {
    const targetEntity = this.readObjectObject(rawDraft, 'targetEntity');
    return {
      targetEntity: targetEntity
        ? {
            routePath: this.sanitizePolicyTextValue(this.readObjectString(targetEntity, 'routePath')),
            entityType: this.sanitizePolicyTextValue(this.readObjectString(targetEntity, 'entityType')),
            entityId: this.sanitizePolicyEntityId(
              this.readObjectString(targetEntity, 'entityId') ??
              this.readObjectNumber(targetEntity, 'entityId'),
            ),
            sourceActionId: this.sanitizePolicyTextValue(
              this.readObjectString(targetEntity, 'sourceActionId'),
            ),
            sourceTable: this.sanitizePolicyTextValue(this.readObjectString(targetEntity, 'sourceTable')),
            sourceId: this.sanitizePolicyEntityId(
              this.readObjectString(targetEntity, 'sourceId') ??
              this.readObjectNumber(targetEntity, 'sourceId'),
            ),
          }
        : null,
      suggestedAction: this.pickSafeCommandDraftLabel(rawDraft),
      suggestedReason: 'policy_gated_read_only_draft',
      suggestedScope:
        this.sanitizePolicyTextValue(this.readObjectString(rawDraft, 'suggestedScope')) ??
        'case_only',
      suggestedJudgmentBasis: this.readObjectArray(rawDraft, 'suggestedJudgmentBasis').filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      ).map((item) => this.sanitizePolicyTextValue(item)).filter((item): item is string => Boolean(item)),
      suggestedAiLearningMode:
        this.sanitizePolicyTextValue(this.readObjectString(rawDraft, 'suggestedAiLearningMode')) ??
        'do_not_generalize',
      requestSource: 'ai_assistant_policy_gated_draft',
      sourceActionId: this.sanitizePolicyTextValue(this.readObjectString(rawDraft, 'sourceActionId')),
      rewardDomain: this.sanitizePolicyTextValue(this.readObjectString(rawDraft, 'rewardDomain')),
      sourceOfTruth: this.sanitizePolicyTextValue(this.readObjectString(rawDraft, 'sourceOfTruth')),
      periodKey: this.sanitizePolicyTextValue(this.readObjectString(rawDraft, 'periodKey')),
      sourceType: this.sanitizePolicyTextValue(this.readObjectString(rawDraft, 'sourceType')),
      affectPerformanceFlag: rawDraft.affectPerformanceFlag === true,
      affectBCardFlag: rawDraft.affectBCardFlag === true,
    };
  }

  private buildSuggestedActionPolicyTrace(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): Record<string, unknown> {
    return {
      candidateId: evaluation.candidate.candidateId,
      source: evaluation.candidate.source,
      sourceModule: evaluation.candidate.sourceModule,
      sourceEntityType: evaluation.candidate.sourceEntityType,
      eventType: evaluation.candidate.eventType,
      proposedAssistantActionCode: evaluation.candidate.proposedAssistantActionCode,
      proposedAssistantSurface: evaluation.candidate.proposedAssistantSurface,
      proposedDraftType: evaluation.candidate.proposedDraftType,
      actionPermissionLevel: evaluation.policy.actionPermissionLevel,
      allowedAssistantSurface: evaluation.policy.allowedAssistantSurface,
      requiresHumanConfirmation: evaluation.policy.requiresHumanConfirmation,
      requiresOwnerApproval: evaluation.policy.requiresOwnerApproval,
      allowedDraftTypes: evaluation.policy.allowedDraftTypes,
      reasonCodes: evaluation.policy.reasonCodes,
      sourceBundleIds: evaluation.candidate.sourceBundleIds,
    };
  }

  private buildBlockedSuggestedAction(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): Record<string, unknown> {
    return {
      candidateId: evaluation.candidate.candidateId,
      source: evaluation.candidate.source,
      proposedAssistantActionCode: evaluation.candidate.proposedAssistantActionCode,
      actionPermissionLevel: evaluation.policy.actionPermissionLevel,
      forbiddenActionCodes: evaluation.policy.forbiddenActionCodes,
      reasonCodes: evaluation.policy.reasonCodes,
      targetEntityType: evaluation.candidate.targetEntityType,
      targetEntityId: evaluation.candidate.targetEntityId,
    };
  }

  private buildBoundaryExplanation(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): Record<string, unknown> {
    return {
      candidateId: evaluation.candidate.candidateId,
      source: evaluation.candidate.source,
      actionPermissionLevel: evaluation.policy.actionPermissionLevel,
      boundary: this.resolveBoundaryExplanationText(evaluation.policy.actionPermissionLevel),
      reasonCodes: evaluation.policy.reasonCodes,
      requiresHumanConfirmation: evaluation.policy.requiresHumanConfirmation,
      requiresOwnerApproval: evaluation.policy.requiresOwnerApproval,
    };
  }

  private buildSuggestedCommandDraftPolicy(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): Record<string, unknown> {
    return {
      candidateId: evaluation.candidate.candidateId,
      actionPermissionLevel: evaluation.policy.actionPermissionLevel,
      allowedAssistantSurface: evaluation.policy.allowedAssistantSurface,
      allowedDraftTypes: evaluation.policy.allowedDraftTypes,
      requiresHumanConfirmation: evaluation.policy.requiresHumanConfirmation,
      requiresOwnerApproval: evaluation.policy.requiresOwnerApproval,
      forbiddenActionCodes: evaluation.policy.forbiddenActionCodes,
      reasonCodes: evaluation.policy.reasonCodes,
      auditRequirement: evaluation.policy.auditRequirement,
    };
  }

  private resolveSuggestedActionPolicyActionCode(
    rawActionCode: string,
    targetEntityType: string | null,
    isCommandDraft: boolean,
  ): string {
    const action = this.normalizePolicyToken(rawActionCode);
    const target = this.normalizePolicyToken(targetEntityType);
    const signal = `${action}_${target}`;

    if (this.policyTextHasAny(signal, ['confirm_bank_sms_apply'])) {
      return 'confirm_bank_sms_apply';
    }
    if (this.policyTextHasAny(signal, ['confirm_bank_sms'])) {
      return 'confirm_bank_sms';
    }
    if (this.policyTextHasAny(signal, ['ignore_bank_sms'])) {
      return 'ignore_bank_sms';
    }
    if (this.policyTextHasAny(signal, ['reconcile_bank_sms'])) {
      return 'reconcile_bank_sms';
    }
    if (this.policyTextHasAny(signal, ['create_payment_record', 'paymentrecordsservice_create'])) {
      return 'create_payment_record';
    }
    if (this.policyTextHasAny(signal, ['update_work_order_status'])) {
      return 'update_work_order_status';
    }
    if (this.policyTextHasAny(signal, ['update_work_order_amount_received', 'amount_received'])) {
      return 'update_work_order_amount_received';
    }
    if (this.policyTextHasAny(signal, ['execute_payment', 'real_payment'])) {
      return 'execute_payment';
    }
    if (this.policyTextHasAny(signal, ['invoke_real_wechat_pay', 'wechat_pay'])) {
      return 'invoke_real_wechat_pay';
    }
    if (this.policyTextHasAny(signal, ['mutate_virtual_ledger'])) {
      return 'mutate_virtual_ledger';
    }
    if (this.policyTextHasAny(signal, ['confirm_payroll'])) {
      return 'confirm_payroll';
    }
    if (this.policyTextHasAny(signal, ['issue_employee_benefits'])) {
      return 'issue_employee_benefits';
    }
    if (this.policyTextHasAny(signal, ['confirm_customer_rights'])) {
      return 'confirm_customer_rights';
    }
    if (this.policyTextHasAny(signal, ['bypass_approval_or_permission'])) {
      return 'bypass_approval_or_permission';
    }
    if (this.policyTextHasAny(signal, ['create_confirmed_collection_order'])) {
      return 'create_confirmed_collection_order';
    }
    if (this.policyTextHasAny(signal, ['create_collection_order'])) {
      return 'create_collection_order';
    }
    if (this.policyTextHasAny(signal, ['prepare_approval_material'])) {
      return 'prepare_approval_material';
    }
    if (this.policyTextHasAny(signal, ['prepare_collection_order_draft_material'])) {
      return 'prepare_collection_order_draft_material';
    }
    if (this.policyTextHasAny(signal, ['prepare_payment_request_draft_material'])) {
      return 'prepare_payment_request_draft_material';
    }
    if (this.policyTextHasAny(signal, ['prepare_work_order_update_material'])) {
      return 'prepare_work_order_update_material';
    }
    if (this.policyTextHasAny(signal, ['prepare_virtual_ledger_adjustment_material'])) {
      return 'prepare_virtual_ledger_adjustment_material';
    }
    if (this.policyTextHasAny(signal, ['prepare_employee_benefit_issue_draft'])) {
      return 'prepare_employee_benefit_issue_draft';
    }

    if (this.policyTextHasAny(signal, ['execute_points', 'execute_abc_points', 'mark_points'])) {
      return 'mutate_virtual_ledger';
    }
    if (this.policyTextHasAny(signal, ['confirm_points_welfare', 'execute_points_welfare'])) {
      return 'issue_employee_benefits';
    }
    if (this.policyTextHasAny(signal, ['confirm_points', 'confirm_abc_points'])) {
      return 'mutate_virtual_ledger';
    }

    if (isCommandDraft) {
      if (this.policyTextHasAny(signal, ['create_points_welfare_batch'])) {
        return 'prepare_employee_benefit_issue_draft';
      }
      if (
        this.policyTextHasAny(signal, [
          'issue_points',
          'adjust_points',
          'revoke_points',
          'issue_score',
          'adjust_score',
          'revoke_score',
          'create_points_redemption_request',
        ])
      ) {
        return 'prepare_virtual_ledger_adjustment_material';
      }
      if (this.policyTextHasAny(signal, ['confirm_binding'])) {
        return 'draft_review_task';
      }
      if (this.policyTextHasAny(signal, ['manual_decision'])) {
        return 'draft_review_task';
      }
      if (this.policyTextHasAny(signal, ['sheet_repair', 'reclassify_record'])) {
        return 'collect_evidence';
      }
      return action || 'review_context';
    }

    if (this.policyTextHasAny(signal, ['repair', 'missing', 'collect', 'sheet_repair'])) {
      return 'collect_evidence';
    }
    if (this.policyTextHasAny(signal, ['handoff'])) {
      return 'handoff_to_finance';
    }
    if (this.policyTextHasAny(signal, ['manual_decision', 'review'])) {
      return 'request_manual_review';
    }
    if (this.policyTextHasAny(signal, ['confirm_binding'])) {
      return 'draft_review_task';
    }
    return action || 'review_context';
  }

  private resolveContextBundleSuggestedActionCode(
    bundle: AiReadableOperationLogContextBundle,
  ): string {
    if (bundle.riskLevel === 'forbidden_for_ai_action') {
      return 'explain_historical_result';
    }
    if (bundle.riskLevel === 'finance_blocked') {
      return 'request_manual_review';
    }
    if (bundle.missingEvidence.length > 0) {
      return 'collect_evidence';
    }
    if (bundle.suggestedNextSteps.length > 0) {
      return 'suggest_next_steps';
    }
    if (bundle.eventType.includes('no_candidate')) {
      return 'explain_no_candidate_diagnostic';
    }
    return 'review_context';
  }

  private resolveSuggestedActionPolicySourceModule(
    rawActionCode: string,
    targetEntityType: string | null,
  ): string | null {
    const signal = `${this.normalizePolicyToken(rawActionCode)}_${this.normalizePolicyToken(targetEntityType)}`;
    if (this.policyTextHasAny(signal, ['bank_sms'])) return 'finance_bank_sms';
    if (this.policyTextHasAny(signal, ['collection_order'])) return 'finance_collection_order';
    if (this.policyTextHasAny(signal, ['payment_record', 'payment'])) return 'finance_payment_request';
    if (this.policyTextHasAny(signal, ['work_order'])) return 'work_orders';
    if (this.policyTextHasAny(signal, ['payroll'])) return 'payroll';
    if (this.policyTextHasAny(signal, ['benefit', 'welfare'])) return 'employee_benefits';
    if (this.policyTextHasAny(signal, ['points', 'ledger', 'redemption', 'abc_score'])) {
      return 'virtual_ledger';
    }
    if (this.policyTextHasAny(signal, ['execution_task', 'engagement'])) return 'engagement';
    return null;
  }

  private resolveSuggestedCommandDraftSurface(actionCode: string): string {
    const normalized = this.normalizePolicyToken(actionCode);
    if (
      this.policyTextHasAny(normalized, [
        'prepare_approval_material',
        'prepare_collection_order_draft_material',
        'prepare_payment_request_draft_material',
        'prepare_work_order_update_material',
        'prepare_virtual_ledger_adjustment_material',
        'prepare_employee_benefit_issue_draft',
      ])
    ) {
      return 'confirmation_required_draft';
    }
    return 'task_draft';
  }

  private resolveSuggestedCommandDraftPolicyDraftType(
    actionCode: string,
    rawDraftType: string,
  ): string | null {
    const normalized = this.normalizePolicyToken(actionCode);
    const raw = this.normalizePolicyToken(rawDraftType);
    if (
      ['review_context', 'explain', 'explain_context', 'explain_historical_result'].includes(
        normalized,
      )
    ) {
      return null;
    }
    if (this.resolveSuggestedCommandDraftSurface(normalized) === 'confirmation_required_draft') {
      return 'confirmation_required_draft';
    }
    if (this.policyTextHasAny(raw, ['handoff'])) return 'handoff_note';
    if (this.policyTextHasAny(raw, ['repair', 'reclassify', 'evidence'])) {
      return 'evidence_collection_checklist';
    }
    if (this.policyTextHasAny(raw, ['manual', 'review', 'binding'])) {
      return 'manual_review_task';
    }
    return null;
  }

  private pickSafeSuggestedActionLabel(
    evaluation: AiSuggestedActionPolicyEvaluation,
  ): string {
    const labels = evaluation.policy.safeSuggestedActionLabels;
    if (evaluation.policy.actionPermissionLevel === 'human_confirmation_required') {
      return labels.includes('request_human_confirmation')
        ? 'request_human_confirmation'
        : 'prepare_approval_material';
    }
    if (evaluation.policy.actionPermissionLevel === 'draft_task_allowed') {
      return labels.includes('request_manual_review')
        ? 'request_manual_review'
        : labels[0] ?? 'draft_review_task';
    }
    return labels[0] ?? 'review_context';
  }

  private pickSafeCommandDraftLabel(rawDraft: Record<string, unknown>): string {
    const rawDraftType = this.normalizePolicyToken(this.readObjectString(rawDraft, 'draftType'));
    if (this.policyTextHasAny(rawDraftType, ['points', 'score', 'redemption', 'welfare'])) {
      return 'prepare_human_confirmation_material';
    }
    if (this.policyTextHasAny(rawDraftType, ['repair', 'reclassify'])) {
      return 'collect_evidence';
    }
    if (this.policyTextHasAny(rawDraftType, ['manual', 'binding'])) {
      return 'draft_review_task';
    }
    return 'review_context';
  }

  private resolveBoundaryExplanationText(level: AiActionPermissionLevel): string {
    if (level === 'forbidden_for_ai') {
      return 'ai_cannot_execute_or_prepare_clickable_business_mutation';
    }
    if (level === 'human_confirmation_required') {
      return 'human_confirmation_and_backend_permission_check_required_before_execution';
    }
    if (level === 'suggest_only') {
      return 'suggestion_label_only_no_command_draft';
    }
    return 'read_only_explanation_only';
  }

  private resolveSuggestedActionPolicyReason(rawActionCode: string): string {
    const normalized = this.normalizePolicyToken(rawActionCode);
    return normalized || 'review_context';
  }

  private readOperationLogContextBundlesFromFocusObject(
    focusObject: AiAssistantFocusObject | null,
  ): AiReadableOperationLogContextBundle[] {
    const rawContext = (focusObject?.rawContext ?? {}) as Record<string, unknown>;
    const bundles = this.readObjectArray(rawContext, 'operationLogContextBundles');
    return bundles.filter(
      (item): item is AiReadableOperationLogContextBundle =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
    );
  }

  private buildOperationLogContextBundleId(
    bundle: AiReadableOperationLogContextBundle,
  ): string {
    return [
      bundle.sourceModule,
      bundle.sourceEntityType,
      bundle.sourceEntityId ?? 'unknown',
      bundle.sourceLogId ?? 'unknown',
      bundle.eventType,
    ]
      .map((item) => String(item).replace(/[^a-zA-Z0-9_-]+/g, '_'))
      .join(':');
  }

  private normalizeAssistantPolicyRoleCodes(
    roleCodes: readonly string[] | null | undefined,
  ): string[] {
    const normalized = new Set<string>();
    for (const roleCode of roleCodes ?? []) {
      const role = this.normalizePolicyToken(roleCode);
      if (!role) {
        continue;
      }
      normalized.add(role);
      if (role === 'finance') {
        normalized.add('finance_operator');
      }
      if (role === 'super_admin') {
        normalized.add('admin');
      }
    }
    return [...normalized];
  }

  private policyTextHasAny(text: string, patterns: readonly string[]): boolean {
    return patterns.some((pattern) => text.includes(this.normalizePolicyToken(pattern)));
  }

  private sanitizePolicyEntityId(value: string | number | null | undefined): string | number | null {
    if (typeof value === 'number') {
      return value;
    }
    return this.sanitizePolicyTextValue(value);
  }

  private sanitizePolicyTextValue(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const lower = trimmed.toLowerCase();
    const blockedMarkers = [
      'raw_sms',
      'verification_code',
      'full_phone',
      'full_bank',
      'secret',
      'private_key',
      'certificate',
      'database_file',
      'runtime_log',
    ];
    if (blockedMarkers.some((marker) => lower.includes(marker))) {
      return null;
    }
    if (/\b\d{11}\b/.test(trimmed) || /\b\d{16,19}\b/.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  private normalizePolicyToken(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value)
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async getNextActions(
    query: QueryAiNextActionsDto,
    currentUser: CurrentUser,
  ): Promise<AiNextActionsResponse> {
    const calculation = this.createCalculationContext(query);
    const {
      performancePending,
      performanceSummaries,
      statPending,
      statSummaries,
      stagingWindow,
    } = await this.loadNextActionSourceData(query, currentUser);
    const redemptionReconciliationItems = await this.loadRedemptionReconciliationItems(
      currentUser,
    );
    const abcScoreCommandBlockedItems = await this.loadAbcScoreCommandBlockedItems(currentUser);

    const customerBindingPerformanceItems = performancePending.list.filter(
      (item) => item?.performanceBlockReason === 'missing_customer_binding',
    );
    const customerBindingStatItems = statPending.list.filter((item) => {
      const payload = item?.payload as Record<string, unknown> | undefined;
      const customerBinding = payload?.customerBinding as Record<string, unknown> | undefined;
      return (
        customerBinding?.performanceBlockReason === 'missing_customer_binding' ||
        payload?.performanceBlockReason === 'missing_customer_binding'
      );
    });

    const cleanupPerformanceSummaries = performanceSummaries.list.filter((item) =>
      this.isDataCleanupCandidate(item?.paymentStatus, item?.sourceClassification, item?.isTestData),
    );
    const cleanupStatSummaries = statSummaries.list.filter((item) =>
      this.isDataCleanupCandidate(item?.paymentStatus, item?.sourceClassification, item?.isTestData),
    );

    const sheetRepairPerformanceSummaries = performanceSummaries.list.filter(
      (item) => item?.reconciliationStatus === 'sheet_missing',
    );
    const sheetRepairStatSummaries = statSummaries.list.filter(
      (item) => item?.reconciliationStatus === 'sheet_missing',
    );

    const readyButUnconfirmedPerformanceSummaries = performanceSummaries.list.filter(
      (item) => item?.performanceBlockReason === 'awaiting_manual_review',
    );
    const readyButUnconfirmedStatSummaries = statSummaries.list.filter(
      (item) =>
        item?.payrollDecision === 'pending_confirmation' &&
        !['missing_customer_binding', 'missing_employee_binding'].includes(item?.payrollBlockReason ?? ''),
    );

    const actionItems = [
      ...this.buildBucketedActionItems(
        'customer_binding_task',
        [
          ...customerBindingPerformanceItems.map((item) => ({
            source: 'performance_pending_items',
            record: item as Record<string, unknown>,
            amountField: 'amountStandard',
            timeAnchorType: 'occurred_at',
          })),
          ...customerBindingStatItems.map((item) => ({
            source: 'stat_pending_items',
            record: (item?.payload ?? {}) as Record<string, unknown>,
            amountField: 'amountStandard',
            timeAnchorType: 'occurred_at',
          })),
        ],
        this.buildCustomerBindingTemplates(),
        calculation.periodLabel,
        query,
        calculation,
      ),
      ...this.buildBucketedActionItems(
        'sheet_repair_task',
        [
          ...sheetRepairPerformanceSummaries.map((item) => ({
            source: 'performance_summaries',
            record: item as Record<string, unknown>,
            amountField: 'amountTotal',
            timeAnchorType: 'summary_anchor',
          })),
          ...sheetRepairStatSummaries.map((item) => ({
            source: 'business_stat_summaries',
            record: item as Record<string, unknown>,
            amountField: 'amountTotal',
            timeAnchorType: 'summary_anchor',
          })),
        ],
        this.buildSheetRepairTemplates(stagingWindow),
        calculation.periodLabel,
        query,
        calculation,
      ),
      ...this.buildBucketedActionItems(
        'performance_confirmation_task',
        [
          ...readyButUnconfirmedPerformanceSummaries.map((item) => ({
            source: 'performance_summaries',
            record: item as Record<string, unknown>,
            amountField: 'amountTotal',
            timeAnchorType: 'summary_anchor',
          })),
          ...readyButUnconfirmedStatSummaries.map((item) => ({
            source: 'business_stat_summaries',
            record: item as Record<string, unknown>,
            amountField: 'amountTotal',
            timeAnchorType: 'summary_anchor',
          })),
        ],
        this.buildPerformanceConfirmationTemplates(),
        calculation.periodLabel,
        query,
        calculation,
      ),
      ...this.buildBucketedActionItems(
        'data_cleanup_task',
        [
          ...cleanupPerformanceSummaries.map((item) => ({
            source: 'performance_summaries',
            record: item as Record<string, unknown>,
            amountField: 'amountTotal',
            timeAnchorType: 'summary_anchor',
          })),
          ...cleanupStatSummaries.map((item) => ({
            source: 'business_stat_summaries',
            record: item as Record<string, unknown>,
            amountField: 'amountTotal',
            timeAnchorType: 'summary_anchor',
          })),
        ],
        this.buildDataCleanupTemplates(),
        calculation.periodLabel,
        query,
        calculation,
      ),
      ...this.buildBucketedActionItems(
        'redemption_reconciliation_task',
        redemptionReconciliationItems.map((item) => ({
          source: 'points_redemptions',
          record: item,
          amountField: 'targetValue',
          timeAnchorType: 'updated_at',
        })),
        this.buildRedemptionReconciliationTemplates(),
        calculation.periodLabel,
        query,
        calculation,
      ),
      ...this.buildBucketedActionItems(
        'abc_score_command_blocked_task',
        abcScoreCommandBlockedItems.map((item) => ({
          source: 'abc_points_commands',
          record: item,
          amountField: 'changeAmount',
          timeAnchorType: 'updated_at',
        })),
        this.buildAbcScoreCommandBlockedTemplates(),
        calculation.periodLabel,
        query,
        calculation,
      ),
    ].filter((item) => Boolean(item.actionId));

    const latestStates = await this.loadLatestActionStates(
      actionItems.map((item) => item.actionId),
    );
    const hydratedItems = actionItems.map((item) =>
      this.applyActionStateToItem(item, latestStates.get(item.actionId) ?? null, calculation.anchorNow),
    );

    const filteredItems = hydratedItems.filter((item) => {
      if (query.role && item.ownerRole !== query.role) {
        return false;
      }
      if (query.dueLevel && item.dueLevel !== query.dueLevel) {
        return false;
      }
      if (query.onlyBlocking && !item.impactTags.some((tag) => BLOCKING_IMPACT_TAGS.has(tag))) {
        return false;
      }
      if (!this.matchesActionTimeBucket(item, query, calculation.periodMode)) {
        return false;
      }
      if (!this.matchesActionStatus(item, query)) {
        return false;
      }
      return true;
    });

    return {
      generatedAt: calculation.generatedAt,
      calculationAnchorAt: calculation.generatedAt,
      calculationFingerprint: calculation.calculationFingerprint,
      filtersApplied: {
        role: query.role ?? null,
        dueLevel: query.dueLevel ?? null,
        onlyBlocking: Boolean(query.onlyBlocking),
        includeDone: Boolean(query.includeDone),
        includeDeferred: Boolean(query.includeDeferred),
        backlogOnly: Boolean(query.backlogOnly),
        timeBucket: calculation.requestedTimeBucket,
        periodMode: calculation.periodMode,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        periodKey: query.periodKey ?? null,
      },
      stagingWindow,
      mustHandleToday: filteredItems.filter((item) => item.dueLevel === 'must_handle_today'),
      recommended: filteredItems.filter((item) => item.dueLevel === 'should_handle_this_week'),
      canDefer: filteredItems.filter((item) => item.dueLevel === 'can_defer'),
      actionItems: filteredItems,
    };
  }

  /**
   * Keep AI action source collection sequential.
   *
   * Performance/business-stats summary mapping relies on multiple readonly
   * ABC-source lookups that degrade to empty evidence when a branch fails.
   * Pulling all source collections in parallel made relatedAmount drift between
   * refreshes. Serializing the collection step keeps the calculation stable
   * without changing any business rule.
   */
  private async loadNextActionSourceData(
    query: QueryAiNextActionsDto,
    currentUser: CurrentUser,
  ) {
    const performancePending = await this.collectAllPerformancePendingItems(query, currentUser);
    const performanceSummaries = await this.collectAllPerformanceSummaries(query, currentUser);
    const statPending = await this.collectAllStatPendingItems(query, currentUser);
    const statSummaries = await this.collectAllBusinessStatSummaries(query, currentUser);
    const stagingWindow = await this.loadExternalCardSalesStagingWindow();

    return {
      performancePending,
      performanceSummaries,
      statPending,
      statSummaries,
      stagingWindow,
    };
  }

  private async loadRedemptionReconciliationItems(currentUser: CurrentUser) {
    const candidates = await this.pointsRedemptionRepository.find({
      where: [
        { requestStatus: 'confirmed' },
        { requestStatus: 'pending_fulfillment' },
        { requestStatus: 'fulfilled_in_abc' },
        { requestStatus: 'completed' },
      ],
      order: {
        updatedAt: 'DESC',
        id: 'DESC',
      },
      take: 120,
    });

    const details = await Promise.all(
      candidates.map(async (item) => {
        try {
          return (await this.pointsService.getRedemptionDetail(item.id)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }),
    );

    return details.filter((item): item is Record<string, unknown> => {
      if (!item) {
        return false;
      }
      const reconciliationStatus = this.readObjectString(item, 'reconciliationStatus');
      const exceptionFlags = this.readObjectArray(item, 'exceptionFlags').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      );
      return (
        reconciliationStatus === 'fulfilled_pending_consume' ||
        reconciliationStatus === 'mismatch_needs_review' ||
        exceptionFlags.includes('stale_pending_fulfillment') ||
        exceptionFlags.includes('stale_confirmed_not_fulfilled')
      );
    });
  }

  private async loadAbcScoreCommandBlockedItems(currentUser: CurrentUser) {
    const candidates = await this.abcPointsCommandRepository.find({
      where: [
        { commandStatus: 'blocked' },
        { commandStatus: 'confirmed' },
      ],
      order: {
        updatedAt: 'DESC',
        id: 'DESC',
      },
      take: 120,
    });

    const details = await Promise.all(
      candidates.map(async (item) => {
        try {
          return (await this.pointsService.getAbcPointsCommandDetail(
            item.id,
            currentUser,
          )) as Record<string, unknown>;
        } catch {
          return null;
        }
      }),
    );

    return details.filter((item): item is Record<string, unknown> => {
      if (!item) {
        return false;
      }
      const commandStatus = this.readObjectString(item, 'commandStatus');
      const blockedReason = this.readObjectString(item, 'blockedReason');
      const writePathPrecheck = this.readObjectObject(item, 'writePathPrecheck');
      const precheckStatus = this.readObjectString(writePathPrecheck, 'precheckStatus');
      const canExecute = this.readObjectBoolean(writePathPrecheck, 'canExecute');

      return (
        commandStatus === 'blocked' ||
        blockedReason === 'abc_score_write_path_not_stable' ||
        blockedReason === 'mobile_mapping_conflict' ||
        blockedReason === 'abc_user_not_found' ||
        (commandStatus === 'confirmed' && !canExecute) ||
        precheckStatus === 'fail'
      );
    });
  }

  async markActionState(dto: MarkAiActionStateDto, currentUser: CurrentUser) {
    const previous = await this.aiActionStateRepository.findOne({
      where: { actionId: dto.actionId },
      order: { markedAt: 'DESC', id: 'DESC' },
    });

    const record = this.aiActionStateRepository.create({
      actionId: dto.actionId,
      sourceKey: dto.sourceKey ?? null,
      taskType: dto.taskType,
      ownerRole: dto.ownerRole,
      processingStatus: dto.processingStatus,
      deferUntil: dto.deferUntil ? new Date(dto.deferUntil) : null,
      deferReason: dto.deferReason ?? null,
      markedBy: currentUser.id,
      markedByName: currentUser.realName || currentUser.username,
      reopenAt: dto.reopenAt ? new Date(dto.reopenAt) : null,
      statusRemark: dto.statusRemark ?? null,
      timeBucket: dto.timeBucket ?? null,
      bucketLabel: dto.bucketLabel ?? null,
      timeAnchorType: dto.timeAnchorType ?? null,
      timeAnchorDate: dto.timeAnchorDate ? new Date(dto.timeAnchorDate) : null,
      normalizedPayload: {
        ...(dto.normalizedPayload ?? {}),
        previousState: previous
          ? {
              id: previous.id,
              processingStatus: previous.processingStatus,
              timeBucket: previous.timeBucket,
              deferUntil: previous.deferUntil?.toISOString() ?? null,
              reopenAt: previous.reopenAt?.toISOString() ?? null,
              markedAt: previous.markedAt?.toISOString() ?? null,
            }
          : null,
      },
    });

    const saved = await this.aiActionStateRepository.save(record);

    return {
      id: saved.id,
      actionId: saved.actionId,
      taskType: saved.taskType,
      ownerRole: saved.ownerRole,
      processingStatus: saved.processingStatus,
      deferUntil: saved.deferUntil?.toISOString() ?? null,
      deferReason: saved.deferReason ?? null,
      markedBy: saved.markedBy,
      markedByName: saved.markedByName ?? null,
      markedAt: saved.markedAt?.toISOString() ?? null,
      reopenAt: saved.reopenAt?.toISOString() ?? null,
      statusRemark: saved.statusRemark ?? null,
      timeBucket: saved.timeBucket ?? null,
      bucketLabel: saved.bucketLabel ?? null,
      timeAnchorType: saved.timeAnchorType ?? null,
      timeAnchorDate: saved.timeAnchorDate?.toISOString() ?? null,
      shouldReopen:
        saved.processingStatus === 'deferred' &&
        Boolean(saved.reopenAt && saved.reopenAt.getTime() <= Date.now()),
    };
  }

  async getConsoleOverview(
    query: QueryAiConsoleOverviewDto,
    currentUser: CurrentUser,
  ): Promise<AiConsoleOverviewResponse> {
    const role = this.resolveConsoleRole(query.role, currentUser);
    const scene = this.resolveConsoleScene(query.scene);
    const channel = this.resolveConsoleChannel(query.channel, role);
    const providerOptions = this.getProviderProfiles();
    const provider = this.pickActiveProvider(providerOptions, query.providerKey, role, channel);

    const nextActions = await this.getNextActions(
      {
        role,
        dueLevel: query.dueLevel,
        onlyBlocking: query.onlyBlocking,
        includeDone: query.includeDone,
        includeDeferred: query.includeDeferred,
        backlogOnly: query.backlogOnly,
        timeBucket: query.timeBucket,
        periodMode: query.periodMode,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        periodKey: query.periodKey,
      },
      currentUser,
    );
    const scopedNextActions = this.applySceneFilterToNextActions(nextActions, scene);
    const [recentDecisions, recentBlockers, recentActionStates] = await Promise.all([
      this.loadRecentManualDecisions(),
      this.loadRecentBlockers(currentUser, query.periodKey, scene),
      this.loadRecentActionStates(),
    ]);

    return {
      generatedAt: nextActions.generatedAt,
      calculationAnchorAt: nextActions.calculationAnchorAt,
      calculationFingerprint: nextActions.calculationFingerprint,
      role,
      scene,
      channel,
      provider,
      providerOptions,
      filtersApplied: nextActions.filtersApplied,
      summaryCards: this.buildConsoleSummaryCards(scopedNextActions),
      riskCards: this.buildConsoleRiskCards(scopedNextActions),
      currentFocus: this.buildCurrentFocus(recentBlockers),
      nextActions: scopedNextActions,
      recentDecisions,
      recentBlockers,
      recentActionStates,
    };
  }

  async getMemoryEntries(
    query: QueryAiMemoryEntriesDto,
    currentUser: CurrentUser,
  ): Promise<PaginationResult<Record<string, unknown>>> {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 10)));
    const sortBy = query.sortBy ?? 'priorityLevel';
    const sortOrder = query.sortOrder ?? 'DESC';
    const keyword = query.keyword?.trim().toLowerCase() ?? '';

    const list = await this.aiMemoryEntryRepository.find({
      order: {
        priorityLevel: 'DESC',
        updatedAt: 'DESC',
        id: 'DESC',
      },
    });

    const filtered = list.filter((item) => {
      if (
        this.isOwnerOnlyMemoryEntry(item) &&
        !this.canAccessOwnerOnlyMemory(currentUser)
      ) {
        return false;
      }
      if (query.memoryType && item.memoryType !== query.memoryType) {
        return false;
      }
      if (query.scopeType && item.scopeType !== query.scopeType) {
        return false;
      }
      if (query.enabledFlag !== undefined && item.enabledFlag !== query.enabledFlag) {
        return false;
      }
      if (query.roleScope) {
        const roleScope = Array.isArray(item.roleScope) ? item.roleScope : [];
        if (!roleScope.includes(query.roleScope)) {
          return false;
        }
      }
      if (query.sceneScope) {
        const sceneScope = Array.isArray(item.sceneScope) ? item.sceneScope : [];
        if (!sceneScope.includes(query.sceneScope)) {
          return false;
        }
      }
      if (!keyword) {
        return true;
      }

      const haystack = [
        item.title,
        item.summary,
        item.content,
        item.memoryType,
        item.scopeType,
        item.scopeKey ?? '',
        ...(Array.isArray(item.tags) ? item.tags : []),
      ]
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });

    const sorted = filtered.slice().sort((left, right) =>
      this.compareMemoryEntries(left, right, sortBy, sortOrder),
    );
    const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

    return buildPaginationResult(
      { page, pageSize },
      paged.map((item) => this.mapMemoryEntryForList(item)),
      sorted.length,
    );
  }

  async getOwnerMemoryProjection(
    query: QueryAiOwnerMemoryProjectionDto,
    currentUser: CurrentUser,
  ) {
    const entries = await this.aiMemoryEntryRepository.find({
      where: { enabledFlag: true },
      order: {
        priorityLevel: 'DESC',
        updatedAt: 'DESC',
        id: 'DESC',
      },
    });

    return this.ownerMemoryProjectionService.project(entries, {
      audience: query.audience ?? 'owner_assistant',
      businessDomain: query.businessDomain,
      assistantRole: query.assistantRole,
      scene: query.scene,
      routePath: query.routePath,
      entityType: query.entityType,
      limit: query.limit,
      requesterRoleCodes: currentUser.roleCodes,
    });
  }

  async createMemoryEntry(
    dto: CreateAiMemoryEntryDto,
    currentUser: CurrentUser,
  ): Promise<Record<string, unknown>> {
    this.assertOwnerOnlyMemoryAccess(currentUser, dto.tags);
    const saved = await this.aiMemoryEntryRepository.save(
      this.aiMemoryEntryRepository.create({
        memoryType: dto.memoryType,
        scopeType: dto.scopeType,
        scopeKey: dto.scopeKey ?? null,
        roleScope: dto.roleScope ?? null,
        sceneScope: dto.sceneScope ?? null,
        title: dto.title,
        summary: dto.summary,
        content: dto.content,
        tags: dto.tags ?? null,
        priorityLevel: dto.priorityLevel ?? 50,
        enabledFlag: dto.enabledFlag ?? true,
        sourceType: dto.sourceType ?? 'manual_memory',
        generalizationMode: dto.generalizationMode ?? 'case_only',
        aiUsageMode: dto.aiUsageMode ?? 'cite_when_relevant',
        createdBy: currentUser.id,
        createdByName: currentUser.realName || currentUser.username,
        normalizedPayload: {
          ...(dto.normalizedPayload ?? {}),
          audit: {
            createdBy: currentUser.id,
            createdByName: currentUser.realName || currentUser.username,
            createdAt: new Date().toISOString(),
          },
        },
      }),
    );

    return this.mapMemoryEntryForList(saved);
  }

  async updateMemoryEntry(
    id: number,
    dto: UpdateAiMemoryEntryDto,
    currentUser: CurrentUser,
  ): Promise<Record<string, unknown>> {
    const existing = await this.aiMemoryEntryRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('AI 记忆条目不存在');
    }

    const nextTags = dto.tags === undefined ? existing.tags : dto.tags ?? null;
    this.assertOwnerOnlyMemoryAccess(currentUser, existing.tags, nextTags);

    const normalizedPayload = {
      ...(existing.normalizedPayload ?? {}),
      ...(dto.normalizedPayload ?? {}),
      audit: {
        ...(((existing.normalizedPayload ?? {}) as Record<string, unknown>).audit as
          | Record<string, unknown>
          | undefined),
        updatedBy: currentUser.id,
        updatedByName: currentUser.realName || currentUser.username,
        updatedAt: new Date().toISOString(),
      },
    };

    Object.assign(existing, {
      memoryType: dto.memoryType ?? existing.memoryType,
      scopeType: dto.scopeType ?? existing.scopeType,
      scopeKey: dto.scopeKey === undefined ? existing.scopeKey : dto.scopeKey ?? null,
      roleScope: dto.roleScope === undefined ? existing.roleScope : dto.roleScope ?? null,
      sceneScope: dto.sceneScope === undefined ? existing.sceneScope : dto.sceneScope ?? null,
      title: dto.title ?? existing.title,
      summary: dto.summary ?? existing.summary,
      content: dto.content ?? existing.content,
      tags: dto.tags === undefined ? existing.tags : dto.tags ?? null,
      priorityLevel: dto.priorityLevel ?? existing.priorityLevel,
      enabledFlag: dto.enabledFlag ?? existing.enabledFlag,
      sourceType: dto.sourceType ?? existing.sourceType,
      generalizationMode: dto.generalizationMode ?? existing.generalizationMode,
      aiUsageMode: dto.aiUsageMode ?? existing.aiUsageMode,
      normalizedPayload,
    });

    const saved = await this.aiMemoryEntryRepository.save(existing);
    return this.mapMemoryEntryForList(saved);
  }

  async toggleMemoryEntry(
    id: number,
    dto: ToggleAiMemoryEntryDto,
    currentUser: CurrentUser,
  ): Promise<Record<string, unknown>> {
    const existing = await this.aiMemoryEntryRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('AI 记忆条目不存在');
    }

    this.assertOwnerOnlyMemoryAccess(currentUser, existing.tags);

    existing.enabledFlag = dto.enabledFlag;
    existing.normalizedPayload = {
      ...(existing.normalizedPayload ?? {}),
      audit: {
        ...(((existing.normalizedPayload ?? {}) as Record<string, unknown>).audit as
          | Record<string, unknown>
          | undefined),
        toggledBy: currentUser.id,
        toggledByName: currentUser.realName || currentUser.username,
        toggledAt: new Date().toISOString(),
        toggleRemark: dto.remark ?? null,
      },
    };

    const saved = await this.aiMemoryEntryRepository.save(existing);
    return this.mapMemoryEntryForList(saved);
  }

  async getSummaryContext(
    id: number,
    query: QueryAiSummaryContextDto,
    currentUser: CurrentUser,
  ): Promise<AiSummaryContextResponse> {
    if (!query.summaryType || query.summaryType === 'performance') {
      try {
        const detail = (await this.performanceService.findPerformanceSummaryDetail(
          id,
          {
            page: 1,
            pageSize: 5,
            sortBy: 'occurredAt',
            sortOrder: 'DESC',
          } as QueryPerformanceSummaryDetailDto,
          currentUser,
        )) as Record<string, unknown>;
        return await this.buildPerformanceSummaryContext(detail);
      } catch (error) {
        if (query.summaryType === 'performance' || !this.isNotFoundError(error)) {
          throw error;
        }
      }
    }

    try {
      const detail = (await this.businessStatsService.findBusinessStatSummaryDetail(
        id,
        {
          page: 1,
          pageSize: 5,
          sortBy: 'occurredAt',
          sortOrder: 'DESC',
        } as QueryBusinessStatSummaryDetailDto,
        currentUser,
      )) as Record<string, unknown>;
      return await this.buildBusinessStatSummaryContext(detail);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('AI 上下文未找到对应汇总记录');
      }
      throw error;
    }
  }

  async getTaskContext(
    actionId: string,
    query: QueryAiConsoleOverviewDto,
    currentUser: CurrentUser,
  ): Promise<AiTaskContextResponse> {
    const role = this.resolveConsoleRole(query.role, currentUser);
    const scene = this.resolveConsoleScene(query.scene);
    const channel = this.resolveConsoleChannel(query.channel, role);
    const providerOptions = this.getProviderProfiles();
    const provider = this.pickActiveProvider(providerOptions, query.providerKey, role, channel);
    const nextActions = await this.getNextActions(
      {
        role,
        dueLevel: query.dueLevel,
        onlyBlocking: query.onlyBlocking,
        includeDone: query.includeDone,
        includeDeferred: query.includeDeferred,
        backlogOnly: query.backlogOnly,
        timeBucket: query.timeBucket,
        periodMode: query.periodMode,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        periodKey: query.periodKey,
      },
      currentUser,
    );
    const scopedNextActions = this.applySceneFilterToNextActions(nextActions, scene);
    const matched = scopedNextActions.actionItems.find((item) => item.actionId === actionId);

    if (!matched) {
      throw new NotFoundException('AI 任务上下文不存在');
    }

    return {
      generatedAt: new Date().toISOString(),
      actionId: matched.actionId,
      role,
      scene,
      channel,
      provider,
      taskType: matched.taskType,
      ownerRole: matched.ownerRole,
      ownerRoleLabel: matched.ownerRoleLabel,
      actionTitle: matched.actionTitle,
      actionSummary: matched.actionSummary,
      whyNow: matched.whyNow,
      relatedCount: matched.relatedCount,
      relatedAmount: matched.relatedAmount,
      impactType: matched.impactType,
      timeBucket: matched.timeBucket,
      bucketLabel: matched.bucketLabel,
      timeAnchorType: matched.timeAnchorType,
      timeAnchorDate: matched.timeAnchorDate,
      processingStatus: matched.processingStatus,
      deferUntil: matched.deferUntil,
      deferReason: matched.deferReason,
      markedByName: matched.markedByName,
      markedAt: matched.markedAt,
      reopenAt: matched.reopenAt,
      statusRemark: matched.statusRemark,
      shouldReopen: matched.shouldReopen,
      blockers: matched.blockers,
      suggestedAction: matched.suggestedAction,
      suggestedFilterLabel: matched.suggestedFilterLabel,
      nextStepAfterDone: matched.nextStepAfterDone,
      directTargetType: matched.directTargetType,
      relatedPagePath: matched.relatedPagePath,
      relatedPageQuery: matched.relatedPageQuery,
      sourceBreakdown: matched.sourceBreakdown,
    };
  }

  async getPointsCommandContext(
    id: number,
    query: QueryAiConsoleOverviewDto,
    currentUser: CurrentUser,
  ): Promise<AiPointsCommandContextResponse> {
    const role = this.resolveConsoleRole(query.role, currentUser);
    const scene = this.resolveConsoleScene(query.scene);
    const channel = this.resolveConsoleChannel(query.channel, role);
    const provider = this.pickActiveProvider(this.getProviderProfiles(), query.providerKey, role, channel);
    const baseContext = await this.loadPointsCommandContextBase(id, currentUser);
    const focusObject = this.buildPointsCommandFocusObject(baseContext);
    const taskStateSummary = baseContext.sourceActionId
      ? await this.loadActionStateSummary(baseContext.sourceActionId)
      : null;
    const memoryMatches = await this.loadRelevantMemoryEntries({
      role,
      allowOwnerOnlyMemory: this.canAccessOwnerOnlyMemory(currentUser),
      scene,
      routePath: `/points/commands/${id}`,
      focusObject,
      blockers: baseContext.blockers,
    });
    const knowledgeHints = await this.loadRelevantKnowledgeEntries({
      role,
      scene,
      routePath: `/points/commands/${id}`,
      focusObject,
      blockers: baseContext.blockers,
    });
    const manualDecisionMatches =
      baseContext.manualDecisionReferences.length > 0
        ? baseContext.manualDecisionReferences
        : await this.loadRelevantManualDecisionReferences(
            focusObject,
            currentUser,
            baseContext.blockers,
          );

    const pageContext: AiPageContextResponse = {
      generatedAt: new Date().toISOString(),
      provider,
      rewardDomain: 'hq_points',
      sourceOfTruth: 'HQ',
      threadKey:
        baseContext.threadKey ??
        this.buildAssistantThreadKey({
          routePath: `/points/commands/${id}`,
          entityType: 'points_command',
          entityId: String(id),
          role,
          sourceActionId: baseContext.sourceActionId,
        }),
      pageInfo: {
        routePath: `/points/commands/${id}`,
        pageLabel: this.resolveAssistantPageLabel(`/points/commands/${id}`),
        sourceActionId: baseContext.sourceActionId,
        pageEntityType: 'points_command',
        pageEntityId: String(id),
      },
      roleInfo: {
        role,
        roleLabel: OWNER_ROLE_LABELS[role],
        scene,
        channel,
      },
      filterSummary: {
        periodKey: null,
        dateFrom: null,
        dateTo: null,
        filters: {},
        sourceActionId: baseContext.sourceActionId,
      },
      focusObject,
      blockers: baseContext.blockers,
      evidenceSummary: this.buildPageEvidenceSummary(focusObject, taskStateSummary, {
        periodKey: null,
        dateFrom: null,
        dateTo: null,
        filters: {},
        sourceActionId: baseContext.sourceActionId,
      }, baseContext.pointsSummary),
      pointsSummary: baseContext.pointsSummary,
      manualDecisionSummary: baseContext.manualDecisionSummary,
      citedMemories: memoryMatches.citedMemories,
      founderMemories: memoryMatches.founderMemories,
      roleMemories: memoryMatches.roleMemories,
      knowledgeHints,
      manualDecisionMatches,
      memoryInfluenceSummary: this.buildMemoryInfluenceSummaryV2(
        manualDecisionMatches,
        memoryMatches.founderMemories,
        memoryMatches.roleMemories,
        knowledgeHints,
      ),
      founderPrinciplesApplied: memoryMatches.founderMemories.map((item) => item.title),
      rolePlaybookApplied: memoryMatches.roleMemories.map((item) => item.title),
      generalizationBoundary: this.buildGeneralizationBoundaryForPointsCommand(
        baseContext,
        manualDecisionMatches,
        memoryMatches.founderMemories,
        memoryMatches.roleMemories,
        knowledgeHints,
      ),
      handlingPlan: null,
      taskStateSummary,
      suggestedQuestions: this.buildAssistantSmartQuestionsV2(
        focusObject,
        baseContext.blockers,
        memoryMatches.citedMemories,
        knowledgeHints,
        manualDecisionMatches,
      ),
      suggestedActions: this.buildAssistantSuggestedActions(
        focusObject,
        baseContext.blockers,
        baseContext.sourceActionId,
      ),
      interactionHistory: baseContext.interactionHistory,
    };

    const analysis = this.buildStructuredAssistantReplyAnalysisV2(
      '解释这条积点命令为什么创建、为什么处于当前状态、下一步该怎么做',
      pageContext,
      focusObject,
      'what_to_do',
    );

    return {
      generatedAt: pageContext.generatedAt,
      provider,
      commandId: id,
      basicInfo: baseContext.basicInfo,
      ownerInfo: baseContext.ownerInfo,
      sourceInfo: baseContext.sourceInfo,
      statusInfo: baseContext.statusInfo,
      approvalInfo: baseContext.approvalInfo,
      ledgerImpact: baseContext.ledgerImpact,
      commandOrigin: baseContext.commandOrigin,
      blockers: baseContext.blockers,
      founderMemories: memoryMatches.founderMemories,
      roleMemories: memoryMatches.roleMemories,
      citedKnowledge: knowledgeHints,
      citedManualDecisions: manualDecisionMatches,
      suggestedQuestions: pageContext.suggestedQuestions,
      suggestedActions: analysis.suggestedActions,
      nextStepAfterDone: baseContext.nextStepAfterDone,
      commandExplanation: analysis.reply,
      answerSections: analysis.answerSections,
      confidenceLevel: analysis.confidenceLevel,
      memoryInfluenceSummary: analysis.memoryInfluenceSummary,
      founderPrinciplesApplied: analysis.founderPrinciplesApplied,
      rolePlaybookApplied: analysis.rolePlaybookApplied,
      generalizationBoundary: analysis.generalizationBoundary,
      handlingPlan: null,
      relatedLedgerEntries: baseContext.relatedLedgerEntries,
      executionTrace: baseContext.executionTrace,
      whyNow: this.buildPointsCommandWhyNow(baseContext),
    };
  }

  async getPointsRedemptionContext(
    id: number,
    query: QueryAiConsoleOverviewDto,
    currentUser: CurrentUser,
  ): Promise<AiPointsRedemptionContextResponse> {
    const role = this.resolveConsoleRole(query.role, currentUser);
    const scene = this.resolveConsoleScene(query.scene);
    const channel = this.resolveConsoleChannel(query.channel, role);
    const provider = this.pickActiveProvider(this.getProviderProfiles(), query.providerKey, role, channel);
    const baseContext = await this.loadPointsRedemptionContextBase(id, currentUser);
    const focusObject = this.buildPointsRedemptionFocusObject(baseContext);
    const taskStateSummary = baseContext.sourceActionId
      ? await this.loadActionStateSummary(baseContext.sourceActionId)
      : null;
    const memoryMatches = await this.loadRelevantMemoryEntries({
      role,
      allowOwnerOnlyMemory: this.canAccessOwnerOnlyMemory(currentUser),
      scene,
      routePath: `/points/redemptions`,
      focusObject,
      blockers: baseContext.blockers,
    });
    const knowledgeHints = await this.loadRelevantKnowledgeEntries({
      role,
      scene,
      routePath: `/points/redemptions`,
      focusObject,
      blockers: baseContext.blockers,
    });
    const manualDecisionMatches =
      baseContext.manualDecisionReferences.length > 0
        ? baseContext.manualDecisionReferences
        : await this.loadRelevantManualDecisionReferences(
            focusObject,
            currentUser,
            baseContext.blockers,
          );

    const pageContext: AiPageContextResponse = {
      generatedAt: new Date().toISOString(),
      provider,
      rewardDomain: 'hq_points',
      sourceOfTruth: 'HQ',
      threadKey:
        baseContext.threadKey ??
        this.buildAssistantThreadKey({
          routePath: `/points/redemptions`,
          entityType: 'points_redemption_request',
          entityId: String(id),
          role,
          sourceActionId: baseContext.sourceActionId,
        }),
      pageInfo: {
        routePath: `/points/redemptions`,
        pageLabel: this.resolveAssistantPageLabel('/points/redemptions'),
        sourceActionId: baseContext.sourceActionId,
        pageEntityType: 'points_redemption_request',
        pageEntityId: String(id),
      },
      roleInfo: {
        role,
        roleLabel: OWNER_ROLE_LABELS[role],
        scene,
        channel,
      },
      filterSummary: {
        periodKey: null,
        dateFrom: null,
        dateTo: null,
        filters: {
          requestStatus: baseContext.request.requestStatus,
          redeemableCode: baseContext.request.redeemableCode,
          requestSource: baseContext.request.requestSource,
        },
        sourceActionId: baseContext.sourceActionId,
      },
      focusObject,
      blockers: baseContext.blockers,
      evidenceSummary: this.buildPageEvidenceSummary(
        focusObject,
        taskStateSummary,
        {
          periodKey: null,
          dateFrom: null,
          dateTo: null,
          filters: {
            requestStatus: baseContext.request.requestStatus,
            redeemableCode: baseContext.request.redeemableCode,
            requestSource: baseContext.request.requestSource,
          },
          sourceActionId: baseContext.sourceActionId,
        },
        baseContext.pointsSummary,
      ),
      pointsSummary: baseContext.pointsSummary,
      manualDecisionSummary: baseContext.manualDecisionSummary,
      citedMemories: memoryMatches.citedMemories,
      founderMemories: memoryMatches.founderMemories,
      roleMemories: memoryMatches.roleMemories,
      knowledgeHints,
      manualDecisionMatches,
      memoryInfluenceSummary: this.buildMemoryInfluenceSummaryV2(
        manualDecisionMatches,
        memoryMatches.founderMemories,
        memoryMatches.roleMemories,
        knowledgeHints,
      ),
      founderPrinciplesApplied: memoryMatches.founderMemories.map((item) => item.title),
      rolePlaybookApplied: memoryMatches.roleMemories.map((item) => item.title),
      generalizationBoundary: this.buildGeneralizationBoundaryForPointsRedemption(
        baseContext,
        manualDecisionMatches,
        memoryMatches.founderMemories,
        memoryMatches.roleMemories,
        knowledgeHints,
      ),
      handlingPlan: null,
      taskStateSummary,
      suggestedQuestions: this.buildAssistantSmartQuestionsV2(
        focusObject,
        baseContext.blockers,
        memoryMatches.citedMemories,
        knowledgeHints,
        manualDecisionMatches,
      ),
      suggestedActions: this.buildAssistantSuggestedActions(
        focusObject,
        baseContext.blockers,
        baseContext.sourceActionId,
      ),
      interactionHistory: baseContext.interactionHistory,
    };

    const analysis = this.buildStructuredAssistantReplyAnalysisV2(
      '解释这条积点兑换请求为什么创建、当前卡在哪、是否已经在 ABC 履约，以及为什么还没扣积点或已经扣积点。',
      pageContext,
      focusObject,
      'what_to_do',
    );

    return {
      generatedAt: pageContext.generatedAt,
      provider,
      redemptionId: id,
      basicInfo: baseContext.basicInfo,
      ownerInfo: baseContext.ownerInfo,
      sourceInfo: baseContext.sourceInfo,
      statusInfo: baseContext.statusInfo,
      approvalInfo: baseContext.approvalInfo,
      ledgerImpact: baseContext.ledgerImpact,
      commandOrigin: baseContext.commandOrigin,
      blockers: baseContext.blockers,
      founderMemories: memoryMatches.founderMemories,
      roleMemories: memoryMatches.roleMemories,
      citedKnowledge: knowledgeHints,
      citedManualDecisions: manualDecisionMatches,
      suggestedQuestions: pageContext.suggestedQuestions,
      suggestedActions: analysis.suggestedActions,
      whyNow: this.buildPointsRedemptionWhyNow(baseContext),
      nextStepAfterDone: baseContext.nextStepAfterDone,
      commandExplanation: analysis.reply,
      answerSections: analysis.answerSections,
      confidenceLevel: analysis.confidenceLevel,
      memoryInfluenceSummary: analysis.memoryInfluenceSummary,
      founderPrinciplesApplied: analysis.founderPrinciplesApplied,
      rolePlaybookApplied: analysis.rolePlaybookApplied,
      generalizationBoundary: analysis.generalizationBoundary,
      relatedLedgerEntries: baseContext.relatedLedgerEntries,
      reconciliationStatus:
        this.readObjectString(baseContext.statusInfo, 'reconciliationStatus') ?? null,
      reconciliationReason:
        this.readObjectString(baseContext.statusInfo, 'reconciliationReason') ?? null,
      consumeLedgerEntry:
        this.readObjectObject(baseContext.ledgerImpact, 'consumeLedgerEntry') ?? null,
      matchedAbcShadowRecord:
        this.readObjectObject(baseContext.sourceInfo, 'matchedAbcShadowRecord') ?? null,
      abcFulfillmentSummary:
        this.readObjectObject(baseContext.sourceInfo, 'abcFulfillmentSummary') ?? null,
      exceptionFlags: this.readObjectArray(baseContext.statusInfo, 'exceptionFlags').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
      suggestedAction:
        analysis.primarySuggestion ??
        this.readObjectString(baseContext.rawContext, 'suggestedAction') ??
        null,
      auditTrail: this.readObjectArray(baseContext.rawContext, 'auditTrail').filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
      ),
      executionTrace: baseContext.executionTrace,
    };
  }

  async getPageContext(
    query: QueryAiPageContextDto,
    currentUser: CurrentUser,
  ): Promise<AiPageContextResponse> {
    const role = this.resolveConsoleRole(query.role, currentUser);
    const scene = this.resolveConsoleScene(query.scene);
    const channel = this.resolveConsoleChannel(undefined, role);
    const provider = this.pickActiveProvider(this.getProviderProfiles(), undefined, role, channel);
    const pageQuery = this.parseSerializedObject(query.pageQuery);
    const filterSummary = this.buildAssistantFilterSummary(query, pageQuery);
    const threadKey = this.buildAssistantThreadKey({
      routePath: query.routePath,
      entityType: query.entityType ?? null,
      entityId: query.entityId ?? null,
      role,
      sourceActionId: query.sourceActionId ?? null,
    });
    const focusObject = await this.resolvePageFocusObject(query, currentUser);
    const taskStateSummary = query.sourceActionId
      ? await this.loadActionStateSummary(query.sourceActionId)
      : null;
    const interactionHistory = await this.loadAssistantInteractionHistory(threadKey);
    const pointsSummary = await this.loadPointsSummaryForFocusObject(focusObject);
    const rewardDomain = this.resolveAssistantRewardDomain(query.routePath, focusObject);
    const sourceOfTruth = this.resolveAssistantSourceOfTruth(query.routePath, focusObject);
    const evidenceSummary = this.buildPageEvidenceSummary(
      focusObject,
      taskStateSummary,
      filterSummary,
      pointsSummary,
    );
    const blockers = this.collectPageBlockers(focusObject, taskStateSummary, filterSummary);
    const manualDecisionMatches = await this.loadRelevantManualDecisionReferences(
      focusObject,
      currentUser,
      blockers,
    );
    const memoryMatches = await this.loadRelevantMemoryEntries({
      role,
      allowOwnerOnlyMemory: this.canAccessOwnerOnlyMemory(currentUser),
      scene,
      routePath: query.routePath,
      focusObject,
      blockers,
    });
    const knowledgeHints = await this.loadRelevantKnowledgeEntries({
      role,
      scene,
      routePath: query.routePath,
      focusObject,
      blockers,
    });
    const suggestedActions = this.buildAssistantSuggestedActions(
      focusObject,
      blockers,
      query.sourceActionId ?? null,
      {
        currentUserRoleCodes: this.normalizeAssistantPolicyRoleCodes(currentUser.roleCodes),
        source: 'ai_page_context_suggested_action',
      },
    );
    const handlingPlan =
      (focusObject?.rawContext &&
      typeof focusObject.rawContext === 'object' &&
      'handlingPlan' in focusObject.rawContext
        ? ((focusObject.rawContext as Record<string, unknown>).handlingPlan as Record<string, unknown> | null)
        : null) ?? null;

    return {
      generatedAt: new Date().toISOString(),
      provider,
      threadKey,
      rewardDomain,
      sourceOfTruth,
      pageInfo: {
        routePath: query.routePath,
        pageLabel: this.resolveAssistantPageLabel(query.routePath),
        sourceActionId: query.sourceActionId ?? null,
        pageEntityType: query.entityType ?? null,
        pageEntityId: query.entityId ?? null,
      },
      roleInfo: {
        role,
        roleLabel: OWNER_ROLE_LABELS[role],
        scene,
        channel,
      },
      filterSummary,
      focusObject,
      blockers,
      evidenceSummary,
      pointsSummary,
      manualDecisionSummary:
        (focusObject?.rawContext?.manualDecisionSummary as Record<string, unknown> | null | undefined) ??
        null,
      citedMemories: memoryMatches.citedMemories,
      founderMemories: memoryMatches.founderMemories,
      roleMemories: memoryMatches.roleMemories,
      knowledgeHints,
      manualDecisionMatches,
      memoryInfluenceSummary: this.buildMemoryInfluenceSummaryV2(
        manualDecisionMatches,
        memoryMatches.founderMemories,
        memoryMatches.roleMemories,
        knowledgeHints,
      ),
      founderPrinciplesApplied: memoryMatches.founderMemories.map((item) => item.title),
      rolePlaybookApplied: memoryMatches.roleMemories.map((item) => item.title),
      generalizationBoundary:
        this.resolveHandlingPlanGeneralizationBoundary(handlingPlan) ??
        this.buildGeneralizationBoundaryV2(
          manualDecisionMatches,
          memoryMatches.founderMemories,
          memoryMatches.roleMemories,
          knowledgeHints,
        ),
      taskStateSummary,
      suggestedQuestions: this.buildAssistantSmartQuestionsV2(
        focusObject,
        blockers,
        memoryMatches.citedMemories,
        knowledgeHints,
        manualDecisionMatches,
      ),
      suggestedActions,
      handlingPlan,
      interactionHistory,
    };
  }

  async replyAssistant(
    dto: AiAssistantReplyDto,
    currentUser: CurrentUser,
  ): Promise<AiAssistantReplyResponse> {
    const role = this.resolveConsoleRole(dto.role, currentUser);
    const scene = this.resolveConsoleScene(dto.scene);
    const channel = this.resolveConsoleChannel(undefined, role);
    const provider = this.pickActiveProvider(this.getProviderProfiles(), undefined, role, channel);
    const pageQuery = dto.currentFilters ?? {};
    const threadKey =
      dto.threadKey ??
      this.buildAssistantThreadKey({
        routePath: dto.routePath,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
        role,
        sourceActionId: dto.sourceActionId ?? null,
      });

    const pageContext = await this.getPageContext(
      {
        routePath: dto.routePath,
        entityType: dto.entityType,
        entityId: dto.entityId,
        role,
        scene,
        sourceActionId: dto.sourceActionId,
        pageQuery: JSON.stringify(pageQuery),
      } as QueryAiPageContextDto,
      currentUser,
    );

    const effectiveFocus =
      this.buildAssistantReplyFocus(dto.currentFocus) ?? pageContext.focusObject ?? null;
    const questionType = this.classifyAssistantQuestionType(dto.userMessage, pageContext, effectiveFocus);
    const assistantPolicyRoleCodes = this.normalizeAssistantPolicyRoleCodes(currentUser.roleCodes);
    const analysis = this.buildStructuredAssistantReplyAnalysisV2(
      dto.userMessage,
      pageContext,
      effectiveFocus,
      questionType,
      {
        currentUserRoleCodes: assistantPolicyRoleCodes,
        source: 'ai_assistant_reply_suggested_action',
      },
    );
    const commandDraftPolicy = this.buildStructuredAssistantCommandDraftPolicyResult(
      dto.userMessage,
      effectiveFocus,
      pageContext,
      analysis.primarySuggestion,
      questionType,
      {
        currentUserRoleCodes: assistantPolicyRoleCodes,
      },
    );
    const suggestedCommandDraft = commandDraftPolicy.suggestedCommandDraft;
    const suggestedActionsPolicyTrace = [
      ...analysis.suggestedActionsPolicyTrace,
      ...commandDraftPolicy.suggestedActionsPolicyTrace,
    ];
    const blockedSuggestedActions = [
      ...analysis.blockedSuggestedActions,
      ...commandDraftPolicy.blockedSuggestedActions,
    ];
    const boundaryExplanations = [
      ...analysis.boundaryExplanations,
      ...commandDraftPolicy.boundaryExplanations,
    ];
    const taskDraftReviewArtifacts = [
      ...analysis.taskDraftReviewArtifacts,
      ...commandDraftPolicy.taskDraftReviewArtifacts,
    ];
    const taskDraftReviewPolicyTrace = [
      ...analysis.taskDraftReviewPolicyTrace,
      ...commandDraftPolicy.taskDraftReviewPolicyTrace,
    ];
    const taskDraftReviewArtifactSummary =
      this.buildTaskDraftReviewArtifactSummary(
        taskDraftReviewArtifacts,
        taskDraftReviewPolicyTrace,
      );
    const taskDraftReviewReadAudit =
      this.buildTaskDraftReviewReadAuditViews(
        taskDraftReviewArtifacts,
        taskDraftReviewArtifactSummary,
        taskDraftReviewPolicyTrace,
      );
    const taskDraftReviewReadAuditViews =
      taskDraftReviewReadAudit.views;
    const taskDraftReviewReadAuditSummary =
      taskDraftReviewReadAudit.summary;
    const manualTaskBridge = this.buildManualTaskBridgeCandidates(
      taskDraftReviewReadAuditViews,
      taskDraftReviewArtifacts,
    );
    const manualTaskBridgeCandidates = manualTaskBridge.candidates;
    const manualTaskBridgeCandidateSummary = manualTaskBridge.summary;
    const manualTaskBridgeDispatchReadinessBatch =
      this.buildManualTaskBridgeDispatchReadiness(manualTaskBridgeCandidates);
    const manualTaskBridgeDispatchReadiness =
      manualTaskBridgeDispatchReadinessBatch.readinessItems;
    const manualTaskBridgeDispatchReadinessSummary =
      manualTaskBridgeDispatchReadinessBatch.summary;
    const manualTaskBridgeEmployeeHandoffPreviewBatch =
      this.buildManualTaskBridgeEmployeeHandoffPreviews(
        manualTaskBridgeCandidates,
        manualTaskBridgeDispatchReadiness,
        manualTaskBridgeCandidates.map(() =>
          this.resolveEmployeeHandoffPreviewViewerRoleFromCurrentUserRoles(
            assistantPolicyRoleCodes,
          ),
        ),
      );
    const manualTaskBridgeEmployeeHandoffPreviews =
      manualTaskBridgeEmployeeHandoffPreviewBatch.previews;
    const manualTaskBridgeEmployeeHandoffPreviewSummary =
      manualTaskBridgeEmployeeHandoffPreviewBatch.summary;
    const databaseSafeSummary =
      await this.buildDatabaseSafeSummaryConsumptionFromFinanceReadonlyAdapterAsync();
    const contactPhonePolicyConsumption =
      this.buildContactPhonePolicyConsumption();
    const chatGptContactPhoneReviewResponseConsumption =
      this.buildChatGptContactPhoneReviewResponseConsumption();
    const starkAiSyncPacket = this.buildStarkAiSyncPacketConsumption({
      taskDraftReviewReadAuditSummary,
      manualTaskBridgeCandidateSummary,
      manualTaskBridgeDispatchReadinessSummary,
      manualTaskBridgeEmployeeHandoffPreviewSummary,
      contactPhonePolicySummary: contactPhonePolicyConsumption.summary,
      chatGptContactPhoneReviewResponseValidationSummary:
        chatGptContactPhoneReviewResponseConsumption.summary,
      databaseSafeSummaryBatch: databaseSafeSummary.databaseSafeSummaryBatch,
      databaseSafeSummarySummary: databaseSafeSummary.databaseSafeSummarySummary,
      currentSystemState: this.buildStarkAiSyncPacketCurrentSystemState(),
    });
    const starkAiChatGptNextStepSelector =
      this.buildStarkAiChatGptNextStepSelector(
        starkAiSyncPacket.starkAiSyncPacketSummary,
      );
    const readOnlySafeQueryStatusSummary =
      this.buildReadOnlySafeQueryStatusSummaryForAiReview();
    const handlingPlan = this.mergeHandlingPlanWithAiDiagnosis(pageContext.handlingPlan, {
      assistantReply: analysis.reply,
      answerSections: analysis.answerSections,
      confidenceLevel: analysis.confidenceLevel,
    });
    const handlingPlanAiView = this.resolveHandlingPlanAiDiagnosisView(handlingPlan);
    const record = this.aiAssistantInteractionRepository.create({
      threadKey,
      routePath: dto.routePath,
      entityType: dto.entityType ?? null,
      entityId: dto.entityId ?? null,
      roleCode: role,
      sceneCode: scene,
      sourceActionId: dto.sourceActionId ?? null,
      userMessage: dto.userMessage,
      assistantReply: handlingPlanAiView.assistantReply ?? analysis.reply,
      suggestedActions: analysis.suggestedActions,
      suggestedCommandDraft,
      providerKey: provider.providerKey,
      createdBy: currentUser.id,
      createdByName: currentUser.realName || currentUser.username,
      normalizedPayload: {
        pageContext: {
          pageInfo: pageContext.pageInfo,
          filterSummary: pageContext.filterSummary,
          blockers: pageContext.blockers,
          pointsSummary: pageContext.pointsSummary,
          rewardDomain: pageContext.rewardDomain,
          sourceOfTruth: pageContext.sourceOfTruth,
          handlingPlan,
        },
        currentFilters: dto.currentFilters ?? null,
        currentFocus: dto.currentFocus ?? null,
        handlingPlan,
        questionType,
        answerSections: analysis.answerSections,
        citedKnowledge: analysis.citedKnowledge,
        citedManualDecisions: analysis.citedManualDecisions,
        citedMemories: analysis.citedMemories,
        memoryInfluenceSummary: analysis.memoryInfluenceSummary,
        founderPrinciplesApplied: analysis.founderPrinciplesApplied,
        rolePlaybookApplied: analysis.rolePlaybookApplied,
        generalizationBoundary: analysis.generalizationBoundary,
        confidenceLevel: analysis.confidenceLevel,
        missingContext: analysis.missingContext,
        citedContextBlocks: analysis.citedContextBlocks,
        shouldEscalateToHumanReview: analysis.shouldEscalateToHumanReview,
        suggestedActionsPolicyTrace,
        blockedSuggestedActions,
        suggestedCommandDraftPolicy: commandDraftPolicy.suggestedCommandDraftPolicy,
        boundaryExplanations,
        taskDraftReviewArtifacts,
        taskDraftReviewArtifactSummary,
        taskDraftReviewPolicyTrace,
        taskDraftReviewReadAuditViews,
        taskDraftReviewReadAuditSummary,
        manualTaskBridgeCandidates,
        manualTaskBridgeCandidateSummary,
        manualTaskBridgeDispatchReadiness,
        manualTaskBridgeDispatchReadinessSummary,
        manualTaskBridgeEmployeeHandoffPreviews,
        manualTaskBridgeEmployeeHandoffPreviewSummary,
        contactPhonePolicyContexts: contactPhonePolicyConsumption.fragments,
        contactPhonePolicySummary: contactPhonePolicyConsumption.summary,
        chatGptContactPhoneReviewResponseValidationArtifacts:
          chatGptContactPhoneReviewResponseConsumption.artifacts,
        chatGptContactPhoneReviewResponseValidationSummary:
          chatGptContactPhoneReviewResponseConsumption.summary,
        databaseSafeSummaryBatch: databaseSafeSummary.databaseSafeSummaryBatch,
        databaseSafeSummarySummary:
          databaseSafeSummary.databaseSafeSummarySummary,
        starkAiChatGptNextStepCandidates:
          starkAiChatGptNextStepSelector.candidates,
        starkAiChatGptNextStepSelectorSummary:
          starkAiChatGptNextStepSelector.summary,
        readOnlySafeQueryStatusSummary:
          readOnlySafeQueryStatusSummary.readOnlySafeQueryStatusSummary,
        readOnlySafeQueryStatusSummaryResult:
          readOnlySafeQueryStatusSummary.readOnlySafeQueryStatusSummaryResult,
        readOnlySafeQueryStatusSummarySource:
          readOnlySafeQueryStatusSummary.readOnlySafeQueryStatusSummarySource,
        starkAiSyncPacketJson: starkAiSyncPacket.starkAiSyncPacketJson,
        starkAiSyncPacketMarkdown: starkAiSyncPacket.starkAiSyncPacketMarkdown,
        starkAiSyncPacketSummary: starkAiSyncPacket.starkAiSyncPacketSummary,
      },
    });
    const saved = await this.aiAssistantInteractionRepository.save(record);

    return {
      generatedAt: new Date().toISOString(),
      providerKey: provider.providerKey,
      threadKey,
      rewardDomain: pageContext.rewardDomain,
      sourceOfTruth: pageContext.sourceOfTruth,
      replyType: 'analysis',
      questionType,
      confidence: analysis.confidence,
      confidenceLevel: analysis.confidenceLevel,
      assistantReply: handlingPlanAiView.assistantReply ?? analysis.reply,
      answerSections: handlingPlanAiView.answerSections ?? analysis.answerSections,
      citedContextBlocks: analysis.citedContextBlocks,
      citedKnowledge: analysis.citedKnowledge,
      citedManualDecisions: analysis.citedManualDecisions,
      citedMemories: analysis.citedMemories,
      memoryInfluenceSummary: analysis.memoryInfluenceSummary,
      founderPrinciplesApplied: analysis.founderPrinciplesApplied,
      rolePlaybookApplied: analysis.rolePlaybookApplied,
      generalizationBoundary: analysis.generalizationBoundary,
      missingContext: analysis.missingContext,
      suggestedActions: analysis.suggestedActions,
      suggestedCommandDraft,
      suggestedActionsPolicyTrace,
      blockedSuggestedActions,
      suggestedCommandDraftPolicy: commandDraftPolicy.suggestedCommandDraftPolicy,
      boundaryExplanations,
      taskDraftReviewArtifacts,
      taskDraftReviewArtifactSummary,
      taskDraftReviewPolicyTrace,
      taskDraftReviewReadAuditViews,
      taskDraftReviewReadAuditSummary,
      manualTaskBridgeCandidates,
      manualTaskBridgeCandidateSummary,
      manualTaskBridgeDispatchReadiness,
      manualTaskBridgeDispatchReadinessSummary,
      manualTaskBridgeEmployeeHandoffPreviews,
      manualTaskBridgeEmployeeHandoffPreviewSummary,
      contactPhonePolicyContexts: contactPhonePolicyConsumption.fragments,
      contactPhonePolicySummary: contactPhonePolicyConsumption.summary,
      chatGptContactPhoneReviewResponseValidationArtifacts:
        chatGptContactPhoneReviewResponseConsumption.artifacts,
      chatGptContactPhoneReviewResponseValidationSummary:
        chatGptContactPhoneReviewResponseConsumption.summary,
      starkAiChatGptNextStepCandidates:
        starkAiChatGptNextStepSelector.candidates,
      starkAiChatGptNextStepSelectorSummary:
        starkAiChatGptNextStepSelector.summary,
      readOnlySafeQueryStatusSummary:
        readOnlySafeQueryStatusSummary.readOnlySafeQueryStatusSummary,
      readOnlySafeQueryStatusSummaryResult:
        readOnlySafeQueryStatusSummary.readOnlySafeQueryStatusSummaryResult,
      readOnlySafeQueryStatusSummarySource:
        readOnlySafeQueryStatusSummary.readOnlySafeQueryStatusSummarySource,
      databaseSafeSummaryBatch: databaseSafeSummary.databaseSafeSummaryBatch,
      databaseSafeSummarySummary: databaseSafeSummary.databaseSafeSummarySummary,
      starkAiSyncPacketJson: starkAiSyncPacket.starkAiSyncPacketJson,
      starkAiSyncPacketMarkdown: starkAiSyncPacket.starkAiSyncPacketMarkdown,
      starkAiSyncPacketSummary: starkAiSyncPacket.starkAiSyncPacketSummary,
      shouldEscalateToHumanReview: analysis.shouldEscalateToHumanReview,
      handlingPlan,
      interactionRecord: this.mapAssistantInteractionRecord(saved),
    };
  }

  private resolveConsoleRole(
    requestedRole: AiActionOwnerRole | undefined,
    currentUser: CurrentUser,
  ): AiActionOwnerRole {
    if (requestedRole) {
      return requestedRole;
    }

    const roleCodes = new Set(currentUser.roleCodes ?? []);
    if (roleCodes.has('founder') || roleCodes.has('owner') || roleCodes.has('super_admin')) {
      return 'founder';
    }
    if (roleCodes.has('finance')) return 'finance';
    if (roleCodes.has('admin')) return 'admin';
    if (roleCodes.has('approver')) return 'approver';
    if (roleCodes.has('operator')) return 'operator';
    return 'admin';
  }

  private resolveConsoleScene(scene: AiConsoleScene | undefined): AiConsoleScene {
    return scene ?? 'global';
  }

  private resolveConsoleChannel(
    channel: AiConsoleChannel | undefined,
    role: AiActionOwnerRole,
  ): AiConsoleChannel {
    if (channel) {
      return channel;
    }
    if (role === 'finance') return 'finance_review';
    if (role === 'founder') return 'management_command';
    return 'web_console';
  }

  private getProviderProfiles() {
    return AI_PROVIDER_PROFILES.filter((item) => item.enabledFlag).sort(
      (left, right) => left.fallbackOrder - right.fallbackOrder,
    );
  }

  private pickActiveProvider(
    providers: AiProviderProfile[],
    providerKey: string | undefined,
    role: AiActionOwnerRole,
    channel: AiConsoleChannel,
  ) {
    const matchedByKey = providerKey
      ? providers.find(
          (item) =>
            item.providerKey === providerKey &&
            item.roleScope.includes(role) &&
            item.channelScope.includes(channel),
        )
      : null;

    if (matchedByKey) {
      return matchedByKey;
    }

    const matchedByScope = providers.find(
      (item) => item.roleScope.includes(role) && item.channelScope.includes(channel),
    );

    return matchedByScope ?? providers[0];
  }

  private applySceneFilterToNextActions(
    response: AiNextActionsResponse,
    scene: AiConsoleScene,
  ): AiNextActionsResponse {
    const taskTypes = this.resolveSceneTaskTypes(scene);
    if (!taskTypes) {
      return response;
    }

    const filtered = response.actionItems.filter((item) => taskTypes.includes(item.taskType));
    return {
      ...response,
      mustHandleToday: filtered.filter((item) => item.dueLevel === 'must_handle_today'),
      recommended: filtered.filter((item) => item.dueLevel === 'should_handle_this_week'),
      canDefer: filtered.filter((item) => item.dueLevel === 'can_defer'),
      actionItems: filtered,
    };
  }

  private resolveSceneTaskTypes(scene: AiConsoleScene) {
    switch (scene) {
      case 'customer_binding':
        return ['customer_binding_task'] as AiNextActionTaskType[];
      case 'sheet_repair':
        return ['sheet_repair_task'] as AiNextActionTaskType[];
      case 'performance_confirmation':
        return ['performance_confirmation_task'] as AiNextActionTaskType[];
      case 'data_cleanup':
        return ['data_cleanup_task'] as AiNextActionTaskType[];
      default:
        return null;
    }
  }

  private buildConsoleSummaryCards(
    nextActions: AiNextActionsResponse,
  ): AiConsoleSummaryCard[] {
    const blockingItems = nextActions.actionItems.filter((item) =>
      item.impactTags.some((tag) => BLOCKING_IMPACT_TAGS.has(tag)),
    );

    return [
      {
        key: 'mustHandleToday',
        title: '今日必须处理',
        value: String(nextActions.mustHandleToday.length),
        subtitle: '需要立即推进的岗位动作',
      },
      {
        key: 'recommended',
        title: '本周建议处理',
        value: String(nextActions.recommended.length),
        subtitle: '可本周内安排的治理动作',
      },
      {
        key: 'blocking',
        title: '当前阻塞任务',
        value: String(blockingItems.length),
        subtitle: `影响金额 ${this.displayAmountOrUnknown(this.sumAmounts(blockingItems.map((item) => item.relatedAmount)))}`,
      },
      {
        key: 'totalImpact',
        title: '当前看板影响金额',
        value: this.displayAmountOrUnknown(
          this.sumAmounts(nextActions.actionItems.map((item) => item.relatedAmount)),
        ),
        subtitle: '仅作引导，不等于正式工资结论',
      },
    ];
  }

  private buildConsoleRiskCards(nextActions: AiNextActionsResponse): AiConsoleRiskCard[] {
    return nextActions.actionItems
      .slice()
      .sort((left, right) => this.compareDueLevel(left.dueLevel, right.dueLevel))
      .slice(0, 4)
      .map((item) => ({
        key: item.actionId,
        title: item.actionTitle,
        summary: item.whyNow,
        dueLevel: item.dueLevel,
        impactType: item.impactType,
        relatedPagePath: item.relatedPagePath,
        relatedPageQuery: item.relatedPageQuery,
      }));
  }

  private compareDueLevel(left: AiActionDueLevel, right: AiActionDueLevel) {
    const weight: Record<AiActionDueLevel, number> = {
      must_handle_today: 0,
      should_handle_this_week: 1,
      can_defer: 2,
    };
    return weight[left] - weight[right];
  }

  private async loadRecentManualDecisions(): Promise<AiConsoleRecentDecision[]> {
    const list = await this.performanceSummaryManualDecisionRepository.find({
      relations: { operator: true },
      order: { operatedAt: 'DESC', id: 'DESC' },
      take: 6,
    });

    return list.map((item) => {
      const payload = (item.normalizedPayload ?? {}) as Record<string, unknown>;
      const judgmentBasisRaw = payload.judgmentBasis;
      const judgmentBasis = Array.isArray(judgmentBasisRaw)
        ? judgmentBasisRaw.map((entry) => String(entry))
        : [];

      return {
        id: item.id,
        sourceSummaryId: item.sourceSummaryId,
        actionType: item.actionType,
        operatorName: item.operatorName ?? item.operator?.realName ?? item.operator?.username ?? null,
        operatedAt: item.operatedAt.toISOString(),
        reasonCode: item.reasonCode ?? null,
        decisionScope:
          typeof payload.decisionScope === 'string' ? payload.decisionScope : 'case_only',
        judgmentBasis: judgmentBasis.length > 0 ? judgmentBasis : ['other'],
        aiLearningMode:
          typeof payload.aiLearningMode === 'string'
            ? payload.aiLearningMode
            : 'do_not_generalize',
        finalClassification: item.finalClassification ?? null,
        finalBindingStatus: item.finalBindingStatus ?? null,
        affectPerformanceFlag: item.affectPerformanceFlag,
        affectBCardFlag: item.affectBCardFlag,
        remark: item.remark,
      };
    });
  }

  private async loadRecentBlockers(
    currentUser: CurrentUser,
    periodKey: string | undefined,
    scene: AiConsoleScene,
  ): Promise<AiConsoleRecentBlocker[]> {
    const [performanceResult, businessStatsResult] = await Promise.all([
      this.performanceService.findPerformanceSummaries(
        {
          page: 1,
          pageSize: 5,
          periodKey,
          sortBy: 'updatedAt',
          sortOrder: 'DESC',
          performanceBlockReason:
            'missing_customer_binding,awaiting_manual_review,missing_employee_binding',
        } as QueryPerformanceSummariesDto,
        currentUser,
      ),
      this.businessStatsService.findBusinessStatSummaries(
        {
          page: 1,
          pageSize: 5,
          periodKey,
          sortBy: 'updatedAt',
          sortOrder: 'DESC',
          payrollDecision: 'pending_confirmation',
        } as QueryBusinessStatSummariesDto,
        currentUser,
      ),
    ]);

    const blockers: AiConsoleRecentBlocker[] = [
      ...performanceResult.list.map((item: Record<string, unknown>) => ({
        key: `performance:${String(item.id)}`,
        summaryType: 'performance' as const,
        summaryId: Number(item.id),
        title: `绩效汇总 #${item.id}`,
        blockerReason: String(
          item.performanceBlockReason ?? item.performanceDecisionReason ?? '待人工处理',
        ),
        updatedAt:
          typeof item.updatedAt === 'string'
            ? item.updatedAt
            : item.updatedAt instanceof Date
              ? item.updatedAt.toISOString()
              : null,
        relatedPagePath: `/performance/summaries/${item.id}`,
        relatedPageQuery: {},
      })),
      ...businessStatsResult.list.map((item: Record<string, unknown>) => ({
        key: `business_stats:${String(item.id)}`,
        summaryType: 'business_stats' as const,
        summaryId: Number(item.id),
        title: `经营统计汇总 #${item.id}`,
        blockerReason: String(
          item.payrollBlockReason ?? item.payrollDecisionReason ?? item.payrollDecision ?? '待人工处理',
        ),
        updatedAt:
          typeof item.updatedAt === 'string'
            ? item.updatedAt
            : item.updatedAt instanceof Date
              ? item.updatedAt.toISOString()
              : null,
        relatedPagePath: `/business-stats/summaries/${item.id}`,
        relatedPageQuery: {},
      })),
    ];

    return blockers
      .filter((item) => this.matchesBlockerScene(item, scene))
      .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
      .slice(0, 6);
  }

  private matchesBlockerScene(blocker: AiConsoleRecentBlocker, scene: AiConsoleScene) {
    if (scene === 'global') {
      return true;
    }
    if (scene === 'customer_binding') {
      return blocker.blockerReason.includes('missing_customer_binding');
    }
    if (scene === 'performance_confirmation') {
      return (
        blocker.blockerReason.includes('awaiting_manual_review') ||
        blocker.blockerReason.includes('pending_confirmation')
      );
    }
    if (scene === 'sheet_repair') {
      return blocker.summaryType === 'business_stats';
    }
    if (scene === 'data_cleanup') {
      return false;
    }
    return true;
  }

  private buildCurrentFocus(
    blockers: AiConsoleRecentBlocker[],
  ): AiConsoleFocusObject | null {
    const focus = blockers[0];
    if (!focus) {
      return null;
    }

    return {
      summaryType: focus.summaryType,
      summaryId: focus.summaryId,
      title: focus.title,
      subtitle: focus.updatedAt ? `最近更新时间 ${focus.updatedAt}` : '待补更多上下文',
      blocker: focus.blockerReason,
      relatedPagePath: focus.relatedPagePath,
      relatedPageQuery: focus.relatedPageQuery,
    };
  }

  private async buildPerformanceSummaryContext(
    detail: Record<string, unknown>,
  ): Promise<AiSummaryContextResponse> {
    const summary = ((detail.summary ?? {}) as Record<string, unknown>) ?? {};
    const events = ((detail.events as Record<string, unknown> | undefined)?.list ?? []) as Array<
      Record<string, unknown>
    >;

    const pointsSummary = await this.loadPointsSummaryForIdentity({
      ownerType: 'customer',
      ownerId: this.readObjectNumber(summary, 'matchedCustomerId'),
      ownerMobile: this.readObjectString(summary, 'matchedCustomerMobile') ?? this.readObjectString(summary, 'customerMobile'),
    });

    return {
      generatedAt: new Date().toISOString(),
      summaryType: 'performance',
      basicInfo: {
        summaryId: summary.id ?? null,
        periodKey: summary.periodKey ?? null,
        employeeId: summary.employeeId ?? null,
        employeeName:
          summary.employeeName ??
          ((summary.employee as Record<string, unknown> | undefined)?.name ?? null),
        sourceDomain: summary.sourceDomain ?? null,
        amountTotal: summary.amountTotal ?? null,
        eventCount: summary.eventCount ?? null,
        confirmedEventCount: summary.confirmedEventCount ?? null,
        pendingEventCount: summary.pendingEventCount ?? null,
      },
      customerIdentity: {
        customerName: summary.customerName ?? null,
        customerMobile: summary.customerMobile ?? null,
        matchedCustomerId: summary.matchedCustomerId ?? null,
        matchedCustomerName: summary.matchedCustomerName ?? null,
        matchedCustomerMobile: summary.matchedCustomerMobile ?? null,
        customerBinding: summary.customerBinding ?? null,
      },
      paymentAndReconciliation: {
        paymentStatus: summary.paymentStatus ?? null,
        isPaid: summary.isPaid ?? null,
        sourceClassification: summary.sourceClassification ?? null,
        reconciliationStatus: summary.reconciliationStatus ?? null,
        reconciliationReason: summary.reconciliationReason ?? null,
        performanceBlockReason: summary.performanceBlockReason ?? null,
        performanceDecisionReason: summary.performanceDecisionReason ?? null,
      },
      productAndBundle: {
        packageName: summary.packageName ?? null,
        projectName: summary.projectName ?? null,
        linkedPaidAAmount: summary.linkedPaidAAmount ?? null,
        linkedBCardAmount: summary.linkedBCardAmount ?? null,
        linkedBCardSourceType: summary.linkedBCardSourceType ?? null,
        bundleEvidenceStrong: summary.bundleEvidenceStrong ?? null,
        missingCItemSuspected: summary.missingCItemSuspected ?? null,
        bundleInferenceReason: summary.bundleInferenceReason ?? null,
      },
      pointsSummary,
      manualDecision:
        (summary.manualDecision as Record<string, unknown> | null | undefined) ??
        this.buildLatestDecisionFallback(summary),
      blockers: this.collectSummaryBlockers('performance', summary),
      suggestedNextStep: this.buildSummarySuggestedNextStep('performance', summary),
      relatedRecordsPreview: events.slice(0, 5).map((item) => {
        const payload = ((item.payload ?? item) as Record<string, unknown>) ?? {};
        return {
          itemType: 'performance_event',
          id: item.id ?? payload.id ?? null,
          occurredAt: item.occurredAt ?? payload.occurredAt ?? null,
          sourceTable: payload.sourceTable ?? null,
          sourceId: payload.sourceId ?? null,
          eventType: payload.eventType ?? null,
          amountStandard: payload.amountStandard ?? null,
          confirmedFlag: payload.confirmedFlag ?? null,
        };
      }),
    };
  }

  private async buildBusinessStatSummaryContext(
    detail: Record<string, unknown>,
  ): Promise<AiSummaryContextResponse> {
    const summary = ((detail.summary ?? {}) as Record<string, unknown>) ?? {};
    const records = ((detail.detail as Record<string, unknown> | undefined)?.list ?? []) as Array<
      Record<string, unknown>
    >;

    const pointsSummary = await this.loadPointsSummaryForIdentity({
      ownerType: 'customer',
      ownerId: this.readObjectNumber(summary, 'matchedCustomerId'),
      ownerMobile: this.readObjectString(summary, 'matchedCustomerMobile') ?? this.readObjectString(summary, 'customerMobile'),
    });

    return {
      generatedAt: new Date().toISOString(),
      summaryType: 'business_stats',
      basicInfo: {
        summaryId: summary.id ?? null,
        periodKey: summary.periodKey ?? null,
        summaryDomain: summary.summaryDomain ?? null,
        employeeId: summary.responsibleEmployeeId ?? null,
        employeeName:
          summary.responsibleEmployeeName ??
          ((summary.responsibleEmployee as Record<string, unknown> | undefined)?.name ?? null),
        amountTotal: summary.amountTotal ?? null,
        quantityTotal: summary.quantityTotal ?? null,
        rewardEventCount: summary.rewardEventCount ?? null,
        tagCount: summary.tagCount ?? null,
      },
      customerIdentity: {
        customerName: summary.customerName ?? null,
        customerMobile: summary.customerMobile ?? null,
        matchedCustomerId: summary.matchedCustomerId ?? null,
        matchedCustomerName: summary.matchedCustomerName ?? null,
        matchedCustomerMobile: summary.matchedCustomerMobile ?? null,
        customerBinding: summary.customerBinding ?? null,
      },
      paymentAndReconciliation: {
        paymentStatus: summary.paymentStatus ?? null,
        isPaid: summary.isPaid ?? null,
        sourceClassification: summary.sourceClassification ?? null,
        reconciliationStatus: summary.reconciliationStatus ?? null,
        reconciliationReason: summary.reconciliationReason ?? null,
        payrollDecision: summary.payrollDecision ?? null,
        payrollBlockReason: summary.payrollBlockReason ?? null,
        payrollDecisionReason: summary.payrollDecisionReason ?? null,
      },
      productAndBundle: {
        businessCategory: summary.businessCategory ?? null,
        packageName: summary.packageName ?? null,
        projectName: summary.projectName ?? null,
        bCardIssuedAmount: summary.bCardIssuedAmount ?? null,
        bCardConsumedAmount: summary.bCardConsumedAmount ?? null,
        bCardRemainingAmount: summary.bCardRemainingAmount ?? null,
        benefitSourceType: summary.benefitSourceType ?? null,
        formalBenefitIssueNo: summary.formalBenefitIssueNo ?? null,
        legacyWelfareCandidate: summary.legacyWelfareCandidate ?? null,
      },
      pointsSummary,
      manualDecision:
        (summary.manualDecision as Record<string, unknown> | null | undefined) ??
        this.buildLatestDecisionFallback(summary),
      blockers: this.collectSummaryBlockers('business_stats', summary),
      suggestedNextStep: this.buildSummarySuggestedNextStep('business_stats', summary),
      relatedRecordsPreview: records.slice(0, 5).map((item) => {
        const payload = ((item.payload ?? item) as Record<string, unknown>) ?? {};
        return {
          itemType: item.itemType ?? 'record',
          id: item.id ?? payload.id ?? null,
          occurredAt: item.occurredAt ?? payload.occurredAt ?? null,
          sourceTable: payload.sourceTable ?? null,
          sourceId: payload.sourceId ?? null,
          tagCode: payload.tagCode ?? null,
          eventType: payload.eventType ?? null,
          amountStandard: payload.amountStandard ?? null,
          confirmedFlag: payload.confirmedFlag ?? null,
        };
      }),
    };
  }

  private async loadPointsCommandContextBase(id: number, currentUser: CurrentUser) {
    const command = await this.pointsCommandRepository.findOne({ where: { id } });
    if (!command) {
      throw new NotFoundException('AI 上下文未找到对应积点命令');
    }

    const [relatedLedgerEntries, operationLogs, interactionEntities, linkedSummaryContext] = await Promise.all([
      this.pointsLedgerRepository.find({
        where: {
          sourceType: 'points_command_request',
          sourceId: String(command.id),
        },
        order: {
          executedAt: 'DESC',
          id: 'DESC',
        },
      }),
      this.operationLogRepository.find({
        where: {
          module: 'points_commands',
          targetId: command.id,
        },
        order: {
          createdAt: 'DESC',
          id: 'DESC',
        },
      }),
      command.threadKey
        ? this.aiAssistantInteractionRepository.find({
            where: { threadKey: command.threadKey },
            order: {
              createdAt: 'DESC',
              id: 'DESC',
            },
            take: 12,
          })
        : Promise.resolve([]),
      this.resolveLinkedSummaryContextForPointsCommand(command, currentUser),
    ]);

    const ownerInfo = {
      ownerType: command.ownerType,
      ownerId: command.ownerId,
      ownerMobile: command.ownerMobile,
      merchantId: command.merchantId,
    };
    const sourcePayload = (command.normalizedPayload ?? {}) as Record<string, unknown>;
    const targetEntity = this.readObjectObject(sourcePayload, 'targetEntity');
    const affectPerformanceFlag =
      this.readObjectBoolean(sourcePayload, 'affectPerformanceFlag') ??
      this.readObjectBoolean(targetEntity, 'affectPerformanceFlag');
    const affectBCardFlag =
      this.readObjectBoolean(sourcePayload, 'affectBCardFlag') ??
      this.readObjectBoolean(targetEntity, 'affectBCardFlag');
    const pointsSummary = await this.loadPointsSummaryForIdentity({
      ownerType: command.ownerType,
      ownerId: command.ownerId,
      ownerMobile: command.ownerMobile,
      merchantId: command.merchantId,
    });

    const statusInfo = {
      commandStatus: command.commandStatus,
      requestedAt: command.requestedAt?.toISOString() ?? null,
      confirmedAt: command.confirmedAt?.toISOString() ?? null,
      executedAt: command.executedAt?.toISOString() ?? null,
      cancelledAt: command.cancelledAt?.toISOString() ?? null,
      reasonCode: command.reasonCode ?? null,
      remark: command.remark ?? null,
      affectPerformanceFlag,
      affectBCardFlag,
    };
    const approvalInfo = {
      requestedBy: command.requestedBy,
      requestedByName: command.requestedByName,
      requestedAt: command.requestedAt?.toISOString() ?? null,
      confirmedBy: command.confirmedBy,
      confirmedByName: command.confirmedByName,
      confirmedAt: command.confirmedAt?.toISOString() ?? null,
      executedBy: command.executedBy,
      executedByName: command.executedByName,
      executedAt: command.executedAt?.toISOString() ?? null,
      cancelledBy: command.cancelledBy,
      cancelledByName: command.cancelledByName,
      cancelledAt: command.cancelledAt?.toISOString() ?? null,
    };
    const sourceInfo = {
      sourceType: command.sourceType,
      requestSource: command.requestSource,
      providerKey: command.providerKey ?? null,
      sourceActionId: command.sourceActionId ?? null,
      threadKey: command.threadKey ?? null,
      targetEntityType: this.readObjectString(targetEntity, 'entityType') ?? null,
      targetEntityId: this.readObjectString(targetEntity, 'entityId') ?? null,
      targetRoutePath: this.readObjectString(targetEntity, 'routePath') ?? null,
      sourceTable: this.readObjectString(targetEntity, 'sourceTable') ?? null,
      sourceId: this.readObjectString(targetEntity, 'sourceId') ?? null,
    };
    const mappedLedgerEntries = relatedLedgerEntries.map((item) =>
      this.mapPointsLedgerEntryForAiContext(item),
    );
    const latestBalanceAfter = mappedLedgerEntries[0]?.balanceAfter ?? null;
    const ledgerImpact = {
      ledgerEntryCount: mappedLedgerEntries.length,
      latestBalanceAfter,
      relatedLedgerEntries: mappedLedgerEntries,
    };
    const interactionHistory = interactionEntities.map((item) =>
      this.mapAssistantInteractionRecord(item),
    );
    const commandOrigin = {
      originType: command.requestSource === 'ai_assistant_draft' ? 'ai_draft' : 'manual_draft',
      requestSource: command.requestSource,
      providerKey: command.providerKey ?? null,
      sourceActionId: command.sourceActionId ?? null,
      threadKey: command.threadKey ?? null,
      targetRoutePath: sourceInfo.targetRoutePath,
      targetEntityType: sourceInfo.targetEntityType,
      targetEntityId: sourceInfo.targetEntityId,
      interactionCount: interactionHistory.length,
      latestAssistantReply: interactionHistory[0]?.assistantReply ?? null,
      suggestedScope: this.readObjectString(sourcePayload, 'suggestedScope') ?? null,
      suggestedJudgmentBasis: this.readObjectArray(sourcePayload, 'suggestedJudgmentBasis').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
      suggestedAiLearningMode: this.readObjectString(sourcePayload, 'suggestedAiLearningMode') ?? null,
    };

    const manualDecisionSummary = linkedSummaryContext?.manualDecision ?? null;
    const linkedSummaryBlockers = Array.isArray(linkedSummaryContext?.blockers)
      ? linkedSummaryContext.blockers
      : [];
    const blockers = Array.from(
      new Set([
        ...this.resolvePointsCommandBlockers(command),
        ...linkedSummaryBlockers.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0,
        ),
      ]),
    );
    const operationLogContext = this.loadOperationLogContextBundles({
      operationLogs,
    });

    const rawContext = {
      basicInfo: {
        commandId: command.id,
        commandType: command.commandType,
        commandStatus: command.commandStatus,
        merchantId: command.merchantId,
        changeAmount: command.changeAmount,
        affectPerformanceFlag,
        affectBCardFlag,
      },
      ownerInfo,
      sourceInfo,
      statusInfo,
      approvalInfo,
      ledgerImpact,
      commandOrigin,
      customerIdentity:
        linkedSummaryContext?.customerIdentity ??
        (command.ownerType === 'customer'
          ? {
              customerName: null,
              customerMobile: command.ownerMobile ?? null,
              matchedCustomerId: command.ownerId ?? null,
              matchedCustomerName: null,
              matchedCustomerMobile: command.ownerMobile ?? null,
              customerBinding: null,
            }
          : null),
      paymentAndReconciliation: linkedSummaryContext?.paymentAndReconciliation ?? null,
      productAndBundle: linkedSummaryContext?.productAndBundle ?? null,
      pointsSummary,
      manualDecisionSummary,
      blockers,
      suggestedNextStep: this.buildPointsCommandNextStep(command),
      relatedLedgerEntries: mappedLedgerEntries,
      relatedRecordsPreview: mappedLedgerEntries.slice(0, 5),
      operationLogContextBundles: operationLogContext.operationLogContextBundles,
      operationLogContextBundleSummary: operationLogContext.operationLogContextBundleSummary,
      executionTrace: {
        drafted: {
          requestedBy: command.requestedBy,
          requestedByName: command.requestedByName,
          requestedAt: command.requestedAt?.toISOString() ?? null,
          requestSource: command.requestSource,
          providerKey: command.providerKey ?? null,
          sourceActionId: command.sourceActionId ?? null,
          threadKey: command.threadKey ?? null,
        },
        confirmed:
          command.confirmedBy || command.confirmedAt
            ? {
                confirmedBy: command.confirmedBy,
                confirmedByName: command.confirmedByName,
                confirmedAt: command.confirmedAt?.toISOString() ?? null,
                remark: this.readObjectString(sourcePayload, 'confirmRemark') ?? null,
              }
            : null,
        executed:
          command.executedBy || command.executedAt
            ? {
                executedBy: command.executedBy,
                executedByName: command.executedByName,
                executedAt: command.executedAt?.toISOString() ?? null,
                remark: this.readObjectString(sourcePayload, 'executionRemark') ?? null,
              }
            : null,
        cancelled:
          command.cancelledBy || command.cancelledAt
            ? {
                cancelledBy: command.cancelledBy,
                cancelledByName: command.cancelledByName,
                cancelledAt: command.cancelledAt?.toISOString() ?? null,
                remark: this.readObjectString(sourcePayload, 'cancelRemark') ?? null,
              }
            : null,
        operationLogs: operationLogs.map((item) => ({
          id: item.id,
          action: item.action,
          detail: item.detail,
          detailJson: item.detailJson ?? {},
          operatorId: item.operatorId,
          createdAt: item.createdAt?.toISOString() ?? null,
        })),
        interactionHistory,
      },
    };

    const focusObject = this.buildPointsCommandFocusObject({
      command,
      ownerInfo,
      sourceInfo,
      statusInfo,
      approvalInfo,
      ledgerImpact,
      commandOrigin,
      blockers,
      nextStepAfterDone: this.buildPointsCommandNextStep(command),
      pointsSummary,
      manualDecisionSummary,
      linkedSummaryContext,
      rawContext,
      interactionHistory,
      relatedLedgerEntries: mappedLedgerEntries,
      executionTrace: rawContext.executionTrace,
      sourceActionId: command.sourceActionId ?? null,
      threadKey: command.threadKey ?? null,
    });
    const manualDecisionReferences = manualDecisionSummary
      ? await this.loadRelevantManualDecisionReferences(
          focusObject,
          currentUser,
          blockers,
        )
      : [];

    return {
      command,
      basicInfo: rawContext.basicInfo,
      ownerInfo,
      sourceInfo,
      statusInfo,
      approvalInfo,
      ledgerImpact,
      commandOrigin,
      blockers,
      nextStepAfterDone: this.buildPointsCommandNextStep(command),
      pointsSummary,
      manualDecisionSummary,
      rawContext,
      interactionHistory,
      relatedLedgerEntries: mappedLedgerEntries,
      executionTrace: rawContext.executionTrace,
      sourceActionId: command.sourceActionId ?? null,
      threadKey: command.threadKey ?? null,
      linkedSummaryContext,
      focusObject,
      manualDecisionReferences,
    };
  }

  private async loadAbcPointsCommandContextBase(id: number, currentUser: CurrentUser) {
    const detail = (await this.pointsService.getAbcPointsCommandDetail(
      id,
      currentUser,
    )) as Record<string, unknown>;
    const command = this.readObjectObject(detail, 'command') ?? {};
    const normalizedPayload =
      this.readObjectObject(detail, 'normalizedPayload') ??
      this.readObjectObject(command, 'normalizedPayload');
    const targetEntity = this.readObjectObject(normalizedPayload, 'targetEntity');
    const handlingPlan = this.readObjectObject(detail, 'handlingPlan');
    const handlingPlanDiagnosis = this.readObjectObject(handlingPlan, 'diagnosis');
    const handlingPlanBoundary = this.readObjectObject(handlingPlan, 'boundary');
    const handlingPlanVisibility = this.readObjectString(handlingPlan, 'visibilityScope');
    const isRestrictedView = Boolean(handlingPlanVisibility && handlingPlanVisibility !== 'full');
    const executionTrace = this.readObjectObject(detail, 'executionTrace');
    const interactionHistory = this.readObjectArray(executionTrace, 'interactionHistory')
      .map((item) =>
        item && typeof item === 'object'
          ? (item as AiAssistantInteractionRecord)
          : null,
      )
      .filter((item): item is AiAssistantInteractionRecord => Boolean(item));

    const ownerMobileRaw = this.readObjectString(detail, 'ownerMobile');
    const ownerInfo = {
      ownerType: this.readObjectString(detail, 'ownerType'),
      ownerId: this.readObjectNumber(detail, 'ownerId'),
      ownerMobile: this.maskMobileForAi(ownerMobileRaw, currentUser),
      ownerMobileRaw,
    };
    const sourceInfo = {
      rewardDomain: this.readObjectString(detail, 'rewardDomain') ?? 'abc_score',
      sourceOfTruth: this.readObjectString(detail, 'sourceOfTruth') ?? 'ABC',
      sourceType: this.readObjectString(detail, 'sourceType'),
      requestSource: this.readObjectString(detail, 'requestSource'),
      providerKey: this.readObjectString(detail, 'providerKey'),
      sourceActionId: this.readObjectString(detail, 'sourceActionId'),
      threadKey: this.readObjectString(detail, 'threadKey'),
      targetEntityType: this.readObjectString(targetEntity, 'entityType'),
      targetEntityId: this.readObjectString(targetEntity, 'entityId'),
      targetRoutePath: this.readObjectString(targetEntity, 'routePath'),
      sourceTable: this.readObjectString(targetEntity, 'sourceTable'),
      sourceId: this.readObjectString(targetEntity, 'sourceId'),
      blockedReason: this.readObjectString(detail, 'blockedReason'),
      executionCapability: this.readObjectString(detail, 'executionCapability'),
      abcShadowOwner: this.readObjectObject(detail, 'abcShadowOwner'),
      writePathStable: this.readObjectBoolean(detail, 'writePathStable'),
    };
    const statusInfo = {
      commandStatus: this.readObjectString(detail, 'commandStatus'),
      reasonCode: this.readObjectString(detail, 'reasonCode'),
      remark: this.readObjectString(detail, 'remark'),
      blockedReason:
        this.readObjectString(handlingPlanDiagnosis, 'blockedReason') ??
        this.readObjectString(detail, 'blockedReason'),
      blockedStage:
        this.readObjectString(handlingPlanDiagnosis, 'blockedStage') ??
        this.readObjectString(detail, 'blockedStage'),
      writePathStable: this.readObjectBoolean(detail, 'writePathStable'),
      executionCapability: this.readObjectString(detail, 'executionCapability'),
      precheckStatus:
        this.readObjectString(handlingPlanDiagnosis, 'precheckStatus') ??
        this.readObjectString(this.readObjectObject(detail, 'writePathPrecheck'), 'precheckStatus'),
      canExecute:
        this.readObjectBoolean(handlingPlanDiagnosis, 'canExecute') ??
        this.readObjectBoolean(this.readObjectObject(detail, 'writePathPrecheck'), 'canExecute'),
    };
    const approvalInfo = {
      requestedBy: this.readObjectNumber(detail, 'requestedBy'),
      requestedByName: this.readObjectString(detail, 'requestedByName'),
      requestedAt: this.readObjectString(detail, 'requestedAt'),
      confirmedBy: this.readObjectNumber(detail, 'confirmedBy'),
      confirmedByName: this.readObjectString(detail, 'confirmedByName'),
      confirmedAt: this.readObjectString(detail, 'confirmedAt'),
      executedBy: this.readObjectNumber(detail, 'executedBy'),
      executedByName: this.readObjectString(detail, 'executedByName'),
      executedAt: this.readObjectString(detail, 'executedAt'),
      cancelledBy: this.readObjectNumber(detail, 'cancelledBy'),
      cancelledByName: this.readObjectString(detail, 'cancelledByName'),
      cancelledAt: this.readObjectString(detail, 'cancelledAt'),
    };
    const blockers = this.resolveAbcPointsCommandBlockersFromDetail(detail);
    const nextStepAfterDone = this.buildAbcPointsCommandNextStep(detail);
    const commandOrigin = {
      originType:
        this.readObjectString(detail, 'requestSource') === 'ai_assistant_draft'
          ? 'ai_draft'
          : 'manual_draft',
      requestSource: this.readObjectString(detail, 'requestSource'),
      providerKey: this.readObjectString(detail, 'providerKey'),
      sourceActionId: this.readObjectString(detail, 'sourceActionId'),
      threadKey: this.readObjectString(detail, 'threadKey'),
      targetRoutePath: this.readObjectString(targetEntity, 'routePath'),
      targetEntityType: this.readObjectString(targetEntity, 'entityType'),
      targetEntityId: this.readObjectString(targetEntity, 'entityId'),
      interactionCount: interactionHistory.length,
      latestAssistantReply: interactionHistory[0]?.assistantReply ?? null,
      suggestedScope: this.readObjectString(normalizedPayload, 'suggestedScope'),
      suggestedJudgmentBasis: this.readObjectArray(normalizedPayload, 'suggestedJudgmentBasis').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
      suggestedAiLearningMode:
        this.readObjectString(normalizedPayload, 'suggestedAiLearningMode') ?? null,
    };
    const rawContext = {
      rewardDomain: this.readObjectString(detail, 'rewardDomain') ?? 'abc_score',
      sourceOfTruth: this.readObjectString(detail, 'sourceOfTruth') ?? 'ABC',
      basicInfo: {
        commandId: this.readObjectNumber(command, 'id') ?? id,
        commandType: this.readObjectString(detail, 'commandType'),
        commandStatus: this.readObjectString(detail, 'commandStatus'),
        changeAmount: this.readObjectString(detail, 'changeAmount'),
        rewardDomain: this.readObjectString(detail, 'rewardDomain') ?? 'abc_score',
        sourceOfTruth: this.readObjectString(detail, 'sourceOfTruth') ?? 'ABC',
      },
      ownerInfo,
      sourceInfo,
      statusInfo,
      approvalInfo,
      ledgerImpact: {
        ledgerEntryCount: 0,
        latestBalanceAfter: null,
        relatedLedgerEntries: [],
      },
      commandOrigin,
      manualDecisionSummary: null,
      blockers,
      suggestedNextStep:
        this.readObjectString(handlingPlanDiagnosis, 'suggestedNextStep') ?? nextStepAfterDone,
      suggestedAction: this.readObjectString(handlingPlan, 'listSummary'),
      commandExplanation:
        this.readObjectString(handlingPlan, 'summary') ??
        this.readObjectString(detail, 'commandExplanation'),
      generalizationBoundary:
        this.readObjectString(handlingPlanBoundary, 'generalizationBoundary') ??
        this.readObjectString(detail, 'generalizationBoundary'),
      relatedLedgerEntries: [],
      relatedRecordsPreview: [],
      executionTrace: executionTrace ?? {},
      auditTrail: this.readObjectArray(detail, 'auditTrail'),
      abcShadowOwner: this.readObjectObject(detail, 'abcShadowOwner'),
      pointsSummary: null,
      handlingPlan,
    };

    if (isRestrictedView) {
      sourceInfo.blockedReason = null;
      sourceInfo.executionCapability = null;
      statusInfo.blockedReason = null;
      statusInfo.blockedStage = null;
      statusInfo.executionCapability = null;
      rawContext.executionTrace = {};
      rawContext.auditTrail = [];
    }

    return {
      command,
      ownerInfo,
      sourceInfo,
      statusInfo,
      approvalInfo,
      ledgerImpact: rawContext.ledgerImpact,
      commandOrigin,
      blockers,
      nextStepAfterDone,
      pointsSummary: null,
      manualDecisionSummary: null,
      rawContext,
      handlingPlan,
      interactionHistory,
      relatedLedgerEntries: [],
      executionTrace: executionTrace ?? {},
      sourceActionId: this.readObjectString(detail, 'sourceActionId') ?? null,
      threadKey: this.readObjectString(detail, 'threadKey') ?? null,
      focusObject: null,
      manualDecisionReferences: [],
    };
  }

  private async loadPointsRedemptionContextBase(id: number, currentUser: CurrentUser) {
    const detail = (await this.pointsService.getRedemptionDetail(id)) as Record<string, unknown>;
    const request = this.readObjectObject(detail, 'request') ?? {};
    const normalizedPayload = this.readObjectObject(detail, 'normalizedPayload');
    const targetEntity = this.readObjectObject(normalizedPayload, 'targetEntity');
    const interactionHistory = this.readObjectArray(
      this.readObjectObject(detail, 'executionTrace'),
      'interactionHistory',
    )
      .map((item) =>
        item && typeof item === 'object'
          ? (item as AiAssistantInteractionRecord)
          : null,
      )
      .filter((item): item is AiAssistantInteractionRecord => Boolean(item));
    const mappedLedgerEntries = this.readObjectArray(detail, 'relatedLedgerEntries')
      .map((item) =>
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : null,
      )
      .filter((item): item is Record<string, unknown> => Boolean(item));
    const pointsSummary = await this.loadPointsSummaryForIdentity({
      ownerType:
        (this.readObjectString(detail, 'ownerType') as 'customer' | 'employee' | null) ??
        'customer',
      ownerId: this.readObjectNumber(detail, 'ownerId'),
      ownerMobile: this.readObjectString(detail, 'ownerMobile'),
    });

    const ownerInfo = {
      ownerType: this.readObjectString(detail, 'ownerType'),
      ownerId: this.readObjectNumber(detail, 'ownerId'),
      ownerMobile: this.maskMobileForAi(this.readObjectString(detail, 'ownerMobile'), currentUser),
      ownerMobileRaw: this.readObjectString(detail, 'ownerMobile'),
    };
    const sourceInfo = {
      sourceType: this.readObjectString(detail, 'redeemableType'),
      requestSource: this.readObjectString(detail, 'requestSource'),
      providerSystem: this.readObjectString(detail, 'providerSystem'),
      providerKey: this.readObjectString(detail, 'providerKey'),
      sourceActionId: this.readObjectString(detail, 'sourceActionId'),
      threadKey: this.readObjectString(detail, 'threadKey'),
      externalEntityId: this.readObjectString(detail, 'externalEntityId'),
      externalNo: this.readObjectString(detail, 'externalNo'),
      targetEntityType: this.readObjectString(targetEntity, 'entityType'),
      targetEntityId: this.readObjectString(targetEntity, 'entityId'),
      targetRoutePath: this.readObjectString(targetEntity, 'routePath'),
      providerEntityId: this.readObjectString(
        this.readObjectObject(detail, 'redeemable'),
        'providerEntityId',
      ),
      matchedAbcShadowRecord: this.readObjectObject(detail, 'matchedAbcShadowRecord'),
      abcFulfillmentSummary: this.readObjectObject(detail, 'abcFulfillmentSummary'),
    };
    const statusInfo = {
      requestStatus: this.readObjectString(detail, 'requestStatus'),
      reasonCode: this.readObjectString(detail, 'reasonCode'),
      remark: this.readObjectString(detail, 'remark'),
      affectPerformanceFlag: this.readObjectBoolean(detail, 'affectPerformanceFlag'),
      affectBCardFlag: this.readObjectBoolean(detail, 'affectBCardFlag'),
      reconciliationStatus: this.readObjectString(detail, 'reconciliationStatus'),
      reconciliationReason: this.readObjectString(detail, 'reconciliationReason'),
      exceptionFlags: this.readObjectArray(detail, 'exceptionFlags').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
    };
    const approvalInfo = {
      requestedBy: this.readObjectNumber(detail, 'requestedBy'),
      requestedByName: this.readObjectString(detail, 'requestedByName'),
      requestedAt: this.readObjectString(detail, 'requestedAt'),
      confirmedBy: this.readObjectNumber(detail, 'confirmedBy'),
      confirmedByName: this.readObjectString(detail, 'confirmedByName'),
      confirmedAt: this.readObjectString(detail, 'confirmedAt'),
      fulfilledBy: this.readObjectNumber(detail, 'fulfilledBy'),
      fulfilledByName: this.readObjectString(detail, 'fulfilledByName'),
      fulfilledAt: this.readObjectString(detail, 'fulfilledAt'),
      cancelledBy: this.readObjectNumber(detail, 'cancelledBy'),
      cancelledByName: this.readObjectString(detail, 'cancelledByName'),
      cancelledAt: this.readObjectString(detail, 'cancelledAt'),
    };
    const ledgerImpact = {
      ...((this.readObjectObject(detail, 'ledgerSummary') ?? {}) as Record<string, unknown>),
      consumeLedgerEntry: this.readObjectObject(detail, 'consumeLedgerEntry'),
      relatedLedgerEntries: mappedLedgerEntries,
    };
    const commandOrigin = {
      originType:
        this.readObjectString(detail, 'requestSource') === 'ai_assistant_draft'
          ? 'ai_draft'
          : 'manual_draft',
      requestSource: this.readObjectString(detail, 'requestSource'),
      providerKey: this.readObjectString(detail, 'providerKey'),
      sourceActionId: this.readObjectString(detail, 'sourceActionId'),
      threadKey: this.readObjectString(detail, 'threadKey'),
      targetRoutePath: sourceInfo.targetRoutePath,
      targetEntityType: sourceInfo.targetEntityType,
      targetEntityId: sourceInfo.targetEntityId,
      interactionCount: interactionHistory.length,
      latestAssistantReply: interactionHistory[0]?.assistantReply ?? null,
      suggestedScope: this.readObjectString(normalizedPayload, 'suggestedScope'),
      suggestedJudgmentBasis: this.readObjectArray(normalizedPayload, 'suggestedJudgmentBasis').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
      suggestedAiLearningMode:
        this.readObjectString(normalizedPayload, 'suggestedAiLearningMode') ?? null,
    };

    const blockers = this.resolvePointsRedemptionBlockersFromDetail(detail);
    const nextStepAfterDone =
      this.readObjectString(detail, 'nextStepAfterDone') ??
      this.buildPointsRedemptionNextStepFromDetail(detail);
    const manualDecisionSummary = null;
    const rawContext = {
      basicInfo: {
        redemptionId: this.readObjectNumber(request, 'id') ?? id,
        requestStatus: statusInfo.requestStatus,
        redeemableType: this.readObjectString(detail, 'redeemableType'),
        redeemableCode: this.readObjectString(detail, 'redeemableCode'),
        redeemableName: this.readObjectString(detail, 'redeemableName'),
        pointsCost: this.readObjectString(detail, 'pointsCost'),
        targetValue: this.readObjectString(detail, 'targetValue'),
        providerSystem: this.readObjectString(detail, 'providerSystem'),
        externalEntityId: this.readObjectString(detail, 'externalEntityId'),
        externalNo: this.readObjectString(detail, 'externalNo'),
        affectPerformanceFlag: statusInfo.affectPerformanceFlag,
        affectBCardFlag: statusInfo.affectBCardFlag,
        reconciliationStatus: statusInfo.reconciliationStatus,
        reconciliationReason: statusInfo.reconciliationReason,
        exceptionFlags: statusInfo.exceptionFlags,
      },
      ownerInfo,
      sourceInfo,
      statusInfo,
      approvalInfo,
      ledgerImpact,
      commandOrigin,
      pointsSummary,
      manualDecisionSummary,
      blockers,
      suggestedNextStep: nextStepAfterDone,
      suggestedAction: this.readObjectString(detail, 'suggestedAction'),
      relatedLedgerEntries: mappedLedgerEntries,
      relatedRecordsPreview: mappedLedgerEntries.slice(0, 5),
      executionTrace: this.readObjectObject(detail, 'executionTrace') ?? {},
      matchedAbcShadowRecord: this.readObjectObject(detail, 'matchedAbcShadowRecord'),
      abcFulfillmentSummary: this.readObjectObject(detail, 'abcFulfillmentSummary'),
      consumeLedgerEntry: this.readObjectObject(detail, 'consumeLedgerEntry'),
      auditTrail: this.readObjectArray(detail, 'auditTrail'),
    };

    const focusObject = this.buildPointsRedemptionFocusObject({
      request: request as Record<string, unknown>,
      basicInfo: rawContext.basicInfo,
      ownerInfo,
      sourceInfo,
      statusInfo,
      approvalInfo,
      ledgerImpact,
      commandOrigin,
      blockers,
      nextStepAfterDone,
      pointsSummary,
      manualDecisionSummary,
      rawContext,
      interactionHistory,
      relatedLedgerEntries: mappedLedgerEntries,
      executionTrace: rawContext.executionTrace,
      sourceActionId: this.readObjectString(detail, 'sourceActionId') ?? null,
      threadKey: this.readObjectString(detail, 'threadKey') ?? null,
    });
    const manualDecisionReferences = await this.loadRelevantManualDecisionReferences(
      focusObject,
      currentUser,
      blockers,
    );

    return {
      request,
      basicInfo: rawContext.basicInfo,
      ownerInfo,
      sourceInfo,
      statusInfo,
      approvalInfo,
      ledgerImpact,
      commandOrigin,
      blockers,
      nextStepAfterDone,
      pointsSummary,
      manualDecisionSummary,
      rawContext,
      interactionHistory,
      relatedLedgerEntries: mappedLedgerEntries,
      executionTrace: rawContext.executionTrace,
      sourceActionId: this.readObjectString(detail, 'sourceActionId') ?? null,
      threadKey: this.readObjectString(detail, 'threadKey') ?? null,
      focusObject,
      manualDecisionReferences,
    };
  }

  private async loadPointsWelfarePreviewContext(
    query: QueryAiPageContextDto,
    currentUser: CurrentUser,
  ) {
    const pageQuery = this.parseSerializedObject(query.pageQuery);
    const periodKey =
      query.periodKey ??
      this.readObjectString(pageQuery, 'periodKey') ??
      this.resolveAssistantCurrentPeriodKey();

    const employees = await this.employeeRepository.find({
      order: {
        status: 'DESC',
        id: 'ASC',
      },
    });

    const normalizedMobiles = employees
      .map((item) => this.normalizeMobile(item.mobile))
      .filter((item): item is string => Boolean(item));
    const duplicateMobileSet = new Set<string>();
    const mobileCounter = normalizedMobiles.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item] = (accumulator[item] ?? 0) + 1;
      return accumulator;
    }, {});
    Object.entries(mobileCounter).forEach(([mobile, count]) => {
      if (count > 1) {
        duplicateMobileSet.add(mobile);
      }
    });

    const existingCommands = await this.pointsCommandRepository
      .createQueryBuilder('command')
      .where('command.owner_type = :ownerType', { ownerType: 'employee' })
      .andWhere('command.source_type = :sourceType', {
        sourceType: 'employee_monthly_welfare',
      })
      .andWhere('command.command_status != :cancelled', { cancelled: 'cancelled' })
      .andWhere(
        "JSON_UNQUOTE(JSON_EXTRACT(command.normalized_payload, '$.periodKey')) = :periodKey",
        { periodKey },
      )
      .getMany();

    const latestBatch = await this.pointsBatchRepository.findOne({
      where: {
        batchType: 'employee_monthly_welfare',
        periodKey,
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
    });

    const existingByEmployeeId = new Set(
      existingCommands
        .map((item) => item.ownerId)
        .filter((item): item is number => Number.isInteger(item)),
    );
    const existingByMobile = new Set(
      existingCommands
        .map((item) => this.normalizeMobile(item.ownerMobile))
        .filter((item): item is string => Boolean(item)),
    );

    const eligibleEmployees: AiPointsWelfareEmployeePreview[] = employees
      .filter((employee) => {
        const mobile = this.normalizeMobile(employee.mobile);
        if (employee.status !== 1) return false;
        if (!mobile) return false;
        if (duplicateMobileSet.has(mobile)) return false;
        if (employee.importConflictNote?.trim()) return false;
        if (existingByEmployeeId.has(employee.id) || existingByMobile.has(mobile)) return false;
        return true;
      })
      .map((employee) => ({
        employeeId: employee.id,
        employeeName: this.resolveAssistantEmployeeDisplayName(employee),
        employeeMobile: this.maskMobileForAi(this.normalizeMobile(employee.mobile), currentUser),
        companyName: employee.sourceCompanyName ?? null,
        positionName: employee.positionName ?? null,
        enabledFlag: employee.status === 1,
        suggestedAmount: '200.00',
        reasonSummary: '员工每月 1 号 200 积点福利草案',
      }));

    const excludedEmployees: AiPointsWelfareExcludedEmployeePreview[] = employees
      .map((employee) => {
        const mobile = this.normalizeMobile(employee.mobile);
        let exclusionReason: string | null = null;
        let exclusionDetail: string | null = null;
        if (employee.status !== 1) {
          exclusionReason = 'disabled_employee';
          exclusionDetail = '员工未启用，默认不纳入本期福利发放预览';
        } else if (!mobile) {
          exclusionReason = 'missing_mobile';
          exclusionDetail = '员工手机号缺失，无法稳定生成福利积点命令';
        } else if (duplicateMobileSet.has(mobile)) {
          exclusionReason = 'duplicate_mobile_conflict';
          exclusionDetail = '员工手机号存在冲突，需先收口导入或绑定冲突';
        } else if (employee.importConflictNote?.trim()) {
          exclusionReason = 'other';
          exclusionDetail = employee.importConflictNote.trim();
        } else if (existingByEmployeeId.has(employee.id) || existingByMobile.has(mobile)) {
          exclusionReason = 'already_issued_this_period';
          exclusionDetail = '当前 period 已存在未取消的福利积点命令或已发放记录';
        }

        if (!exclusionReason) {
          return null;
        }

        return {
          employeeId: employee.id,
          employeeName: this.resolveAssistantEmployeeDisplayName(employee),
          employeeMobile: this.maskMobileForAi(mobile, currentUser),
          companyName: employee.sourceCompanyName ?? null,
          positionName: employee.positionName ?? null,
          enabledFlag: employee.status === 1,
          suggestedAmount: '200.00',
          reasonSummary: '员工每月 1 号 200 积点福利草案',
          exclusionReason,
          exclusionDetail,
        };
      })
      .filter((item): item is AiPointsWelfareExcludedEmployeePreview => Boolean(item));

    const warnings: string[] = [];
    if (duplicateMobileSet.size) {
      warnings.push(
        `当前员工主数据存在 ${duplicateMobileSet.size} 个手机号冲突，相关员工已排除出本期福利草案`,
      );
    }
    if (latestBatch && ['drafted', 'confirmed', 'partially_executed'].includes(latestBatch.batchStatus)) {
      warnings.push(`当前 period 已存在有效福利积点母单 #${latestBatch.id}，请谨慎重复创建`);
    }
    if (
      excludedEmployees.some((item) => item.exclusionReason === 'already_issued_this_period')
    ) {
      warnings.push('已有本期福利命令或发放记录的员工已排除，避免重复发放');
    }

    const blockers = new Set<string>();
    if (!eligibleEmployees.length) {
      blockers.add('no_eligible_employees');
    }
    if (latestBatch && ['drafted', 'confirmed', 'partially_executed'].includes(latestBatch.batchStatus)) {
      blockers.add('welfare_batch_already_exists');
    }
    if (duplicateMobileSet.size) {
      blockers.add('duplicate_mobile_conflict');
    }

    const pointsSummary = {
      ownerType: 'employee',
      periodKey,
      recentBatchCount: latestBatch ? 1 : 0,
      recentCommandCount: existingCommands.length,
      recentLedgerCount: 0,
      latestBalanceAfter: null,
      latestBatchId: latestBatch?.id ?? null,
      latestBatchStatus: latestBatch?.batchStatus ?? null,
    };

    return {
      periodKey,
      targetEmployeeCount: eligibleEmployees.length,
      targetTotalAmount: (eligibleEmployees.length * 200).toFixed(2),
      eligibleEmployeesPreview: eligibleEmployees
        .slice(0, 12)
        .map((item) => ({ ...item })) as Record<string, unknown>[],
      excludedEmployeesPreview: excludedEmployees
        .slice(0, 12)
        .map((item) => ({ ...item })) as Record<string, unknown>[],
      previewRules: [
        '默认仅纳入 enabledFlag = true 的员工',
        '同一 employee + periodKey 不能重复生成未取消的福利积点命令',
        '手机号冲突、导入冲突未解决、缺手机号的员工默认排除',
        '本轮只生成草案与审批母单，不会自动执行发放',
      ],
      warnings,
      latestBatch: latestBatch
        ? {
            id: latestBatch.id,
            batchStatus: latestBatch.batchStatus,
            targetEmployeeCount: latestBatch.targetEmployeeCount,
            targetTotalAmount: latestBatch.targetTotalAmount,
          }
        : null,
      blockers: Array.from(blockers),
      suggestedNextStep:
        latestBatch && ['drafted', 'confirmed', 'partially_executed'].includes(latestBatch.batchStatus)
          ? `当前 period 已存在福利积点母单 #${latestBatch.id}，建议先处理现有母单，不要重复创建。`
          : eligibleEmployees.length
            ? `当前 period 有 ${eligibleEmployees.length} 名员工可纳入福利草案，建议先创建本月员工 200 积点批量草案。`
            : '当前周期没有可纳入福利草案的员工，建议先处理排除原因或下月再看。',
      pointsSummary,
    };
  }

  private async loadPointsWelfareBatchContextBase(id: number, currentUser: CurrentUser) {
    const batch = await this.pointsBatchRepository.findOne({ where: { id } });
    if (!batch) {
      throw new NotFoundException('AI 上下文未找到对应福利积点母单');
    }

    const childCommands = await this.pointsCommandRepository.find({
      where: { batchId: id },
      order: {
        id: 'ASC',
      },
    });
    const childCommandIds = childCommands.map((item) => item.id);

    const [relatedLedgerEntries, operationLogs, interactionEntities] = await Promise.all([
      childCommandIds.length
        ? this.pointsLedgerRepository
            .createQueryBuilder('ledger')
            .where('ledger.source_type = :sourceType', { sourceType: 'points_command_request' })
            .andWhere('ledger.source_id IN (:...sourceIds)', {
              sourceIds: childCommandIds.map((item) => String(item)),
            })
            .orderBy('ledger.executed_at', 'DESC')
            .addOrderBy('ledger.id', 'DESC')
            .getMany()
        : Promise.resolve([]),
      this.operationLogRepository.find({
        where: {
          module: 'points_welfare_batches',
          targetId: id,
        },
        order: {
          createdAt: 'DESC',
          id: 'DESC',
        },
      }),
      batch.threadKey
        ? this.aiAssistantInteractionRepository.find({
            where: { threadKey: batch.threadKey },
            order: {
              createdAt: 'DESC',
              id: 'DESC',
            },
            take: 12,
          })
        : Promise.resolve([]),
    ]);

    const childCommandSummary = childCommands.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.commandStatus] = (accumulator[item.commandStatus] ?? 0) + 1;
      return accumulator;
    }, {});
    const mappedLedgerEntries = relatedLedgerEntries.map((item) =>
      this.mapPointsLedgerEntryForAiContext(item),
    );
    const interactionHistory = interactionEntities.map((item) =>
      this.mapAssistantInteractionRecord(item),
    );

    const previewSummary = {
      eligibleEmployees:
        this.readObjectArray(batch.normalizedPayload, 'eligibleEmployees').slice(0, 12),
      excludedEmployees:
        this.readObjectArray(batch.normalizedPayload, 'excludedEmployees').slice(0, 12),
      previewRules: this.readObjectArray(batch.normalizedPayload, 'previewRules'),
      warnings: this.readObjectArray(batch.normalizedPayload, 'warnings'),
    };
    const pointsSummary = {
      ownerType: 'employee',
      periodKey: batch.periodKey,
      recentBatchCount: 1,
      recentCommandCount: childCommands.length,
      recentLedgerCount: mappedLedgerEntries.length,
      latestBalanceAfter: mappedLedgerEntries[0]?.balanceAfter ?? null,
      latestBatchId: batch.id,
      latestBatchStatus: batch.batchStatus,
    };
    const sourceInfo = {
      sourceType: batch.sourceType,
      requestSource: 'batch_draft',
      providerKey: batch.providerKey ?? null,
      sourceActionId: batch.sourceActionId ?? null,
      threadKey: batch.threadKey ?? null,
      targetRoutePath: '/points/welfare',
      targetEntityType: 'points_welfare_batch',
      targetEntityId: String(batch.id),
    };
    const statusInfo = {
      batchStatus: batch.batchStatus,
      targetEmployeeCount: batch.targetEmployeeCount,
      targetTotalAmount: batch.targetTotalAmount,
      childCommandSummary,
    };
    const approvalInfo = {
      requestedBy: batch.requestedBy,
      requestedByName: batch.requestedByName,
      requestedAt: batch.requestedAt?.toISOString() ?? null,
      confirmedBy: batch.confirmedBy,
      confirmedByName: batch.confirmedByName,
      confirmedAt: batch.confirmedAt?.toISOString() ?? null,
      executedBy: batch.executedBy,
      executedByName: batch.executedByName,
      executedAt: batch.executedAt?.toISOString() ?? null,
      cancelledBy: batch.cancelledBy,
      cancelledByName: batch.cancelledByName,
      cancelledAt: batch.cancelledAt?.toISOString() ?? null,
    };
    const ledgerImpact = {
      relatedLedgerCount: mappedLedgerEntries.length,
      latestBalanceAfter: mappedLedgerEntries[0]?.balanceAfter ?? null,
      totalIssuedAmount: mappedLedgerEntries
        .filter((item) => item.changeType === 'issue')
        .reduce((sum, item) => sum + Number(item.changeAmount || 0), 0)
        .toFixed(2),
      totalRevokedAmount: mappedLedgerEntries
        .filter((item) => item.changeType === 'revoke')
        .reduce((sum, item) => sum + Number(item.changeAmount || 0), 0)
        .toFixed(2),
    };
    const commandOrigin = {
      originType: batch.providerKey || batch.threadKey || batch.sourceActionId ? 'ai_draft' : 'manual_draft',
      requestSource: 'batch_draft',
      providerKey: batch.providerKey ?? null,
      sourceActionId: batch.sourceActionId ?? null,
      threadKey: batch.threadKey ?? null,
      suggestedScope:
        this.readObjectString(batch.normalizedPayload, 'suggestedScope') ?? 'same_pattern',
      suggestedJudgmentBasis: this.readObjectArray(batch.normalizedPayload, 'suggestedJudgmentBasis').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
      suggestedAiLearningMode:
        this.readObjectString(batch.normalizedPayload, 'suggestedAiLearningMode') ??
        'do_not_generalize',
    };

    const blockers = new Set<string>();
    if (batch.batchStatus === 'drafted') {
      blockers.add('points_welfare_batch_pending_confirmation');
    }
    if (batch.batchStatus === 'confirmed') {
      blockers.add('points_welfare_batch_waiting_execution');
    }
    if (batch.batchStatus === 'partially_executed') {
      blockers.add('points_welfare_batch_partially_executed');
    }
    if (batch.batchStatus === 'cancelled') {
      blockers.add('points_welfare_batch_cancelled');
    }
    if (previewSummary.warnings.length) {
      blockers.add('welfare_preview_warning');
    }
    const operationLogContext = this.loadOperationLogContextBundles({
      operationLogs,
    });

    const rawContext = {
      basicInfo: {
        batchId: batch.id,
        batchType: batch.batchType,
        batchStatus: batch.batchStatus,
        periodKey: batch.periodKey,
        targetEmployeeCount: batch.targetEmployeeCount,
        targetTotalAmount: batch.targetTotalAmount,
      },
      sourceInfo,
      statusInfo,
      approvalInfo,
      ledgerImpact,
      commandOrigin,
      previewSummary,
      childCommandSummary,
      pointsSummary,
      manualDecisionSummary: null,
      blockers: Array.from(blockers),
      suggestedNextStep: this.buildPointsWelfareBatchNextStep(batch.batchStatus),
      relatedLedgerEntries: mappedLedgerEntries,
      relatedRecordsPreview: childCommands.slice(0, 8).map((command) => ({
        id: command.id,
        commandStatus: command.commandStatus,
        ownerId: command.ownerId,
        ownerMobile: command.ownerMobile,
        changeAmount: command.changeAmount,
      })),
      operationLogContextBundles: operationLogContext.operationLogContextBundles,
      operationLogContextBundleSummary: operationLogContext.operationLogContextBundleSummary,
      executionTrace: {
        drafted: {
          requestedBy: batch.requestedBy,
          requestedByName: batch.requestedByName,
          requestedAt: batch.requestedAt?.toISOString() ?? null,
          providerKey: batch.providerKey ?? null,
          sourceActionId: batch.sourceActionId ?? null,
          threadKey: batch.threadKey ?? null,
        },
        confirmed:
          batch.confirmedAt || batch.confirmedBy
            ? {
                confirmedBy: batch.confirmedBy,
                confirmedByName: batch.confirmedByName,
                confirmedAt: batch.confirmedAt?.toISOString() ?? null,
                remark: this.readObjectString(batch.normalizedPayload, 'confirmRemark') ?? null,
              }
            : null,
        executed:
          batch.executedAt || batch.executedBy
            ? {
                executedBy: batch.executedBy,
                executedByName: batch.executedByName,
                executedAt: batch.executedAt?.toISOString() ?? null,
                remark: this.readObjectString(batch.normalizedPayload, 'executeRemark') ?? null,
                executeSummary:
                  this.readObjectObject(batch.normalizedPayload, 'executeSummary') ?? null,
              }
            : null,
        cancelled:
          batch.cancelledAt || batch.cancelledBy
            ? {
                cancelledBy: batch.cancelledBy,
                cancelledByName: batch.cancelledByName,
                cancelledAt: batch.cancelledAt?.toISOString() ?? null,
                remark: this.readObjectString(batch.normalizedPayload, 'cancelRemark') ?? null,
              }
            : null,
        operationLogs: operationLogs.map((item) => ({
          id: item.id,
          action: item.action,
          detail: item.detail,
          detailJson: item.detailJson ?? {},
          operatorId: item.operatorId,
          createdAt: item.createdAt?.toISOString() ?? null,
        })),
        interactionHistory,
      },
    };

    return {
      batch,
      basicInfo: rawContext.basicInfo,
      sourceInfo,
      statusInfo,
      approvalInfo,
      ledgerImpact,
      commandOrigin,
      previewSummary,
      childCommandSummary,
      blockers: Array.from(blockers),
      nextStepAfterDone: this.buildPointsWelfareBatchNextStep(batch.batchStatus),
      pointsSummary,
      rawContext,
      interactionHistory,
      relatedLedgerEntries: mappedLedgerEntries,
      executionTrace: rawContext.executionTrace,
    };
  }

  private async loadPointsWelfareBatchItemContextBase(
    id: number,
    currentUser: CurrentUser,
  ) {
    const item = await this.pointsWelfareBatchItemRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('AI 上下文未找到对应福利批次子项');
    }

    const batch = await this.pointsBatchRepository.findOne({ where: { id: item.batchId } });
    if (!batch) {
      throw new NotFoundException('AI 上下文未找到对应福利批次母单');
    }

    const childCommand = item.commandId
      ? await this.pointsCommandRepository.findOne({ where: { id: item.commandId } })
      : null;

    const [relatedLedgerEntries, interactionEntities] = await Promise.all([
      childCommand
        ? this.pointsLedgerRepository
            .createQueryBuilder('ledger')
            .where('ledger.source_type = :sourceType', { sourceType: 'points_command_request' })
            .andWhere('ledger.source_id = :sourceId', {
              sourceId: String(childCommand.id),
            })
            .orderBy('ledger.executed_at', 'DESC')
            .addOrderBy('ledger.id', 'DESC')
            .getMany()
        : Promise.resolve([]),
      batch.threadKey
        ? this.aiAssistantInteractionRepository.find({
            where: { threadKey: batch.threadKey },
            order: {
              createdAt: 'DESC',
              id: 'DESC',
            },
            take: 12,
          })
        : Promise.resolve([]),
    ]);

    const mappedLedgerEntries = relatedLedgerEntries.map((entry) =>
      this.mapPointsLedgerEntryForAiContext(entry),
    );
    const interactionHistory = interactionEntities.map((entry) =>
      this.mapAssistantInteractionRecord(entry),
    );

    const blockers = new Set<string>();
    if (item.allocationMode === 'custom') {
      blockers.add('points_welfare_item_custom_allocation');
    }
    if (item.allocationMode === 'hold') {
      blockers.add('points_welfare_item_on_hold');
    }
    if (item.allocationMode === 'excluded') {
      blockers.add('points_welfare_item_excluded');
    }
    if (batch.batchStatus === 'drafted') {
      blockers.add('points_welfare_batch_pending_confirmation');
    }
    if (batch.batchStatus === 'confirmed') {
      blockers.add('points_welfare_batch_waiting_execution');
    }
    if (batch.batchStatus === 'partially_executed') {
      blockers.add('points_welfare_batch_partially_executed');
    }
    if (!childCommand && ['default', 'custom'].includes(item.allocationMode)) {
      blockers.add('points_welfare_item_command_missing');
    }

    const nextStepAfterDone =
      item.allocationMode === 'hold'
        ? '这条子项当前在暂不发放区，建议先补充留后原因，再决定是否拉回默认或自定义发放。'
        : item.allocationMode === 'excluded'
          ? '这条子项当前在自动排除区，建议先核对排除原因，再决定是否恢复默认或转自定义发放。'
          : batch.batchStatus === 'drafted'
            ? '母单仍是草案，建议先确认母单，再决定是否执行子命令。'
            : batch.batchStatus === 'confirmed'
              ? '母单已确认，若这条子项仍保留在默认/自定义区，可进入执行并写入积点账本。'
              : childCommand?.commandStatus === 'executed'
                ? '这条子命令已执行，下一步重点是回看 ledger 留痕、余额变化和后续影响。'
                : '建议先核对子项分配方式、原因说明和子命令状态，再决定下一步。';

    const statusInfo = {
      batchStatus: batch.batchStatus,
      allocationMode: item.allocationMode,
      defaultAmount: item.defaultAmount,
      finalAmount: item.finalAmount,
      exclusionReason: item.exclusionReason,
      adjustmentReasonCode: item.adjustmentReasonCode,
      adjustmentRemark: item.adjustmentRemark,
      decisionScope: item.decisionScope,
      aiLearningMode: item.aiLearningMode,
      basisType: item.basisType,
      childCommandId: item.commandId ?? null,
      childCommandStatus: childCommand?.commandStatus ?? null,
    };
    const approvalInfo = {
      batchRequestedByName: batch.requestedByName,
      batchConfirmedByName: batch.confirmedByName,
      batchExecutedByName: batch.executedByName,
      decidedBy: item.decidedBy,
      decidedAt: item.decidedAt?.toISOString?.() ?? null,
      childCommandRequestedByName: childCommand?.requestedByName ?? null,
      childCommandConfirmedByName: childCommand?.confirmedByName ?? null,
      childCommandExecutedByName: childCommand?.executedByName ?? null,
    };
    const sourceInfo = {
      sourceType: 'employee_monthly_welfare',
      requestSource: childCommand?.requestSource ?? 'batch_draft',
      providerKey: batch.providerKey ?? null,
      sourceActionId: batch.sourceActionId ?? null,
      threadKey: batch.threadKey ?? null,
      targetRoutePath: '/points/welfare',
      targetEntityType: 'points_welfare_batch_item',
      targetEntityId: String(item.id),
      batchId: batch.id,
      commandId: item.commandId ?? null,
    };
    const ledgerImpact = {
      relatedLedgerCount: mappedLedgerEntries.length,
      latestBalanceAfter: mappedLedgerEntries[0]?.balanceAfter ?? null,
      totalIssuedAmount: mappedLedgerEntries
        .filter((entry) => entry.changeType === 'issue')
        .reduce((sum, entry) => sum + Number(entry.changeAmount || 0), 0)
        .toFixed(2),
      totalRevokedAmount: mappedLedgerEntries
        .filter((entry) => entry.changeType === 'revoke')
        .reduce((sum, entry) => sum + Number(entry.changeAmount || 0), 0)
        .toFixed(2),
    };
    const manualDecisionSummary = {
      allocationMode: item.allocationMode,
      finalAmount: item.finalAmount,
      adjustmentReasonCode: item.adjustmentReasonCode,
      adjustmentRemark: item.adjustmentRemark,
      exclusionReason: item.exclusionReason,
      basisType: item.basisType,
      decisionScope: item.decisionScope,
      aiLearningMode: item.aiLearningMode,
      decidedBy: item.decidedBy,
      decidedAt: item.decidedAt?.toISOString?.() ?? null,
    };
    const pointsSummary = {
      ownerType: 'employee',
      ownerId: item.employeeId,
      ownerMobile: this.maskMobileForAi(item.employeeMobileSnapshot, currentUser),
      recentCommandCount: childCommand ? 1 : 0,
      recentLedgerCount: mappedLedgerEntries.length,
      latestBalanceAfter: mappedLedgerEntries[0]?.balanceAfter ?? null,
      latestBatchId: batch.id,
      latestBatchStatus: batch.batchStatus,
    };

    const rawContext = {
      basicInfo: {
        batchId: batch.id,
        periodKey: batch.periodKey,
        batchType: batch.batchType,
        employeeId: item.employeeId,
        employeeName: item.employeeNameSnapshot,
        employeeMobile: this.maskMobileForAi(item.employeeMobileSnapshot, currentUser),
        companyName: item.companyNameSnapshot,
        positionName: item.positionNameSnapshot,
      },
      statusInfo,
      approvalInfo,
      sourceInfo,
      ledgerImpact,
      pointsSummary,
      manualDecisionSummary,
      blockers: Array.from(blockers),
      suggestedNextStep: nextStepAfterDone,
      relatedLedgerEntries: mappedLedgerEntries,
      relatedRecordsPreview: childCommand
        ? [
            {
              id: childCommand.id,
              commandStatus: childCommand.commandStatus,
              changeAmount: childCommand.changeAmount,
              requestSource: childCommand.requestSource,
              reasonCode: childCommand.reasonCode,
            },
          ]
        : [],
      executionTrace: {
        batch: {
          id: batch.id,
          batchStatus: batch.batchStatus,
          requestedByName: batch.requestedByName,
          confirmedByName: batch.confirmedByName,
          executedByName: batch.executedByName,
        },
        item: {
          id: item.id,
          allocationMode: item.allocationMode,
          defaultAmount: item.defaultAmount,
          finalAmount: item.finalAmount,
          adjustmentRemark: item.adjustmentRemark,
          exclusionReason: item.exclusionReason,
          decisionScope: item.decisionScope,
          aiLearningMode: item.aiLearningMode,
          decidedAt: item.decidedAt?.toISOString?.() ?? null,
        },
        childCommand: childCommand
          ? {
              id: childCommand.id,
              commandStatus: childCommand.commandStatus,
              requestedByName: childCommand.requestedByName,
              confirmedByName: childCommand.confirmedByName,
              executedByName: childCommand.executedByName,
            }
          : null,
        interactionHistory,
      },
    };

    return {
      item,
      batch,
      childCommand,
      statusInfo,
      pointsSummary,
      rawContext,
      blockers: Array.from(blockers),
      nextStepAfterDone,
      interactionHistory,
      relatedLedgerEntries: mappedLedgerEntries,
      executionTrace: rawContext.executionTrace,
    };
  }

  private async resolveLinkedSummaryContextForPointsCommand(
    command: PointsCommandRequest,
    currentUser: CurrentUser,
  ): Promise<AiSummaryContextResponse | null> {
    const payload = (command.normalizedPayload ?? {}) as Record<string, unknown>;
    const targetEntity = this.readObjectObject(payload, 'targetEntity');
    const entityType = this.readObjectString(targetEntity, 'entityType');
    const entityId = this.readObjectString(targetEntity, 'entityId');

    if (!entityType || !entityId) {
      return null;
    }

    if (entityType === 'performance_summary') {
      return this.getSummaryContext(
        Number(entityId),
        { summaryType: 'performance' } as QueryAiSummaryContextDto,
        currentUser,
      );
    }

    if (entityType === 'business_stat_summary') {
      return this.getSummaryContext(
        Number(entityId),
        { summaryType: 'business_stats' } as QueryAiSummaryContextDto,
        currentUser,
      );
    }

    return null;
  }

  private buildLatestDecisionFallback(summary: Record<string, unknown>) {
    if (!summary.latestDecisionAction) {
      return null;
    }

    return {
      actionType: summary.latestDecisionAction ?? null,
      reasonCode: summary.latestDecisionReason ?? null,
      operatorName: summary.latestDecisionBy ?? null,
      operatedAt: summary.latestDecisionAt ?? null,
    };
  }

  private collectSummaryBlockers(
    summaryType: 'performance' | 'business_stats',
    summary: Record<string, unknown>,
  ) {
    const blockers = new Set<string>();

    if (summaryType === 'performance') {
      const performanceBlockReason = summary.performanceBlockReason;
      if (typeof performanceBlockReason === 'string' && performanceBlockReason.trim()) {
        blockers.add(performanceBlockReason);
      }
      const bindingStatus = (summary.customerBinding as Record<string, unknown> | undefined)
        ?.bindingStatus;
      if (bindingStatus === 'manual_pending') {
        blockers.add('missing_customer_binding');
      }
    } else {
      const payrollBlockReason = summary.payrollBlockReason;
      if (typeof payrollBlockReason === 'string' && payrollBlockReason.trim()) {
        blockers.add(payrollBlockReason);
      }
      if (summary.payrollDecision === 'pending_confirmation') {
        blockers.add('pending_confirmation');
      }
    }

    if (summary.reconciliationStatus === 'sheet_missing') {
      blockers.add('sheet_missing');
    }

    return Array.from(blockers);
  }

  private buildSummarySuggestedNextStep(
    summaryType: 'performance' | 'business_stats',
    summary: Record<string, unknown>,
  ) {
    if (summary.reconciliationStatus === 'sheet_missing') {
      return '先补齐台账漏记证据，再回到汇总页复核。';
    }

    if (summary.performanceBlockReason === 'missing_customer_binding') {
      return '先完成客户绑定人工确认，再进入绩效确认。';
    }

    if (summary.performanceBlockReason === 'awaiting_manual_review') {
      return '这条记录已具备证据，请安排人工确认闭环。';
    }

    if (summary.payrollDecision === 'pending_confirmation') {
      return summaryType === 'business_stats'
        ? '先完成经营统计确认，再做工资试算前置准备。'
        : '先完成绩效确认，再进入工资试算前置准备。';
    }

    return '当前上下文已具备基础信息，可继续人工复核下一步处理。';
  }

  private isNotFoundError(error: unknown) {
    return error instanceof NotFoundException;
  }

  private buildCustomerBindingTemplates(): AiActionTemplate[] {
    return [
      {
        ownerRole: 'customer_service',
        impactType: 'customer_binding',
        impactTags: ['customer_binding', 'payroll_blocking'],
        dueLevel: 'must_handle_today',
        directTargetType: 'performance_pending',
        relatedPagePath: '/performance/pending',
        relatedPageQuery: {
          performanceBlockReason: 'missing_customer_binding',
          includeResolved: 'false',
        },
        suggestedFilterLabel: '仅看缺客户绑定',
        deadlineOffsetDays: 0,
        actionTitle: '客服先补齐客户绑定',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条样本缺客户绑定，先把手机号明确的客户核对出来。`,
        whyNow: (aggregate) =>
          `这批样本影响金额 ${this.displayAmountOrUnknown(aggregate.relatedAmount)}，不先处理会继续卡住绩效识别。`,
        suggestedAction: () => '先按手机号核对待确认清单，优先确认唯一候选客户，再交给后续岗位继续处理。',
        blockers: () => ['缺客户绑定', '缺人工确认'],
        nextStepAfterDone: () => '完成后可进入绩效确认或月度统计复核。',
      },
      {
        ownerRole: 'store_manager',
        impactType: 'customer_binding',
        impactTags: ['customer_binding', 'payroll_blocking'],
        dueLevel: 'must_handle_today',
        directTargetType: 'performance_pending',
        relatedPagePath: '/performance/pending',
        relatedPageQuery: {
          performanceBlockReason: 'missing_customer_binding',
          includeResolved: 'false',
        },
        suggestedFilterLabel: '仅看缺客户绑定',
        deadlineOffsetDays: 0,
        actionTitle: '门店负责人核对客户归属',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 有 ${aggregate.relatedCount} 条记录需要门店确认客户是谁，避免手机号和业务归属继续悬空。`,
        whyNow: (aggregate) =>
          `不先确认，涉及 ${this.displayAmountOrUnknown(aggregate.relatedAmount)} 的记录会一直停在人工待处理。`,
        suggestedAction: () => '优先处理手机号明确但客户绑定未落库的样本，确认后再流转给财务和审批。',
        blockers: () => ['缺客户绑定', '门店归属未确认'],
        nextStepAfterDone: () => '完成后可进入绩效确认与工资试算前置准备。',
      },
      {
        ownerRole: 'admin',
        impactType: 'customer_binding',
        impactTags: ['customer_binding', 'payroll_blocking'],
        dueLevel: 'must_handle_today',
        directTargetType: 'performance_pending',
        relatedPagePath: '/performance/pending',
        relatedPageQuery: {
          performanceBlockReason: 'missing_customer_binding',
          includeResolved: 'false',
        },
        suggestedFilterLabel: '仅看缺客户绑定',
        deadlineOffsetDays: 0,
        actionTitle: '管理员收口客户绑定阻塞',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 仍有 ${aggregate.relatedCount} 条客户绑定阻塞样本，需要管理员推动人工确认闭环。`,
        whyNow: (aggregate) =>
          `这批记录影响金额 ${this.displayAmountOrUnknown(aggregate.relatedAmount)}，不处理会直接拖慢后续绩效流程。`,
        suggestedAction: () => '对唯一候选样本先走人工绑定，对冲突样本安排客服或门店继续核对。',
        blockers: () => ['缺客户绑定', '人工确认未完成'],
        nextStepAfterDone: () => '完成后可进入绩效确认和月度统计复核。',
      },
    ];
  }

  private buildSheetRepairTemplates(stagingWindow: {
    periodStart: string;
    periodEnd: string;
    recordCount: number;
  }): AiActionTemplate[] {
    return [
      {
        ownerRole: 'finance',
        impactType: 'financial_reconciliation',
        impactTags: ['financial_reconciliation', 'data_accuracy'],
        dueLevel: 'must_handle_today',
        directTargetType: 'performance_summaries',
        relatedPagePath: '/performance/summaries',
        relatedPageQuery: {
          reconciliationStatus: 'sheet_missing',
        },
        suggestedFilterLabel: '仅看台账漏记',
        deadlineOffsetDays: 0,
        actionTitle: '财务先修复台账漏记',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条台账漏记样本，已影响 ${this.displayAmountOrUnknown(aggregate.relatedAmount)} 的统计准确性。`,
        whyNow: () =>
          stagingWindow.recordCount > 0
            ? `当前办卡明细已覆盖 ${stagingWindow.periodStart} 至 ${stagingWindow.periodEnd}，现在最适合先补 sheet_missing。`
            : '当前 staging 台账覆盖不足，越晚补录越难对齐真实业务。',
        suggestedAction: () => '先回到绩效汇总页处理 sheet_missing 样本，优先 2 月柯凌咔相关记录。',
        blockers: () => ['缺台账补录', '财务对账未完成'],
        nextStepAfterDone: () => '完成后可进入月度统计复核与绩效确认。',
      },
      {
        ownerRole: 'admin',
        impactType: 'data_accuracy',
        impactTags: ['data_accuracy', 'financial_reconciliation'],
        dueLevel: 'must_handle_today',
        directTargetType: 'business_stat_summaries',
        relatedPagePath: '/business-stats/summaries',
        relatedPageQuery: {
          reconciliationStatus: 'sheet_missing',
        },
        suggestedFilterLabel: '仅看台账漏记',
        deadlineOffsetDays: 0,
        actionTitle: '管理员盯住台账修复进度',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条台账漏记，继续放着会让月度统计一直带着人工缺口。`,
        whyNow: (aggregate) =>
          `这批样本影响金额 ${this.displayAmountOrUnknown(aggregate.relatedAmount)}，不跟进会拖慢整条核对链。`,
        suggestedAction: () => '先协调财务补齐台账，再回看业务统计汇总是否恢复到可复核状态。',
        blockers: () => ['缺台账补录', '数据准确性未收口'],
        nextStepAfterDone: () => '完成后可进入月度统计复核与工资试算前置准备。',
      },
    ];
  }

  private buildPerformanceConfirmationTemplates(): AiActionTemplate[] {
    return [
      {
        ownerRole: 'approver',
        impactType: 'performance_confirmation',
        impactTags: ['performance_confirmation', 'payroll_blocking'],
        dueLevel: 'should_handle_this_week',
        directTargetType: 'performance_summaries',
        relatedPagePath: '/performance/summaries',
        relatedPageQuery: {
          performanceBlockReason: 'awaiting_manual_review',
        },
        suggestedFilterLabel: '仅看待人工确认',
        deadlineOffsetDays: 2,
        actionTitle: '审批人确认已具备证据的绩效记录',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条记录证据已齐但尚未确认，可以安排本周优先处理。`,
        whyNow: (aggregate) =>
          `不确认，这批影响 ${this.displayAmountOrUnknown(aggregate.relatedAmount)} 的记录会继续卡在后续流程前面。`,
        suggestedAction: () => '先看待确认汇总，优先处理证据完整、阻塞最少的样本。',
        blockers: () => ['缺人工确认'],
        nextStepAfterDone: () => '完成后可进入工资试算前置准备，但仍不等于正式工资结论。',
      },
      {
        ownerRole: 'founder',
        impactType: 'payroll_blocking',
        impactTags: ['payroll_blocking', 'performance_confirmation'],
        dueLevel: 'should_handle_this_week',
        directTargetType: 'performance_summaries',
        relatedPagePath: '/performance/summaries',
        relatedPageQuery: {
          performanceBlockReason: 'awaiting_manual_review',
        },
        suggestedFilterLabel: '仅看待人工确认',
        deadlineOffsetDays: 2,
        actionTitle: '创始人关注关键绩效阻塞',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条关键记录已具备证据但未确认，建议尽快推动责任人处理。`,
        whyNow: (aggregate) =>
          `这批记录影响金额 ${this.displayAmountOrUnknown(aggregate.relatedAmount)}，不推动会延后后续经营闭环。`,
        suggestedAction: () => '先看高金额、证据完整的待确认汇总，推动审批人或管理员优先处理。',
        blockers: () => ['缺人工确认', '流程推进缓慢'],
        nextStepAfterDone: () => '完成后可进入绩效复核与工资试算前置准备。',
      },
      {
        ownerRole: 'admin',
        impactType: 'performance_confirmation',
        impactTags: ['performance_confirmation', 'payroll_blocking'],
        dueLevel: 'should_handle_this_week',
        directTargetType: 'performance_summaries',
        relatedPagePath: '/performance/summaries',
        relatedPageQuery: {
          performanceBlockReason: 'awaiting_manual_review',
        },
        suggestedFilterLabel: '仅看待人工确认',
        deadlineOffsetDays: 2,
        actionTitle: '管理员推进绩效确认闭环',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条记录已经有证据基础，但还没走完确认动作。`,
        whyNow: (aggregate) =>
          `这批样本影响金额 ${this.displayAmountOrUnknown(aggregate.relatedAmount)}，不处理会压住后续统计复核。`,
        suggestedAction: () => '先筛证据齐全的样本，推动审批人确认，再回收剩余阻塞项。',
        blockers: () => ['缺人工确认'],
        nextStepAfterDone: () => '完成后可进入月度统计复核与工资试算前置准备。',
      },
    ];
  }

  private buildDataCleanupTemplates(): AiActionTemplate[] {
    return [
      {
        ownerRole: 'admin',
        impactType: 'audit_cleanup',
        impactTags: ['audit_cleanup', 'data_accuracy'],
        dueLevel: 'can_defer',
        directTargetType: 'business_stat_summaries',
        relatedPagePath: '/business-stats/summaries',
        relatedPageQuery: {
          paymentStatus: 'unpaid,test_data,unknown,internal_admin',
        },
        suggestedFilterLabel: '仅看未支付/测试/未知',
        deadlineOffsetDays: 5,
        actionTitle: '管理员清理测试与未支付记录',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 发现 ${aggregate.relatedCount} 条测试、未支付或未知来源记录，建议先做审计清理。`,
        whyNow: (aggregate) =>
          `这些记录虽然不一定马上阻塞流程，但会持续污染 ${this.displayAmountOrUnknown(aggregate.relatedAmount)} 的统计视图。`,
        suggestedAction: () => '先把 test_data、unpaid、unknown 样本分层，再安排后续人工复核。',
        blockers: () => ['测试数据未清理', '未支付记录仍混入视图'],
        nextStepAfterDone: () => '完成后可减少月度统计噪音，方便后续核对。',
      },
      {
        ownerRole: 'finance',
        impactType: 'data_accuracy',
        impactTags: ['data_accuracy', 'audit_cleanup'],
        dueLevel: 'can_defer',
        directTargetType: 'business_stat_summaries',
        relatedPagePath: '/business-stats/summaries',
        relatedPageQuery: {
          paymentStatus: 'unpaid,test_data,unknown,internal_admin',
        },
        suggestedFilterLabel: '仅看未支付/测试/未知',
        deadlineOffsetDays: 5,
        actionTitle: '财务清点异常来源记录',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条测试或未支付样本未清理，建议留作本周低优先级治理。`,
        whyNow: (aggregate) =>
          `不先整理，这批涉及 ${this.displayAmountOrUnknown(aggregate.relatedAmount)} 的记录会反复干扰经营统计判断。`,
        suggestedAction: () => '先确认哪些是测试数据、哪些是未支付，避免继续混入财务视图。',
        blockers: () => ['测试/未支付样本未分类'],
        nextStepAfterDone: () => '完成后可提升统计准确性，减少后续人工二次解释。',
      },
    ];
  }

  private buildRedemptionReconciliationTemplates(): AiActionTemplate[] {
    return [
      {
        ownerRole: 'finance',
        impactType: 'financial_reconciliation',
        impactTags: ['financial_reconciliation', 'bcard_reconciliation'],
        dueLevel: 'must_handle_today',
        directTargetType: 'points_redemptions',
        relatedPagePath: '/points/redemptions',
        relatedPageQuery: {
          reconciliationStatus: 'fulfilled_pending_consume,mismatch_needs_review,waiting_fulfillment',
          exceptionFlag:
            'abc_fulfilled_but_no_consume,consume_written_but_no_abc_fulfillment,stale_pending_fulfillment,stale_confirmed_not_fulfilled,external_record_missing,mobile_mapping_conflict',
        },
        suggestedFilterLabel: '仅看兑换履约与对账异常',
        deadlineOffsetDays: 0,
        actionTitle: '财务先核对积点兑换异常',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条积点兑换请求卡在履约或对账异常，需尽快核实总部 consume 与 ABC 影子记录是否一致。`,
        whyNow: (aggregate) =>
          `这批兑换请求对应 ${this.displayAmountOrUnknown(aggregate.relatedAmount)} 的目标价值；越晚核对，越难回溯总部与 ABC 两边的履约痕迹。`,
        suggestedAction: () =>
          '先查看兑换详情页里的对账与异常区，优先处理“ABC 已履约但总部未 consume”和“总部已 consume 但 ABC 影子缺失”的样本。',
        blockers: () => ['兑换履约未闭环', '总部与 ABC 对账异常'],
        nextStepAfterDone: () => '完成后可形成积点兑换履约闭环，并减少后续人工追账。',
      },
      {
        ownerRole: 'admin',
        impactType: 'audit_cleanup',
        impactTags: ['audit_cleanup', 'financial_reconciliation'],
        dueLevel: 'should_handle_this_week',
        directTargetType: 'points_redemptions',
        relatedPagePath: '/points/redemptions',
        relatedPageQuery: {
          reconciliationStatus: 'mismatch_needs_review,waiting_fulfillment',
        },
        suggestedFilterLabel: '仅看待复核的兑换异常',
        deadlineOffsetDays: 2,
        actionTitle: '管理员跟进积点兑换异常闭环',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条积点兑换请求缺履约凭据或影子命中不稳定，建议本周跟进收口。`,
        whyNow: () =>
          '如果不及时补齐履约凭据和外部编号，后续 AI 与人工都会反复解释同一条异常。',
        suggestedAction: () => '先协调履约人补 ABC 外部单号，再确认总部是否已经正确写入 consume ledger。',
        blockers: () => ['缺履约回填', '影子映射不稳定'],
        nextStepAfterDone: () => '完成后可把兑换请求从异常视图里移出，保留为可回查的完成记录。',
      },
      {
        ownerRole: 'founder',
        impactType: 'bcard_reconciliation',
        impactTags: ['bcard_reconciliation', 'financial_reconciliation'],
        dueLevel: 'should_handle_this_week',
        directTargetType: 'points_redemptions',
        relatedPagePath: '/points/redemptions',
        relatedPageQuery: {
          reconciliationStatus: 'mismatch_needs_review,fulfilled_pending_consume',
        },
        suggestedFilterLabel: '仅看关键兑换闭环异常',
        deadlineOffsetDays: 2,
        actionTitle: '创始人关注积点兑换闭环风险',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条积点兑换请求未形成可解释闭环，建议推动财务与管理员优先处理。`,
        whyNow: (aggregate) =>
          `这批兑换请求影响 ${this.displayAmountOrUnknown(aggregate.relatedAmount)} 的购物卡价值，不及时处理会让总部与 ABC 的账实长期分离。`,
        suggestedAction: () => '优先看已履约未 consume 和影子缺失样本，推动责任人补齐对账链。',
        blockers: () => ['兑换闭环未形成', '履约与账本链分离'],
        nextStepAfterDone: () => '完成后可把积点兑换链稳定成“审批单 + 履约单 + 对账单”。',
      },
    ];
  }

  private buildAbcScoreCommandBlockedTemplates(): AiActionTemplate[] {
    return [
      {
        ownerRole: 'admin',
        impactType: 'customer_binding',
        impactTags: ['customer_binding', 'audit_cleanup'],
        dueLevel: 'must_handle_today',
        directTargetType: 'abc_points_commands',
        relatedPagePath: '/abc-points/commands',
        relatedPageQuery: {
          commandStatus: 'blocked,confirmed',
          blockedReason:
            'abc_score_write_path_not_stable,mobile_mapping_conflict,abc_user_not_found,legacy_db_direct_risk',
          canExecute: 'false',
        },
        suggestedFilterLabel: '仅看 ABC 积分命令阻塞样本',
        deadlineOffsetDays: 0,
        actionTitle: '管理员先处理 ABC 积分命令阻塞',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条 ABC 积分命令被阻塞或预检未通过，需要先收口手机号映射和受控写入边界。`,
        whyNow: (aggregate) =>
          `这批命令对应 ${this.displayAmountOrUnknown(aggregate.relatedAmount)} 的积分调整量，不先说明 blocked 原因，现场会继续误以为可以直接改库。`,
        suggestedAction: () =>
          '先进入 ABC 积分命令详情页查看 blocked / precheck 诊断，优先区分是写入路径问题还是手机号映射冲突。',
        blockers: () => ['ABC 积分命令 blocked', '手机号映射或写入路径未收口'],
        nextStepAfterDone: () => '完成后可形成可解释的命令诊断单，但仍不代表已经开放自动写入 ABC。',
      },
      {
        ownerRole: 'finance',
        impactType: 'financial_reconciliation',
        impactTags: ['financial_reconciliation', 'audit_cleanup'],
        dueLevel: 'should_handle_this_week',
        directTargetType: 'abc_points_commands',
        relatedPagePath: '/abc-points/commands',
        relatedPageQuery: {
          commandStatus: 'blocked,confirmed',
          canExecute: 'false',
          blockedReason: 'abc_score_write_path_not_stable,mobile_mapping_conflict,abc_user_not_found',
        },
        suggestedFilterLabel: '仅看需财务协同的 ABC 积分阻塞',
        deadlineOffsetDays: 2,
        actionTitle: '财务协同核对 ABC 积分阻塞命令',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 仍有 ${aggregate.relatedCount} 条 ABC 积分命令未形成受控闭环，建议财务关注受影响的积分调整量和审计说明。`,
        whyNow: (aggregate) =>
          `这些命令虽然未真正执行，但会持续影响 ${this.displayAmountOrUnknown(aggregate.relatedAmount)} 的积分调整预期和后续对账解释。`,
        suggestedAction: () =>
          '优先核查高优先级 hq_issue 草稿与 blocked 命令，确认是否需要补充受控写入条件或保留 blocked 审计。',
        blockers: () => ['受控写入未稳定', '财务解释链未收口'],
        nextStepAfterDone: () => '完成后可沉淀成清晰的 blocked 诊断口径，减少后续重复解释。',
      },
      {
        ownerRole: 'founder',
        impactType: 'audit_cleanup',
        impactTags: ['audit_cleanup', 'financial_reconciliation'],
        dueLevel: 'should_handle_this_week',
        directTargetType: 'abc_points_commands',
        relatedPagePath: '/abc-points/commands',
        relatedPageQuery: {
          commandStatus: 'blocked,confirmed',
          blockedReason: 'abc_score_write_path_not_stable,mobile_mapping_conflict',
        },
        suggestedFilterLabel: '仅看关键 ABC 积分命令阻塞',
        deadlineOffsetDays: 2,
        actionTitle: '创始人关注 ABC 积分命令系统边界',
        actionSummary: (aggregate, periodLabel) =>
          `${periodLabel} 还有 ${aggregate.relatedCount} 条 ABC 积分命令被系统边界或手机号映射卡住，建议推动责任岗位先把诊断口径收口。`,
        whyNow: () =>
          '如果 blocked 原因讲不清楚，现场就容易回到“数据库手改”这种错误路径。',
        suggestedAction: () =>
          '优先查看 blocked 详情里的 precheck 与审计轨迹，推动 admin / finance 先把受控写入边界讲清楚。',
        blockers: () => ['ABC 积分写入边界未稳定', 'blocked 原因未形成统一解释'],
        nextStepAfterDone: () => '完成后可为后续受控写入打基础，但本轮仍不能假装已经执行成功。',
      },
    ];
  }

  private buildActionItems(
    aggregate: AiTaskAggregate,
    templates: AiActionTemplate[],
    periodLabel: string,
    query: QueryAiNextActionsDto,
    calculation: AiCalculationContext,
  ): AiActionItem[] {
    if (!aggregate.relatedCount) {
      return [];
    }

    return templates.map((template) => ({
      actionId: `${aggregate.taskType}:${template.ownerRole}:${template.dueLevel}:${aggregate.timeBucket}`,
      ownerRole: template.ownerRole,
      ownerRoleLabel: OWNER_ROLE_LABELS[template.ownerRole],
      taskType: aggregate.taskType,
      actionTitle: template.actionTitle,
      actionSummary: template.actionSummary(aggregate, periodLabel),
      whyNow: template.whyNow(aggregate, periodLabel),
      impactType: template.impactType,
      impactTags: template.impactTags,
      relatedCount: aggregate.relatedCount,
      relatedAmount: aggregate.relatedAmount,
      dueLevel: template.dueLevel,
      suggestedAction: template.suggestedAction(aggregate, periodLabel),
      directTargetType: template.directTargetType,
      relatedPagePath: template.relatedPagePath,
      relatedPageQuery: this.buildRelatedPageQuery(
        template.relatedPageQuery,
        aggregate,
        query,
        calculation,
      ),
      suggestedFilterLabel: template.suggestedFilterLabel,
      deadline: this.buildDeadline(template.deadlineOffsetDays, calculation.anchorNow),
      timeBucket: aggregate.timeBucket,
      bucketLabel: aggregate.bucketLabel,
      timeAnchorType: aggregate.timeAnchorType,
      timeAnchorDate: aggregate.timeAnchorDate,
      processingStatus: 'active',
      deferUntil: null,
      deferReason: null,
      markedBy: null,
      markedByName: null,
      markedAt: null,
      reopenAt: null,
      statusRemark: null,
      shouldReopen: false,
      blockers: template.blockers(aggregate),
      nextStepAfterDone: template.nextStepAfterDone(aggregate),
      sourceBreakdown: aggregate.sourceBreakdown,
    }));
  }

  private buildBucketedActionItems(
    taskType: AiNextActionTaskType,
    records: AiTaskSourceRecord[],
    templates: AiActionTemplate[],
    periodLabel: string,
    query: QueryAiNextActionsDto,
    calculation: AiCalculationContext,
  ): AiActionItem[] {
    const grouped = new Map<AiTimeBucket, AiTaskSourceRecord[]>();

    for (const item of records) {
      const timeBucket = this.resolveTimeBucketForRecord(
        item.record,
        calculation.periodMode,
        item.timeAnchorType,
        calculation.anchorNow,
      );
      if (calculation.requestedTimeBucket && timeBucket !== calculation.requestedTimeBucket) {
        continue;
      }
      if (!grouped.has(timeBucket)) {
        grouped.set(timeBucket, []);
      }
      grouped.get(timeBucket)?.push(item);
    }

    return Array.from(grouped.entries()).flatMap(([timeBucket, bucketRecords]) =>
      this.buildActionItems(
        this.createAggregate(bucketRecords, taskType, timeBucket, calculation.periodMode),
        templates,
        calculation.requestedTimeBucket
          ? periodLabel
          : this.mapTimeBucketLabel(timeBucket, calculation.periodMode),
        query,
        calculation,
      ),
    );
  }

  private createAggregate(
    records: AiTaskSourceRecord[],
    taskType: AiNextActionTaskType,
    timeBucket: AiTimeBucket,
    periodMode: AiPeriodMode,
  ): AiTaskAggregate {
    const sourceBreakdown = Array.from(
      records.reduce((map, item) => {
        const existing = map.get(item.source) ?? { source: item.source, items: [] as AiTaskSourceRecord[] };
        existing.items.push(item);
        map.set(item.source, existing);
        return map;
      }, new Map<string, { source: string; items: AiTaskSourceRecord[] }>()),
    )
      .map(([, input]) => ({
        source: input.source,
        count: input.items.length,
        amount: this.sumAmounts(
          input.items.map((item) => this.readAmountField(item.record ?? null, item.amountField)),
        ),
      }))
      .filter((item) => item.count > 0);

    const anchorCandidates = records
      .map((item) => this.resolveAnchorCandidate(item.record, item.timeAnchorType ?? null))
      .filter((item): item is { type: string; date: Date } => Boolean(item));
    const latestAnchor = anchorCandidates.sort((left, right) => right.date.getTime() - left.date.getTime())[0];

    return {
      taskType,
      relatedCount: sourceBreakdown.reduce((sum, item) => sum + item.count, 0),
      relatedAmount: this.sumAmounts(sourceBreakdown.map((item) => item.amount)),
      timeBucket,
      bucketLabel: this.mapTimeBucketLabel(timeBucket, periodMode),
      timeAnchorType: latestAnchor?.type ?? null,
      timeAnchorDate: latestAnchor?.date.toISOString() ?? null,
      sourceBreakdown,
    };
  }

  private buildRelatedPageQuery(
    baseQuery: Record<string, string | number | undefined>,
    aggregate: AiTaskAggregate,
    query: QueryAiNextActionsDto,
    calculation: AiCalculationContext,
  ) {
    const timeQuery = this.buildTimeBucketQuery(
      aggregate.timeBucket,
      calculation.periodMode,
      query,
      calculation.anchorNow,
    );
    return {
      ...baseQuery,
      ...timeQuery,
      timeBucket: aggregate.timeBucket,
      periodMode: calculation.periodMode,
      processingView: 'active',
      aiOwnerRole: query.role,
    };
  }

  private buildTimeBucketQuery(
    timeBucket: AiTimeBucket,
    periodMode: AiPeriodMode,
    query: QueryAiNextActionsDto,
    anchorNow: Date,
  ) {
    if (timeBucket === 'custom_range' && query.dateFrom && query.dateTo) {
      return {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      };
    }

    if (timeBucket === 'this_month') {
      return { periodKey: this.toPeriodKey(anchorNow) };
    }
    if (timeBucket === 'last_month') {
      return { periodKey: this.toPeriodKey(this.addMonths(anchorNow, -1)) };
    }
    if (timeBucket === 'this_week') {
      const start = this.startOfWeek(anchorNow);
      const end = this.endOfWeek(anchorNow);
      return {
        dateFrom: start.toISOString(),
        dateTo: end.toISOString(),
      };
    }
    if (timeBucket === 'last_week') {
      const start = this.startOfWeek(this.addDays(anchorNow, -7));
      const end = this.endOfWeek(this.addDays(anchorNow, -7));
      return {
        dateFrom: start.toISOString(),
        dateTo: end.toISOString(),
      };
    }
    if (timeBucket === 'future') {
      return {
        dateFrom: this.startOfDay(this.addDays(anchorNow, 1)).toISOString(),
      };
    }
    if (timeBucket === 'backlog_history') {
      if (periodMode === 'week') {
        return {
          dateTo: this.endOfWeek(this.addDays(anchorNow, -7)).toISOString(),
        };
      }
      return {
        dateTo: this.endOfMonth(this.addMonths(anchorNow, -1)).toISOString(),
      };
    }
    return {};
  }

  private async collectAllPerformancePendingItems(
    query: QueryAiNextActionsDto,
    currentUser: CurrentUser,
  ) {
    return this.collectAllPages((page) =>
      this.performanceService.findPendingPerformanceItems(
        {
          page,
          pageSize: 100,
          includeResolved: query.includeDone ?? false,
          periodKey: query.periodKey,
          sortBy: 'occurredAt',
          sortOrder: 'DESC',
        } as QueryPendingPerformanceItemsDto,
        currentUser,
      ),
    );
  }

  private async collectAllPerformanceSummaries(
    query: QueryAiNextActionsDto,
    currentUser: CurrentUser,
  ) {
    return this.collectAllPages((page) =>
      this.performanceService.findPerformanceSummaries(
        {
          page,
          pageSize: 100,
          periodKey: query.periodKey,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
          sortBy: 'updatedAt',
          sortOrder: 'DESC',
        } as QueryPerformanceSummariesDto,
        currentUser,
      ),
    );
  }

  private async collectAllStatPendingItems(query: QueryAiNextActionsDto, currentUser: CurrentUser) {
    return this.collectAllPages((page) =>
      this.businessStatsService.findPendingItems(
        {
          page,
          pageSize: 100,
          includeResolved: query.includeDone ?? false,
          periodKey: query.periodKey,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
          sortBy: 'updatedAt',
          sortOrder: 'DESC',
        } as QueryStatPendingItemsDto,
        currentUser,
      ),
    );
  }

  private async collectAllBusinessStatSummaries(
    query: QueryAiNextActionsDto,
    currentUser: CurrentUser,
  ) {
    return this.collectAllPages((page) =>
      this.businessStatsService.findBusinessStatSummaries(
        {
          page,
          pageSize: 100,
          periodKey: query.periodKey,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
          sortBy: 'updatedAt',
          sortOrder: 'DESC',
        } as QueryBusinessStatSummariesDto,
        currentUser,
      ),
    );
  }

  private async collectAllPages<T>(
    fetchPage: (page: number) => Promise<PaginationResult<T>>,
  ): Promise<PaginationResult<T>> {
    let page = 1;
    const list: T[] = [];
    let total = 0;
    let pageSize = 100;

    while (true) {
      const result = await fetchPage(page);
      total = result.total;
      pageSize = result.pageSize;
      list.push(...result.list);
      if (!result.list.length || list.length >= total) {
        break;
      }
      page += 1;
    }

    return {
      list,
      total,
      page: 1,
      pageSize,
      pagination: {
        page: 1,
        pageSize,
        total,
        totalPages: pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1,
      },
    };
  }

  private resolvePeriodMode(periodMode?: AiPeriodMode | null): AiPeriodMode {
    return periodMode === 'week' ? 'week' : 'month';
  }

  private createCalculationContext(query: QueryAiNextActionsDto): AiCalculationContext {
    const anchorNow = new Date();
    const generatedAt = anchorNow.toISOString();
    const periodMode = this.resolvePeriodMode(query.periodMode);
    const requestedTimeBucket = this.resolveRequestedTimeBucket(query);
    const periodLabel = this.resolvePeriodLabel(query, periodMode, requestedTimeBucket);
    const effectiveTimeQuery = requestedTimeBucket
      ? this.buildTimeBucketQuery(requestedTimeBucket, periodMode, query, anchorNow)
      : {
          dateFrom: query.dateFrom ?? null,
          dateTo: query.dateTo ?? null,
          periodKey: query.periodKey ?? null,
        };
    const calculationFingerprint = createHash('sha1')
      .update(
        JSON.stringify({
          role: query.role ?? null,
          dueLevel: query.dueLevel ?? null,
          onlyBlocking: Boolean(query.onlyBlocking),
          includeDone: Boolean(query.includeDone),
          includeDeferred: Boolean(query.includeDeferred),
          backlogOnly: Boolean(query.backlogOnly),
          timeBucket: requestedTimeBucket,
          periodMode,
          effectiveTimeQuery,
        }),
      )
      .digest('hex')
      .slice(0, 16);

    return {
      anchorNow,
      generatedAt,
      periodMode,
      requestedTimeBucket,
      periodLabel,
      calculationFingerprint,
    };
  }

  private resolveRequestedTimeBucket(query: QueryAiNextActionsDto): AiTimeBucket | null {
    if (query.backlogOnly) {
      return 'backlog_history';
    }
    return query.timeBucket ?? null;
  }

  private resolvePeriodLabel(
    query: QueryAiNextActionsDto,
    periodMode: AiPeriodMode,
    requestedTimeBucket: AiTimeBucket | null,
  ) {
    if (requestedTimeBucket) {
      return this.mapTimeBucketLabel(requestedTimeBucket, periodMode);
    }
    if (query.periodKey) {
      return query.periodKey;
    }
    return periodMode === 'week' ? '当前周视角' : '当前月视角';
  }

  private mapTimeBucketLabel(timeBucket: AiTimeBucket, periodMode: AiPeriodMode) {
    const labels: Record<AiTimeBucket, string> = {
      this_week: '本周',
      last_week: '上周',
      this_month: '本月',
      last_month: '上月',
      future: '未来',
      backlog_history: periodMode === 'week' ? '历史待处理' : '历史待处理',
      custom_range: '自定义区间',
    };
    return labels[timeBucket];
  }

  private resolveTimeBucketForRecord(
    record: Record<string, unknown>,
    periodMode: AiPeriodMode,
    timeAnchorType?: string | null,
    anchorNow?: Date,
  ): AiTimeBucket {
    const anchor = this.resolveAnchorCandidate(record, timeAnchorType ?? null);
    if (!anchor) {
      return periodMode === 'week' ? 'this_week' : 'this_month';
    }

    const date = anchor.date;
    const now = anchorNow ?? new Date();
    if (date.getTime() > this.endOfDay(now).getTime()) {
      return 'future';
    }

    if (periodMode === 'week') {
      if (this.isWithinRange(date, this.startOfWeek(now), this.endOfWeek(now))) {
        return 'this_week';
      }
      if (
        this.isWithinRange(
          date,
          this.startOfWeek(this.addDays(now, -7)),
          this.endOfWeek(this.addDays(now, -7)),
        )
      ) {
        return 'last_week';
      }
      return 'backlog_history';
    }

    if (this.isWithinRange(date, this.startOfMonth(now), this.endOfMonth(now))) {
      return 'this_month';
    }
    if (
      this.isWithinRange(
        date,
        this.startOfMonth(this.addMonths(now, -1)),
        this.endOfMonth(this.addMonths(now, -1)),
      )
    ) {
      return 'last_month';
    }
    return 'backlog_history';
  }

  private resolveAnchorCandidate(
    record: Record<string, unknown>,
    timeAnchorType?: string | null,
  ): { type: string; date: Date } | null {
    const candidates: Array<[string, unknown]> = [
      ['payment_time', record.paymentTime],
      ['purchase_time', record.purchaseTime],
      ['occurred_at', record.occurredAt],
      ['sale_date', record.saleDate],
      ['operated_at', record.operatedAt],
      ['updated_at', record.updatedAt],
      ['created_at', record.createdAt],
      ['time_anchor_date', record.timeAnchorDate],
    ];

    if (timeAnchorType === 'summary_anchor') {
      candidates.unshift(['period_key', record.periodKey]);
    }
    if (timeAnchorType === 'occurred_at') {
      candidates.unshift(['occurred_at', record.occurredAt]);
    }

    for (const [type, value] of candidates) {
      const parsed = this.parseFlexibleDate(value);
      if (parsed) {
        return { type, date: parsed };
      }
    }

    return null;
  }

  private parseFlexibleDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      if (/^\d{4}-\d{2}$/.test(trimmed)) {
        const parsed = new Date(`${trimmed}-01T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private isWithinRange(value: Date, start: Date, end: Date) {
    return value.getTime() >= start.getTime() && value.getTime() <= end.getTime();
  }

  private startOfDay(date: Date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  private endOfDay(date: Date) {
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
  }

  private startOfWeek(date: Date) {
    const value = this.startOfDay(date);
    const day = value.getDay() === 0 ? 7 : value.getDay();
    value.setDate(value.getDate() - day + 1);
    return value;
  }

  private endOfWeek(date: Date) {
    const value = this.startOfWeek(date);
    value.setDate(value.getDate() + 6);
    value.setHours(23, 59, 59, 999);
    return value;
  }

  private startOfMonth(date: Date) {
    const value = this.startOfDay(date);
    value.setDate(1);
    return value;
  }

  private endOfMonth(date: Date) {
    const value = this.startOfDay(date);
    value.setMonth(value.getMonth() + 1, 0);
    value.setHours(23, 59, 59, 999);
    return value;
  }

  private addDays(date: Date, days: number) {
    const value = new Date(date);
    value.setDate(value.getDate() + days);
    return value;
  }

  private addMonths(date: Date, months: number) {
    const value = new Date(date);
    value.setMonth(value.getMonth() + months);
    return value;
  }

  private toPeriodKey(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  private async loadLatestActionStates(actionIds: string[]) {
    const uniqueActionIds = Array.from(new Set(actionIds.filter(Boolean)));
    if (!uniqueActionIds.length) {
      return new Map<string, AiActionState>();
    }

    const states = await this.aiActionStateRepository.find({
      where: uniqueActionIds.map((actionId) => ({ actionId })),
      order: {
        markedAt: 'DESC',
        id: 'DESC',
      },
    });

    const latestMap = new Map<string, AiActionState>();
    for (const state of states) {
      if (!latestMap.has(state.actionId)) {
        latestMap.set(state.actionId, state);
      }
    }
    return latestMap;
  }

  private applyActionStateToItem(
    item: AiActionItem,
    state: AiActionState | null,
    anchorNow: Date,
  ): AiActionItem {
    if (!state) {
      return item;
    }

    const shouldReopen =
      state.processingStatus === 'deferred' &&
      Boolean(state.reopenAt && state.reopenAt.getTime() <= anchorNow.getTime());

    return {
      ...item,
      processingStatus: (state.processingStatus as AiActionProcessingStatus) ?? item.processingStatus,
      deferUntil: state.deferUntil?.toISOString() ?? null,
      deferReason: state.deferReason ?? null,
      markedBy: state.markedBy ?? null,
      markedByName: state.markedByName ?? null,
      markedAt: state.markedAt?.toISOString() ?? null,
      reopenAt: state.reopenAt?.toISOString() ?? null,
      statusRemark: state.statusRemark ?? null,
      shouldReopen,
      timeBucket: (state.timeBucket as AiTimeBucket | null) ?? item.timeBucket,
      bucketLabel: state.bucketLabel ?? item.bucketLabel,
      timeAnchorType: state.timeAnchorType ?? item.timeAnchorType,
      timeAnchorDate: state.timeAnchorDate?.toISOString() ?? item.timeAnchorDate,
    };
  }

  private matchesActionTimeBucket(
    item: AiActionItem,
    query: QueryAiNextActionsDto,
    periodMode: AiPeriodMode,
  ) {
    if (query.backlogOnly) {
      return item.timeBucket === 'backlog_history';
    }

    if (query.timeBucket === 'custom_range' && query.dateFrom && query.dateTo) {
      const anchor = this.parseFlexibleDate(item.timeAnchorDate);
      if (!anchor) {
        return false;
      }
      const start = this.parseFlexibleDate(query.dateFrom);
      const end = this.parseFlexibleDate(query.dateTo);
      if (!start || !end) {
        return true;
      }
      return this.isWithinRange(anchor, start, end);
    }

    if (query.timeBucket) {
      return item.timeBucket === query.timeBucket;
    }

    if (!query.periodKey && !query.dateFrom && !query.dateTo) {
      return true;
    }

    const anchor = this.parseFlexibleDate(item.timeAnchorDate);
    if (!anchor) {
      return true;
    }

    if (query.periodKey) {
      return this.toPeriodKey(anchor) === query.periodKey;
    }

    const start = this.parseFlexibleDate(query.dateFrom);
    const end = this.parseFlexibleDate(query.dateTo);
    if (start && end) {
      return this.isWithinRange(anchor, start, end);
    }

    return item.timeBucket === this.resolveRequestedTimeBucket({ ...query, periodMode });
  }

  private parseSerializedObject(value: string | null | undefined): Record<string, unknown> {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private parseAnswerSections(value: unknown): AiAssistantAnswerSection[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const record = item as Record<string, unknown>;
        const sectionKey = this.readObjectString(record, 'sectionKey');
        const title = this.readObjectString(record, 'title');
        const content = this.readObjectString(record, 'content');
        if (!sectionKey || !title || !content) {
          return null;
        }
        return { sectionKey, title, content };
      })
      .filter((item): item is AiAssistantAnswerSection => Boolean(item));
  }

  private parseKnowledgeReferences(value: unknown): AiKnowledgeReference[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const record = item as Record<string, unknown>;
        const idRaw = record.id;
        const id = typeof idRaw === 'number' ? idRaw : Number(idRaw);
        const title = this.readObjectString(record, 'title');
        if (!Number.isFinite(id) || !title) {
          return null;
        }
        return {
          id,
          knowledgeType: this.readObjectString(record, 'knowledgeType') ?? 'knowledge',
          scopeType: this.readObjectString(record, 'scopeType') ?? 'global',
          scopeKey: this.readObjectString(record, 'scopeKey'),
          title,
          summary: this.readObjectString(record, 'summary') ?? '',
          content: this.readObjectString(record, 'content') ?? '',
          tags: this.readObjectArray(record, 'tags').filter(
            (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
          ),
          sourceType: this.readObjectString(record, 'sourceType'),
          aiLearningMode: this.readObjectString(record, 'aiLearningMode'),
        };
      })
      .filter((item): item is AiKnowledgeReference => Boolean(item));
  }

  private parseManualDecisionReferences(value: unknown): AiManualDecisionReference[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const record = item as Record<string, unknown>;
        const idRaw = record.id;
        const summaryIdRaw = record.sourceSummaryId;
        const id = typeof idRaw === 'number' ? idRaw : Number(idRaw);
        const sourceSummaryId =
          typeof summaryIdRaw === 'number' ? summaryIdRaw : Number(summaryIdRaw);
        if (!Number.isFinite(id) || !Number.isFinite(sourceSummaryId)) {
          return null;
        }
        return {
          id,
          sourceSummaryId,
          actionType: this.readObjectString(record, 'actionType') ?? 'manual_decision',
          reasonCode: this.readObjectString(record, 'reasonCode'),
          decisionScope: this.readObjectString(record, 'decisionScope'),
          judgmentBasis: this.readObjectArray(record, 'judgmentBasis').filter(
            (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
          ),
          aiLearningMode: this.readObjectString(record, 'aiLearningMode'),
          finalClassification: this.readObjectString(record, 'finalClassification'),
          finalBindingStatus: this.readObjectString(record, 'finalBindingStatus'),
          operatorName: this.readObjectString(record, 'operatorName'),
          operatedAt: this.readObjectString(record, 'operatedAt') ?? '',
          matchType:
            (this.readObjectString(record, 'matchType') as 'direct' | 'similar_pattern' | null) ??
            'similar_pattern',
          summary: this.readObjectString(record, 'summary') ?? '',
        };
      })
      .filter((item): item is AiManualDecisionReference => Boolean(item));
  }

  private parseMemoryReferences(value: unknown): AiMemoryReference[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        return this.buildMemoryReferenceFromObject(item as Record<string, unknown>);
      })
      .filter((item): item is AiMemoryReference => Boolean(item));
  }

  private buildAssistantFilterSummary(
    query: QueryAiPageContextDto,
    pageQuery: Record<string, unknown>,
  ): AiAssistantFilterSummary {
    const filters = Object.fromEntries(
      Object.entries(pageQuery).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );

    return {
      periodKey:
        query.periodKey ??
        this.readObjectString(pageQuery, 'periodKey') ??
        this.readObjectString(pageQuery, 'period_key') ??
        null,
      dateFrom: query.dateFrom ?? this.readObjectString(pageQuery, 'dateFrom') ?? null,
      dateTo: query.dateTo ?? this.readObjectString(pageQuery, 'dateTo') ?? null,
      filters,
      sourceActionId: query.sourceActionId ?? this.readObjectString(pageQuery, 'sourceActionId') ?? null,
    };
  }

  private buildAssistantThreadKey(input: {
    routePath: string;
    entityType: string | null;
    entityId: string | null;
    role: AiActionOwnerRole;
    sourceActionId: string | null;
  }) {
    const raw = JSON.stringify({
      routePath: input.routePath,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      role: input.role,
      sourceActionId: input.sourceActionId ?? null,
    });

    return `page:${createHash('sha1').update(raw).digest('hex').slice(0, 24)}`;
  }

  private resolveAssistantPageLabel(routePath: string) {
    if (routePath.startsWith('/payment-records/')) return '收款确认命令详情';
    if (routePath.startsWith('/payment-records')) return '收款记录';
    if (routePath.startsWith('/performance/pending')) return '绩效待确认清单';
    if (routePath.startsWith('/performance/summaries/')) return '绩效汇总详情';
    if (routePath.startsWith('/performance/summaries')) return '绩效汇总';
    if (routePath.startsWith('/business-stats/pending')) return '业务统计待确认清单';
    if (routePath.startsWith('/business-stats/summaries/')) return '业务统计汇总详情';
    if (routePath.startsWith('/business-stats/summaries')) return '业务统计汇总';
    if (routePath.startsWith('/points/hub')) return '点值总览 / 操作指引';
    if (routePath.startsWith('/points/welfare')) return '员工月度福利积点';
    if (routePath.startsWith('/points/redemptions/')) return '积点兑换详情';
    if (routePath.startsWith('/points/redemptions')) return '积点兑换请求';
    if (routePath.startsWith('/points/commands/')) return '积点命令详情';
    if (routePath.startsWith('/points/commands')) return '积点命令';
    if (routePath.startsWith('/abc-points/overview')) return 'ABC 积分总览';
    if (routePath.startsWith('/abc-points/commands')) return 'ABC 积分命令';
    if (routePath.startsWith('/abc-points/ledger')) return 'ABC 积分流水 / 对账';
    if (routePath.startsWith('/abc-sync/dashboard')) return 'ABC 经营看板';
    if (routePath.startsWith('/ai/console')) return 'AI 总控台';
    return routePath;
  }

  private resolvePageLabel(routePath: string) {
    if (routePath.startsWith('/payment-records/')) return '收款确认命令详情';
    if (routePath.startsWith('/payment-records')) return '收款记录';
    if (routePath.startsWith('/performance/pending')) return '绩效待确认清单';
    if (routePath.startsWith('/performance/summaries/')) return '绩效汇总详情';
    if (routePath.startsWith('/performance/summaries')) return '绩效汇总';
    if (routePath.startsWith('/business-stats/pending')) return '业务统计待确认清单';
    if (routePath.startsWith('/business-stats/summaries/')) return '业务统计汇总详情';
    if (routePath.startsWith('/business-stats/summaries')) return '业务统计汇总';
    if (routePath.startsWith('/points/hub')) return '点值总览 / 操作指引';
    if (routePath.startsWith('/points/welfare')) return '员工月度福利积点';
    if (routePath.startsWith('/points/commands/')) return '积点命令详情';
    if (routePath.startsWith('/points/commands')) return '积点命令';
    if (routePath.startsWith('/points/redemptions/')) return '积点兑换详情';
    if (routePath.startsWith('/points/redemptions')) return '积点兑换请求';
    if (routePath.startsWith('/abc-points/overview')) return 'ABC 积分总览';
    if (routePath.startsWith('/abc-points/commands')) return 'ABC 积分命令';
    if (routePath.startsWith('/abc-points/ledger')) return 'ABC 积分流水 / 对账';
    if (routePath.startsWith('/abc-sync/dashboard')) return 'ABC 经营看板';
    if (routePath.startsWith('/ai/console')) return 'AI 总控台';
    return routePath;
  }

  private resolveAssistantRewardDomain(
    routePath: string,
    focusObject: AiAssistantFocusObject | null,
  ) {
    const rawContext = (focusObject?.rawContext ?? {}) as Record<string, unknown>;
    const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
    const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
    const rewardDomain =
      this.readObjectString(rawContext, 'rewardDomain') ??
      this.readObjectString(basicInfo, 'rewardDomain') ??
      this.readObjectString(sourceInfo, 'rewardDomain');

    if (rewardDomain) {
      return rewardDomain;
    }
    if (routePath.startsWith('/abc-points/')) {
      return 'abc_score';
    }
    if (routePath.startsWith('/points/')) {
      return 'hq_points';
    }
    return null;
  }

  private resolveAssistantSourceOfTruth(
    routePath: string,
    focusObject: AiAssistantFocusObject | null,
  ) {
    const rawContext = (focusObject?.rawContext ?? {}) as Record<string, unknown>;
    const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
    const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
    const sourceOfTruth =
      this.readObjectString(rawContext, 'sourceOfTruth') ??
      this.readObjectString(basicInfo, 'sourceOfTruth') ??
      this.readObjectString(sourceInfo, 'sourceOfTruth');

    if (sourceOfTruth) {
      return sourceOfTruth;
    }
    if (routePath.startsWith('/abc-points/')) {
      return 'ABC';
    }
    if (routePath.startsWith('/points/')) {
      return 'HQ';
    }
    return null;
  }

  private async resolvePageFocusObject(
    query: QueryAiPageContextDto,
    currentUser: CurrentUser,
  ): Promise<AiAssistantFocusObject | null> {
    const entityType = query.entityType ?? null;
    const entityId = query.entityId ?? null;

    if (!entityType || !entityId) {
      if (query.sourceActionId) {
        return this.buildTaskFocusObject(
          await this.getTaskContext(
            query.sourceActionId,
            {
              role: query.role,
              scene: query.scene,
              periodKey: query.periodKey,
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
            } as QueryAiConsoleOverviewDto,
            currentUser,
          ),
        );
      }
      return null;
    }

    switch (entityType) {
      case 'performance_summary':
        return this.buildPerformanceSummaryFocusObject(
          await this.getSummaryContext(
            Number(entityId),
            { summaryType: 'performance' } as QueryAiSummaryContextDto,
            currentUser,
          ),
        );
      case 'business_stat_summary':
        return this.buildBusinessStatSummaryFocusObject(
          await this.getSummaryContext(
            Number(entityId),
            { summaryType: 'business_stats' } as QueryAiSummaryContextDto,
            currentUser,
          ),
        );
      case 'approval_request_command':
        return this.buildApprovalRequestFocusObject(
          (await this.approvalRequestsService.findOne(
            Number(entityId),
            currentUser,
          )) as Record<string, unknown>,
        );
      case 'payment_record_command':
        return this.buildPaymentRecordFocusObject(
          (await this.paymentRecordsService.findOne(
            Number(entityId),
            currentUser,
          )) as Record<string, unknown>,
        );
      case 'points_command':
        return this.buildPointsCommandFocusObject(
          await this.loadPointsCommandContextBase(Number(entityId), currentUser),
        );
      case 'abc_points_command':
        return this.buildAbcPointsCommandFocusObject(
          await this.loadAbcPointsCommandContextBase(Number(entityId), currentUser),
        );
      case 'points_redemption_request':
        return this.buildPointsRedemptionFocusObject(
          await this.loadPointsRedemptionContextBase(Number(entityId), currentUser),
        );
      case 'points_welfare_batch':
        return this.buildPointsWelfareBatchFocusObject(
          await this.loadPointsWelfareBatchContextBase(Number(entityId), currentUser),
        );
      case 'points_welfare_batch_item':
        return this.buildPointsWelfareBatchItemFocusObject(
          await this.loadPointsWelfareBatchItemContextBase(Number(entityId), currentUser),
        );
      case 'points_welfare_preview':
        return this.buildPointsWelfarePreviewFocusObject(
          await this.loadPointsWelfarePreviewContext(query, currentUser),
        );
      case 'performance_pending_item': {
        const item = await this.performanceEventRepository.findOne({
          where: { id: Number(entityId) },
        });
        if (!item) {
          throw new NotFoundException('AI 页面上下文未找到绩效待确认记录');
        }

        const payload = (item.normalizedPayload ?? {}) as Record<string, unknown>;
        const blockers = new Set<string>();
        const performanceBlockReason =
          this.readObjectString(payload, 'performanceBlockReason') ??
          this.readObjectString(payload, 'primaryReasonCode');
        if (performanceBlockReason) {
          blockers.add(performanceBlockReason);
        }
        const reconciliationStatus = this.readObjectString(payload, 'reconciliationStatus');
        if (reconciliationStatus === 'sheet_missing') {
          blockers.add('sheet_missing');
        }

        return {
          entityType,
          entityId,
          label: `绩效待确认 #${item.id}`,
          subtitle: `${item.sourceTable}#${item.sourceId}`,
          sourceTable: item.sourceTable,
          sourceId: item.sourceId,
          summaryType: 'performance',
          keyFacts: [
            { label: '事件类型', value: item.eventType },
            { label: '发生时间', value: item.occurredAt.toISOString() },
            { label: '金额', value: item.amountStandard ?? '-' },
            {
              label: '客户手机号',
              value: this.readObjectString(payload, 'customerMobile') ?? '无可追溯手机号',
            },
            { label: '阻塞项', value: performanceBlockReason ?? '无' },
          ],
          rawContext: {
            payload,
            blockers: Array.from(blockers),
            performanceBlockReason,
            reconciliationStatus,
            manualDecisionSummary: null,
            suggestedNextStep:
              performanceBlockReason === 'missing_customer_binding'
                ? '先核对手机号和候选客户，再人工确认绑定。'
                : reconciliationStatus === 'sheet_missing'
                  ? '先补齐台账漏记证据，再回到绩效确认。'
                  : '先完成当前待确认动作，再继续后续流程。',
          },
        };
      }
      case 'reward_event': {
        const rewardEvent = await this.rewardEventRepository.findOne({
          where: { id: Number(entityId) },
        });
        if (!rewardEvent) {
          throw new NotFoundException('AI 页面上下文未找到奖励事件');
        }
        const payload = (rewardEvent.normalizedPayload ?? {}) as Record<string, unknown>;
        const payrollBlockReason = this.readObjectString(payload, 'payrollBlockReason');
        return {
          entityType,
          entityId,
          label: `奖励事件 #${rewardEvent.id}`,
          subtitle: `${rewardEvent.sourceTable}#${rewardEvent.sourceId}`,
          sourceTable: rewardEvent.sourceTable,
          sourceId: rewardEvent.sourceId,
          summaryType: 'business_stats',
          keyFacts: [
            { label: '事件类型', value: rewardEvent.eventType },
            { label: '业务域', value: rewardEvent.businessDomain },
            { label: '发生时间', value: rewardEvent.occurredAt.toISOString() },
            { label: '金额', value: rewardEvent.amountStandard ?? '-' },
            { label: '工资阻塞', value: payrollBlockReason ?? '无' },
          ],
          rawContext: {
            payload,
            blockers: payrollBlockReason ? [payrollBlockReason] : [],
            payrollBlockReason,
            manualDecisionSummary: null,
            suggestedNextStep:
              rewardEvent.confirmedFlag
                ? '奖励事件已确认，可继续回看统计汇总与工资试算前置。'
                : '先确认奖励事件，再继续处理后续统计或工资前置。',
          },
        };
      }
      case 'stat_tag': {
        const tag = await this.businessStatTagRepository.findOne({
          where: { id: Number(entityId) },
        });
        if (!tag) {
          throw new NotFoundException('AI 页面上下文未找到统计标签');
        }
        const payload = (tag.normalizedPayload ?? {}) as Record<string, unknown>;
        const performanceBlockReason = this.readObjectString(payload, 'performanceBlockReason');
        return {
          entityType,
          entityId,
          label: `统计标签 #${tag.id}`,
          subtitle: `${tag.sourceTable}#${tag.sourceId}`,
          sourceTable: tag.sourceTable,
          sourceId: tag.sourceId,
          summaryType: 'business_stats',
          keyFacts: [
            { label: '标签编码', value: tag.tagCode },
            { label: '业务域', value: tag.businessDomain },
            { label: '发生时间', value: tag.occurredAt.toISOString() },
            { label: '确认状态', value: tag.confirmedFlag ? '已确认' : '待确认' },
            { label: '阻塞项', value: performanceBlockReason ?? '无' },
          ],
          rawContext: {
            payload,
            blockers: performanceBlockReason ? [performanceBlockReason] : [],
            performanceBlockReason,
            manualDecisionSummary: null,
            suggestedNextStep:
              tag.confirmedFlag
                ? '标签已确认，可继续核对后续奖励和汇总。'
                : '先确认统计标签，再继续经营统计核对。',
          },
        };
      }
      case 'ai_task':
        return this.buildTaskFocusObject(
          await this.getTaskContext(
            entityId,
            {
              role: query.role,
              scene: query.scene,
              periodKey: query.periodKey,
              dateFrom: query.dateFrom,
              dateTo: query.dateTo,
            } as QueryAiConsoleOverviewDto,
            currentUser,
          ),
        );
      default:
        return {
          entityType,
          entityId,
          label: `当前对象 ${entityType}`,
          subtitle: entityId,
          sourceTable: null,
          sourceId: null,
          summaryType: null,
          keyFacts: [],
          rawContext: null,
        };
    }
  }

  private buildPerformanceSummaryFocusObject(
    summaryContext: AiSummaryContextResponse,
  ): AiAssistantFocusObject {
    const summaryId = summaryContext.basicInfo.summaryId;
    const customerMobile = this.readObjectString(summaryContext.customerIdentity, 'customerMobile');
    const customerName = this.readObjectString(summaryContext.customerIdentity, 'customerName');
    const packageName = this.readObjectString(summaryContext.productAndBundle, 'packageName');
    const projectName = this.readObjectString(summaryContext.productAndBundle, 'projectName');
    const performanceBlockReason = this.readObjectString(
      summaryContext.paymentAndReconciliation,
      'performanceBlockReason',
    );

    return {
      entityType: 'performance_summary',
      entityId: summaryId ? String(summaryId) : null,
      label: `绩效汇总 #${summaryId ?? '-'}`,
      subtitle: `${this.readObjectString(summaryContext.basicInfo, 'periodKey') ?? '-'} / ${
        this.readObjectString(summaryContext.basicInfo, 'employeeName') ?? '未绑定员工'
      }`,
      sourceTable: null,
      sourceId: null,
      summaryType: 'performance',
      keyFacts: [
        { label: '客户', value: customerName ?? '无可追溯客户' },
        { label: '手机号', value: customerMobile ?? '无可追溯手机号' },
        { label: '套餐/项目', value: packageName ?? projectName ?? '无' },
        { label: '支付状态', value: this.readObjectString(summaryContext.paymentAndReconciliation, 'paymentStatus') ?? '未知' },
        { label: '阻塞项', value: performanceBlockReason ?? '无' },
      ],
      rawContext: {
        basicInfo: summaryContext.basicInfo,
        customerIdentity: summaryContext.customerIdentity,
        paymentAndReconciliation: summaryContext.paymentAndReconciliation,
        productAndBundle: summaryContext.productAndBundle,
        pointsSummary: summaryContext.pointsSummary,
        manualDecisionSummary: summaryContext.manualDecision,
        blockers: summaryContext.blockers,
        suggestedNextStep: summaryContext.suggestedNextStep,
        relatedRecordsPreview: summaryContext.relatedRecordsPreview,
      },
    };
  }

  private buildBusinessStatSummaryFocusObject(
    summaryContext: AiSummaryContextResponse,
  ): AiAssistantFocusObject {
    const summaryId = summaryContext.basicInfo.summaryId;
    const customerMobile = this.readObjectString(summaryContext.customerIdentity, 'customerMobile');
    const customerName = this.readObjectString(summaryContext.customerIdentity, 'customerName');
    const packageName = this.readObjectString(summaryContext.productAndBundle, 'packageName');
    const projectName = this.readObjectString(summaryContext.productAndBundle, 'projectName');
    const payrollBlockReason = this.readObjectString(
      summaryContext.paymentAndReconciliation,
      'payrollBlockReason',
    );

    return {
      entityType: 'business_stat_summary',
      entityId: summaryId ? String(summaryId) : null,
      label: `业务统计汇总 #${summaryId ?? '-'}`,
      subtitle: `${this.readObjectString(summaryContext.basicInfo, 'periodKey') ?? '-'} / ${
        this.readObjectString(summaryContext.basicInfo, 'employeeName') ?? '未绑定员工'
      }`,
      sourceTable: null,
      sourceId: null,
      summaryType: 'business_stats',
      keyFacts: [
        { label: '客户', value: customerName ?? '无可追溯客户' },
        { label: '手机号', value: customerMobile ?? '无可追溯手机号' },
        { label: '业务分类', value: this.readObjectString(summaryContext.productAndBundle, 'businessCategory') ?? '未分类' },
        { label: '套餐/项目', value: packageName ?? projectName ?? '无' },
        { label: '工资阻塞', value: payrollBlockReason ?? '无' },
      ],
      rawContext: {
        basicInfo: summaryContext.basicInfo,
        customerIdentity: summaryContext.customerIdentity,
        paymentAndReconciliation: summaryContext.paymentAndReconciliation,
        productAndBundle: summaryContext.productAndBundle,
        pointsSummary: summaryContext.pointsSummary,
        manualDecisionSummary: summaryContext.manualDecision,
        blockers: summaryContext.blockers,
        suggestedNextStep: summaryContext.suggestedNextStep,
        relatedRecordsPreview: summaryContext.relatedRecordsPreview,
      },
    };
  }

  private buildApprovalRequestFocusObject(detail: Record<string, unknown>): AiAssistantFocusObject {
    const approval = this.readObjectObject(detail, 'approval');
    const handlingPlan = this.readObjectObject(detail, 'handlingPlan');
    const approvalPrecheck = this.readObjectObject(detail, 'approvalPrecheck');
    const linkedBusinessContext = this.readObjectObject(detail, 'linkedBusinessContext');
    const linkedPayout = this.readObjectObject(detail, 'linkedPayout');
    const requester = this.readObjectObject(detail, 'requester');
    const approver = this.readObjectObject(detail, 'approver');
    const executionTrace = this.readObjectObject(detail, 'executionTrace');
    const auditTrail = this.readObjectArray(detail, 'auditTrail').filter(
      (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
    );
    const approvalId = this.readObjectNumber(approval, 'id') ?? this.readObjectNumber(detail, 'id') ?? 0;
    const approvalNo =
      this.readObjectString(approval, 'approvalNo') ??
      this.readObjectString(detail, 'approvalNo') ??
      `#${approvalId}`;
    const status =
      this.readObjectString(approval, 'status') ??
      this.readObjectString(detail, 'status') ??
      'unknown';
    const approvalType =
      this.readObjectString(approval, 'approvalType') ??
      this.readObjectString(detail, 'approvalType') ??
      'approval';
    const requestAmount =
      this.readObjectString(approval, 'requestAmount') ??
      this.readObjectString(detail, 'requestAmount') ??
      this.readObjectString(detail, 'amount') ??
      '-';
    const requesterName = this.readObjectString(requester, 'name') ?? '-';
    const workOrderNo = this.readObjectString(linkedBusinessContext, 'workOrderNo') ?? '-';
    const suggestedNextStep =
      this.readObjectString(detail, 'suggestedNextStep') ??
      this.readObjectString(this.readObjectObject(handlingPlan, 'diagnosis'), 'suggestedNextStep') ??
      '-';
    const canExecute = this.readObjectBoolean(detail, 'canExecute');

    return {
      entityType: 'approval_request_command',
      entityId: String(approvalId),
      label: `审批命令 ${approvalNo}`,
      subtitle: `${status} / ${approvalType}`,
      sourceTable: 'approval_requests',
      sourceId: String(approvalId),
      summaryType: null,
      keyFacts: [
        { label: '状态', value: status },
        { label: '申请金额', value: requestAmount },
        { label: '申请人', value: requesterName },
        { label: '关联工单', value: workOrderNo },
        { label: '下一步', value: suggestedNextStep },
        { label: '可执行', value: canExecute ? '是' : '否' },
      ],
      rawContext: {
        approvalInfo: {
          approvalNo,
          approvalType,
          status,
          requestAmount,
          reason:
            this.readObjectString(approval, 'reason') ??
            this.readObjectString(detail, 'reason') ??
            null,
          requesterName,
          approverName: this.readObjectString(approver, 'name'),
          approvedAt: this.readObjectString(approval, 'approvedAt'),
          rejectedAt: this.readObjectString(approval, 'rejectedAt'),
          verificationCode: this.readObjectString(approval, 'verificationCode'),
        },
        linkedBusinessContext,
        linkedPayout,
        handlingPlan,
        approvalPrecheck,
        executionTrace,
        auditTrail,
        commandExplanation: this.readObjectString(detail, 'commandExplanation'),
        blockedReason: this.readObjectString(detail, 'blockedReason'),
        blockedStage: this.readObjectString(detail, 'blockedStage'),
        blockers: this.readObjectArray(detail, 'blockers').filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0,
        ),
        suggestedNextStep: this.readObjectString(detail, 'suggestedNextStep'),
      },
    };
  }

  private buildPaymentRecordFocusObject(detail: Record<string, unknown>): AiAssistantFocusObject {
    const payment = this.readObjectObject(detail, 'payment');
    const handlingPlan = this.readObjectObject(detail, 'handlingPlan');
    const paymentPrecheck = this.readObjectObject(detail, 'paymentPrecheck');
    const linkedWorkOrder =
      this.readObjectObject(detail, 'linkedWorkOrder') ??
      this.readObjectObject(detail, 'linkedWorkOrderSummary');
    const amountImpact = this.readObjectObject(detail, 'amountImpact');
    const executionTrace = this.readObjectObject(detail, 'executionTrace');
    const auditTrail = this.readObjectArray(detail, 'auditTrail').filter(
      (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
    );
    const paymentId =
      this.readObjectNumber(payment, 'id') ?? this.readObjectNumber(detail, 'id') ?? 0;
    const paymentNo =
      this.readObjectString(payment, 'paymentNo') ??
      this.readObjectString(detail, 'paymentNo') ??
      `#${paymentId}`;
    const paymentStatus =
      this.readObjectString(payment, 'paymentStatus') ??
      this.readObjectString(detail, 'paymentStatus') ??
      'unknown';
    const channel =
      this.readObjectString(payment, 'channel') ??
      this.readObjectString(detail, 'channel') ??
      this.readObjectString(detail, 'paymentMethod') ??
      '-';
    const amount =
      this.readObjectString(payment, 'amount') ??
      this.readObjectString(detail, 'amount') ??
      '-';
    const workOrderNo = this.readObjectString(linkedWorkOrder, 'workOrderNo') ?? '-';
    const suggestedNextStep =
      this.readObjectString(detail, 'suggestedNextStep') ??
      this.readObjectString(this.readObjectObject(handlingPlan, 'diagnosis'), 'suggestedNextStep') ??
      '-';
    const canExecute = this.readObjectBoolean(detail, 'canExecute');

    return {
      entityType: 'payment_record_command',
      entityId: String(paymentId),
      label: `收款确认命令 ${paymentNo}`,
      subtitle: `${paymentStatus} / ${channel}`,
      sourceTable: 'payment_records',
      sourceId: String(paymentId),
      summaryType: null,
      keyFacts: [
        { label: '状态', value: paymentStatus },
        { label: '金额', value: amount },
        { label: '收款渠道', value: channel },
        { label: '关联工单', value: workOrderNo },
        { label: '下一步', value: suggestedNextStep },
        { label: '可继续处理', value: canExecute ? '是' : '否' },
      ],
      rawContext: {
        paymentInfo: {
          paymentNo,
          paymentStatus,
          channel,
          requestSource:
            this.readObjectString(payment, 'requestSource') ??
            this.readObjectString(detail, 'requestSource'),
          amount,
          paidAt:
            this.readObjectString(payment, 'paidAt') ??
            this.readObjectString(detail, 'paidAt'),
          createdAt:
            this.readObjectString(payment, 'createdAt') ??
            this.readObjectString(detail, 'createdAt'),
          payerName:
            this.readObjectString(payment, 'payerName') ??
            this.readObjectString(detail, 'payerName'),
          remark:
            this.readObjectString(payment, 'remark') ??
            this.readObjectString(detail, 'remark'),
        },
        linkedWorkOrder,
        amountImpact,
        handlingPlan,
        paymentPrecheck,
        executionTrace,
        auditTrail,
        commandExplanation: this.readObjectString(detail, 'commandExplanation'),
        blockedReason: this.readObjectString(detail, 'blockedReason'),
        blockedStage: this.readObjectString(detail, 'blockedStage'),
        blockers: this.readObjectArray(detail, 'blockers').filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0,
        ),
        suggestedNextStep: this.readObjectString(detail, 'suggestedNextStep'),
        sourceOfTruth: this.readObjectString(detail, 'sourceOfTruth'),
        executionCapability: this.readObjectString(detail, 'executionCapability'),
      },
    };
  }

  private buildTaskFocusObject(taskContext: AiTaskContextResponse): AiAssistantFocusObject {
    return {
      entityType: 'ai_task',
      entityId: taskContext.actionId,
      label: taskContext.actionTitle,
      subtitle: `${taskContext.ownerRoleLabel} / ${taskContext.bucketLabel}`,
      sourceTable: null,
      sourceId: taskContext.actionId,
      summaryType: null,
      keyFacts: [
        { label: '任务类型', value: taskContext.taskType },
        { label: '影响类型', value: taskContext.impactType },
        { label: '数量', value: String(taskContext.relatedCount) },
        { label: '金额', value: taskContext.relatedAmount ?? '按权限隐藏' },
        { label: '阻塞项', value: taskContext.blockers.join('、') || '无' },
      ],
      rawContext: {
        blockers: taskContext.blockers,
        manualDecisionSummary: null,
        suggestedNextStep: taskContext.nextStepAfterDone,
        relatedPagePath: taskContext.relatedPagePath,
        relatedPageQuery: taskContext.relatedPageQuery,
      },
    };
  }

  private buildPointsCommandFocusObject(baseContext: {
    command: PointsCommandRequest;
    ownerInfo: Record<string, unknown>;
    sourceInfo: Record<string, unknown>;
    statusInfo: Record<string, unknown>;
    approvalInfo: Record<string, unknown>;
    ledgerImpact: Record<string, unknown>;
    commandOrigin: Record<string, unknown>;
    blockers: string[];
    nextStepAfterDone: string;
    pointsSummary: Record<string, unknown> | null;
    manualDecisionSummary: Record<string, unknown> | null;
    linkedSummaryContext: AiSummaryContextResponse | null;
    rawContext: Record<string, unknown>;
    interactionHistory?: AiAssistantInteractionRecord[];
    relatedLedgerEntries?: Array<Record<string, unknown>>;
    executionTrace?: Record<string, unknown> | null;
    sourceActionId?: string | null;
    threadKey?: string | null;
  }): AiAssistantFocusObject {
    const commandId = baseContext.command.id;
    return {
      entityType: 'points_command',
      entityId: String(commandId),
      label: `积点命令 #${commandId}`,
      subtitle: `${baseContext.command.commandType} / ${baseContext.command.commandStatus}`,
      sourceTable: 'points_command_requests',
      sourceId: String(commandId),
      summaryType: null,
      keyFacts: [
        { label: '状态', value: baseContext.command.commandStatus },
        { label: '命令类型', value: baseContext.command.commandType },
        { label: '对象手机', value: this.readObjectString(baseContext.ownerInfo, 'ownerMobile') ?? '-' },
        { label: '积点变动', value: String(baseContext.command.changeAmount) },
        { label: '下一步', value: baseContext.nextStepAfterDone },
      ],
      rawContext: baseContext.rawContext,
    };
  }

  private buildAbcPointsCommandFocusObject(baseContext: {
    command: Record<string, unknown>;
    ownerInfo: Record<string, unknown>;
    sourceInfo: Record<string, unknown>;
    statusInfo: Record<string, unknown>;
    approvalInfo: Record<string, unknown>;
    ledgerImpact: Record<string, unknown>;
    commandOrigin: Record<string, unknown>;
    blockers: string[];
    nextStepAfterDone: string;
    pointsSummary: Record<string, unknown> | null;
    manualDecisionSummary: Record<string, unknown> | null;
    rawContext: Record<string, unknown>;
    interactionHistory?: AiAssistantInteractionRecord[];
    executionTrace?: Record<string, unknown> | null;
    sourceActionId?: string | null;
    threadKey?: string | null;
  }): AiAssistantFocusObject {
    const commandId = this.readObjectNumber(baseContext.command, 'id') ?? 0;
    return {
      entityType: 'abc_points_command',
      entityId: String(commandId),
      label: `ABC 积分命令 #${commandId}`,
      subtitle: `${this.readObjectString(baseContext.statusInfo, 'commandStatus') ?? '-'} / ${
        this.readObjectString(baseContext.sourceInfo, 'sourceType') ?? '-'
      }`,
      sourceTable: 'abc_points_command_requests',
      sourceId: String(commandId),
      summaryType: null,
      keyFacts: [
        {
          label: '状态',
          value: this.readObjectString(baseContext.statusInfo, 'commandStatus') ?? '-',
        },
        {
          label: '命令类型',
          value: this.readObjectString(this.readObjectObject(baseContext.rawContext, 'basicInfo'), 'commandType') ?? '-',
        },
        {
          label: '对象手机',
          value: this.readObjectString(baseContext.ownerInfo, 'ownerMobile') ?? '-',
        },
        {
          label: '积分变动',
          value: this.readObjectString(this.readObjectObject(baseContext.rawContext, 'basicInfo'), 'changeAmount') ?? '-',
        },
        { label: '下一步', value: baseContext.nextStepAfterDone },
      ],
      rawContext: baseContext.rawContext,
    };
  }

  private buildPointsRedemptionFocusObject(baseContext: {
    request: Record<string, unknown>;
    basicInfo: Record<string, unknown>;
    ownerInfo: Record<string, unknown>;
    sourceInfo: Record<string, unknown>;
    statusInfo: Record<string, unknown>;
    approvalInfo: Record<string, unknown>;
    ledgerImpact: Record<string, unknown>;
    commandOrigin: Record<string, unknown>;
    blockers: string[];
    nextStepAfterDone: string;
    pointsSummary: Record<string, unknown> | null;
    manualDecisionSummary: Record<string, unknown> | null;
    rawContext: Record<string, unknown>;
    interactionHistory?: AiAssistantInteractionRecord[];
    relatedLedgerEntries?: Array<Record<string, unknown>>;
    executionTrace?: Record<string, unknown> | null;
    sourceActionId?: string | null;
    threadKey?: string | null;
  }): AiAssistantFocusObject {
    const requestId = this.readObjectNumber(baseContext.request, 'id') ?? 0;
    const requestStatus = this.readObjectString(baseContext.request, 'requestStatus') ?? '-';
    const redeemableName = this.readObjectString(baseContext.request, 'redeemableName') ?? '-';
    const pointsCost = this.readObjectString(baseContext.request, 'pointsCost') ?? '-';
    const targetValue = this.readObjectString(baseContext.request, 'targetValue') ?? '-';
    return {
      entityType: 'points_redemption_request',
      entityId: String(requestId),
      label: `积点兑换请求 #${requestId}`,
      subtitle: `${redeemableName} / ${requestStatus}`,
      sourceTable: 'points_redemption_requests',
      sourceId: String(requestId),
      summaryType: null,
      keyFacts: [
        { label: '状态', value: requestStatus },
        { label: '兑换对象', value: redeemableName },
        {
          label: '对象手机号',
          value: this.readObjectString(baseContext.ownerInfo, 'ownerMobile') ?? '-',
        },
        { label: '积点成本', value: pointsCost },
        { label: '目标价值', value: targetValue },
        { label: '下一步', value: baseContext.nextStepAfterDone },
      ],
      rawContext: baseContext.rawContext,
    };
  }

  private buildPointsWelfarePreviewFocusObject(previewContext: {
    periodKey: string;
    targetEmployeeCount: number;
    targetTotalAmount: string;
    eligibleEmployeesPreview: Array<Record<string, unknown>>;
    excludedEmployeesPreview: Array<Record<string, unknown>>;
    previewRules: string[];
    warnings: string[];
    latestBatch: Record<string, unknown> | null;
    blockers: string[];
    suggestedNextStep: string;
    pointsSummary: Record<string, unknown>;
  }): AiAssistantFocusObject {
    const latestBatchId = this.readObjectNumber(previewContext.latestBatch, 'id');
    return {
      entityType: 'points_welfare_preview',
      entityId: previewContext.periodKey,
      label: `员工福利预览 ${previewContext.periodKey}`,
      subtitle: `${previewContext.targetEmployeeCount} 人 / ${previewContext.targetTotalAmount} 积点`,
      sourceTable: 'employees',
      sourceId: previewContext.periodKey,
      summaryType: null,
      keyFacts: [
        { label: '周期', value: previewContext.periodKey },
        { label: '可纳入人数', value: String(previewContext.targetEmployeeCount) },
        { label: '建议总积点', value: previewContext.targetTotalAmount },
        {
          label: '已排除人数',
          value: String(previewContext.excludedEmployeesPreview.length),
        },
        {
          label: '现有福利积点母单',
          value: latestBatchId ? `#${latestBatchId}` : '当前周期尚无有效母单',
        },
      ],
      rawContext: {
        basicInfo: {
          periodKey: previewContext.periodKey,
          batchType: 'employee_monthly_welfare',
          targetEmployeeCount: previewContext.targetEmployeeCount,
          targetTotalAmount: previewContext.targetTotalAmount,
        },
        sourceInfo: {
          sourceType: 'employee_monthly_welfare',
          requestSource: 'batch_draft',
          targetRoutePath: '/points/welfare',
        },
        statusInfo: {
          batchStatus: this.readObjectString(previewContext.latestBatch, 'batchStatus') ?? null,
          latestBatchId,
        },
        previewSummary: {
          periodKey: previewContext.periodKey,
          eligibleEmployeesPreview: previewContext.eligibleEmployeesPreview,
          excludedEmployeesPreview: previewContext.excludedEmployeesPreview,
          previewRules: previewContext.previewRules,
          warnings: previewContext.warnings,
        },
        latestBatch: previewContext.latestBatch,
        pointsSummary: previewContext.pointsSummary,
        blockers: previewContext.blockers,
        suggestedNextStep: previewContext.suggestedNextStep,
        relatedRecordsPreview: previewContext.eligibleEmployeesPreview.slice(0, 8),
      },
    };
  }

  private buildPointsWelfareBatchFocusObject(baseContext: {
    batch: PointsCommandBatch;
    basicInfo: Record<string, unknown>;
    sourceInfo: Record<string, unknown>;
    statusInfo: Record<string, unknown>;
    approvalInfo: Record<string, unknown>;
    ledgerImpact: Record<string, unknown>;
    commandOrigin: Record<string, unknown>;
    previewSummary: Record<string, unknown>;
    childCommandSummary: Record<string, unknown>;
    blockers: string[];
    nextStepAfterDone: string;
    pointsSummary: Record<string, unknown>;
    rawContext: Record<string, unknown>;
  }): AiAssistantFocusObject {
    return {
      entityType: 'points_welfare_batch',
      entityId: String(baseContext.batch.id),
      label: `福利积点母单 #${baseContext.batch.id}`,
      subtitle: `${baseContext.batch.periodKey} / ${baseContext.batch.batchStatus}`,
      sourceTable: 'points_command_batches',
      sourceId: String(baseContext.batch.id),
      summaryType: null,
      keyFacts: [
        { label: '周期', value: baseContext.batch.periodKey },
        { label: '状态', value: baseContext.batch.batchStatus },
        { label: '目标人数', value: String(baseContext.batch.targetEmployeeCount) },
        { label: '目标总积点', value: baseContext.batch.targetTotalAmount },
        { label: '下一步', value: baseContext.nextStepAfterDone },
      ],
      rawContext: baseContext.rawContext,
    };
  }

  private buildPointsWelfareBatchItemFocusObject(baseContext: {
    item: PointsWelfareBatchItem;
    batch: PointsCommandBatch;
    childCommand: PointsCommandRequest | null;
    statusInfo: Record<string, unknown>;
    pointsSummary: Record<string, unknown>;
    rawContext: Record<string, unknown>;
    nextStepAfterDone: string;
  }): AiAssistantFocusObject {
    return {
      entityType: 'points_welfare_batch_item',
      entityId: String(baseContext.item.id),
      label: `福利批次子项 #${baseContext.item.id}`,
      subtitle: `${baseContext.item.employeeNameSnapshot} / ${baseContext.item.allocationMode}`,
      sourceTable: 'points_welfare_batch_items',
      sourceId: String(baseContext.item.id),
      summaryType: null,
      keyFacts: [
        { label: '员工', value: baseContext.item.employeeNameSnapshot },
        { label: '手机号', value: baseContext.item.employeeMobileSnapshot ?? '-' },
        { label: '分配区', value: baseContext.item.allocationMode },
        { label: '默认积点', value: baseContext.item.defaultAmount },
        { label: '最终积点', value: baseContext.item.finalAmount },
        {
          label: '子命令状态',
          value:
            (baseContext.statusInfo.childCommandStatus as string | null) ??
            (baseContext.childCommand ? baseContext.childCommand.commandStatus : '未生成'),
        },
        { label: '下一步', value: baseContext.nextStepAfterDone },
      ],
      rawContext: baseContext.rawContext,
    };
  }

  private async loadActionStateSummary(actionId: string) {
    const latestState = await this.aiActionStateRepository.findOne({
      where: { actionId },
      order: {
        markedAt: 'DESC',
        id: 'DESC',
      },
    });

    if (!latestState) {
      return null;
    }

    return {
      actionId: latestState.actionId,
      processingStatus: latestState.processingStatus,
      deferUntil: latestState.deferUntil?.toISOString() ?? null,
      deferReason: latestState.deferReason ?? null,
      markedBy: latestState.markedBy ?? null,
      markedByName: latestState.markedByName ?? null,
      markedAt: latestState.markedAt.toISOString(),
      reopenAt: latestState.reopenAt?.toISOString() ?? null,
      statusRemark: latestState.statusRemark ?? null,
      timeBucket: latestState.timeBucket ?? null,
      bucketLabel: latestState.bucketLabel ?? null,
      timeAnchorType: latestState.timeAnchorType ?? null,
      timeAnchorDate: latestState.timeAnchorDate?.toISOString() ?? null,
    };
  }

  private async loadAssistantInteractionHistory(threadKey: string) {
    const history = await this.aiAssistantInteractionRepository.find({
      where: { threadKey },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      take: 12,
    });

    return history.map((item) => this.mapAssistantInteractionRecord(item));
  }

  private mapAssistantInteractionRecord(
    item: AiAssistantInteraction,
  ): AiAssistantInteractionRecord {
    const payload = (item.normalizedPayload ?? {}) as Record<string, unknown>;
    const handlingPlan =
      this.readObjectObject(payload, 'handlingPlan') ??
      this.readObjectObject(this.readObjectObject(payload, 'pageContext'), 'handlingPlan') ??
      null;
    const handlingPlanAiView = this.resolveHandlingPlanAiDiagnosisView(handlingPlan);
    return {
      id: item.id,
      threadKey: item.threadKey,
      routePath: item.routePath,
      entityType: item.entityType ?? null,
      entityId: item.entityId ?? null,
      roleCode: item.roleCode ?? null,
      sourceActionId: item.sourceActionId ?? null,
      userMessage: item.userMessage,
      assistantReply: handlingPlanAiView.assistantReply ?? item.assistantReply,
      suggestedActions: Array.isArray(item.suggestedActions)
        ? (item.suggestedActions as Array<Record<string, unknown>>)
        : [],
      suggestedCommandDraft:
        item.suggestedCommandDraft && typeof item.suggestedCommandDraft === 'object'
          ? (item.suggestedCommandDraft as Record<string, unknown>)
          : null,
      providerKey: item.providerKey ?? null,
      createdBy: item.createdBy ?? null,
      createdByName: item.createdByName ?? null,
      createdAt: item.createdAt.toISOString(),
      questionType:
        (this.readObjectString(payload, 'questionType') as AiAssistantQuestionType | null) ?? null,
      answerSections:
        handlingPlanAiView.answerSections ?? this.parseAnswerSections(payload.answerSections),
      citedKnowledge: this.parseKnowledgeReferences(payload.citedKnowledge),
      citedManualDecisions: this.parseManualDecisionReferences(payload.citedManualDecisions),
      citedMemories: this.parseMemoryReferences(payload.citedMemories),
      memoryInfluenceSummary: this.readObjectString(payload, 'memoryInfluenceSummary') ?? '',
      founderPrinciplesApplied: this.readObjectArray(payload, 'founderPrinciplesApplied').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
      rolePlaybookApplied: this.readObjectArray(payload, 'rolePlaybookApplied').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
      generalizationBoundary: this.readObjectString(payload, 'generalizationBoundary') ?? '',
      confidenceLevel:
        (this.readObjectString(payload, 'confidenceLevel') as AiAssistantConfidenceLevel | null) ??
        null,
      missingContext: this.readObjectArray(payload, 'missingContext').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
      handlingPlan,
    };
  }

  private mergeHandlingPlanWithAiDiagnosis(
    handlingPlan: Record<string, unknown> | null | undefined,
    aiDiagnosis?: {
      assistantReply: string | null;
      answerSections: AiAssistantAnswerSection[];
      confidenceLevel: AiAssistantConfidenceLevel | null;
    } | null,
  ) {
    if (!handlingPlan) {
      return null;
    }

    if (!aiDiagnosis) {
      return { ...handlingPlan };
    }

    const visibilityScope = this.readObjectString(handlingPlan, 'visibilityScope');
    const compactAiDiagnosis = this.buildAbcPointsHandlingPlanAiDiagnosisSummary(handlingPlan);
    return {
      ...handlingPlan,
      aiDiagnosis: {
        assistantReply:
          visibilityScope === 'full'
            ? aiDiagnosis.assistantReply
            : compactAiDiagnosis.assistantReply,
        answerSections:
          visibilityScope === 'full'
            ? aiDiagnosis.answerSections.map((item) => ({
                sectionKey: item.sectionKey,
                title: item.title,
                content: item.content,
              }))
            : compactAiDiagnosis.answerSections,
        confidenceLevel: aiDiagnosis.confidenceLevel,
      },
    };
  }

  private resolveHandlingPlanAiDiagnosisView(
    handlingPlan: Record<string, unknown> | null | undefined,
  ) {
    const aiDiagnosis = this.readObjectObject(handlingPlan, 'aiDiagnosis');
    const assistantReply = this.readObjectString(aiDiagnosis, 'assistantReply');
    const answerSections = this.parseAnswerSections(
      this.readObjectArray(aiDiagnosis, 'answerSections'),
    );
    return {
      assistantReply,
      answerSections: answerSections.length ? answerSections : null,
    };
  }

  private resolveHandlingPlanGeneralizationBoundary(
    handlingPlan: Record<string, unknown> | null | undefined,
  ) {
    return this.readObjectString(
      this.readObjectObject(handlingPlan, 'boundary'),
      'generalizationBoundary',
    );
  }

  private buildAbcPointsHandlingPlanAiDiagnosisSummary(
    handlingPlan: Record<string, unknown>,
  ) {
    const summary = this.readObjectString(handlingPlan, 'summary') ?? '当前处理单摘要暂未提供。';
    const listSummary =
      this.readObjectString(handlingPlan, 'listSummary') ?? '请继续按 handlingPlan 收口版处理。';
    const diagnosis = this.readObjectObject(handlingPlan, 'diagnosis');
    const boundary = this.readObjectObject(handlingPlan, 'boundary');
    const actionItems = this.readObjectArray(handlingPlan, 'actionItems').filter(
      (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
    );
    const primaryActionItem =
      actionItems.find((item) =>
        ['blocked', 'pending', 'ready'].includes(this.readObjectString(item, 'status') ?? ''),
      ) ?? actionItems[0] ?? null;
    const ownerActionSummary = primaryActionItem
      ? `${this.readObjectString(primaryActionItem, 'title') ?? '当前动作'}：${
          this.readObjectString(primaryActionItem, 'description') ?? listSummary
        }`
      : listSummary;
    const suggestedNextStep =
      this.readObjectString(diagnosis, 'suggestedNextStep') ?? '当前仍需人工继续核对。';
    const boundaryText = [
      this.readObjectString(boundary, 'executionBoundary'),
      this.readObjectString(boundary, 'humanConfirmationBoundary'),
      this.readObjectString(boundary, 'payrollBoundary'),
      this.readObjectString(boundary, 'generalizationBoundary'),
    ]
      .filter((item): item is string => Boolean(item && item.trim()))
      .join('；');

    return {
      assistantReply: [
        `当前状态摘要：${summary}`,
        `谁处理 / 怎么处理：${ownerActionSummary}`,
        `何时可重试：${suggestedNextStep}`,
        boundaryText ? `边界说明：${boundaryText}` : null,
      ]
        .filter((item): item is string => Boolean(item))
        .join('\n'),
      answerSections: [
        {
          sectionKey: 'current_status',
          title: '当前状态摘要',
          content: summary,
        },
        {
          sectionKey: 'owner_action',
          title: '谁处理 / 怎么处理',
          content: ownerActionSummary,
        },
        {
          sectionKey: 'retry_window',
          title: '何时可重试',
          content: suggestedNextStep,
        },
        {
          sectionKey: 'boundary',
          title: '边界说明',
          content: boundaryText || '当前边界说明暂未提供。',
        },
      ],
    };
  }

  private buildPageEvidenceSummary(
    focusObject: AiAssistantFocusObject | null,
    taskStateSummary: Record<string, unknown> | null,
    filterSummary: AiAssistantFilterSummary,
    pointsSummary: Record<string, unknown> | null,
  ) {
    const summary: string[] = [];

    if (focusObject) {
      const rawContext = (focusObject.rawContext ?? {}) as Record<string, unknown>;
      const customerIdentity = this.readObjectObject(rawContext, 'customerIdentity');
      const payment = this.readObjectObject(rawContext, 'paymentAndReconciliation');
      const bundle = this.readObjectObject(rawContext, 'productAndBundle');
      const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
      const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const ledgerImpact = this.readObjectObject(rawContext, 'ledgerImpact');

      const customerMobile = this.readObjectString(customerIdentity, 'customerMobile');
      if (customerMobile) {
        summary.push(`已识别客户手机号：${customerMobile}`);
      }

      const paymentStatus = this.readObjectString(payment, 'paymentStatus');
      if (paymentStatus) {
        summary.push(`支付状态：${paymentStatus}`);
      }

      const reconciliationStatus = this.readObjectString(payment, 'reconciliationStatus');
      if (reconciliationStatus) {
        summary.push(`对账状态：${reconciliationStatus}`);
      }

      const linkedPaidAAmount = this.readObjectString(bundle, 'linkedPaidAAmount');
      if (linkedPaidAAmount) {
        summary.push(`A端已支付金额证据：${linkedPaidAAmount}`);
      }

      const linkedBCardAmount = this.readObjectString(bundle, 'linkedBCardAmount');
      if (linkedBCardAmount) {
        summary.push(`B卡候选金额：${linkedBCardAmount}`);
      }
    }

    if (focusObject?.entityType === 'points_command') {
      const rawContext = (focusObject.rawContext ?? {}) as Record<string, unknown>;
      const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
      const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const ledgerImpact = this.readObjectObject(rawContext, 'ledgerImpact');
      const ownerType = this.readObjectString(ownerInfo, 'ownerType');
      const ownerMobile = this.readObjectString(ownerInfo, 'ownerMobile');
      const commandStatus = this.readObjectString(statusInfo, 'commandStatus');
      const sourceType = this.readObjectString(sourceInfo, 'sourceType');
      const requestSource = this.readObjectString(sourceInfo, 'requestSource');
      const relatedLedgerCount = this.readObjectNumber(ledgerImpact, 'relatedLedgerCount');
      const latestBalanceAfter = this.readObjectString(ledgerImpact, 'latestBalanceAfter');
      const affectPerformanceFlag = this.readObjectBoolean(rawContext, 'affectPerformanceFlag');
      const affectBCardFlag = this.readObjectBoolean(rawContext, 'affectBCardFlag');

      if (ownerType) {
        summary.push(`积点命令对象类型：${ownerType}`);
      }
      if (ownerMobile) {
        summary.push(`积点命令对象手机号：${ownerMobile}`);
      }
      if (commandStatus) {
        summary.push(`积点命令状态：${commandStatus}`);
      }
      if (sourceType) {
        summary.push(`积点命令来源类型：${sourceType}`);
      }
      if (requestSource) {
        summary.push(`积点命令草拟来源：${requestSource}`);
      }
      if (relatedLedgerCount !== null) {
        summary.push(`关联积点流水数：${relatedLedgerCount}`);
      }
      if (latestBalanceAfter) {
        summary.push(`执行后最新余额：${latestBalanceAfter}`);
      }
      if (affectPerformanceFlag !== null) {
        summary.push(`影响绩效前置：${affectPerformanceFlag ? '是' : '否'}`);
      }
      if (affectBCardFlag !== null) {
        summary.push(`影响B卡统计：${affectBCardFlag ? '是' : '否'}`);
      }
    }

    if (focusObject?.entityType === 'abc_points_command') {
      const rawContext = (focusObject.rawContext ?? {}) as Record<string, unknown>;
      const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
      const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
      const handlingPlan = this.readObjectObject(rawContext, 'handlingPlan');
      const handlingPlanDiagnosis = this.readObjectObject(handlingPlan, 'diagnosis');
      const handlingPlanBoundary = this.readObjectObject(handlingPlan, 'boundary');
      const shadowOwner = this.readObjectObject(rawContext, 'abcShadowOwner');
      const ownerType = this.readObjectString(ownerInfo, 'ownerType');
      const ownerMobile = this.readObjectString(ownerInfo, 'ownerMobile');
      const commandStatus = this.readObjectString(statusInfo, 'commandStatus');
      const sourceType = this.readObjectString(sourceInfo, 'sourceType');
      const requestSource = this.readObjectString(sourceInfo, 'requestSource');
      const writePathStable = this.readObjectBoolean(statusInfo, 'writePathStable');
      const changeAmount = this.readObjectString(basicInfo, 'changeAmount');
      const matchedCount = this.readObjectNumber(shadowOwner, 'matchedCount');
      const matchStatus = this.readObjectString(shadowOwner, 'matchStatus');
      const handlingPlanSummary = this.readObjectString(handlingPlan, 'summary');
      const handlingPlanListSummary = this.readObjectString(handlingPlan, 'listSummary');
      const handlingPlanNextStep = this.readObjectString(handlingPlanDiagnosis, 'suggestedNextStep');
      const handlingPlanBoundaryText = [
        this.readObjectString(handlingPlanBoundary, 'executionBoundary'),
        this.readObjectString(handlingPlanBoundary, 'humanConfirmationBoundary'),
        this.readObjectString(handlingPlanBoundary, 'payrollBoundary'),
        this.readObjectString(handlingPlanBoundary, 'generalizationBoundary'),
      ]
        .filter((item): item is string => Boolean(item && item.trim()))
        .join('；');

      if (ownerType) {
        summary.push(`ABC 积分命令对象类型：${ownerType}`);
      }
      if (ownerMobile) {
        summary.push(`ABC 积分命令对象手机号：${ownerMobile}`);
      }
      if (commandStatus) {
        summary.push(`ABC 积分命令状态：${commandStatus}`);
      }
      if (changeAmount) {
        summary.push(`ABC 积分变动：${changeAmount}`);
      }
      if (sourceType) {
        summary.push(`ABC 积分命令来源类型：${sourceType}`);
      }
      if (requestSource) {
        summary.push(`ABC 积分命令草拟来源：${requestSource}`);
      }
      if (handlingPlanSummary) {
        summary.push(`处理单摘要：${handlingPlanSummary}`);
      }
      if (handlingPlanListSummary) {
        summary.push(`谁处理 / 怎么处理：${handlingPlanListSummary}`);
      }
      if (handlingPlanNextStep) {
        summary.push(`何时可重试：${handlingPlanNextStep}`);
      }
      if (handlingPlanBoundaryText) {
        summary.push(`处理边界：${handlingPlanBoundaryText}`);
      }
      if (writePathStable !== null) {
        summary.push(`ABC 写入路径稳定：${writePathStable ? '是' : '否'}`);
      }
      if (matchedCount !== null || matchStatus) {
        summary.push(`ABC 影子用户命中：${matchStatus ?? '-'} / ${matchedCount ?? 0} 个候选`);
      }
    }

    /*
    if (focusObject?.entityType === 'approval_request_command') {
      const rawContext = (focusObject.rawContext ?? {}) as Record<string, unknown>;
      const approvalInfo = this.readObjectObject(rawContext, 'approvalInfo');
      const linkedBusinessContext = this.readObjectObject(rawContext, 'linkedBusinessContext');
      const linkedPayout = this.readObjectObject(rawContext, 'linkedPayout');
      const handlingPlan = this.readObjectObject(rawContext, 'handlingPlan');
      const precheck = this.readObjectObject(rawContext, 'approvalPrecheck');
      const diagnosis = this.readObjectObject(handlingPlan, 'diagnosis');
      const boundary = this.readObjectObject(handlingPlan, 'boundary');
      const approvalNo = this.readObjectString(approvalInfo, 'approvalNo');
      const status = this.readObjectString(approvalInfo, 'status');
      const requestAmount = this.readObjectString(approvalInfo, 'requestAmount');
      const requesterName = this.readObjectString(approvalInfo, 'requesterName');
      const workOrderNo = this.readObjectString(linkedBusinessContext, 'workOrderNo');
      const listSummary = this.readObjectString(handlingPlan, 'listSummary');
      const planSummary = this.readObjectString(handlingPlan, 'summary');
      const suggestedNextStep = this.readObjectString(diagnosis, 'suggestedNextStep');
      const blockedReason = this.readObjectString(diagnosis, 'blockedReason');
      const blockedStage = this.readObjectString(diagnosis, 'blockedStage');
      const verificationCode = this.readObjectString(approvalInfo, 'verificationCode');
      const verificationCodeRole = this.readObjectString(diagnosis, 'verificationCodeRole');
      const payoutNo = this.readObjectString(linkedPayout, 'latestPayoutNo');
      const boundaryText = [
        this.readObjectString(boundary, 'executionBoundary'),
        this.readObjectString(boundary, 'humanConfirmationBoundary'),
        this.readObjectString(boundary, 'payrollBoundary'),
        this.readObjectString(boundary, 'generalizationBoundary'),
      ]
        .filter((item): item is string => Boolean(item && item.trim()))
        .join('锛?);

      if (approvalNo) {
        summary.push(`审批编号：${approvalNo}`);
      }
      if (status) {
        summary.push(`审批状态：${status}`);
      }
      if (requestAmount) {
        summary.push(`申请金额：${requestAmount}`);
      }
      if (requesterName) {
        summary.push(`申请人：${requesterName}`);
      }
      if (workOrderNo) {
        summary.push(`关联工单：${workOrderNo}`);
      }
      if (planSummary) {
        summary.push(`处理单摘要：${planSummary}`);
      }
      if (listSummary) {
        summary.push(`谁处理 / 怎么处理：${listSummary}`);
      }
      if (suggestedNextStep) {
        summary.push(`建议下一步：${suggestedNextStep}`);
      }
      if (blockedReason || blockedStage) {
        summary.push(`阻塞：${blockedReason ?? '-'} / ${blockedStage ?? '-'}`);
      }
      if (verificationCode) {
        summary.push(`验证码展示：${verificationCode}`);
      }
      if (verificationCodeRole) {
        summary.push(`验证码作用：${verificationCodeRole}`);
      }
      if (payoutNo) {
        summary.push(`最近付款：${payoutNo}`);
      }
      if (this.readObjectString(precheck, 'precheckStatus')) {
        summary.push(
          `预检：${this.readObjectString(precheck, 'precheckStatus')} / canExecute=${
            this.readObjectBoolean(precheck, 'canExecute') ? 'true' : 'false'
          }`,
        );
      }
      if (boundaryText) {
        summary.push(`处理边界：${boundaryText}`);
      }
    }

    if (focusObject?.entityType === 'approval_request_command') {
      const approvalInfo = this.readObjectObject(rawContext, 'approvalInfo');
      const linkedBusinessContext = this.readObjectObject(rawContext, 'linkedBusinessContext');
      const linkedPayout = this.readObjectObject(rawContext, 'linkedPayout');
      const handlingPlan = this.readObjectObject(rawContext, 'handlingPlan');
      const diagnosis = this.readObjectObject(handlingPlan, 'diagnosis');
      const boundary = this.readObjectObject(handlingPlan, 'boundary');
      const actionItems = this.readObjectArray(handlingPlan, 'actionItems').filter(
        (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
      );
      const status = this.readObjectString(approvalInfo, 'status') ?? 'unknown';
      const requestAmount = this.readObjectString(approvalInfo, 'requestAmount') ?? '-';
      const reason = this.readObjectString(approvalInfo, 'reason') ?? '未提供';
      const requesterName = this.readObjectString(approvalInfo, 'requesterName') ?? '未知申请人';
      const approverName = this.readObjectString(approvalInfo, 'approverName');
      const workOrderNo = this.readObjectString(linkedBusinessContext, 'workOrderNo') ?? '-';
      const amountReceived = this.readObjectString(linkedBusinessContext, 'amountReceived');
      const payoutNo = this.readObjectString(linkedPayout, 'latestPayoutNo');
      const planSummary =
        this.readObjectString(handlingPlan, 'summary') ??
        `${label} 当前状态是 ${status}。`;
      const listSummary =
        this.readObjectString(handlingPlan, 'listSummary') ?? '请按 handlingPlan 收口版继续处理。';
      const suggestedNextStep =
        this.readObjectString(diagnosis, 'suggestedNextStep') ?? '当前仍需人工继续核对。';
      const verificationCodeRole =
        this.readObjectString(diagnosis, 'verificationCodeRole') ??
        'verificationCode 当前只作为提示，不是强阻断条件。';
      const primaryAction =
        actionItems.find((item) =>
          ['blocked', 'pending', 'ready'].includes(this.readObjectString(item, 'status') ?? ''),
        ) ?? actionItems[0] ?? null;
      const primaryActionSummary = primaryAction
        ? `${this.readObjectString(primaryAction, 'title') ?? '当前动作'}：${
            this.readObjectString(primaryAction, 'description') ?? listSummary
          }`
        : listSummary;
      const boundarySummary = [
        this.readObjectString(boundary, 'executionBoundary'),
        this.readObjectString(boundary, 'humanConfirmationBoundary'),
        this.readObjectString(boundary, 'payrollBoundary'),
        this.readObjectString(boundary, 'generalizationBoundary'),
      ]
        .filter((item): item is string => Boolean(item && item.trim()))
        .join('；');

      switch (questionType) {
        case 'why_blocked':
          return `${label} 当前处理单摘要是：${planSummary}。当前主要阻塞项是 ${blockerText}，应先按“${primaryActionSummary}”继续处理，不能绕过人工审批与日志留痕。`;
        case 'can_affect_payroll':
          return `${label} 当前工资边界是：${
            this.readObjectString(boundary, 'payrollBoundary') ?? '不会自动推进正式工资，也不会改动分层状态。'
          }`;
        case 'same_or_special_case':
          return `${label} 当前只适用于审批单 ${this.readObjectString(approvalInfo, 'approvalNo') ?? '-'} 与工单 ${workOrderNo} 的上下文；是否可泛化，要以 handlingPlan 的边界说明为准：${
            this.readObjectString(boundary, 'generalizationBoundary') ?? '当前不能自动泛化到其他资金对象。'
          }`;
        case 'what_missing':
          return `${label} 当前仍缺少的关键条件已经收在 handlingPlan 里：${primaryActionSummary}；${suggestedNextStep}`;
        case 'draft_action':
          return `${label} 当前最合理的动作草稿不是新建资金域，而是继续沿现有审批单执行：先确认工单/收款上下文，再由审批人或管理员人工 decide，验证码只作提示。`;
        case 'explain_rule':
          return `${label} 当前应优先用 handlingPlan 的状态摘要、动作清单、预检结论和边界说明解释；其中 verificationCode 的作用是：${verificationCodeRole}`;
        case 'what_to_do':
        default:
          return `${label} 当前申请金额 ${requestAmount}，申请人 ${requesterName}，关联工单 ${workOrderNo}，审批状态 ${status}。申请原因：${reason}。当前状态摘要：${planSummary}。谁处理 / 怎么处理：${primaryActionSummary}。何时可重试：${suggestedNextStep}${
            amountReceived ? `。当前工单已收款 ${amountReceived}` : ''
          }${approverName ? `。当前审批责任人：${approverName}` : ''}${
            payoutNo ? `。最近付款留痕：${payoutNo}` : ''
          }${boundarySummary ? `。边界说明：${boundarySummary}` : ''}`;
      }
    }

    if (focusObject?.entityType === 'approval_request_command') {
      questions.unshift(
        '这张审批单为什么存在？',
        '为什么现在能批 / 不能批？',
        '当前缺的条件到底是哪一个？',
        'verificationCode 在这一步只是提示，还是已经成了执行条件？',
        '下一步应该由谁处理？',
      );
    }
    */

    if (focusObject?.entityType === 'points_redemption_request') {
      const rawContext = (focusObject.rawContext ?? {}) as Record<string, unknown>;
      const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
      const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
      const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const ledgerImpact = this.readObjectObject(rawContext, 'ledgerImpact');
      const ownerType = this.readObjectString(ownerInfo, 'ownerType');
      const ownerMobile = this.readObjectString(ownerInfo, 'ownerMobile');
      const requestStatus = this.readObjectString(statusInfo, 'requestStatus');
      const redeemableName = this.readObjectString(basicInfo, 'redeemableName');
      const redeemableCode = this.readObjectString(basicInfo, 'redeemableCode');
      const requestSource = this.readObjectString(sourceInfo, 'requestSource');
      const providerSystem = this.readObjectString(sourceInfo, 'providerSystem');
      const externalEntityId = this.readObjectString(sourceInfo, 'externalEntityId');
      const externalNo = this.readObjectString(sourceInfo, 'externalNo');
      const relatedLedgerCount = this.readObjectNumber(ledgerImpact, 'ledgerEntryCount');
      const latestBalanceAfter = this.readObjectString(ledgerImpact, 'latestBalanceAfter');
      const affectPerformanceFlag = this.readObjectBoolean(rawContext, 'affectPerformanceFlag');
      const affectBCardFlag = this.readObjectBoolean(rawContext, 'affectBCardFlag');

      if (ownerType) {
        summary.push(`兑换请求对象类型：${ownerType}`);
      }
      if (ownerMobile) {
        summary.push(`兑换请求对象手机号：${ownerMobile}`);
      }
      if (requestStatus) {
        summary.push(`兑换请求状态：${requestStatus}`);
      }
      if (redeemableName || redeemableCode) {
        summary.push(`兑换目录：${redeemableName ?? redeemableCode ?? '-'}`);
      }
      if (requestSource) {
        summary.push(`兑换请求来源：${requestSource}`);
      }
      if (providerSystem) {
        summary.push(`履约系统：${providerSystem}`);
      }
      if (externalEntityId || externalNo) {
        summary.push(`ABC 履约凭据：${externalEntityId ?? '-'} / ${externalNo ?? '-'}`);
      }
      if (relatedLedgerCount !== null) {
        summary.push(`关联积点流水数：${relatedLedgerCount}`);
      }
      if (latestBalanceAfter) {
        summary.push(`兑换后最新余额：${latestBalanceAfter}`);
      }
      if (affectPerformanceFlag !== null) {
        summary.push(`影响绩效前置：${affectPerformanceFlag ? '是' : '否'}`);
      }
      if (affectBCardFlag !== null) {
        summary.push(`影响B卡统计：${affectBCardFlag ? '是' : '否'}`);
      }
    }

    if (focusObject?.entityType === 'points_welfare_preview') {
      const rawContext = (focusObject.rawContext ?? {}) as Record<string, unknown>;
      const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const previewSummary = this.readObjectObject(rawContext, 'previewSummary');
      const warnings = this.readObjectArray(previewSummary, 'warnings').filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
      const periodKey = this.readObjectString(basicInfo, 'periodKey');
      const targetEmployeeCount = this.readObjectNumber(basicInfo, 'targetEmployeeCount');
      const targetTotalAmount = this.readObjectString(basicInfo, 'targetTotalAmount');
      const latestBatchId = this.readObjectNumber(statusInfo, 'latestBatchId');
      const latestBatchStatus = this.readObjectString(statusInfo, 'batchStatus');

      if (periodKey) {
        summary.push(`福利预览周期：${periodKey}`);
      }
      if (targetEmployeeCount !== null) {
        summary.push(`可纳入员工：${targetEmployeeCount} 人`);
      }
      if (targetTotalAmount) {
        summary.push(`建议总积点：${targetTotalAmount}`);
      }
      if (latestBatchId) {
        summary.push(`当前周期已有福利积点母单：#${latestBatchId}${latestBatchStatus ? ` / ${latestBatchStatus}` : ''}`);
      }
      if (warnings.length) {
        summary.push(`预览警告：${warnings.slice(0, 2).join('；')}`);
      }
    }

    if (focusObject?.entityType === 'points_welfare_batch') {
      const rawContext = (focusObject.rawContext ?? {}) as Record<string, unknown>;
      const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const ledgerImpact = this.readObjectObject(rawContext, 'ledgerImpact');
      const previewSummary = this.readObjectObject(rawContext, 'previewSummary');

      const periodKey = this.readObjectString(basicInfo, 'periodKey');
      const batchStatus = this.readObjectString(statusInfo, 'batchStatus');
      const targetEmployeeCount = this.readObjectNumber(statusInfo, 'targetEmployeeCount');
      const targetTotalAmount = this.readObjectString(statusInfo, 'targetTotalAmount');
      const relatedLedgerCount = this.readObjectNumber(ledgerImpact, 'relatedLedgerCount');
      const latestBalanceAfter = this.readObjectString(ledgerImpact, 'latestBalanceAfter');
      const warnings = this.readObjectArray(previewSummary, 'warnings').filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );

      if (periodKey) {
        summary.push(`福利积点母单周期：${periodKey}`);
      }
      if (batchStatus) {
        summary.push(`福利积点母单状态：${batchStatus}`);
      }
      if (targetEmployeeCount !== null) {
        summary.push(`目标员工数：${targetEmployeeCount}`);
      }
      if (targetTotalAmount) {
        summary.push(`目标总积点：${targetTotalAmount}`);
      }
      if (relatedLedgerCount !== null) {
        summary.push(`已写入积点流水：${relatedLedgerCount} 条`);
      }
      if (latestBalanceAfter) {
        summary.push(`最近余额：${latestBalanceAfter}`);
      }
      if (warnings.length) {
        summary.push(`预览警告：${warnings.slice(0, 2).join('；')}`);
      }
    }

    if (taskStateSummary) {
      const processingStatus = this.readObjectString(taskStateSummary, 'processingStatus');
      if (processingStatus) {
        summary.push(`当前任务状态：${processingStatus}`);
      }
      const deferUntil = this.readObjectString(taskStateSummary, 'deferUntil');
      if (deferUntil) {
        summary.push(`暂缓到：${deferUntil}`);
      }
    }

    if (filterSummary.sourceActionId) {
      summary.push(`当前页面来自 AI 行动项：${filterSummary.sourceActionId}`);
    }

    if (pointsSummary) {
      const recentCommandCount = this.readObjectNumber(pointsSummary, 'recentCommandCount');
      const latestBalanceAfter = this.readObjectString(pointsSummary, 'latestBalanceAfter');
      if (recentCommandCount !== null && recentCommandCount > 0) {
        summary.push(`近期积点命令：${recentCommandCount} 条`);
      }
      if (latestBalanceAfter) {
        summary.push(`最近积点账本余额：${latestBalanceAfter}`);
      }
    }

    if (filterSummary.periodKey) {
      summary.push(`当前期间：${filterSummary.periodKey}`);
    } else if (filterSummary.dateFrom && filterSummary.dateTo) {
      summary.push(`当前日期范围：${filterSummary.dateFrom} ~ ${filterSummary.dateTo}`);
    }

    return summary;
  }

  private collectPageBlockers(
    focusObject: AiAssistantFocusObject | null,
    taskStateSummary: Record<string, unknown> | null,
    filterSummary: AiAssistantFilterSummary,
  ) {
    const blockers = new Set<string>();

    const focusBlockers = this.readObjectArray(
      (focusObject?.rawContext ?? {}) as Record<string, unknown>,
      'blockers',
    );
    for (const item of focusBlockers) {
      if (typeof item === 'string' && item.trim()) {
        blockers.add(item);
      }
    }

    const taskStatus = this.readObjectString(taskStateSummary, 'processingStatus');
    if (taskStatus === 'deferred') {
      blockers.add('task_deferred');
    }
    if (taskStatus === 'waiting_review') {
      blockers.add('waiting_review');
    }

    if (filterSummary.sourceActionId) {
      blockers.add('from_ai_action');
    }

    return Array.from(blockers);
  }

  private async loadRelevantMemoryEntries(input: {
    role: AiActionOwnerRole;
    allowOwnerOnlyMemory: boolean;
    scene: AiConsoleScene;
    routePath: string;
    focusObject: AiAssistantFocusObject | null;
    blockers: string[];
  }) {
    const entries = await this.aiMemoryEntryRepository.find({
      where: { enabledFlag: true },
      order: {
        priorityLevel: 'DESC',
        updatedAt: 'DESC',
        id: 'DESC',
      },
    });

    const focusContext = (input.focusObject?.rawContext ?? {}) as Record<string, unknown>;
    const payment = this.readObjectObject(focusContext, 'paymentAndReconciliation');
    const bundle = this.readObjectObject(focusContext, 'productAndBundle');
    const identity = this.readObjectObject(focusContext, 'customerIdentity');
    const rewardDomain = this.resolveAssistantRewardDomain(input.routePath, input.focusObject);
    const sourceOfTruth = this.resolveAssistantSourceOfTruth(input.routePath, input.focusObject);

    const contextTags = new Set<string>([
      'global',
      'reward_domain',
      input.focusObject?.entityType ?? '',
      input.role,
      input.scene,
      rewardDomain ?? '',
      sourceOfTruth?.toLowerCase() ?? '',
      this.readObjectString(payment, 'paymentStatus') ?? '',
      this.readObjectString(payment, 'sourceClassification') ?? '',
      this.readObjectString(payment, 'reconciliationStatus') ?? '',
      this.readObjectString(bundle, 'businessCategory') ?? '',
      this.readObjectString(bundle, 'benefitSourceType') ?? '',
      identity && this.readObjectString(identity, 'customerMobile') ? 'customer_binding' : '',
      ...input.blockers,
    ]);

    const matches = entries
      .map((entry) => {
        const roleScope = Array.isArray(entry.roleScope) ? entry.roleScope : [];
        const sceneScope = Array.isArray(entry.sceneScope) ? entry.sceneScope : [];
        const tags = Array.isArray(entry.tags)
          ? entry.tags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [];

        if (!input.allowOwnerOnlyMemory && this.hasOwnerOnlyMemoryTag(tags)) {
          return null;
        }

        if (roleScope.length && !roleScope.includes(input.role)) {
          return null;
        }
        if (sceneScope.length && !sceneScope.includes('global') && !sceneScope.includes(input.scene)) {
          return null;
        }

        let score = Math.max(1, Number(entry.priorityLevel ?? 0));
        if (entry.scopeType === 'founder') {
          score += 20;
        }
        if (entry.scopeType === 'role' && entry.scopeKey === input.role) {
          score += 16;
        }
        if (entry.scopeType === 'route' && entry.scopeKey && input.routePath.startsWith(entry.scopeKey)) {
          score += 8;
        }
        if (entry.scopeType === 'scene' && entry.scopeKey === input.scene) {
          score += 8;
        }
        if (entry.scopeType === 'entity_type' && entry.scopeKey === input.focusObject?.entityType) {
          score += 8;
        }

        for (const tag of tags) {
          if (contextTags.has(tag)) {
            score += 4;
          }
        }

        if (score <= 0) {
          return null;
        }

        const memoryBucket: 'founder' | 'role' =
          entry.scopeType === 'founder' || entry.memoryType.startsWith('founder_') ? 'founder' : 'role';

        return {
          score,
          mapped: this.mapAiMemoryReference(entry, memoryBucket),
        };
      })
      .filter((item): item is { score: number; mapped: AiMemoryReference } => Boolean(item))
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.mapped.priorityLevel - a.mapped.priorityLevel ||
          a.mapped.id - b.mapped.id,
      );

    const founderMemories = matches
      .filter((item) => item.mapped.memoryBucket === 'founder')
      .slice(0, 4)
      .map((item) => item.mapped);
    const roleMemories = matches
      .filter((item) => item.mapped.memoryBucket === 'role')
      .slice(0, 4)
      .map((item) => item.mapped);

    return {
      founderMemories,
      roleMemories,
      citedMemories: [...founderMemories.slice(0, 3), ...roleMemories.slice(0, 3)].slice(0, 6),
    };
  }

  private async loadRelevantKnowledgeEntries(input: {
    role: AiActionOwnerRole;
    scene: AiConsoleScene;
    routePath: string;
    focusObject: AiAssistantFocusObject | null;
    blockers: string[];
  }) {
    const entries = await this.aiKnowledgeEntryRepository.find({
      where: { enabledFlag: true },
      order: {
        id: 'ASC',
      },
    });

    const focusContext = (input.focusObject?.rawContext ?? {}) as Record<string, unknown>;
    const payment = this.readObjectObject(focusContext, 'paymentAndReconciliation');
    const bundle = this.readObjectObject(focusContext, 'productAndBundle');
    const identity = this.readObjectObject(focusContext, 'customerIdentity');
    const rewardDomain = this.resolveAssistantRewardDomain(input.routePath, input.focusObject);
    const sourceOfTruth = this.resolveAssistantSourceOfTruth(input.routePath, input.focusObject);

    const contextTags = new Set<string>([
      'global',
      'reward_domain',
      input.focusObject?.entityType ?? '',
      rewardDomain ?? '',
      sourceOfTruth?.toLowerCase() ?? '',
      this.readObjectString(payment, 'paymentStatus') ?? '',
      this.readObjectString(payment, 'sourceClassification') ?? '',
      this.readObjectString(payment, 'reconciliationStatus') ?? '',
      this.readObjectString(bundle, 'businessCategory') ?? '',
      this.readObjectString(bundle, 'benefitSourceType') ?? '',
      identity && this.readObjectString(identity, 'customerMobile') ? 'customer_binding' : '',
      ...input.blockers,
    ]);

    return entries
      .map((entry) => {
        const entryTags = Array.isArray(entry.tags)
          ? entry.tags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [];
        const roleScope = Array.isArray(entry.roleScope) ? entry.roleScope : [];
        const sceneScope = Array.isArray(entry.sceneScope) ? entry.sceneScope : [];

        if (roleScope.length && !roleScope.includes(input.role)) {
          return null;
        }
        if (sceneScope.length && !sceneScope.includes('global') && !sceneScope.includes(input.scene)) {
          return null;
        }

        let score = 0;
        if (entry.scopeType === 'global') {
          score += 1;
        }
        if (entry.scopeType === 'route' && entry.scopeKey && input.routePath.startsWith(entry.scopeKey)) {
          score += 3;
        }
        if (entry.scopeType === 'blocker' && entry.scopeKey && input.blockers.includes(entry.scopeKey)) {
          score += 4;
        }
        if (entry.scopeType === 'entity' && entry.scopeKey && entry.scopeKey === input.focusObject?.entityType) {
          score += 3;
        }

        for (const tag of entryTags) {
          if (contextTags.has(tag)) {
            score += 2;
          }
        }

        if (score <= 0) {
          return null;
        }

        const mapped: AiKnowledgeReference = {
          id: entry.id,
          knowledgeType: entry.knowledgeType,
          scopeType: entry.scopeType,
          scopeKey: entry.scopeKey ?? null,
          title: entry.title,
          summary: entry.summary,
          content: entry.content,
          tags: entryTags,
          sourceType: entry.sourceType ?? null,
          aiLearningMode: entry.aiLearningMode ?? null,
        };

        return { score, mapped };
      })
      .filter((item): item is { score: number; mapped: AiKnowledgeReference } => Boolean(item))
      .sort((a, b) => b.score - a.score || a.mapped.id - b.mapped.id)
      .slice(0, 5)
      .map((item) => item.mapped);
  }

  private async loadRelevantManualDecisionReferences(
    focusObject: AiAssistantFocusObject | null,
    currentUser: CurrentUser,
    blockers: string[],
  ) {
    if (!focusObject) {
      return [];
    }

    const references: AiManualDecisionReference[] = [];
    const directDecision = this.readObjectObject(
      (focusObject.rawContext ?? {}) as Record<string, unknown>,
      'manualDecisionSummary',
    );

    if (directDecision) {
      const direct = this.buildManualDecisionReferenceFromObject(directDecision, 'direct');
      if (direct) {
        references.push(direct);
      }
    }

    const latestDecisions = await this.performanceSummaryManualDecisionRepository.find({
      order: {
        operatedAt: 'DESC',
        id: 'DESC',
      },
      take: 30,
    });

    const focusPayment = this.readObjectObject(
      (focusObject.rawContext ?? {}) as Record<string, unknown>,
      'paymentAndReconciliation',
    );
    const focusPaymentStatus = this.readObjectString(focusPayment, 'paymentStatus');
    const focusClassification = this.readObjectString(focusPayment, 'sourceClassification');

    for (const decision of latestDecisions) {
      if (references.some((item) => item.id === decision.id)) {
        continue;
      }
      const mapped = this.mapAiManualDecisionReference(decision);
      const payload = (decision.normalizedPayload ?? {}) as Record<string, unknown>;
      const historicalPaymentStatus =
        this.readObjectString(payload, 'paymentStatus') ??
        this.readObjectString(payload, 'currentPaymentStatus');
      const historicalClassification =
        this.readObjectString(payload, 'sourceClassification') ??
        this.readObjectString(payload, 'currentSourceClassification') ??
        this.readObjectString(payload, 'finalClassification');
      const historicalBlockers = this.readObjectArray(payload, 'blockers').filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );

      const samePattern =
        (focusPaymentStatus && historicalPaymentStatus === focusPaymentStatus) ||
        (focusClassification && historicalClassification === focusClassification) ||
        historicalBlockers.some((item) => blockers.includes(item));

      if (!samePattern) {
        continue;
      }

      references.push({
        id: mapped.id,
        sourceSummaryId: mapped.sourceSummaryId,
        actionType: mapped.actionType,
        reasonCode: mapped.reasonCode,
        decisionScope: mapped.decisionScope,
        judgmentBasis: mapped.judgmentBasis,
        aiLearningMode: mapped.aiLearningMode,
        finalClassification: mapped.finalClassification,
        finalBindingStatus: mapped.finalBindingStatus,
        operatorName: mapped.operatorName,
        operatedAt: mapped.operatedAt,
        matchType: 'similar_pattern',
        summary: this.describeManualDecisionReference(
          {
            actionType: mapped.actionType,
            decisionScope: mapped.decisionScope,
            judgmentBasis: mapped.judgmentBasis,
            operatorName: mapped.operatorName,
            finalClassification: mapped.finalClassification,
          },
          'similar_pattern',
        ),
      });

      if (references.length >= 4) {
        break;
      }
    }

    return references;
  }

  private mapAiManualDecisionReference(
    decision: PerformanceSummaryManualDecision,
  ): AiManualDecisionReference {
    const payload = (decision.normalizedPayload ?? {}) as Record<string, unknown>;
    const judgmentBasis = this.readObjectArray(payload, 'judgmentBasis').filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );

    const mapped: AiManualDecisionReference = {
      id: decision.id,
      sourceSummaryId: decision.sourceSummaryId,
      actionType: decision.actionType,
      reasonCode: decision.reasonCode ?? null,
      decisionScope: this.readObjectString(payload, 'decisionScope') ?? null,
      judgmentBasis,
      aiLearningMode: this.readObjectString(payload, 'aiLearningMode') ?? null,
      finalClassification:
        decision.finalClassification ??
        this.readObjectString(payload, 'finalClassification') ??
        this.readObjectString(payload, 'currentSourceClassification') ??
        null,
      finalBindingStatus:
        decision.finalBindingStatus ??
        this.readObjectString(payload, 'finalBindingStatus') ??
        null,
      operatorName: decision.operatorName ?? null,
      operatedAt: decision.operatedAt.toISOString(),
      matchType: 'direct',
      summary: this.describeManualDecisionReference(
        {
          actionType: decision.actionType,
          finalClassification:
            decision.finalClassification ??
            this.readObjectString(payload, 'finalClassification') ??
            null,
          decisionScope: this.readObjectString(payload, 'decisionScope') ?? null,
          judgmentBasis,
          operatorName: decision.operatorName ?? null,
        },
        'direct',
      ),
    };

    return mapped;
  }

  private mapAiMemoryReference(
    entry: AiMemoryEntry,
    memoryBucket: 'founder' | 'role',
  ): AiMemoryReference {
    return {
      id: entry.id,
      memoryType: entry.memoryType,
      scopeType: entry.scopeType,
      scopeKey: entry.scopeKey ?? null,
      title: entry.title,
      summary: entry.summary,
      content: entry.content,
      tags: Array.isArray(entry.tags)
        ? entry.tags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [],
      priorityLevel: Number(entry.priorityLevel ?? 0),
      sourceType: entry.sourceType ?? null,
      generalizationMode: entry.generalizationMode ?? null,
      aiUsageMode: entry.aiUsageMode ?? null,
      memoryBucket,
    };
  }

  private buildMemoryReferenceFromObject(source: Record<string, unknown>): AiMemoryReference | null {
    const idRaw = source.id;
    const id = typeof idRaw === 'number' ? idRaw : Number(idRaw);
    const title = this.readObjectString(source, 'title');
    if (!Number.isFinite(id) || !title) {
      return null;
    }

    const memoryBucketRaw = this.readObjectString(source, 'memoryBucket');
    return {
      id,
      memoryType: this.readObjectString(source, 'memoryType') ?? 'founder_principle',
      scopeType: this.readObjectString(source, 'scopeType') ?? 'global',
      scopeKey: this.readObjectString(source, 'scopeKey') ?? null,
      title,
      summary: this.readObjectString(source, 'summary') ?? '',
      content: this.readObjectString(source, 'content') ?? '',
      tags: this.readObjectArray(source, 'tags').filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
      priorityLevel: Number(this.readObjectNumber(source, 'priorityLevel') ?? 0),
      sourceType: this.readObjectString(source, 'sourceType') ?? null,
      generalizationMode: this.readObjectString(source, 'generalizationMode') ?? null,
      aiUsageMode: this.readObjectString(source, 'aiUsageMode') ?? null,
      memoryBucket: memoryBucketRaw === 'role' ? 'role' : 'founder',
    };
  }

  private mapMemoryEntryForList(entry: AiMemoryEntry): Record<string, unknown> {
    return {
      id: entry.id,
      memoryType: entry.memoryType,
      scopeType: entry.scopeType,
      scopeKey: entry.scopeKey ?? null,
      roleScope: Array.isArray(entry.roleScope) ? entry.roleScope : [],
      sceneScope: Array.isArray(entry.sceneScope) ? entry.sceneScope : [],
      title: entry.title,
      summary: entry.summary,
      content: entry.content,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      priorityLevel: Number(entry.priorityLevel ?? 0),
      enabledFlag: entry.enabledFlag,
      sourceType: entry.sourceType ?? null,
      generalizationMode: entry.generalizationMode ?? null,
      aiUsageMode: entry.aiUsageMode ?? null,
      createdBy: entry.createdBy ?? null,
      createdByName: entry.createdByName ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      normalizedPayload: entry.normalizedPayload ?? {},
    };
  }

  private isOwnerOnlyMemoryEntry(entry: Pick<AiMemoryEntry, 'tags'>) {
    return this.hasOwnerOnlyMemoryTag(entry.tags);
  }

  private hasOwnerOnlyMemoryTag(tags: unknown) {
    return (
      Array.isArray(tags) &&
      tags.some(
        (tag) => typeof tag === 'string' && tag.trim().toLowerCase() === 'owner_only',
      )
    );
  }

  private canAccessOwnerOnlyMemory(currentUser: CurrentUser) {
    const roleCodes = Array.isArray(currentUser.roleCodes)
      ? currentUser.roleCodes.map((role) => role.trim().toLowerCase())
      : [];
    return roleCodes.some((role) => ['owner', 'founder', 'super_admin'].includes(role));
  }

  private assertOwnerOnlyMemoryAccess(currentUser: CurrentUser, ...tagSources: unknown[]) {
    if (
      tagSources.some((tags) => this.hasOwnerOnlyMemoryTag(tags)) &&
      !this.canAccessOwnerOnlyMemory(currentUser)
    ) {
      throw new ForbiddenException('仅老板、创始人或超级管理员可访问 owner_only 记忆');
    }
  }

  private compareMemoryEntries(
    left: AiMemoryEntry,
    right: AiMemoryEntry,
    sortBy: string,
    sortOrder: 'ASC' | 'DESC',
  ) {
    const factor = sortOrder === 'ASC' ? 1 : -1;
    const normalizeValue = (entry: AiMemoryEntry) => {
      switch (sortBy) {
        case 'id':
          return entry.id;
        case 'title':
          return entry.title.toLowerCase();
        case 'memoryType':
          return entry.memoryType.toLowerCase();
        case 'scopeType':
          return entry.scopeType.toLowerCase();
        case 'updatedAt':
          return entry.updatedAt.getTime();
        case 'createdAt':
          return entry.createdAt.getTime();
        case 'priorityLevel':
        default:
          return Number(entry.priorityLevel ?? 0);
      }
    };

    const leftValue = normalizeValue(left);
    const rightValue = normalizeValue(right);
    if (leftValue < rightValue) {
      return -1 * factor;
    }
    if (leftValue > rightValue) {
      return 1 * factor;
    }
    return (right.id - left.id) * factor;
  }

  private buildAssistantSuggestedActions(
    focusObject: AiAssistantFocusObject | null,
    blockers: string[],
    sourceActionId: string | null,
    policyContext: AiSuggestedActionPolicyContext = {},
  ) {
    const rawSuggestedActions = this.buildAssistantSuggestedActionsRaw(
      focusObject,
      blockers,
      sourceActionId,
    );
    return this.buildSuggestedActionsPolicyForAssistantOutput({
      rawSuggestedActions,
      focusObject,
      blockers,
      sourceActionId,
      policyContext,
    }).allowedSuggestedActions;
  }

  private buildAssistantSuggestedActionsRaw(
    focusObject: AiAssistantFocusObject | null,
    blockers: string[],
    sourceActionId: string | null,
  ) {
    const actions: Array<Record<string, unknown>> = [];

    if (focusObject?.entityType === 'approval_request_command') {
      if (blockers.includes('linked_context_missing')) {
        actions.push({
          actionType: 'repair_approval_request_context',
          label: '建议先补齐审批单与真实工单/收款上下文，再回到审批动作',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('actor_not_allowed')) {
        actions.push({
          actionType: 'handoff_approval_request_decision',
          label: '当前角色先看 handlingPlan，再交由审批人或管理员执行 approve / reject',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('approval_not_pending')) {
        actions.push({
          actionType: 'review_approval_request_closed_state',
          label: '审批状态已结束，建议转为后续付款或审计复核，不再重复执行审批动作',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('payout_already_executed')) {
        actions.push({
          actionType: 'review_approval_request_payout_audit',
          label: '付款已登记，建议查看付款与日志留痕，转入审计复核',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (!actions.length) {
        actions.push({
          actionType: 'review_approval_request_handling_plan',
          label: '建议按 handlingPlan 继续人工审批，并保留 approve / reject 与付款日志',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
    }

    if (focusObject?.entityType === 'payment_record_command') {
      if (blockers.includes('linked_work_order_missing')) {
        actions.push({
          actionType: 'repair_payment_record_context',
          label: '建议先补齐收款记录与工单上下文，再回到到账确认判断',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('duplicate_success_risk')) {
        actions.push({
          actionType: 'review_duplicate_payment_success_risk',
          label: '建议先复核同工单疑似重复 success 留痕，避免重复到账',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('actor_not_allowed')) {
        actions.push({
          actionType: 'handoff_payment_record_confirmation',
          label: '当前角色先看 handlingPlan，再交由财务或管理员沿现有写入路径处理',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('already_applied_to_work_order')) {
        actions.push({
          actionType: 'review_applied_payment_record_audit',
          label: '当前记录已收口，建议转为查看工单实收、状态与操作日志是否一致',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (!actions.length) {
        actions.push({
          actionType: 'review_payment_record_handling_plan',
          label: '建议按 handlingPlan 继续人工确认到账，不新增 execute 接口',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
    }

    if (focusObject?.entityType === 'points_welfare_preview') {
      actions.push({
        actionType: 'create_points_welfare_batch_draft',
        label: '建议先创建本月员工 200 积点批量草案',
        targetEntityType: focusObject.entityType,
        targetEntityId: focusObject.entityId,
        sourceActionId,
      });
    }

    if (focusObject?.entityType === 'points_welfare_batch') {
      if (blockers.includes('points_welfare_batch_pending_confirmation')) {
        actions.push({
          actionType: 'confirm_points_welfare_batch',
          label: '建议先确认福利积点母单，再决定是否执行',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (
        blockers.includes('points_welfare_batch_waiting_execution') ||
        blockers.includes('points_welfare_batch_partially_executed')
      ) {
        actions.push({
          actionType: 'execute_points_welfare_batch',
          label: '建议执行福利积点母单，并核对子命令与积点账本',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_welfare_batch_cancelled')) {
        actions.push({
          actionType: 'review_cancelled_points_welfare_batch',
          label: '母单已取消，建议确认是否需要重新生成新的福利草案',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
    }

    if (focusObject?.entityType === 'points_welfare_batch_item') {
      if (blockers.includes('points_welfare_item_on_hold')) {
        actions.push({
          actionType: 'review_points_welfare_hold_item',
          label: '建议先核对留后原因，再决定是否恢复默认发放或转自定义发放',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_welfare_item_excluded')) {
        actions.push({
          actionType: 'review_points_welfare_excluded_item',
          label: '建议先核对排除原因，再决定是否恢复默认发放或转自定义发放',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_welfare_item_custom_allocation')) {
        actions.push({
          actionType: 'review_points_welfare_custom_item',
          label: '建议先复核自定义积点和调整说明，再决定是否保留特例',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_welfare_item_command_missing')) {
        actions.push({
          actionType: 'repair_points_welfare_item_command',
          label: '默认/自定义发放区缺少子命令，建议先核对批次子项与子命令同步状态',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
    }

    if (focusObject?.entityType === 'points_redemption_request') {
      if (blockers.includes('points_redemption_pending_confirmation')) {
        actions.push({
          actionType: 'confirm_points_redemption',
          label: '建议先人工确认兑换请求，再进入总部与 ABC 的履约衔接',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_redemption_waiting_fulfillment')) {
        actions.push({
          actionType: 'mark_points_redemption_fulfilled',
          label: '建议先补录 ABC 履约结果，再回写总部积点 consume 流水',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_redemption_missing_consume_ledger')) {
        actions.push({
          actionType: 'review_points_redemption_consume_gap',
          label: '当前已出现履约与积点账本缺口，建议先核查总部 consume 是否漏写',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_redemption_reconciliation_mismatch')) {
        actions.push({
          actionType: 'review_points_redemption_reconciliation',
          label: '当前存在对账异常，建议先核对 ABC 影子记录、外部编号与总部 consume 是否一致',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_redemption_cancelled')) {
        actions.push({
          actionType: 'review_cancelled_points_redemption',
          label: '兑换请求已取消，建议确认是否需要重建草稿或保留审计归档',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_redemption_failed')) {
        actions.push({
          actionType: 'retry_or_rebuild_points_redemption',
          label: '兑换请求失败，建议先核对失败原因，再决定重试或重建',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
    }

    if (focusObject?.entityType === 'points_command') {
      if (blockers.includes('points_command_pending_confirmation')) {
        actions.push({
          actionType: 'confirm_points_command',
          label: '建议先完成人工确认，再决定是否执行积点命令',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_command_waiting_execution')) {
        actions.push({
          actionType: 'execute_points_command',
          label: '命令已确认，建议核对后执行并写入积点账本',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_command_cancelled')) {
        actions.push({
          actionType: 'review_cancelled_points_command',
          label: '命令已取消，建议确认是否需要重新草拟或保留归档',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('points_command_failed')) {
        actions.push({
          actionType: 'retry_or_rebuild_points_command',
          label: '命令执行失败，建议先核对失败原因再决定重试或重建',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
    }

    if (focusObject?.entityType === 'abc_points_command') {
      if (blockers.includes('abc_points_command_pending_confirmation')) {
        actions.push({
          actionType: 'confirm_abc_points_command',
          label: '建议先完成人工确认，再决定是否进入 ABC 积分受控执行',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('abc_points_command_waiting_execution')) {
        actions.push({
          actionType: 'execute_abc_points_command',
          label: 'ABC 积分命令已确认，建议检查写入路径是否稳定，再决定是否执行',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('abc_points_command_blocked')) {
        actions.push({
          actionType: 'review_abc_score_write_path',
          label: '当前写入路径未稳定，建议保留 blocked 审计并继续核查 ABC 积分写入链',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('abc_points_command_cancelled')) {
        actions.push({
          actionType: 'review_cancelled_abc_points_command',
          label: 'ABC 积分命令已取消，建议确认是否需要重新草拟或保留归档',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
      if (blockers.includes('abc_points_command_failed')) {
        actions.push({
          actionType: 'retry_or_rebuild_abc_points_command',
          label: 'ABC 积分命令执行失败，建议先核对失败原因，再决定重试或重建',
          targetEntityType: focusObject.entityType,
          targetEntityId: focusObject.entityId,
          sourceActionId,
        });
      }
    }

    if (blockers.includes('missing_customer_binding')) {
      actions.push({
        actionType: 'confirm_binding',
        label: '建议先确认客户绑定',
        targetEntityType: focusObject?.entityType ?? null,
        targetEntityId: focusObject?.entityId ?? null,
        sourceActionId,
      });
    }

    if (blockers.includes('sheet_missing')) {
      actions.push({
        actionType: 'sheet_repair',
        label: '建议先补台账漏记证据',
        targetEntityType: focusObject?.entityType ?? null,
        targetEntityId: focusObject?.entityId ?? null,
        sourceActionId,
      });
    }

    if (
      blockers.includes('awaiting_manual_review') ||
      blockers.includes('pending_confirmation')
    ) {
      actions.push({
        actionType: 'manual_decision',
        label: '建议先完成人工裁决或确认',
        targetEntityType: focusObject?.entityType ?? null,
        targetEntityId: focusObject?.entityId ?? null,
        sourceActionId,
      });
    }

    if (!actions.length) {
      actions.push({
        actionType: 'review_context',
        label: '建议先核对当前上下文证据',
        targetEntityType: focusObject?.entityType ?? null,
        targetEntityId: focusObject?.entityId ?? null,
        sourceActionId,
      });
    }

    return actions;
  }

  private buildMemoryInfluenceSummary(
    manualDecisionMatches: AiManualDecisionReference[],
    founderMemories: AiMemoryReference[],
    roleMemories: AiMemoryReference[],
    knowledgeHints: AiKnowledgeReference[],
  ) {
    const parts: string[] = [];
    if (manualDecisionMatches.length) {
      parts.push(`先参考 ${manualDecisionMatches.length} 条人工裁决`);
    }
    if (founderMemories.length) {
      parts.push(`再参考 ${founderMemories.length} 条创始人记忆`);
    }
    if (roleMemories.length) {
      parts.push(`再参考 ${roleMemories.length} 条岗位规则`);
    }
    if (knowledgeHints.length) {
      parts.push(`最后补充 ${knowledgeHints.length} 条通用规则知识`);
    }
    if (!parts.length) {
      return '当前没有命中直接人审、创始人记忆、岗位规则或通用知识，只能给保守建议。';
    }
    return `本次回答按“当前对象 -> 人工裁决 -> 创始人记忆 -> 岗位规则 -> 通用规则”的固定顺序组织。${parts.join('，')}。`;
  }

  private buildGeneralizationBoundary(
    manualDecisionMatches: AiManualDecisionReference[],
    founderMemories: AiMemoryReference[],
    roleMemories: AiMemoryReference[],
    knowledgeHints: AiKnowledgeReference[],
  ) {
    const directDecision = manualDecisionMatches.find((item) => item.matchType === 'direct');
    if (directDecision?.decisionScope === 'case_only') {
      return '当前有直接人审且适用范围为 case_only，这条建议只能用于当前记录，不应自动推广。';
    }
    if (directDecision?.decisionScope === 'same_pattern') {
      return '当前有直接人审且适用范围为 same_pattern，可用于同类候选参考，但仍需人工复核。';
    }
    if (directDecision?.decisionScope === 'global_rule') {
      return '当前有直接人审标记为 global_rule，可作为全局参考，但仍不能跳过人工确认层。';
    }

    const strictMemory = [...founderMemories, ...roleMemories].find(
      (item) => item.generalizationMode === 'do_not_apply' || item.aiUsageMode === 'never_auto_apply',
    );
    if (strictMemory) {
      return `已命中“${strictMemory.title}”的严格边界，这类情况只能提示人工判断，不应自动套用。`;
    }

    const samePatternMemory = [...founderMemories, ...roleMemories].find(
      (item) => item.generalizationMode === 'same_pattern',
    );
    if (samePatternMemory) {
      return `已命中“${samePatternMemory.title}”这类同类模式记忆，可建议同类参考，但不能直接自动泛化。`;
    }

    if (knowledgeHints.length) {
      return '当前主要依赖角色记忆和规则知识，只能给保守建议，不能直接自动确认。';
    }

    return '当前上下文不足，这次回答只能作为保守建议，仍需人工确认与补证。';
  }

  private buildMemoryInfluenceSummaryV2(
    manualDecisionMatches: AiManualDecisionReference[],
    founderMemories: AiMemoryReference[],
    roleMemories: AiMemoryReference[],
    knowledgeHints: AiKnowledgeReference[],
  ) {
    const parts: string[] = [];
    if (manualDecisionMatches.length) {
      parts.push(`先参考 ${manualDecisionMatches.length} 条人工裁决`);
    }
    if (founderMemories.length) {
      parts.push(`再参考 ${founderMemories.length} 条创始人记忆`);
    }
    if (roleMemories.length) {
      parts.push(`再参考 ${roleMemories.length} 条岗位规则`);
    }
    if (knowledgeHints.length) {
      parts.push(`最后补充 ${knowledgeHints.length} 条通用规则知识`);
    }
    if (!parts.length) {
      return '当前没有命中直接人审、创始人记忆、岗位规则或通用规则知识，只能给保守建议。';
    }
    return `这次回答按“当前对象 -> 人工裁决 -> 创始人记忆 -> 岗位规则 -> 通用规则”的固定顺序组织。${parts.join('，')}。`;
  }

  private buildGeneralizationBoundaryV2(
    manualDecisionMatches: AiManualDecisionReference[],
    founderMemories: AiMemoryReference[],
    roleMemories: AiMemoryReference[],
    knowledgeHints: AiKnowledgeReference[],
  ) {
    const directDecision = manualDecisionMatches.find((item) => item.matchType === 'direct');
    if (directDecision?.decisionScope === 'case_only') {
      return '当前有直接人审且适用范围为 case_only，这条建议只适用于当前记录，不应自动推广。';
    }
    if (directDecision?.decisionScope === 'same_pattern') {
      return '当前有直接人审且适用范围为 same_pattern，可作为同类候选参考，但仍需人工复核。';
    }
    if (directDecision?.decisionScope === 'global_rule') {
      return '当前有直接人审标记为 global_rule，可作为全局参考，但仍不能跳过人工确认层。';
    }

    const strictMemory = [...founderMemories, ...roleMemories].find(
      (item) => item.generalizationMode === 'do_not_apply' || item.aiUsageMode === 'never_auto_apply',
    );
    if (strictMemory) {
      return `命中了“${strictMemory.title}”这条严格边界，这类情况只能提示人工判断，不应自动套用。`;
    }

    const samePatternMemory = [...founderMemories, ...roleMemories].find(
      (item) => item.generalizationMode === 'same_pattern',
    );
    if (samePatternMemory) {
      return `命中了“${samePatternMemory.title}”这类同类模式记忆，可建议同类参考，但不能直接自动泛化。`;
    }

    if (knowledgeHints.length) {
      return '当前主要依赖角色记忆和规则知识，只能给保守建议，不能直接自动确认。';
    }

    return '当前上下文不足，这次回答只能作为保守建议，仍需人工确认与补证。';
  }

  private buildAssistantSmartQuestionsV2(
    focusObject: AiAssistantFocusObject | null,
    blockers: string[],
    citedMemories: AiMemoryReference[],
    knowledgeHints: AiKnowledgeReference[],
    manualDecisionMatches: AiManualDecisionReference[],
  ) {
    const questions = [
      '这条为什么卡在这里？',
      '当前最合理的处理动作是什么？',
      '这是单条特例还是同类模式？',
      '这条还缺什么证据？',
      '这条会不会影响绩效或工资前置？',
      '你帮我草拟一个人工裁决',
    ];

    if (focusObject?.entityType === 'points_welfare_preview') {
      questions.unshift(
        '这个月预览为什么是这些人？',
        '为什么有些员工被排除？',
        '现在适不适合创建本月员工 200 积点批量草案？',
      );
    }

    if (focusObject?.entityType === 'points_welfare_batch') {
      questions.unshift(
        '这批福利积点母单为什么创建？',
        '为什么这批命令还没执行？',
        '这批执行后会影响什么？',
        '当前还有哪些员工未执行？',
      );
    }

    if (focusObject?.entityType === 'points_welfare_batch_item') {
      questions.unshift(
        '这名员工为什么不是默认 200 积点？',
        '为什么这条被移到自定义区、暂不发区或排除区？',
        '这条判断是单条特例还是以后可参考的模式？',
        '如果现在不处理这条子项，会卡住母单哪一步？',
      );
    }

    if (focusObject?.entityType === 'points_command') {
      questions.unshift(
        '这条积点命令为什么创建？',
        '为什么这条积点命令还没执行？',
        '谁确认了这条积点命令？',
        '执行后写入了哪些积点流水？',
        '这条积点命令会不会影响绩效、B卡或福利准备？',
      );
    }

    if (focusObject?.entityType === 'abc_points_command') {
      questions.unshift(
        '这条 ABC 积分命令为什么创建？',
        '为什么这条 ABC 积分命令还没执行？',
        '谁确认了这条 ABC 积分命令？',
        '当前到底是 blocked 还是可以执行？',
        '这条是总部积点问题还是 ABC 积分问题？',
      );
    }

    if (focusObject?.entityType === 'points_redemption_request') {
      questions.unshift(
        '这条积点兑换请求为什么创建？',
        '现在卡在哪一步？',
        '是否已经在 ABC 履约？',
        '为什么还没扣积点 / 为什么已经扣积点？',
        '这条是单条特例还是以后可参考的模式？',
      );
    }

    if (focusObject?.entityType === 'approval_request_command') {
      questions.unshift(
        '这张审批单为什么存在？',
        '为什么现在能批 / 不能批？',
        '当前缺的条件到底是哪一个？',
        'verificationCode 在这一步只是提示，还是已经成了执行条件？',
        '下一步应该由谁处理？',
      );
    }

    if (focusObject?.entityType === 'payment_record_command') {
      questions.unshift(
        '这条收款记录为什么存在？',
        '为什么现在能确认 / 不能确认 / 只可查看？',
        '当前缺的条件到底是哪一个？',
        '当前“到账”依据到底是什么？',
        '下一步应该由谁处理？',
      );
    }

    if (focusObject?.label) {
      questions.unshift(`${focusObject.label} 当前最值得先核对什么？`);
    }
    if (blockers.includes('missing_customer_binding')) {
      questions.push('这条应该先做客户绑定确认，还是先暂缓？');
    }
    if (blockers.includes('sheet_missing')) {
      questions.push('这条台账漏记应先补什么证据？');
    }
    if (manualDecisionMatches.length) {
      questions.push('这条和最近人工裁决过的记录像不像？');
    }
    if (citedMemories.length) {
      questions.push('这条当前最应该引用哪条创始人记忆或岗位规则？');
    }
    if (knowledgeHints.length) {
      questions.push('这条当前最应该引用哪条规则？');
    }

    return Array.from(new Set(questions));
  }

  private buildAssistantSuggestedQuestions(
    focusObject: AiAssistantFocusObject | null,
    blockers: string[],
    citedMemories: AiMemoryReference[],
    knowledgeHints: AiKnowledgeReference[],
    manualDecisionMatches: AiManualDecisionReference[],
  ) {
    const questions = [
      '这条为什么卡在这里？',
      '当前最合理的处理动作是什么？',
      '这条会不会影响绩效或工资前置？',
      '如果我现在不处理，会卡住哪一步？',
    ];

    if (focusObject) {
      questions.unshift(`${focusObject.label} 当前最值得先核对什么？`);
    }
    if (blockers.includes('missing_customer_binding')) {
      questions.push('这条先做客户绑定确认，还是先暂缓？');
    }
    if (blockers.includes('sheet_missing')) {
      questions.push('这条台账漏记应先补什么证据？');
    }

    if (manualDecisionMatches.length) {
      questions.push('这条和最近人工裁决过的记录像不像？');
    }
    if (citedMemories.length) {
      questions.push('这条当前最应该引用哪条创始人记忆或岗位规则？');
    }
    if (knowledgeHints.length) {
      questions.push('这条当前最应该引用哪条规则？');
    }

    return Array.from(new Set(questions));
  }

  private buildAssistantReplyFocus(
    currentFocus: Record<string, unknown> | undefined,
  ): AiAssistantFocusObject | null {
    if (!currentFocus || typeof currentFocus !== 'object') {
      return null;
    }

    const keyFacts = this.readObjectArray(currentFocus, 'keyFacts')
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const record = item as Record<string, unknown>;
        const label = this.readObjectString(record, 'label');
        const value = this.readObjectString(record, 'value');
        return label && value ? { label, value } : null;
      })
      .filter((item): item is { label: string; value: string } => Boolean(item));

    return {
      entityType: this.readObjectString(currentFocus, 'entityType') ?? null,
      entityId: this.readObjectString(currentFocus, 'entityId') ?? null,
      label: this.readObjectString(currentFocus, 'label') ?? '当前焦点对象',
      subtitle: this.readObjectString(currentFocus, 'subtitle') ?? '',
      sourceTable: this.readObjectString(currentFocus, 'sourceTable') ?? null,
      sourceId: this.readObjectString(currentFocus, 'sourceId') ?? null,
      summaryType:
        (this.readObjectString(currentFocus, 'summaryType') as
          | 'performance'
          | 'business_stats'
          | null) ?? null,
      keyFacts,
      rawContext:
        this.readObjectObject(currentFocus, 'rawContext') ??
        (currentFocus as Record<string, unknown>),
    };
  }

  private buildAssistantReplyAnalysis(
    userMessage: string,
    pageContext: AiPageContextResponse,
    focusObject: AiAssistantFocusObject | null,
  ) {
    const blockers = pageContext.blockers;
    const primarySuggestion =
      blockers.includes('missing_customer_binding')
        ? 'confirm_binding'
        : blockers.includes('sheet_missing')
          ? 'sheet_repair'
          : blockers.includes('awaiting_manual_review') ||
              blockers.includes('pending_confirmation')
            ? 'manual_decision'
            : 'review_context';

    const lead = focusObject
      ? `当前聚焦对象是“${focusObject.label}”。`
      : `当前页面是“${pageContext.pageInfo.pageLabel}”，尚未选中单条对象，我会先按当前筛选结果集合来判断。`;

    const blockerText = blockers.length ? blockers.join('、') : '暂无明显阻塞';
    const evidenceText = pageContext.evidenceSummary.length
      ? pageContext.evidenceSummary.slice(0, 4).join('；')
      : '当前证据摘要较少，建议先看对象摘要与最近人工裁决。';

    let guidance =
      '当前最稳妥的做法是先继续人工核对，不建议直接跨过确认层。';
    if (primarySuggestion === 'confirm_binding') {
      guidance = '这条首先要处理客户绑定，优先核对手机号与唯一候选，再做人工确认。';
    } else if (primarySuggestion === 'sheet_repair') {
      guidance = '这条首先要补台账漏记证据，补齐后再回到统计或绩效确认。';
    } else if (primarySuggestion === 'manual_decision') {
      guidance = '这条已经具备基础证据，下一步更像是人工裁决与确认，而不是继续猜测。';
    }

    return {
      reply: `${lead} 当前阻塞：${blockerText}。证据摘要：${evidenceText}。${guidance}`,
      confidence: focusObject ? 0.91 : 0.78,
      citedContextBlocks: [
        pageContext.pageInfo.pageLabel,
        ...(focusObject ? [focusObject.label] : []),
        ...pageContext.evidenceSummary.slice(0, 3),
      ],
      suggestedActions: this.buildAssistantSuggestedActions(
        focusObject,
        blockers,
        pageContext.pageInfo.sourceActionId,
      ),
      shouldEscalateToHumanReview: primarySuggestion !== 'review_context',
      primarySuggestion,
    };
  }

  private buildAssistantCommandDraft(
    userMessage: string,
    focusObject: AiAssistantFocusObject | null,
    pageContext: AiPageContextResponse,
    primarySuggestion: string,
  ) {
    const blockers = pageContext.blockers;
    const pointsDraft = this.buildPointsAssistantCommandDraft(userMessage, focusObject, pageContext);
    if (pointsDraft) {
      return pointsDraft;
    }
    const judgmentBasis = blockers.includes('sheet_missing')
      ? ['manual_omission']
      : blockers.includes('missing_customer_binding')
        ? ['operator_experience']
        : ['other'];

    return {
      draftType:
        primarySuggestion === 'confirm_binding'
          ? 'confirm_binding'
          : primarySuggestion === 'sheet_repair'
            ? 'reclassify_record'
            : primarySuggestion === 'manual_decision'
              ? 'manual_decision'
              : 'review_context',
      targetEntity: {
        routePath: pageContext.pageInfo.routePath,
        entityType: focusObject?.entityType ?? pageContext.pageInfo.pageEntityType,
        entityId: focusObject?.entityId ?? pageContext.pageInfo.pageEntityId,
        sourceActionId: pageContext.pageInfo.sourceActionId,
        sourceTable: focusObject?.sourceTable ?? null,
        sourceId: focusObject?.sourceId ?? null,
      },
      suggestedAction:
        primarySuggestion === 'confirm_binding'
          ? '建议确认当前客户绑定'
          : primarySuggestion === 'sheet_repair'
            ? '建议先补台账漏记'
            : primarySuggestion === 'manual_decision'
              ? '建议提交人工裁决'
              : '建议继续人工核对',
      suggestedReason: blockers.join('、') || '当前证据已整理，可继续人工核对',
      suggestedScope: 'case_only',
      suggestedJudgmentBasis: judgmentBasis,
      suggestedAiLearningMode: 'do_not_generalize',
      affectPerformanceFlag: blockers.some((item) =>
        ['missing_customer_binding', 'awaiting_manual_review', 'pending_confirmation'].includes(
          item,
        ),
      ),
      affectBCardFlag: blockers.includes('sheet_missing'),
    };
  }

  private buildAssistantSmartQuestions(
    focusObject: AiAssistantFocusObject | null,
    blockers: string[],
    knowledgeHints: AiKnowledgeReference[],
    manualDecisionMatches: AiManualDecisionReference[],
  ) {
    const questions = [
      '这条为什么卡在这里？',
      '当前最合理的处理动作是什么？',
      '这是单条特例还是同类模式？',
      '这条还缺什么证据？',
      '这条会不会影响绩效或工资前置？',
      '你帮我草拟一个人工裁决',
    ];

    if (focusObject) {
      questions.unshift(`${focusObject.label} 当前最值得先核对什么？`);
    }
    if (blockers.includes('missing_customer_binding')) {
      questions.push('这条先做客户绑定确认，还是先暂缓？');
    }
    if (blockers.includes('sheet_missing')) {
      questions.push('这条台账漏记应该先补什么证据？');
    }
    if (manualDecisionMatches.length) {
      questions.push('这条和最近人工裁决过的记录像不像？');
    }
    if (knowledgeHints.length) {
      questions.push('这条当前最应该引用哪条规则？');
    }

    return Array.from(new Set(questions));
  }

  private classifyAssistantQuestionType(
    userMessage: string,
    pageContext: AiPageContextResponse,
    focusObject: AiAssistantFocusObject | null,
  ): AiAssistantQuestionType {
    const normalized = userMessage.trim().toLowerCase();
    if (
      normalized.includes('草拟') ||
      normalized.includes('裁决') ||
      normalized.includes('改绑') ||
      normalized.includes('驳回')
    ) {
      return 'draft_action';
    }
    if (
      normalized.includes('工资') ||
      normalized.includes('绩效') ||
      normalized.includes('payroll')
    ) {
      return 'can_affect_payroll';
    }
    if (
      normalized.includes('特例') ||
      normalized.includes('同类') ||
      normalized.includes('模式') ||
      normalized.includes('像不像')
    ) {
      return 'same_or_special_case';
    }
    if (
      normalized.includes('缺什么') ||
      normalized.includes('还缺') ||
      normalized.includes('缺少') ||
      normalized.includes('证据')
    ) {
      return 'what_missing';
    }
    if (
      normalized.includes('规则') ||
      normalized.includes('口径') ||
      normalized.includes('为什么这样判断')
    ) {
      return 'explain_rule';
    }
    if (
      normalized.includes('为什么') ||
      normalized.includes('卡在') ||
      normalized.includes('阻塞')
    ) {
      return 'why_blocked';
    }
    if (
      normalized.includes('怎么办') ||
      normalized.includes('怎么做') ||
      normalized.includes('下一步') ||
      normalized.includes('处理动作')
    ) {
      return 'what_to_do';
    }

    if (pageContext.blockers.length || focusObject) {
      return 'what_to_do';
    }

    return 'explain_rule';
  }

  private buildAssistantBasisSummaryV2(
    pageContext: AiPageContextResponse,
    citedMemories: AiMemoryReference[],
    citedKnowledge: AiKnowledgeReference[],
    citedManualDecisions: AiManualDecisionReference[],
  ) {
    const parts: string[] = [];
    if (citedManualDecisions.length) {
      parts.push(
        `直接/相似人审依据 ${citedManualDecisions.length} 条，例如：${citedManualDecisions
          .slice(0, 2)
          .map((item) => item.summary)
          .join('；')}`,
      );
    } else {
      parts.push('当前没有直接可复用的人审结论，只能先按规则和记忆给建议。');
    }

    const founderMemories = citedMemories.filter((item) => item.memoryBucket === 'founder');
    if (founderMemories.length) {
      parts.push(`创始人原则：${founderMemories.map((item) => item.title).slice(0, 3).join('、')}`);
    }

    const roleMemories = citedMemories.filter((item) => item.memoryBucket === 'role');
    if (roleMemories.length) {
      parts.push(`岗位规则：${roleMemories.map((item) => item.title).slice(0, 3).join('、')}`);
    }

    if (citedKnowledge.length) {
      parts.push(`通用规则：${citedKnowledge.map((item) => item.title).join('、')}`);
    }

    if (pageContext.evidenceSummary.length) {
      parts.push(`当前证据：${pageContext.evidenceSummary.slice(0, 4).join('；')}`);
    }

    return parts.join(' ');
  }

  private resolveAssistantConfidenceLevelV2(
    citedManualDecisions: AiManualDecisionReference[],
    citedMemories: AiMemoryReference[],
    citedKnowledge: AiKnowledgeReference[],
    missingContext: string[],
  ): AiAssistantConfidenceLevel {
    if (citedManualDecisions.some((item) => item.matchType === 'direct') && missingContext.length === 0) {
      return 'high';
    }
    if ((citedManualDecisions.length || citedMemories.length || citedKnowledge.length) && missingContext.length <= 1) {
      return 'medium';
    }
    return 'low';
  }

  private buildStructuredAssistantReplyAnalysisV2(
    _userMessage: string,
    pageContext: AiPageContextResponse,
    focusObject: AiAssistantFocusObject | null,
    questionType: AiAssistantQuestionType,
    policyContext: AiSuggestedActionPolicyContext = {},
  ) {
    const blockers = pageContext.blockers;
    const primarySuggestion =
      blockers.includes('missing_customer_binding')
        ? 'confirm_binding'
        : blockers.includes('sheet_missing')
          ? 'sheet_repair'
          : blockers.includes('awaiting_manual_review') ||
              blockers.includes('pending_confirmation')
            ? 'manual_decision'
            : 'review_context';

    const missingContext = this.collectAssistantMissingContext(pageContext, focusObject);
    const citedMemories = pageContext.citedMemories.slice(0, 4);
    const citedKnowledge = pageContext.knowledgeHints.slice(0, 3);
    const citedManualDecisions = pageContext.manualDecisionMatches.slice(0, 3);
    const memoryInfluenceSummary =
      pageContext.memoryInfluenceSummary ||
      this.buildMemoryInfluenceSummaryV2(
        pageContext.manualDecisionMatches,
        pageContext.founderMemories,
        pageContext.roleMemories,
        pageContext.knowledgeHints,
      );
    const founderPrinciplesApplied =
      pageContext.founderPrinciplesApplied.length > 0
        ? pageContext.founderPrinciplesApplied
        : pageContext.founderMemories.map((item) => item.title);
    const rolePlaybookApplied =
      pageContext.rolePlaybookApplied.length > 0
        ? pageContext.rolePlaybookApplied
        : pageContext.roleMemories.map((item) => item.title);
    const generalizationBoundary =
      pageContext.generalizationBoundary ||
      this.buildGeneralizationBoundaryV2(
        pageContext.manualDecisionMatches,
        pageContext.founderMemories,
        pageContext.roleMemories,
        pageContext.knowledgeHints,
      );

    const answerSections: AiAssistantAnswerSection[] = [
      {
        sectionKey: 'current_judgment',
        title: '当前判断',
        content: this.buildAssistantCurrentJudgment(questionType, pageContext, focusObject),
      },
      {
        sectionKey: 'basis',
        title: '判断依据',
        content: this.buildAssistantBasisSummaryV2(
          pageContext,
          citedMemories,
          citedKnowledge,
          citedManualDecisions,
        ),
      },
      {
        sectionKey: 'memory_mode',
        title: '为什么这样回答',
        content: memoryInfluenceSummary,
      },
      {
        sectionKey: 'next_action',
        title: '建议动作',
        content: this.buildAssistantNextActionSummary(primarySuggestion, blockers, questionType),
      },
      {
        sectionKey: 'boundary',
        title: '泛化边界',
        content: `${this.buildAssistantBoundarySummary(missingContext)} ${generalizationBoundary}`,
      },
    ];

    const confidenceLevel = this.resolveAssistantConfidenceLevelV2(
      citedManualDecisions,
      citedMemories,
      citedKnowledge,
      missingContext,
    );
    const confidence =
      confidenceLevel === 'high' ? 0.93 : confidenceLevel === 'medium' ? 0.78 : 0.58;
    const rawSuggestedActions = this.buildAssistantSuggestedActionsRaw(
      focusObject,
      blockers,
      pageContext.pageInfo.sourceActionId,
    );
    const suggestedActionsPolicy = this.buildSuggestedActionsPolicyForAssistantOutput({
      rawSuggestedActions,
      focusObject,
      blockers,
      sourceActionId: pageContext.pageInfo.sourceActionId,
      policyContext,
    });

    return {
      reply: answerSections.map((item) => `${item.title}：${item.content}`).join('\n\n'),
      confidence,
      confidenceLevel,
      answerSections,
      citedContextBlocks: [
        pageContext.pageInfo.pageLabel,
        ...(focusObject ? [focusObject.label] : []),
        ...pageContext.evidenceSummary.slice(0, 3),
      ],
      citedKnowledge,
      citedManualDecisions,
      citedMemories,
      memoryInfluenceSummary,
      founderPrinciplesApplied,
      rolePlaybookApplied,
      generalizationBoundary,
      missingContext,
      suggestedActions: suggestedActionsPolicy.allowedSuggestedActions,
      suggestedActionsPolicyTrace: suggestedActionsPolicy.suggestedActionsPolicyTrace,
      blockedSuggestedActions: suggestedActionsPolicy.blockedSuggestedActions,
      suggestedCommandDraftPolicy: suggestedActionsPolicy.suggestedCommandDraftPolicy,
      boundaryExplanations: suggestedActionsPolicy.boundaryExplanations,
      taskDraftReviewArtifacts: suggestedActionsPolicy.taskDraftReviewArtifacts,
      taskDraftReviewArtifactSummary:
        suggestedActionsPolicy.taskDraftReviewArtifactSummary,
      taskDraftReviewPolicyTrace: suggestedActionsPolicy.taskDraftReviewPolicyTrace,
      taskDraftReviewReadAuditViews:
        suggestedActionsPolicy.taskDraftReviewReadAuditViews,
      taskDraftReviewReadAuditSummary:
        suggestedActionsPolicy.taskDraftReviewReadAuditSummary,
      manualTaskBridgeCandidates:
        suggestedActionsPolicy.manualTaskBridgeCandidates,
      manualTaskBridgeCandidateSummary:
        suggestedActionsPolicy.manualTaskBridgeCandidateSummary,
      manualTaskBridgeDispatchReadiness:
        suggestedActionsPolicy.manualTaskBridgeDispatchReadiness,
      manualTaskBridgeDispatchReadinessSummary:
        suggestedActionsPolicy.manualTaskBridgeDispatchReadinessSummary,
      manualTaskBridgeEmployeeHandoffPreviews:
        suggestedActionsPolicy.manualTaskBridgeEmployeeHandoffPreviews,
      manualTaskBridgeEmployeeHandoffPreviewSummary:
        suggestedActionsPolicy.manualTaskBridgeEmployeeHandoffPreviewSummary,
      shouldEscalateToHumanReview:
        primarySuggestion !== 'review_context' || missingContext.length > 0,
      primarySuggestion,
    };
  }

  private buildStructuredAssistantReplyAnalysis(
    _userMessage: string,
    pageContext: AiPageContextResponse,
    focusObject: AiAssistantFocusObject | null,
    questionType: AiAssistantQuestionType,
  ) {
    const blockers = pageContext.blockers;
    const primarySuggestion =
      blockers.includes('missing_customer_binding')
        ? 'confirm_binding'
        : blockers.includes('sheet_missing')
          ? 'sheet_repair'
          : blockers.includes('awaiting_manual_review') ||
              blockers.includes('pending_confirmation')
            ? 'manual_decision'
            : 'review_context';

    const missingContext = this.collectAssistantMissingContext(pageContext, focusObject);
    const citedKnowledge = pageContext.knowledgeHints.slice(0, 3);
    const citedManualDecisions = pageContext.manualDecisionMatches.slice(0, 3);
    const answerSections: AiAssistantAnswerSection[] = [
      {
        sectionKey: 'current_judgment',
        title: '当前判断',
        content: this.buildAssistantCurrentJudgment(questionType, pageContext, focusObject),
      },
      {
        sectionKey: 'basis',
        title: '判断依据',
        content: this.buildAssistantBasisSummary(
          pageContext,
          citedKnowledge,
          citedManualDecisions,
        ),
      },
      {
        sectionKey: 'next_action',
        title: '建议动作',
        content: this.buildAssistantNextActionSummary(primarySuggestion, blockers, questionType),
      },
      {
        sectionKey: 'boundary',
        title: '处理边界',
        content: this.buildAssistantBoundarySummary(missingContext),
      },
    ];

    const confidenceLevel = this.resolveAssistantConfidenceLevel(
      citedManualDecisions,
      citedKnowledge,
      missingContext,
    );
    const confidence =
      confidenceLevel === 'high' ? 0.93 : confidenceLevel === 'medium' ? 0.78 : 0.58;

    return {
      reply: answerSections.map((item) => `${item.title}：${item.content}`).join('\n\n'),
      confidence,
      confidenceLevel,
      answerSections,
      citedContextBlocks: [
        pageContext.pageInfo.pageLabel,
        ...(focusObject ? [focusObject.label] : []),
        ...pageContext.evidenceSummary.slice(0, 3),
      ],
      citedKnowledge,
      citedManualDecisions,
      missingContext,
      suggestedActions: this.buildAssistantSuggestedActions(
        focusObject,
        blockers,
        pageContext.pageInfo.sourceActionId,
      ),
      shouldEscalateToHumanReview:
        primarySuggestion !== 'review_context' || missingContext.length > 0,
      primarySuggestion,
    };
  }

  private buildStructuredAssistantCommandDraft(
    userMessage: string,
    focusObject: AiAssistantFocusObject | null,
    pageContext: AiPageContextResponse,
    primarySuggestion: string,
    questionType: AiAssistantQuestionType,
    policyContext: AiSuggestedActionPolicyContext = {},
  ) {
    return this.buildStructuredAssistantCommandDraftPolicyResult(
      userMessage,
      focusObject,
      pageContext,
      primarySuggestion,
      questionType,
      policyContext,
    ).suggestedCommandDraft;
  }

  private buildStructuredAssistantCommandDraftPolicyResult(
    userMessage: string,
    focusObject: AiAssistantFocusObject | null,
    pageContext: AiPageContextResponse,
    primarySuggestion: string,
    questionType: AiAssistantQuestionType,
    policyContext: AiSuggestedActionPolicyContext = {},
  ): AiSuggestedActionPolicyApplication {
    const rawDraft = this.buildAssistantCommandDraft(
      userMessage,
      focusObject,
      pageContext,
      primarySuggestion,
    );
    return this.buildSuggestedCommandDraftPolicyForAssistantOutput({
      rawSuggestedCommandDraft: rawDraft,
      focusObject,
      pageContext,
      primarySuggestion,
      questionType,
      currentUserRoleCodes: policyContext.currentUserRoleCodes ?? null,
    });
  }

  private collectAssistantMissingContext(
    pageContext: AiPageContextResponse,
    focusObject: AiAssistantFocusObject | null,
  ) {
    const missing = new Set<string>();
    const rawContext = (focusObject?.rawContext ?? {}) as Record<string, unknown>;
    const customerIdentity = this.readObjectObject(rawContext, 'customerIdentity');
    const payment = this.readObjectObject(rawContext, 'paymentAndReconciliation');
    const bundle = this.readObjectObject(rawContext, 'productAndBundle');

    if (focusObject?.entityType === 'points_welfare_preview') {
      const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
      const previewSummary = this.readObjectObject(rawContext, 'previewSummary');
      const targetEmployeeCount = this.readObjectNumber(basicInfo, 'targetEmployeeCount');
      const warnings = this.readObjectArray(previewSummary, 'warnings').filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
      if (!targetEmployeeCount) {
        missing.add('当前周期没有可纳入福利草案的员工');
      }
      if (warnings.length) {
        missing.add('仍有排除或冲突原因需要人工核对');
      }
      return Array.from(missing);
    }

    if (focusObject?.entityType === 'points_welfare_batch') {
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const ledgerImpact = this.readObjectObject(rawContext, 'ledgerImpact');
      const batchStatus = this.readObjectString(statusInfo, 'batchStatus');
      const relatedLedgerCount = this.readObjectNumber(ledgerImpact, 'relatedLedgerCount') ?? 0;
      if (batchStatus === 'drafted') {
        missing.add('缺少人工确认后的正式执行许可');
      }
      if (batchStatus === 'confirmed' && relatedLedgerCount === 0) {
        missing.add('缺少执行后的积点账本写入结果');
      }
      if (batchStatus === 'partially_executed') {
        missing.add('仍有部分子命令未执行或失败');
      }
      if (!pageContext.citedMemories.length && !pageContext.manualDecisionMatches.length) {
        missing.add('缺少直接人审或记忆依据');
      }
      return Array.from(missing);
    }

    if (focusObject?.entityType === 'points_command') {
      const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
      const ledgerImpact = this.readObjectObject(rawContext, 'ledgerImpact');
      if (
        !this.readObjectString(ownerInfo, 'ownerMobile') &&
        this.readObjectNumber(ownerInfo, 'ownerId') === null
      ) {
        missing.add('缺少稳定积点对象标识');
      }
      const commandStatus = this.readObjectString(statusInfo, 'commandStatus');
      if (commandStatus === 'drafted') {
        missing.add('缺少人工确认后的正式执行许可');
      }
      if (commandStatus === 'confirmed' && this.readObjectNumber(ledgerImpact, 'ledgerEntryCount') === 0) {
        missing.add('缺少执行后的积点账本写入结果');
      }
      if (!this.readObjectString(sourceInfo, 'sourceType')) {
        missing.add('缺少清晰的积点来源类型');
      }
      if (!pageContext.manualDecisionMatches.length && !pageContext.citedMemories.length) {
        missing.add('缺少直接人审或记忆依据');
      }
      return Array.from(missing);
    }

    if (focusObject?.entityType === 'abc_points_command') {
      const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
      if (
        !this.readObjectString(ownerInfo, 'ownerMobile') &&
        this.readObjectNumber(ownerInfo, 'ownerId') === null
      ) {
        missing.add('缺少稳定 ABC 积分对象标识');
      }
      const commandStatus = this.readObjectString(statusInfo, 'commandStatus');
      if (commandStatus === 'drafted') {
        missing.add('缺少人工确认后的正式执行许可');
      }
      if (commandStatus === 'confirmed') {
        missing.add('仍需核查 ABC 积分写入路径是否稳定');
      }
      if (commandStatus === 'blocked') {
        missing.add('当前 ABC 积分写入路径未稳定，只能保留 blocked 审计');
      }
      if (!this.readObjectString(sourceInfo, 'sourceType')) {
        missing.add('缺少清晰的 ABC 积分来源类型');
      }
      if (!pageContext.citedMemories.length && !pageContext.manualDecisionMatches.length) {
        missing.add('缺少直接人审或记忆依据');
      }
      return Array.from(missing);
    }

    if (focusObject?.entityType === 'points_welfare_batch_item') {
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const approvalInfo = this.readObjectObject(rawContext, 'approvalInfo');
      const allocationMode = this.readObjectString(statusInfo, 'allocationMode');
      const finalAmount = this.readObjectString(statusInfo, 'finalAmount');
      const adjustmentRemark = this.readObjectString(statusInfo, 'adjustmentRemark');
      const exclusionReason = this.readObjectString(statusInfo, 'exclusionReason');
      const childCommandStatus = this.readObjectString(statusInfo, 'childCommandStatus');
      const decisionScope = this.readObjectString(statusInfo, 'decisionScope');
      const aiLearningMode = this.readObjectString(statusInfo, 'aiLearningMode');

      if (allocationMode === 'custom' && (!finalAmount || finalAmount === '0.00')) {
        missing.add('自定义发放区缺少有效的最终积点');
      }
      if (allocationMode === 'custom' && !adjustmentRemark) {
        missing.add('自定义发放区缺少调整说明');
      }
      if (allocationMode === 'hold' && !adjustmentRemark) {
        missing.add('暂不发放区缺少留后处理说明');
      }
      if (allocationMode === 'excluded' && !exclusionReason) {
        missing.add('自动排除区缺少排除原因');
      }
      if (['default', 'custom'].includes(allocationMode ?? '') && !childCommandStatus) {
        missing.add('默认/自定义发放区缺少稳定子命令');
      }
      if (!decisionScope || !aiLearningMode) {
        missing.add('缺少这条子项的泛化边界说明');
      }
      if (!this.readObjectString(approvalInfo, 'decidedAt')) {
        missing.add('缺少最近一次人工决定时间');
      }

      return Array.from(missing);
    }

    if (focusObject?.entityType === 'points_redemption_request') {
      const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
      const ledgerImpact = this.readObjectObject(rawContext, 'ledgerImpact');
      const ownerId = this.readObjectNumber(ownerInfo, 'ownerId');
      const ownerMobile =
        this.readObjectString(ownerInfo, 'ownerMobileRaw') ??
        this.readObjectString(ownerInfo, 'ownerMobile');
      const requestStatus = this.readObjectString(statusInfo, 'requestStatus');
      const externalEntityId = this.readObjectString(sourceInfo, 'externalEntityId');
      const externalNo = this.readObjectString(sourceInfo, 'externalNo');
      const ledgerCount = this.readObjectNumber(ledgerImpact, 'ledgerEntryCount') ?? 0;

      if (!ownerId && !ownerMobile) {
        missing.add('缺少稳定兑换对象标识');
      }
      if (requestStatus === 'drafted') {
        missing.add('缺少人工确认后的正式兑换许可');
      }
      if (
        ['confirmed', 'pending_fulfillment', 'fulfilled_in_abc'].includes(requestStatus ?? '') &&
        !externalEntityId &&
        !externalNo
      ) {
        missing.add('缺少 ABC 履约凭据');
      }
      if (
        ['fulfilled_in_abc', 'completed'].includes(requestStatus ?? '') &&
        ledgerCount === 0
      ) {
        missing.add('缺少总部积点 consume 流水');
      }
      if (!pageContext.manualDecisionMatches.length && !pageContext.citedMemories.length) {
        missing.add('缺少直接人审或记忆依据');
      }

      return Array.from(missing);
    }

    if (focusObject?.entityType === 'approval_request_command') {
      const approvalInfo = this.readObjectObject(rawContext, 'approvalInfo');
      const linkedBusinessContext = this.readObjectObject(rawContext, 'linkedBusinessContext');
      const linkedPayout = this.readObjectObject(rawContext, 'linkedPayout');
      const handlingPlan = this.readObjectObject(rawContext, 'handlingPlan');
      const precheck = this.readObjectObject(rawContext, 'approvalPrecheck');
      const diagnosis = this.readObjectObject(handlingPlan, 'diagnosis');
      const status = this.readObjectString(approvalInfo, 'status');
      const workOrderNo = this.readObjectString(linkedBusinessContext, 'workOrderNo');
      const paymentRecordCount = this.readObjectNumber(linkedBusinessContext, 'paymentRecordCount') ?? 0;
      const linkedPayoutState = this.readObjectString(precheck, 'linkedPayoutState');

      if (!workOrderNo) {
        missing.add('缺少真实工单上下文，当前审批单无法被当成有效命令对象解释');
      }
      if (status === 'pending' && !this.readObjectBoolean(precheck, 'actorAllowed')) {
        missing.add('当前角色没有 approve / reject 权限，只能先看 handlingPlan 收口版');
      }
      if (status === 'approved' && linkedPayoutState !== 'already_executed') {
        missing.add('审批已通过但付款留痕尚未补齐');
      }
      if (status === 'pending' && paymentRecordCount === 0) {
        missing.add('当前收款上下文仍较弱，建议先人工复核工单收款留痕');
      }
      if (!this.readObjectString(diagnosis, 'verificationCodeRole')) {
        missing.add('缺少 verificationCode 在当前阶段的作用说明');
      }
      if (!pageContext.manualDecisionMatches.length && !pageContext.citedMemories.length) {
        missing.add('当前缺少可复用的人审或记忆依据，只能保守解释');
      }

      return Array.from(missing);
    }

    if (focusObject?.entityType === 'payment_record_command') {
      const paymentInfo = this.readObjectObject(rawContext, 'paymentInfo');
      const linkedWorkOrder = this.readObjectObject(rawContext, 'linkedWorkOrder');
      const handlingPlan = this.readObjectObject(rawContext, 'handlingPlan');
      const paymentPrecheck = this.readObjectObject(rawContext, 'paymentPrecheck');
      const diagnosis = this.readObjectObject(handlingPlan, 'diagnosis');
      const paymentStatus = this.readObjectString(paymentInfo, 'paymentStatus');
      const workOrderNo = this.readObjectString(linkedWorkOrder, 'workOrderNo');

      if (!workOrderNo) {
        missing.add('缺少真实工单上下文，当前收款记录还不能被当作有效到账对象解释');
      }
      if (paymentStatus === 'pending' && !this.readObjectBoolean(paymentPrecheck, 'actorAllowed')) {
        missing.add('当前角色不能继续处理到账确认，只能先看 handlingPlan 收口版');
      }
      if (paymentStatus === 'pending' && !this.readObjectBoolean(paymentPrecheck, 'paymentStatusAllowsFinalize')) {
        missing.add('当前 paymentStatus 还不满足继续确认到账的前置条件');
      }
      if (!this.readObjectString(diagnosis, 'currentArrivalBasis')) {
        missing.add('缺少当前仓库到账依据的解释，无法说明为什么这条记录现在能 / 不能确认');
      }
      if (!pageContext.manualDecisionMatches.length && !pageContext.citedMemories.length) {
        missing.add('当前缺少可复用的人审或记忆依据，只能做保守解释');
      }

      return Array.from(missing);
    }

    const customerBinding = this.readObjectObject(customerIdentity, 'customerBinding');
    const bindingStatus = this.readObjectString(customerBinding, 'bindingStatus');
    if (!this.readObjectString(customerIdentity, 'customerMobile')) {
      missing.add('缺少稳定手机号');
    }
    if (bindingStatus === 'manual_pending' || bindingStatus === 'conflict') {
      missing.add('缺少人工确认后的正式客户绑定');
    }
    if (!this.readObjectString(payment, 'paymentStatus')) {
      missing.add('缺少稳定支付状态');
    }
    if (
      this.readObjectString(payment, 'reconciliationStatus') === 'sheet_missing' &&
      !this.readObjectString(bundle, 'linkedPaidAAmount')
    ) {
      missing.add('缺少台账漏记对应的已支付证据补充');
    }
    if (!pageContext.manualDecisionMatches.length && pageContext.blockers.length) {
      missing.add('缺少同类人工裁决参考');
    }

    return Array.from(missing);
  }

  private buildAssistantCurrentJudgment(
    questionType: AiAssistantQuestionType,
    pageContext: AiPageContextResponse,
    focusObject: AiAssistantFocusObject | null,
  ) {
    const label = focusObject?.label ?? pageContext.pageInfo.pageLabel;
    const blockerText = pageContext.blockers.length
      ? pageContext.blockers.join('、')
      : '暂无明显阻塞';

    const rawContext = (focusObject?.rawContext ?? {}) as Record<string, unknown>;

    if (focusObject?.entityType === 'points_welfare_preview') {
      const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const previewSummary = this.readObjectObject(rawContext, 'previewSummary');
      const periodKey = this.readObjectString(basicInfo, 'periodKey') ?? '当前周期';
      const targetEmployeeCount = this.readObjectNumber(basicInfo, 'targetEmployeeCount') ?? 0;
      const targetTotalAmount = this.readObjectString(basicInfo, 'targetTotalAmount') ?? '0.00';
      const latestBatchId = this.readObjectNumber(statusInfo, 'latestBatchId');
      const latestBatchStatus = this.readObjectString(statusInfo, 'batchStatus');
      const warnings = this.readObjectArray(previewSummary, 'warnings').filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );

      switch (questionType) {
        case 'why_blocked':
          return `${label} 当前主要卡在 ${blockerText}。如果当前周期已经存在福利积点母单、或员工手机号冲突未收口，就不能继续重复创建草案。`;
        case 'what_missing':
          return `${label} 当前至少还要确认“可纳入员工名单是否准确、排除原因是否已收口、当前周期是否已存在有效母单”。`;
        case 'draft_action':
          return `${label} 当前最合理的动作，是先生成本月员工 200 积点批量草案母单，再交由高权限人工确认后执行。`;
        case 'same_or_special_case':
          return `${label} 属于 employee_monthly_welfare 的固定福利场景，但当前仍要区分“本月批量规则”与“个别排除员工”的单条特例。`;
        case 'can_affect_payroll':
          return `${label} 属于员工福利积点发放准备，不会直接推进正式工资，也不会改变 payroll included/pending/excluded 边界。`;
        case 'what_to_do':
        default:
          return `${label} 当前周期 ${periodKey} 共有 ${targetEmployeeCount} 名员工可纳入福利草案，建议总积点 ${targetTotalAmount}${latestBatchId ? `；当前已有母单 #${latestBatchId}${latestBatchStatus ? ` / ${latestBatchStatus}` : ''}` : ''}${warnings.length ? `；仍需注意：${warnings.slice(0, 2).join('；')}` : ''}。`;
      }
    }

    if (focusObject?.entityType === 'points_welfare_batch') {
      const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const approvalInfo = this.readObjectObject(rawContext, 'approvalInfo');
      const ledgerImpact = this.readObjectObject(rawContext, 'ledgerImpact');
      const batchStatus = this.readObjectString(statusInfo, 'batchStatus') ?? 'unknown';
      const periodKey = this.readObjectString(basicInfo, 'periodKey') ?? '当前周期';
      const targetEmployeeCount = this.readObjectNumber(statusInfo, 'targetEmployeeCount') ?? 0;
      const targetTotalAmount = this.readObjectString(statusInfo, 'targetTotalAmount') ?? '0.00';
      const relatedLedgerCount = this.readObjectNumber(ledgerImpact, 'relatedLedgerCount') ?? 0;
      const confirmedByName = this.readObjectString(approvalInfo, 'confirmedByName');
      const executedByName = this.readObjectString(approvalInfo, 'executedByName');

      switch (questionType) {
        case 'why_blocked':
          return `${label} 当前状态是 ${batchStatus}，主要阻塞项是 ${blockerText}。福利积点母单必须继续走“预览 -> 草案 -> 人工确认 -> 执行 -> ledger 留痕”的链路，不能跳过人工确认层。`;
        case 'what_missing':
          return `${label} 当前至少还要补齐“确认人、执行结果、失败子项说明、关联 ledger”中的缺口，才能把这条批次解释清楚。`;
        case 'same_or_special_case':
          return `${label} 属于 employee_monthly_welfare 的月度批次场景，本身可作为同类流程参考，但排除名单、失败子项和取消原因仍可能是单条特例。`;
        case 'can_affect_payroll':
          return `${label} 当前属于员工福利积点发放链，不会直接推进正式工资，也不会把福利积点当成现金收入。`;
        case 'draft_action':
          return `${label} 当前最合理的动作，是按 ${batchStatus} 对应下一步继续人工处理：草案要确认，已确认要执行，部分执行要先核对剩余子项。`;
        case 'what_to_do':
        default:
          return `${label} 当前周期 ${periodKey}，目标 ${targetEmployeeCount} 人 / ${targetTotalAmount} 积点，当前状态 ${batchStatus}${confirmedByName ? `；确认人：${confirmedByName}` : ''}${executedByName ? `；执行人：${executedByName}` : ''}${relatedLedgerCount ? `；已写入 ${relatedLedgerCount} 条积点流水` : ''}。`;
      }
    }

    if (focusObject?.entityType === 'points_command') {
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
      const approvalInfo = this.readObjectObject(rawContext, 'approvalInfo');
      const ledgerImpact = this.readObjectObject(rawContext, 'ledgerImpact');
      const commandStatus = this.readObjectString(statusInfo, 'commandStatus') ?? 'unknown';
      const sourceType = this.readObjectString(sourceInfo, 'sourceType') ?? 'other';
      const requestSource = this.readObjectString(sourceInfo, 'requestSource') ?? 'manual';
      const ledgerCount = this.readObjectNumber(ledgerImpact, 'relatedLedgerCount') ?? 0;
      const latestBalanceAfter = this.readObjectString(ledgerImpact, 'latestBalanceAfter');
      const confirmedByName = this.readObjectString(approvalInfo, 'confirmedByName');
      const executedByName = this.readObjectString(approvalInfo, 'executedByName');

      switch (questionType) {
        case 'why_blocked':
          return `${label} 当前状态是 ${commandStatus}，主要阻塞项是 ${blockerText}。这条积点命令必须继续走“草稿 -> 人工确认 -> 执行 -> 账本留痕”的链路，不能越过人工确认边界。`;
        case 'can_affect_payroll':
          return `${label} 当前属于积点命令链，不会直接推进正式工资。它最多只会影响后续绩效、B卡或福利前置准备，仍需人工确认后才能进入下一步。`;
        case 'same_or_special_case':
          return `${label} 当前来源类型是 ${sourceType}，草拟来源是 ${requestSource}。它是否可推广，要看直接人审、创始人记忆和岗位规则是否允许泛化；在此之前只能作为建议。`;
        case 'what_missing':
          return `${label} 当前至少要补齐“确认人、执行人、关联流水、规则依据”中的缺口。若还没有 ledger 或确认记录，就只能继续保守处理。`;
        case 'draft_action':
          return `${label} 当前最合理的命令草稿方向，是先明确来源类型、原因短码以及是否影响绩效/B卡，再交由高权限人工确认。`;
        case 'explain_rule':
          return `${label} 当前应优先引用创始人原则、岗位规则和直接/相似人审，再结合积点账本来解释，不能把 AI 建议当成自动执行依据。`;
        case 'what_to_do':
        default:
          return `${label} 当前最合理的处理动作是先看 ${commandStatus} 对应的下一步：${
            commandStatus === 'drafted'
              ? '确认命令'
              : commandStatus === 'confirmed'
                ? '执行命令并核对积点账本'
                : commandStatus === 'executed'
                  ? '回看 ledger、确认余额和影响面'
                  : commandStatus === 'cancelled'
                    ? '确认是否需要重新草拟'
                    : '先核对命令状态与执行轨迹'
          }。当前已关联 ${ledgerCount} 条积点流水${latestBalanceAfter ? `，最新余额 ${latestBalanceAfter}` : ''}${confirmedByName ? `；确认人：${confirmedByName}` : ''}${executedByName ? `；执行人：${executedByName}` : ''}。`;
      }
    }

    if (focusObject?.entityType === 'abc_points_command') {
      const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
      const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
      const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const approvalInfo = this.readObjectObject(rawContext, 'approvalInfo');
      const handlingPlan = this.readObjectObject(rawContext, 'handlingPlan');
      const handlingPlanDiagnosis = this.readObjectObject(handlingPlan, 'diagnosis');
      const handlingPlanBoundary = this.readObjectObject(handlingPlan, 'boundary');
      const handlingPlanActionItems = this.readObjectArray(handlingPlan, 'actionItems').filter(
        (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
      );
      const commandStatus = this.readObjectString(statusInfo, 'commandStatus') ?? 'unknown';
      const sourceType = this.readObjectString(sourceInfo, 'sourceType') ?? 'other';
      const requestSource = this.readObjectString(sourceInfo, 'requestSource') ?? 'manual';
      const confirmedByName = this.readObjectString(approvalInfo, 'confirmedByName');
      const executedByName = this.readObjectString(approvalInfo, 'executedByName');
      const ownerMobile =
        this.readObjectString(ownerInfo, 'ownerMobile') ??
        this.readObjectString(ownerInfo, 'ownerMobileRaw') ??
        '-';
      const changeAmount = this.readObjectString(basicInfo, 'changeAmount') ?? '-';
      const planSummary =
        this.readObjectString(handlingPlan, 'summary') ??
        `${label} 当前状态是 ${commandStatus}。`;
      const planListSummary =
        this.readObjectString(handlingPlan, 'listSummary') ?? '请继续按 handlingPlan 收口版处理。';
      const primaryActionItem =
        handlingPlanActionItems.find((item) =>
          ['blocked', 'pending', 'ready'].includes(
            this.readObjectString(item, 'status') ?? '',
          ),
        ) ?? handlingPlanActionItems[0] ?? null;
      const primaryAction = primaryActionItem
        ? `${this.readObjectString(primaryActionItem, 'title') ?? '当前动作'}：${
            this.readObjectString(primaryActionItem, 'description') ?? planListSummary
          }`
        : planListSummary;
      const suggestedNextStep =
        this.readObjectString(handlingPlanDiagnosis, 'suggestedNextStep') ??
        '当前仍需人工继续核对。';
      const payrollBoundary =
        this.readObjectString(handlingPlanBoundary, 'payrollBoundary') ??
        '不会自动进入正式工资结论。';
      const generalizationBoundary =
        this.readObjectString(handlingPlanBoundary, 'generalizationBoundary') ??
        '当前不能自动泛化。';
      const boundarySummary = [
        this.readObjectString(handlingPlanBoundary, 'executionBoundary'),
        this.readObjectString(handlingPlanBoundary, 'humanConfirmationBoundary'),
        payrollBoundary,
        generalizationBoundary,
      ]
        .filter((item): item is string => Boolean(item && item.trim()))
        .join('；');

      switch (questionType) {
        case 'why_blocked':
          return `${label} 当前处理单摘要是：${planSummary}。主要阻塞项已统一收在 handlingPlan 中，当前应先按“${primaryAction}”继续处理，不能绕回手工改库。`;
        case 'can_affect_payroll':
          return `${label} 当前工资边界是：${payrollBoundary}`;
        case 'same_or_special_case':
          return `${label} 当前来源类型是 ${sourceType}，草拟来源是 ${requestSource}，对象手机号是 ${ownerMobile}。泛化边界以 handlingPlan 为准：${generalizationBoundary}`;
        case 'what_missing':
          return `${label} 当前仍缺少的关键动作已经收在处理单里：${primaryAction}；${suggestedNextStep}`;
        case 'draft_action':
          return `${label} 当前最合理的命令草稿方向，是先明确 ABC 积分来源类型、原因短码和对象标识，再交由高权限人工确认。`;
        case 'explain_rule':
          return `${label} 当前应优先用 handlingPlan 的当前状态摘要、动作清单和边界说明解释，再补充创始人原则、岗位规则与直接/相似人审依据。`;
        case 'what_to_do':
        default:
          return `${label} 当前属于 ABC 积分命令，变动 ${changeAmount}，状态 ${commandStatus}。当前状态摘要：${planSummary}。谁处理 / 怎么处理：${primaryAction}。何时可重试：${suggestedNextStep}${confirmedByName ? `；确认人：${confirmedByName}` : ''}${executedByName ? `；最近执行人：${executedByName}` : ''}${boundarySummary ? `。边界说明：${boundarySummary}` : ''}。`;
      }
    }

    if (focusObject?.entityType === 'points_redemption_request') {
      const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
      const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
      const sourceInfo = this.readObjectObject(rawContext, 'sourceInfo');
      const statusInfo = this.readObjectObject(rawContext, 'statusInfo');
      const approvalInfo = this.readObjectObject(rawContext, 'approvalInfo');
      const ledgerImpact = this.readObjectObject(rawContext, 'ledgerImpact');
      const requestStatus = this.readObjectString(statusInfo, 'requestStatus') ?? 'unknown';
      const reconciliationStatus =
        this.readObjectString(statusInfo, 'reconciliationStatus') ?? 'unknown';
      const reconciliationReason =
        this.readObjectString(statusInfo, 'reconciliationReason') ?? '未提供';
      const exceptionFlags = this.readObjectArray(statusInfo, 'exceptionFlags').filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
      const redeemableName =
        this.readObjectString(basicInfo, 'redeemableName') ?? 'ABC 购物卡';
      const ownerMobile =
        this.readObjectString(ownerInfo, 'ownerMobile') ??
        this.readObjectString(ownerInfo, 'ownerMobileRaw') ??
        '-';
      const externalEntityId = this.readObjectString(sourceInfo, 'externalEntityId');
      const externalNo = this.readObjectString(sourceInfo, 'externalNo');
      const matchedAbcShadowRecord = this.readObjectObject(
        sourceInfo,
        'matchedAbcShadowRecord',
      );
      const shadowMatchLevel =
        this.readObjectString(matchedAbcShadowRecord, 'matchLevel') ?? 'none';
      const ledgerCount = this.readObjectNumber(ledgerImpact, 'ledgerEntryCount') ?? 0;
      const latestBalanceAfter = this.readObjectString(ledgerImpact, 'latestBalanceAfter');
      const confirmedByName = this.readObjectString(approvalInfo, 'confirmedByName');
      const fulfilledByName = this.readObjectString(approvalInfo, 'fulfilledByName');

      switch (questionType) {
        case 'why_blocked':
          return `${label} 当前请求状态是 ${requestStatus}，对账状态是 ${reconciliationStatus}，主要卡在 ${blockerText}。当前理由：${reconciliationReason}。总部积点是唯一事实源，所以在 ABC 履约未补齐、或总部 consume ledger 与 ABC 影子记录未对齐前，不能把这条兑换当成完全闭环。`;
        case 'what_missing':
          return `${label} 当前至少还要补齐“兑换对象、ABC 履约凭据、总部 consume ledger、ABC 影子命中是否稳定、是否已有直接/相似人审依据”中的缺口，才能把这条兑换链解释完整。`;
        case 'same_or_special_case':
          return `${label} 当前兑换目录是 ${redeemableName}，对象手机号是 ${ownerMobile}，ABC 影子命中级别是 ${shadowMatchLevel}。是否可以推广，要看这条是直接人审、相似模式经验，还是仅命中创始人原则/岗位规则；在此之前只能保守建议。`;
        case 'can_affect_payroll':
          return `${label} 属于总部积点兑换桥接链，不会直接推进正式工资，也不会把 ABC 购物卡视为现金收入。最多只会影响后续福利/审批准备的解释链。`;
        case 'draft_action':
          return `${label} 当前最合理的动作草案，通常是“确认兑换请求”“补录 ABC 履约完成”或“对账异常复核”，但这些都必须人工确认，AI 只能建议不可自动执行。`;
        case 'what_to_do':
        default:
          return `${label} 当前兑换对象是 ${redeemableName}，请求状态是 ${requestStatus}，对账状态是 ${reconciliationStatus}。${
            reconciliationStatus === 'waiting_confirmation' || requestStatus === 'drafted'
              ? '下一步建议先人工确认兑换请求。'
              : reconciliationStatus === 'waiting_fulfillment'
                ? '下一步建议补录 ABC 履约凭据，并确认外部实体号/单号是否完整。'
                : reconciliationStatus === 'fulfilled_pending_consume'
                  ? '当前要优先核查总部 consume ledger 是否漏写。'
                  : reconciliationStatus === 'mismatch_needs_review'
                    ? '当前要优先复核 ABC 影子记录、手机号映射与总部 consume 是否一致。'
                    : reconciliationStatus === 'completed'
                      ? '当前已完成履约与积点扣减，下一步重点是回看 ledger、外部凭据和后续影响。'
                      : requestStatus === 'cancelled'
                        ? '当前已取消，如仍需处理应重建新请求。'
                        : '建议先核对状态与执行轨迹。'
          } 当前已关联 ${ledgerCount} 条积点流水${latestBalanceAfter ? `，最新余额 ${latestBalanceAfter}` : ''}${confirmedByName ? `；确认人：${confirmedByName}` : ''}${fulfilledByName ? `；履约人：${fulfilledByName}` : ''}${externalEntityId || externalNo ? `；ABC 凭据：${externalEntityId ?? '-'} / ${externalNo ?? '-'}` : ''}${exceptionFlags.length ? `；当前异常：${exceptionFlags.join('、')}` : ''}。`;
      }
    }

    if (focusObject?.entityType === 'approval_request_command') {
      const approvalInfo = this.readObjectObject(rawContext, 'approvalInfo');
      const linkedBusinessContext = this.readObjectObject(rawContext, 'linkedBusinessContext');
      const linkedPayout = this.readObjectObject(rawContext, 'linkedPayout');
      const handlingPlan = this.readObjectObject(rawContext, 'handlingPlan');
      const diagnosis = this.readObjectObject(handlingPlan, 'diagnosis');
      const boundary = this.readObjectObject(handlingPlan, 'boundary');
      const actionItems = this.readObjectArray(handlingPlan, 'actionItems').filter(
        (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
      );
      const status = this.readObjectString(approvalInfo, 'status') ?? 'unknown';
      const requestAmount = this.readObjectString(approvalInfo, 'requestAmount') ?? '-';
      const reason = this.readObjectString(approvalInfo, 'reason') ?? '未提供';
      const requesterName = this.readObjectString(approvalInfo, 'requesterName') ?? '未知申请人';
      const approverName = this.readObjectString(approvalInfo, 'approverName');
      const workOrderNo = this.readObjectString(linkedBusinessContext, 'workOrderNo') ?? '-';
      const amountReceived = this.readObjectString(linkedBusinessContext, 'amountReceived');
      const payoutNo = this.readObjectString(linkedPayout, 'latestPayoutNo');
      const planSummary =
        this.readObjectString(handlingPlan, 'summary') ??
        `${label} 当前状态是 ${status}。`;
      const listSummary =
        this.readObjectString(handlingPlan, 'listSummary') ??
        '请按 handlingPlan 收口版继续处理。';
      const suggestedNextStep =
        this.readObjectString(diagnosis, 'suggestedNextStep') ?? '当前仍需人工继续核对。';
      const verificationCodeRole =
        this.readObjectString(diagnosis, 'verificationCodeRole') ??
        'verificationCode 当前只作为提示，不是强阻断条件。';
      const primaryAction =
        actionItems.find((item) =>
          ['blocked', 'pending', 'ready'].includes(this.readObjectString(item, 'status') ?? ''),
        ) ?? actionItems[0] ?? null;
      const primaryActionSummary = primaryAction
        ? `${this.readObjectString(primaryAction, 'title') ?? '当前动作'}：${
            this.readObjectString(primaryAction, 'description') ?? listSummary
          }`
        : listSummary;
      const payrollBoundary =
        this.readObjectString(boundary, 'payrollBoundary') ??
        '不会自动推进正式工资，也不会改动 included / pending / excluded。';
      const generalizationBoundary =
        this.readObjectString(boundary, 'generalizationBoundary') ??
        '当前只解释审批单，不扩展到发票、对账、虚拟账户或多公司审批状态机。';
      const boundarySummary = [
        this.readObjectString(boundary, 'executionBoundary'),
        this.readObjectString(boundary, 'humanConfirmationBoundary'),
        payrollBoundary,
        generalizationBoundary,
      ]
        .filter((item): item is string => Boolean(item && item.trim()))
        .join('；');

      switch (questionType) {
        case 'why_blocked':
          return `${label} 当前处理单摘要是：${planSummary}。当前主要阻塞项是 ${blockerText}，应先按“${primaryActionSummary}”继续处理，不能绕过人工审批与日志留痕。`;
        case 'can_affect_payroll':
          return `${label} 当前工资边界是：${payrollBoundary}`;
        case 'same_or_special_case':
          return `${label} 当前只适用于审批单 ${this.readObjectString(approvalInfo, 'approvalNo') ?? '-'} 与工单 ${workOrderNo} 的上下文；是否可泛化，要以 handlingPlan 的边界说明为准：${generalizationBoundary}`;
        case 'what_missing':
          return `${label} 当前仍缺少的关键条件已经收在 handlingPlan 里：${primaryActionSummary}；${suggestedNextStep}`;
        case 'draft_action':
          return `${label} 当前最合理的动作草稿不是新建资金域，而是继续沿现有审批单执行：先确认工单/收款上下文，再由审批人或管理员人工 decide，验证码只作提示。`;
        case 'explain_rule':
          return `${label} 当前应优先用 handlingPlan 的状态摘要、动作清单、预检结论和边界说明解释；其中 verificationCode 的作用是：${verificationCodeRole}`;
        case 'what_to_do':
        default:
          return `${label} 当前申请金额 ${requestAmount}，申请人 ${requesterName}，关联工单 ${workOrderNo}，审批状态 ${status}。申请原因：${reason}。当前状态摘要：${planSummary}。谁处理 / 怎么处理：${primaryActionSummary}。何时可继续：${suggestedNextStep}${
            amountReceived ? `。当前工单已收款 ${amountReceived}` : ''
          }${approverName ? `。当前审批责任人：${approverName}` : ''}${
            payoutNo ? `。最近付款留痕：${payoutNo}` : ''
          }${boundarySummary ? `。边界说明：${boundarySummary}` : ''}`;
      }
    }

    if (focusObject?.entityType === 'payment_record_command') {
      const paymentInfo = this.readObjectObject(rawContext, 'paymentInfo');
      const linkedWorkOrder = this.readObjectObject(rawContext, 'linkedWorkOrder');
      const amountImpact = this.readObjectObject(rawContext, 'amountImpact');
      const handlingPlan = this.readObjectObject(rawContext, 'handlingPlan');
      const diagnosis = this.readObjectObject(handlingPlan, 'diagnosis');
      const boundary = this.readObjectObject(handlingPlan, 'boundary');
      const actionItems = this.readObjectArray(handlingPlan, 'actionItems').filter(
        (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
      );
      const paymentNo = this.readObjectString(paymentInfo, 'paymentNo') ?? '-';
      const paymentStatus = this.readObjectString(paymentInfo, 'paymentStatus') ?? 'unknown';
      const amount = this.readObjectString(paymentInfo, 'amount') ?? '-';
      const channel = this.readObjectString(paymentInfo, 'channel') ?? '-';
      const workOrderNo = this.readObjectString(linkedWorkOrder, 'workOrderNo') ?? '-';
      const planSummary =
        this.readObjectString(handlingPlan, 'summary') ??
        `${label} 当前状态是 ${paymentStatus}。`;
      const listSummary =
        this.readObjectString(handlingPlan, 'listSummary') ?? '请按 handlingPlan 收口版继续处理。';
      const suggestedNextStep =
        this.readObjectString(diagnosis, 'suggestedNextStep') ?? '当前仍需人工继续核对。';
      const arrivalBasis =
        this.readObjectString(diagnosis, 'currentArrivalBasis') ?? '当前到账依据尚未明确。';
      const missingCondition =
        this.readObjectString(diagnosis, 'missingCondition') ?? '仍需人工确认关键条件。';
      const primaryAction =
        actionItems.find((item) =>
          ['blocked', 'pending', 'ready'].includes(this.readObjectString(item, 'status') ?? ''),
        ) ?? actionItems[0] ?? null;
      const primaryActionSummary = primaryAction
        ? `${this.readObjectString(primaryAction, 'title') ?? '当前动作'}：${
            this.readObjectString(primaryAction, 'description') ?? listSummary
          }`
        : listSummary;
      const workOrderImpactSummary =
        this.readObjectString(amountImpact, 'summary') ?? '工单影响仍需人工复核。';
      const boundarySummary = [
        this.readObjectString(boundary, 'executionBoundary'),
        this.readObjectString(boundary, 'humanConfirmationBoundary'),
        this.readObjectString(boundary, 'payrollBoundary'),
        this.readObjectString(boundary, 'generalizationBoundary'),
      ]
        .filter((item): item is string => Boolean(item && item.trim()))
        .join('；');

      switch (questionType) {
        case 'why_blocked':
          return `${label} 当前处理单摘要是：${planSummary}。主要阻塞项是 ${blockerText}，应先按“${primaryActionSummary}”继续处理，不能绕过人工确认层。`;
        case 'can_affect_payroll':
          return `${label} 当前工资边界是：${
            this.readObjectString(boundary, 'payrollBoundary') ??
            '不会自动推进正式工资，也不会改动 confirmed / inferred / uncertain 与 included / pending / excluded。'
          }`;
        case 'same_or_special_case':
          return `${label} 当前只适用于收款记录 ${paymentNo} 与工单 ${workOrderNo} 的上下文；是否可泛化，要以 handlingPlan 的边界说明为准：${
            this.readObjectString(boundary, 'generalizationBoundary') ?? '当前不自动泛化到其他资金对象。'
          }`;
        case 'what_missing':
          return `${label} 当前仍缺少的关键条件是：${missingCondition}。建议动作：${primaryActionSummary}；${suggestedNextStep}`;
        case 'draft_action':
          return `${label} 当前最合理的动作草案不是新增 execute 接口，而是继续沿现有 payment_records 写入路径处理：先核对工单/金额/渠道，再由财务或管理员人工确认到账。`;
        case 'explain_rule':
          return `${label} 当前应优先用 handlingPlan 的状态摘要、动作清单、预检结论和边界说明解释；当前到账依据是：${arrivalBasis}`;
        case 'what_to_do':
        default:
          return `${label} 当前收款记录 ${paymentNo}，金额 ${amount}，渠道 ${channel}，状态 ${paymentStatus}，关联工单 ${workOrderNo}。当前状态摘要：${planSummary}。谁处理 / 怎么处理：${primaryActionSummary}。何时可继续：${suggestedNextStep}。工单影响：${workOrderImpactSummary}${boundarySummary ? `。边界说明：${boundarySummary}` : ''}`;
      }
    }

    switch (questionType) {
      case 'why_blocked':
        return `${label} 当前主要卡在 ${blockerText}，这是现有证据链和人工确认边界共同决定的结果。`;
      case 'can_affect_payroll':
        return `${label} 当前与工资前置的关系主要取决于阻塞项是否解除；在人工确认前，这条记录只能作为前置核对对象。`;
      case 'same_or_special_case':
        return `${label} 需要先判断它有没有直接人审依据；若只有规则依据，只能作为同类候选建议，不能自动当成普遍规则。`;
      case 'what_missing':
        return `${label} 当前可以先从“缺失上下文”角度看问题，先补关键证据，再决定是否提交人工裁决。`;
      case 'draft_action':
        return `${label} 当前已具备草拟人工动作的基础，但仍需人工确认后才能真正执行。`;
      case 'explain_rule':
        return `${label} 当前判断会优先引用知识规则，再结合最近的人审经验，不会直接把弱证据当成结论。`;
      case 'what_to_do':
      default:
        return `${label} 当前最合理的策略是先处理最前面的阻塞项，再推进后续人工确认或分类动作。`;
    }
  }

  private buildAssistantBasisSummary(
    pageContext: AiPageContextResponse,
    citedKnowledge: AiKnowledgeReference[],
    citedManualDecisions: AiManualDecisionReference[],
  ) {
    const parts: string[] = [];
    if (citedManualDecisions.length) {
      parts.push(
        `直接/相似人审依据 ${citedManualDecisions.length} 条，例如：${citedManualDecisions
          .slice(0, 2)
          .map((item) => item.summary)
          .join('；')}`,
      );
    } else {
      parts.push('当前没有直接可复用的人审结论，只能先按规则依据给出建议。');
    }

    if (citedKnowledge.length) {
      parts.push(
        `规则依据：${citedKnowledge
          .map((item) => `${item.title}`)
          .join('、')}`,
      );
    }

    if (pageContext.evidenceSummary.length) {
      parts.push(`当前证据：${pageContext.evidenceSummary.slice(0, 4).join('；')}`);
    }

    return parts.join(' ');
  }

  private buildAssistantNextActionSummary(
    primarySuggestion: string,
    blockers: string[],
    questionType: AiAssistantQuestionType,
  ) {
    if (questionType === 'draft_action') {
      return '建议先生成一份人工裁决草稿，再由高权限角色复核是否提交。';
    }
    if (primarySuggestion === 'confirm_binding') {
      return '建议先确认客户绑定；若手机号唯一候选已稳定，再走人工确认，不要自动越过确认层。';
    }
    if (primarySuggestion === 'sheet_repair') {
      return '建议先补台账漏记或补充对账证据，再回到绩效/经营统计确认。';
    }
    if (primarySuggestion === 'manual_decision') {
      return '建议提交人工裁决或确认动作，并明确适用范围与判断依据。';
    }
    if (blockers.length) {
      return '建议先核对当前阻塞项，再决定是否确认、驳回、改分类或暂缓。';
    }
    return '当前没有明显阻塞，可继续核对上下文并选择最小风险的人工作法。';
  }

  private buildAssistantBoundarySummary(missingContext: string[]) {
    if (!missingContext.length) {
      return '当前可以给出较明确的处理建议，但仍然不能自动确认高风险动作，必须保留人工确认层。';
    }
    return `当前只能给建议，不能自动定案。仍缺：${missingContext.join('、')}。需要人工确认后才能继续。`;
  }

  private buildPointsAssistantCommandDraft(
    userMessage: string,
    focusObject: AiAssistantFocusObject | null,
    pageContext: AiPageContextResponse,
  ) {
    if (!/(积分|积点|point|补偿|送点|发点|扣回|撤销)/i.test(userMessage)) {
      return null;
    }

    const shouldCreateAbcPointsDraft =
      pageContext.pageInfo.routePath.startsWith('/abc-points/') ||
      focusObject?.entityType === 'abc_points_command' ||
      /(ABC\s*积分|abc_score|ABC score)/i.test(userMessage);

    if (shouldCreateAbcPointsDraft) {
      const owner = this.resolvePointsOwnerCandidate(focusObject);
      if (!owner) {
        return null;
      }

      const draftType = /(撤销|扣回|回收|revoke)/i.test(userMessage)
        ? 'revoke_score'
        : /(调整|校正|修正|adjust)/i.test(userMessage)
          ? 'adjust_score'
          : 'issue_score';

      const sourceType = /(产品|商品|购买套餐|product)/i.test(userMessage)
        ? 'product_bonus_readonly'
        : /(修正|纠偏|校正|correction)/i.test(userMessage)
          ? 'correction'
          : /(历史|legacy|数据库手改|手改)/i.test(userMessage)
            ? 'legacy_db_direct'
            : /(客服|补偿|安抚)/i.test(userMessage)
              ? 'customer_service_compensation'
              : 'hq_issue';

      return {
        draftType,
        rewardDomain: 'abc_score',
        sourceOfTruth: 'ABC',
        targetEntity: {
          routePath: pageContext.pageInfo.routePath,
          entityType: focusObject?.entityType ?? pageContext.pageInfo.pageEntityType,
          entityId: focusObject?.entityId ?? pageContext.pageInfo.pageEntityId,
          sourceActionId: pageContext.pageInfo.sourceActionId,
          sourceTable: focusObject?.sourceTable ?? null,
          sourceId: focusObject?.sourceId ?? null,
        },
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        ownerMobile: owner.ownerMobile,
        changeAmount:
          /(发100|100分|100积分|100积点)/i.test(userMessage) ? '100.00' : '50.00',
        sourceType,
        providerKey: pageContext.provider.providerKey,
        threadKey: pageContext.threadKey,
        sourceActionId: pageContext.pageInfo.sourceActionId,
        requestSource: 'ai_assistant_draft',
        suggestedAction:
          draftType === 'revoke_score'
            ? '建议创建 ABC 积分撤销命令草稿'
            : draftType === 'adjust_score'
              ? '建议创建 ABC 积分调整命令草稿'
              : '建议创建 ABC 积分补发命令草稿',
        suggestedReason:
          '当前问题属于 ABC 积分，不是总部积点。应走总部受控命令链草稿与人工确认，不允许手工改 ABC 数据库。',
        suggestedScope: 'case_only',
        suggestedJudgmentBasis: /(经验|人工|operator)/i.test(userMessage)
          ? ['operator_experience']
          : ['other'],
        suggestedAiLearningMode: 'do_not_generalize',
        affectPerformanceFlag: false,
        affectBCardFlag: false,
      };
    }

    const rawContext = (focusObject?.rawContext ?? {}) as Record<string, unknown>;
    const welfarePeriodKey =
      this.readObjectString(this.readObjectObject(rawContext, 'basicInfo'), 'periodKey') ??
      pageContext.filterSummary.periodKey ??
      this.resolveAssistantCurrentPeriodKey();
    const shouldCreateWelfareBatch =
      pageContext.pageInfo.routePath.startsWith('/points/welfare') &&
      /(福利|每月|员工)/i.test(userMessage) &&
      /(批量|母单|本月|名单|预览|草案|草拟|create|draft)/i.test(userMessage);

    if (shouldCreateWelfareBatch) {
      return {
        draftType: 'create_points_welfare_batch',
        batchType: 'employee_monthly_welfare',
        periodKey: welfarePeriodKey,
        sourceType: 'employee_monthly_welfare',
        requestSource: 'ai_assistant_draft',
        providerKey: pageContext.provider.providerKey,
        threadKey: pageContext.threadKey,
        sourceActionId: pageContext.pageInfo.sourceActionId,
        targetEntity: {
          routePath: '/points/welfare',
          entityType: 'points_welfare_preview',
          entityId: welfarePeriodKey,
          sourceActionId: pageContext.pageInfo.sourceActionId,
          sourceTable: 'employees',
          sourceId: welfarePeriodKey,
        },
        suggestedAction: '建议创建本月员工 200 积点批量草案',
        suggestedReason: '当前是员工月度福利场景，建议先生成母单与子命令草案，再由高权限人工确认后执行。',
        suggestedScope: 'same_pattern',
        suggestedJudgmentBasis: ['operator_experience'],
        suggestedAiLearningMode: 'do_not_generalize',
        affectPerformanceFlag: false,
        affectBCardFlag: false,
      };
    }

    const shouldCreateRedemptionDraft =
      pageContext.pageInfo.routePath.startsWith('/points/redemptions') &&
      /(兑换|购物卡|ABC购物卡|ABC 购物卡|redeem)/i.test(userMessage);

    if (shouldCreateRedemptionDraft) {
      const rawContext = (focusObject?.rawContext ?? {}) as Record<string, unknown>;
      const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
      const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
      const fallbackOwner = this.resolvePointsOwnerCandidate(focusObject);
      const filters = pageContext.filterSummary.filters ?? {};
      const filterRedeemableCode =
        typeof filters.redeemableCode === 'string' && filters.redeemableCode.trim().length > 0
          ? filters.redeemableCode.trim()
          : null;

      return {
        draftType: 'create_points_redemption_request',
        targetEntity: {
          routePath: '/points/redemptions',
          entityType: focusObject?.entityType ?? pageContext.pageInfo.pageEntityType,
          entityId: focusObject?.entityId ?? pageContext.pageInfo.pageEntityId,
          sourceActionId: pageContext.pageInfo.sourceActionId,
          sourceTable: focusObject?.sourceTable ?? null,
          sourceId: focusObject?.sourceId ?? null,
        },
        ownerType:
          this.readObjectString(ownerInfo, 'ownerType') ??
          fallbackOwner?.ownerType ??
          'customer',
        ownerId:
          this.readObjectNumber(ownerInfo, 'ownerId') ??
          fallbackOwner?.ownerId ??
          null,
        ownerMobile:
          this.readObjectString(ownerInfo, 'ownerMobileRaw') ??
          this.readObjectString(ownerInfo, 'ownerMobile') ??
          fallbackOwner?.ownerMobile ??
          null,
        redeemableCode:
          this.readObjectString(basicInfo, 'redeemableCode') ?? filterRedeemableCode,
        redeemableName: this.readObjectString(basicInfo, 'redeemableName'),
        pointsCost: this.readObjectString(basicInfo, 'pointsCost') ?? '200.00',
        targetValue: this.readObjectString(basicInfo, 'targetValue') ?? '200.00',
        requestSource: 'ai_assistant_draft',
        providerKey: pageContext.provider.providerKey,
        threadKey: pageContext.threadKey,
        sourceActionId: pageContext.pageInfo.sourceActionId,
        suggestedAction: '建议创建积点兑换请求草稿',
        suggestedReason:
          '当前问题与总部积点兑换到 ABC 购物卡有关，建议先创建兑换请求草稿，再由高权限人工确认和标记履约。',
        suggestedScope: 'case_only',
        suggestedJudgmentBasis: /(manual_omission|漏记)/i.test(userMessage)
          ? ['manual_omission']
          : /(operator|经验|人工)/i.test(userMessage)
            ? ['operator_experience']
            : ['other'],
        suggestedAiLearningMode: 'do_not_generalize',
        affectPerformanceFlag: false,
        affectBCardFlag: false,
      };
    }

    const owner = this.resolvePointsOwnerCandidate(focusObject);
    if (!owner) {
      return null;
    }

    const draftType = /(撤销|扣回|回收|revoke)/i.test(userMessage)
      ? 'revoke_points'
      : /(调整|校正|修正|adjust)/i.test(userMessage)
        ? 'adjust_points'
        : 'issue_points';

    const sourceType =
      owner.ownerType === 'employee' && /(福利|每月|员工)/i.test(userMessage)
        ? 'employee_monthly_welfare'
        : /(补偿|安抚|客服)/i.test(userMessage)
          ? 'customer_service_compensation'
          : /(修正|纠正|校正)/i.test(userMessage)
            ? 'correction'
            : 'manual_reward';

    return {
      draftType,
      targetEntity: {
        routePath: pageContext.pageInfo.routePath,
        entityType: focusObject?.entityType ?? pageContext.pageInfo.pageEntityType,
        entityId: focusObject?.entityId ?? pageContext.pageInfo.pageEntityId,
        sourceActionId: pageContext.pageInfo.sourceActionId,
        sourceTable: focusObject?.sourceTable ?? null,
        sourceId: focusObject?.sourceId ?? null,
      },
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      ownerMobile: owner.ownerMobile,
      merchantId: owner.merchantId,
      sourceType,
      providerKey: pageContext.provider.providerKey,
      threadKey: pageContext.threadKey,
      sourceActionId: pageContext.pageInfo.sourceActionId,
      requestSource: 'ai_assistant_draft',
      suggestedAction:
        draftType === 'revoke_points'
          ? '建议创建积点回收命令草稿'
          : draftType === 'adjust_points'
            ? '建议创建积点调整命令草稿'
            : '建议创建积点发放命令草稿',
      suggestedReason: '当前问题与积点处理相关，建议先创建命令草稿，再由高权限人工确认后执行。',
      suggestedScope: 'case_only',
      suggestedJudgmentBasis: /(漏记|manual_omission)/i.test(userMessage)
        ? ['manual_omission']
        : /(经验|人工|operator)/i.test(userMessage)
          ? ['operator_experience']
          : ['other'],
      suggestedAiLearningMode: 'do_not_generalize',
      affectPerformanceFlag: false,
      affectBCardFlag: false,
    };
  }

  private resolvePointsOwnerCandidate(focusObject: AiAssistantFocusObject | null) {
    const rawContext = (focusObject?.rawContext ?? {}) as Record<string, unknown>;
    const ownerInfo = this.readObjectObject(rawContext, 'ownerInfo');
    const customerIdentity = this.readObjectObject(rawContext, 'customerIdentity');
    const basicInfo = this.readObjectObject(rawContext, 'basicInfo');
    const ownerType = this.readObjectString(ownerInfo, 'ownerType');
    const ownerIdFromOwnerInfo = this.readObjectNumber(ownerInfo, 'ownerId');
    const ownerMobileFromOwnerInfo = this.readObjectString(ownerInfo, 'ownerMobile');
    if (ownerType === 'customer' || ownerType === 'employee') {
      if (ownerIdFromOwnerInfo || ownerMobileFromOwnerInfo) {
        return {
          ownerType: ownerType as 'customer' | 'employee',
          ownerId: ownerIdFromOwnerInfo,
          ownerMobile: ownerMobileFromOwnerInfo,
          merchantId:
            this.readObjectNumber(ownerInfo, 'merchantId') ??
            this.readObjectNumber(basicInfo, 'merchantId'),
        };
      }
    }
    const matchedCustomerId = this.readObjectNumber(customerIdentity, 'matchedCustomerId');
    const customerMobile =
      this.readObjectString(customerIdentity, 'matchedCustomerMobile') ??
      this.readObjectString(customerIdentity, 'customerMobile') ??
      this.readObjectString(rawContext, 'customerMobile');

    if (matchedCustomerId || customerMobile) {
      return {
        ownerType: 'customer' as const,
        ownerId: matchedCustomerId,
        ownerMobile: customerMobile,
        merchantId: this.readObjectNumber(basicInfo, 'merchantId'),
      };
    }

    const employeeId =
      this.readObjectNumber(basicInfo, 'employeeId') ?? this.readObjectNumber(rawContext, 'employeeId');
    if (employeeId) {
      return {
        ownerType: 'employee' as const,
        ownerId: employeeId,
        ownerMobile: null,
        merchantId: this.readObjectNumber(basicInfo, 'merchantId'),
      };
    }

    return null;
  }

  private async loadPointsSummaryForFocusObject(focusObject: AiAssistantFocusObject | null) {
    const rawContext = (focusObject?.rawContext ?? {}) as Record<string, unknown>;
    const embeddedSummary = this.readObjectObject(rawContext, 'pointsSummary');
    if (embeddedSummary) {
      return embeddedSummary;
    }
    const owner = this.resolvePointsOwnerCandidate(focusObject);
    if (!owner) {
      return null;
    }
    return this.loadPointsSummaryForIdentity(owner);
  }

  private async loadPointsSummaryForIdentity(input: {
    ownerType: 'customer' | 'employee';
    ownerId: number | null;
    ownerMobile: string | null;
    merchantId?: number | null;
  }) {
    const normalizedMobile = this.normalizeMobile(input.ownerMobile);
    if (!input.ownerId && !normalizedMobile) {
      return null;
    }

    const commandQb = this.pointsCommandRepository
      .createQueryBuilder('command')
      .where('command.owner_type = :ownerType', { ownerType: input.ownerType });
    const ledgerQb = this.pointsLedgerRepository
      .createQueryBuilder('ledger')
      .where('ledger.owner_type = :ownerType', { ownerType: input.ownerType });

    if (input.ownerId && normalizedMobile) {
      commandQb.andWhere(
        new Brackets((sub) => {
          sub.where('command.owner_id = :ownerId', { ownerId: input.ownerId }).orWhere(
            'command.owner_mobile = :ownerMobile',
            { ownerMobile: normalizedMobile },
          );
        }),
      );
      ledgerQb.andWhere(
        new Brackets((sub) => {
          sub.where('ledger.owner_id = :ownerId', { ownerId: input.ownerId }).orWhere(
            'ledger.owner_mobile = :ownerMobile',
            { ownerMobile: normalizedMobile },
          );
        }),
      );
    } else if (input.ownerId) {
      commandQb.andWhere('command.owner_id = :ownerId', { ownerId: input.ownerId });
      ledgerQb.andWhere('ledger.owner_id = :ownerId', { ownerId: input.ownerId });
    } else if (normalizedMobile) {
      commandQb.andWhere('command.owner_mobile = :ownerMobile', { ownerMobile: normalizedMobile });
      ledgerQb.andWhere('ledger.owner_mobile = :ownerMobile', { ownerMobile: normalizedMobile });
    }

    const [recentCommands, recentLedgerEntries] = await Promise.all([
      commandQb.clone().orderBy('command.requested_at', 'DESC').addOrderBy('command.id', 'DESC').take(5).getMany(),
      ledgerQb.clone().orderBy('ledger.executed_at', 'DESC').addOrderBy('ledger.id', 'DESC').take(5).getMany(),
    ]);

    return {
      ownerType: input.ownerType,
      ownerId: input.ownerId ?? null,
      ownerMobile: normalizedMobile,
      merchantId: input.merchantId ?? null,
      recentCommandCount: recentCommands.length,
      recentLedgerCount: recentLedgerEntries.length,
      latestBalanceAfter: recentLedgerEntries[0]?.balanceAfter ?? null,
      recentCommands: recentCommands.map((item) => ({
        id: item.id,
        commandType: item.commandType,
        commandStatus: item.commandStatus,
        changeAmount: item.changeAmount,
        sourceType: item.sourceType,
        requestSource: item.requestSource,
        requestedAt: item.requestedAt?.toISOString() ?? null,
        confirmedAt: item.confirmedAt?.toISOString() ?? null,
        executedAt: item.executedAt?.toISOString() ?? null,
        providerKey: item.providerKey ?? null,
      })),
      recentLedgerEntries: recentLedgerEntries.map((item) => ({
        id: item.id,
        changeType: item.changeType,
        changeAmount: item.changeAmount,
        balanceAfter: item.balanceAfter,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        reasonCode: item.reasonCode,
        executedAt: item.executedAt?.toISOString() ?? null,
      })),
    };
  }

  private mapPointsLedgerEntryForAiContext(entry: PointsLedgerEntry) {
    return {
      id: entry.id,
      changeType: entry.changeType,
      changeAmount: entry.changeAmount,
      balanceAfter: entry.balanceAfter,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      sourceNo: entry.sourceNo,
      requestSource: entry.requestSource,
      reasonCode: entry.reasonCode ?? null,
      remark: entry.remark ?? null,
      executedBy: entry.executedBy,
      executedByName: entry.executedByName,
      executedAt: entry.executedAt?.toISOString() ?? null,
      approvedBy: entry.approvedBy,
      approvedByName: entry.approvedByName,
      approvedAt: entry.approvedAt?.toISOString() ?? null,
      normalizedPayload: entry.normalizedPayload ?? {},
      createdAt: entry.createdAt?.toISOString() ?? null,
    };
  }

  private resolvePointsCommandBlockers(command: PointsCommandRequest) {
    switch (command.commandStatus) {
      case 'drafted':
        return ['command_not_confirmed'];
      case 'confirmed':
        return ['command_not_executed'];
      case 'cancelled':
        return ['command_cancelled'];
      case 'failed':
        return ['command_failed'];
      default:
        return [];
    }
  }

  private buildPointsCommandNextStep(command: PointsCommandRequest) {
    switch (command.commandStatus) {
      case 'drafted':
        return '待高权限人工确认后，才能进入执行并写入积点账本。';
      case 'confirmed':
        return '当前已经人工确认，下一步可执行命令并写入积点账本。';
      case 'executed':
        return '已执行完成，下一步可回查 ledger、余额变化，以及是否影响后续绩效/福利准备。';
      case 'cancelled':
        return '当前命令已取消，如仍需处理，应重新创建新的积点命令草稿。';
      case 'failed':
        return '当前命令执行失败，需要人工排查失败原因后重建或修正命令。';
      default:
        return '建议先核对命令状态和执行轨迹，再决定下一步。';
    }
  }

  private resolveAbcPointsCommandBlockersFromDetail(detail: Record<string, unknown>) {
    const commandStatus = this.readObjectString(detail, 'commandStatus') ?? 'unknown';
    const blockedReason = this.readObjectString(detail, 'blockedReason');

    switch (commandStatus) {
      case 'drafted':
        return ['abc_points_command_pending_confirmation'];
      case 'confirmed':
        return ['abc_points_command_waiting_execution'];
      case 'blocked':
        return [
          'abc_points_command_blocked',
          blockedReason === 'abc_score_write_path_not_stable'
            ? 'abc_score_write_path_not_stable'
            : 'abc_points_command_blocked_reason_unknown',
        ];
      case 'cancelled':
        return ['abc_points_command_cancelled'];
      case 'failed':
        return ['abc_points_command_failed'];
      default:
        return [];
    }
  }

  private buildAbcPointsCommandNextStep(detail: Record<string, unknown>) {
    const commandStatus = this.readObjectString(detail, 'commandStatus') ?? 'unknown';
    const blockedReason = this.readObjectString(detail, 'blockedReason');
    const writePathStable = this.readObjectBoolean(detail, 'writePathStable');

    switch (commandStatus) {
      case 'drafted':
        return '待高权限人工确认后，才能继续判断是否允许进入 ABC 积分受控执行。';
      case 'confirmed':
        return writePathStable
          ? '当前已人工确认，若写入路径稳定，可进入 ABC 积分受控执行。'
          : '当前已人工确认，但写入路径尚未稳定，只能继续 blocked 留痕与核查。';
      case 'blocked':
        return blockedReason === 'abc_score_write_path_not_stable'
          ? '当前写入路径尚未稳定，只能保留 blocked 审计并继续核查 ABC 积分写入链。'
          : '当前命令已 blocked，需先核对阻塞原因，再决定是否重新确认或重建。';
      case 'executed':
        return '当前已执行完成，下一步应回查 ABC 影子结果、积分余额变化与审计轨迹。';
      case 'cancelled':
        return '当前命令已取消，如仍需处理，应重新创建新的 ABC 积分命令草稿。';
      case 'failed':
        return '当前命令执行失败，需要人工排查失败原因后再决定重试或重建。';
      default:
        return '建议先核对 ABC 积分命令状态与执行轨迹，再决定下一步。';
    }
  }

  private buildPointsWelfareBatchNextStep(batchStatus: string) {
    switch (batchStatus) {
      case 'drafted':
        return '当前母单还是草案，下一步应由高权限人工确认后再决定是否执行。';
      case 'confirmed':
        return '当前母单已确认，下一步可执行子命令并写入积点账本。';
      case 'partially_executed':
        return '当前母单已部分执行，下一步应先核对失败或未执行子项，再决定是否继续执行。';
      case 'executed':
        return '当前母单已执行完成，下一步可回查子命令、ledger 与福利发放结果。';
      case 'cancelled':
        return '当前母单已取消，如仍需处理，应重新生成新的福利草案母单。';
      default:
        return '建议先核对母单状态、子命令状态与执行轨迹，再决定下一步。';
    }
  }

  private buildPointsCommandWhyNow(baseContext: {
    command: PointsCommandRequest;
    blockers: string[];
  }) {
    if (baseContext.command.commandStatus === 'drafted') {
      return '这条积点命令已经草拟，但还没有人工确认；若不确认，它不会进入账本，也无法形成完整审计链。';
    }
    if (baseContext.command.commandStatus === 'confirmed') {
      return '这条积点命令已经人工确认，但还没有执行；若不执行，账本不会落地，AI 也只能停留在建议层。';
    }
    if (baseContext.command.commandStatus === 'executed') {
      return '这条积点命令已经执行完成，现在更重要的是回查 ledger、余额变化与后续影响。';
    }
    if (baseContext.command.commandStatus === 'cancelled') {
      return '这条积点命令已经取消，当前重点是说明为什么取消，以及是否需要重建新的命令。';
    }
    if (baseContext.command.commandStatus === 'failed') {
      return '这条积点命令执行失败，当前要先排查失败原因，再决定是否重建或修正。';
    }
    return `当前主要阻塞项：${baseContext.blockers.join('、') || '无明显阻塞'}。`;
  }

  private resolvePointsRedemptionBlockersFromDetail(detail: Record<string, unknown>) {
    const reconciliationStatus = this.readObjectString(detail, 'reconciliationStatus');
    const exceptionFlags = this.readObjectArray(detail, 'exceptionFlags').filter(
      (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
    );
    const blockers: string[] = [];

    switch (reconciliationStatus) {
      case 'waiting_confirmation':
        blockers.push('points_redemption_pending_confirmation');
        break;
      case 'waiting_fulfillment':
        blockers.push('points_redemption_waiting_fulfillment');
        break;
      case 'fulfilled_pending_consume':
        blockers.push('points_redemption_missing_consume_ledger');
        break;
      case 'cancelled':
        blockers.push('points_redemption_cancelled');
        break;
      case 'failed':
        blockers.push('points_redemption_failed');
        break;
      case 'mismatch_needs_review':
        blockers.push('points_redemption_reconciliation_mismatch');
        break;
      default:
        break;
    }

    for (const flag of exceptionFlags) {
      blockers.push(`points_redemption_exception_${flag}`);
    }
    return [...new Set(blockers)];
  }

  private buildPointsRedemptionNextStepFromDetail(detail: Record<string, unknown>) {
    const explicit = this.readObjectString(detail, 'nextStepAfterDone');
    if (explicit) {
      return explicit;
    }
    const reconciliationStatus = this.readObjectString(detail, 'reconciliationStatus');
    switch (reconciliationStatus) {
      case 'waiting_confirmation':
        return '当前兑换请求还是草稿，下一步应由高权限人工确认后，再进入总部到 ABC 的履约桥接。';
      case 'waiting_fulfillment':
        return '当前兑换请求已确认但尚未完成 ABC 履约，下一步应先补录履约凭据，再回写总部 consume ledger。';
      case 'fulfilled_pending_consume':
        return '当前已完成 ABC 履约，但总部 consume ledger 仍未稳定落地，下一步应先补齐总部积点流水。';
      case 'completed':
        return '当前兑换请求已完成，下一步可回看 ledger、ABC 凭据和后续影响。';
      case 'cancelled':
        return '当前兑换请求已取消，如仍需处理，应重建新的兑换草稿，而不是直接改旧请求。';
      case 'failed':
        return '当前兑换请求失败，下一步应先核对失败原因、履约凭据和余额，再决定重试或重建。';
      case 'mismatch_needs_review':
        return '当前兑换请求存在对账异常，下一步应先人工核对 ABC 影子记录、外部编号与总部 consume 是否一致。';
      default:
        return '建议先核对兑换请求状态、ABC 履约凭据和总部积点流水，再决定下一步。';
    }
  }

  private buildPointsRedemptionWhyNow(baseContext: {
    request: Record<string, unknown>;
    blockers: string[];
    relatedLedgerEntries?: Array<Record<string, unknown>>;
  }) {
    const requestStatus = this.readObjectString(baseContext.request, 'requestStatus') ?? '';
    const hasConsumeLedger = (baseContext.relatedLedgerEntries ?? []).some(
      (item) => item.changeType === 'consume',
    );

    if (requestStatus === 'drafted') {
      return '这条积点兑换请求已经草拟，但还没有人工确认；如果不确认，它就不会进入总部到 ABC 的履约链。';
    }
    if (['confirmed', 'pending_fulfillment'].includes(requestStatus)) {
      return '这条积点兑换请求已确认，但还没有完成 ABC 履约；在履约成功前，总部不能提前扣减积点。';
    }
    if (requestStatus === 'fulfilled_in_abc' && !hasConsumeLedger) {
      return '这条兑换请求已经在 ABC 履约，但总部 consume ledger 还没落地；如果不补写，就会造成两边账不一致。';
    }
    if (requestStatus === 'completed') {
      return '这条兑换请求已经完成，现在更重要的是回看 ABC 履约凭据、总部积点流水和余额变化是否一致。';
    }
    if (requestStatus === 'cancelled') {
      return '这条兑换请求已经取消，当前重点是解释为什么取消，以及是否需要重建新的兑换请求。';
    }
    if (requestStatus === 'failed') {
      return '这条兑换请求失败，当前重点是找出失败点，避免重复履约或重复扣减积点。';
    }
    return `当前主要阻塞项：${baseContext.blockers.join('、') || '无明显阻塞'}。`;
  }

  private buildGeneralizationBoundaryForPointsRedemption(
    baseContext: {
      commandOrigin: Record<string, unknown>;
    },
    manualDecisionMatches: AiManualDecisionReference[],
    founderMemories: AiMemoryReference[],
    roleMemories: AiMemoryReference[],
    knowledgeHints: AiKnowledgeReference[],
  ) {
    const explicitScope = this.readObjectString(baseContext.commandOrigin, 'suggestedScope');
    const explicitMode = this.readObjectString(
      baseContext.commandOrigin,
      'suggestedAiLearningMode',
    );
    const baseBoundary = this.buildGeneralizationBoundaryV2(
      manualDecisionMatches,
      founderMemories,
      roleMemories,
      knowledgeHints,
    );
    const parts = [baseBoundary];

    if (explicitScope) {
      parts.push(`当前兑换请求草稿显式标注适用范围：${explicitScope}。`);
    }
    if (explicitMode) {
      parts.push(`当前兑换请求草稿显式标注 AI 学习方式：${explicitMode}。`);
    }
    parts.push('积点兑换请求仍然属于高风险业务对象；AI 只能建议，不可自动确认、自动履约或自动扣减积点。');
    return parts.join(' ');
  }

  private buildGeneralizationBoundaryForPointsCommand(
    baseContext: {
      commandOrigin: Record<string, unknown>;
    },
    manualDecisionMatches: AiManualDecisionReference[],
    founderMemories: AiMemoryReference[],
    roleMemories: AiMemoryReference[],
    knowledgeHints: AiKnowledgeReference[],
  ) {
    const explicitScope = this.readObjectString(baseContext.commandOrigin, 'suggestedScope');
    const explicitMode = this.readObjectString(baseContext.commandOrigin, 'suggestedAiLearningMode');
    const baseBoundary = this.buildGeneralizationBoundaryV2(
      manualDecisionMatches,
      founderMemories,
      roleMemories,
      knowledgeHints,
    );

    if (!explicitScope && !explicitMode) {
      return baseBoundary;
    }

    const parts = [baseBoundary];
    if (explicitScope) {
      parts.push(`当前命令草稿显式标注适用范围：${explicitScope}。`);
    }
    if (explicitMode) {
      parts.push(`当前命令草稿显式标注 AI 学习方式：${explicitMode}。`);
    }
    return parts.join(' ');
  }

  private readObjectBoolean(
    input: Record<string, unknown> | null | undefined,
    key: string,
  ) {
    const value = input?.[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
    return null;
  }

  private resolveAssistantConfidenceLevel(
    citedManualDecisions: AiManualDecisionReference[],
    citedKnowledge: AiKnowledgeReference[],
    missingContext: string[],
  ): AiAssistantConfidenceLevel {
    if (citedManualDecisions.some((item) => item.matchType === 'direct') && missingContext.length === 0) {
      return 'high';
    }
    if ((citedManualDecisions.length || citedKnowledge.length) && missingContext.length <= 1) {
      return 'medium';
    }
    return 'low';
  }

  private buildManualDecisionReferenceFromObject(
    source: Record<string, unknown>,
    matchType: 'direct' | 'similar_pattern',
  ): AiManualDecisionReference | null {
    const idRaw = source.id;
    const summaryIdRaw = source.sourceSummaryId;
    const id = typeof idRaw === 'number' ? idRaw : Number(idRaw);
    const sourceSummaryId =
      typeof summaryIdRaw === 'number' ? summaryIdRaw : Number(summaryIdRaw);
    if (!Number.isFinite(id) || !Number.isFinite(sourceSummaryId)) {
      return null;
    }

    return {
      id,
      sourceSummaryId,
      actionType: this.readObjectString(source, 'actionType') ?? 'manual_decision',
      reasonCode: this.readObjectString(source, 'reasonCode'),
      decisionScope: this.readObjectString(source, 'decisionScope'),
      judgmentBasis: this.readObjectArray(source, 'judgmentBasis').filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      ),
      aiLearningMode: this.readObjectString(source, 'aiLearningMode'),
      finalClassification: this.readObjectString(source, 'finalClassification'),
      finalBindingStatus: this.readObjectString(source, 'finalBindingStatus'),
      operatorName: this.readObjectString(source, 'operatorName'),
      operatedAt: this.readObjectString(source, 'operatedAt') ?? '',
      matchType,
      summary: this.describeManualDecisionReference(source, matchType),
    };
  }

  private describeManualDecisionReference(
    source: Record<string, unknown>,
    matchType: 'direct' | 'similar_pattern',
  ) {
    const actionType = this.readObjectString(source, 'actionType') ?? 'manual_decision';
    const scope = this.readObjectString(source, 'decisionScope') ?? 'case_only';
    const basis = this.readObjectArray(source, 'judgmentBasis')
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join('、');
    const operatorName = this.readObjectString(source, 'operatorName') ?? '人工';
    const prefix = matchType === 'direct' ? '当前对象已有人工裁决' : '相似模式人工裁决';
    return `${prefix}：${operatorName} 以 ${scope} 范围执行 ${actionType}${
      basis ? `（依据：${basis}）` : ''
    }`;
  }

  private readObjectString(source: Record<string, unknown> | null | undefined, key: string) {
    if (!source) {
      return null;
    }
    const value = source[key];
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized || null;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return null;
  }

  private readObjectNumber(source: Record<string, unknown> | null | undefined, key: string) {
    if (!source) {
      return null;
    }
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private readObjectArray(source: Record<string, unknown> | null | undefined, key: string) {
    if (!source) {
      return [];
    }
    const value = source[key];
    return Array.isArray(value) ? value : [];
  }

  private readObjectObject(source: Record<string, unknown> | null | undefined, key: string) {
    if (!source) {
      return null;
    }
    const value = source[key];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private resolveAssistantCurrentPeriodKey(date = new Date()) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  private canViewFullSensitiveInfoForAi(currentUser: CurrentUser) {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    return (
      roleCodes.has('admin') ||
      roleCodes.has('finance') ||
      roleCodes.has('founder') ||
      roleCodes.has('owner') ||
      roleCodes.has('super_admin')
    );
  }

  private maskMobileForAi(input: string | null | undefined, currentUser: CurrentUser) {
    const normalized = this.normalizeMobile(input);
    if (!normalized) {
      return null;
    }
    if (this.canViewFullSensitiveInfoForAi(currentUser)) {
      return normalized;
    }
    if (normalized.length < 7) {
      return normalized;
    }
    return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
  }

  private resolveAssistantEmployeeDisplayName(employee: Employee) {
    if (employee.nameRemark?.trim()) {
      return `${employee.name}（${employee.nameRemark.trim()}）`;
    }
    return employee.name;
  }

  private normalizeMobile(input: string | null | undefined) {
    if (!input) {
      return null;
    }
    const digits = input.replace(/[^\d]/g, '');
    if (!digits) {
      return null;
    }
    return digits.startsWith('86') && digits.length > 11 ? digits.slice(-11) : digits;
  }

  private matchesActionStatus(item: AiActionItem, query: QueryAiNextActionsDto) {
    if (item.processingStatus === 'deferred') {
      if (item.shouldReopen) {
        return true;
      }
      return Boolean(query.includeDeferred);
    }

    if (item.processingStatus === 'done' || item.processingStatus === 'ignored') {
      return Boolean(query.includeDone);
    }

    return true;
  }

  private async loadRecentActionStates() {
    const states = await this.aiActionStateRepository.find({
      order: {
        markedAt: 'DESC',
        id: 'DESC',
      },
      take: 8,
    });

    return states.map((item) => ({
      id: item.id,
      actionId: item.actionId,
      taskType: item.taskType,
      ownerRole: item.ownerRole,
      processingStatus: item.processingStatus,
      timeBucket: item.timeBucket ?? null,
      markedByName: item.markedByName ?? null,
      markedAt: item.markedAt.toISOString(),
      deferUntil: item.deferUntil?.toISOString() ?? null,
      reopenAt: item.reopenAt?.toISOString() ?? null,
      statusRemark: item.statusRemark ?? null,
    }));
  }

  private isDataCleanupCandidate(
    paymentStatus: unknown,
    sourceClassification: unknown,
    isTestData: unknown,
  ) {
    return (
      paymentStatus === 'unpaid' ||
      paymentStatus === 'unknown' ||
      paymentStatus === 'test_data' ||
      sourceClassification === 'test_data' ||
      sourceClassification === 'internal_admin' ||
      isTestData === true
    );
  }

  private readAmountField(record: Record<string, unknown> | null, amountField: string) {
    if (!record) return null;
    const value = record[amountField];
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value.toFixed(2) : null;
    }
    if (typeof value === 'string') {
      return value;
    }
    return null;
  }

  private sumAmounts(values: Array<string | null | undefined>) {
    let total = 0;
    let hasVisibleAmount = false;

    for (const value of values) {
      if (value === null || value === undefined || value === '') {
        continue;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        continue;
      }
      total += parsed;
      hasVisibleAmount = true;
    }

    return hasVisibleAmount ? total.toFixed(2) : null;
  }

  private buildDeadline(offsetDays: number, anchorNow: Date) {
    const deadline = new Date(anchorNow);
    deadline.setHours(23, 59, 59, 999);
    deadline.setDate(deadline.getDate() + offsetDays);
    return deadline.toISOString();
  }

  private displayAmountOrUnknown(value: string | null) {
    return value ? `${value} 元` : '按权限隐藏';
  }

  private async loadExternalCardSalesStagingWindow() {
    const periodStart = '2025-10';
    const periodEnd = '2026-03';
    const qb = this.externalCardSalesStagingRepository
      .createQueryBuilder('staging')
      .where('staging.periodKey >= :periodStart', { periodStart })
      .andWhere('staging.periodKey <= :periodEnd', { periodEnd });

    const [recordCount, latestRecord] = await Promise.all([
      qb.getCount(),
      qb.clone().orderBy('staging.importedAt', 'DESC').addOrderBy('staging.id', 'DESC').getOne(),
    ]);

    return {
      periodStart,
      periodEnd,
      recordCount,
      latestImportBatchNo: latestRecord?.importBatchNo ?? null,
      latestImportedAt: latestRecord?.importedAt?.toISOString() ?? null,
    };
  }
}
