import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createPool, Pool } from 'mysql2/promise';
import { Brackets, DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { OperationLog } from '../operation-logs/entities/operation-log.entity';
import { AiKnowledgeEntry } from '../ai/entities/ai-knowledge-entry.entity';
import { AiMemoryEntry } from '../ai/entities/ai-memory-entry.entity';
import { AiAssistantInteraction } from '../ai/entities/ai-assistant-interaction.entity';
import { AbcSyncCardLedger } from '../abc-sync/entities/abc-sync-card-ledger.entity';
import { AbcSyncCard } from '../abc-sync/entities/abc-sync-card.entity';
import { Employee } from '../performance/entities/employee.entity';
import { PerformanceSummaryManualDecision } from '../performance/entities/performance-summary-manual-decision.entity';
import { CancelAbcPointsCommandDto } from './dto/cancel-abc-points-command.dto';
import { CancelPointsCommandDto } from './dto/cancel-points-command.dto';
import { CancelPointsRedemptionDto } from './dto/cancel-points-redemption.dto';
import { CancelPointsWelfareBatchDto } from './dto/cancel-points-welfare-batch.dto';
import { ConfirmAbcPointsCommandDto } from './dto/confirm-abc-points-command.dto';
import { ConfirmPointsCommandDto } from './dto/confirm-points-command.dto';
import { ConfirmPointsRedemptionDto } from './dto/confirm-points-redemption.dto';
import { ConfirmPointsWelfareBatchDto } from './dto/confirm-points-welfare-batch.dto';
import { CreateAbcPointsCommandDraftDto } from './dto/create-abc-points-command-draft.dto';
import { CreatePointsCommandDraftDto } from './dto/create-points-command-draft.dto';
import { CreatePointsRedemptionDraftDto } from './dto/create-points-redemption-draft.dto';
import { CreatePointsWelfareBatchDraftDto } from './dto/create-points-welfare-batch-draft.dto';
import { ExecuteAbcPointsCommandDto } from './dto/execute-abc-points-command.dto';
import { ExecutePointsCommandDto } from './dto/execute-points-command.dto';
import { ExecutePointsWelfareBatchDto } from './dto/execute-points-welfare-batch.dto';
import { MarkPointsRedemptionFulfilledDto } from './dto/mark-points-redemption-fulfilled.dto';
import { MovePointsWelfareBatchItemDto } from './dto/move-points-welfare-batch-item.dto';
import { PatchPointsWelfareBatchItemDto } from './dto/patch-points-welfare-batch-item.dto';
import { QueryAbcPointsCommandsDto } from './dto/query-abc-points-commands.dto';
import { QueryAbcPointsLedgerDto } from './dto/query-abc-points-ledger.dto';
import { QueryPointsCommandsDto } from './dto/query-points-commands.dto';
import { QueryPointsLedgerDto } from './dto/query-points-ledger.dto';
import { QueryPointsRedeemablesDto } from './dto/query-points-redeemables.dto';
import { QueryPointsRedemptionsDto } from './dto/query-points-redemptions.dto';
import { QueryPointsWelfareBatchesDto } from './dto/query-points-welfare-batches.dto';
import { QueryPointsWelfareBatchItemsDto } from './dto/query-points-welfare-batch-items.dto';
import { QueryPointsWelfarePreviewDto } from './dto/query-points-welfare-preview.dto';
import {
  AbcPointsCommandRequest,
  AbcPointsCommandStatus,
  AbcPointsCommandType,
} from './entities/abc-points-command-request.entity';
import {
  PointsCommandBatch,
  PointsCommandBatchStatus,
} from './entities/points-command-batch.entity';
import { PointsCommandRequest } from './entities/points-command-request.entity';
import { PointsLedgerEntry } from './entities/points-ledger-entry.entity';
import { PointsRedeemable } from './entities/points-redeemable.entity';
import { PointsRedemptionRequest } from './entities/points-redemption-request.entity';
import {
  PointsWelfareBatchItem,
  PointsWelfareBatchItemAllocationMode,
} from './entities/points-welfare-batch-item.entity';

const COMMAND_SORT_COLUMNS: Record<string, string> = {
  commandType: 'command.command_type',
  commandStatus: 'command.command_status',
  requestedAt: 'command.requested_at',
  createdAt: 'command.created_at',
  updatedAt: 'command.updated_at',
  changeAmount: 'command.change_amount',
};

const ABC_POINTS_COMMAND_SORT_COLUMNS: Record<string, string> = {
  commandType: 'command.command_type',
  commandStatus: 'command.command_status',
  requestedAt: 'command.requested_at',
  createdAt: 'command.created_at',
  updatedAt: 'command.updated_at',
  changeAmount: 'command.change_amount',
};

const ABC_POINTS_FULL_ROLE_CODES = ['admin', 'founder', 'super_admin'] as const;

const LEDGER_SORT_COLUMNS: Record<string, string> = {
  executedAt: 'ledger.executed_at',
  createdAt: 'ledger.created_at',
  changeAmount: 'ledger.change_amount',
  balanceAfter: 'ledger.balance_after',
};

const BATCH_SORT_COLUMNS: Record<string, string> = {
  createdAt: 'batch.created_at',
  requestedAt: 'batch.requested_at',
  periodKey: 'batch.period_key',
  targetEmployeeCount: 'batch.target_employee_count',
  targetTotalAmount: 'batch.target_total_amount',
};

const REDEMPTION_SORT_COLUMNS: Record<string, string> = {
  requestStatus: 'request.request_status',
  requestedAt: 'request.requested_at',
  fulfilledAt: 'request.fulfilled_at',
  createdAt: 'request.created_at',
  updatedAt: 'request.updated_at',
  pointsCost: 'request.points_cost',
  targetValue: 'request.target_value',
};

const WELFARE_BATCH_ACTIVE_STATUSES: PointsCommandBatchStatus[] = [
  'drafted',
  'confirmed',
  'executed',
  'partially_executed',
];

type WelfarePreviewEmployeeRecord = {
  employeeId: number;
  employeeName: string;
  employeeMobile: string | null;
  companyName: string | null;
  positionName: string | null;
  enabledFlag: boolean;
  suggestedAmount: string;
  reasonSummary: string;
  exclusionReason?: string | null;
  exclusionDetail?: string | null;
  sourceRecord: Employee;
};

type WelfarePreviewResult = {
  periodKey: string;
  companyId: number | null;
  eligibleEmployees: Array<Record<string, unknown>>;
  excludedEmployees: Array<Record<string, unknown>>;
  targetEmployeeCount: number;
  targetTotalAmount: string;
  previewRules: string[];
  warnings: string[];
  meta: {
    duplicateMobiles: string[];
    existingCommandIds: number[];
    existingBatchId: number | null;
    companyScoped: boolean;
  };
  rawEligibleEmployees: WelfarePreviewEmployeeRecord[];
  rawExcludedEmployees: WelfarePreviewEmployeeRecord[];
};

type WelfareBatchAllocationSummary = {
  defaultCount: number;
  defaultTotal: string;
  customCount: number;
  customTotal: string;
  holdCount: number;
  holdTotal: string;
  excludedCount: number;
  excludedTotal: string;
  finalPlannedCount: number;
  finalPlannedTotal: string;
};

type RedemptionShadowUser = {
  id: string;
  name: string | null;
  mobile: string | null;
};

type RedemptionShadowMatchLevel = 'none' | 'possible' | 'stable';

type RedemptionShadowMatch = {
  matchLevel: RedemptionShadowMatchLevel;
  matchType: 'ledger' | 'card_account' | 'user_mobile' | null;
  matchReason: string;
  stableMatch: boolean;
  userMatchCount: number;
  cardMatchCount: number;
  ledgerMatchCount: number;
  matchedUser: RedemptionShadowUser | null;
  matchedCard: AbcSyncCard | null;
  matchedLedger: AbcSyncCardLedger | null;
  userMatches: RedemptionShadowUser[];
  cardCandidates: AbcSyncCard[];
  ledgerCandidates: AbcSyncCardLedger[];
};

type RedemptionReconciliationStatus =
  | 'waiting_confirmation'
  | 'waiting_fulfillment'
  | 'fulfilled_pending_consume'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'mismatch_needs_review';

type RedemptionExceptionFlag =
  | 'abc_fulfilled_but_no_consume'
  | 'consume_written_but_no_abc_fulfillment'
  | 'mobile_mapping_conflict'
  | 'duplicate_redemption_request'
  | 'stale_pending_fulfillment'
  | 'stale_confirmed_not_fulfilled'
  | 'external_record_missing'
  | 'other';

type RedemptionDerivedState = {
  reconciliationStatus: RedemptionReconciliationStatus;
  reconciliationReason: string;
  consumeLedgerEntry: Record<string, unknown> | null;
  matchedAbcShadowRecord: Record<string, unknown> | null;
  abcFulfillmentSummary: Record<string, unknown>;
  exceptionFlags: RedemptionExceptionFlag[];
  suggestedAction: string;
  nextStepAfterDone: string;
  auditTrail: Array<Record<string, unknown>>;
  executionTrace: Record<string, unknown>;
  ledgerSummary: Record<string, unknown>;
};

const REDEMPTION_STALE_HOURS = 72;
const ABC_SCORE_WRITE_PATH_STABLE = false;

type AbcPointsLedgerRow = {
  id: number;
  userId: number | null;
  ownerMobile: string | null;
  ownerName: string | null;
  pointsBefore: string | null;
  pointsAfter: string | null;
  changeAmount: string;
  info: string | null;
  orderId: number | null;
  goodsId: number | null;
  orderSn: string | null;
  goodsName: string | null;
  pointsOrderStatus: number | null;
  pointsOrderPayStatus: number | null;
  sourceType: string;
  createdAt: string | null;
};

type AbcPointsCommandPrecheckResult = 'pass' | 'warn' | 'fail';

type AbcPointsCommandPrecheckCheck = {
  checkName: string;
  checkResult: AbcPointsCommandPrecheckResult;
  checkReason: string;
};

type AbcPointsCommandPrecheck = {
  checkedAt: string;
  precheckStatus: AbcPointsCommandPrecheckResult;
  checks: AbcPointsCommandPrecheckCheck[];
  canExecute: boolean;
  blockedReason: string | null;
  blockedStage: string | null;
  remediationSuggestions: string[];
  hasUniqueUserMatch: boolean;
  matchedUserCount: number;
  matchedAbcUser: Record<string, unknown> | null;
  currentEnvironmentAllowsWrite: boolean;
  bridgeServiceAvailable: boolean;
  legacyRiskDetected: boolean;
};

type AbcPointsCommandPrecheckMode = 'full' | 'list_lite';

type AbcPointsCommandPrecheckBuildOptions = {
  abcUserCandidates?: Array<Record<string, unknown>>;
  checkedAt?: string;
  currentEnvironmentAllowsWrite?: boolean;
  bridgeServiceAvailable?: boolean;
  mode?: AbcPointsCommandPrecheckMode;
};

type AbcPointsCommandListBuildContextSource = Pick<
  AbcPointsCommandRequest,
  'ownerMobile' | 'providerKey'
>;

type AbcPointsCommandListBuildContext = {
  checkedAt: string;
  currentEnvironmentAllowsWrite: boolean;
  bridgeServiceAvailable: boolean;
  providerBridgeAvailabilityByKey: Map<string, boolean>;
  abcUserCandidatesByMobile: Map<string, Array<Record<string, unknown>>>;
};

type AbcPointsCommandProjectionPayload = {
  blockedReason: string | null;
};

type AbcPointsCommandListProjectionCandidate = Pick<
  AbcPointsCommandRequest,
  'id' | 'commandStatus' | 'ownerMobile' | 'providerKey' | 'sourceType'
> & {
  normalizedPayload: AbcPointsCommandProjectionPayload;
};

type AbcPointsCommandListBuildContextMetrics = {
  uniqueOwnerMobileCount: number;
  uniqueProviderKeyCount: number;
  abcLookupChunkCount: number;
  abcLookupMs: number;
};

type AbcPointsCommandListDiagnostics = {
  usedProjectionFirst: boolean;
  hasDerivedFilter: boolean;
  baseCandidateCount: number;
  projectedCandidateCount: number;
  filteredCandidateCount: number;
  pageResultCount: number;
  uniqueOwnerMobileCount: number;
  uniqueProviderKeyCount: number;
  abcLookupChunkCount: number;
  projectionBuildMs: number;
  abcLookupMs: number;
  derivedFilterMs: number;
  pageHydrateMs: number;
  listAssembleMs: number;
  totalMs: number;
  normalizedPayloadProjectionMode: 'not_used' | 'json_extract_blocked_reason_only';
};

type AbcPointsCommandPrecheckDerivedState = {
  ownerMobile: string | null;
  hasUniqueUserMatch: boolean;
  matchedUserCount: number;
  matchedAbcUser: Record<string, unknown> | null;
  currentEnvironmentAllowsWrite: boolean;
  bridgeServiceAvailable: boolean;
  legacyRiskDetected: boolean;
  statusAllowsExecute: boolean;
  blockedReason: string | null;
  blockedStage: string | null;
  canExecute: boolean;
};

type AbcPointsHandlingPlanSummarySource = {
  ownerMobilePresent: boolean;
  currentEnvironmentAllowsWrite: boolean;
  bridgeServiceAvailable: boolean;
  legacyRiskDetected: boolean;
  requiresHumanConfirmation: boolean;
};

type AbcPointsCommandListProjection = {
  id: number;
  commandStatus: AbcPointsCommandStatus;
  blockedReason: string | null;
  blockedStage: string | null;
  precheckStatus: AbcPointsCommandPrecheckResult;
  canExecute: boolean;
  hasUniqueUserMatch: boolean;
  matchedUserCount: number;
  blockedOnly: boolean;
  handlingPlanSummarySource: AbcPointsHandlingPlanSummarySource;
};

type AbcPointsHandlingPlanVisibilityScope = 'full' | 'restricted';

type AbcPointsHandlingPlanActionStatus =
  | 'pending'
  | 'ready'
  | 'blocked'
  | 'done'
  | 'not_applicable';

type AbcPointsHandlingPlanActionItem = {
  actionKey: string;
  title: string;
  description: string;
  status: AbcPointsHandlingPlanActionStatus;
  requiresHumanConfirmation: boolean;
  ownerScope: 'admin_founder' | 'authorized_roles' | 'human_review';
};

type AbcPointsHandlingPlan = {
  version: '3N.2';
  visibilityScope: AbcPointsHandlingPlanVisibilityScope;
  status: AbcPointsCommandStatus;
  summary: string;
  listSummary: string;
  diagnosis: {
    blockedReason: string | null;
    blockedStage: string | null;
    precheckStatus: AbcPointsCommandPrecheckResult;
    canExecute: boolean;
    commandExplanation: string;
    suggestedNextStep: string;
  };
  boundary: {
    executionBoundary: string;
    generalizationBoundary: string;
    payrollBoundary: string;
    humanConfirmationBoundary: string;
  };
  actionItems: AbcPointsHandlingPlanActionItem[];
  precheckSnapshot: {
    hasUniqueUserMatch: boolean;
    matchedUserCount: number;
    currentEnvironmentAllowsWrite: boolean;
    bridgeServiceAvailable: boolean;
    legacyRiskDetected: boolean;
    remediationSuggestions: string[];
    checks: AbcPointsCommandPrecheckCheck[];
  };
  aiDiagnosis: {
    assistantReply: string | null;
    answerSections: Array<Record<string, unknown>>;
    confidenceLevel: string | null;
  } | null;
};

@Injectable()
export class PointsService {
  private abcSourceReadonlyPool: Pool | null | undefined;

  constructor(
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
    @InjectRepository(AbcSyncCard)
    private readonly abcSyncCardRepository: Repository<AbcSyncCard>,
    @InjectRepository(AbcSyncCardLedger)
    private readonly abcSyncCardLedgerRepository: Repository<AbcSyncCardLedger>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(AiKnowledgeEntry)
    private readonly aiKnowledgeEntryRepository: Repository<AiKnowledgeEntry>,
    @InjectRepository(AiMemoryEntry)
    private readonly aiMemoryEntryRepository: Repository<AiMemoryEntry>,
    @InjectRepository(PerformanceSummaryManualDecision)
    private readonly performanceSummaryManualDecisionRepository: Repository<PerformanceSummaryManualDecision>,
    private readonly dataSource: DataSource,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async createDraft(dto: CreatePointsCommandDraftDto, currentUser: CurrentUser) {
    const ownerMobile = this.normalizeMobile(dto.ownerMobile ?? null);
    if (!dto.ownerId && !ownerMobile) {
      throw new BadRequestException('ownerId 或 ownerMobile 至少需要一个');
    }

    const amount = this.normalizeAmount(dto.changeAmount, false);
    const request = this.pointsCommandRepository.create({
      commandType: dto.commandType,
      commandStatus: 'drafted',
      ownerType: dto.ownerType,
      ownerId: dto.ownerId ?? null,
      ownerMobile,
      merchantId: dto.merchantId ?? null,
      batchId: dto.batchId ?? null,
      changeAmount: amount,
      sourceType: dto.sourceType,
      requestSource: dto.requestSource ?? (dto.providerKey ? 'ai_assistant_draft' : 'manual'),
      reasonCode: dto.reasonCode?.trim() || null,
      remark: dto.remark?.trim() || null,
      requestedBy: currentUser.id,
      requestedByName: currentUser.realName,
      requestedAt: new Date(),
      providerKey: dto.providerKey?.trim() || null,
      sourceActionId: dto.sourceActionId?.trim() || null,
      threadKey: dto.threadKey?.trim() || null,
      normalizedPayload: {
        ownerMobile,
        batchId: dto.batchId ?? null,
        sourceActionId: dto.sourceActionId?.trim() || null,
        threadKey: dto.threadKey?.trim() || null,
        providerKey: dto.providerKey?.trim() || null,
        sourceType: dto.sourceType,
        requestSource: dto.requestSource ?? (dto.providerKey ? 'ai_assistant_draft' : 'manual'),
        ...this.compactPayload(dto.normalizedPayload ?? {}),
      },
    });

    const saved = await this.pointsCommandRepository.save(request);
    await this.operationLogsService.create({
      module: 'points_commands',
      targetId: saved.id,
      action: 'draft',
      operatorId: currentUser.id,
      detail: `积点命令草稿已创建（${saved.commandType}）`,
      detailJson: {
        batchId: saved.batchId,
        commandStatus: saved.commandStatus,
        ownerType: saved.ownerType,
        ownerId: saved.ownerId,
        ownerMobile: saved.ownerMobile,
        changeAmount: saved.changeAmount,
        sourceType: saved.sourceType,
        requestSource: saved.requestSource,
      },
    });

    return saved;
  }

  async confirmCommand(id: number, dto: ConfirmPointsCommandDto, currentUser: CurrentUser) {
    const command = await this.findCommandOrFail(id);
    if (command.commandStatus === 'executed') {
      return command;
    }
    if (command.commandStatus === 'cancelled') {
      throw new BadRequestException('已取消命令不能再确认');
    }

    command.commandStatus = 'confirmed';
    command.confirmedBy = currentUser.id;
    command.confirmedByName = currentUser.realName;
    command.confirmedAt = new Date();
    command.normalizedPayload = {
      ...(command.normalizedPayload ?? {}),
      confirmRemark: dto.remark?.trim() || null,
    };
    const saved = await this.pointsCommandRepository.save(command);
    await this.operationLogsService.create({
      module: 'points_commands',
      targetId: saved.id,
      action: 'confirm',
      operatorId: currentUser.id,
      detail: '积点命令已人工确认',
      detailJson: {
        batchId: saved.batchId,
        commandStatus: saved.commandStatus,
        confirmRemark: dto.remark?.trim() || null,
      },
    });

    return saved;
  }

  async executeCommand(id: number, dto: ExecutePointsCommandDto, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      const commandRepo = manager.getRepository(PointsCommandRequest);
      const ledgerRepo = manager.getRepository(PointsLedgerEntry);
      const command = await commandRepo.findOne({ where: { id } });
      if (!command) {
        throw new NotFoundException('积点命令不存在');
      }

      const existingLedger = await ledgerRepo.findOne({
        where: {
          sourceType: 'points_command_request',
          sourceId: String(command.id),
        },
        order: {
          id: 'DESC',
        },
      });

      if (command.commandStatus === 'executed' && existingLedger) {
        return { command, ledgerEntry: existingLedger };
      }

      if (command.commandStatus !== 'confirmed') {
        throw new BadRequestException('仅已确认命令可以执行');
      }

      const currentBalance = await this.getLatestBalance(
        command.ownerType,
        command.ownerId,
        command.ownerMobile,
        ledgerRepo,
      );
      const delta = this.resolveLedgerDelta(command.commandType, command.changeAmount);
      const balanceAfter = currentBalance + delta;
      if (balanceAfter < 0) {
        throw new BadRequestException('执行后积点余额将为负数，命令被拒绝');
      }

      const now = new Date();
      const ledgerEntry = ledgerRepo.create({
        ownerType: command.ownerType,
        ownerId: command.ownerId,
        ownerMobile: command.ownerMobile,
        merchantId: command.merchantId,
        changeType: this.resolveLedgerChangeType(command.commandType),
        changeAmount: command.changeAmount,
        balanceAfter: balanceAfter.toFixed(2),
        sourceType: 'points_command_request',
        sourceId: String(command.id),
        sourceNo: `POINTS-CMD-${command.id}`,
        requestSource: command.requestSource,
        reasonCode: command.reasonCode,
        remark: dto.remark?.trim() || command.remark,
        executedBy: currentUser.id,
        executedByName: currentUser.realName,
        executedAt: now,
        approvedBy: command.confirmedBy,
        approvedByName: command.confirmedByName,
        approvedAt: command.confirmedAt,
        normalizedPayload: {
          batchId: command.batchId,
          commandType: command.commandType,
          sourceType: command.sourceType,
          providerKey: command.providerKey,
          sourceActionId: command.sourceActionId,
          threadKey: command.threadKey,
          requestedBy: command.requestedBy,
          requestedByName: command.requestedByName,
          requestSource: command.requestSource,
          executionRemark: dto.remark?.trim() || null,
        },
      });
      const savedLedger = await ledgerRepo.save(ledgerEntry);

      command.commandStatus = 'executed';
      command.executedBy = currentUser.id;
      command.executedByName = currentUser.realName;
      command.executedAt = now;
      command.normalizedPayload = {
        ...(command.normalizedPayload ?? {}),
        ledgerEntryId: savedLedger.id,
        executionRemark: dto.remark?.trim() || null,
      };
      const savedCommand = await commandRepo.save(command);

      await this.operationLogsService.create(
        {
          module: 'points_commands',
          targetId: savedCommand.id,
          action: 'execute',
          operatorId: currentUser.id,
          detail: '积点命令已执行并写入账本',
          detailJson: {
            batchId: savedCommand.batchId,
            commandStatus: savedCommand.commandStatus,
            ledgerEntryId: savedLedger.id,
            balanceAfter: savedLedger.balanceAfter,
          },
        },
        manager,
      );

      return {
        command: savedCommand,
        ledgerEntry: savedLedger,
      };
    });
  }

  async cancelCommand(id: number, dto: CancelPointsCommandDto, currentUser: CurrentUser) {
    const command = await this.findCommandOrFail(id);
    if (command.commandStatus === 'executed') {
      throw new BadRequestException('已执行命令不能取消');
    }
    if (command.commandStatus === 'cancelled') {
      return command;
    }

    command.commandStatus = 'cancelled';
    command.cancelledBy = currentUser.id;
    command.cancelledByName = currentUser.realName;
    command.cancelledAt = new Date();
    command.normalizedPayload = {
      ...(command.normalizedPayload ?? {}),
      cancelRemark: dto.remark?.trim() || null,
    };
    const saved = await this.pointsCommandRepository.save(command);
    await this.operationLogsService.create({
      module: 'points_commands',
      targetId: saved.id,
      action: 'cancel',
      operatorId: currentUser.id,
      detail: '积点命令已取消',
      detailJson: {
        batchId: saved.batchId,
        commandStatus: saved.commandStatus,
        cancelRemark: dto.remark?.trim() || null,
      },
    });

    return saved;
  }

  async findCommands(query: QueryPointsCommandsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.pointsCommandRepository.createQueryBuilder('command');
    if (query.commandStatus) {
      qb.andWhere('command.command_status = :commandStatus', {
        commandStatus: query.commandStatus,
      });
    }
    if (query.commandType) {
      qb.andWhere('command.command_type = :commandType', {
        commandType: query.commandType,
      });
    }
    if (query.sourceType) {
      qb.andWhere('command.source_type = :sourceType', { sourceType: query.sourceType });
    }
    if (query.requestSource) {
      qb.andWhere('command.request_source = :requestSource', {
        requestSource: query.requestSource,
      });
    }
    if (query.ownerType) {
      qb.andWhere('command.owner_type = :ownerType', { ownerType: query.ownerType });
    }
    if (query.ownerMobile) {
      qb.andWhere('command.owner_mobile = :ownerMobile', {
        ownerMobile: this.normalizeMobile(query.ownerMobile),
      });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        COMMAND_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list.map((item) => this.mapCommand(item)), total);
  }

  async findLedger(query: QueryPointsLedgerDto) {
    const { skip, take } = getPagination(query);
    const qb = this.pointsLedgerRepository.createQueryBuilder('ledger');
    if (query.ownerType) {
      qb.andWhere('ledger.owner_type = :ownerType', { ownerType: query.ownerType });
    }
    if (query.ownerMobile) {
      qb.andWhere('ledger.owner_mobile = :ownerMobile', {
        ownerMobile: this.normalizeMobile(query.ownerMobile),
      });
    }
    if (query.sourceType) {
      qb.andWhere('ledger.source_type = :sourceType', { sourceType: query.sourceType });
    }
    if (query.sourceId) {
      qb.andWhere('ledger.source_id = :sourceId', { sourceId: query.sourceId });
    }
    if (query.changeType) {
      qb.andWhere('ledger.change_type = :changeType', { changeType: query.changeType });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        LEDGER_SORT_COLUMNS[query.sortBy ?? 'executedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list.map((item) => this.mapLedgerEntry(item)), total);
  }

  async findRedeemables(query: QueryPointsRedeemablesDto) {
    const qb = this.pointsRedeemableRepository.createQueryBuilder('redeemable');
    qb.where('redeemable.enabled_flag = :enabledFlag', { enabledFlag: true });

    if (query.redeemableType) {
      qb.andWhere('redeemable.redeemable_type = :redeemableType', {
        redeemableType: query.redeemableType,
      });
    }
    if (query.providerSystem) {
      qb.andWhere('redeemable.provider_system = :providerSystem', {
        providerSystem: query.providerSystem,
      });
    }
    if (query.sceneScope) {
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('redeemable.scene_scope IS NULL')
            .orWhere('redeemable.scene_scope = :sceneScope', {
              sceneScope: query.sceneScope,
            });
        }),
      );
    }

    const list = await qb
      .orderBy('redeemable.redeemable_type', 'ASC')
      .addOrderBy('redeemable.id', 'ASC')
      .getMany();

    return {
      list: list.map((item) => this.mapRedeemable(item)),
      total: list.length,
    };
  }

  async createRedemptionDraft(
    dto: CreatePointsRedemptionDraftDto,
    currentUser: CurrentUser,
  ) {
    const redeemable = await this.findRedeemableByCodeOrFail(dto.redeemableCode);
    const ownerMobile = this.normalizeMobile(dto.ownerMobile ?? null);
    if (!dto.ownerId && !ownerMobile) {
      throw new BadRequestException('ownerId 或 ownerMobile 至少需要一个');
    }

    const pointsCost = this.normalizeAmount(dto.pointsCost, false);
    const targetValue = this.normalizeAmount(dto.targetValue, false);
    const request = this.pointsRedemptionRepository.create({
      requestStatus: 'drafted',
      ownerType: dto.ownerType,
      ownerId: dto.ownerId ?? null,
      ownerMobile,
      redeemableType: redeemable.redeemableType,
      redeemableCode: redeemable.redeemableCode,
      redeemableName: redeemable.redeemableName,
      pointsCost,
      targetValue,
      providerSystem: redeemable.providerSystem,
      requestSource: dto.requestSource ?? (dto.providerKey ? 'ai_assistant_draft' : 'manual'),
      requestedBy: currentUser.id,
      requestedByName: currentUser.realName,
      requestedAt: new Date(),
      providerKey: dto.providerKey?.trim() || null,
      sourceActionId: dto.sourceActionId?.trim() || null,
      threadKey: dto.threadKey?.trim() || null,
      reasonCode: dto.reasonCode?.trim() || null,
      remark: dto.remark?.trim() || null,
      normalizedPayload: {
        ownerMobile,
        providerEntityId: redeemable.providerEntityId,
        redeemableSnapshot: this.mapRedeemable(redeemable),
        sourceActionId: dto.sourceActionId?.trim() || null,
        threadKey: dto.threadKey?.trim() || null,
        providerKey: dto.providerKey?.trim() || null,
        requestSource: dto.requestSource ?? (dto.providerKey ? 'ai_assistant_draft' : 'manual'),
        requestStatusBefore: null,
        ...this.compactPayload(dto.normalizedPayload ?? {}),
      },
    });

    const saved = await this.pointsRedemptionRepository.save(request);
    await this.operationLogsService.create({
      module: 'points_redemptions',
      targetId: saved.id,
      action: 'draft',
      operatorId: currentUser.id,
      detail: `积点兑换草稿已创建（${saved.redeemableName}）`,
      detailJson: {
        requestStatus: saved.requestStatus,
        ownerType: saved.ownerType,
        ownerId: saved.ownerId,
        ownerMobile: saved.ownerMobile,
        redeemableCode: saved.redeemableCode,
        redeemableName: saved.redeemableName,
        pointsCost: saved.pointsCost,
        targetValue: saved.targetValue,
        requestSource: saved.requestSource,
      },
    });

    return this.getRedemptionDetail(saved.id);
  }

  async confirmRedemption(
    id: number,
    dto: ConfirmPointsRedemptionDto,
    currentUser: CurrentUser,
  ) {
    const request = await this.findRedemptionOrFail(id);
    if (request.requestStatus === 'completed') {
      return this.getRedemptionDetail(id);
    }
    if (request.requestStatus === 'cancelled') {
      throw new BadRequestException('已取消的兑换请求不能再确认');
    }
    if (request.requestStatus === 'pending_fulfillment') {
      return this.getRedemptionDetail(id);
    }

    const previousStatus = request.requestStatus;
    request.requestStatus = 'pending_fulfillment';
    request.confirmedBy = currentUser.id;
    request.confirmedByName = currentUser.realName;
    request.confirmedAt = new Date();
    request.normalizedPayload = {
      ...(request.normalizedPayload ?? {}),
      confirmRemark: dto.remark?.trim() || null,
      requestStatusBefore: previousStatus,
    };
    await this.pointsRedemptionRepository.save(request);

    await this.operationLogsService.create({
      module: 'points_redemptions',
      targetId: request.id,
      action: 'confirm',
      operatorId: currentUser.id,
      detail: '积点兑换请求已人工确认，等待 ABC 履约',
      detailJson: {
        requestStatus: request.requestStatus,
        confirmRemark: dto.remark?.trim() || null,
      },
    });

    return this.getRedemptionDetail(id);
  }

  async markRedemptionFulfilled(
    id: number,
    dto: MarkPointsRedemptionFulfilledDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(PointsRedemptionRequest);
      const ledgerRepo = manager.getRepository(PointsLedgerEntry);
      const request = await requestRepo.findOne({ where: { id } });
      if (!request) {
        throw new NotFoundException('积点兑换请求不存在');
      }
      if (request.requestStatus === 'cancelled') {
        throw new BadRequestException('已取消的兑换请求不能再标记履约');
      }
      if (request.requestStatus === 'drafted') {
        throw new BadRequestException('请先确认兑换请求，再标记履约');
      }
      if (!dto.externalEntityId?.trim() && !dto.externalNo?.trim()) {
        throw new BadRequestException('externalEntityId 或 externalNo 至少需要一个');
      }

      const existingLedger = await ledgerRepo.findOne({
        where: {
          sourceType: 'points_redemption_request',
          sourceId: String(request.id),
        },
        order: { id: 'DESC' },
      });
      if (request.requestStatus === 'completed' && existingLedger) {
        return this.getRedemptionDetail(id);
      }

      const currentBalance = await this.getLatestBalance(
        request.ownerType,
        request.ownerId,
        request.ownerMobile,
        ledgerRepo,
      );
      const consumeAmount = Number(request.pointsCost || 0);
      const balanceAfter = currentBalance - consumeAmount;
      if (balanceAfter < 0) {
        throw new BadRequestException('当前积点余额不足，不能完成兑换履约');
      }

      const now = new Date();
      let ledgerEntry = existingLedger;
      if (!ledgerEntry) {
        ledgerEntry = ledgerRepo.create({
          ownerType: request.ownerType,
          ownerId: request.ownerId,
          ownerMobile: request.ownerMobile,
          merchantId: null,
          changeType: 'consume',
          changeAmount: request.pointsCost,
          balanceAfter: balanceAfter.toFixed(2),
          sourceType: 'points_redemption_request',
          sourceId: String(request.id),
          sourceNo: dto.externalNo?.trim() || `POINTS-REDEEM-${request.id}`,
          requestSource: request.requestSource,
          reasonCode: request.reasonCode,
          remark: dto.remark?.trim() || request.remark,
          executedBy: currentUser.id,
          executedByName: currentUser.realName,
          executedAt: now,
          approvedBy: request.confirmedBy,
          approvedByName: request.confirmedByName,
          approvedAt: request.confirmedAt,
          normalizedPayload: {
            redeemableType: request.redeemableType,
            redeemableCode: request.redeemableCode,
            redeemableName: request.redeemableName,
            providerSystem: request.providerSystem,
            externalEntityId: dto.externalEntityId?.trim() || null,
            externalNo: dto.externalNo?.trim() || null,
            targetValue: request.targetValue,
          },
        });
        ledgerEntry = await ledgerRepo.save(ledgerEntry);
      }

      const previousStatus = request.requestStatus;
      request.requestStatus = 'completed';
      request.fulfilledBy = currentUser.id;
      request.fulfilledByName = currentUser.realName;
      request.fulfilledAt = now;
      request.externalEntityId = dto.externalEntityId?.trim() || request.externalEntityId;
      request.externalNo = dto.externalNo?.trim() || request.externalNo;
      request.normalizedPayload = {
        ...(request.normalizedPayload ?? {}),
        fulfilledRemark: dto.remark?.trim() || null,
        requestStatusBefore: previousStatus,
        fulfilledInAbcAt: now.toISOString(),
        consumeLedgerEntryId: ledgerEntry.id,
        externalEntityId: dto.externalEntityId?.trim() || null,
        externalNo: dto.externalNo?.trim() || null,
      };
      await requestRepo.save(request);

      return this.getRedemptionDetail(id);
    }).then(async (detail) => {
      await this.operationLogsService.create({
        module: 'points_redemptions',
        targetId: id,
        action: 'mark_fulfilled',
        operatorId: currentUser.id,
        detail: '积点兑换请求已在 ABC 手工履约，并已回写总部 consume ledger',
        detailJson: {
          externalEntityId: dto.externalEntityId?.trim() || null,
          externalNo: dto.externalNo?.trim() || null,
          remark: dto.remark?.trim() || null,
        },
      });
      return detail;
    });
  }

  async cancelRedemption(
    id: number,
    dto: CancelPointsRedemptionDto,
    currentUser: CurrentUser,
  ) {
    const request = await this.findRedemptionOrFail(id);
    if (request.requestStatus === 'completed' || request.requestStatus === 'fulfilled_in_abc') {
      throw new BadRequestException('已履约或已完成的兑换请求不能直接取消，请走反向命令');
    }
    if (request.requestStatus === 'cancelled') {
      return this.getRedemptionDetail(id);
    }

    const previousStatus = request.requestStatus;
    request.requestStatus = 'cancelled';
    request.cancelledBy = currentUser.id;
    request.cancelledByName = currentUser.realName;
    request.cancelledAt = new Date();
    request.normalizedPayload = {
      ...(request.normalizedPayload ?? {}),
      cancelRemark: dto.remark?.trim() || null,
      requestStatusBefore: previousStatus,
    };
    await this.pointsRedemptionRepository.save(request);

    await this.operationLogsService.create({
      module: 'points_redemptions',
      targetId: id,
      action: 'cancel',
      operatorId: currentUser.id,
      detail: '积点兑换请求已取消',
      detailJson: {
        requestStatus: request.requestStatus,
        cancelRemark: dto.remark?.trim() || null,
      },
    });

    return this.getRedemptionDetail(id);
  }

  async findRedemptions(query: QueryPointsRedemptionsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.pointsRedemptionRepository.createQueryBuilder('request');
    const requestStatuses = this.parseCsvFilter(query.requestStatus);
    if (requestStatuses.length) {
      qb.andWhere('request.request_status IN (:...requestStatuses)', {
        requestStatuses,
      });
    }
    if (query.redeemableType) {
      qb.andWhere('request.redeemable_type = :redeemableType', {
        redeemableType: query.redeemableType,
      });
    }
    if (query.redeemableCode) {
      qb.andWhere('request.redeemable_code = :redeemableCode', {
        redeemableCode: query.redeemableCode,
      });
    }
    const providerSystem = query.providerSystem?.trim() || query.sourceType?.trim() || null;
    if (providerSystem) {
      qb.andWhere('request.provider_system = :providerSystem', {
        providerSystem,
      });
    }
    if (query.requestSource) {
      qb.andWhere('request.request_source = :requestSource', {
        requestSource: query.requestSource,
      });
    }
    if (query.ownerType) {
      qb.andWhere('request.owner_type = :ownerType', { ownerType: query.ownerType });
    }
    if (query.ownerMobile) {
      qb.andWhere('request.owner_mobile = :ownerMobile', {
        ownerMobile: this.normalizeMobile(query.ownerMobile),
      });
    }
    if (query.periodKey) {
      qb.andWhere(
        `DATE_FORMAT(COALESCE(request.fulfilled_at, request.requested_at, request.created_at), '%Y-%m') = :periodKey`,
        {
          periodKey: query.periodKey,
        },
      );
    }
    if (query.dateFrom) {
      qb.andWhere(
        'COALESCE(request.fulfilled_at, request.requested_at, request.created_at) >= :dateFrom',
        {
          dateFrom: query.dateFrom,
        },
      );
    }
    if (query.dateTo) {
      qb.andWhere(
        'COALESCE(request.fulfilled_at, request.requested_at, request.created_at) <= :dateTo',
        {
          dateTo: query.dateTo,
        },
      );
    }

    const requests = await qb
      .clone()
      .orderBy(
        REDEMPTION_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .addOrderBy('request.id', 'DESC')
      .getMany();

    const redemptionIds = requests.map((item) => String(item.id));
    const relatedLedgerEntries = redemptionIds.length
      ? await this.pointsLedgerRepository.find({
          where: {
            sourceType: 'points_redemption_request',
            sourceId: In(redemptionIds),
          },
          order: {
            executedAt: 'DESC',
            id: 'DESC',
          },
        })
      : [];
    const ledgerByRequestId = relatedLedgerEntries.reduce((map, item) => {
      if (!item.sourceId) {
        return map;
      }
      const group = map.get(item.sourceId) ?? [];
      group.push(item);
      map.set(item.sourceId, group);
      return map;
    }, new Map<string, PointsLedgerEntry[]>());
    const redeemableCodes = [...new Set(requests.map((item) => item.redeemableCode).filter(Boolean))];
    const redeemables = redeemableCodes.length
      ? await this.pointsRedeemableRepository.find({
          where: {
            redeemableCode: In(redeemableCodes),
          },
        })
      : [];
    const redeemableMap = new Map(
      redeemables.map((item) => [item.redeemableCode, item] as const),
    );

    const list = await Promise.all(
      requests.map(async (item) =>
        this.buildRedemptionListItem(
          item,
          ledgerByRequestId.get(String(item.id)) ?? [],
          redeemableMap.get(item.redeemableCode) ?? null,
        ),
      ),
    );

    let filtered = list;
    const reconciliationStatuses = this.parseCsvFilter(query.reconciliationStatus);
    if (reconciliationStatuses.length) {
      filtered = filtered.filter((item) =>
        reconciliationStatuses.includes(String(item.reconciliationStatus ?? '')),
      );
    }
    const exceptionFlags = this.parseCsvFilter(query.exceptionFlag);
    if (exceptionFlags.length) {
      filtered = filtered.filter((item) =>
        exceptionFlags.some((flag) => (item.exceptionFlags as string[] | undefined)?.includes(flag)),
      );
    }
    const hasConsumeLedger = this.parseBooleanQuery(query.hasConsumeLedger);
    if (hasConsumeLedger !== null) {
      filtered = filtered.filter((item) => Boolean(item.consumeLedgerEntry) === hasConsumeLedger);
    }
    const fulfilledOnly = this.parseBooleanQuery(query.fulfilledOnly);
    if (fulfilledOnly === true) {
      filtered = filtered.filter((item) =>
        ['fulfilled_in_abc', 'completed'].includes(String(item.requestStatus ?? '')) ||
        Boolean(item.fulfilledAt),
      );
    }

    const total = filtered.length;
    return buildPaginationResult(query, filtered.slice(skip, skip + take), total);
  }

  async getRedemptionDetail(id: number) {
    const request = await this.findRedemptionOrFail(id);
    const [redeemable, relatedLedgerEntries, operationLogs, interactionHistory] = await Promise.all([
      this.pointsRedeemableRepository.findOne({ where: { redeemableCode: request.redeemableCode } }),
      this.pointsLedgerRepository.find({
        where: {
          sourceType: 'points_redemption_request',
          sourceId: String(request.id),
        },
        order: {
          executedAt: 'DESC',
          id: 'DESC',
        },
      }),
      this.dataSource.getRepository(OperationLog).find({
        where: {
          module: 'points_redemptions',
          targetId: request.id,
        },
        order: {
          createdAt: 'DESC',
          id: 'DESC',
        },
      }),
      request.threadKey
        ? this.dataSource.getRepository(AiAssistantInteraction).find({
            where: { threadKey: request.threadKey },
            order: {
              createdAt: 'DESC',
              id: 'DESC',
            },
            take: 12,
          })
        : Promise.resolve([]),
    ]);

    return this.buildRedemptionDetailResponse(
      request,
      redeemable,
      relatedLedgerEntries,
      operationLogs,
      interactionHistory,
    );
  }

  async getCommandDetail(id: number) {
    const command = await this.findCommandOrFail(id);
    const [relatedLedgerEntries, operationLogs, interactionHistory] = await Promise.all([
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
      this.dataSource.getRepository(OperationLog).find({
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
        ? this.dataSource.getRepository(AiAssistantInteraction).find({
            where: { threadKey: command.threadKey },
            order: {
              createdAt: 'DESC',
              id: 'DESC',
            },
            take: 12,
          })
        : Promise.resolve([]),
    ]);

    return {
      command: this.mapCommand(command),
      commandType: command.commandType,
      commandStatus: command.commandStatus,
      ownerType: command.ownerType,
      ownerId: command.ownerId,
      ownerMobile: command.ownerMobile,
      merchantId: command.merchantId,
      batchId: command.batchId,
      changeAmount: command.changeAmount,
      sourceType: command.sourceType,
      requestSource: command.requestSource,
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
      providerKey: command.providerKey ?? null,
      sourceActionId: command.sourceActionId ?? null,
      threadKey: command.threadKey ?? null,
      reasonCode: command.reasonCode ?? null,
      remark: command.remark ?? null,
      affectPerformanceFlag: this.resolveCommandAffectFlag(command, 'affectPerformanceFlag'),
      affectBCardFlag: this.resolveCommandAffectFlag(command, 'affectBCardFlag'),
      normalizedPayload: command.normalizedPayload ?? {},
      relatedLedgerEntries: relatedLedgerEntries.map((item) => this.mapLedgerEntry(item)),
      executionTrace: {
        drafted: {
          requestedBy: command.requestedBy,
          requestedByName: command.requestedByName,
          requestedAt: command.requestedAt?.toISOString() ?? null,
          requestSource: command.requestSource,
          providerKey: command.providerKey ?? null,
          sourceActionId: command.sourceActionId ?? null,
          threadKey: command.threadKey ?? null,
          batchId: command.batchId ?? null,
        },
        confirmed:
          command.confirmedAt || command.confirmedBy
            ? {
                confirmedBy: command.confirmedBy,
                confirmedByName: command.confirmedByName,
                confirmedAt: command.confirmedAt?.toISOString() ?? null,
                remark: this.readPayloadString(command.normalizedPayload, 'confirmRemark'),
              }
            : null,
        executed:
          command.executedAt || command.executedBy
            ? {
                executedBy: command.executedBy,
                executedByName: command.executedByName,
                executedAt: command.executedAt?.toISOString() ?? null,
                remark:
                  this.readPayloadString(command.normalizedPayload, 'executionRemark') ??
                  command.remark ??
                  null,
              }
            : null,
        cancelled:
          command.cancelledAt || command.cancelledBy
            ? {
                cancelledBy: command.cancelledBy,
                cancelledByName: command.cancelledByName,
                cancelledAt: command.cancelledAt?.toISOString() ?? null,
                remark: this.readPayloadString(command.normalizedPayload, 'cancelRemark'),
              }
            : null,
        operationLogs: operationLogs.map((item) => ({
          id: item.id,
          action: item.action,
          detail: item.detail,
          detailJson: item.detailJson ?? {},
          operatorId: item.operatorId,
          createdAt: item.createdAt?.toISOString?.() ?? null,
        })),
        interactionHistory: interactionHistory.map((item) => ({
          id: item.id,
          threadKey: item.threadKey,
          routePath: item.routePath,
          entityType: item.entityType ?? null,
          entityId: item.entityId ?? null,
          providerKey: item.providerKey ?? null,
          userMessage: item.userMessage,
          assistantReply: item.assistantReply,
          createdBy: item.createdBy ?? null,
          createdByName: item.createdByName ?? null,
          createdAt: item.createdAt?.toISOString?.() ?? null,
          suggestedActions: Array.isArray(item.suggestedActions) ? item.suggestedActions : [],
          suggestedCommandDraft:
            item.suggestedCommandDraft && typeof item.suggestedCommandDraft === 'object'
              ? item.suggestedCommandDraft
              : null,
          normalizedPayload: item.normalizedPayload ?? {},
        })),
      },
    };
  }

  async getAbcPointsOverview() {
    const pool = this.getAbcSourceReadonlyPool();
    if (!pool) {
      throw new BadRequestException('ABC 积分只读源库未配置，无法生成总览');
    }

    const [balanceRowsRaw] = await pool.query(
      `
        SELECT
          COUNT(CASE WHEN COALESCE(points, 0) > 0 OR COALESCE(exchange_points, 0) > 0 THEN 1 END) AS usersWithPositivePoints,
          CAST(COALESCE(SUM(points), 0) AS DECIMAL(18, 2)) AS totalPoints,
          CAST(COALESCE(SUM(exchange_points), 0) AS DECIMAL(18, 2)) AS totalExchangePoints
        FROM user_account
      `,
    );
    const balanceRows = balanceRowsRaw as Array<{
      usersWithPositivePoints: number;
      totalPoints: string | null;
      totalExchangePoints: string | null;
    }>;
    const [logRowsRaw] = await pool.query(
      `SELECT COUNT(*) AS totalLogs FROM points_log`,
    );
    const logRows = logRowsRaw as Array<{ totalLogs: number }>;
    const [orderRowsRaw] = await pool.query(
      `SELECT COUNT(*) AS totalOrders FROM points_order`,
    );
    const orderRows = orderRowsRaw as Array<{ totalOrders: number }>;
    const [goodsRowsRaw] = await pool.query(
      `SELECT COUNT(*) AS totalGoods FROM point_goods`,
    );
    const goodsRows = goodsRowsRaw as Array<{ totalGoods: number }>;
    const [sourceRowsRaw] = await pool.query(
      `
        SELECT
          ${this.buildAbcScoreSourceTypeCaseSql('log')} AS sourceType,
          COUNT(*) AS rowCount,
          CAST(
            COALESCE(
              SUM(COALESCE(log.points_after, 0) - COALESCE(log.points_before, 0)),
              0
            ) AS DECIMAL(18, 2)
          ) AS totalChange
        FROM points_log log
        LEFT JOIN points_order pointsOrder ON pointsOrder.id = log.order_id
        LEFT JOIN point_goods goods ON goods.id = COALESCE(log.goods_id, pointsOrder.goods_id)
        GROUP BY sourceType
        ORDER BY rowCount DESC, sourceType ASC
      `,
    );
    const sourceRows = sourceRowsRaw as Array<{
      sourceType: string;
      rowCount: number;
      totalChange: string | null;
    }>;
    const [recentRowsRaw] = await pool.query(
      `
        SELECT
          log.id AS id,
          log.user_id AS userId,
          userAccount.mobile AS mobile,
          userAccount.nickname AS nickname,
          CAST(log.points_before AS DECIMAL(18, 2)) AS pointsBefore,
          CAST(log.points_after AS DECIMAL(18, 2)) AS pointsAfter,
          CAST(
            COALESCE(log.points_after, 0) - COALESCE(log.points_before, 0) AS DECIMAL(18, 2)
          ) AS changeAmount,
          log.info AS info,
          DATE_FORMAT(log.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
          ${this.buildAbcScoreSourceTypeCaseSql('log')} AS sourceType
        FROM points_log log
        LEFT JOIN user_account userAccount ON userAccount.id = log.user_id
        LEFT JOIN points_order pointsOrder ON pointsOrder.id = log.order_id
        LEFT JOIN point_goods goods ON goods.id = COALESCE(log.goods_id, pointsOrder.goods_id)
        ORDER BY log.created_at DESC, log.id DESC
        LIMIT 10
      `,
    );
    const recentRows = recentRowsRaw as Array<{
      id: number;
      userId: number | null;
      mobile: string | null;
      nickname: string | null;
      pointsBefore: string | null;
      pointsAfter: string | null;
      changeAmount: string | null;
      info: string | null;
      createdAt: string | null;
      sourceType: string;
    }>;

    const balanceSummary = balanceRows[0] ?? {
      usersWithPositivePoints: 0,
      totalPoints: '0.00',
      totalExchangePoints: '0.00',
    };

    return {
      rewardDomain: 'abc_score',
      sourceOfTruth: 'ABC',
      writePathStable: ABC_SCORE_WRITE_PATH_STABLE,
      executionMode: ABC_SCORE_WRITE_PATH_STABLE ? 'controlled_write' : 'draft_confirm_blocked',
      summaryCards: [
        {
          key: 'abcScoreBalance',
          title: 'ABC 积分余额账户',
          value: Number(balanceSummary.usersWithPositivePoints ?? 0),
          subtitle: '当前 ABC 用户中有积分余额或兑换积分余额的账户数',
        },
        {
          key: 'abcScoreTotalPoints',
          title: 'ABC 当前积分余额',
          value: this.normalizeDecimalString(balanceSummary.totalPoints),
          subtitle: '来自 ABC user_account.points，只读展示',
        },
        {
          key: 'abcScoreExchangePoints',
          title: 'ABC 兑换积分余额',
          value: this.normalizeDecimalString(balanceSummary.totalExchangePoints),
          subtitle: '来自 ABC user_account.exchange_points，只读展示',
        },
        {
          key: 'abcScoreLogs',
          title: 'ABC 积分流水',
          value: Number(logRows[0]?.totalLogs ?? 0),
          subtitle: '来自 ABC points_log',
        },
      ],
      sourceBreakdown: sourceRows.map((item) => ({
        sourceType: item.sourceType,
        rowCount: Number(item.rowCount ?? 0),
        totalChange: this.normalizeDecimalString(item.totalChange),
      })),
      dataFootprint: {
        totalLogs: Number(logRows[0]?.totalLogs ?? 0),
        totalOrders: Number(orderRows[0]?.totalOrders ?? 0),
        totalGoods: Number(goodsRows[0]?.totalGoods ?? 0),
      },
      reconciliationNotes: [
        '总部系统管理的是“积点”（hq_points），ABC 系统管理的是“积分”（abc_score）。',
        'ABC 积分当前先做只读发现和受控命令草稿；如果写入路径未稳定确认，执行必须停在 blocked。',
        '历史管理员直接改库属于 legacy_db_direct 遗留方式，不能作为后续正式操作路径。',
      ],
      recentLedgerPreview: recentRows.map((item) => ({
        id: item.id,
        userId: item.userId,
        ownerMobile: item.mobile,
        ownerName: item.nickname,
        pointsBefore: this.normalizeDecimalString(item.pointsBefore),
        pointsAfter: this.normalizeDecimalString(item.pointsAfter),
        changeAmount: this.normalizeDecimalString(item.changeAmount),
        info: item.info,
        createdAt: item.createdAt,
        sourceType: item.sourceType,
      })),
    };
  }

  async findAbcPointsLedger(query: QueryAbcPointsLedgerDto) {
    const pool = this.getAbcSourceReadonlyPool();
    if (!pool) {
      throw new BadRequestException('ABC 积分只读源库未配置，无法查询流水');
    }

    const { skip, take } = getPagination(query);
    const whereClauses = ['1 = 1'];
    const params: Array<string | number> = [];
    const sourceTypeCaseSql = this.buildAbcScoreSourceTypeCaseSql('log');

    if (query.ownerMobile?.trim()) {
      whereClauses.push('userAccount.mobile = ?');
      params.push(this.normalizeMobile(query.ownerMobile) ?? query.ownerMobile.trim());
    }
    if (query.sourceType?.trim()) {
      whereClauses.push(`${sourceTypeCaseSql} = ?`);
      params.push(query.sourceType.trim());
    }
    if (query.periodKey?.trim()) {
      whereClauses.push(`DATE_FORMAT(log.created_at, '%Y-%m') = ?`);
      params.push(query.periodKey.trim());
    }
    if (query.dateFrom?.trim()) {
      whereClauses.push('log.created_at >= ?');
      params.push(query.dateFrom.trim());
    }
    if (query.dateTo?.trim()) {
      whereClauses.push('log.created_at <= ?');
      params.push(query.dateTo.trim());
    }
    if (query.keyword?.trim()) {
      whereClauses.push(
        '(log.info LIKE ? OR userAccount.nickname LIKE ? OR pointGoods.name LIKE ? OR pointsOrder.sn LIKE ?)',
      );
      const keyword = `%${query.keyword.trim()}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    const whereSql = whereClauses.join(' AND ');
    const [countRowsRaw] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM points_log log
        LEFT JOIN user_account userAccount ON userAccount.id = log.user_id
        LEFT JOIN points_order pointsOrder ON pointsOrder.id = log.order_id
        LEFT JOIN point_goods pointGoods ON pointGoods.id = COALESCE(log.goods_id, pointsOrder.goods_id)
        WHERE ${whereSql}
      `,
      params,
    );
    const countRows = countRowsRaw as Array<{ total: number }>;

    const [rowsRaw] = await pool.query(
      `
        SELECT
          log.id AS id,
          log.user_id AS userId,
          userAccount.mobile AS ownerMobile,
          userAccount.nickname AS ownerName,
          CAST(log.points_before AS DECIMAL(18, 2)) AS pointsBefore,
          CAST(log.points_after AS DECIMAL(18, 2)) AS pointsAfter,
          log.info AS info,
          log.order_id AS orderId,
          log.goods_id AS goodsId,
          pointsOrder.sn AS orderSn,
          pointGoods.name AS goodsName,
          pointsOrder.status AS pointsOrderStatus,
          pointsOrder.pay_status AS pointsOrderPayStatus,
          ${sourceTypeCaseSql} AS sourceType,
          DATE_FORMAT(log.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
        FROM points_log log
        LEFT JOIN user_account userAccount ON userAccount.id = log.user_id
        LEFT JOIN points_order pointsOrder ON pointsOrder.id = log.order_id
        LEFT JOIN point_goods pointGoods ON pointGoods.id = COALESCE(log.goods_id, pointsOrder.goods_id)
        WHERE ${whereSql}
        ORDER BY log.created_at DESC, log.id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, take, skip],
    );
    const rows = rowsRaw as Array<{
      id: number;
      userId: number | null;
      ownerMobile: string | null;
      ownerName: string | null;
      pointsBefore: string | null;
      pointsAfter: string | null;
      info: string | null;
      orderId: number | null;
      goodsId: number | null;
      orderSn: string | null;
      goodsName: string | null;
      pointsOrderStatus: number | null;
      pointsOrderPayStatus: number | null;
      sourceType: string;
      createdAt: string | null;
    }>;

    const list = rows.map((item) =>
      this.mapAbcPointsLedgerRow({
        ...item,
        changeAmount: this.calculateAbcPointsDelta(item.pointsBefore, item.pointsAfter),
      }),
    );

    return buildPaginationResult(query, list, Number(countRows[0]?.total ?? 0));
  }

  async createAbcPointsCommandDraft(
    dto: CreateAbcPointsCommandDraftDto,
    currentUser: CurrentUser,
  ) {
    const ownerMobile = this.normalizeMobile(dto.ownerMobile ?? null);
    if (!dto.ownerId && !ownerMobile) {
      throw new BadRequestException('ownerId 或 ownerMobile 至少需要一个');
    }

    const amount = this.normalizeAmount(dto.changeAmount, false);
    const request = this.abcPointsCommandRepository.create({
      commandType: dto.commandType,
      commandStatus: 'drafted',
      ownerType: dto.ownerType,
      ownerId: dto.ownerId ?? null,
      ownerMobile,
      changeAmount: amount,
      sourceType: dto.sourceType,
      requestSource: dto.requestSource ?? (dto.providerKey ? 'ai_assistant_draft' : 'manual'),
      reasonCode: dto.reasonCode?.trim() || null,
      remark: dto.remark?.trim() || null,
      requestedBy: currentUser.id,
      requestedByName: currentUser.realName,
      requestedAt: new Date(),
      providerKey: dto.providerKey?.trim() || null,
      sourceActionId: dto.sourceActionId?.trim() || null,
      threadKey: dto.threadKey?.trim() || null,
      normalizedPayload: {
        rewardDomain: 'abc_score',
        sourceOfTruth: 'ABC',
        writePathStable: ABC_SCORE_WRITE_PATH_STABLE,
        blockedReason: ABC_SCORE_WRITE_PATH_STABLE ? null : 'abc_score_write_path_not_stable',
        ownerMobile,
        sourceType: dto.sourceType,
        requestSource: dto.requestSource ?? (dto.providerKey ? 'ai_assistant_draft' : 'manual'),
        sourceActionId: dto.sourceActionId?.trim() || null,
        threadKey: dto.threadKey?.trim() || null,
        providerKey: dto.providerKey?.trim() || null,
        ...this.compactPayload(dto.normalizedPayload ?? {}),
      },
    });

    const saved = await this.abcPointsCommandRepository.save(request);
    await this.operationLogsService.create({
      module: 'abc_points_commands',
      targetId: saved.id,
      action: 'draft',
      operatorId: currentUser.id,
      detail: `ABC 积分命令草稿已创建（${saved.commandType}）`,
      detailJson: {
        commandStatus: saved.commandStatus,
        ownerType: saved.ownerType,
        ownerId: saved.ownerId,
        ownerMobile: saved.ownerMobile,
        changeAmount: saved.changeAmount,
        sourceType: saved.sourceType,
        requestSource: saved.requestSource,
        writePathStable: ABC_SCORE_WRITE_PATH_STABLE,
      },
    });

    return this.getAbcPointsCommandDetail(saved.id, currentUser);
  }

  async confirmAbcPointsCommand(
    id: number,
    dto: ConfirmAbcPointsCommandDto,
    currentUser: CurrentUser,
  ) {
    const command = await this.findAbcPointsCommandOrFail(id);
    if (command.commandStatus === 'executed') {
      return this.getAbcPointsCommandDetail(id, currentUser);
    }
    if (command.commandStatus === 'cancelled') {
      throw new BadRequestException('已取消的 ABC 积分命令不能再确认');
    }

    command.commandStatus = 'confirmed';
    command.confirmedBy = currentUser.id;
    command.confirmedByName = currentUser.realName;
    command.confirmedAt = new Date();
    command.normalizedPayload = {
      ...(command.normalizedPayload ?? {}),
      confirmRemark: dto.remark?.trim() || null,
    };
    await this.abcPointsCommandRepository.save(command);
    await this.operationLogsService.create({
      module: 'abc_points_commands',
      targetId: command.id,
      action: 'confirm',
      operatorId: currentUser.id,
      detail: 'ABC 积分命令已人工确认',
      detailJson: {
        commandStatus: command.commandStatus,
        confirmRemark: dto.remark?.trim() || null,
      },
    });

    return this.getAbcPointsCommandDetail(id, currentUser);
  }

  async executeAbcPointsCommand(
    id: number,
    dto: ExecuteAbcPointsCommandDto,
    currentUser: CurrentUser,
  ) {
    const command = await this.findAbcPointsCommandOrFail(id);
    if (command.commandStatus === 'executed') {
      return this.getAbcPointsCommandDetail(id, currentUser);
    }
    if (command.commandStatus === 'cancelled') {
      throw new BadRequestException('已取消的 ABC 积分命令不能执行');
    }
    if (command.commandStatus !== 'confirmed' && command.commandStatus !== 'blocked') {
      throw new BadRequestException('仅已确认的 ABC 积分命令可以尝试执行');
    }

    if (!ABC_SCORE_WRITE_PATH_STABLE) {
      command.commandStatus = 'blocked';
      command.executedBy = currentUser.id;
      command.executedByName = currentUser.realName;
      command.executedAt = new Date();
      command.normalizedPayload = {
        ...(command.normalizedPayload ?? {}),
        blockedReason: 'abc_score_write_path_not_stable',
        blockedRemark:
          dto.remark?.trim() ||
          '当前 ABC 积分写入路径尚未稳定验证，本轮只允许草拟与确认，不允许假执行。',
        blockedAt: new Date().toISOString(),
      };
      await this.abcPointsCommandRepository.save(command);
      await this.operationLogsService.create({
        module: 'abc_points_commands',
        targetId: command.id,
        action: 'execute_blocked',
        operatorId: currentUser.id,
        detail: 'ABC 积分命令执行被阻塞：写入路径未稳定',
        detailJson: {
          commandStatus: command.commandStatus,
          blockedReason: 'abc_score_write_path_not_stable',
          blockedRemark:
            dto.remark?.trim() ||
            '当前 ABC 积分写入路径尚未稳定验证，本轮只允许草拟与确认，不允许假执行。',
        },
      });
      return this.getAbcPointsCommandDetail(id, currentUser);
    }

    throw new BadRequestException('当前版本未启用 ABC 积分受控写入');
  }

  async cancelAbcPointsCommand(
    id: number,
    dto: CancelAbcPointsCommandDto,
    currentUser: CurrentUser,
  ) {
    const command = await this.findAbcPointsCommandOrFail(id);
    if (command.commandStatus === 'executed') {
      throw new BadRequestException('已执行的 ABC 积分命令不能取消');
    }
    if (command.commandStatus === 'cancelled') {
      return this.getAbcPointsCommandDetail(id, currentUser);
    }

    command.commandStatus = 'cancelled';
    command.cancelledBy = currentUser.id;
    command.cancelledByName = currentUser.realName;
    command.cancelledAt = new Date();
    command.normalizedPayload = {
      ...(command.normalizedPayload ?? {}),
      cancelRemark: dto.remark?.trim() || null,
    };
    await this.abcPointsCommandRepository.save(command);
    await this.operationLogsService.create({
      module: 'abc_points_commands',
      targetId: command.id,
      action: 'cancel',
      operatorId: currentUser.id,
      detail: 'ABC 积分命令已取消',
      detailJson: {
        commandStatus: command.commandStatus,
        cancelRemark: dto.remark?.trim() || null,
      },
    });

    return this.getAbcPointsCommandDetail(id, currentUser);
  }

  async findAbcPointsCommands(query: QueryAbcPointsCommandsDto, currentUser?: CurrentUser) {
    const totalStartedAt = Date.now();
    const { skip, take } = getPagination(query);
    const qb = this.abcPointsCommandRepository.createQueryBuilder('command');
    const blockedReasonFilter = query.blockedReason?.trim() || null;
    if (query.commandStatus?.trim()) {
      qb.andWhere('command.command_status = :commandStatus', {
        commandStatus: query.commandStatus.trim(),
      });
    }
    if (query.sourceType?.trim()) {
      qb.andWhere('command.source_type = :sourceType', {
        sourceType: query.sourceType.trim(),
      });
    }
    if (query.requestSource?.trim()) {
      qb.andWhere('command.request_source = :requestSource', {
        requestSource: query.requestSource.trim(),
      });
    }
    if (query.providerKey?.trim()) {
      qb.andWhere('command.provider_key = :providerKey', {
        providerKey: query.providerKey.trim(),
      });
    }
    if (query.ownerMobile?.trim()) {
      qb.andWhere('command.owner_mobile = :ownerMobile', {
        ownerMobile: this.normalizeMobile(query.ownerMobile) ?? query.ownerMobile.trim(),
      });
    }
    if (this.parseBooleanQuery(query.blockedOnly) === true) {
      qb.andWhere('command.command_status = :blockedStatus', { blockedStatus: 'blocked' });
    }
    if (query.periodKey?.trim()) {
      qb.andWhere(`DATE_FORMAT(COALESCE(command.executed_at, command.requested_at, command.created_at), '%Y-%m') = :periodKey`, {
        periodKey: query.periodKey.trim(),
      });
    }
    if (query.dateFrom?.trim()) {
      qb.andWhere('COALESCE(command.executed_at, command.requested_at, command.created_at) >= :dateFrom', {
        dateFrom: query.dateFrom.trim(),
      });
    }
    if (query.dateTo?.trim()) {
      qb.andWhere('COALESCE(command.executed_at, command.requested_at, command.created_at) <= :dateTo', {
        dateTo: query.dateTo.trim(),
      });
    }

    const sortColumn =
      ABC_POINTS_COMMAND_SORT_COLUMNS[query.sortBy ?? 'createdAt'] ??
      ABC_POINTS_COMMAND_SORT_COLUMNS.createdAt;
    const sortOrder = this.normalizeSortOrder(query.sortOrder, 'DESC');
    const uniqueUserMatchFilter = this.parseBooleanQuery(query.hasUniqueUserMatch);
    const canExecuteFilter = this.parseBooleanQuery(query.canExecute);
    const requiresDerivedFilter =
      blockedReasonFilter !== null ||
      uniqueUserMatchFilter !== null ||
      canExecuteFilter !== null;
    const diagnostics = this.shouldIncludeAbcPointsCommandListDiagnostics(query, currentUser)
      ? this.createAbcPointsCommandListDiagnostics(requiresDerivedFilter)
      : null;

    if (requiresDerivedFilter) {
      const projectionBuildStartedAt = Date.now();
      const candidates = await this.findAbcPointsCommandListProjectionCandidates(
        qb,
        sortColumn,
        sortOrder,
      );
      const { buildContext, projections, metrics } =
        await this.buildAbcPointsCommandListProjections(candidates);
      if (diagnostics) {
        diagnostics.baseCandidateCount = candidates.length;
        diagnostics.projectedCandidateCount = projections.length;
        diagnostics.uniqueOwnerMobileCount = metrics.uniqueOwnerMobileCount;
        diagnostics.uniqueProviderKeyCount = metrics.uniqueProviderKeyCount;
        diagnostics.abcLookupChunkCount = metrics.abcLookupChunkCount;
        diagnostics.abcLookupMs = metrics.abcLookupMs;
        diagnostics.projectionBuildMs = Date.now() - projectionBuildStartedAt;
      }

      const derivedFilterStartedAt = Date.now();
      const filtered = projections.filter((item) =>
        this.matchesAbcPointsCommandDerivedFilters(item, {
          blockedReasonFilter,
          uniqueUserMatchFilter,
          canExecuteFilter,
        }),
      );
      if (diagnostics) {
        diagnostics.filteredCandidateCount = filtered.length;
        diagnostics.derivedFilterMs = Date.now() - derivedFilterStartedAt;
      }

      const pageHydrateStartedAt = Date.now();
      const pageIds = filtered.slice(skip, skip + take).map((item) => item.id);
      const pageCommands = await this.findAbcPointsCommandsByIds(pageIds);
      const hydrated = await this.buildAbcPointsCommandListItems(
        pageCommands,
        currentUser,
        buildContext ?? undefined,
      );
      if (diagnostics) {
        diagnostics.pageResultCount = hydrated.length;
        diagnostics.pageHydrateMs = Date.now() - pageHydrateStartedAt;
      }

      return this.buildAbcPointsCommandListResult(
        query,
        hydrated,
        filtered.length,
        diagnostics,
        totalStartedAt,
      );
    }

    const pageHydrateStartedAt = Date.now();
    const [list, total] = await qb
      .orderBy(sortColumn, sortOrder)
      .addOrderBy('command.id', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    const hydrated = await this.buildAbcPointsCommandListItems(list, currentUser);
    if (diagnostics) {
      diagnostics.baseCandidateCount = total;
      diagnostics.filteredCandidateCount = total;
      diagnostics.pageResultCount = hydrated.length;
      diagnostics.pageHydrateMs = Date.now() - pageHydrateStartedAt;
    }

    return this.buildAbcPointsCommandListResult(
      query,
      hydrated,
      total,
      diagnostics,
      totalStartedAt,
    );
  }

  async getAbcPointsCommandDetail(id: number, currentUser?: CurrentUser) {
    const command = await this.findAbcPointsCommandOrFail(id);
    const [operationLogs, interactionHistory, abcUserCandidates] = await Promise.all([
      this.dataSource.getRepository(OperationLog).find({
        where: {
          module: 'abc_points_commands',
          targetId: command.id,
        },
        order: {
          createdAt: 'DESC',
          id: 'DESC',
        },
      }),
      command.threadKey
        ? this.dataSource.getRepository(AiAssistantInteraction).find({
            where: { threadKey: command.threadKey },
            order: { createdAt: 'DESC', id: 'DESC' },
            take: 12,
          })
        : Promise.resolve([]),
      this.findAbcUsersByMobile(command.ownerMobile),
    ]);

    const payload = (command.normalizedPayload ?? {}) as Record<string, unknown>;
    const writePathStable =
      typeof payload.writePathStable === 'boolean'
        ? payload.writePathStable
        : ABC_SCORE_WRITE_PATH_STABLE;
    const writePathPrecheck = await this.buildAbcPointsCommandPrecheck(
      command,
      {
        abcUserCandidates,
        mode: 'full',
      },
    );
    const citations = await this.buildAbcPointsCommandCitations(command, currentUser);
    const handlingPlan = this.buildAbcPointsHandlingPlan(
      command,
      writePathPrecheck,
      currentUser,
    );
    const executionCapability = this.resolveAbcPointsExecutionCapability(
      command,
      writePathPrecheck,
    );
    const legacyWritePathPrecheck = this.buildAbcPointsLegacyPrecheckView(
      writePathPrecheck,
      handlingPlan,
    );
    const legacyCitations = this.buildAbcPointsLegacyCitationsView(citations, handlingPlan);
    const auditTrail = operationLogs.map((item) => ({
      id: item.id,
      action: item.action,
      detail: item.detail,
      detailJson: item.detailJson ?? {},
      operatorId: item.operatorId,
      createdAt: item.createdAt?.toISOString?.() ?? null,
    }));
    const executionTrace = {
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
        command.confirmedAt || command.confirmedBy
          ? {
              confirmedBy: command.confirmedBy,
              confirmedByName: command.confirmedByName,
              confirmedAt: command.confirmedAt?.toISOString() ?? null,
              remark: this.readPayloadString(payload, 'confirmRemark'),
            }
          : null,
      blocked:
        command.commandStatus === 'blocked'
          ? {
              blockedReason: handlingPlan.diagnosis.blockedReason,
              blockedStage: handlingPlan.diagnosis.blockedStage,
              blockedRemark: this.readPayloadString(payload, 'blockedRemark') ?? null,
              blockedAt:
                this.readPayloadString(payload, 'blockedAt') ??
                command.executedAt?.toISOString() ??
                null,
            }
          : null,
      cancelled:
        command.cancelledAt || command.cancelledBy
          ? {
              cancelledBy: command.cancelledBy,
              cancelledByName: command.cancelledByName,
              cancelledAt: command.cancelledAt?.toISOString() ?? null,
              remark: this.readPayloadString(payload, 'cancelRemark'),
            }
          : null,
      operationLogs: operationLogs.map((item) => ({
        id: item.id,
        action: item.action,
        detail: item.detail,
        detailJson: item.detailJson ?? {},
        operatorId: item.operatorId,
        createdAt: item.createdAt?.toISOString?.() ?? null,
      })),
      interactionHistory: interactionHistory.map((item) => ({
        id: item.id,
        threadKey: item.threadKey,
        routePath: item.routePath,
        entityType: item.entityType ?? null,
        entityId: item.entityId ?? null,
        providerKey: item.providerKey ?? null,
        userMessage: item.userMessage,
        assistantReply: item.assistantReply,
        createdBy: item.createdBy ?? null,
        createdAt: item.createdAt?.toISOString?.() ?? null,
      })),
    };

    return {
      command: {
        ...this.mapAbcPointsCommand(command),
        blockedReason: handlingPlan.diagnosis.blockedReason,
        executionCapability: this.buildAbcPointsLegacyExecutionCapability(
          executionCapability,
          handlingPlan,
        ),
      },
      rewardDomain: 'abc_score',
      sourceOfTruth: 'ABC',
      commandType: command.commandType,
      commandStatus: command.commandStatus,
      ownerType: command.ownerType,
      ownerId: command.ownerId,
      ownerMobile: command.ownerMobile,
      changeAmount: command.changeAmount,
      sourceType: command.sourceType,
      requestSource: command.requestSource,
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
      providerKey: command.providerKey ?? null,
      sourceActionId: command.sourceActionId ?? null,
      threadKey: command.threadKey ?? null,
      reasonCode: command.reasonCode ?? null,
      remark: command.remark ?? null,
      writePathStable,
      blockedReason: handlingPlan.diagnosis.blockedReason,
      blockedStage: handlingPlan.diagnosis.blockedStage,
      writePathPrecheck: legacyWritePathPrecheck,
      executionCapability: this.buildAbcPointsLegacyExecutionCapability(
        executionCapability,
        handlingPlan,
      ),
      commandExplanation: handlingPlan.summary,
      suggestedNextStep: handlingPlan.diagnosis.suggestedNextStep,
      generalizationBoundary: handlingPlan.boundary.generalizationBoundary,
      handlingPlan,
      ...legacyCitations,
      abcShadowOwner: this.buildAbcPointsLegacyShadowOwnerView(
        abcUserCandidates,
        handlingPlan,
      ),
      auditTrail: this.buildAbcPointsLegacyAuditTrailView(auditTrail, handlingPlan),
      executionTrace: this.buildAbcPointsLegacyExecutionTraceView(
        executionTrace,
        handlingPlan,
      ),
      normalizedPayload: payload,
    };
  }

  private async buildRedemptionListItem(
    request: PointsRedemptionRequest,
    relatedLedgerEntries: PointsLedgerEntry[],
    redeemable: PointsRedeemable | null,
  ) {
    const derived = await this.buildRedemptionDerivedState(
      request,
      relatedLedgerEntries,
      [],
      [],
      redeemable,
    );

    return {
      ...this.mapRedemption(request),
      requestStatus: request.requestStatus,
      ownerType: request.ownerType,
      ownerId: request.ownerId,
      ownerMobile: request.ownerMobile,
      redeemableType: request.redeemableType,
      redeemableCode: request.redeemableCode,
      redeemableName: request.redeemableName,
      pointsCost: request.pointsCost,
      targetValue: request.targetValue,
      providerSystem: request.providerSystem,
      requestSource: request.requestSource,
      requestedByName: request.requestedByName,
      requestedAt: request.requestedAt?.toISOString() ?? null,
      confirmedByName: request.confirmedByName,
      confirmedAt: request.confirmedAt?.toISOString() ?? null,
      fulfilledByName: request.fulfilledByName,
      fulfilledAt: request.fulfilledAt?.toISOString() ?? null,
      cancelledByName: request.cancelledByName,
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
      externalEntityId: request.externalEntityId ?? null,
      externalNo: request.externalNo ?? null,
      reconciliationStatus: derived.reconciliationStatus,
      reconciliationReason: derived.reconciliationReason,
      consumeLedgerEntry: derived.consumeLedgerEntry,
      matchedAbcShadowRecord: derived.matchedAbcShadowRecord,
      abcFulfillmentSummary: derived.abcFulfillmentSummary,
      exceptionFlags: derived.exceptionFlags,
      nextStepAfterDone: derived.nextStepAfterDone,
      suggestedAction: derived.suggestedAction,
      hasConsumeLedger: Boolean(derived.consumeLedgerEntry),
      ledgerSummary: derived.ledgerSummary,
    };
  }

  private async buildRedemptionDetailResponse(
    request: PointsRedemptionRequest,
    redeemable: PointsRedeemable | null,
    relatedLedgerEntries: PointsLedgerEntry[],
    operationLogs: OperationLog[],
    interactionHistory: AiAssistantInteraction[],
  ) {
    const derived = await this.buildRedemptionDerivedState(
      request,
      relatedLedgerEntries,
      operationLogs,
      interactionHistory,
      redeemable,
    );

    return {
      request: this.mapRedemption(request),
      requestStatus: request.requestStatus,
      ownerType: request.ownerType,
      ownerId: request.ownerId,
      ownerMobile: request.ownerMobile,
      redeemableType: request.redeemableType,
      redeemableCode: request.redeemableCode,
      redeemableName: request.redeemableName,
      pointsCost: request.pointsCost,
      targetValue: request.targetValue,
      providerSystem: request.providerSystem,
      requestSource: request.requestSource,
      requestedBy: request.requestedBy,
      requestedByName: request.requestedByName,
      requestedAt: request.requestedAt?.toISOString() ?? null,
      confirmedBy: request.confirmedBy,
      confirmedByName: request.confirmedByName,
      confirmedAt: request.confirmedAt?.toISOString() ?? null,
      fulfilledBy: request.fulfilledBy,
      fulfilledByName: request.fulfilledByName,
      fulfilledAt: request.fulfilledAt?.toISOString() ?? null,
      cancelledBy: request.cancelledBy,
      cancelledByName: request.cancelledByName,
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
      providerKey: request.providerKey ?? null,
      sourceActionId: request.sourceActionId ?? null,
      threadKey: request.threadKey ?? null,
      externalEntityId: request.externalEntityId ?? null,
      externalNo: request.externalNo ?? null,
      reasonCode: request.reasonCode ?? null,
      remark: request.remark ?? null,
      normalizedPayload: request.normalizedPayload ?? {},
      affectPerformanceFlag: this.resolveRedemptionAffectFlag(
        request,
        'affectPerformanceFlag',
      ),
      affectBCardFlag: this.resolveRedemptionAffectFlag(request, 'affectBCardFlag'),
      redeemable: redeemable ? this.mapRedeemable(redeemable) : null,
      relatedLedgerEntries: relatedLedgerEntries.map((item) => this.mapLedgerEntry(item)),
      reconciliationStatus: derived.reconciliationStatus,
      reconciliationReason: derived.reconciliationReason,
      consumeLedgerEntry: derived.consumeLedgerEntry,
      matchedAbcShadowRecord: derived.matchedAbcShadowRecord,
      abcFulfillmentSummary: derived.abcFulfillmentSummary,
      exceptionFlags: derived.exceptionFlags,
      suggestedAction: derived.suggestedAction,
      nextStepAfterDone: derived.nextStepAfterDone,
      ledgerSummary: derived.ledgerSummary,
      executionTrace: derived.executionTrace,
      auditTrail: derived.auditTrail,
    };
  }

  private async buildRedemptionDerivedState(
    request: PointsRedemptionRequest,
    relatedLedgerEntries: PointsLedgerEntry[],
    operationLogs: OperationLog[],
    interactionHistory: AiAssistantInteraction[],
    redeemable: PointsRedeemable | null,
  ): Promise<RedemptionDerivedState> {
    const latestLedger = relatedLedgerEntries[0] ?? null;
    const consumeLedger =
      relatedLedgerEntries.find((item) => item.changeType === 'consume') ?? null;
    const currentBalance = await this.getLatestBalance(
      request.ownerType,
      request.ownerId,
      request.ownerMobile,
      this.pointsLedgerRepository,
    );
    const shadowMatch = await this.loadRedemptionShadowMatch(request, redeemable);
    const duplicateCount = await this.countDuplicateRedemptionRequests(request);
    const exceptionFlags = this.deriveRedemptionExceptionFlags(
      request,
      shadowMatch,
      consumeLedger,
      duplicateCount,
    );
    const reconciliationStatus = this.deriveRedemptionReconciliationStatus(
      request,
      shadowMatch,
      consumeLedger,
      exceptionFlags,
    );
    const reconciliationReason = this.buildRedemptionReconciliationReason(
      request,
      shadowMatch,
      consumeLedger,
      exceptionFlags,
    );
    const consumeLedgerEntry = consumeLedger ? this.mapLedgerEntry(consumeLedger) : null;

    return {
      reconciliationStatus,
      reconciliationReason,
      consumeLedgerEntry,
      matchedAbcShadowRecord: this.buildRedemptionMatchedShadowRecord(shadowMatch),
      abcFulfillmentSummary: this.buildRedemptionAbcFulfillmentSummary(
        request,
        shadowMatch,
      ),
      exceptionFlags,
      suggestedAction: this.buildRedemptionSuggestedAction(
        reconciliationStatus,
        exceptionFlags,
      ),
      nextStepAfterDone: this.buildRedemptionNextStepAfterDone(reconciliationStatus),
      ledgerSummary: {
        entryCount: relatedLedgerEntries.length,
        latestBalanceAfter: latestLedger?.balanceAfter ?? null,
        currentKnownBalance: currentBalance.toFixed(2),
        consumedAmount: relatedLedgerEntries
          .filter((item) => item.changeType === 'consume')
          .reduce((sum, item) => sum + Number(item.changeAmount || 0), 0)
          .toFixed(2),
      },
      executionTrace: this.buildRedemptionExecutionTrace(
        request,
        operationLogs,
        interactionHistory,
        shadowMatch,
        consumeLedger,
      ),
      auditTrail: this.buildRedemptionAuditTrail(
        request,
        operationLogs,
        consumeLedger,
        exceptionFlags,
      ),
    };
  }

  private async loadRedemptionShadowMatch(
    request: PointsRedemptionRequest,
    redeemable: PointsRedeemable | null,
  ): Promise<RedemptionShadowMatch> {
    const ownerMobile = this.normalizeMobile(request.ownerMobile);
    const userMatches = ownerMobile ? await this.loadAbcUsersByMobile(ownerMobile) : [];
    const matchedUser = userMatches.length === 1 ? userMatches[0] : null;
    const providerEntityId =
      redeemable?.providerEntityId?.trim() ||
      this.readPayloadString(redeemable?.normalizedPayload ?? null, 'providerEntityId') ||
      null;
    const exactExternalEntityId = request.externalEntityId?.trim() || null;
    const exactExternalNo = request.externalNo?.trim() || null;

    let cardCandidates: AbcSyncCard[] = [];
    let ledgerCandidates: AbcSyncCardLedger[] = [];
    if (matchedUser?.id) {
      const cardWhere = this.abcSyncCardRepository
        .createQueryBuilder('card')
        .where('card.source_table = :sourceTable', { sourceTable: 'user_shopping_card' })
        .andWhere('card.source_user_id = :sourceUserId', { sourceUserId: matchedUser.id });

      if (providerEntityId) {
        cardWhere.andWhere('card.source_card_id = :sourceCardId', {
          sourceCardId: providerEntityId,
        });
      }
      if (exactExternalEntityId) {
        cardWhere.andWhere(
          new Brackets((qb) => {
            qb.where('card.source_id = :sourceId', { sourceId: exactExternalEntityId }).orWhere(
              'card.source_order_no = :sourceOrderNo',
              { sourceOrderNo: exactExternalEntityId },
            );
          }),
        );
      }
      cardCandidates = await cardWhere
        .orderBy('card.mapping_confirmed', 'DESC')
        .addOrderBy('card.synced_at', 'DESC')
        .addOrderBy('card.id', 'DESC')
        .take(10)
        .getMany();

      const ledgerWhere = this.abcSyncCardLedgerRepository
        .createQueryBuilder('ledger')
        .where('ledger.source_user_id = :sourceUserId', { sourceUserId: matchedUser.id });
      if (providerEntityId) {
        ledgerWhere.andWhere(
          new Brackets((qb) => {
            qb.where('ledger.related_card_source_id = :relatedCardSourceId', {
              relatedCardSourceId: providerEntityId,
            }).orWhere(`JSON_UNQUOTE(JSON_EXTRACT(ledger.normalized_payload, '$.card_id')) = :payloadCardId`, {
              payloadCardId: providerEntityId,
            });
          }),
        );
      }
      if (exactExternalEntityId || exactExternalNo) {
        ledgerWhere.andWhere(
          new Brackets((qb) => {
            if (exactExternalEntityId) {
              qb.where('ledger.source_id = :sourceId', { sourceId: exactExternalEntityId }).orWhere(
                'ledger.related_card_source_id = :relatedCardSourceIdExact',
                { relatedCardSourceIdExact: exactExternalEntityId },
              );
            }
            if (exactExternalNo) {
              qb.orWhere('ledger.source_order_no = :sourceOrderNo', {
                sourceOrderNo: exactExternalNo,
              }).orWhere('ledger.related_order_no = :relatedOrderNo', {
                relatedOrderNo: exactExternalNo,
              });
            }
          }),
        );
      }
      ledgerCandidates = await ledgerWhere
        .orderBy('ledger.mapping_confirmed', 'DESC')
        .addOrderBy('ledger.synced_at', 'DESC')
        .addOrderBy('ledger.id', 'DESC')
        .take(12)
        .getMany();
    }

    const exactLedgerMatches = ledgerCandidates.filter((item) =>
      (exactExternalEntityId && item.sourceId === exactExternalEntityId) ||
      (exactExternalNo &&
        [item.sourceOrderNo, item.relatedOrderNo].filter(Boolean).includes(exactExternalNo)),
    );
    const exactCardMatches = cardCandidates.filter((item) =>
      (exactExternalEntityId && item.sourceId === exactExternalEntityId) ||
      (exactExternalNo && item.sourceOrderNo === exactExternalNo),
    );

    if (exactLedgerMatches.length === 1) {
      return {
        matchLevel: 'stable',
        matchType: 'ledger',
        matchReason: '已通过 ABC 外部实体号/单号稳定命中影子流水记录',
        stableMatch: true,
        userMatchCount: userMatches.length,
        cardMatchCount: cardCandidates.length,
        ledgerMatchCount: ledgerCandidates.length,
        matchedUser,
        matchedCard: null,
        matchedLedger: exactLedgerMatches[0],
        userMatches,
        cardCandidates,
        ledgerCandidates,
      };
    }

    if (exactCardMatches.length === 1) {
      return {
        matchLevel: 'stable',
        matchType: 'card_account',
        matchReason: '已通过 ABC 外部实体号稳定命中持卡影子记录',
        stableMatch: true,
        userMatchCount: userMatches.length,
        cardMatchCount: cardCandidates.length,
        ledgerMatchCount: ledgerCandidates.length,
        matchedUser,
        matchedCard: exactCardMatches[0],
        matchedLedger: null,
        userMatches,
        cardCandidates,
        ledgerCandidates,
      };
    }

    if (matchedUser && cardCandidates.length === 1) {
      return {
        matchLevel: 'possible',
        matchType: 'card_account',
        matchReason: '已通过手机号与卡类型唯一命中 ABC 持卡影子记录，但仍建议人工核对',
        stableMatch: false,
        userMatchCount: userMatches.length,
        cardMatchCount: cardCandidates.length,
        ledgerMatchCount: ledgerCandidates.length,
        matchedUser,
        matchedCard: cardCandidates[0],
        matchedLedger: ledgerCandidates[0] ?? null,
        userMatches,
        cardCandidates,
        ledgerCandidates,
      };
    }

    if (matchedUser) {
      return {
        matchLevel: 'possible',
        matchType: 'user_mobile',
        matchReason: '已通过手机号锁定唯一 ABC 用户，但购物卡影子记录仍需人工确认',
        stableMatch: false,
        userMatchCount: userMatches.length,
        cardMatchCount: cardCandidates.length,
        ledgerMatchCount: ledgerCandidates.length,
        matchedUser,
        matchedCard: cardCandidates[0] ?? null,
        matchedLedger: ledgerCandidates[0] ?? null,
        userMatches,
        cardCandidates,
        ledgerCandidates,
      };
    }

    return {
      matchLevel: 'none',
      matchType: null,
      matchReason: ownerMobile
        ? '当前未找到可稳定映射的 ABC 用户或购物卡影子记录'
        : '当前兑换请求缺少手机号，无法建立稳定的 ABC 映射',
      stableMatch: false,
      userMatchCount: userMatches.length,
      cardMatchCount: cardCandidates.length,
      ledgerMatchCount: ledgerCandidates.length,
      matchedUser: null,
      matchedCard: null,
      matchedLedger: null,
      userMatches,
      cardCandidates,
      ledgerCandidates,
    };
  }

  private async loadAbcUsersByMobile(ownerMobile: string): Promise<RedemptionShadowUser[]> {
    try {
      const rows = await this.dataSource.query(
        `SELECT id, name, mobile
           FROM user_account
          WHERE mobile = ?
          ORDER BY id DESC`,
        [ownerMobile],
      );

      return Array.isArray(rows)
        ? rows
            .map((row) => ({
              id: String(row.id),
              name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null,
              mobile: this.normalizeMobile(row.mobile ?? null),
            }))
            .filter((item) => item.mobile)
        : [];
    } catch {
      return [];
    }
  }

  private async countDuplicateRedemptionRequests(request: PointsRedemptionRequest) {
    const qb = this.pointsRedemptionRepository
      .createQueryBuilder('request')
      .where('request.id <> :id', { id: request.id })
      .andWhere('request.redeemable_code = :redeemableCode', {
        redeemableCode: request.redeemableCode,
      })
      .andWhere('request.request_status NOT IN (:...inactiveStatuses)', {
        inactiveStatuses: ['cancelled', 'failed'],
      });

    if (request.ownerId) {
      qb.andWhere('request.owner_id = :ownerId', { ownerId: request.ownerId });
    } else if (request.ownerMobile) {
      qb.andWhere('request.owner_mobile = :ownerMobile', {
        ownerMobile: request.ownerMobile,
      });
    } else {
      return 0;
    }

    const createdAt = request.requestedAt ?? request.createdAt;
    if (createdAt) {
      const periodKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      qb.andWhere(
        `DATE_FORMAT(COALESCE(request.fulfilled_at, request.requested_at, request.created_at), '%Y-%m') = :periodKey`,
        {
          periodKey,
        },
      );
    }

    return qb.getCount();
  }

  private deriveRedemptionExceptionFlags(
    request: PointsRedemptionRequest,
    shadowMatch: RedemptionShadowMatch,
    consumeLedger: PointsLedgerEntry | null,
    duplicateCount: number,
  ): RedemptionExceptionFlag[] {
    const flags = new Set<RedemptionExceptionFlag>();
    const hasFulfillmentTrace = Boolean(
      request.fulfilledAt ||
        request.externalEntityId ||
        request.externalNo ||
        request.requestStatus === 'fulfilled_in_abc' ||
        request.requestStatus === 'completed',
    );

    if (shadowMatch.userMatchCount > 1) {
      flags.add('mobile_mapping_conflict');
    }
    if (duplicateCount > 0) {
      flags.add('duplicate_redemption_request');
    }
    if (
      request.requestStatus === 'pending_fulfillment' &&
      this.isOlderThanHours(request.confirmedAt ?? request.requestedAt ?? request.createdAt, REDEMPTION_STALE_HOURS)
    ) {
      flags.add('stale_pending_fulfillment');
    }
    if (
      request.requestStatus === 'confirmed' &&
      this.isOlderThanHours(request.confirmedAt ?? request.requestedAt ?? request.createdAt, REDEMPTION_STALE_HOURS)
    ) {
      flags.add('stale_confirmed_not_fulfilled');
    }
    if (hasFulfillmentTrace && !consumeLedger) {
      flags.add('abc_fulfilled_but_no_consume');
    }
    if (consumeLedger && !hasFulfillmentTrace && shadowMatch.matchLevel === 'none') {
      flags.add('consume_written_but_no_abc_fulfillment');
    }
    if (hasFulfillmentTrace && shadowMatch.matchLevel === 'none') {
      flags.add('external_record_missing');
    }

    return [...flags];
  }

  private deriveRedemptionReconciliationStatus(
    request: PointsRedemptionRequest,
    shadowMatch: RedemptionShadowMatch,
    consumeLedger: PointsLedgerEntry | null,
    exceptionFlags: RedemptionExceptionFlag[],
  ): RedemptionReconciliationStatus {
    if (request.requestStatus === 'cancelled') {
      return 'cancelled';
    }
    if (request.requestStatus === 'failed') {
      return 'failed';
    }
    if (request.requestStatus === 'drafted') {
      return 'waiting_confirmation';
    }

    const hasMismatchFlag = exceptionFlags.some((flag) =>
      [
        'consume_written_but_no_abc_fulfillment',
        'mobile_mapping_conflict',
        'duplicate_redemption_request',
        'external_record_missing',
      ].includes(flag),
    );
    if (hasMismatchFlag) {
      return 'mismatch_needs_review';
    }

    if (request.requestStatus === 'confirmed' || request.requestStatus === 'pending_fulfillment') {
      return 'waiting_fulfillment';
    }
    if (request.requestStatus === 'fulfilled_in_abc' || (request.fulfilledAt && !consumeLedger)) {
      return 'fulfilled_pending_consume';
    }
    if (request.requestStatus === 'completed' && consumeLedger) {
      return shadowMatch.matchLevel === 'none' ? 'mismatch_needs_review' : 'completed';
    }
    if (consumeLedger && !request.fulfilledAt) {
      return 'mismatch_needs_review';
    }
    return 'waiting_fulfillment';
  }

  private buildRedemptionReconciliationReason(
    request: PointsRedemptionRequest,
    shadowMatch: RedemptionShadowMatch,
    consumeLedger: PointsLedgerEntry | null,
    exceptionFlags: RedemptionExceptionFlag[],
  ) {
    if (request.requestStatus === 'drafted') {
      return '兑换请求仍是草稿，尚未进入人工确认';
    }
    if (request.requestStatus === 'cancelled') {
      return '兑换请求已取消，不再进入履约与对账流程';
    }
    if (request.requestStatus === 'failed') {
      return '兑换请求执行失败，需人工重新判断是否重建';
    }
    if (exceptionFlags.includes('mobile_mapping_conflict')) {
      return '当前手机号在 ABC 侧存在多个用户候选，兑换归属需要人工确认';
    }
    if (exceptionFlags.includes('consume_written_but_no_abc_fulfillment')) {
      return '总部已写入积点 consume，但当前缺少稳定的 ABC 履约影子记录';
    }
    if (exceptionFlags.includes('abc_fulfilled_but_no_consume')) {
      return '当前已有人工履约痕迹，但总部积点 consume 尚未稳定写入';
    }
    if (exceptionFlags.includes('external_record_missing')) {
      return '当前已填写 ABC 履约信息，但还未找到稳定命中的 ABC 影子记录';
    }
    if (request.requestStatus === 'confirmed' || request.requestStatus === 'pending_fulfillment') {
      return '兑换请求已确认，等待人工在 ABC 完成履约并回填外部信息';
    }
    if (request.requestStatus === 'completed' && consumeLedger) {
      return shadowMatch.matchLevel === 'stable'
        ? '总部 consume ledger 与 ABC 影子记录已形成稳定闭环'
        : '总部 consume ledger 已写入，但 ABC 影子映射仍建议人工复核';
    }
    if (shadowMatch.matchLevel === 'possible') {
      return '当前仅命中可能的 ABC 影子记录，仍建议人工复核后再作为稳定结论';
    }
    return '当前兑换对账链仍需人工复核';
  }

  private buildRedemptionMatchedShadowRecord(shadowMatch: RedemptionShadowMatch) {
    if (shadowMatch.matchLevel === 'none') {
      return null;
    }

    const matchedCard = shadowMatch.matchedCard;
    const matchedLedger = shadowMatch.matchedLedger;
    return {
      matchLevel: shadowMatch.matchLevel,
      stableMatch: shadowMatch.stableMatch,
      matchType: shadowMatch.matchType,
      matchReason: shadowMatch.matchReason,
      matchedAbcUser: shadowMatch.matchedUser,
      cardAccount: matchedCard
        ? {
            id: matchedCard.id,
            sourceTable: matchedCard.sourceTable,
            sourceId: matchedCard.sourceId,
            sourceOrderNo: matchedCard.sourceOrderNo,
            sourceCardId: matchedCard.sourceCardId,
            sourceUserId: matchedCard.sourceUserId,
            cardName: matchedCard.cardName,
            amountStandard: matchedCard.amountStandard,
            mappingConfirmed: matchedCard.mappingConfirmed,
          }
        : null,
      ledgerRecord: matchedLedger
        ? {
            id: matchedLedger.id,
            sourceTable: matchedLedger.sourceTable,
            sourceId: matchedLedger.sourceId,
            sourceOrderNo: matchedLedger.sourceOrderNo,
            relatedCardSourceId: matchedLedger.relatedCardSourceId,
            relatedOrderNo: matchedLedger.relatedOrderNo,
            sourceUserId: matchedLedger.sourceUserId,
            ledgerTypeStandard: matchedLedger.ledgerTypeStandard,
            amountStandard: matchedLedger.amountStandard,
            balanceStandard: matchedLedger.balanceStandard,
            mappingConfirmed: matchedLedger.mappingConfirmed,
          }
        : null,
    };
  }

  private buildRedemptionAbcFulfillmentSummary(
    request: PointsRedemptionRequest,
    shadowMatch: RedemptionShadowMatch,
  ) {
    return {
      providerSystem: request.providerSystem,
      externalEntityId: request.externalEntityId ?? null,
      externalNo: request.externalNo ?? null,
      hasManualFulfillmentMark: Boolean(request.fulfilledAt || request.fulfilledBy),
      userMappingStatus:
        shadowMatch.userMatchCount > 1
          ? 'conflict'
          : shadowMatch.matchedUser
            ? 'stable'
            : 'missing',
      shadowMatchLevel: shadowMatch.matchLevel,
      stableMatch: shadowMatch.stableMatch,
      matchReason: shadowMatch.matchReason,
      matchedAbcUser: shadowMatch.matchedUser,
      candidateCounts: {
        userMatchCount: shadowMatch.userMatchCount,
        cardMatchCount: shadowMatch.cardMatchCount,
        ledgerMatchCount: shadowMatch.ledgerMatchCount,
      },
    };
  }

  private buildRedemptionSuggestedAction(
    reconciliationStatus: RedemptionReconciliationStatus,
    exceptionFlags: RedemptionExceptionFlag[],
  ) {
    if (reconciliationStatus === 'waiting_confirmation') {
      return '先由高权限人工确认兑换请求，再进入 ABC 履约准备。';
    }
    if (reconciliationStatus === 'waiting_fulfillment') {
      return '请确认是否已在 ABC 完成履约；若已完成，请补填外部实体号/单号并标记履约。';
    }
    if (reconciliationStatus === 'fulfilled_pending_consume') {
      return '当前需要核查总部 consume ledger 是否漏写，避免总部与 ABC 积点账实不一致。';
    }
    if (reconciliationStatus === 'mismatch_needs_review') {
      if (exceptionFlags.includes('mobile_mapping_conflict')) {
        return '请先解决手机号映射冲突，再确认 ABC 履约记录和总部 consume 是否对应同一用户。';
      }
      if (exceptionFlags.includes('consume_written_but_no_abc_fulfillment')) {
        return '请先核查 ABC 履约证据或外部单号，再决定是否补录影子映射或走反向命令。';
      }
      return '请人工复核 ABC 影子记录、手机号映射和总部账本，确认后再继续后续动作。';
    }
    if (reconciliationStatus === 'completed') {
      return '当前闭环已完成，可转入留档与后续查询。';
    }
    if (reconciliationStatus === 'cancelled') {
      return '当前请求已取消，如需继续兑换，请重新创建新请求而不是复用旧单。';
    }
    return '请先人工核查当前兑换状态，再决定下一步动作。';
  }

  private buildRedemptionNextStepAfterDone(reconciliationStatus: RedemptionReconciliationStatus) {
    switch (reconciliationStatus) {
      case 'waiting_confirmation':
        return '确认后可进入 ABC 履约准备。';
      case 'waiting_fulfillment':
        return '履约并回填外部信息后，可继续核对总部 consume ledger。';
      case 'fulfilled_pending_consume':
        return 'consume ledger 补齐后，这条兑换请求可进入完成归档。';
      case 'completed':
        return '已形成“总部积点 -> 兑换请求 -> ABC 履约 -> consume ledger”闭环。';
      case 'mismatch_needs_review':
        return '异常复核完成后，可重新判断是补录、取消还是转入完成归档。';
      case 'cancelled':
        return '若业务仍需兑换，应重新创建新的兑换请求。';
      case 'failed':
        return '复核失败原因后，可重建新请求或通过反向动作修正。';
      default:
        return '请继续沿人工确认链推进当前兑换请求。';
    }
  }

  private buildRedemptionExecutionTrace(
    request: PointsRedemptionRequest,
    operationLogs: OperationLog[],
    interactionHistory: AiAssistantInteraction[],
    shadowMatch: RedemptionShadowMatch,
    consumeLedger: PointsLedgerEntry | null,
  ) {
    return {
      drafted: {
        requestedBy: request.requestedBy,
        requestedByName: request.requestedByName,
        requestedAt: request.requestedAt?.toISOString() ?? null,
        requestSource: request.requestSource,
        providerKey: request.providerKey ?? null,
        sourceActionId: request.sourceActionId ?? null,
        threadKey: request.threadKey ?? null,
      },
      confirmed:
        request.confirmedAt || request.confirmedBy
          ? {
              confirmedBy: request.confirmedBy,
              confirmedByName: request.confirmedByName,
              confirmedAt: request.confirmedAt?.toISOString() ?? null,
              remark: this.readPayloadString(request.normalizedPayload, 'confirmRemark'),
            }
          : null,
      fulfilledInAbc:
        request.fulfilledAt || request.fulfilledBy
          ? {
              fulfilledBy: request.fulfilledBy,
              fulfilledByName: request.fulfilledByName,
              fulfilledAt: request.fulfilledAt?.toISOString() ?? null,
              externalEntityId: request.externalEntityId ?? null,
              externalNo: request.externalNo ?? null,
              remark: this.readPayloadString(request.normalizedPayload, 'fulfilledRemark'),
            }
          : null,
      consumeLedger: consumeLedger ? this.mapLedgerEntry(consumeLedger) : null,
      cancelled:
        request.cancelledAt || request.cancelledBy
          ? {
              cancelledBy: request.cancelledBy,
              cancelledByName: request.cancelledByName,
              cancelledAt: request.cancelledAt?.toISOString() ?? null,
              remark: this.readPayloadString(request.normalizedPayload, 'cancelRemark'),
            }
          : null,
      abcShadowMatch: this.buildRedemptionMatchedShadowRecord(shadowMatch),
      operationLogs: operationLogs.map((item) => ({
        id: item.id,
        action: item.action,
        detail: item.detail,
        detailJson: item.detailJson ?? {},
        operatorId: item.operatorId,
        createdAt: item.createdAt?.toISOString?.() ?? null,
      })),
      interactionHistory: interactionHistory.map((item) => ({
        id: item.id,
        threadKey: item.threadKey,
        routePath: item.routePath,
        entityType: item.entityType ?? null,
        entityId: item.entityId ?? null,
        providerKey: item.providerKey ?? null,
        userMessage: item.userMessage,
        assistantReply: item.assistantReply,
        createdBy: item.createdBy ?? null,
        createdByName: item.createdByName ?? null,
        createdAt: item.createdAt?.toISOString?.() ?? null,
        suggestedActions: Array.isArray(item.suggestedActions) ? item.suggestedActions : [],
        suggestedCommandDraft:
          item.suggestedCommandDraft && typeof item.suggestedCommandDraft === 'object'
            ? item.suggestedCommandDraft
            : null,
        normalizedPayload: item.normalizedPayload ?? {},
      })),
    };
  }

  private buildRedemptionAuditTrail(
    request: PointsRedemptionRequest,
    operationLogs: OperationLog[],
    consumeLedger: PointsLedgerEntry | null,
    exceptionFlags: RedemptionExceptionFlag[],
  ) {
    const items: Array<Record<string, unknown>> = [];
    items.push({
      step: 'drafted',
      label: '草拟请求',
      operatorName: request.requestedByName ?? null,
      happenedAt: request.requestedAt?.toISOString() ?? null,
      detail: request.requestSource || 'manual',
    });
    if (request.confirmedAt || request.confirmedByName) {
      items.push({
        step: 'confirmed',
        label: '人工确认',
        operatorName: request.confirmedByName ?? null,
        happenedAt: request.confirmedAt?.toISOString() ?? null,
        detail: this.readPayloadString(request.normalizedPayload, 'confirmRemark'),
      });
    }
    if (request.fulfilledAt || request.fulfilledByName) {
      items.push({
        step: 'fulfilled_in_abc',
        label: 'ABC 手工履约',
        operatorName: request.fulfilledByName ?? null,
        happenedAt: request.fulfilledAt?.toISOString() ?? null,
        detail: request.externalNo ?? request.externalEntityId ?? null,
      });
    }
    if (consumeLedger) {
      items.push({
        step: 'consume_ledger',
        label: '总部 consume ledger',
        operatorName: consumeLedger.executedByName ?? null,
        happenedAt: consumeLedger.executedAt?.toISOString() ?? null,
        detail: `ledger#${consumeLedger.id} / ${consumeLedger.changeAmount}`,
      });
    }
    if (request.cancelledAt || request.cancelledByName) {
      items.push({
        step: 'cancelled',
        label: '取消请求',
        operatorName: request.cancelledByName ?? null,
        happenedAt: request.cancelledAt?.toISOString() ?? null,
        detail: this.readPayloadString(request.normalizedPayload, 'cancelRemark'),
      });
    }
    for (const flag of exceptionFlags) {
      items.push({
        step: 'exception',
        label: '异常提示',
        operatorName: null,
        happenedAt: new Date().toISOString(),
        detail: flag,
      });
    }
    for (const item of operationLogs) {
      items.push({
        step: `log:${item.action}`,
        label: '操作日志',
        operatorName: null,
        happenedAt: item.createdAt?.toISOString?.() ?? null,
        detail: item.detail,
      });
    }
    return items;
  }

  private parseCsvFilter(value: string | null | undefined) {
    if (!value) {
      return [];
    }
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseBooleanQuery(value: string | null | undefined) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return null;
  }

  private isOlderThanHours(date: Date | null | undefined, hours: number) {
    if (!date) {
      return false;
    }
    return Date.now() - date.getTime() > hours * 60 * 60 * 1000;
  }

  async getWelfarePreview(query: QueryPointsWelfarePreviewDto, currentUser: CurrentUser) {
    const preview = await this.buildWelfarePreview(query, currentUser);
    return this.serializeWelfarePreview(preview);
  }

  async createWelfareBatchDraft(
    dto: CreatePointsWelfareBatchDraftDto,
    currentUser: CurrentUser,
  ) {
    const preview = await this.buildWelfarePreview(
      {
        periodKey: dto.periodKey,
        companyId: dto.companyId ?? undefined,
      },
      currentUser,
    );

    if (!preview.rawEligibleEmployees.length) {
      throw new BadRequestException('当前周期没有可创建福利草案的员工');
    }
    if (preview.meta.existingBatchId) {
      throw new BadRequestException(
        `当前周期已存在有效福利积点母单 #${preview.meta.existingBatchId}，请先确认是否继续沿用`,
      );
    }

    const periodKey = preview.periodKey;
    const eligibleEmployees = preview.rawEligibleEmployees;
    const providerKey = dto.providerKey?.trim() || null;
    const sourceActionId = dto.sourceActionId?.trim() || null;
    const threadKey = dto.threadKey?.trim() || null;

    const resultBatchId = await this.dataSource.transaction(async (manager) => {
      const batchRepo = manager.getRepository(PointsCommandBatch);
      const commandRepo = manager.getRepository(PointsCommandRequest);
      const itemRepo = manager.getRepository(PointsWelfareBatchItem);

      const existingActiveBatch = await this.findExistingActiveWelfareBatch(
        batchRepo,
        periodKey,
        dto.companyId ?? null,
      );
      if (existingActiveBatch) {
        throw new BadRequestException(
          `当前周期已存在有效福利积点母单 #${existingActiveBatch.id}，请勿重复创建`,
        );
      }

      const employeeIds = eligibleEmployees.map((item) => item.employeeId);
      const employeeMobiles = eligibleEmployees
        .map((item) => item.employeeMobile)
        .filter((item): item is string => Boolean(item));
      const existingCommands = await this.findExistingWelfareCommands(
        commandRepo,
        periodKey,
        employeeIds,
        employeeMobiles,
      );
      if (existingCommands.length) {
        throw new BadRequestException('当前周期已有未取消的员工福利命令，请先处理后再创建草案');
      }

      const now = new Date();
      const batch = batchRepo.create({
        batchType: 'employee_monthly_welfare',
        periodKey,
        companyId: dto.companyId ?? null,
        targetEmployeeCount: eligibleEmployees.length,
        targetTotalAmount: (eligibleEmployees.length * 200).toFixed(2),
        batchStatus: 'drafted',
        sourceType: 'employee_monthly_welfare',
        requestedBy: currentUser.id,
        requestedByName: currentUser.realName,
        requestedAt: now,
        providerKey,
        sourceActionId,
        threadKey,
        remark: dto.remark?.trim() || null,
        normalizedPayload: {
          previewMeta: preview.meta,
          previewRules: preview.previewRules,
          warnings: preview.warnings,
          eligibleEmployees: preview.eligibleEmployees,
          excludedEmployees: preview.excludedEmployees,
          defaultEmployees: preview.eligibleEmployees,
          customEmployees: [],
          holdEmployees: [],
          excludedEmployeesDetailed: preview.excludedEmployees,
          sourceActionId,
          providerKey,
          threadKey,
          ...this.compactPayload(dto.normalizedPayload ?? {}),
        },
      });
      const savedBatch = await batchRepo.save(batch);

      const initialItems = [
        ...eligibleEmployees.map((employee) =>
          itemRepo.create({
            batchId: savedBatch.id,
            employeeId: employee.employeeId,
            commandId: null,
            employeeNameSnapshot: employee.employeeName,
            employeeMobileSnapshot: employee.employeeMobile,
            companyNameSnapshot: employee.companyName,
            positionNameSnapshot: employee.positionName,
            allocationMode: 'default',
            defaultAmount: employee.suggestedAmount,
            finalAmount: employee.suggestedAmount,
            exclusionReason: null,
            adjustmentReasonCode: null,
            adjustmentRemark: null,
            basisType: 'rule',
            decisionScope: 'global_rule',
            aiLearningMode: 'treat_as_global_reference',
            decidedBy: currentUser.id,
            decidedAt: now,
            normalizedPayload: {
              periodKey,
              sourceReasonSummary: employee.reasonSummary,
              sourceZone: 'default',
            },
          }),
        ),
        ...preview.rawExcludedEmployees.map((employee) =>
          itemRepo.create({
            batchId: savedBatch.id,
            employeeId: employee.employeeId,
            commandId: null,
            employeeNameSnapshot: employee.employeeName,
            employeeMobileSnapshot: employee.employeeMobile,
            companyNameSnapshot: employee.companyName,
            positionNameSnapshot: employee.positionName,
            allocationMode: 'excluded',
            defaultAmount: employee.suggestedAmount,
            finalAmount: '0.00',
            exclusionReason: employee.exclusionReason ?? 'other',
            adjustmentReasonCode: null,
            adjustmentRemark: employee.exclusionDetail ?? employee.reasonSummary,
            basisType: 'rule',
            decisionScope: 'global_rule',
            aiLearningMode: 'treat_as_global_reference',
            decidedBy: currentUser.id,
            decidedAt: now,
            normalizedPayload: {
              periodKey,
              sourceReasonSummary: employee.reasonSummary,
              exclusionDetail: employee.exclusionDetail ?? null,
              sourceZone: 'excluded',
            },
          }),
        ),
      ];
      const savedItems = await itemRepo.save(initialItems);
      const defaultItems = savedItems.filter((item) => item.allocationMode === 'default');

      const childDrafts = defaultItems.map((item) =>
        commandRepo.create({
          commandType: 'issue_points',
          commandStatus: 'drafted',
          ownerType: 'employee',
          ownerId: item.employeeId,
          ownerMobile: item.employeeMobileSnapshot,
          merchantId: null,
          batchId: savedBatch.id,
          changeAmount: item.finalAmount,
          sourceType: 'employee_monthly_welfare',
          requestSource: 'batch_draft',
          reasonCode: `monthly_welfare_${periodKey}`,
          remark: dto.remark?.trim() || `员工月度福利积点 ${periodKey}`,
          requestedBy: currentUser.id,
          requestedByName: currentUser.realName,
          requestedAt: now,
          providerKey,
          sourceActionId,
          threadKey,
          normalizedPayload: {
            periodKey,
            batchId: savedBatch.id,
            batchType: 'employee_monthly_welfare',
            batchItemId: item.id,
            employeeId: item.employeeId,
            employeeName: item.employeeNameSnapshot,
            employeeMobile: item.employeeMobileSnapshot,
            companyName: item.companyNameSnapshot,
            positionName: item.positionNameSnapshot,
            allocationMode: item.allocationMode,
            targetEntity: {
              routePath: '/points/welfare',
              entityType: 'points_welfare_batch_item',
              entityId: String(item.id),
            },
            affectPerformanceFlag: false,
            affectBCardFlag: false,
          },
        }),
      );
      const savedCommands = await commandRepo.save(childDrafts);
      const commandIdByItemId = new Map<number, number>();
      for (const command of savedCommands) {
        const batchItemId = Number(
          (command.normalizedPayload as Record<string, unknown> | null)?.batchItemId ?? 0,
        );
        if (batchItemId) {
          commandIdByItemId.set(batchItemId, command.id);
        }
      }
      for (const item of savedItems) {
        const commandId = commandIdByItemId.get(item.id) ?? null;
        if (commandId) {
          item.commandId = commandId;
          item.normalizedPayload = {
            ...(item.normalizedPayload ?? {}),
            commandId,
          };
        }
      }
      await itemRepo.save(savedItems);

      const allocationSummary = this.buildWelfareBatchAllocationSummary(savedItems);
      savedBatch.targetEmployeeCount = allocationSummary.finalPlannedCount;
      savedBatch.targetTotalAmount = allocationSummary.finalPlannedTotal;
      savedBatch.normalizedPayload = {
        ...(savedBatch.normalizedPayload ?? {}),
        allocationSummary,
      };
      await batchRepo.save(savedBatch);

      await this.operationLogsService.create(
        {
          module: 'points_welfare_batches',
          targetId: savedBatch.id,
          action: 'draft',
          operatorId: currentUser.id,
          detail: `员工月度福利积点母单已创建（${periodKey}）`,
          detailJson: {
            batchType: savedBatch.batchType,
            batchStatus: savedBatch.batchStatus,
            targetEmployeeCount: savedBatch.targetEmployeeCount,
            targetTotalAmount: savedBatch.targetTotalAmount,
            childCommandCount: savedCommands.length,
            batchItemCount: savedItems.length,
            allocationSummary,
            periodKey,
          },
        },
        manager,
      );

      for (const command of savedCommands) {
        await this.operationLogsService.create(
          {
            module: 'points_commands',
            targetId: command.id,
            action: 'draft_from_batch',
            operatorId: currentUser.id,
            detail: `员工月度福利子命令草稿已创建（batch#${savedBatch.id}）`,
            detailJson: {
              batchId: savedBatch.id,
              periodKey,
              commandStatus: command.commandStatus,
              ownerType: command.ownerType,
              ownerId: command.ownerId,
              ownerMobile: command.ownerMobile,
              changeAmount: command.changeAmount,
              sourceType: command.sourceType,
            },
          },
          manager,
        );
      }

      return savedBatch.id;
    });

    return this.getWelfareBatchDetail(resultBatchId, currentUser);
  }

  async confirmWelfareBatch(
    id: number,
    dto: ConfirmPointsWelfareBatchDto,
    currentUser: CurrentUser,
  ) {
    const batch = await this.findWelfareBatchOrFail(id);
    if (batch.batchStatus === 'cancelled') {
      throw new BadRequestException('已取消母单不能确认');
    }
    if (batch.batchStatus === 'executed') {
      return this.getWelfareBatchDetail(id, currentUser);
    }

    const childCommands = await this.pointsCommandRepository.find({
      where: { batchId: id },
      order: { id: 'ASC' },
    });
    if (!childCommands.length) {
      throw new BadRequestException('当前母单没有可确认的子命令');
    }

    for (const command of childCommands) {
      if (command.commandStatus === 'drafted') {
        await this.confirmCommand(command.id, { remark: dto.remark }, currentUser);
      }
    }

    batch.batchStatus = 'confirmed';
    batch.confirmedBy = currentUser.id;
    batch.confirmedByName = currentUser.realName;
    batch.confirmedAt = new Date();
    batch.normalizedPayload = {
      ...(batch.normalizedPayload ?? {}),
      confirmRemark: dto.remark?.trim() || null,
    };
    await this.pointsBatchRepository.save(batch);

    await this.operationLogsService.create({
      module: 'points_welfare_batches',
      targetId: batch.id,
      action: 'confirm',
      operatorId: currentUser.id,
      detail: '员工月度福利积点母单已确认',
      detailJson: {
        batchStatus: batch.batchStatus,
        confirmRemark: dto.remark?.trim() || null,
      },
    });

    return this.getWelfareBatchDetail(id, currentUser);
  }

  async executeWelfareBatch(
    id: number,
    dto: ExecutePointsWelfareBatchDto,
    currentUser: CurrentUser,
  ) {
    const batch = await this.findWelfareBatchOrFail(id);
    if (!['confirmed', 'partially_executed'].includes(batch.batchStatus)) {
      throw new BadRequestException('仅已确认或部分执行的母单可执行');
    }

    const childCommands = await this.pointsCommandRepository.find({
      where: { batchId: id },
      order: { id: 'ASC' },
    });
    if (!childCommands.length) {
      throw new BadRequestException('当前母单没有子命令');
    }

    let failedCount = 0;
    for (const command of childCommands) {
      if (command.commandStatus === 'executed' || command.commandStatus === 'cancelled') {
        continue;
      }
      if (command.commandStatus !== 'confirmed') {
        continue;
      }

      try {
        await this.executeCommand(command.id, { remark: dto.remark }, currentUser);
      } catch (error: any) {
        failedCount += 1;
        command.commandStatus = 'failed';
        command.normalizedPayload = {
          ...(command.normalizedPayload ?? {}),
          batchExecuteError: error?.message || 'unknown_error',
          batchExecuteAt: new Date().toISOString(),
        };
        await this.pointsCommandRepository.save(command);
        await this.operationLogsService.create({
          module: 'points_commands',
          targetId: command.id,
          action: 'execute_failed',
          operatorId: currentUser.id,
          detail: '员工月度福利子命令执行失败',
          detailJson: {
            batchId: id,
            error: error?.message || 'unknown_error',
          },
        });
      }
    }

    const refreshedCommands = await this.pointsCommandRepository.find({
      where: { batchId: id },
      order: { id: 'ASC' },
    });
    const executedChildren = refreshedCommands.filter((item) => item.commandStatus === 'executed');
    const pendingChildren = refreshedCommands.filter((item) =>
      ['drafted', 'confirmed'].includes(item.commandStatus),
    );

    batch.executedBy = currentUser.id;
    batch.executedByName = currentUser.realName;
    batch.executedAt = new Date();
    batch.batchStatus =
      executedChildren.length === refreshedCommands.length
        ? 'executed'
        : executedChildren.length > 0
          ? 'partially_executed'
          : 'confirmed';
    batch.normalizedPayload = {
      ...(batch.normalizedPayload ?? {}),
      executeRemark: dto.remark?.trim() || null,
      executeSummary: {
        executedCount: executedChildren.length,
        pendingCount: pendingChildren.length,
        failedCount,
      },
    };
    await this.pointsBatchRepository.save(batch);

    await this.operationLogsService.create({
      module: 'points_welfare_batches',
      targetId: batch.id,
      action: 'execute',
      operatorId: currentUser.id,
      detail: '员工月度福利积点母单已执行',
      detailJson: {
        batchStatus: batch.batchStatus,
        executedCount: executedChildren.length,
        pendingCount: pendingChildren.length,
        failedCount,
      },
    });

    return this.getWelfareBatchDetail(id, currentUser);
  }

  async cancelWelfareBatch(
    id: number,
    dto: CancelPointsWelfareBatchDto,
    currentUser: CurrentUser,
  ) {
    const batch = await this.findWelfareBatchOrFail(id);
    if (batch.batchStatus === 'cancelled') {
      return this.getWelfareBatchDetail(id, currentUser);
    }

    const childCommands = await this.pointsCommandRepository.find({
      where: { batchId: id },
      order: { id: 'ASC' },
    });
    if (childCommands.some((item) => item.commandStatus === 'executed')) {
      throw new BadRequestException('母单下已有子命令执行，不能直接取消；请改走反向命令');
    }

    for (const command of childCommands) {
      if (command.commandStatus !== 'cancelled') {
        await this.cancelCommand(command.id, { remark: dto.remark }, currentUser);
      }
    }

    batch.batchStatus = 'cancelled';
    batch.cancelledBy = currentUser.id;
    batch.cancelledByName = currentUser.realName;
    batch.cancelledAt = new Date();
    batch.normalizedPayload = {
      ...(batch.normalizedPayload ?? {}),
      cancelRemark: dto.remark?.trim() || null,
    };
    await this.pointsBatchRepository.save(batch);

    await this.operationLogsService.create({
      module: 'points_welfare_batches',
      targetId: batch.id,
      action: 'cancel',
      operatorId: currentUser.id,
      detail: '员工月度福利积点母单已取消',
      detailJson: {
        batchStatus: batch.batchStatus,
        cancelRemark: dto.remark?.trim() || null,
      },
    });

    return this.getWelfareBatchDetail(id, currentUser);
  }

  async findWelfareBatches(query: QueryPointsWelfareBatchesDto, currentUser: CurrentUser) {
    if (query.companyId) {
      throw new BadRequestException('当前员工主数据尚未稳定支持 companyId 福利筛选');
    }

    const { skip, take } = getPagination(query);
    const qb = this.pointsBatchRepository.createQueryBuilder('batch');
    if (query.periodKey) {
      qb.andWhere('batch.period_key = :periodKey', { periodKey: this.normalizePeriodKey(query.periodKey) });
    }
    if (query.batchStatus) {
      qb.andWhere('batch.batch_status = :batchStatus', { batchStatus: query.batchStatus });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        BATCH_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .addOrderBy('batch.id', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list.map((item) => this.mapBatch(item, currentUser)), total);
  }

  async getWelfareBatchDetail(id: number, currentUser: CurrentUser) {
    const batch = await this.findWelfareBatchOrFail(id);
    const [childCommands, batchItems] = await Promise.all([
      this.pointsCommandRepository.find({
        where: { batchId: id },
        order: { id: 'ASC' },
      }),
      this.pointsWelfareBatchItemRepository.find({
        where: { batchId: id },
        order: {
          allocationMode: 'ASC',
          updatedAt: 'DESC',
          id: 'DESC',
        },
      }),
    ]);

    const childCommandIds = childCommands.map((item) => item.id);
    const [relatedLedgerEntries, operationLogs, interactionHistory] = await Promise.all([
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
      this.dataSource.getRepository(OperationLog).find({
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
        ? this.dataSource.getRepository(AiAssistantInteraction).find({
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
    const allocationSummary = this.buildWelfareBatchAllocationSummary(batchItems);
    const ledgerSummary = {
      entryCount: relatedLedgerEntries.length,
      totalIssuedAmount: relatedLedgerEntries
        .filter((item) => item.changeType === 'issue')
        .reduce((sum, item) => sum + Number(item.changeAmount || 0), 0)
        .toFixed(2),
      totalAdjustedAmount: relatedLedgerEntries
        .filter((item) => item.changeType === 'adjust')
        .reduce((sum, item) => sum + Number(item.changeAmount || 0), 0)
        .toFixed(2),
      totalRevokedAmount: relatedLedgerEntries
        .filter((item) => item.changeType === 'revoke')
        .reduce((sum, item) => sum + Number(item.changeAmount || 0), 0)
        .toFixed(2),
      latestBalanceAfter: relatedLedgerEntries[0]?.balanceAfter ?? null,
    };

    return {
      batch: this.mapBatch(batch, currentUser),
      batchType: batch.batchType,
      batchStatus: batch.batchStatus,
      periodKey: batch.periodKey,
      companyId: batch.companyId,
      targetEmployeeCount: batch.targetEmployeeCount,
      targetTotalAmount: batch.targetTotalAmount,
      sourceType: batch.sourceType,
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
      providerKey: batch.providerKey ?? null,
      sourceActionId: batch.sourceActionId ?? null,
      threadKey: batch.threadKey ?? null,
      remark: batch.remark ?? null,
      defaultCount: allocationSummary.defaultCount,
      defaultTotal: allocationSummary.defaultTotal,
      customCount: allocationSummary.customCount,
      customTotal: allocationSummary.customTotal,
      holdCount: allocationSummary.holdCount,
      holdTotal: allocationSummary.holdTotal,
      excludedCount: allocationSummary.excludedCount,
      excludedTotal: allocationSummary.excludedTotal,
      finalPlannedCount: allocationSummary.finalPlannedCount,
      finalPlannedTotal: allocationSummary.finalPlannedTotal,
      normalizedPayload: batch.normalizedPayload ?? {},
      previewSummary: {
        eligibleEmployees: this.readPayloadArray(batch.normalizedPayload, 'eligibleEmployees'),
        excludedEmployees: this.readPayloadArray(batch.normalizedPayload, 'excludedEmployees'),
        previewRules: this.readPayloadArray(batch.normalizedPayload, 'previewRules'),
        warnings: this.readPayloadArray(batch.normalizedPayload, 'warnings'),
      },
      allocationSummary,
      batchItems: batchItems.map((item) => this.mapWelfareBatchItem(item, currentUser)),
      batchItemsByMode: this.groupWelfareBatchItems(batchItems, currentUser),
      childCommands: childCommands.map((item) => this.mapCommand(item)),
      childCommandSummary,
      relatedLedgerEntries: relatedLedgerEntries.map((item) => this.mapLedgerEntry(item)),
      ledgerSummary,
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
                remark: this.readPayloadString(batch.normalizedPayload, 'confirmRemark'),
              }
            : null,
        executed:
          batch.executedAt || batch.executedBy
            ? {
                executedBy: batch.executedBy,
                executedByName: batch.executedByName,
                executedAt: batch.executedAt?.toISOString() ?? null,
                remark: this.readPayloadString(batch.normalizedPayload, 'executeRemark'),
                executeSummary:
                  this.readPayloadObject(batch.normalizedPayload, 'executeSummary') ?? null,
              }
            : null,
        cancelled:
          batch.cancelledAt || batch.cancelledBy
            ? {
                cancelledBy: batch.cancelledBy,
                cancelledByName: batch.cancelledByName,
                cancelledAt: batch.cancelledAt?.toISOString() ?? null,
                remark: this.readPayloadString(batch.normalizedPayload, 'cancelRemark'),
              }
            : null,
        operationLogs: operationLogs.map((item) => ({
          id: item.id,
          action: item.action,
          detail: item.detail,
          detailJson: item.detailJson ?? {},
          operatorId: item.operatorId,
          createdAt: item.createdAt?.toISOString?.() ?? null,
        })),
        interactionHistory: interactionHistory.map((item) => ({
          id: item.id,
          threadKey: item.threadKey,
          routePath: item.routePath,
          entityType: item.entityType ?? null,
          entityId: item.entityId ?? null,
          providerKey: item.providerKey ?? null,
          userMessage: item.userMessage,
          assistantReply: item.assistantReply,
          createdBy: item.createdBy ?? null,
          createdByName: item.createdByName ?? null,
          createdAt: item.createdAt?.toISOString?.() ?? null,
          suggestedActions: Array.isArray(item.suggestedActions) ? item.suggestedActions : [],
          suggestedCommandDraft:
            item.suggestedCommandDraft && typeof item.suggestedCommandDraft === 'object'
              ? item.suggestedCommandDraft
              : null,
          normalizedPayload: item.normalizedPayload ?? {},
        })),
      },
    };
  }

  async getWelfareBatchItems(
    batchId: number,
    query: QueryPointsWelfareBatchItemsDto,
    currentUser: CurrentUser,
  ) {
    const batch = await this.findWelfareBatchOrFail(batchId);
    const { skip, take } = getPagination(query);
    const qb = this.pointsWelfareBatchItemRepository.createQueryBuilder('item');
    qb.where('item.batch_id = :batchId', { batchId });
    if (query.allocationMode) {
      qb.andWhere('item.allocation_mode = :allocationMode', {
        allocationMode: query.allocationMode,
      });
    }

    const [total, list, allItems] = await Promise.all([
      qb.getCount(),
      qb
        .clone()
        .orderBy('item.updated_at', 'DESC')
        .addOrderBy('item.id', 'DESC')
        .skip(skip)
        .take(take)
        .getMany(),
      this.pointsWelfareBatchItemRepository.find({
        where: { batchId },
        order: { allocationMode: 'ASC', updatedAt: 'DESC', id: 'DESC' },
      }),
    ]);

    return {
      batch: this.mapBatch(batch, currentUser),
      allocationSummary: this.buildWelfareBatchAllocationSummary(allItems),
      ...buildPaginationResult(
        query,
        list.map((item) => this.mapWelfareBatchItem(item, currentUser)),
        total,
      ),
    };
  }

  async patchWelfareBatchItem(
    batchId: number,
    itemId: number,
    dto: PatchPointsWelfareBatchItemDto,
    currentUser: CurrentUser,
  ) {
    await this.updateWelfareBatchItem(batchId, itemId, dto, currentUser, 'patch');
    return this.getWelfareBatchDetail(batchId, currentUser);
  }

  async moveWelfareBatchItem(
    batchId: number,
    itemId: number,
    dto: MovePointsWelfareBatchItemDto,
    currentUser: CurrentUser,
  ) {
    if (!dto.allocationMode) {
      throw new BadRequestException('移动福利批次子项时必须指定目标分区');
    }
    await this.updateWelfareBatchItem(batchId, itemId, dto, currentUser, 'move');
    return this.getWelfareBatchDetail(batchId, currentUser);
  }

  private async updateWelfareBatchItem(
    batchId: number,
    itemId: number,
    dto: PatchPointsWelfareBatchItemDto,
    currentUser: CurrentUser,
    action: 'patch' | 'move',
  ) {
    const batch = await this.findWelfareBatchOrFail(batchId);
    if (batch.batchStatus !== 'drafted') {
      throw new BadRequestException('只有草案状态的福利积点母单才允许调整发放分配');
    }

    await this.dataSource.transaction(async (manager) => {
      const batchRepo = manager.getRepository(PointsCommandBatch);
      const itemRepo = manager.getRepository(PointsWelfareBatchItem);
      const commandRepo = manager.getRepository(PointsCommandRequest);

      const transactionalBatch = await batchRepo.findOne({ where: { id: batchId } });
      if (!transactionalBatch) {
        throw new NotFoundException('福利积点母单不存在');
      }

      const item = await itemRepo.findOne({ where: { id: itemId, batchId } });
      if (!item) {
        throw new NotFoundException('福利批次子项不存在');
      }

      const previousSnapshot = {
        allocationMode: item.allocationMode,
        finalAmount: item.finalAmount,
        exclusionReason: item.exclusionReason,
        adjustmentReasonCode: item.adjustmentReasonCode,
        adjustmentRemark: item.adjustmentRemark,
        commandId: item.commandId,
      };

      this.applyWelfareBatchItemDecision(item, dto, currentUser);
      await itemRepo.save(item);
      await this.syncWelfareBatchItemCommand(
        transactionalBatch,
        item,
        commandRepo,
        itemRepo,
        currentUser,
        manager,
      );

      const refreshedItems = await itemRepo.find({
        where: { batchId },
        order: { allocationMode: 'ASC', updatedAt: 'DESC', id: 'DESC' },
      });
      const allocationSummary = this.buildWelfareBatchAllocationSummary(refreshedItems);
      transactionalBatch.targetEmployeeCount = allocationSummary.finalPlannedCount;
      transactionalBatch.targetTotalAmount = allocationSummary.finalPlannedTotal;
      transactionalBatch.normalizedPayload = {
        ...(transactionalBatch.normalizedPayload ?? {}),
        allocationSummary,
      };
      await batchRepo.save(transactionalBatch);

      await this.operationLogsService.create(
        {
          module: 'points_welfare_batch_items',
          targetId: item.id,
          action,
          operatorId: currentUser.id,
          detail:
            action === 'move'
              ? '福利批次子项已移动到新的发放分区'
              : '福利批次子项分配信息已更新',
          detailJson: {
            batchId,
            previousSnapshot,
            currentSnapshot: {
              allocationMode: item.allocationMode,
              finalAmount: item.finalAmount,
              exclusionReason: item.exclusionReason,
              adjustmentReasonCode: item.adjustmentReasonCode,
              adjustmentRemark: item.adjustmentRemark,
              commandId: item.commandId,
            },
            allocationSummary,
          },
        },
        manager,
      );

      await this.operationLogsService.create(
        {
          module: 'points_welfare_batches',
          targetId: batchId,
          action: 'item_update',
          operatorId: currentUser.id,
          detail: `福利积点母单子项 #${item.id} 已调整`,
          detailJson: {
            batchId,
            itemId: item.id,
            employeeId: item.employeeId,
            allocationMode: item.allocationMode,
            finalAmount: item.finalAmount,
            allocationSummary,
          },
        },
        manager,
      );
    });
  }

  private applyWelfareBatchItemDecision(
    item: PointsWelfareBatchItem,
    dto: PatchPointsWelfareBatchItemDto,
    currentUser: CurrentUser,
  ) {
    const nextMode = dto.allocationMode ?? item.allocationMode;
    const now = new Date();
    item.allocationMode = nextMode;
    item.decidedBy = currentUser.id;
    item.decidedAt = now;

    const defaultBasisType =
      nextMode === 'default' || nextMode === 'excluded' ? 'rule' : 'manual';
    const defaultDecisionScope =
      nextMode === 'default' || nextMode === 'excluded' ? 'global_rule' : 'case_only';
    const defaultLearningMode =
      nextMode === 'default' || nextMode === 'excluded'
        ? 'treat_as_global_reference'
        : 'do_not_generalize';

    item.basisType = dto.basisType ?? item.basisType ?? defaultBasisType;
    item.decisionScope = dto.decisionScope ?? item.decisionScope ?? defaultDecisionScope;
    item.aiLearningMode = dto.aiLearningMode ?? item.aiLearningMode ?? defaultLearningMode;

    if (nextMode === 'default') {
      item.finalAmount = item.defaultAmount;
      item.exclusionReason = null;
      item.adjustmentReasonCode = null;
      item.adjustmentRemark = null;
    } else if (nextMode === 'custom') {
      const finalAmount = this.normalizeAmount(
        dto.finalAmount ?? item.finalAmount ?? item.defaultAmount,
        false,
      );
      const adjustmentRemark =
        dto.adjustmentRemark?.trim() || item.adjustmentRemark?.trim() || null;
      if (!adjustmentRemark) {
        throw new BadRequestException('自定义发放区必须填写调整说明');
      }
      item.finalAmount = finalAmount;
      item.exclusionReason = null;
      item.adjustmentReasonCode =
        dto.adjustmentReasonCode?.trim() || item.adjustmentReasonCode?.trim() || null;
      item.adjustmentRemark = adjustmentRemark;
    } else if (nextMode === 'hold') {
      const holdRemark = dto.adjustmentRemark?.trim() || item.adjustmentRemark?.trim() || null;
      if (!holdRemark) {
        throw new BadRequestException('暂不发放区必须填写留后处理说明');
      }
      item.finalAmount = '0.00';
      item.exclusionReason = null;
      item.adjustmentReasonCode =
        dto.adjustmentReasonCode?.trim() ||
        item.adjustmentReasonCode?.trim() ||
        'hold_for_review';
      item.adjustmentRemark = holdRemark;
    } else {
      item.finalAmount = '0.00';
      item.exclusionReason =
        dto.exclusionReason?.trim() || item.exclusionReason?.trim() || 'other';
      item.adjustmentReasonCode =
        dto.adjustmentReasonCode?.trim() || item.adjustmentReasonCode?.trim() || null;
      item.adjustmentRemark =
        dto.adjustmentRemark?.trim() || item.adjustmentRemark?.trim() || null;
    }

    item.normalizedPayload = {
      ...(item.normalizedPayload ?? {}),
      allocationMode: item.allocationMode,
      finalAmount: item.finalAmount,
      defaultAmount: item.defaultAmount,
      exclusionReason: item.exclusionReason,
      adjustmentReasonCode: item.adjustmentReasonCode,
      adjustmentRemark: item.adjustmentRemark,
      basisType: item.basisType,
      decisionScope: item.decisionScope,
      aiLearningMode: item.aiLearningMode,
      decidedBy: currentUser.id,
      decidedAt: now.toISOString(),
    };
  }

  private async syncWelfareBatchItemCommand(
    batch: PointsCommandBatch,
    item: PointsWelfareBatchItem,
    commandRepo: Repository<PointsCommandRequest>,
    itemRepo: Repository<PointsWelfareBatchItem>,
    currentUser: CurrentUser,
    manager: Parameters<OperationLogsService['create']>[1],
  ) {
    const currentCommand = item.commandId
      ? await commandRepo.findOne({ where: { id: item.commandId } })
      : null;

    if (['default', 'custom'].includes(item.allocationMode)) {
      const nextReasonCode =
        item.adjustmentReasonCode?.trim() || `monthly_welfare_${batch.periodKey}`;
      const nextRemark =
        item.adjustmentRemark?.trim() ||
        batch.remark?.trim() ||
        `员工月度福利积点 ${batch.periodKey}`;

      if (currentCommand && currentCommand.commandStatus === 'drafted') {
        currentCommand.changeAmount = item.finalAmount;
        currentCommand.reasonCode = nextReasonCode;
        currentCommand.remark = nextRemark;
        currentCommand.normalizedPayload = {
          ...(currentCommand.normalizedPayload ?? {}),
          batchItemId: item.id,
          employeeId: item.employeeId,
          employeeName: item.employeeNameSnapshot,
          employeeMobile: item.employeeMobileSnapshot,
          companyName: item.companyNameSnapshot,
          positionName: item.positionNameSnapshot,
          allocationMode: item.allocationMode,
          adjustmentReasonCode: item.adjustmentReasonCode,
          adjustmentRemark: item.adjustmentRemark,
          decisionScope: item.decisionScope,
          aiLearningMode: item.aiLearningMode,
          basisType: item.basisType,
          affectPerformanceFlag: false,
          affectBCardFlag: false,
        };
        await commandRepo.save(currentCommand);
        await this.operationLogsService.create(
          {
            module: 'points_commands',
            targetId: currentCommand.id,
            action: 'update_from_welfare_item',
            operatorId: currentUser.id,
            detail: '员工福利子命令已按批次子项更新',
            detailJson: {
              batchId: batch.id,
              batchItemId: item.id,
              allocationMode: item.allocationMode,
              changeAmount: currentCommand.changeAmount,
            },
          },
          manager,
        );
        return;
      }

      if (currentCommand && currentCommand.commandStatus === 'executed') {
        throw new BadRequestException('已执行的福利子命令不能回退到草案分区，请改用反向命令');
      }

      const now = new Date();
      const newCommand = commandRepo.create({
        commandType: 'issue_points',
        commandStatus: 'drafted',
        ownerType: 'employee',
        ownerId: item.employeeId,
        ownerMobile: item.employeeMobileSnapshot,
        merchantId: null,
        batchId: batch.id,
        changeAmount: item.finalAmount,
        sourceType: 'employee_monthly_welfare',
        requestSource: 'batch_draft',
        reasonCode: nextReasonCode,
        remark: nextRemark,
        requestedBy: currentUser.id,
        requestedByName: currentUser.realName,
        requestedAt: now,
        providerKey: batch.providerKey ?? null,
        sourceActionId: batch.sourceActionId ?? null,
        threadKey: batch.threadKey ?? null,
        normalizedPayload: {
          periodKey: batch.periodKey,
          batchId: batch.id,
          batchType: batch.batchType,
          batchItemId: item.id,
          employeeId: item.employeeId,
          employeeName: item.employeeNameSnapshot,
          employeeMobile: item.employeeMobileSnapshot,
          companyName: item.companyNameSnapshot,
          positionName: item.positionNameSnapshot,
          allocationMode: item.allocationMode,
          adjustmentReasonCode: item.adjustmentReasonCode,
          adjustmentRemark: item.adjustmentRemark,
          decisionScope: item.decisionScope,
          aiLearningMode: item.aiLearningMode,
          basisType: item.basisType,
          targetEntity: {
            routePath: '/points/welfare',
            entityType: 'points_welfare_batch_item',
            entityId: String(item.id),
          },
          affectPerformanceFlag: false,
          affectBCardFlag: false,
        },
      });
      const savedCommand = await commandRepo.save(newCommand);
      item.commandId = savedCommand.id;
      item.normalizedPayload = {
        ...(item.normalizedPayload ?? {}),
        commandId: savedCommand.id,
      };
      await itemRepo.save(item);
      await this.operationLogsService.create(
        {
          module: 'points_commands',
          targetId: savedCommand.id,
          action: 'draft_from_welfare_item',
          operatorId: currentUser.id,
          detail: '员工福利子命令草稿已根据批次子项生成',
          detailJson: {
            batchId: batch.id,
            batchItemId: item.id,
            allocationMode: item.allocationMode,
            changeAmount: savedCommand.changeAmount,
          },
        },
        manager,
      );
      return;
    }

    if (currentCommand && !['cancelled', 'executed'].includes(currentCommand.commandStatus)) {
      currentCommand.commandStatus = 'cancelled';
      currentCommand.cancelledBy = currentUser.id;
      currentCommand.cancelledByName = currentUser.realName;
      currentCommand.cancelledAt = new Date();
      currentCommand.normalizedPayload = {
        ...(currentCommand.normalizedPayload ?? {}),
        cancelRemark:
          item.allocationMode === 'hold'
            ? '福利批次子项已移动到暂不发放区'
            : '福利批次子项已移动到自动排除区',
      };
      await commandRepo.save(currentCommand);
      await this.operationLogsService.create(
        {
          module: 'points_commands',
          targetId: currentCommand.id,
          action: 'cancel_from_welfare_item',
          operatorId: currentUser.id,
          detail:
            item.allocationMode === 'hold'
              ? '福利子命令已因暂不发放而取消'
              : '福利子命令已因移入自动排除区而取消',
          detailJson: {
            batchId: batch.id,
            batchItemId: item.id,
            allocationMode: item.allocationMode,
          },
        },
        manager,
      );
    }
  }

  private async findCommandOrFail(id: number) {
    const command = await this.pointsCommandRepository.findOne({ where: { id } });
    if (!command) {
      throw new NotFoundException('积点命令不存在');
    }
    return command;
  }

  private async findAbcPointsCommandOrFail(id: number) {
    const command = await this.abcPointsCommandRepository.findOne({ where: { id } });
    if (!command) {
      throw new NotFoundException('ABC 积分命令不存在');
    }
    return command;
  }

  async getAbcPointsCommandPrecheck(id: number, currentUser?: CurrentUser) {
    const command = await this.findAbcPointsCommandOrFail(id);
    const precheck = await this.buildAbcPointsCommandPrecheck(command, {
      mode: 'full',
    });
    const handlingPlan = this.buildAbcPointsHandlingPlan(command, precheck, currentUser);
    return {
      ...this.buildAbcPointsLegacyPrecheckView(precheck, handlingPlan),
      handlingPlan,
    };
  }

  private async buildAbcPointsCommandPrecheck(
    command: AbcPointsCommandRequest,
    options: AbcPointsCommandPrecheckBuildOptions = {},
  ): Promise<AbcPointsCommandPrecheck> {
    const candidates =
      options.abcUserCandidates ?? (await this.findAbcUsersByMobile(command.ownerMobile));
    return this.buildAbcPointsCommandPrecheckFromCandidates(command, candidates, options);
  }

  private buildAbcPointsCommandPrecheckDerivedState(
    command: Pick<
      AbcPointsCommandRequest,
      'commandStatus' | 'ownerMobile' | 'sourceType' | 'normalizedPayload'
    >,
    candidates: Array<Record<string, unknown>>,
    options: AbcPointsCommandPrecheckBuildOptions = {},
  ): AbcPointsCommandPrecheckDerivedState {
    const payload = (command.normalizedPayload ?? {}) as Record<string, unknown>;
    const ownerMobile = this.normalizeMobile(command.ownerMobile);
    const hasUniqueUserMatch = candidates.length === 1;
    const matchedAbcUser = hasUniqueUserMatch ? candidates[0] : null;
    const currentEnvironmentAllowsWrite =
      options.currentEnvironmentAllowsWrite ??
      this.resolveAbcPointsCurrentEnvironmentAllowsWrite();
    const bridgeServiceAvailable =
      options.bridgeServiceAvailable ??
      this.resolveAbcPointsBridgeServiceAvailability(currentEnvironmentAllowsWrite);
    const legacyRiskDetected = command.sourceType === 'legacy_db_direct';
    const statusAllowsExecute =
      command.commandStatus === 'confirmed' || command.commandStatus === 'blocked';

    let blockedReason: string | null = this.readPayloadString(payload, 'blockedReason') ?? null;
    let blockedStage: string | null = command.commandStatus === 'blocked' ? 'write_bridge' : null;

    if (!ownerMobile) {
      blockedReason = blockedReason ?? 'owner_mobile_missing';
      blockedStage = blockedStage ?? 'owner_identity';
    } else if (candidates.length > 1) {
      blockedReason = blockedReason ?? 'mobile_mapping_conflict';
      blockedStage = blockedStage ?? 'owner_mapping';
    } else if (candidates.length === 0) {
      blockedReason = blockedReason ?? 'abc_user_not_found';
      blockedStage = blockedStage ?? 'owner_mapping';
    } else if (!currentEnvironmentAllowsWrite || !bridgeServiceAvailable) {
      blockedReason = blockedReason ?? 'abc_score_write_path_not_stable';
      blockedStage = blockedStage ?? 'write_bridge';
    } else if (legacyRiskDetected) {
      blockedReason = blockedReason ?? 'legacy_db_direct_risk';
      blockedStage = blockedStage ?? 'risk_review';
    } else if (!statusAllowsExecute) {
      blockedReason =
        blockedReason ??
        (command.commandStatus === 'drafted'
          ? 'waiting_confirmation'
          : 'command_status_not_executable');
      blockedStage = blockedStage ?? 'confirmation_gate';
    }

    const canExecute =
      hasUniqueUserMatch &&
      currentEnvironmentAllowsWrite &&
      bridgeServiceAvailable &&
      !legacyRiskDetected &&
      command.commandStatus === 'confirmed';

    return {
      ownerMobile,
      hasUniqueUserMatch,
      matchedUserCount: candidates.length,
      matchedAbcUser,
      currentEnvironmentAllowsWrite,
      bridgeServiceAvailable,
      legacyRiskDetected,
      statusAllowsExecute,
      blockedReason,
      blockedStage,
      canExecute,
    };
  }

  private resolveAbcPointsCommandPrecheckStatus(
    commandStatus: AbcPointsCommandStatus,
    state: Pick<
      AbcPointsCommandPrecheckDerivedState,
      | 'canExecute'
      | 'ownerMobile'
      | 'matchedUserCount'
      | 'currentEnvironmentAllowsWrite'
      | 'bridgeServiceAvailable'
      | 'statusAllowsExecute'
    >,
  ): AbcPointsCommandPrecheckResult {
    if (state.canExecute) {
      return 'pass';
    }
    const hasFailingCheck =
      !state.ownerMobile ||
      state.matchedUserCount > 1 ||
      !state.currentEnvironmentAllowsWrite ||
      !state.bridgeServiceAvailable ||
      (commandStatus !== 'drafted' && !state.statusAllowsExecute);

    return hasFailingCheck ? 'fail' : 'warn';
  }

  private buildAbcPointsCommandPrecheckFromCandidates(
    command: AbcPointsCommandRequest,
    candidates: Array<Record<string, unknown>>,
    options: AbcPointsCommandPrecheckBuildOptions = {},
  ): AbcPointsCommandPrecheck {
    const state = this.buildAbcPointsCommandPrecheckDerivedState(command, candidates, options);
    const precheckMode = options.mode ?? 'full';

    const checks: AbcPointsCommandPrecheckCheck[] = [
      {
        checkName: 'owner_mobile_present',
        checkResult: state.ownerMobile ? 'pass' : 'fail',
        checkReason: state.ownerMobile
          ? '已提供手机号，可作为总部与 ABC 的首要对齐锚点。'
          : '缺少手机号，无法按既定口径稳定匹配 ABC 用户。',
      },
      {
        checkName: 'unique_abc_user_match',
        checkResult: !state.ownerMobile
          ? 'fail'
          : state.hasUniqueUserMatch
            ? 'pass'
            : state.matchedUserCount > 1
              ? 'fail'
              : 'warn',
        checkReason: !state.ownerMobile
          ? '手机号为空，无法做唯一命中检查。'
          : state.hasUniqueUserMatch
            ? '手机号已唯一命中 1 个 ABC 用户。'
            : state.matchedUserCount > 1
              ? `同一手机号命中 ${state.matchedUserCount} 个 ABC 用户，存在归属冲突。`
              : '当前手机号在 ABC 中未命中用户，无法稳定定位写入对象。',
      },
      {
        checkName: 'abc_target_exists',
        checkResult: state.hasUniqueUserMatch ? 'pass' : state.matchedUserCount > 1 ? 'fail' : 'warn',
        checkReason: state.hasUniqueUserMatch
          ? 'ABC 写入目标已定位。'
          : state.matchedUserCount > 1
            ? 'ABC 写入目标不唯一，执行前必须先人工确认唯一用户。'
            : 'ABC 写入目标尚未找到，当前只能停留在命令草稿/确认阶段。',
      },
      {
        checkName: 'environment_allows_controlled_write',
        checkResult: state.currentEnvironmentAllowsWrite ? 'pass' : 'fail',
        checkReason: state.currentEnvironmentAllowsWrite
          ? '当前环境已开放受控写入。'
          : '当前环境未开放 ABC 积分受控写入。',
      },
      {
        checkName: 'bridge_service_available',
        checkResult: state.bridgeServiceAvailable ? 'pass' : 'fail',
        checkReason: state.bridgeServiceAvailable
          ? 'ABC 积分桥接服务可用。'
          : 'ABC 积分桥接服务当前未稳定，不允许假装执行成功。',
      },
      {
        checkName: 'legacy_risk_review',
        checkResult: state.legacyRiskDetected ? 'warn' : 'pass',
        checkReason: state.legacyRiskDetected
          ? '当前命令涉及 legacy_db_direct 风险，执行前需人工确认这不是历史手改遗留冲突。'
          : '未命中 legacy_db_direct 风险。',
      },
      {
        checkName: 'command_status_allows_execute',
        checkResult: state.statusAllowsExecute
          ? 'pass'
          : command.commandStatus === 'drafted'
            ? 'warn'
            : 'fail',
        checkReason: state.statusAllowsExecute
          ? '命令状态允许进入执行预检。'
          : command.commandStatus === 'drafted'
            ? '当前仍是草稿，需先人工确认。'
            : `当前状态为 ${command.commandStatus}，不能继续执行。`,
      },
    ];

    const remediationSuggestions: string[] = [];
    if (!state.ownerMobile) {
      remediationSuggestions.push('先补齐命令对象手机号，保证总部与 ABC 可以按手机号稳定对齐。');
    }
    if (state.matchedUserCount > 1) {
      remediationSuggestions.push('先处理手机号映射冲突，明确唯一 ABC 用户后再尝试执行。');
    }
    if (state.matchedUserCount === 0 && state.ownerMobile) {
      remediationSuggestions.push('先确认该手机号是否已在 ABC 建档，或补齐正确的 ABC 用户归属。');
    }
    if (!state.currentEnvironmentAllowsWrite || !state.bridgeServiceAvailable) {
      remediationSuggestions.push('先稳定 ABC 积分受控写入路径，再从 blocked 重试，不允许回到数据库手改。');
    }
    if (state.legacyRiskDetected) {
      remediationSuggestions.push('当前命令命中 legacy_db_direct 风险，建议先人工复核历史遗留再决定是否重建命令。');
    }
    if (command.commandStatus === 'drafted') {
      remediationSuggestions.push('先由高权限人工确认命令，再进入下一步预检。');
    }
    if (!remediationSuggestions.length && state.canExecute) {
      remediationSuggestions.push('当前预检已通过，可在受控写入路径稳定的前提下执行。');
    }

    const precheckStatus = this.resolveAbcPointsCommandPrecheckStatus(
      command.commandStatus,
      state,
    );

    const effectiveChecks =
      precheckMode === 'list_lite'
        ? this.buildAbcPointsListLitePrecheckChecks(checks)
        : checks;
    const effectiveRemediationSuggestions =
      precheckMode === 'list_lite' ? remediationSuggestions.slice(0, 2) : remediationSuggestions;

    return {
      checkedAt: options.checkedAt ?? new Date().toISOString(),
      precheckStatus,
      checks: effectiveChecks,
      canExecute: state.canExecute,
      blockedReason: state.blockedReason,
      blockedStage: state.blockedStage,
      remediationSuggestions: effectiveRemediationSuggestions,
      hasUniqueUserMatch: state.hasUniqueUserMatch,
      matchedUserCount: state.matchedUserCount,
      matchedAbcUser: state.matchedAbcUser,
      currentEnvironmentAllowsWrite: state.currentEnvironmentAllowsWrite,
      bridgeServiceAvailable: state.bridgeServiceAvailable,
      legacyRiskDetected: state.legacyRiskDetected,
    };
  }

  private async buildAbcPointsCommandCitations(
    command: AbcPointsCommandRequest,
    currentUser?: CurrentUser,
  ) {
    const payload = (command.normalizedPayload ?? {}) as Record<string, unknown>;
    const targetEntity = this.readPayloadObject(payload, 'targetEntity');
    const founderMemoriesRaw = await this.aiMemoryEntryRepository.find({
      where: [
        { enabledFlag: true, scopeType: 'founder' },
        { enabledFlag: true, scopeKey: 'reward_domain_distinction' },
      ],
      order: {
        priorityLevel: 'ASC',
        updatedAt: 'DESC',
        id: 'DESC',
      },
      take: 8,
    });
    const roleScopes = (currentUser?.roleCodes ?? []).filter((item) => item.trim().length > 0);
    const roleMemoryCandidates = roleScopes.length
      ? await this.aiMemoryEntryRepository.find({
          where: [
            { enabledFlag: true, scopeType: 'role' },
            { enabledFlag: true, scopeType: 'global' },
          ],
          order: {
            priorityLevel: 'ASC',
            updatedAt: 'DESC',
            id: 'DESC',
          },
          take: 24,
        })
      : [];
    const roleMemoriesRaw = roleMemoryCandidates
      .filter((item) => {
        if (item.scopeType === 'global') {
          return true;
        }
        if (item.scopeKey === 'reward_domain_distinction') {
          return true;
        }
        const memoryRoleScope = Array.isArray(item.roleScope)
          ? item.roleScope.filter(
              (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
            )
          : [];
        return memoryRoleScope.some((entry) => roleScopes.includes(entry));
      })
      .slice(0, 8);
    const knowledgeRaw = await this.aiKnowledgeEntryRepository
      .createQueryBuilder('knowledge')
      .where('knowledge.enabled_flag = :enabled', { enabled: true })
      .andWhere(
        new Brackets((qb) => {
          qb.where('knowledge.scope_key = :scopeKey', { scopeKey: 'reward_domain_hq_vs_abc' })
            .orWhere('knowledge.title LIKE :abcScore', { abcScore: '%ABC 积分%' })
            .orWhere('knowledge.summary LIKE :abcScoreSummary', { abcScoreSummary: '%ABC 积分%' })
            .orWhere('knowledge.summary LIKE :writeBoundary', { writeBoundary: '%数据库手改%' });
        }),
      )
      .orderBy('knowledge.created_at', 'DESC')
      .addOrderBy('knowledge.id', 'DESC')
      .take(8)
      .getMany();

    let citedManualDecisions: Array<Record<string, unknown>> = [];
    const targetEntityType = this.readPayloadString(targetEntity, 'entityType');
    const targetEntityIdRaw = targetEntity?.['entityId'];
    const targetEntityId =
      typeof targetEntityIdRaw === 'number'
        ? targetEntityIdRaw
        : typeof targetEntityIdRaw === 'string' && targetEntityIdRaw.trim()
          ? Number(targetEntityIdRaw)
          : null;
    if (targetEntityType === 'performance_summary' && targetEntityId) {
      const decisions = await this.performanceSummaryManualDecisionRepository.find({
        where: { sourceSummaryId: targetEntityId },
        order: { operatedAt: 'DESC', id: 'DESC' },
        take: 5,
      });
      citedManualDecisions = decisions.map((item) => ({
        id: item.id,
        matchType: 'direct',
        summary: item.remark,
        actionType: item.actionType,
        reasonCode: item.reasonCode,
        operatedAt: item.operatedAt?.toISOString?.() ?? null,
      }));
    }

    const citedFounderMemories = founderMemoriesRaw.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      memoryType: item.memoryType,
      generalizationMode: item.generalizationMode,
      aiUsageMode: item.aiUsageMode,
    }));
    const citedRoleMemories = roleMemoriesRaw.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      memoryType: item.memoryType,
      generalizationMode: item.generalizationMode,
      aiUsageMode: item.aiUsageMode,
    }));
    const citedKnowledge = knowledgeRaw.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      knowledgeType: item.knowledgeType,
      scopeType: item.scopeType,
      sourceType: item.sourceType,
      aiLearningMode: item.aiLearningMode,
    }));

    return {
      citedKnowledge,
      citedFounderMemories,
      citedRoleMemories,
      citedManualDecisions,
      founderPrinciplesApplied: citedFounderMemories.map((item) => item.title),
      rolePlaybookApplied: citedRoleMemories.map((item) => item.title),
    };
  }

  private async findRedeemableByCodeOrFail(redeemableCode: string) {
    const redeemable = await this.pointsRedeemableRepository.findOne({
      where: { redeemableCode: redeemableCode.trim(), enabledFlag: true },
    });
    if (!redeemable) {
      throw new NotFoundException('积点兑换目录不存在或已停用');
    }
    return redeemable;
  }

  private async findRedemptionOrFail(id: number) {
    const request = await this.pointsRedemptionRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('积点兑换请求不存在');
    }
    return request;
  }

  private async findWelfareBatchOrFail(id: number) {
    const batch = await this.pointsBatchRepository.findOne({ where: { id } });
    if (!batch) {
      throw new NotFoundException('员工福利积点母单不存在');
    }
    return batch;
  }

  private async findWelfareBatchItemOrFail(batchId: number, itemId: number) {
    const item = await this.pointsWelfareBatchItemRepository.findOne({
      where: { id: itemId, batchId },
    });
    if (!item) {
      throw new NotFoundException('福利批次子项不存在');
    }
    return item;
  }

  private async findExistingActiveWelfareBatch(
    repository: Repository<PointsCommandBatch>,
    periodKey: string,
    companyId: number | null,
  ) {
    const qb = repository
      .createQueryBuilder('batch')
      .where('batch.batch_type = :batchType', { batchType: 'employee_monthly_welfare' })
      .andWhere('batch.period_key = :periodKey', { periodKey })
      .andWhere('batch.batch_status IN (:...statuses)', {
        statuses: WELFARE_BATCH_ACTIVE_STATUSES,
      });

    if (companyId === null) {
      qb.andWhere('batch.company_id IS NULL');
    } else {
      qb.andWhere('batch.company_id = :companyId', { companyId });
    }

    return qb.getOne();
  }

  private async findExistingWelfareCommands(
    repository: Repository<PointsCommandRequest>,
    periodKey: string,
    employeeIds: number[],
    employeeMobiles: string[],
  ) {
    if (!employeeIds.length && !employeeMobiles.length) {
      return [];
    }

    const qb = repository
      .createQueryBuilder('command')
      .where('command.owner_type = :ownerType', { ownerType: 'employee' })
      .andWhere('command.source_type = :sourceType', { sourceType: 'employee_monthly_welfare' })
      .andWhere('command.command_status != :cancelled', { cancelled: 'cancelled' })
      .andWhere(
        "JSON_UNQUOTE(JSON_EXTRACT(command.normalized_payload, '$.periodKey')) = :periodKey",
        { periodKey },
      );

    qb.andWhere(
      new Brackets((subQb) => {
        if (employeeIds.length) {
          subQb.where('command.owner_id IN (:...employeeIds)', { employeeIds });
        }
        if (employeeMobiles.length) {
          const clause = 'command.owner_mobile IN (:...employeeMobiles)';
          if (employeeIds.length) {
            subQb.orWhere(clause, { employeeMobiles });
          } else {
            subQb.where(clause, { employeeMobiles });
          }
        }
      }),
    );

    return qb.getMany();
  }

  private async buildWelfarePreview(
    query: QueryPointsWelfarePreviewDto,
    currentUser: CurrentUser,
  ): Promise<WelfarePreviewResult> {
    if (query.companyId) {
      throw new BadRequestException('当前员工主数据尚未稳定支持 companyId 福利筛选');
    }

    const periodKey = this.normalizePeriodKey(query.periodKey ?? this.resolveCurrentPeriodKey());
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

    const employeeIds = employees.map((item) => item.id);
    const employeeMobiles = Array.from(
      new Set(
        employees
          .map((item) => this.normalizeMobile(item.mobile))
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const existingCommands = await this.findExistingWelfareCommands(
      this.pointsCommandRepository,
      periodKey,
      employeeIds,
      employeeMobiles,
    );
    const existingCommandIds = existingCommands.map((item) => item.id);
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
    const existingBatch = await this.findExistingActiveWelfareBatch(
      this.pointsBatchRepository,
      periodKey,
      null,
    );

    const eligibleRecords: WelfarePreviewEmployeeRecord[] = [];
    const excludedRecords: WelfarePreviewEmployeeRecord[] = [];

    for (const employee of employees) {
      const employeeMobile = this.normalizeMobile(employee.mobile);
      const enabledFlag = employee.status === 1;
      const baseRecord: WelfarePreviewEmployeeRecord = {
        employeeId: employee.id,
        employeeName: this.resolveEmployeeDisplayName(employee),
        employeeMobile,
        companyName: employee.sourceCompanyName ?? null,
        positionName: employee.positionName ?? null,
        enabledFlag,
        suggestedAmount: '200.00',
        reasonSummary: '员工每月 1 号 200 积点福利草案',
        sourceRecord: employee,
      };

      if (!enabledFlag) {
        excludedRecords.push({
          ...baseRecord,
          exclusionReason: 'disabled_employee',
          exclusionDetail: '员工未启用，默认不纳入本期福利发放预览',
        });
        continue;
      }

      if (!employeeMobile) {
        excludedRecords.push({
          ...baseRecord,
          exclusionReason: 'missing_mobile',
          exclusionDetail: '员工手机号缺失，无法稳定生成福利积点命令',
        });
        continue;
      }

      if (duplicateMobileSet.has(employeeMobile)) {
        excludedRecords.push({
          ...baseRecord,
          exclusionReason: 'duplicate_mobile_conflict',
          exclusionDetail: '员工手机号存在冲突，需先收口导入或绑定冲突',
        });
        continue;
      }

      if (employee.importConflictNote?.trim()) {
        excludedRecords.push({
          ...baseRecord,
          exclusionReason: 'other',
          exclusionDetail: employee.importConflictNote.trim(),
        });
        continue;
      }

      if (existingByEmployeeId.has(employee.id) || existingByMobile.has(employeeMobile)) {
        excludedRecords.push({
          ...baseRecord,
          exclusionReason: 'already_issued_this_period',
          exclusionDetail: '当前 period 已存在未取消的福利积点命令或已发放记录',
        });
        continue;
      }

      eligibleRecords.push(baseRecord);
    }

    const warnings: string[] = [];
    if (duplicateMobileSet.size) {
      warnings.push(`当前员工主数据存在 ${duplicateMobileSet.size} 个手机号冲突，相关员工已排除出本期福利草案`);
    }
    if (existingBatch) {
      warnings.push(`当前 period 已存在有效福利积点母单 #${existingBatch.id}，请谨慎重复创建`);
    }
    if (excludedRecords.some((item) => item.exclusionReason === 'already_issued_this_period')) {
      warnings.push('已有本期福利命令或发放记录的员工已排除，避免重复发放');
    }

    const previewRules = [
      '默认仅纳入 enabledFlag = true 的员工',
      '同一 employee + periodKey 不能重复生成未取消的福利积点命令',
      '手机号冲突、导入冲突未解决、缺手机号的员工默认排除',
      '本轮只生成草案与审批母单，不会自动执行发放',
    ];

    return {
      periodKey,
      companyId: null,
      eligibleEmployees: eligibleRecords.map((item) =>
        this.serializeWelfarePreviewEmployee(item, currentUser),
      ),
      excludedEmployees: excludedRecords.map((item) =>
        this.serializeWelfarePreviewEmployee(item, currentUser),
      ),
      targetEmployeeCount: eligibleRecords.length,
      targetTotalAmount: (eligibleRecords.length * 200).toFixed(2),
      previewRules,
      warnings,
      meta: {
        duplicateMobiles: Array.from(duplicateMobileSet.values()),
        existingCommandIds,
        existingBatchId: existingBatch?.id ?? null,
        companyScoped: false,
      },
      rawEligibleEmployees: eligibleRecords,
      rawExcludedEmployees: excludedRecords,
    };
  }

  private serializeWelfarePreview(preview: WelfarePreviewResult) {
    return {
      periodKey: preview.periodKey,
      companyId: preview.companyId,
      eligibleEmployees: preview.eligibleEmployees,
      excludedEmployees: preview.excludedEmployees,
      targetEmployeeCount: preview.targetEmployeeCount,
      targetTotalAmount: preview.targetTotalAmount,
      previewRules: preview.previewRules,
      warnings: preview.warnings,
      previewMeta: preview.meta,
    };
  }

  private buildWelfareBatchAllocationSummary(
    items: PointsWelfareBatchItem[],
  ): WelfareBatchAllocationSummary {
    const summarize = (mode: PointsWelfareBatchItemAllocationMode) => {
      const modeItems = items.filter((item) => item.allocationMode === mode);
      return {
        count: modeItems.length,
        total: modeItems
          .reduce((sum, item) => sum + Number(item.finalAmount || 0), 0)
          .toFixed(2),
      };
    };

    const defaultSummary = summarize('default');
    const customSummary = summarize('custom');
    const holdSummary = summarize('hold');
    const excludedSummary = summarize('excluded');

    return {
      defaultCount: defaultSummary.count,
      defaultTotal: defaultSummary.total,
      customCount: customSummary.count,
      customTotal: customSummary.total,
      holdCount: holdSummary.count,
      holdTotal: holdSummary.total,
      excludedCount: excludedSummary.count,
      excludedTotal: excludedSummary.total,
      finalPlannedCount: items.filter(
        (item) =>
          ['default', 'custom'].includes(item.allocationMode) &&
          Number(item.finalAmount || 0) > 0,
      ).length,
      finalPlannedTotal: items
        .filter((item) => ['default', 'custom'].includes(item.allocationMode))
        .reduce((sum, item) => sum + Number(item.finalAmount || 0), 0)
        .toFixed(2),
    };
  }

  private groupWelfareBatchItems(
    items: PointsWelfareBatchItem[],
    currentUser: CurrentUser,
  ) {
    const mapped = items.map((item) => this.mapWelfareBatchItem(item, currentUser));
    return {
      defaultItems: mapped.filter((item) => item.allocationMode === 'default'),
      customItems: mapped.filter((item) => item.allocationMode === 'custom'),
      holdItems: mapped.filter((item) => item.allocationMode === 'hold'),
      excludedItems: mapped.filter((item) => item.allocationMode === 'excluded'),
    };
  }

  private mapWelfareBatchItem(item: PointsWelfareBatchItem, currentUser: CurrentUser) {
    return {
      id: item.id,
      batchId: item.batchId,
      employeeId: item.employeeId,
      commandId: item.commandId ?? null,
      employeeNameSnapshot: item.employeeNameSnapshot,
      employeeMobileSnapshot: this.maskMobileByRole(item.employeeMobileSnapshot, currentUser),
      companyNameSnapshot: item.companyNameSnapshot ?? null,
      positionNameSnapshot: item.positionNameSnapshot ?? null,
      allocationMode: item.allocationMode,
      defaultAmount: item.defaultAmount,
      finalAmount: item.finalAmount,
      exclusionReason: item.exclusionReason ?? null,
      adjustmentReasonCode: item.adjustmentReasonCode ?? null,
      adjustmentRemark: item.adjustmentRemark ?? null,
      basisType: item.basisType ?? null,
      decisionScope: item.decisionScope ?? null,
      aiLearningMode: item.aiLearningMode ?? null,
      decidedBy: item.decidedBy ?? null,
      decidedAt: item.decidedAt?.toISOString() ?? null,
      normalizedPayload: item.normalizedPayload ?? {},
      createdAt: item.createdAt?.toISOString() ?? null,
      updatedAt: item.updatedAt?.toISOString() ?? null,
      canViewFullSensitiveInfo: this.canViewFullSensitiveInfo(currentUser),
    };
  }

  private serializeWelfarePreviewEmployee(
    record: WelfarePreviewEmployeeRecord,
    currentUser: CurrentUser,
  ) {
    return {
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      employeeMobile: this.maskMobileByRole(record.employeeMobile, currentUser),
      companyName: record.companyName,
      positionName: record.positionName,
      enabledFlag: record.enabledFlag,
      suggestedAmount: record.suggestedAmount,
      reasonSummary: record.reasonSummary,
      exclusionReason: record.exclusionReason ?? null,
      exclusionDetail: record.exclusionDetail ?? null,
    };
  }

  private mapBatch(batch: PointsCommandBatch, currentUser: CurrentUser) {
    return {
      id: batch.id,
      batchType: batch.batchType,
      periodKey: batch.periodKey,
      companyId: batch.companyId,
      targetEmployeeCount: batch.targetEmployeeCount,
      targetTotalAmount: batch.targetTotalAmount,
      batchStatus: batch.batchStatus,
      sourceType: batch.sourceType,
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
      providerKey: batch.providerKey ?? null,
      sourceActionId: batch.sourceActionId ?? null,
      threadKey: batch.threadKey ?? null,
      remark: batch.remark ?? null,
      previewMeta: {
        warnings: this.readPayloadArray(batch.normalizedPayload, 'warnings'),
        previewRules: this.readPayloadArray(batch.normalizedPayload, 'previewRules'),
        eligibleCount: Array.isArray(batch.normalizedPayload?.['eligibleEmployees'])
          ? (batch.normalizedPayload?.['eligibleEmployees'] as unknown[]).length
          : batch.targetEmployeeCount,
      },
      normalizedPayload: batch.normalizedPayload ?? {},
      createdAt: batch.createdAt?.toISOString() ?? null,
      updatedAt: batch.updatedAt?.toISOString() ?? null,
      canViewFullSensitiveInfo: this.canViewFullSensitiveInfo(currentUser),
    };
  }

  private mapCommand(command: PointsCommandRequest) {
    return {
      id: command.id,
      commandType: command.commandType,
      commandStatus: command.commandStatus,
      ownerType: command.ownerType,
      ownerId: command.ownerId,
      ownerMobile: command.ownerMobile,
      merchantId: command.merchantId,
      batchId: command.batchId ?? null,
      changeAmount: command.changeAmount,
      sourceType: command.sourceType,
      requestSource: command.requestSource,
      reasonCode: command.reasonCode ?? null,
      remark: command.remark ?? null,
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
      providerKey: command.providerKey ?? null,
      sourceActionId: command.sourceActionId ?? null,
      threadKey: command.threadKey ?? null,
      affectPerformanceFlag: this.resolveCommandAffectFlag(command, 'affectPerformanceFlag'),
      affectBCardFlag: this.resolveCommandAffectFlag(command, 'affectBCardFlag'),
      normalizedPayload: command.normalizedPayload ?? {},
      createdAt: command.createdAt?.toISOString() ?? null,
      updatedAt: command.updatedAt?.toISOString() ?? null,
    };
  }

  private mapAbcPointsCommand(command: AbcPointsCommandRequest) {
    const payload = (command.normalizedPayload ?? {}) as Record<string, unknown>;
    return {
      id: command.id,
      rewardDomain: 'abc_score',
      sourceOfTruth: 'ABC',
      commandType: command.commandType,
      commandStatus: command.commandStatus,
      ownerType: command.ownerType,
      ownerId: command.ownerId,
      ownerMobile: command.ownerMobile,
      changeAmount: command.changeAmount,
      sourceType: command.sourceType,
      requestSource: command.requestSource,
      reasonCode: command.reasonCode ?? null,
      remark: command.remark ?? null,
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
      providerKey: command.providerKey ?? null,
      sourceActionId: command.sourceActionId ?? null,
      threadKey: command.threadKey ?? null,
      writePathStable:
        typeof payload.writePathStable === 'boolean' ? payload.writePathStable : ABC_SCORE_WRITE_PATH_STABLE,
      blockedReason: this.readPayloadString(payload, 'blockedReason'),
      executionCapability:
        typeof payload.writePathStable === 'boolean' && payload.writePathStable
          ? 'controlled_write'
          : 'draft_confirm_blocked',
      normalizedPayload: payload,
      createdAt: command.createdAt?.toISOString() ?? null,
      updatedAt: command.updatedAt?.toISOString() ?? null,
    };
  }

  private buildAbcPointsListLitePrecheckChecks(
    checks: AbcPointsCommandPrecheckCheck[],
  ): AbcPointsCommandPrecheckCheck[] {
    const retainedChecks = new Set([
      'owner_mobile_present',
      'unique_abc_user_match',
      'bridge_service_available',
      'legacy_risk_review',
      'command_status_allows_execute',
    ]);
    return checks.filter((item) => retainedChecks.has(item.checkName));
  }

  private async buildAbcPointsCommandListItems(
    commands: AbcPointsCommandRequest[],
    currentUser?: CurrentUser,
    buildContext?: AbcPointsCommandListBuildContext,
  ) {
    if (!commands.length) {
      return [];
    }
    const resolvedBuildContext =
      buildContext ?? (await this.buildAbcPointsCommandListBuildContext(commands));
    return Promise.all(
      commands.map((item) =>
        this.buildAbcPointsCommandListItem(item, currentUser, resolvedBuildContext),
      ),
    );
  }

  private async prepareAbcPointsCommandListBuildContext(
    commands: AbcPointsCommandListBuildContextSource[],
  ): Promise<{
    buildContext: AbcPointsCommandListBuildContext;
    metrics: AbcPointsCommandListBuildContextMetrics;
  }> {
    const currentEnvironmentAllowsWrite = this.resolveAbcPointsCurrentEnvironmentAllowsWrite();
    const bridgeServiceAvailable = this.resolveAbcPointsBridgeServiceAvailability(
      currentEnvironmentAllowsWrite,
    );
    const ownerMobiles = Array.from(
      new Set(
        commands
          .map((item) => this.normalizeMobile(item.ownerMobile))
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const providerKeys = Array.from(
      new Set(
        commands
          .map((item) => item.providerKey?.trim())
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const providerBridgeAvailabilityByKey = new Map<string, boolean>();
    for (const providerKey of providerKeys) {
      providerBridgeAvailabilityByKey.set(
        providerKey,
        this.resolveAbcPointsProviderBridgeAvailability(providerKey, bridgeServiceAvailable),
      );
    }
    const abcLookupStartedAt = Date.now();
    const abcUserCandidatesByMobile = await this.findAbcUsersByMobiles(ownerMobiles);
    const abcLookupMs = Date.now() - abcLookupStartedAt;

    return {
      buildContext: {
        checkedAt: new Date().toISOString(),
        currentEnvironmentAllowsWrite,
        bridgeServiceAvailable,
        providerBridgeAvailabilityByKey,
        abcUserCandidatesByMobile,
      },
      metrics: {
        uniqueOwnerMobileCount: ownerMobiles.length,
        uniqueProviderKeyCount: providerKeys.length,
        abcLookupChunkCount: ownerMobiles.length ? Math.ceil(ownerMobiles.length / 100) : 0,
        abcLookupMs,
      },
    };
  }

  private async buildAbcPointsCommandListBuildContext(
    commands: AbcPointsCommandListBuildContextSource[],
  ): Promise<AbcPointsCommandListBuildContext> {
    const { buildContext } = await this.prepareAbcPointsCommandListBuildContext(commands);
    return buildContext;
  }

  private async findAbcPointsCommandListProjectionCandidates(
    qb: SelectQueryBuilder<AbcPointsCommandRequest>,
    sortColumn: string,
    sortOrder: 'ASC' | 'DESC',
  ): Promise<AbcPointsCommandListProjectionCandidate[]> {
    const rows = await qb
      .clone()
      .select('command.id', 'id')
      .addSelect('command.commandStatus', 'commandStatus')
      .addSelect('command.ownerMobile', 'ownerMobile')
      .addSelect('command.providerKey', 'providerKey')
      .addSelect('command.sourceType', 'sourceType')
      .addSelect(
        "JSON_UNQUOTE(JSON_EXTRACT(command.normalized_payload, '$.blockedReason'))",
        'blockedReasonFromPayload',
      )
      .orderBy(sortColumn, sortOrder)
      .addOrderBy('command.id', 'DESC')
      .getRawMany<{
        id: number | string;
        commandStatus: AbcPointsCommandStatus;
        ownerMobile: string | null;
        providerKey: string | null;
        sourceType: string;
        blockedReasonFromPayload: string | null;
      }>();

    return rows.map((item) => ({
      id: Number(item.id),
      commandStatus: item.commandStatus,
      ownerMobile: item.ownerMobile ?? null,
      providerKey: item.providerKey ?? null,
      sourceType: item.sourceType,
      normalizedPayload: {
        blockedReason: item.blockedReasonFromPayload?.trim() || null,
      },
    }));
  }

  private async buildAbcPointsCommandListProjections(
    commands: AbcPointsCommandListProjectionCandidate[],
  ): Promise<{
    buildContext: AbcPointsCommandListBuildContext | null;
    projections: AbcPointsCommandListProjection[];
    metrics: AbcPointsCommandListBuildContextMetrics;
  }> {
    if (!commands.length) {
      return {
        buildContext: null,
        projections: [],
        metrics: {
          uniqueOwnerMobileCount: 0,
          uniqueProviderKeyCount: 0,
          abcLookupChunkCount: 0,
          abcLookupMs: 0,
        },
      };
    }
    const { buildContext, metrics } = await this.prepareAbcPointsCommandListBuildContext(commands);
    return {
      buildContext,
      projections: commands.map((item) =>
        this.buildAbcPointsCommandListProjection(item, buildContext),
      ),
      metrics,
    };
  }

  private async findAbcPointsCommandsByIds(commandIds: number[]) {
    if (!commandIds.length) {
      return [];
    }
    const commands = await this.abcPointsCommandRepository.find({
      where: {
        id: In(commandIds),
      },
    });
    const commandById = new Map(commands.map((item) => [item.id, item]));
    return commandIds
      .map((id) => commandById.get(id))
      .filter((item): item is AbcPointsCommandRequest => Boolean(item));
  }

  private resolveAbcPointsCommandCandidatesFromBuildContext(
    command: Pick<AbcPointsCommandRequest, 'ownerMobile'>,
    buildContext: AbcPointsCommandListBuildContext,
  ) {
    const normalizedMobile = this.normalizeMobile(command.ownerMobile);
    if (!normalizedMobile) {
      return [];
    }
    return buildContext.abcUserCandidatesByMobile.get(normalizedMobile) ?? [];
  }

  private resolveAbcPointsCommandBridgeAvailabilityFromBuildContext(
    command: Pick<AbcPointsCommandRequest, 'providerKey'>,
    buildContext: AbcPointsCommandListBuildContext,
  ) {
    const providerKey = command.providerKey?.trim();
    if (!providerKey) {
      return buildContext.bridgeServiceAvailable;
    }
    return (
      buildContext.providerBridgeAvailabilityByKey.get(providerKey) ??
      buildContext.bridgeServiceAvailable
    );
  }

  private buildAbcPointsCommandListProjection(
    command: AbcPointsCommandListProjectionCandidate,
    buildContext: AbcPointsCommandListBuildContext,
  ): AbcPointsCommandListProjection {
    const state = this.buildAbcPointsCommandPrecheckDerivedState(
      command,
      this.resolveAbcPointsCommandCandidatesFromBuildContext(command, buildContext),
      {
        currentEnvironmentAllowsWrite: buildContext.currentEnvironmentAllowsWrite,
        bridgeServiceAvailable: this.resolveAbcPointsCommandBridgeAvailabilityFromBuildContext(
          command,
          buildContext,
        ),
      },
    );

    return {
      id: command.id,
      commandStatus: command.commandStatus,
      blockedReason: state.blockedReason,
      blockedStage: state.blockedStage,
      precheckStatus: this.resolveAbcPointsCommandPrecheckStatus(command.commandStatus, state),
      canExecute: state.canExecute,
      hasUniqueUserMatch: state.hasUniqueUserMatch,
      matchedUserCount: state.matchedUserCount,
      blockedOnly: command.commandStatus === 'blocked',
      handlingPlanSummarySource: {
        ownerMobilePresent: Boolean(state.ownerMobile),
        currentEnvironmentAllowsWrite: state.currentEnvironmentAllowsWrite,
        bridgeServiceAvailable: state.bridgeServiceAvailable,
        legacyRiskDetected: state.legacyRiskDetected,
        requiresHumanConfirmation: command.commandStatus === 'drafted',
      },
    };
  }

  private matchesAbcPointsCommandDerivedFilters(
    projection: AbcPointsCommandListProjection,
    filters: {
      blockedReasonFilter: string | null;
      uniqueUserMatchFilter: boolean | null;
      canExecuteFilter: boolean | null;
    },
  ) {
    if (
      filters.blockedReasonFilter !== null &&
      projection.blockedReason !== filters.blockedReasonFilter
    ) {
      return false;
    }
    if (
      filters.uniqueUserMatchFilter !== null &&
      projection.hasUniqueUserMatch !== filters.uniqueUserMatchFilter
    ) {
      return false;
    }
    if (filters.canExecuteFilter !== null && projection.canExecute !== filters.canExecuteFilter) {
      return false;
    }
    return true;
  }

  private createAbcPointsCommandListDiagnostics(
    hasDerivedFilter: boolean,
  ): AbcPointsCommandListDiagnostics {
    return {
      usedProjectionFirst: hasDerivedFilter,
      hasDerivedFilter,
      baseCandidateCount: 0,
      projectedCandidateCount: 0,
      filteredCandidateCount: 0,
      pageResultCount: 0,
      uniqueOwnerMobileCount: 0,
      uniqueProviderKeyCount: 0,
      abcLookupChunkCount: 0,
      projectionBuildMs: 0,
      abcLookupMs: 0,
      derivedFilterMs: 0,
      pageHydrateMs: 0,
      listAssembleMs: 0,
      totalMs: 0,
      normalizedPayloadProjectionMode: hasDerivedFilter
        ? 'json_extract_blocked_reason_only'
        : 'not_used',
    };
  }

  private buildAbcPointsCommandListResult<T>(
    query: QueryAbcPointsCommandsDto,
    list: T[],
    total: number,
    diagnostics: AbcPointsCommandListDiagnostics | null,
    totalStartedAt: number,
  ) {
    const listAssembleStartedAt = Date.now();
    const result = buildPaginationResult(query, list, total);
    if (!diagnostics) {
      return result;
    }
    diagnostics.listAssembleMs = Date.now() - listAssembleStartedAt;
    diagnostics.totalMs = Date.now() - totalStartedAt;
    return {
      ...result,
      diagnostics,
    };
  }

  private async buildAbcPointsCommandListItem(
    command: AbcPointsCommandRequest,
    currentUser?: CurrentUser,
    buildContext?: AbcPointsCommandListBuildContext,
  ) {
    const base = this.mapAbcPointsCommand(command);
    const precheck = buildContext
      ? this.buildAbcPointsCommandPrecheckFromCandidates(
          command,
          this.resolveAbcPointsCommandCandidatesFromBuildContext(command, buildContext),
          {
            mode: 'list_lite',
            checkedAt: buildContext.checkedAt,
            currentEnvironmentAllowsWrite: buildContext.currentEnvironmentAllowsWrite,
            bridgeServiceAvailable: this.resolveAbcPointsCommandBridgeAvailabilityFromBuildContext(
              command,
              buildContext,
            ),
          },
        )
      : await this.buildAbcPointsCommandPrecheck(command, {
          mode: 'list_lite',
        });
    const handlingPlan = this.buildAbcPointsHandlingPlan(command, precheck, currentUser);
    const executionCapability = this.resolveAbcPointsExecutionCapability(command, precheck);
    const legacyWritePathPrecheck = this.buildAbcPointsLegacyPrecheckView(precheck, handlingPlan);
    return {
      ...base,
      blockedReason: handlingPlan.diagnosis.blockedReason ?? base.blockedReason,
      blockedStage: handlingPlan.diagnosis.blockedStage,
      executionCapability: this.buildAbcPointsLegacyExecutionCapability(
        executionCapability,
        handlingPlan,
      ),
      precheckStatus: legacyWritePathPrecheck.precheckStatus,
      canExecute: legacyWritePathPrecheck.canExecute,
      hasUniqueUserMatch: legacyWritePathPrecheck.hasUniqueUserMatch,
      matchedUserCount: legacyWritePathPrecheck.matchedUserCount,
      matchedAbcUser: legacyWritePathPrecheck.matchedAbcUser,
      writePathPrecheck: legacyWritePathPrecheck,
      handlingPlan,
      suggestedAction: this.buildAbcPointsLegacySuggestedAction(handlingPlan),
    };
  }

  private canViewFullAbcPointsHandlingPlan(currentUser?: CurrentUser) {
    return Boolean(
      currentUser?.roleCodes?.some((roleCode) =>
        ABC_POINTS_FULL_ROLE_CODES.includes(
          roleCode as (typeof ABC_POINTS_FULL_ROLE_CODES)[number],
        ),
      ),
    );
  }

  private shouldIncludeAbcPointsCommandListDiagnostics(
    query: QueryAbcPointsCommandsDto,
    currentUser?: CurrentUser,
  ) {
    return (
      this.parseBooleanQuery(query.includeDiagnostics) === true &&
      this.canViewFullAbcPointsHandlingPlan(currentUser)
    );
  }

  private isRestrictedAbcPointsHandlingPlan(handlingPlan: AbcPointsHandlingPlan) {
    return handlingPlan.visibilityScope !== 'full';
  }

  private buildAbcPointsLegacySuggestedAction(handlingPlan: AbcPointsHandlingPlan) {
    return handlingPlan.listSummary;
  }

  private buildAbcPointsLegacyExecutionCapability(
    executionCapability: string,
    handlingPlan: AbcPointsHandlingPlan,
  ) {
    if (!this.isRestrictedAbcPointsHandlingPlan(handlingPlan)) {
      return executionCapability;
    }
    return handlingPlan.status === 'executed' || handlingPlan.diagnosis.canExecute
      ? 'controlled_write'
      : 'draft_confirm_blocked';
  }

  private buildAbcPointsLegacyPrecheckView(
    precheck: AbcPointsCommandPrecheck,
    handlingPlan: AbcPointsHandlingPlan,
  ): AbcPointsCommandPrecheck {
    if (!this.isRestrictedAbcPointsHandlingPlan(handlingPlan)) {
      return {
        ...precheck,
        checks: [...precheck.checks],
        remediationSuggestions: [...precheck.remediationSuggestions],
      };
    }
    const snapshot = handlingPlan.precheckSnapshot;
    return {
      checkedAt: precheck.checkedAt,
      precheckStatus: handlingPlan.diagnosis.precheckStatus,
      checks: [...snapshot.checks],
      canExecute: handlingPlan.diagnosis.canExecute,
      blockedReason: handlingPlan.diagnosis.blockedReason,
      blockedStage: handlingPlan.diagnosis.blockedStage,
      remediationSuggestions: [...snapshot.remediationSuggestions],
      hasUniqueUserMatch: snapshot.hasUniqueUserMatch,
      matchedUserCount: snapshot.matchedUserCount,
      matchedAbcUser: null,
      currentEnvironmentAllowsWrite: snapshot.currentEnvironmentAllowsWrite,
      bridgeServiceAvailable: snapshot.bridgeServiceAvailable,
      legacyRiskDetected: snapshot.legacyRiskDetected,
    };
  }

  private buildAbcPointsLegacyShadowOwnerView(
    abcUserCandidates: Array<Record<string, unknown>>,
    handlingPlan: AbcPointsHandlingPlan,
  ) {
    const shadowOwner = {
      matchStatus:
        abcUserCandidates.length > 1
          ? 'conflict'
          : abcUserCandidates.length === 1
            ? 'stable'
            : 'missing',
      stableMatch: abcUserCandidates.length === 1,
      matchedCount: abcUserCandidates.length,
      candidates: abcUserCandidates,
    };
    if (!this.isRestrictedAbcPointsHandlingPlan(handlingPlan)) {
      return shadowOwner;
    }
    return {
      ...shadowOwner,
      stableMatch: handlingPlan.precheckSnapshot.hasUniqueUserMatch,
      matchedCount: handlingPlan.precheckSnapshot.matchedUserCount,
      candidates: [],
    };
  }

  private buildAbcPointsLegacyCitationsView(
    citations: {
      citedKnowledge: Array<Record<string, unknown>>;
      citedFounderMemories: Array<Record<string, unknown>>;
      citedRoleMemories: Array<Record<string, unknown>>;
      citedManualDecisions: Array<Record<string, unknown>>;
      founderPrinciplesApplied: string[];
      rolePlaybookApplied: string[];
    },
    handlingPlan: AbcPointsHandlingPlan,
  ) {
    if (!this.isRestrictedAbcPointsHandlingPlan(handlingPlan)) {
      return {
        ...citations,
        citedKnowledge: [...citations.citedKnowledge],
        citedFounderMemories: [...citations.citedFounderMemories],
        citedRoleMemories: [...citations.citedRoleMemories],
        citedManualDecisions: [...citations.citedManualDecisions],
        founderPrinciplesApplied: [...citations.founderPrinciplesApplied],
        rolePlaybookApplied: [...citations.rolePlaybookApplied],
      };
    }
    return {
      citedKnowledge: [],
      citedFounderMemories: [],
      citedRoleMemories: [],
      citedManualDecisions: [],
      founderPrinciplesApplied: [],
      rolePlaybookApplied: [],
    };
  }

  private buildAbcPointsLegacyAuditTrailView(
    auditTrail: Array<Record<string, unknown>>,
    handlingPlan: AbcPointsHandlingPlan,
  ) {
    return this.isRestrictedAbcPointsHandlingPlan(handlingPlan) ? [] : auditTrail;
  }

  private buildAbcPointsLegacyExecutionTraceView(
    executionTrace: {
      drafted: Record<string, unknown> | null;
      confirmed: Record<string, unknown> | null;
      blocked: Record<string, unknown> | null;
      cancelled: Record<string, unknown> | null;
      operationLogs: Array<Record<string, unknown>>;
      interactionHistory: Array<Record<string, unknown>>;
    },
    handlingPlan: AbcPointsHandlingPlan,
  ) {
    if (!this.isRestrictedAbcPointsHandlingPlan(handlingPlan)) {
      return executionTrace;
    }
    return {
      drafted: executionTrace.drafted ? { status: 'recorded' } : null,
      confirmed: executionTrace.confirmed ? { status: 'recorded' } : null,
      blocked: executionTrace.blocked
        ? {
            blockedReason: handlingPlan.diagnosis.blockedReason,
            blockedStage: handlingPlan.diagnosis.blockedStage,
          }
        : null,
      cancelled: executionTrace.cancelled ? { status: 'recorded' } : null,
      operationLogs: [],
      interactionHistory: [],
    };
  }

  private resolveAbcPointsExecutionCapability(
    command: AbcPointsCommandRequest,
    precheck: AbcPointsCommandPrecheck,
  ) {
    return command.commandStatus === 'executed' || precheck.canExecute
      ? 'controlled_write'
      : 'draft_confirm_blocked';
  }

  private buildAbcPointsCommandExplanation(
    command: AbcPointsCommandRequest,
    precheck: AbcPointsCommandPrecheck,
    blockedReason: string | null,
  ) {
    if (command.commandStatus === 'blocked' && blockedReason === 'abc_score_write_path_not_stable') {
      return '当前命令已进入 blocked。原因是 ABC 积分正式写入路径仍未稳定验证，本轮只允许草拟与确认，不允许假执行。';
    }
    if (command.commandStatus === 'blocked') {
      return `当前命令已进入 blocked。原因是 ${this.describeAbcPointsBlockedReason(blockedReason)}。`;
    }
    if (command.commandStatus === 'confirmed') {
      return precheck.canExecute
        ? '当前命令已完成人工确认，且受控写入预检已通过。'
        : '当前命令已完成人工确认，但仍有预检条件未满足，暂时不能执行。';
    }
    if (command.commandStatus === 'drafted') {
      return '当前命令仍是草稿，需由高权限人工确认后才能进入下一步。';
    }
    if (command.commandStatus === 'cancelled') {
      return '当前命令已取消，不会写入 ABC 积分。若需继续，请重新草拟新的受控命令。';
    }
    if (command.commandStatus === 'executed') {
      return '当前命令已在受控链路中执行完成，后续只应回看审计与影子结果，不应再重复执行。';
    }
    if (command.commandStatus === 'failed') {
      return '当前命令执行失败，需先核查失败原因，再决定是否重新草拟新的 ABC 积分命令。';
    }
    return '当前命令处于受控命令链中，请继续查看确认、阻塞和审计信息。';
  }

  private buildAbcPointsHandlingPlan(
    command: AbcPointsCommandRequest,
    precheck: AbcPointsCommandPrecheck,
    currentUser?: CurrentUser,
    aiDiagnosis?: {
      assistantReply: string | null;
      answerSections: Array<Record<string, unknown>>;
      confidenceLevel: string | null;
    } | null,
  ): AbcPointsHandlingPlan {
    const payload = (command.normalizedPayload ?? {}) as Record<string, unknown>;
    const blockedReason =
      precheck.blockedReason ?? this.readPayloadString(payload, 'blockedReason');
    const blockedStage = precheck.blockedStage;
    const commandExplanation = this.buildAbcPointsCommandExplanation(
      command,
      precheck,
      blockedReason,
    );
    const suggestedNextStep = precheck.canExecute
      ? '预检已通过，可在写入路径稳定的受控环境中继续执行。'
      : precheck.remediationSuggestions[0] ??
        '当前仍需人工补齐映射、受控写入或风险复核条件。';
    const generalizationBoundary =
      blockedReason === 'abc_score_write_path_not_stable'
        ? '当前主要是系统边界问题：命令可以草拟和确认，但不能自动推广为可执行规则。'
        : blockedReason === 'mobile_mapping_conflict'
          ? '当前主要是单条数据映射冲突，不能直接推广成同类规则，需先处理用户归属。'
          : command.sourceType === 'legacy_db_direct'
            ? '当前涉及 legacy_db_direct 遗留风险，只能保守处理，不能自动推广。'
            : '当前建议只代表受控诊断结论，不能越过人工确认边界自动执行。';
    const executionBoundary =
      precheck.currentEnvironmentAllowsWrite && precheck.bridgeServiceAvailable
        ? '即使预检通过，也只能在受控写入链中执行，不能绕过 bridge service 直接改库。'
        : '当前只允许草拟、确认与 blocked 留痕；不允许假执行，也不能回退到数据库手改。';
    const humanConfirmationBoundary =
      command.commandStatus === 'drafted'
        ? '当前仍需高权限人工确认，不能跳过确认直接执行。'
        : '即使进入 confirmed / blocked，也必须保留人工复核与审计痕迹，不能放大成自动化执行。';
    const payrollBoundary =
      'ABC 积分命令当前只用于 ABC 侧受控诊断与审计，不会自动进入正式工资结论，也不会改变 included / pending / excluded 分层。';
    const listSummary =
      precheck.remediationSuggestions[0] ??
      (precheck.canExecute ? '预检通过，可进入受控执行。' : '请先查看详情页中的 blocked / precheck 诊断。');
    const canViewFullPlan = this.canViewFullAbcPointsHandlingPlan(currentUser);
    const actionItems: AbcPointsHandlingPlanActionItem[] = [
      {
        actionKey: 'manual_confirmation',
        title: '人工确认命令边界',
        description:
          command.commandStatus === 'drafted'
            ? '先由管理员或 founder 完成高权限人工确认，再继续后续判断。'
            : '人工确认环节已留痕，后续只能在现有边界内复核或回查。 ',
        status:
          command.commandStatus === 'drafted'
            ? 'pending'
            : ['confirmed', 'blocked', 'executed', 'cancelled', 'failed'].includes(command.commandStatus)
              ? 'done'
              : 'not_applicable',
        requiresHumanConfirmation: true,
        ownerScope: 'admin_founder',
      },
      {
        actionKey: 'mobile_anchor',
        title: '手机号唯一归属核对',
        description: !this.normalizeMobile(command.ownerMobile)
          ? '当前缺少手机号，必须先补齐手机号这一唯一锚点。'
          : precheck.hasUniqueUserMatch
            ? '手机号已唯一命中 ABC 用户，可以继续沿当前对象核对。'
            : precheck.matchedUserCount > 1
              ? `当前手机号命中 ${precheck.matchedUserCount} 个 ABC 用户，需先人工消除归属冲突。`
              : '当前手机号在 ABC 中未命中用户，需先补齐用户归属。',
        status: !this.normalizeMobile(command.ownerMobile)
          ? 'blocked'
          : precheck.hasUniqueUserMatch
            ? 'done'
            : 'blocked',
        requiresHumanConfirmation: true,
        ownerScope: 'human_review',
      },
      {
        actionKey: 'write_path_precheck',
        title: '受控写入路径预检',
        description: precheck.currentEnvironmentAllowsWrite && precheck.bridgeServiceAvailable
          ? '受控写入链当前可用，但仍必须通过现有审计边界执行。'
          : '写入路径仍未稳定，只能保留 blocked 留痕并继续核查 bridge 与环境开关。',
        status:
          precheck.currentEnvironmentAllowsWrite && precheck.bridgeServiceAvailable
            ? 'done'
            : 'blocked',
        requiresHumanConfirmation: false,
        ownerScope: 'authorized_roles',
      },
      {
        actionKey: 'legacy_risk_review',
        title: '历史手改风险复核',
        description: precheck.legacyRiskDetected
          ? '命中 legacy_db_direct 风险，需先人工确认不是历史手改遗留冲突。'
          : '当前未命中 legacy_db_direct 风险。',
        status: precheck.legacyRiskDetected ? 'blocked' : 'done',
        requiresHumanConfirmation: true,
        ownerScope: 'human_review',
      },
      {
        actionKey: 'controlled_execution',
        title: '受控执行或继续 blocked 审计',
        description: precheck.canExecute
          ? '命令已具备进入受控执行的前置条件，但仍不能越过人工确认和受控写入边界。'
          : suggestedNextStep,
        status:
          command.commandStatus === 'executed'
            ? 'done'
            : precheck.canExecute
              ? 'ready'
              : command.commandStatus === 'cancelled'
                ? 'not_applicable'
                : 'blocked',
        requiresHumanConfirmation: true,
        ownerScope: 'authorized_roles',
      },
    ];

    return {
      version: '3N.2',
      visibilityScope: canViewFullPlan ? 'full' : 'restricted',
      status: command.commandStatus,
      summary: commandExplanation,
      listSummary,
      diagnosis: {
        blockedReason,
        blockedStage,
        precheckStatus: precheck.precheckStatus,
        canExecute: precheck.canExecute,
        commandExplanation,
        suggestedNextStep,
      },
      boundary: {
        executionBoundary,
        generalizationBoundary,
        payrollBoundary,
        humanConfirmationBoundary,
      },
      actionItems: canViewFullPlan
        ? actionItems
        : actionItems.map((item) => ({
            ...item,
            description:
              item.status === 'done'
                ? '当前环节已有留痕。'
                : item.status === 'ready'
                  ? '当前环节已具备继续处理的基础条件。'
                  : '当前环节仍需按现有权限继续人工处理。',
          })),
      precheckSnapshot: {
        hasUniqueUserMatch: precheck.hasUniqueUserMatch,
        matchedUserCount: precheck.matchedUserCount,
        currentEnvironmentAllowsWrite: precheck.currentEnvironmentAllowsWrite,
        bridgeServiceAvailable: precheck.bridgeServiceAvailable,
        legacyRiskDetected: precheck.legacyRiskDetected,
        remediationSuggestions: canViewFullPlan
          ? [...precheck.remediationSuggestions]
          : precheck.remediationSuggestions.slice(0, 2),
        checks: canViewFullPlan ? [...precheck.checks] : [],
      },
      aiDiagnosis: aiDiagnosis
        ? {
            assistantReply: aiDiagnosis.assistantReply,
            answerSections: canViewFullPlan
              ? aiDiagnosis.answerSections
              : aiDiagnosis.answerSections.map((item) => ({
                  sectionKey:
                    item && typeof item === 'object' && 'sectionKey' in item
                      ? (item as Record<string, unknown>).sectionKey
                      : null,
                  title:
                    item && typeof item === 'object' && 'title' in item
                      ? (item as Record<string, unknown>).title
                      : null,
                })),
            confidenceLevel: aiDiagnosis.confidenceLevel,
          }
        : null,
    };
  }

  private describeAbcPointsBlockedReason(blockedReason: string | null) {
    switch (blockedReason) {
      case 'abc_score_write_path_not_stable':
        return 'ABC 积分受控写入路径当前未稳定';
      case 'mobile_mapping_conflict':
        return '手机号命中多个 ABC 用户，映射冲突';
      case 'abc_user_not_found':
        return '未找到唯一 ABC 用户';
      case 'owner_mobile_missing':
        return '缺少手机号，无法做稳定对齐';
      case 'legacy_db_direct_risk':
        return '命中历史数据库手改遗留风险';
      case 'waiting_confirmation':
        return '命令尚未人工确认';
      case 'command_status_not_executable':
        return '当前命令状态不允许执行';
      default:
        return blockedReason ?? '未提供阻塞原因';
    }
  }

  private mapAbcPointsLedgerRow(entry: AbcPointsLedgerRow) {
    return {
      id: entry.id,
      rewardDomain: 'abc_score',
      sourceOfTruth: 'ABC',
      userId: entry.userId,
      ownerMobile: entry.ownerMobile,
      ownerName: entry.ownerName,
      pointsBefore: this.normalizeDecimalString(entry.pointsBefore),
      pointsAfter: this.normalizeDecimalString(entry.pointsAfter),
      changeAmount: this.normalizeDecimalString(entry.changeAmount),
      info: entry.info,
      orderId: entry.orderId,
      goodsId: entry.goodsId,
      orderSn: entry.orderSn,
      goodsName: entry.goodsName,
      pointsOrderStatus: entry.pointsOrderStatus,
      pointsOrderPayStatus: entry.pointsOrderPayStatus,
      sourceType: entry.sourceType,
      createdAt: entry.createdAt,
    };
  }

  private mapRedeemable(redeemable: PointsRedeemable) {
    return {
      id: redeemable.id,
      redeemableType: redeemable.redeemableType,
      redeemableCode: redeemable.redeemableCode,
      redeemableName: redeemable.redeemableName,
      providerSystem: redeemable.providerSystem,
      providerEntityId: redeemable.providerEntityId,
      pointsCost: redeemable.pointsCost,
      faceValue: redeemable.faceValue,
      enabledFlag: redeemable.enabledFlag,
      sceneScope: redeemable.sceneScope,
      normalizedPayload: redeemable.normalizedPayload ?? {},
      createdAt: redeemable.createdAt?.toISOString() ?? null,
      updatedAt: redeemable.updatedAt?.toISOString() ?? null,
    };
  }

  private mapRedemption(request: PointsRedemptionRequest) {
    return {
      id: request.id,
      requestStatus: request.requestStatus,
      ownerType: request.ownerType,
      ownerId: request.ownerId,
      ownerMobile: request.ownerMobile,
      redeemableType: request.redeemableType,
      redeemableCode: request.redeemableCode,
      redeemableName: request.redeemableName,
      pointsCost: request.pointsCost,
      targetValue: request.targetValue,
      providerSystem: request.providerSystem,
      requestSource: request.requestSource,
      requestedBy: request.requestedBy,
      requestedByName: request.requestedByName,
      requestedAt: request.requestedAt?.toISOString() ?? null,
      confirmedBy: request.confirmedBy,
      confirmedByName: request.confirmedByName,
      confirmedAt: request.confirmedAt?.toISOString() ?? null,
      fulfilledBy: request.fulfilledBy,
      fulfilledByName: request.fulfilledByName,
      fulfilledAt: request.fulfilledAt?.toISOString() ?? null,
      cancelledBy: request.cancelledBy,
      cancelledByName: request.cancelledByName,
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
      providerKey: request.providerKey ?? null,
      sourceActionId: request.sourceActionId ?? null,
      threadKey: request.threadKey ?? null,
      externalEntityId: request.externalEntityId ?? null,
      externalNo: request.externalNo ?? null,
      reasonCode: request.reasonCode ?? null,
      remark: request.remark ?? null,
      affectPerformanceFlag: this.resolveRedemptionAffectFlag(
        request,
        'affectPerformanceFlag',
      ),
      affectBCardFlag: this.resolveRedemptionAffectFlag(request, 'affectBCardFlag'),
      normalizedPayload: request.normalizedPayload ?? {},
      createdAt: request.createdAt?.toISOString() ?? null,
      updatedAt: request.updatedAt?.toISOString() ?? null,
    };
  }

  private mapLedgerEntry(entry: PointsLedgerEntry) {
    return {
      id: entry.id,
      ownerType: entry.ownerType,
      ownerId: entry.ownerId,
      ownerMobile: entry.ownerMobile,
      merchantId: entry.merchantId,
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

  private resolveEmployeeDisplayName(employee: Employee) {
    return employee.nameRemark?.trim()
      ? `${employee.name}（${employee.nameRemark.trim()}）`
      : employee.name;
  }

  private canViewFullSensitiveInfo(currentUser: CurrentUser) {
    return currentUser.roleCodes.some((roleCode) =>
      ['admin', 'finance', 'founder', 'super_admin', 'owner'].includes(roleCode),
    );
  }

  private maskMobileByRole(mobile: string | null, currentUser: CurrentUser) {
    if (!mobile) {
      return null;
    }
    if (this.canViewFullSensitiveInfo(currentUser)) {
      return mobile;
    }
    const normalized = this.normalizeMobile(mobile);
    return normalized ? normalized.replace(/^(\d{3})\d+(\d{4})$/, '$1****$2') : mobile;
  }

  private normalizePeriodKey(periodKey: string) {
    const normalized = periodKey.trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
      throw new BadRequestException('periodKey 必须是 YYYY-MM');
    }
    return normalized;
  }

  private resolveCurrentPeriodKey() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  }

  private readPayloadArray(
    payload: Record<string, unknown> | null | undefined,
    key: string,
  ) {
    const value = payload?.[key];
    return Array.isArray(value) ? value : [];
  }

  private resolveCommandAffectFlag(
    command: PointsCommandRequest,
    key: 'affectPerformanceFlag' | 'affectBCardFlag',
  ) {
    const payload = (command.normalizedPayload ?? {}) as Record<string, unknown>;
    const direct = payload[key];
    if (typeof direct === 'boolean') {
      return direct;
    }
    const nested = this.readPayloadObject(payload, 'targetEntity');
    if (typeof nested?.[key] === 'boolean') {
      return nested[key] as boolean;
    }
    return null;
  }

  private resolveRedemptionAffectFlag(
    request: PointsRedemptionRequest,
    key: 'affectPerformanceFlag' | 'affectBCardFlag',
  ) {
    const payload = (request.normalizedPayload ?? {}) as Record<string, unknown>;
    const direct = payload[key];
    if (typeof direct === 'boolean') {
      return direct;
    }
    const nested = this.readPayloadObject(payload, 'targetEntity');
    if (typeof nested?.[key] === 'boolean') {
      return nested[key] as boolean;
    }
    return null;
  }

  private readPayloadObject(
    payload: Record<string, unknown> | null | undefined,
    key: string,
  ) {
    const value = payload?.[key];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private readPayloadString(
    payload: Record<string, unknown> | null | undefined,
    key: string,
  ) {
    const value = payload?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private async getLatestBalance(
    ownerType: string,
    ownerId: number | null,
    ownerMobile: string | null,
    ledgerRepo: Repository<PointsLedgerEntry>,
  ) {
    const qb = ledgerRepo
      .createQueryBuilder('ledger')
      .where('ledger.owner_type = :ownerType', { ownerType })
      .orderBy('ledger.executed_at', 'DESC')
      .addOrderBy('ledger.id', 'DESC');

    if (ownerId) {
      qb.andWhere('ledger.owner_id = :ownerId', { ownerId });
    } else if (ownerMobile) {
      qb.andWhere('ledger.owner_mobile = :ownerMobile', { ownerMobile });
    } else {
      return 0;
    }

    const latest = await qb.getOne();
    return latest?.balanceAfter ? Number(latest.balanceAfter) : 0;
  }

  private normalizeMobile(input: string | null) {
    if (!input) {
      return null;
    }
    const digits = input.replace(/[^\d]/g, '');
    if (!digits) {
      return null;
    }
    return digits.startsWith('86') && digits.length > 11 ? digits.slice(-11) : digits;
  }

  private normalizeAmount(input: string, allowNegative: boolean) {
    const numeric = Number(input);
    if (!Number.isFinite(numeric) || (!allowNegative && numeric <= 0)) {
      throw new BadRequestException('积点变动金额必须是有效正数');
    }
    return numeric.toFixed(2);
  }

  private normalizeDecimalString(input: string | number | null | undefined) {
    if (input === null || input === undefined || input === '') {
      return '0.00';
    }
    const numeric = Number(input);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : String(input);
  }

  private calculateAbcPointsDelta(
    pointsBefore: string | number | null | undefined,
    pointsAfter: string | number | null | undefined,
  ) {
    const before = Number(pointsBefore ?? 0);
    const after = Number(pointsAfter ?? 0);
    if (!Number.isFinite(before) || !Number.isFinite(after)) {
      return '0.00';
    }
    return (after - before).toFixed(2);
  }

  private resolveLedgerDelta(commandType: string, amount: string) {
    const numeric = Number(amount);
    switch (commandType) {
      case 'issue_points':
      case 'adjust_points':
        return numeric;
      case 'revoke_points':
        return -numeric;
      default:
        throw new BadRequestException('不支持的积点命令类型');
    }
  }

  private resolveLedgerChangeType(commandType: string) {
    switch (commandType) {
      case 'issue_points':
        return 'issue';
      case 'adjust_points':
        return 'adjust';
      case 'revoke_points':
        return 'revoke';
      default:
        throw new BadRequestException('不支持的积点命令类型');
    }
  }

  private compactPayload(payload: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    );
  }

  private normalizeSortOrder(sortOrder: string | undefined, fallback: 'ASC' | 'DESC') {
    if (!sortOrder) {
      return fallback;
    }
    return sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }

  private getAbcSourceReadonlyPool() {
    if (this.abcSourceReadonlyPool !== undefined) {
      return this.abcSourceReadonlyPool;
    }

    const host = process.env.ABC_SOURCE_DB_HOST?.trim();
    const port = Number(process.env.ABC_SOURCE_DB_PORT ?? '');
    const username = process.env.ABC_SOURCE_DB_USERNAME?.trim();
    const password = process.env.ABC_SOURCE_DB_PASSWORD ?? '';
    const database = process.env.ABC_SOURCE_DB_NAME?.trim();

    if (!host || !Number.isFinite(port) || port <= 0 || !username || !database) {
      this.abcSourceReadonlyPool = null;
      return this.abcSourceReadonlyPool;
    }

    this.abcSourceReadonlyPool = createPool({
      host,
      port,
      user: username,
      password,
      database,
      charset: 'utf8mb4',
      waitForConnections: false,
      connectionLimit: 1,
      maxIdle: 1,
      idleTimeout: 5000,
      queueLimit: 0,
      connectTimeout: 1500,
      enableKeepAlive: false,
    });

    return this.abcSourceReadonlyPool;
  }

  private buildAbcScoreSourceTypeCaseSql(logAlias: string) {
    return `
      CASE
        WHEN ${logAlias}.order_id IS NOT NULL OR ${logAlias}.goods_id IS NOT NULL OR ${logAlias}.info LIKE '%购买%' OR ${logAlias}.info LIKE '%套餐%' THEN 'product_bonus_readonly'
        WHEN ${logAlias}.info LIKE '%总部%' OR ${logAlias}.info LIKE '%HQ%' THEN 'hq_issue'
        WHEN ${logAlias}.info LIKE '%纠偏%' OR ${logAlias}.info LIKE '%校正%' OR ${logAlias}.info LIKE '%修正%' THEN 'correction'
        WHEN ${logAlias}.info LIKE '%修理赠送%' OR ${logAlias}.info LIKE '%补偿%' OR ${logAlias}.info LIKE '%客服%' THEN 'customer_service_compensation'
        WHEN ${logAlias}.info LIKE '%管理员%' OR ${logAlias}.info LIKE '%手工%' OR ${logAlias}.info LIKE '%直接%' THEN 'legacy_db_direct'
        ELSE 'other'
      END
    `;
  }

  private resolveAbcPointsCurrentEnvironmentAllowsWrite() {
    return ABC_SCORE_WRITE_PATH_STABLE;
  }

  private resolveAbcPointsBridgeServiceAvailability(currentEnvironmentAllowsWrite: boolean) {
    return currentEnvironmentAllowsWrite && ABC_SCORE_WRITE_PATH_STABLE;
  }

  private resolveAbcPointsProviderBridgeAvailability(
    _providerKey: string,
    bridgeServiceAvailable: boolean,
  ) {
    return bridgeServiceAvailable;
  }

  private async findAbcUsersByMobiles(ownerMobiles: string[]) {
    const normalizedMobiles = Array.from(
      new Set(
        ownerMobiles
          .map((item) => this.normalizeMobile(item))
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const candidatesByMobile = new Map<string, Array<Record<string, unknown>>>();
    for (const mobile of normalizedMobiles) {
      candidatesByMobile.set(mobile, []);
    }
    if (!normalizedMobiles.length) {
      return candidatesByMobile;
    }

    const pool = this.getAbcSourceReadonlyPool();
    if (!pool) {
      return candidatesByMobile;
    }

    const chunkSize = 100;
    for (let index = 0; index < normalizedMobiles.length; index += chunkSize) {
      const batch = normalizedMobiles.slice(index, index + chunkSize);
      const placeholders = batch.map(() => '?').join(', ');
      const [rowsRaw] = await pool.query(
        `
          SELECT
            id,
            nickname,
            mobile,
            CAST(points AS DECIMAL(18, 2)) AS points,
            CAST(exchange_points AS DECIMAL(18, 2)) AS exchangePoints
          FROM user_account
          WHERE mobile IN (${placeholders})
          ORDER BY mobile ASC, id DESC
        `,
        batch,
      );
      const rows = rowsRaw as Array<{
        id: number;
        nickname: string | null;
        mobile: string | null;
        points: string | null;
        exchangePoints: string | null;
      }>;

      for (const item of rows) {
        const mobile = this.normalizeMobile(item.mobile);
        if (!mobile) {
          continue;
        }
        const candidates = candidatesByMobile.get(mobile);
        if (!candidates) {
          continue;
        }
        candidates.push({
          id: item.id,
          nickname: item.nickname,
          mobile: item.mobile,
          points: this.normalizeDecimalString(item.points),
          exchangePoints: this.normalizeDecimalString(item.exchangePoints),
        });
      }
    }

    return candidatesByMobile;
  }

  private async findAbcUsersByMobile(ownerMobile: string | null) {
    const normalizedMobile = this.normalizeMobile(ownerMobile);
    if (!normalizedMobile) {
      return [];
    }
    const candidatesByMobile = await this.findAbcUsersByMobiles([normalizedMobile]);
    return candidatesByMobile.get(normalizedMobile) ?? [];
  }
}


