import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { buildPaginationResult, getPagination, paginateArray } from '../../common/utils/pagination.util';
import { addMoney, addQuantity, normalizeMoney, normalizeQuantity } from '../../common/utils/decimal.util';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { PayrollTrialDetailType } from '../../shared/enums/payroll-trial-detail-type.enum';
import { PayrollTrialRunStatus } from '../../shared/enums/payroll-trial-run-status.enum';
import { PerformanceEventSourceDomain } from '../../shared/enums/performance-event-source-domain.enum';
import { RewardEventType } from '../../shared/enums/reward-event-type.enum';
import { RewardSummaryDomain } from '../../shared/enums/reward-summary-domain.enum';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { BusinessStatSummary } from '../business-stats/entities/business-stat-summary.entity';
import { RewardEventRule } from '../business-stats/entities/reward-event-rule.entity';
import { RewardEvent } from '../business-stats/entities/reward-event.entity';
import { Employee } from '../performance/entities/employee.entity';
import { PerformanceSummary } from '../performance/entities/performance-summary.entity';
import { User } from '../users/entities/user.entity';
import { ConfirmPayrollTrialDto } from './dto/confirm-payroll-trial.dto';
import { GeneratePayrollTrialsDto } from './dto/generate-payroll-trials.dto';
import { QueryPayrollTrialDetailDto } from './dto/query-payroll-trial-detail.dto';
import { QueryPayrollTrialPendingItemsDto } from './dto/query-payroll-trial-pending-items.dto';
import { QueryPayrollTrialsDto } from './dto/query-payroll-trials.dto';
import { PayrollTrialItemDetail } from './entities/payroll-trial-item-detail.entity';
import { PayrollTrialItem } from './entities/payroll-trial-item.entity';
import { PayrollTrialRun } from './entities/payroll-trial-run.entity';

type PayrollRuleStrength = 'strong' | 'weak';
type PayrollEvidenceStatus = 'confirmed' | 'inferred' | 'uncertain';
type PayrollInclusionCategory = 'included' | 'reference_only' | 'pending_only';
type PayrollReasonCode =
  | 'included_whitelist'
  | 'missing_employee_binding'
  | 'missing_confirmation_status'
  | 'insufficient_evidence'
  | 'weak_rule'
  | 'not_in_whitelist'
  | 'unknown_merchant_attribution'
  | 'reference_only'
  | 'ignored';

interface PayrollDetailCandidate {
  detailType: PayrollTrialDetailType;
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  sourceOrderNo?: string | null;
  sourceRecordId?: number | null;
  employeeId?: number | null;
  periodKey: string;
  summaryDomain: RewardSummaryDomain;
  amountStandard?: string | null;
  quantityStandard?: string | null;
  rewardPoints?: string | null;
  rewardAmount?: string | null;
  calculatedAmount?: string | null;
  pendingFlag?: boolean;
  ignoredFlag?: boolean;
  includedFlag?: boolean;
  includedReason?: string | null;
  excludedReason?: string | null;
  matchedRule?: string | null;
  ruleStrength?: PayrollRuleStrength | null;
  evidenceStatus?: PayrollEvidenceStatus | null;
  reasonCodes?: PayrollReasonCode[];
  occurredAt: Date;
  normalizedPayload: Record<string, unknown>;
}

interface PayrollInclusionDecision {
  includedFlag: boolean;
  inclusionCategory: PayrollInclusionCategory;
  includedReason: string | null;
  excludedReason: string | null;
  matchedRule: string | null;
  ruleStrength: PayrollRuleStrength | null;
  evidenceStatus: PayrollEvidenceStatus;
  reasonCodes: PayrollReasonCode[];
}

interface PayrollAccumulator {
  trialKey: string;
  periodKey: string;
  summaryDomain: RewardSummaryDomain;
  employeeId: number | null;
  sourceSummaryCount: number;
  sourceEventCount: number;
  rewardAmountTotal: string;
  rewardPointsTotal: string;
  pendingCount: number;
  ignoredCount: number;
  calculatedTotal: string;
  remarkSet: Set<string>;
  normalizedPayload: {
    performanceSummaryIds: number[];
    businessStatSummaryIds: number[];
    rewardEventIds: number[];
    sourceBreakdown: {
      performanceSummaryCount: number;
      businessStatSummaryCount: number;
      rewardEventCount: number;
    };
    inclusionBreakdown: {
      includedCount: number;
      referenceOnlyCount: number;
      pendingOnlyCount: number;
    };
  };
  details: PayrollDetailCandidate[];
}

const ITEM_SORT_COLUMNS: Record<string, string> = {
  periodKey: 'item.periodKey',
  summaryDomain: 'item.summaryDomain',
  sourceSummaryCount: 'item.sourceSummaryCount',
  sourceEventCount: 'item.sourceEventCount',
  rewardAmountTotal: 'item.rewardAmountTotal',
  rewardPointsTotal: 'item.rewardPointsTotal',
  pendingCount: 'item.pendingCount',
  ignoredCount: 'item.ignoredCount',
  calculatedTotal: 'item.calculatedTotal',
  updatedAt: 'item.updatedAt',
  createdAt: 'item.createdAt',
};

@Injectable()
export class PayrollTrialsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(PerformanceSummary)
    private readonly performanceSummaryRepository: Repository<PerformanceSummary>,
    @InjectRepository(BusinessStatSummary)
    private readonly businessStatSummaryRepository: Repository<BusinessStatSummary>,
    @InjectRepository(RewardEvent)
    private readonly rewardEventRepository: Repository<RewardEvent>,
    @InjectRepository(RewardEventRule)
    private readonly rewardEventRuleRepository: Repository<RewardEventRule>,
    @InjectRepository(PayrollTrialRun)
    private readonly payrollTrialRunRepository: Repository<PayrollTrialRun>,
    @InjectRepository(PayrollTrialItem)
    private readonly payrollTrialItemRepository: Repository<PayrollTrialItem>,
    @InjectRepository(PayrollTrialItemDetail)
    private readonly payrollTrialItemDetailRepository: Repository<PayrollTrialItemDetail>,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async generatePayrollTrials(dto: GeneratePayrollTrialsDto, currentUser: CurrentUser) {
    const periodKey = dto.periodKey?.trim();
    if (!periodKey) {
      throw new BadRequestException('periodKey 不能为空');
    }

    const run = this.payrollTrialRunRepository.create({
      periodKey,
      batchNo: dto.batchNo?.trim() || `PAYROLL_TRIAL_${periodKey}_${Date.now()}`,
      forceRegenerate: dto.forceRegenerate ?? false,
      runStatus: PayrollTrialRunStatus.RUNNING,
      sourceSummaryCount: 0,
      sourceEventCount: 0,
      createdItemCount: 0,
      updatedItemCount: 0,
      processedItemCount: 0,
      errorMessage: null,
      normalizedPayload: {},
      startedAt: new Date(),
      finishedAt: null,
    });
    await this.payrollTrialRunRepository.save(run);

    try {
      if (dto.forceRegenerate) {
        await this.clearExistingPayrollTrials(periodKey);
      }

      const [performanceSummaries, businessStatSummaries, rewardEvents, rewardRules] =
        await Promise.all([
          this.loadPerformanceSummaries(periodKey),
          this.loadBusinessStatSummaries(periodKey),
          this.loadRewardEvents(periodKey),
          this.rewardEventRuleRepository.find({
            where: {
              isActive: true,
              rewardEnabled: true,
            },
          }),
        ]);

      const accumulators = new Map<string, PayrollAccumulator>();
      this.collectPerformanceSummaryAccumulators(accumulators, performanceSummaries, periodKey);
      this.collectBusinessStatSummaryAccumulators(accumulators, businessStatSummaries, periodKey);
      this.collectRewardEventAccumulators(accumulators, rewardEvents, rewardRules, periodKey);

      const existingItems = await this.payrollTrialItemRepository.find({
        where: { periodKey },
      });
      const existingByKey = new Map(existingItems.map((item) => [item.trialKey, item]));

      let createdItemCount = 0;
      let updatedItemCount = 0;
      for (const accumulator of accumulators.values()) {
        const outcome = await this.upsertPayrollTrialItem(run, accumulator, existingByKey);
        if (outcome === 'created') createdItemCount += 1;
        else updatedItemCount += 1;
      }

      run.runStatus = PayrollTrialRunStatus.COMPLETED;
      run.sourceSummaryCount = performanceSummaries.length + businessStatSummaries.length;
      run.sourceEventCount = rewardEvents.length;
      run.createdItemCount = createdItemCount;
      run.updatedItemCount = updatedItemCount;
      run.processedItemCount = accumulators.size;
      run.finishedAt = new Date();
      run.normalizedPayload = {
        periodKey,
        sourceCounts: {
          performanceSummaries: performanceSummaries.length,
          businessStatSummaries: businessStatSummaries.length,
          rewardEvents: rewardEvents.length,
        },
        trialItemKeys: Array.from(accumulators.keys()),
      };
      await this.payrollTrialRunRepository.save(run);

      const result = {
        runId: run.id,
        batchNo: run.batchNo,
        periodKey,
        createdItemCount,
        updatedItemCount,
        processedItemCount: accumulators.size,
        sourceSummaryCount: run.sourceSummaryCount,
        sourceEventCount: run.sourceEventCount,
        forceRegenerate: dto.forceRegenerate ?? false,
      };

      await this.operationLogsService.create({
        module: 'payroll_trial',
        targetId: run.id,
        action: 'generate_payroll_trials',
        operatorId: currentUser.id,
        detail: `生成工资试算 ${periodKey} 共 ${accumulators.size} 条`,
        detailJson: result,
      });

      return result;
    } catch (error) {
      run.runStatus = PayrollTrialRunStatus.FAILED;
      run.finishedAt = new Date();
      run.errorMessage = error instanceof Error ? error.message : '未知错误';
      run.normalizedPayload = {
        periodKey,
        failed: true,
      };
      await this.payrollTrialRunRepository.save(run);

      await this.operationLogsService.create({
        module: 'payroll_trial',
        targetId: run.id,
        action: 'generate_payroll_trials_failed',
        operatorId: currentUser.id,
        detail: `工资试算生成失败 ${periodKey}`,
        detailJson: {
          runId: run.id,
          batchNo: run.batchNo,
          errorMessage: run.errorMessage,
        },
      });
      throw error;
    }
  }

  async findPayrollTrials(query: QueryPayrollTrialsDto, currentUser: CurrentUser) {
    const { skip, take } = getPagination(query);
    const qb = this.payrollTrialItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.employee', 'employee')
      .leftJoinAndSelect('item.confirmedByUser', 'confirmedByUser')
      .leftJoinAndSelect('item.payrollTrialRun', 'run');

    if (query.periodKey) qb.andWhere('item.periodKey = :periodKey', { periodKey: query.periodKey });
    if (query.summaryDomain) {
      qb.andWhere('item.summaryDomain = :summaryDomain', { summaryDomain: query.summaryDomain });
    }
    if (query.employeeId !== undefined) {
      qb.andWhere('item.employeeId = :employeeId', { employeeId: query.employeeId });
    }
    if (query.confirmedFlag !== undefined) {
      qb.andWhere('item.confirmedFlag = :confirmedFlag', { confirmedFlag: query.confirmedFlag });
    }
    if (query.pendingOnly) {
      qb.andWhere('(item.pendingCount > 0 OR item.employeeId IS NULL)');
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        ITEM_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(
      query,
      list.map((item) => this.mapPayrollTrialItem(item, currentUser)),
      total,
    );
  }

  async findPayrollTrialById(id: number, currentUser: CurrentUser) {
    const item = await this.findPayrollTrialEntityById(id);
    return this.mapPayrollTrialItem(item, currentUser);
  }

  async findPayrollTrialDetail(
    id: number,
    query: QueryPayrollTrialDetailDto,
    currentUser: CurrentUser,
  ) {
    const item = await this.findPayrollTrialEntityById(id);
    const details = await this.payrollTrialItemDetailRepository.find({
      where: { payrollTrialItemId: id },
      relations: {
        employee: true,
        payrollTrialRun: true,
      },
    });

    const sortBy = query.sortBy ?? 'occurredAt';
    const sortOrder = this.normalizeSortOrder(query.sortOrder, 'DESC');
    const sorted = details
      .slice()
      .sort((left, right) => {
        const leftValue = this.readSortableValue(left as unknown as Record<string, unknown>, sortBy);
        const rightValue = this.readSortableValue(
          right as unknown as Record<string, unknown>,
          sortBy,
        );
        return sortOrder === 'ASC'
          ? leftValue > rightValue
            ? 1
            : leftValue < rightValue
              ? -1
              : 0
          : leftValue < rightValue
            ? 1
            : leftValue > rightValue
              ? -1
              : 0;
      })
      .map((detail) => this.mapPayrollTrialItemDetail(detail, currentUser));

    return {
      item: this.mapPayrollTrialItem(item, currentUser),
      detail: paginateArray(sorted, query),
    };
  }

  async confirmPayrollTrial(id: number, dto: ConfirmPayrollTrialDto, currentUser: CurrentUser) {
    const item = await this.findPayrollTrialEntityById(id);
    const before = this.mapPayrollTrialItem(item, currentUser);
    item.confirmedFlag = true;
    item.confirmedBy = currentUser.id;
    item.confirmedAt = new Date();
    if (dto.remark !== undefined) {
      item.remark = dto.remark?.trim() || null;
    }
    const saved = await this.payrollTrialItemRepository.save(item);

    await this.operationLogsService.create({
      module: 'payroll_trial',
      targetId: saved.id,
      action: 'confirm_payroll_trial',
      operatorId: currentUser.id,
      detail: `确认工资试算 ${saved.trialKey}`,
      detailJson: {
        before,
        after: this.mapPayrollTrialItem(saved, currentUser),
      },
    });

    return this.findPayrollTrialDetail(saved.id, {}, currentUser);
  }

  async findPendingItems(query: QueryPayrollTrialPendingItemsDto, currentUser: CurrentUser) {
    const qb = this.payrollTrialItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.employee', 'employee')
      .leftJoinAndSelect('item.payrollTrialRun', 'run')
      .where('(item.pendingCount > 0 OR item.employeeId IS NULL)');

    if (query.periodKey) qb.andWhere('item.periodKey = :periodKey', { periodKey: query.periodKey });
    if (query.summaryDomain) {
      qb.andWhere('item.summaryDomain = :summaryDomain', { summaryDomain: query.summaryDomain });
    }

    const items = await qb.getMany();
    const sortBy = query.sortBy ?? 'updatedAt';
    const sortOrder = this.normalizeSortOrder(query.sortOrder, 'DESC');
    items.sort((left, right) => {
      const leftValue = this.readSortableValue(left as unknown as Record<string, unknown>, sortBy);
      const rightValue = this.readSortableValue(
        right as unknown as Record<string, unknown>,
        sortBy,
      );
      return sortOrder === 'ASC'
        ? leftValue > rightValue
          ? 1
          : leftValue < rightValue
            ? -1
            : 0
        : leftValue < rightValue
          ? 1
          : leftValue > rightValue
            ? -1
            : 0;
    });

    return paginateArray(
      items.map((item) => this.mapPayrollTrialItem(item, currentUser)),
      query,
    );
  }

  private collectPerformanceSummaryAccumulators(
    accumulators: Map<string, PayrollAccumulator>,
    performanceSummaries: PerformanceSummary[],
    periodKey: string,
  ) {
    for (const performanceSummary of performanceSummaries) {
      const summaryDomain = this.resolveSummaryDomainForPerformanceSummary(
        performanceSummary.sourceDomain,
      );
      if (!summaryDomain) {
        continue;
      }

      const accumulator = this.getAccumulator(accumulators, {
        periodKey,
        summaryDomain,
        employeeId: performanceSummary.employeeId,
      });
      const decision = this.evaluatePerformanceSummaryInclusion(performanceSummary);
      accumulator.sourceSummaryCount += 1;
      accumulator.normalizedPayload.performanceSummaryIds.push(performanceSummary.id);
      accumulator.normalizedPayload.sourceBreakdown.performanceSummaryCount += 1;
      this.applyInclusionBreakdown(accumulator, decision.inclusionCategory);
      if (!performanceSummary.employeeId) {
        accumulator.pendingCount += 1;
        accumulator.remarkSet.add('存在未绑定员工的绩效汇总来源');
      }
      if (decision.excludedReason) {
        accumulator.remarkSet.add(decision.excludedReason);
      }
      accumulator.details.push({
        detailType: PayrollTrialDetailType.PERFORMANCE_SUMMARY,
        sourceSystem: 'stark',
        sourceTable: 'performance_summaries',
        sourceId: String(performanceSummary.id),
        sourceRecordId: performanceSummary.id,
        employeeId: performanceSummary.employeeId,
        periodKey,
        summaryDomain,
        amountStandard: normalizeMoney(performanceSummary.amountTotal),
        quantityStandard: normalizeQuantity(performanceSummary.quantityTotal),
        rewardPoints: '0.00',
        rewardAmount: '0.00',
        calculatedAmount: '0.00',
        pendingFlag: decision.inclusionCategory === 'pending_only',
        ignoredFlag: false,
        includedFlag: decision.includedFlag,
        includedReason: decision.includedReason,
        excludedReason: decision.excludedReason,
        matchedRule: decision.matchedRule,
        ruleStrength: decision.ruleStrength,
        evidenceStatus: decision.evidenceStatus,
        reasonCodes: decision.reasonCodes,
        occurredAt: performanceSummary.updatedAt ?? performanceSummary.createdAt,
        normalizedPayload: {
          sourceDomain: performanceSummary.sourceDomain,
          eventCount: performanceSummary.eventCount,
          confirmedEventCount: performanceSummary.confirmedEventCount,
          pendingEventCount: performanceSummary.pendingEventCount,
          payrollCalibration: {
            inclusionCategory: decision.inclusionCategory,
          },
          normalizedPayload: performanceSummary.normalizedPayload,
        },
      });
    }
  }

  private collectBusinessStatSummaryAccumulators(
    accumulators: Map<string, PayrollAccumulator>,
    businessStatSummaries: BusinessStatSummary[],
    periodKey: string,
  ) {
    for (const businessStatSummary of businessStatSummaries) {
      const accumulator = this.getAccumulator(accumulators, {
        periodKey,
        summaryDomain: businessStatSummary.summaryDomain,
        employeeId: businessStatSummary.responsibleEmployeeId,
      });
      const decision = this.evaluateBusinessStatSummaryInclusion(businessStatSummary);
      accumulator.sourceSummaryCount += 1;
      accumulator.normalizedPayload.businessStatSummaryIds.push(businessStatSummary.id);
      accumulator.normalizedPayload.sourceBreakdown.businessStatSummaryCount += 1;
      this.applyInclusionBreakdown(accumulator, decision.inclusionCategory);
      if (decision.inclusionCategory === 'pending_only') {
        accumulator.pendingCount += 1;
      }
      if (!businessStatSummary.responsibleEmployeeId) {
        accumulator.pendingCount += 1;
        accumulator.remarkSet.add('存在未绑定员工的业务统计汇总来源');
      }
      if (decision.excludedReason) {
        accumulator.remarkSet.add(decision.excludedReason);
      }
      accumulator.details.push({
        detailType: PayrollTrialDetailType.BUSINESS_STAT_SUMMARY,
        sourceSystem: 'stark',
        sourceTable: 'business_stat_summaries',
        sourceId: String(businessStatSummary.id),
        sourceRecordId: businessStatSummary.id,
        employeeId: businessStatSummary.responsibleEmployeeId,
        periodKey,
        summaryDomain: businessStatSummary.summaryDomain,
        amountStandard: normalizeMoney(businessStatSummary.amountTotal),
        quantityStandard: normalizeQuantity(businessStatSummary.quantityTotal),
        rewardPoints: '0.00',
        rewardAmount: '0.00',
        calculatedAmount: '0.00',
        pendingFlag: decision.inclusionCategory === 'pending_only',
        ignoredFlag: false,
        includedFlag: decision.includedFlag,
        includedReason: decision.includedReason,
        excludedReason: decision.excludedReason,
        matchedRule: decision.matchedRule,
        ruleStrength: decision.ruleStrength,
        evidenceStatus: decision.evidenceStatus,
        reasonCodes: decision.reasonCodes,
        occurredAt: businessStatSummary.updatedAt ?? businessStatSummary.createdAt,
        normalizedPayload: {
          summaryKey: businessStatSummary.summaryKey,
          tagCount: businessStatSummary.tagCount,
          rewardEventCount: businessStatSummary.rewardEventCount,
          confirmedRewardEventCount: businessStatSummary.confirmedRewardEventCount,
          pendingRewardEventCount: businessStatSummary.pendingRewardEventCount,
          payrollCalibration: {
            inclusionCategory: decision.inclusionCategory,
          },
          normalizedPayload: businessStatSummary.normalizedPayload,
        },
      });
    }
  }

  private collectRewardEventAccumulators(
    accumulators: Map<string, PayrollAccumulator>,
    rewardEvents: RewardEvent[],
    rewardRules: RewardEventRule[],
    periodKey: string,
  ) {
    for (const rewardEvent of rewardEvents) {
      const summaryDomain = this.resolveSummaryDomainForRewardEvent(rewardEvent.eventType);
      const accumulator = this.getAccumulator(accumulators, {
        periodKey,
        summaryDomain,
        employeeId: rewardEvent.responsibleEmployeeId,
      });
      accumulator.sourceEventCount += 1;
      accumulator.normalizedPayload.rewardEventIds.push(rewardEvent.id);
      accumulator.normalizedPayload.sourceBreakdown.rewardEventCount += 1;

      const matchedRule = this.matchRewardRule(rewardEvent, summaryDomain, rewardRules);
      const decision = this.evaluateRewardEventInclusion(rewardEvent, matchedRule);
      this.applyInclusionBreakdown(accumulator, decision.inclusionCategory);
      let rewardPoints = '0.00';
      let rewardAmount = '0.00';
      let calculatedAmount = '0.00';

      if (rewardEvent.ignoredFlag) {
        accumulator.ignoredCount += 1;
      } else if (decision.inclusionCategory === 'pending_only') {
        accumulator.pendingCount += 1;
      } else if (decision.includedFlag && matchedRule) {
        rewardPoints = normalizeQuantity(matchedRule.defaultWeight);
        rewardAmount = this.multiplyMoneyByFactor(
          rewardEvent.amountStandard ?? '0.00',
          matchedRule.defaultCoefficient,
        );
        calculatedAmount = rewardAmount;
        accumulator.rewardPointsTotal = addQuantity(accumulator.rewardPointsTotal, rewardPoints);
        accumulator.rewardAmountTotal = addMoney(accumulator.rewardAmountTotal, rewardAmount);
        accumulator.calculatedTotal = addMoney(accumulator.calculatedTotal, calculatedAmount);
      } else {
        accumulator.remarkSet.add(`存在未命中奖励规则的事件类型 ${rewardEvent.eventType}`);
      }

      if (decision.excludedReason) {
        accumulator.remarkSet.add(decision.excludedReason);
      }
      if (!rewardEvent.responsibleEmployeeId && !rewardEvent.ignoredFlag) {
        accumulator.remarkSet.add('存在未绑定员工的奖励事件来源');
      }

      accumulator.details.push({
        detailType: PayrollTrialDetailType.REWARD_EVENT,
        sourceSystem: rewardEvent.sourceSystem,
        sourceTable: rewardEvent.sourceTable,
        sourceId: rewardEvent.sourceId,
        sourceOrderNo: rewardEvent.sourceOrderNo,
        sourceRecordId: rewardEvent.id,
        employeeId: rewardEvent.responsibleEmployeeId,
        periodKey,
        summaryDomain,
        amountStandard: rewardEvent.amountStandard,
        quantityStandard: rewardEvent.quantityStandard,
        rewardPoints,
        rewardAmount,
        calculatedAmount,
        pendingFlag: decision.inclusionCategory === 'pending_only',
        ignoredFlag: rewardEvent.ignoredFlag,
        includedFlag: decision.includedFlag,
        includedReason: decision.includedReason,
        excludedReason: decision.excludedReason,
        matchedRule: decision.matchedRule,
        ruleStrength: decision.ruleStrength,
        evidenceStatus: decision.evidenceStatus,
        reasonCodes: decision.reasonCodes,
        occurredAt: rewardEvent.occurredAt,
        normalizedPayload: {
          eventType: rewardEvent.eventType,
          businessDomain: rewardEvent.businessDomain,
          remark: rewardEvent.remark,
          payrollCalibration: {
            inclusionCategory: decision.inclusionCategory,
          },
          matchedRule: matchedRule
            ? {
                ruleCode: matchedRule.ruleCode,
                ruleName: matchedRule.ruleName,
                defaultWeight: matchedRule.defaultWeight,
                defaultCoefficient: matchedRule.defaultCoefficient,
              }
            : null,
          normalizedPayload: rewardEvent.normalizedPayload,
        },
      });
    }
  }

  private async loadPerformanceSummaries(periodKey: string) {
    return this.performanceSummaryRepository
      .createQueryBuilder('summary')
      .leftJoinAndSelect('summary.performancePeriod', 'period')
      .leftJoinAndSelect('summary.employee', 'employee')
      .where('period.periodKey = :periodKey', { periodKey })
      .getMany();
  }

  private async loadBusinessStatSummaries(periodKey: string) {
    return this.businessStatSummaryRepository.find({
      where: { periodKey },
      relations: {
        responsibleEmployee: true,
        confirmedByUser: true,
      },
    });
  }

  private async loadRewardEvents(periodKey: string) {
    return this.rewardEventRepository.find({
      where: { periodKey },
      relations: {
        responsibleEmployee: true,
        handledByUser: true,
      },
    });
  }

  private evaluatePerformanceSummaryInclusion(
    performanceSummary: PerformanceSummary,
  ): PayrollInclusionDecision {
    if (!performanceSummary.employeeId) {
      return {
        includedFlag: false,
        inclusionCategory: 'pending_only',
        includedReason: null,
        excludedReason: '绩效汇总未绑定员工，仅保留待确认',
        matchedRule: 'reference.performance_summary',
        ruleStrength: 'weak',
        evidenceStatus: 'uncertain',
        reasonCodes: ['missing_employee_binding'],
      };
    }

    return {
      includedFlag: false,
      inclusionCategory: 'reference_only',
      includedReason: null,
      excludedReason: '绩效汇总仅作工资试算参考来源，不直接计入试算金额',
      matchedRule: 'reference.performance_summary',
      ruleStrength: 'weak',
      evidenceStatus: 'inferred',
      reasonCodes: ['reference_only'],
    };
  }

  private evaluateBusinessStatSummaryInclusion(
    businessStatSummary: BusinessStatSummary,
  ): PayrollInclusionDecision {
    if (!businessStatSummary.responsibleEmployeeId || !businessStatSummary.confirmedFlag) {
      const reasonCodes: PayrollReasonCode[] = [];
      if (!businessStatSummary.responsibleEmployeeId) {
        reasonCodes.push('missing_employee_binding');
      }
      if (!businessStatSummary.confirmedFlag) {
        reasonCodes.push('missing_confirmation_status');
      }
      return {
        includedFlag: false,
        inclusionCategory: 'pending_only',
        includedReason: null,
        excludedReason: '经营统计汇总仍含待确认归属或口径，仅保留待确认',
        matchedRule: `summary.${businessStatSummary.summaryDomain}`,
        ruleStrength: 'weak',
        evidenceStatus: businessStatSummary.confirmedFlag ? 'inferred' : 'uncertain',
        reasonCodes,
      };
    }

    return {
      includedFlag: false,
      inclusionCategory: 'reference_only',
      includedReason: null,
      excludedReason: '经营统计汇总用于口径核对与解释，不直接计入工资试算金额',
      matchedRule: `summary.${businessStatSummary.summaryDomain}`,
      ruleStrength: 'weak',
      evidenceStatus: 'confirmed',
      reasonCodes: ['reference_only'],
    };
  }

  private evaluateRewardEventInclusion(
    rewardEvent: RewardEvent,
    matchedRule: RewardEventRule | null,
  ): PayrollInclusionDecision {
    if (rewardEvent.ignoredFlag) {
      return {
        includedFlag: false,
        inclusionCategory: 'reference_only',
        includedReason: null,
        excludedReason: '奖励事件已忽略，不纳入工资试算',
        matchedRule: matchedRule?.ruleCode ?? null,
        ruleStrength: this.resolveRewardEventRuleStrength(rewardEvent),
        evidenceStatus: 'uncertain',
        reasonCodes: ['ignored'],
      };
    }

    if (!matchedRule) {
      return {
        includedFlag: false,
        inclusionCategory: 'pending_only',
        includedReason: null,
        excludedReason: '奖励事件未命中奖励规则，仅保留待确认',
        matchedRule: null,
        ruleStrength: 'weak',
        evidenceStatus: 'uncertain',
        reasonCodes: ['not_in_whitelist'],
      };
    }

    if (!rewardEvent.responsibleEmployeeId) {
      const reasonCodes: PayrollReasonCode[] = ['missing_employee_binding'];
      if (this.hasUnknownMerchantAttribution(rewardEvent)) {
        reasonCodes.push('unknown_merchant_attribution');
      }
      return {
        includedFlag: false,
        inclusionCategory: 'pending_only',
        includedReason: null,
        excludedReason: '奖励事件未绑定员工，仅保留待确认',
        matchedRule: matchedRule.ruleCode,
        ruleStrength: this.resolveRewardEventRuleStrength(rewardEvent),
        evidenceStatus: 'uncertain',
        reasonCodes,
      };
    }

    if (!rewardEvent.confirmedFlag) {
      return {
        includedFlag: false,
        inclusionCategory: 'pending_only',
        includedReason: null,
        excludedReason: '奖励事件未确认，仅保留待确认',
        matchedRule: matchedRule.ruleCode,
        ruleStrength: this.resolveRewardEventRuleStrength(rewardEvent),
        evidenceStatus: 'uncertain',
        reasonCodes: ['missing_confirmation_status'],
      };
    }

    const evidenceStatus = this.resolveRewardEventEvidenceStatus(rewardEvent);
    const ruleStrength = this.resolveRewardEventRuleStrength(rewardEvent);

    switch (rewardEvent.eventType) {
      case RewardEventType.A_ORDER_COMPLETED:
        if (this.isAWashCardRewardEvent(rewardEvent)) {
          return {
            includedFlag: true,
            inclusionCategory: 'included',
            includedReason: 'A端洗车卡销售主链已确认，纳入工资试算参考金额',
            excludedReason: null,
            matchedRule: matchedRule.ruleCode,
            ruleStrength: 'strong',
            evidenceStatus: 'confirmed',
            reasonCodes: ['included_whitelist'],
          };
        }
        return {
          includedFlag: false,
          inclusionCategory: 'reference_only',
          includedReason: null,
          excludedReason: '普通订单完成事件仅展示，不直接纳入工资正式结论',
          matchedRule: matchedRule.ruleCode,
          ruleStrength,
          evidenceStatus,
          reasonCodes: ['reference_only'],
        };
      case RewardEventType.PUBLIC_VEHICLE_COMPLETED:
        return rewardEvent.vehicleType === 'public'
          ? {
              includedFlag: true,
              inclusionCategory: 'included',
              includedReason: '存在明确公车证据且事件已确认，可纳入工资试算',
              excludedReason: null,
              matchedRule: matchedRule.ruleCode,
              ruleStrength: 'strong',
              evidenceStatus: 'confirmed',
              reasonCodes: ['included_whitelist'],
            }
          : {
              includedFlag: false,
              inclusionCategory: 'pending_only',
              includedReason: null,
              excludedReason: '公车证据不足，仅保留待确认',
              matchedRule: matchedRule.ruleCode,
              ruleStrength: 'weak',
              evidenceStatus: 'uncertain',
              reasonCodes: ['insufficient_evidence'],
            };
      case RewardEventType.INSURANCE_CONVERSION:
        return rewardEvent.insuranceFlag
          ? {
              includedFlag: true,
              inclusionCategory: 'included',
              includedReason: '存在明确保险理赔证据且事件已确认，可纳入工资试算',
              excludedReason: null,
              matchedRule: matchedRule.ruleCode,
              ruleStrength: 'strong',
              evidenceStatus: 'confirmed',
              reasonCodes: ['included_whitelist'],
            }
          : {
              includedFlag: false,
              inclusionCategory: 'pending_only',
              includedReason: null,
              excludedReason: '保险理赔证据不足，仅保留待确认',
              matchedRule: matchedRule.ruleCode,
              ruleStrength: 'weak',
              evidenceStatus: 'uncertain',
              reasonCodes: ['insufficient_evidence'],
            };
      case RewardEventType.CARD_ISSUE: {
        const cardIssueReasonCodes: PayrollReasonCode[] = ['reference_only'];
        if (this.hasUnknownMerchantAttribution(rewardEvent)) {
          cardIssueReasonCodes.push('unknown_merchant_attribution');
        }
        return {
          includedFlag: false,
          inclusionCategory: 'reference_only',
          includedReason: null,
          excludedReason: '卡发放/卡账户流水仅展示，不直接纳入工资正式结论',
          matchedRule: matchedRule.ruleCode,
          ruleStrength: 'weak',
          evidenceStatus: evidenceStatus === 'confirmed' ? 'inferred' : evidenceStatus,
          reasonCodes: cardIssueReasonCodes,
        };
      }
      case RewardEventType.PRIVATE_VEHICLE_REPURCHASE:
        return {
          includedFlag: false,
          inclusionCategory: 'pending_only',
          includedReason: null,
          excludedReason: '私家车复购规则当前仍属弱规则，仅保留待确认',
          matchedRule: matchedRule.ruleCode,
          ruleStrength: 'weak',
          evidenceStatus: evidenceStatus === 'confirmed' ? 'inferred' : evidenceStatus,
          reasonCodes: ['weak_rule'],
        };
      case RewardEventType.COMBO_SUCCESS:
        return {
          includedFlag: false,
          inclusionCategory: 'pending_only',
          includedReason: null,
          excludedReason: '组合成功规则当前仍需人工确认，仅保留待确认',
          matchedRule: matchedRule.ruleCode,
          ruleStrength: 'weak',
          evidenceStatus: evidenceStatus === 'confirmed' ? 'inferred' : evidenceStatus,
          reasonCodes: ['weak_rule'],
        };
      default:
        return {
          includedFlag: false,
          inclusionCategory: 'reference_only',
          includedReason: null,
          excludedReason: '该奖励事件当前仅展示，不直接纳入工资正式结论',
          matchedRule: matchedRule.ruleCode,
          ruleStrength,
          evidenceStatus,
          reasonCodes: ['reference_only'],
        };
    }
  }

  private applyInclusionBreakdown(
    accumulator: PayrollAccumulator,
    category: PayrollInclusionCategory,
  ) {
    if (category === 'included') {
      accumulator.normalizedPayload.inclusionBreakdown.includedCount += 1;
      return;
    }
    if (category === 'reference_only') {
      accumulator.normalizedPayload.inclusionBreakdown.referenceOnlyCount += 1;
      return;
    }
    accumulator.normalizedPayload.inclusionBreakdown.pendingOnlyCount += 1;
  }

  private resolveRewardEventRuleStrength(
    rewardEvent: RewardEvent,
  ): PayrollRuleStrength {
    if (
      rewardEvent.eventType === RewardEventType.PUBLIC_VEHICLE_COMPLETED ||
      rewardEvent.eventType === RewardEventType.INSURANCE_CONVERSION ||
      (rewardEvent.eventType === RewardEventType.A_ORDER_COMPLETED &&
        this.isAWashCardRewardEvent(rewardEvent))
    ) {
      return 'strong';
    }

    return 'weak';
  }

  private hasUnknownMerchantAttribution(rewardEvent: RewardEvent) {
    if (
      rewardEvent.merchantId !== null &&
      rewardEvent.merchantId !== undefined &&
      rewardEvent.merchantId !== 0
    ) {
      return false;
    }

    return [
      'user_shopping_card',
      'user_shopping_card_money',
      'user_shopping_card_recharge',
    ].includes(rewardEvent.sourceTable);
  }

  private resolveRewardEventEvidenceStatus(
    rewardEvent: RewardEvent,
  ): PayrollEvidenceStatus {
    if (!rewardEvent.confirmedFlag || rewardEvent.ignoredFlag) {
      return 'uncertain';
    }

    if (
      rewardEvent.eventType === RewardEventType.PUBLIC_VEHICLE_COMPLETED &&
      rewardEvent.vehicleType === 'public'
    ) {
      return 'confirmed';
    }
    if (
      rewardEvent.eventType === RewardEventType.INSURANCE_CONVERSION &&
      rewardEvent.insuranceFlag
    ) {
      return 'confirmed';
    }
    if (
      rewardEvent.eventType === RewardEventType.A_ORDER_COMPLETED &&
      this.isAWashCardRewardEvent(rewardEvent)
    ) {
      return 'confirmed';
    }

    return 'inferred';
  }

  private isAWashCardRewardEvent(rewardEvent: RewardEvent) {
    return (
      rewardEvent.sourceTable === 'goods_group_order' &&
      (this.readNestedValue(rewardEvent.normalizedPayload, [
        'metricCorrection',
        'aWashCardSale',
      ]) === true ||
        String(this.readNestedValue(rewardEvent.normalizedPayload, ['sourceMeta', 'goodsGroupId']) ?? '') ===
          '47')
    );
  }

  private readNestedValue(payload: Record<string, unknown> | null | undefined, path: string[]) {
    let current: unknown = payload ?? null;
    for (const key of path) {
      if (!current || typeof current !== 'object' || !(key in (current as Record<string, unknown>))) {
        return null;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current ?? null;
  }

  private getAccumulator(
    accumulators: Map<string, PayrollAccumulator>,
    input: { periodKey: string; summaryDomain: RewardSummaryDomain; employeeId: number | null },
  ) {
    const trialKey = this.buildTrialKey(input.periodKey, input.summaryDomain, input.employeeId);
    const existing = accumulators.get(trialKey);
    if (existing) {
      return existing;
    }

    const created: PayrollAccumulator = {
      trialKey,
      periodKey: input.periodKey,
      summaryDomain: input.summaryDomain,
      employeeId: input.employeeId,
      sourceSummaryCount: 0,
      sourceEventCount: 0,
      rewardAmountTotal: '0.00',
      rewardPointsTotal: '0.00',
      pendingCount: input.employeeId ? 0 : 1,
      ignoredCount: 0,
      calculatedTotal: '0.00',
      remarkSet: new Set(input.employeeId ? [] : ['存在未绑定员工的试算对象']),
      normalizedPayload: {
        performanceSummaryIds: [],
        businessStatSummaryIds: [],
        rewardEventIds: [],
        sourceBreakdown: {
          performanceSummaryCount: 0,
          businessStatSummaryCount: 0,
          rewardEventCount: 0,
        },
        inclusionBreakdown: {
          includedCount: 0,
          referenceOnlyCount: 0,
          pendingOnlyCount: 0,
        },
      },
      details: [],
    };
    accumulators.set(trialKey, created);
    return created;
  }

  private resolveSummaryDomainForPerformanceSummary(sourceDomain: PerformanceEventSourceDomain) {
    if (
      sourceDomain === PerformanceEventSourceDomain.ORDERS ||
      sourceDomain === PerformanceEventSourceDomain.FUNDS ||
      sourceDomain === PerformanceEventSourceDomain.CARDS
    ) {
      return RewardSummaryDomain.ABC_OVERALL;
    }

    return null;
  }

  private resolveSummaryDomainForRewardEvent(eventType: RewardEventType) {
    switch (eventType) {
      case RewardEventType.PUBLIC_VEHICLE_COMPLETED:
        return RewardSummaryDomain.PUBLIC_VEHICLE;
      case RewardEventType.PRIVATE_VEHICLE_REPURCHASE:
        return RewardSummaryDomain.PRIVATE_VEHICLE;
      case RewardEventType.INSURANCE_CONVERSION:
        return RewardSummaryDomain.INSURANCE_CLAIM;
      default:
        return RewardSummaryDomain.ABC_OVERALL;
    }
  }

  private matchRewardRule(
    rewardEvent: RewardEvent,
    summaryDomain: RewardSummaryDomain,
    rewardRules: RewardEventRule[],
  ) {
    return (
      rewardRules.find(
        (rule) =>
          rule.eventType === rewardEvent.eventType &&
          rule.businessDomain === rewardEvent.businessDomain &&
          (!rule.requiredTagCode || String(rule.requiredTagCode) === String(summaryDomain)),
      ) ?? null
    );
  }

  private buildTrialKey(
    periodKey: string,
    summaryDomain: RewardSummaryDomain,
    employeeId: number | null,
  ) {
    return `${periodKey}:${summaryDomain}:employee:${employeeId ?? 'unassigned'}`;
  }

  private async clearExistingPayrollTrials(periodKey: string) {
    const existingItems = await this.payrollTrialItemRepository.find({
      where: { periodKey },
      select: ['id'],
    });
    if (existingItems.length > 0) {
      await this.payrollTrialItemDetailRepository.delete({
        payrollTrialItemId: In(existingItems.map((item) => item.id)),
      });
    }
    await this.payrollTrialItemRepository.delete({ periodKey });
  }

  private async upsertPayrollTrialItem(
    run: PayrollTrialRun,
    accumulator: PayrollAccumulator,
    existingByKey: Map<string, PayrollTrialItem>,
  ) {
    const existing = existingByKey.get(accumulator.trialKey) ?? null;
    const normalizedPayload = {
      ...accumulator.normalizedPayload,
      remarkReasons: Array.from(accumulator.remarkSet),
    };

    let entity: PayrollTrialItem;
    let outcome: 'created' | 'updated';
    if (existing) {
      entity = existing;
      outcome = 'updated';
    } else {
      entity = this.payrollTrialItemRepository.create({
        trialKey: accumulator.trialKey,
        periodKey: accumulator.periodKey,
        summaryDomain: accumulator.summaryDomain,
        employeeId: accumulator.employeeId,
      });
      outcome = 'created';
    }

    entity.payrollTrialRunId = run.id;
    entity.employeeId = accumulator.employeeId;
    entity.sourceSummaryCount = accumulator.sourceSummaryCount;
    entity.sourceEventCount = accumulator.sourceEventCount;
    entity.rewardAmountTotal = normalizeMoney(accumulator.rewardAmountTotal);
    entity.rewardPointsTotal = normalizeQuantity(accumulator.rewardPointsTotal);
    entity.pendingCount = accumulator.pendingCount;
    entity.ignoredCount = accumulator.ignoredCount;
    entity.calculatedTotal = normalizeMoney(accumulator.calculatedTotal);
    entity.confirmedFlag = run.forceRegenerate ? false : entity.confirmedFlag ?? false;
    if (run.forceRegenerate) {
      entity.confirmedBy = null;
      entity.confirmedAt = null;
    }
    entity.remark = Array.from(accumulator.remarkSet).join('；') || null;
    entity.normalizedPayload = normalizedPayload;

    const saved = await this.payrollTrialItemRepository.save(entity);
    existingByKey.set(saved.trialKey, saved);
    await this.payrollTrialItemDetailRepository.delete({ payrollTrialItemId: saved.id });

    for (const detail of accumulator.details) {
      await this.payrollTrialItemDetailRepository.save(
        this.payrollTrialItemDetailRepository.create({
          payrollTrialItemId: saved.id,
          payrollTrialRunId: run.id,
          detailType: detail.detailType,
          sourceSystem: detail.sourceSystem,
          sourceTable: detail.sourceTable,
          sourceId: detail.sourceId,
          sourceOrderNo: detail.sourceOrderNo ?? null,
          sourceRecordId: detail.sourceRecordId ?? null,
          employeeId: detail.employeeId ?? null,
          periodKey: detail.periodKey,
          summaryDomain: detail.summaryDomain,
          amountStandard: detail.amountStandard ? normalizeMoney(detail.amountStandard) : null,
          quantityStandard: detail.quantityStandard ? normalizeQuantity(detail.quantityStandard) : null,
          rewardPoints: normalizeQuantity(detail.rewardPoints ?? '0.00'),
          rewardAmount: normalizeMoney(detail.rewardAmount ?? '0.00'),
          calculatedAmount: normalizeMoney(detail.calculatedAmount ?? '0.00'),
          pendingFlag: detail.pendingFlag ?? false,
          ignoredFlag: detail.ignoredFlag ?? false,
          includedFlag: detail.includedFlag ?? false,
          includedReason: detail.includedReason ?? null,
          excludedReason: detail.excludedReason ?? null,
          matchedRule: detail.matchedRule ?? null,
          ruleStrength: detail.ruleStrength ?? null,
          evidenceStatus: detail.evidenceStatus ?? null,
          occurredAt: detail.occurredAt,
          normalizedPayload: {
            ...detail.normalizedPayload,
            reasonCodes: detail.reasonCodes ?? [],
            primaryReasonCode: detail.reasonCodes?.[0] ?? null,
          },
        }),
      );
    }

    return outcome;
  }

  private async findPayrollTrialEntityById(id: number) {
    const item = await this.payrollTrialItemRepository.findOne({
      where: { id },
      relations: {
        employee: true,
        confirmedByUser: true,
        payrollTrialRun: true,
      },
    });
    if (!item) {
      throw new NotFoundException('工资试算记录不存在');
    }
    return item;
  }

  private readSortableValue(record: Record<string, unknown>, sortBy: string) {
    const value = record[sortBy] ?? record.updatedAt ?? record.createdAt;
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value === 'number') {
      return value;
    }
    return String(value ?? '');
  }

  private normalizeSortOrder(sortOrder: string | undefined, fallback: 'ASC' | 'DESC') {
    return sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : fallback;
  }

  private mapPayrollTrialItem(item: PayrollTrialItem, currentUser: CurrentUser) {
    const canViewAmounts = this.canViewSensitiveAmounts(currentUser);
    return {
      id: item.id,
      payrollTrialRunId: item.payrollTrialRunId,
      periodKey: item.periodKey,
      summaryDomain: item.summaryDomain,
      employeeId: item.employeeId,
      employeeName: item.employee?.name ?? null,
      sourceSummaryCount: item.sourceSummaryCount,
      sourceEventCount: item.sourceEventCount,
      rewardAmountTotal: canViewAmounts ? normalizeMoney(item.rewardAmountTotal) : null,
      rewardPointsTotal: normalizeQuantity(item.rewardPointsTotal),
      pendingCount: item.pendingCount,
      ignoredCount: item.ignoredCount,
      calculatedTotal: canViewAmounts ? normalizeMoney(item.calculatedTotal) : null,
      confirmedFlag: item.confirmedFlag,
      confirmedBy: item.confirmedBy,
      confirmedByName: item.confirmedByUser?.realName ?? item.confirmedByUser?.username ?? null,
      confirmedAt: item.confirmedAt,
      remark: item.remark,
      normalizedPayload: item.normalizedPayload,
      batchNo: item.payrollTrialRun?.batchNo ?? null,
      runStatus: item.payrollTrialRun?.runStatus ?? null,
      updatedAt: item.updatedAt,
      createdAt: item.createdAt,
    };
  }

  private mapPayrollTrialItemDetail(detail: PayrollTrialItemDetail, currentUser: CurrentUser) {
    const canViewAmounts = this.canViewSensitiveAmounts(currentUser);
    return {
      id: detail.id,
      payrollTrialItemId: detail.payrollTrialItemId,
      payrollTrialRunId: detail.payrollTrialRunId,
      detailType: detail.detailType,
      sourceSystem: detail.sourceSystem,
      sourceTable: detail.sourceTable,
      sourceId: detail.sourceId,
      sourceOrderNo: detail.sourceOrderNo,
      sourceRecordId: detail.sourceRecordId,
      employeeId: detail.employeeId,
      employeeName: detail.employee?.name ?? null,
      periodKey: detail.periodKey,
      summaryDomain: detail.summaryDomain,
      amountStandard: canViewAmounts && detail.amountStandard ? normalizeMoney(detail.amountStandard) : null,
      quantityStandard: detail.quantityStandard ? normalizeQuantity(detail.quantityStandard) : null,
      rewardPoints: normalizeQuantity(detail.rewardPoints),
      rewardAmount: canViewAmounts ? normalizeMoney(detail.rewardAmount) : null,
      calculatedAmount: canViewAmounts ? normalizeMoney(detail.calculatedAmount) : null,
      pendingFlag: detail.pendingFlag,
      ignoredFlag: detail.ignoredFlag,
      includedFlag: detail.includedFlag,
      includedReason: detail.includedReason,
      excludedReason: detail.excludedReason,
      matchedRule: detail.matchedRule,
      ruleStrength: detail.ruleStrength,
      evidenceStatus: detail.evidenceStatus,
      reasonCodes: Array.isArray(detail.normalizedPayload?.reasonCodes)
        ? (detail.normalizedPayload.reasonCodes as string[])
        : [],
      occurredAt: detail.occurredAt,
      normalizedPayload: detail.normalizedPayload,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    };
  }

  private canViewSensitiveAmounts(currentUser: CurrentUser) {
    return currentUser.roleCodes.includes('admin') || currentUser.roleCodes.includes('finance');
  }

  private multiplyMoneyByFactor(amount: string | number, factor: string | number) {
    const amountScaled = this.toScaledDecimal(amount);
    const factorScaled = this.toScaledDecimal(factor);
    return this.formatScaledDecimal((amountScaled * factorScaled) / 100n);
  }

  private toScaledDecimal(value: string | number) {
    const normalized =
      typeof value === 'number' ? value.toFixed(2) : String(value ?? '0').trim() || '0';
    const [wholePart, decimalPart = ''] = normalized.split('.');
    return BigInt(wholePart) * 100n + BigInt((decimalPart + '00').slice(0, 2));
  }

  private formatScaledDecimal(value: bigint) {
    const isNegative = value < 0n;
    const normalized = isNegative ? -value : value;
    const wholePart = normalized / 100n;
    const decimalPart = String(normalized % 100n).padStart(2, '0');
    return `${isNegative ? '-' : ''}${wholePart}.${decimalPart}`;
  }
}
