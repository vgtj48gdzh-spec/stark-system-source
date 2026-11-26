import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createPool, Pool } from 'mysql2/promise';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { canViewFullContact, maskPhoneNumber } from '../../common/utils/contact-permission.util';
import { buildPaginationResult, getPagination, paginateArray } from '../../common/utils/pagination.util';
import { addMoney, addQuantity, normalizeMoney, normalizeQuantity } from '../../common/utils/decimal.util';
import {
  collectVerificationObjectSources,
  compareVerificationDateDistance,
  looksLikeProjectOrPackageName,
  normalizeVerificationAmount,
  normalizeVerificationDateKey,
  normalizeVerificationPeriodKey,
  normalizeVerificationPlate,
  normalizeVerificationProjectCode,
  normalizeVerificationText,
} from '../../common/utils/customer-verification.util';
import { normalizeMainlandMobile } from '../../common/utils/mobile.util';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { AbcRawCard } from '../abc-raw/entities/abc-raw-card.entity';
import { AbcRawOrder } from '../abc-raw/entities/abc-raw-order.entity';
import { AbcRawTransaction } from '../abc-raw/entities/abc-raw-transaction.entity';
import { AbcSyncCard } from '../abc-sync/entities/abc-sync-card.entity';
import { AbcSyncFund } from '../abc-sync/entities/abc-sync-fund.entity';
import { AbcSyncOrder } from '../abc-sync/entities/abc-sync-order.entity';
import { EmployeeBenefitCardRecord } from '../employee-benefits/entities/employee-benefit-card-record.entity';
import { EmployeeBenefitIssueItem } from '../employee-benefits/entities/employee-benefit-issue-item.entity';
import { EmployeeBenefitIssue } from '../employee-benefits/entities/employee-benefit-issue.entity';
import { EmployeeBenefitNotification } from '../employee-benefits/entities/employee-benefit-notification.entity';
import { CustomerIdentificationBinding } from '../performance/entities/customer-identification-binding.entity';
import { EmployeeSourceBinding } from '../performance/entities/employee-source-binding.entity';
import { Employee } from '../performance/entities/employee.entity';
import { ExternalCardSalesStaging } from '../performance/entities/external-card-sales-staging.entity';
import { PayrollTrialItemDetail } from '../payroll-trials/entities/payroll-trial-item-detail.entity';
import { PaymentRecord } from '../payment-records/entities/payment-record.entity';
import { PayoutRecord } from '../payout-records/entities/payout-record.entity';
import { User } from '../users/entities/user.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { isWorkOrderUnquoted } from '../work-orders/work-order-intake.policy';
import { BusinessStatSummary } from './entities/business-stat-summary.entity';
import { BusinessStatTag } from './entities/business-stat-tag.entity';
import { RewardEvent } from './entities/reward-event.entity';
import { RewardEventRule } from './entities/reward-event-rule.entity';
import { BusinessStatTagCode } from '../../shared/enums/business-stat-tag-code.enum';
import { BusinessStatDomain } from '../../shared/enums/business-stat-domain.enum';
import { RewardEventType } from '../../shared/enums/reward-event-type.enum';
import { RewardSummaryDomain } from '../../shared/enums/reward-summary-domain.enum';
import { PerformanceHandlingAction } from '../../shared/enums/performance-handling-action.enum';
import { PayrollTrialDetailType } from '../../shared/enums/payroll-trial-detail-type.enum';
import { WorkOrderStatus } from '../../shared/enums/work-order-status.enum';
import { ConfirmBusinessStatSummaryDto } from './dto/confirm-business-stat-summary.dto';
import { ConfirmRewardEventDto } from './dto/confirm-reward-event.dto';
import { CreateRewardEventRuleDto } from './dto/create-reward-event-rule.dto';
import { GenerateBusinessStatSummariesDto } from './dto/generate-business-stat-summaries.dto';
import { GenerateRewardEventsDto } from './dto/generate-reward-events.dto';
import { GenerateStatTagsDto } from './dto/generate-stat-tags.dto';
import { IgnoreRewardEventDto } from './dto/ignore-reward-event.dto';
import { QueryBusinessStatSummariesDto } from './dto/query-business-stat-summaries.dto';
import { QueryBusinessStatSummaryDetailDto } from './dto/query-business-stat-summary-detail.dto';
import { QueryRewardEventRulesDto } from './dto/query-reward-event-rules.dto';
import { QueryRewardEventsDto } from './dto/query-reward-events.dto';
import { QueryStatPendingItemsDto } from './dto/query-stat-pending-items.dto';
import { QueryStatTagsDto } from './dto/query-stat-tags.dto';
import { ReassignRewardEventDto } from './dto/reassign-reward-event.dto';
import { ToggleRewardEventRuleDto } from './dto/toggle-reward-event-rule.dto';
import { UpdateRewardEventRuleDto } from './dto/update-reward-event-rule.dto';
import { UpdateStatTagDto } from './dto/update-stat-tag.dto';

interface BindingCandidate {
  sourceSystem: string;
  sourceTable: string;
  sourceId: string | null | undefined;
  bindingType: string;
}

interface BindingContext {
  bindings: Map<string, EmployeeSourceBinding>;
  employeeByLinkedUserId: Map<number, Employee>;
  employeeByMobile: Map<string, Employee>;
}

interface TagCandidateInput {
  tagCode: BusinessStatTagCode;
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  sourceOrderNo?: string | null;
  businessDomain: BusinessStatDomain;
  merchantId?: number | null;
  storeId?: number | null;
  responsibleEmployeeId?: number | null;
  customerId?: string | null;
  vehicleType?: string | null;
  insuranceFlag?: boolean;
  occurredAt: Date;
  periodKey: string;
  confirmedFlag?: boolean;
  remark?: string | null;
  normalizedPayload: Record<string, unknown>;
}

interface RewardEventCandidateInput {
  eventType: RewardEventType;
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  sourceOrderNo?: string | null;
  businessDomain: BusinessStatDomain;
  merchantId?: number | null;
  storeId?: number | null;
  responsibleEmployeeId?: number | null;
  customerId?: string | null;
  vehicleType?: string | null;
  insuranceFlag?: boolean;
  amountStandard?: string | null;
  quantityStandard?: string | null;
  occurredAt: Date;
  periodKey: string;
  confirmedFlag?: boolean;
  ignoredFlag?: boolean;
  remark?: string | null;
  normalizedPayload: Record<string, unknown>;
}

interface SummaryAccumulator {
  summaryDomain: RewardSummaryDomain;
  periodKey: string;
  merchantId: number | null;
  storeId: number | null;
  responsibleEmployeeId: number | null;
  customerId: string | null;
  tagCount: number;
  rewardEventCount: number;
  confirmedRewardEventCount: number;
  pendingRewardEventCount: number;
  amountTotal: string;
  quantityTotal: string;
  normalizedPayload: {
    tagIds: number[];
    rewardEventIds: number[];
    sourceTables: string[];
  };
}

interface VerificationSourceRecord {
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  sourceOrderNo?: string | null;
  customerId?: string | null;
  occurredAt: Date;
  amountStandard?: string | null;
  normalizedPayload?: Record<string, unknown> | null;
}

export interface VerificationSourceContext {
  sourceTable: string;
  sourceId: string;
  sourceOrderNo: string | null;
  customerId: string | null;
  sourceCustomerName: string | null;
  sourceCustomerMobile: string | null;
  sourceCarPlate: string | null;
  sourceCustomerNameAlias: string | null;
  customerName: string | null;
  customerMobile: string | null;
  carPlate: string | null;
  matchedCustomerId: string | null;
  matchedCustomerName: string | null;
  matchedCustomerMobile: string | null;
  matchedOrderId: string | null;
  matchedOrderNo: string | null;
  matchedSourceTable: string | null;
  matchConfidence: string | null;
  matchReason: string | null;
  evidenceSummary: string | null;
  purchaseTime: string | null;
  packageName: string | null;
  merchantName: string | null;
  merchantContact: string | null;
  goodsGroupId: string | null;
  totalPriceRaw: string | null;
  externalCardSalesPackageName: string | null;
  externalCardSalesAmount: string | null;
  pointDeductionRaw: string | null;
  cardIssuedAmountRaw: string | null;
  cardBalanceAmountRaw: string | null;
  cardLedgerType: string | null;
  paymentStatus: SourcePaymentStatus;
  isPaid: boolean;
  settlementType: SourceSettlementType;
  isTestData: boolean;
  sourceClassification: SourceClassification;
  reconciliationStatus: SourceReconciliationStatus;
  reconciliationReason: string | null;
  anomalyClassification: string | null;
  anomalyReason: string | null;
}

interface CustomerIdentificationBindingContext {
  sourceCustomerName: string | null;
  sourceCustomerMobile: string | null;
  sourceCarPlate: string | null;
  matchedCustomerId: string | null;
  matchedCustomerName: string | null;
  matchedCustomerMobile: string | null;
  bindingStatus: 'auto_matched' | 'manual_pending' | 'manually_bound' | 'conflict';
  bindingConfidence: string | null;
  boundBy: number | null;
  boundAt: Date | null;
  bindingRemark: string | null;
  performanceReadyFlag: boolean;
  performanceBlockReason:
    | 'missing_customer_mobile'
    | 'missing_customer_binding'
    | 'ambiguous_customer_match'
    | 'missing_employee_binding'
    | 'awaiting_manual_review'
    | 'other'
    | null;
  performanceDecisionReason: string | null;
  taskExecutionCount: number | null;
  taskOnTimeCount: number | null;
  taskConfirmedCount: number | null;
  taskRewardEligibleFlag: boolean | null;
  aiTaskScore: string | null;
  aiTaskRemark: string | null;
}

export interface SummaryVerificationContext {
  customerName: string | null;
  customerMobile: string | null;
  carPlate: string | null;
  sourceCustomerMobile: string | null;
  sourceCustomerNameAlias: string | null;
  matchedCustomerId: string | null;
  matchedCustomerName: string | null;
  matchedCustomerMobile: string | null;
  matchedOrderId: string | null;
  matchedOrderNo: string | null;
  matchedSourceTable: string | null;
  matchConfidence: string | null;
  matchReason: string | null;
  evidenceSummary: string | null;
  purchaseTime: string | null;
  sourceOrderNo: string | null;
  packageName: string | null;
  merchantName: string | null;
  merchantContact: string | null;
  sourceTable: string | null;
  sourceId: string | null;
  bCardIssuedAmount: string;
  bCardConsumedAmount: string;
  bCardRemainingAmount: string;
  bCardIssueCount: number;
  bCardConsumeCount: number;
  bCardSourceType: SummaryBCardStats['sourceType'];
  bCardSourceReason: string | null;
  bundleEvidenceStrong: boolean;
  missingCItemSuspected: boolean;
  bundleInferenceReason: string | null;
  linkedBCardAmount: string | null;
  linkedBCardSourceType: SummaryBCardStats['sourceType'];
  linkedPaidAAmount: string | null;
  linkedBundleWindowDays: number | null;
  businessCategory: string | null;
  businessCategoryReason: string | null;
  welfareSourceType: 'formal_employee_benefit' | 'legacy_welfare_candidate' | null;
  benefitIssueNo: string | null;
  benefitPeriodKey: string | null;
  benefitIssueType: string | null;
  benefitIssueStatus: string | null;
  benefitAmount: string | null;
  benefitValidityDays: number | null;
  benefitConfirmedFlag: boolean | null;
  benefitIssuedFlag: boolean | null;
  benefitNotifiedFlag: boolean | null;
  payrollDecision: 'included_whitelist' | 'pending_confirmation' | 'reference_only' | null;
  payrollBlockReason: string | null;
  payrollDecisionReason: string | null;
  paymentStatus: SourcePaymentStatus | null;
  isPaid: boolean | null;
  settlementType: SourceSettlementType | null;
  isTestData: boolean | null;
  sourceClassification: SourceClassification | null;
  reconciliationStatus: SourceReconciliationStatus | null;
  reconciliationReason: string | null;
  anomalyClassification: string | null;
  anomalyReason: string | null;
}

interface SummaryBenefitContext {
  issueNo: string;
  periodKey: string;
  issueType: string;
  issueStatus: string;
  totalAmount: string;
  validityDays: number | null;
  confirmedFlag: boolean;
  issuedFlag: boolean;
  notifiedFlag: boolean;
}

interface SummaryPayrollDecisionContext {
  // Business-stats summary only mirrors the stable payroll-trial outcome.
  // It must not become a second payroll rule engine.
  decision: 'included_whitelist' | 'pending_confirmation' | 'reference_only';
  blockReason: string | null;
  decisionReason: string | null;
}

interface SummaryBusinessCategory {
  category:
    | 'a_sales'
    | 'a_plus_c_linked_sale'
    | 'b_shopping_card'
    | 'employee_welfare_card'
    | 'c_points_redemption'
    | 'special_business_case'
    | 'needs_review'
    | null;
  reason: string | null;
}

interface SummaryBCardStats {
  issuedAmount: string;
  consumedAmount: string;
  remainingAmount: string;
  issueCount: number;
  consumeCount: number;
  sourceType:
    | 'issued_by_ac_bundle'
    | 'issued_by_points_redemption'
    | 'issued_by_employee_welfare'
    | 'issued_by_manual_activity'
    | 'issued_by_test'
    | 'issued_by_other'
    | null;
  sourceReason: string | null;
}

interface SummaryBundleEvidence {
  bundleEvidenceStrong: boolean;
  missingCItemSuspected: boolean;
  bundleInferenceReason: string | null;
  linkedBCardAmount: string | null;
  linkedBCardSourceType: SummaryBCardStats['sourceType'];
  linkedPaidAAmount: string | null;
  linkedBundleWindowDays: number | null;
}

type SourcePaymentStatus = 'paid_cash' | 'paid_points' | 'unpaid' | 'test_data' | 'internal_admin' | 'unknown';
type SourceSettlementType = 'cash' | 'points' | 'none' | 'unknown';
type SourceClassification =
  | 'a_card_sale'
  | 'points_redemption'
  | 'manual_activity'
  | 'test_data'
  | 'internal_admin'
  | 'other';
type SourceReconciliationStatus =
  | 'matched_sheet'
  | 'sheet_missing'
  | 'bank_verified'
  | 'manual_verified'
  | 'needs_review';

interface SourcePaymentClassification {
  paymentStatus: SourcePaymentStatus;
  isPaid: boolean;
  settlementType: SourceSettlementType;
  isTestData: boolean;
  sourceClassification: SourceClassification;
  reconciliationStatus: SourceReconciliationStatus;
  reconciliationReason: string | null;
}

interface AbcSourceCustomerProfile {
  customerName: string | null;
  customerMobile: string | null;
  carPlate: string | null;
}

export interface PendingItemView {
  itemType: 'tag' | 'reward';
  id: number;
  occurredAt: Date;
  updatedAt: Date;
  createdAt: Date;
  payload: unknown;
}

interface AbcSourceGoodsGroupOrderProfile {
  userId: string | null;
  purchaseTime: string | null;
  sourceOrderNo: string | null;
}

interface AbcSourceUserShoppingCardProfile {
  userId: string | null;
  purchaseTime: string | null;
}

interface ExternalCardSalesStagingContext {
  sourceFileName: string;
  sourceSheetName: string | null;
  sourceRowNo: number;
  saleDate: string | null;
  periodKey: string | null;
  sourceCustomerMobile: string | null;
  sourceCustomerNameAlias: string | null;
  sourceCarPlate: string | null;
  packageOrProjectName: string | null;
  amount: string | null;
  normalizedProjectCode: string | null;
  matchedCustomerId: string | null;
  matchedCustomerName: string | null;
  matchedCustomerMobile: string | null;
  matchedOrderId: string | null;
  matchedOrderNo: string | null;
  matchedSourceTable: string | null;
  matchConfidence: string | null;
  matchReason: string | null;
  evidenceSummary: string | null;
}

type VerificationContextViewMode = 'list' | 'detail';

const TAG_SORT_COLUMNS: Record<string, string> = {
  tagCode: 'tag.tagCode',
  sourceTable: 'tag.sourceTable',
  periodKey: 'tag.periodKey',
  merchantId: 'tag.merchantId',
  occurredAt: 'tag.occurredAt',
  updatedAt: 'tag.updatedAt',
  createdAt: 'tag.createdAt',
};

const EVENT_SORT_COLUMNS: Record<string, string> = {
  eventType: 'event.eventType',
  sourceTable: 'event.sourceTable',
  periodKey: 'event.periodKey',
  amountStandard: 'event.amountStandard',
  quantityStandard: 'event.quantityStandard',
  confirmedFlag: 'event.confirmedFlag',
  ignoredFlag: 'event.ignoredFlag',
  occurredAt: 'event.occurredAt',
  updatedAt: 'event.updatedAt',
  createdAt: 'event.createdAt',
};

const RULE_SORT_COLUMNS: Record<string, string> = {
  eventType: 'rule.eventType',
  businessDomain: 'rule.businessDomain',
  isActive: 'rule.isActive',
  updatedAt: 'rule.updatedAt',
  createdAt: 'rule.createdAt',
};

const SUMMARY_SORT_COLUMNS: Record<string, string> = {
  summaryDomain: 'summary.summaryDomain',
  periodKey: 'summary.periodKey',
  rewardEventCount: 'summary.rewardEventCount',
  confirmedRewardEventCount: 'summary.confirmedRewardEventCount',
  pendingRewardEventCount: 'summary.pendingRewardEventCount',
  amountTotal: 'summary.amountTotal',
  quantityTotal: 'summary.quantityTotal',
  updatedAt: 'summary.updatedAt',
  createdAt: 'summary.createdAt',
};

const DEFAULT_TAG_SOURCE_TABLES = ['work_orders', 'abc_sync_orders', 'abc_sync_funds', 'abc_sync_cards'];
const DEFAULT_REWARD_SOURCE_TABLES = ['work_orders', 'abc_sync_orders', 'abc_sync_cards'];
const INSURANCE_KEYWORDS = ['保险', '理赔', '出险', '保险理赔', '保险出单'];
const PUBLIC_VEHICLE_KEYWORDS = ['公车', '公务', '单位车', '公牌', '车队'];
const COMBO_KEYWORDS = ['A+C', 'AC组合', 'combo', '组合'];

const PRIVATE_VEHICLE_KEYWORDS = [
  '\u79c1\u5bb6\u8f66',
  '\u5bb6\u7528\u8f66',
  '\u4e2a\u4eba\u8f66',
  '\u5bb6\u7528',
];
const A_WASH_CARD_GROUP_IDS = ['47'];
const A_WASH_CARD_CLASSIFICATION_PENDING_REASON =
  '\u0041\u7aef\u6d17\u8f66\u5361\u8ba2\u5355\u8f66\u8f86\u7c7b\u578b\u8bc1\u636e\u4e0d\u8db3\uff0c\u6682\u4e0d\u5f3a\u884c\u5f52\u5165\u79c1\u5bb6\u8f66/\u516c\u8f66/\u4fdd\u9669\u7406\u8d54';
const UNKNOWN_CARD_MERCHANT_REASON =
  '\u5361\u8d26\u6237\u6765\u6e90\u7f3a\u5c11\u53ef\u786e\u8ba4\u5546\u6237\u5f52\u5c5e\uff0c\u6682\u4fdd\u7559\u5f85\u786e\u8ba4';
@Injectable()
export class BusinessStatsService {
  private abcSourceReadonlyPool?: Pool | null;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(CustomerIdentificationBinding)
    private readonly customerIdentificationBindingRepository: Repository<CustomerIdentificationBinding>,
    @InjectRepository(ExternalCardSalesStaging)
    private readonly externalCardSalesStagingRepository: Repository<ExternalCardSalesStaging>,
    @InjectRepository(EmployeeSourceBinding)
    private readonly employeeSourceBindingRepository: Repository<EmployeeSourceBinding>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(WorkOrderMaterial)
    private readonly workOrderMaterialRepository: Repository<WorkOrderMaterial>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepository: Repository<PaymentRecord>,
    @InjectRepository(PayoutRecord)
    private readonly payoutRecordRepository: Repository<PayoutRecord>,
    @InjectRepository(AbcRawOrder)
    private readonly abcRawOrderRepository: Repository<AbcRawOrder>,
    @InjectRepository(AbcRawCard)
    private readonly abcRawCardRepository: Repository<AbcRawCard>,
    @InjectRepository(AbcRawTransaction)
    private readonly abcRawTransactionRepository: Repository<AbcRawTransaction>,
    @InjectRepository(AbcSyncOrder)
    private readonly abcSyncOrderRepository: Repository<AbcSyncOrder>,
    @InjectRepository(AbcSyncFund)
    private readonly abcSyncFundRepository: Repository<AbcSyncFund>,
    @InjectRepository(AbcSyncCard)
    private readonly abcSyncCardRepository: Repository<AbcSyncCard>,
    @InjectRepository(EmployeeBenefitIssue)
    private readonly employeeBenefitIssueRepository: Repository<EmployeeBenefitIssue>,
    @InjectRepository(EmployeeBenefitIssueItem)
    private readonly employeeBenefitIssueItemRepository: Repository<EmployeeBenefitIssueItem>,
    @InjectRepository(EmployeeBenefitCardRecord)
    private readonly employeeBenefitCardRecordRepository: Repository<EmployeeBenefitCardRecord>,
    @InjectRepository(EmployeeBenefitNotification)
    private readonly employeeBenefitNotificationRepository: Repository<EmployeeBenefitNotification>,
    @InjectRepository(PayrollTrialItemDetail)
    private readonly payrollTrialItemDetailRepository: Repository<PayrollTrialItemDetail>,
    @InjectRepository(BusinessStatTag)
    private readonly businessStatTagRepository: Repository<BusinessStatTag>,
    @InjectRepository(RewardEvent)
    private readonly rewardEventRepository: Repository<RewardEvent>,
    @InjectRepository(RewardEventRule)
    private readonly rewardEventRuleRepository: Repository<RewardEventRule>,
    @InjectRepository(BusinessStatSummary)
    private readonly businessStatSummaryRepository: Repository<BusinessStatSummary>,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async generateStatTags(dto: GenerateStatTagsDto, currentUser: CurrentUser) {
    const bindingContext = await this.loadBindingContext();
    const sourceTables = this.resolveStatTagSourceTables(dto);
    const candidates: TagCandidateInput[] = [];
    const results = {
      sourceTables,
      createdRecords: 0,
      updatedRecords: 0,
      processedRecords: 0,
      forceRegenerate: dto.forceRegenerate ?? false,
    };

    if (sourceTables.includes('work_orders')) {
      candidates.push(...(await this.buildStarkWorkOrderTags(dto, bindingContext)));
    }

    if (sourceTables.includes('abc_sync_orders')) {
      candidates.push(...(await this.buildAbcOrderTags(dto, bindingContext)));
    }

    if (sourceTables.includes('abc_sync_funds')) {
      candidates.push(...(await this.buildAbcFundTags(dto, bindingContext)));
    }

    if (sourceTables.includes('abc_sync_cards')) {
      candidates.push(...(await this.buildAbcCardTags(dto, bindingContext)));
    }

    if (dto.forceRegenerate) {
      await this.clearExistingStatTagsByScope(dto, sourceTables);
    }

    for (const candidate of candidates) {
      const outcome = await this.upsertBusinessStatTag(candidate);
      results.processedRecords += 1;
      if (outcome === 'created') results.createdRecords += 1;
      else results.updatedRecords += 1;
    }

    await this.operationLogsService.create({
      module: 'business_stats',
      targetId: 0,
      action: 'generate_stat_tags',
      operatorId: currentUser.id,
      detail: `生成统计标签 ${results.processedRecords} 条`,
      detailJson: results,
    });

    return results;
  }

  async findStatTags(query: QueryStatTagsDto, currentUser: CurrentUser) {
    const { skip, take } = getPagination(query);
    const qb = this.businessStatTagRepository
      .createQueryBuilder('tag')
      .leftJoinAndSelect('tag.responsibleEmployee', 'employee');

    if (query.tagCode) qb.andWhere('tag.tagCode = :tagCode', { tagCode: query.tagCode });
    if (query.sourceTable) {
      qb.andWhere('tag.sourceTable = :sourceTable', { sourceTable: query.sourceTable });
    }
    if (query.periodKey) qb.andWhere('tag.periodKey = :periodKey', { periodKey: query.periodKey });
    if (query.confirmedFlag !== undefined) {
      qb.andWhere('tag.confirmedFlag = :confirmedFlag', { confirmedFlag: query.confirmedFlag });
    }
    if (query.customerId) qb.andWhere('tag.customerId = :customerId', { customerId: query.customerId });
    if (query.merchantId !== undefined) {
      qb.andWhere('tag.merchantId = :merchantId', { merchantId: query.merchantId });
    }
    if (query.responsibleEmployeeId !== undefined) {
      qb.andWhere('tag.responsibleEmployeeId = :responsibleEmployeeId', {
        responsibleEmployeeId: query.responsibleEmployeeId,
      });
    }
    if (query.dateFrom) {
      qb.andWhere('tag.occurredAt >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('tag.occurredAt <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        TAG_SORT_COLUMNS[query.sortBy ?? 'occurredAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    const recordVerificationContextMap = await this.buildRecordVerificationContextMap(
      list,
      currentUser,
      'list',
    );
    const customerBindingContextMap = await this.buildCustomerIdentificationBindingContextMap(
      list,
      recordVerificationContextMap,
    );

    return buildPaginationResult(
      query,
      list.map((item) =>
        this.mapStatTag(
          item,
          recordVerificationContextMap.get(this.buildSourceRecordKey(item.sourceTable, item.sourceId)) ??
            null,
          customerBindingContextMap.get(this.buildSourceRecordKey(item.sourceTable, item.sourceId)) ??
            null,
          currentUser,
          'list',
        ),
      ),
      total,
    );
  }

  async findStatTagById(id: number, currentUser: CurrentUser) {
    const record = await this.businessStatTagRepository.findOne({
      where: { id },
      relations: { responsibleEmployee: true },
    });

    if (!record) {
      throw new NotFoundException('统计标签不存在');
    }

    const recordVerificationContextMap = await this.buildRecordVerificationContextMap(
      [record],
      currentUser,
      'detail',
    );
    const customerBindingContextMap = await this.buildCustomerIdentificationBindingContextMap(
      [record],
      recordVerificationContextMap,
    );

    return this.mapStatTag(
      record,
      recordVerificationContextMap.get(this.buildSourceRecordKey(record.sourceTable, record.sourceId)) ??
        null,
      customerBindingContextMap.get(this.buildSourceRecordKey(record.sourceTable, record.sourceId)) ?? null,
      currentUser,
      'detail',
    );
  }

  async updateStatTag(id: number, dto: UpdateStatTagDto, currentUser: CurrentUser) {
    const record = await this.businessStatTagRepository.findOne({
      where: { id },
      relations: { responsibleEmployee: true },
    });

    if (!record) {
      throw new NotFoundException('统计标签不存在');
    }

    const before = await this.findStatTagById(record.id, currentUser);

    if (dto.responsibleEmployeeId !== undefined && dto.responsibleEmployeeId !== null) {
      await this.ensureEmployeeExists(dto.responsibleEmployeeId);
      record.responsibleEmployeeId = dto.responsibleEmployeeId;
    }
    if (dto.responsibleEmployeeId === null) record.responsibleEmployeeId = null;
    if (dto.confirmedFlag !== undefined) record.confirmedFlag = dto.confirmedFlag;
    if (dto.merchantId !== undefined) record.merchantId = dto.merchantId;
    if (dto.storeId !== undefined) record.storeId = dto.storeId;
    if (dto.customerId !== undefined) record.customerId = dto.customerId?.trim() || null;
    if (dto.vehicleType !== undefined) record.vehicleType = dto.vehicleType?.trim() || null;
    if (dto.insuranceFlag !== undefined) record.insuranceFlag = dto.insuranceFlag;
    if (dto.remark !== undefined) record.remark = dto.remark?.trim() || null;

    const saved = await this.businessStatTagRepository.save(record);

    await this.operationLogsService.create({
      module: 'business_stat_tag',
      targetId: saved.id,
      action: 'update_stat_tag',
      operatorId: currentUser.id,
      detail: `更新统计标签 ${saved.tagCode}`,
      detailJson: {
        before,
        after: await this.findStatTagById(saved.id, currentUser),
      },
    });

    return this.findStatTagById(saved.id, currentUser);
  }

  async generateRewardEvents(dto: GenerateRewardEventsDto, currentUser: CurrentUser) {
    const bindingContext = await this.loadBindingContext();
    const sourceTables = this.resolveRewardSourceTables(dto);
    const tagMap = await this.loadTagCodeMap(dto.periodKey);
    const rules = await this.rewardEventRuleRepository.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
    const candidates: RewardEventCandidateInput[] = [];
    const results = {
      sourceTables,
      createdRecords: 0,
      updatedRecords: 0,
      processedRecords: 0,
      forceRegenerate: dto.forceRegenerate ?? false,
    };

    if (sourceTables.includes('work_orders')) {
      candidates.push(...(await this.buildStarkRewardEvents(dto, bindingContext, tagMap, rules)));
    }

    if (sourceTables.includes('abc_sync_orders')) {
      candidates.push(...(await this.buildAbcOrderRewardEvents(dto, bindingContext, tagMap, rules)));
    }

    if (sourceTables.includes('abc_sync_cards')) {
      candidates.push(...(await this.buildAbcCardRewardEvents(dto, bindingContext, rules)));
    }

    candidates.push(...(await this.buildPrivateVehicleRepurchaseEvents(dto.periodKey, rules)));

    if (dto.forceRegenerate) {
      await this.clearExistingRewardEventsByScope(dto, sourceTables);
    }

    for (const candidate of candidates) {
      const outcome = await this.upsertRewardEvent(candidate);
      results.processedRecords += 1;
      if (outcome === 'created') results.createdRecords += 1;
      else results.updatedRecords += 1;
    }

    await this.operationLogsService.create({
      module: 'reward_event',
      targetId: 0,
      action: 'generate_reward_events',
      operatorId: currentUser.id,
      detail: `生成奖励事件 ${results.processedRecords} 条`,
      detailJson: results,
    });

    return results;
  }

  async findRewardEvents(query: QueryRewardEventsDto, currentUser: CurrentUser) {
    const { skip, take } = getPagination(query);
    const qb = this.rewardEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.responsibleEmployee', 'employee')
      .leftJoinAndSelect('event.handledByUser', 'handledByUser');

    if (query.eventType) qb.andWhere('event.eventType = :eventType', { eventType: query.eventType });
    if (query.sourceTable) {
      qb.andWhere('event.sourceTable = :sourceTable', { sourceTable: query.sourceTable });
    }
    if (query.periodKey) qb.andWhere('event.periodKey = :periodKey', { periodKey: query.periodKey });
    if (query.confirmedFlag !== undefined) {
      qb.andWhere('event.confirmedFlag = :confirmedFlag', { confirmedFlag: query.confirmedFlag });
    }
    if (query.ignoredFlag !== undefined) {
      qb.andWhere('event.ignoredFlag = :ignoredFlag', { ignoredFlag: query.ignoredFlag });
    }
    if (query.merchantId !== undefined) {
      qb.andWhere('event.merchantId = :merchantId', { merchantId: query.merchantId });
    }
    if (query.responsibleEmployeeId !== undefined) {
      qb.andWhere('event.responsibleEmployeeId = :responsibleEmployeeId', {
        responsibleEmployeeId: query.responsibleEmployeeId,
      });
    }
    if (query.dateFrom) {
      qb.andWhere('event.occurredAt >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('event.occurredAt <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        EVENT_SORT_COLUMNS[query.sortBy ?? 'occurredAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .addOrderBy('event.id', this.normalizeSortOrder(query.sortOrder, 'DESC'))
      .skip(skip)
      .take(take)
      .getMany();

    const recordVerificationContextMap = await this.buildRecordVerificationContextMap(
      list,
      currentUser,
      'list',
    );
    const customerBindingContextMap = await this.buildCustomerIdentificationBindingContextMap(
      list,
      recordVerificationContextMap,
    );

    return buildPaginationResult(
      query,
      list.map((item) =>
        this.mapRewardEvent(
          item,
          currentUser,
          recordVerificationContextMap.get(this.buildSourceRecordKey(item.sourceTable, item.sourceId)) ??
            null,
          customerBindingContextMap.get(this.buildSourceRecordKey(item.sourceTable, item.sourceId)) ??
            null,
          'list',
        ),
      ),
      total,
    );
  }

  async findRewardEventById(id: number, currentUser: CurrentUser) {
    const record = await this.rewardEventRepository.findOne({
      where: { id },
      relations: {
        responsibleEmployee: true,
        handledByUser: true,
      },
    });

    if (!record) {
      throw new NotFoundException('奖励事件不存在');
    }

    const recordVerificationContextMap = await this.buildRecordVerificationContextMap(
      [record],
      currentUser,
      'detail',
    );
    const customerBindingContextMap = await this.buildCustomerIdentificationBindingContextMap(
      [record],
      recordVerificationContextMap,
    );
    return this.mapRewardEvent(
      record,
      currentUser,
      recordVerificationContextMap.get(this.buildSourceRecordKey(record.sourceTable, record.sourceId)) ??
        null,
      customerBindingContextMap.get(this.buildSourceRecordKey(record.sourceTable, record.sourceId)) ?? null,
      'detail',
    );
  }

  async confirmRewardEvent(id: number, dto: ConfirmRewardEventDto, currentUser: CurrentUser) {
    const record = await this.findRewardEventEntity(id);
    const before = await this.findRewardEventById(record.id, currentUser);
    record.confirmedFlag = true;
    record.ignoredFlag = false;
    record.handledBy = currentUser.id;
    record.handledAt = new Date();
    record.handlingAction = PerformanceHandlingAction.CONFIRM;
    if (dto.remark !== undefined) record.remark = dto.remark?.trim() || null;
    const saved = await this.rewardEventRepository.save(record);

    await this.operationLogsService.create({
      module: 'reward_event',
      targetId: saved.id,
      action: 'confirm_reward_event',
      operatorId: currentUser.id,
      detail: `确认奖励事件 ${saved.eventType}`,
      detailJson: {
        before,
        after: await this.findRewardEventById(saved.id, currentUser),
      },
    });

    return this.findRewardEventById(saved.id, currentUser);
  }

  async ignoreRewardEvent(id: number, dto: IgnoreRewardEventDto, currentUser: CurrentUser) {
    const record = await this.findRewardEventEntity(id);
    const before = await this.findRewardEventById(record.id, currentUser);
    record.confirmedFlag = false;
    record.ignoredFlag = true;
    record.handledBy = currentUser.id;
    record.handledAt = new Date();
    record.handlingAction = PerformanceHandlingAction.IGNORE;
    if (dto.remark !== undefined) record.remark = dto.remark?.trim() || null;
    const saved = await this.rewardEventRepository.save(record);

    await this.operationLogsService.create({
      module: 'reward_event',
      targetId: saved.id,
      action: 'ignore_reward_event',
      operatorId: currentUser.id,
      detail: `忽略奖励事件 ${saved.eventType}`,
      detailJson: {
        before,
        after: await this.findRewardEventById(saved.id, currentUser),
      },
    });

    return this.findRewardEventById(saved.id, currentUser);
  }

  async reassignRewardEvent(id: number, dto: ReassignRewardEventDto, currentUser: CurrentUser) {
    const record = await this.findRewardEventEntity(id);
    await this.ensureEmployeeExists(dto.responsibleEmployeeId);
    const before = await this.findRewardEventById(record.id, currentUser);
    record.responsibleEmployeeId = dto.responsibleEmployeeId;
    record.confirmedFlag = true;
    record.ignoredFlag = false;
    record.handledBy = currentUser.id;
    record.handledAt = new Date();
    record.handlingAction = PerformanceHandlingAction.REBIND;
    if (dto.remark !== undefined) record.remark = dto.remark?.trim() || null;
    const saved = await this.rewardEventRepository.save(record);

    await this.operationLogsService.create({
      module: 'reward_event',
      targetId: saved.id,
      action: 'reassign_reward_event',
      operatorId: currentUser.id,
      detail: `改归属奖励事件 ${saved.eventType}`,
      detailJson: {
        before,
        after: await this.findRewardEventById(saved.id, currentUser),
      },
    });

    return this.findRewardEventById(saved.id, currentUser);
  }

  async findRewardEventRules(query: QueryRewardEventRulesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.rewardEventRuleRepository.createQueryBuilder('rule');
    if (query.eventType) qb.andWhere('rule.eventType = :eventType', { eventType: query.eventType });
    if (query.businessDomain) {
      qb.andWhere('rule.businessDomain = :businessDomain', {
        businessDomain: query.businessDomain,
      });
    }
    if (query.isActive !== undefined) qb.andWhere('rule.isActive = :isActive', { isActive: query.isActive });

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        RULE_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list.map((item) => this.mapRewardEventRule(item)), total);
  }

  async createRewardEventRule(dto: CreateRewardEventRuleDto, currentUser: CurrentUser) {
    const normalized = this.normalizeRewardRuleInput(dto);
    const duplicate = await this.rewardEventRuleRepository.findOne({
      where: { ruleCode: normalized.ruleCode },
    });
    if (duplicate) {
      throw new BadRequestException('奖励规则编码已存在');
    }

    const saved = await this.rewardEventRuleRepository.save(
      this.rewardEventRuleRepository.create(normalized),
    );

    await this.operationLogsService.create({
      module: 'reward_event_rule',
      targetId: saved.id,
      action: 'create_reward_event_rule',
      operatorId: currentUser.id,
      detail: `创建奖励规则 ${saved.ruleCode}`,
      detailJson: this.mapRewardEventRule(saved),
    });

    return this.mapRewardEventRule(saved);
  }

  async updateRewardEventRule(id: number, dto: UpdateRewardEventRuleDto, currentUser: CurrentUser) {
    const record = await this.rewardEventRuleRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('奖励规则不存在');
    }

    const before = this.mapRewardEventRule(record);
    const normalized = this.normalizeRewardRuleInput(dto, true);

    if (normalized.ruleCode && normalized.ruleCode !== record.ruleCode) {
      const duplicate = await this.rewardEventRuleRepository.findOne({
        where: { ruleCode: normalized.ruleCode },
      });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException('奖励规则编码已存在');
      }
    }

    Object.assign(record, normalized);
    const saved = await this.rewardEventRuleRepository.save(record);

    await this.operationLogsService.create({
      module: 'reward_event_rule',
      targetId: saved.id,
      action: 'update_reward_event_rule',
      operatorId: currentUser.id,
      detail: `更新奖励规则 ${saved.ruleCode}`,
      detailJson: {
        before,
        after: this.mapRewardEventRule(saved),
      },
    });

    return this.mapRewardEventRule(saved);
  }

  async toggleRewardEventRule(
    id: number,
    dto: ToggleRewardEventRuleDto,
    currentUser: CurrentUser,
  ) {
    const record = await this.rewardEventRuleRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('奖励规则不存在');
    }

    const before = this.mapRewardEventRule(record);
    record.isActive = dto.isActive;
    const saved = await this.rewardEventRuleRepository.save(record);

    await this.operationLogsService.create({
      module: 'reward_event_rule',
      targetId: saved.id,
      action: 'toggle_reward_event_rule',
      operatorId: currentUser.id,
      detail: `${saved.isActive ? '启用' : '停用'}奖励规则 ${saved.ruleCode}`,
      detailJson: {
        before,
        after: this.mapRewardEventRule(saved),
      },
    });

    return this.mapRewardEventRule(saved);
  }

  async generateBusinessStatSummaries(
    dto: GenerateBusinessStatSummariesDto,
    currentUser: CurrentUser,
  ) {
    const summaryDomains = dto.summaryDomains?.length
      ? new Set(dto.summaryDomains)
      : new Set(Object.values(RewardSummaryDomain));
    const tagRecords = await this.businessStatTagRepository.find({
      where: dto.periodKey ? { periodKey: dto.periodKey } : {},
    });
    const rewardEvents = await this.rewardEventRepository.find({
      where: dto.periodKey ? { periodKey: dto.periodKey } : {},
    });
    const accumulators = new Map<string, SummaryAccumulator>();

    for (const tag of tagRecords) {
      const summaryDomain = this.resolveSummaryDomainForTag(tag.tagCode);
      if (!summaryDomains.has(summaryDomain)) {
        continue;
      }
      const paymentClassification = this.resolveStoredRecordPaymentClassification(tag);
      if (!this.shouldIncludeInPaidBusinessStatSummary(paymentClassification)) {
        continue;
      }
      const accumulator = this.getSummaryAccumulator(accumulators, {
        summaryDomain,
        periodKey: tag.periodKey,
        merchantId: tag.merchantId,
        storeId: tag.storeId,
        responsibleEmployeeId: tag.responsibleEmployeeId,
        customerId: tag.customerId,
      });
      accumulator.tagCount += 1;
      accumulator.normalizedPayload.tagIds.push(tag.id);
      accumulator.normalizedPayload.sourceTables.push(tag.sourceTable);
    }

    for (const event of rewardEvents) {
      const summaryDomain = this.resolveSummaryDomainForRewardEvent(event);
      if (!summaryDomains.has(summaryDomain)) {
        continue;
      }
      const paymentClassification = this.resolveStoredRecordPaymentClassification(event);
      if (!this.shouldIncludeInPaidBusinessStatSummary(paymentClassification)) {
        continue;
      }
      const accumulator = this.getSummaryAccumulator(accumulators, {
        summaryDomain,
        periodKey: event.periodKey,
        merchantId: event.merchantId,
        storeId: event.storeId,
        responsibleEmployeeId: event.responsibleEmployeeId,
        customerId: event.customerId,
      });
      accumulator.rewardEventCount += 1;
      if (event.ignoredFlag || !event.confirmedFlag) {
        accumulator.pendingRewardEventCount += 1;
      } else {
        accumulator.confirmedRewardEventCount += 1;
      }
      if (event.amountStandard) {
        accumulator.amountTotal = addMoney(accumulator.amountTotal, event.amountStandard);
      }
      if (event.quantityStandard) {
        accumulator.quantityTotal = addQuantity(accumulator.quantityTotal, event.quantityStandard);
      }
      accumulator.normalizedPayload.rewardEventIds.push(event.id);
      accumulator.normalizedPayload.sourceTables.push(event.sourceTable);
    }

    if (dto.forceRegenerate) {
      await this.clearExistingBusinessStatSummariesByScope(dto, summaryDomains);
    }

    let createdRecords = 0;
    let updatedRecords = 0;
    for (const accumulator of accumulators.values()) {
      const outcome = await this.upsertBusinessStatSummary(accumulator);
      if (outcome === 'created') createdRecords += 1;
      else updatedRecords += 1;
    }

    const result = {
      periodKey: dto.periodKey ?? null,
      summaryDomains: Array.from(summaryDomains),
      createdRecords,
      updatedRecords,
      processedRecords: accumulators.size,
      forceRegenerate: dto.forceRegenerate ?? false,
    };

    await this.operationLogsService.create({
      module: 'business_stat_summary',
      targetId: 0,
      action: 'generate_business_stat_summaries',
      operatorId: currentUser.id,
      detail: `生成统计汇总 ${accumulators.size} 条`,
      detailJson: result,
    });

    return result;
  }

  async findBusinessStatSummaries(
    query: QueryBusinessStatSummariesDto,
    currentUser: CurrentUser,
  ) {
    const qb = this.businessStatSummaryRepository
      .createQueryBuilder('summary')
      .leftJoinAndSelect('summary.responsibleEmployee', 'employee')
      .leftJoinAndSelect('summary.confirmedByUser', 'confirmedByUser');

    if (query.summaryDomain) {
      qb.andWhere('summary.summaryDomain = :summaryDomain', {
        summaryDomain: query.summaryDomain,
      });
    }
    if (query.periodKey) qb.andWhere('summary.periodKey = :periodKey', { periodKey: query.periodKey });
    if (query.merchantId !== undefined) {
      qb.andWhere('summary.merchantId = :merchantId', { merchantId: query.merchantId });
    }
    if (query.responsibleEmployeeId !== undefined) {
      qb.andWhere('summary.responsibleEmployeeId = :responsibleEmployeeId', {
        responsibleEmployeeId: query.responsibleEmployeeId,
      });
    }
    if (query.confirmedFlag !== undefined) {
      qb.andWhere('summary.confirmedFlag = :confirmedFlag', {
        confirmedFlag: query.confirmedFlag,
      });
    }

    const sortedQb = qb
      .clone()
      .orderBy(
        SUMMARY_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .addOrderBy('summary.id', this.normalizeSortOrder(query.sortOrder, 'DESC'));

    if (this.hasBusinessStatSummaryDerivedFilters(query)) {
      const filteredList = await sortedQb.getMany();
      const verificationContextMap = await this.buildSummaryVerificationContextMap(
        filteredList,
        currentUser,
        'list',
      );
      const mapped = filteredList.map((item) =>
        this.mapBusinessStatSummary(item, currentUser, verificationContextMap.get(item.id) ?? null),
      );
      const scoped = mapped.filter((item) => this.matchesBusinessStatSummaryDerivedFilters(item, query));
      return buildPaginationResult(query, paginateArray(scoped, query).list, scoped.length);
    }

    const { skip, take } = getPagination(query);
    const total = await qb.getCount();
    const list = await sortedQb.skip(skip).take(take).getMany();
    const verificationContextMap = await this.buildSummaryVerificationContextMap(list, currentUser, 'list');
    return buildPaginationResult(
      query,
      list.map((item) =>
        this.mapBusinessStatSummary(item, currentUser, verificationContextMap.get(item.id) ?? null),
      ),
      total,
    );
  }

  async findBusinessStatSummaryDetail(
    id: number,
    query: QueryBusinessStatSummaryDetailDto,
    currentUser: CurrentUser,
  ) {
    const summary = await this.businessStatSummaryRepository.findOne({
      where: { id },
      relations: {
        responsibleEmployee: true,
        confirmedByUser: true,
      },
    });

    if (!summary) {
      throw new NotFoundException('统计汇总不存在');
    }

    const tagIds = this.readNumberArray(summary.normalizedPayload?.tagIds);
    const rewardEventIds = this.readNumberArray(summary.normalizedPayload?.rewardEventIds);

    const tags = tagIds.length
      ? await this.businessStatTagRepository.find({
          where: { id: In(tagIds) },
          relations: { responsibleEmployee: true },
        })
      : [];
    const rewardEvents = rewardEventIds.length
      ? await this.rewardEventRepository.find({
          where: { id: In(rewardEventIds) },
          relations: { responsibleEmployee: true, handledByUser: true },
        })
      : [];

    const recordVerificationContextMap = await this.buildRecordVerificationContextMap(
      [...tags, ...rewardEvents],
      currentUser,
      'detail',
    );
    const customerBindingContextMap = await this.buildCustomerIdentificationBindingContextMap(
      [...tags, ...rewardEvents],
      recordVerificationContextMap,
    );
    const formalBenefitContextMap = await this.loadFormalEmployeeBenefitSummaryContextMap([summary]);
    const payrollDecisionContextMap = await this.loadSummaryPayrollDecisionContextMap([summary]);
    const legacyWelfareCandidateRecordKeySet = await this.loadLegacyWelfareCandidateRecordKeySet([
      ...tags,
      ...rewardEvents,
    ]);

    const summaryVerificationContext = this.buildSummaryVerificationContext(
      summary,
      [...tags, ...rewardEvents],
      recordVerificationContextMap,
      currentUser,
      'detail',
      formalBenefitContextMap.get(summary.id) ?? null,
      payrollDecisionContextMap.get(summary.id) ?? null,
      legacyWelfareCandidateRecordKeySet,
    );

    const detailItems = [
      ...tags.map((item) => ({
        itemType: 'tag',
        id: item.id,
        occurredAt: item.occurredAt,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        payload: this.mapStatTag(
          item,
          recordVerificationContextMap.get(this.buildSourceRecordKey(item.sourceTable, item.sourceId)) ??
            null,
          customerBindingContextMap.get(this.buildSourceRecordKey(item.sourceTable, item.sourceId)) ??
            null,
          currentUser,
          'detail',
        ),
      })),
      ...rewardEvents.map((item) => ({
        itemType: 'reward',
        id: item.id,
        occurredAt: item.occurredAt,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        payload: this.mapRewardEvent(
          item,
          currentUser,
          recordVerificationContextMap.get(this.buildSourceRecordKey(item.sourceTable, item.sourceId)) ??
            null,
          customerBindingContextMap.get(this.buildSourceRecordKey(item.sourceTable, item.sourceId)) ??
            null,
          'detail',
        ),
      })),
    ].sort((left, right) => {
      const sortBy = query.sortBy ?? 'occurredAt';
      const sortOrder = this.normalizeSortOrder(query.sortOrder, 'DESC');
      const leftValue = new Date(((left as unknown as Record<string, Date>)[sortBy]) ?? left.occurredAt).getTime();
      const rightValue = new Date(((right as unknown as Record<string, Date>)[sortBy]) ?? right.occurredAt).getTime();
      return sortOrder === 'ASC' ? leftValue - rightValue : rightValue - leftValue;
    });

    return {
      summary: this.mapBusinessStatSummary(summary, currentUser, summaryVerificationContext),
      detail: paginateArray(detailItems, query),
    };
  }

  async confirmBusinessStatSummary(
    id: number,
    dto: ConfirmBusinessStatSummaryDto,
    currentUser: CurrentUser,
  ) {
    const summary = await this.businessStatSummaryRepository.findOne({ where: { id } });
    if (!summary) {
      throw new NotFoundException('统计汇总不存在');
    }

    const before = this.mapBusinessStatSummary(summary, currentUser);
    summary.confirmedFlag = true;
    summary.confirmedBy = currentUser.id;
    summary.confirmedAt = new Date();
    if (dto.remark !== undefined) summary.remark = dto.remark?.trim() || null;

    const saved = await this.businessStatSummaryRepository.save(summary);

    await this.operationLogsService.create({
      module: 'business_stat_summary',
      targetId: saved.id,
      action: 'confirm_business_stat_summary',
      operatorId: currentUser.id,
      detail: `确认统计汇总 ${saved.summaryKey}`,
      detailJson: {
        before,
        after: this.mapBusinessStatSummary(saved, currentUser),
      },
    });

    return this.findBusinessStatSummaryDetail(saved.id, {}, currentUser);
  }

  async findPendingItems(query: QueryStatPendingItemsDto, currentUser: CurrentUser) {
    const items: PendingItemView[] = [];
    const verificationRecords: Array<BusinessStatTag | RewardEvent> = [];

    if (!query.type || query.type === 'tag') {
      const tagQb = this.businessStatTagRepository
        .createQueryBuilder('tag')
        .leftJoinAndSelect('tag.responsibleEmployee', 'employee')
        .where('tag.confirmedFlag = 0');

      if (query.periodKey) tagQb.andWhere('tag.periodKey = :periodKey', { periodKey: query.periodKey });
      if (query.sourceTable) tagQb.andWhere('tag.sourceTable = :sourceTable', { sourceTable: query.sourceTable });

      const tags = await tagQb.getMany();
      verificationRecords.push(...tags);
      items.push(
        ...tags.map((item) => ({
          itemType: 'tag' as const,
          id: item.id,
          occurredAt: item.occurredAt,
          updatedAt: item.updatedAt,
          createdAt: item.createdAt,
          payload: item,
        })),
      );
    }

    if (!query.type || query.type === 'reward') {
      const rewardQb = this.rewardEventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.responsibleEmployee', 'employee');

      if (query.includeResolved) rewardQb.where('1 = 1');
      else rewardQb.where('event.confirmedFlag = 0').andWhere('event.ignoredFlag = 0');

      if (query.periodKey) rewardQb.andWhere('event.periodKey = :periodKey', { periodKey: query.periodKey });
      if (query.sourceTable) rewardQb.andWhere('event.sourceTable = :sourceTable', { sourceTable: query.sourceTable });

      const rewardEvents = await rewardQb.getMany();
      verificationRecords.push(...rewardEvents);
      items.push(
        ...rewardEvents.map((item) => ({
          itemType: 'reward' as const,
          id: item.id,
          occurredAt: item.occurredAt,
          updatedAt: item.updatedAt,
          createdAt: item.createdAt,
          payload: item,
        })),
      );
    }

    const recordVerificationContextMap = await this.buildRecordVerificationContextMap(
      verificationRecords,
      currentUser,
      'list',
    );
    const customerBindingContextMap = await this.buildCustomerIdentificationBindingContextMap(
      verificationRecords,
      recordVerificationContextMap,
    );

    const normalizedItems: PendingItemView[] = items.map((item) => {
      const payload = item.payload as BusinessStatTag | RewardEvent;
      const sourceRecordKey = this.buildSourceRecordKey(payload.sourceTable, payload.sourceId);
      const verificationContext = recordVerificationContextMap.get(sourceRecordKey) ?? null;
      const customerBindingContext = customerBindingContextMap.get(sourceRecordKey) ?? null;
      return {
        ...item,
        payload:
          item.itemType === 'tag'
            ? this.mapStatTag(
                payload as BusinessStatTag,
                verificationContext,
                customerBindingContext,
                currentUser,
                'list',
              )
            : this.mapRewardEvent(
                payload as RewardEvent,
                currentUser,
                verificationContext,
                customerBindingContext,
                'list',
              ),
      };
    });

    const filteredItems = normalizedItems.filter((item) =>
      this.matchesBusinessStatPendingDerivedFilters(item, query),
    );

    const sortBy = query.sortBy ?? 'occurredAt';
    const sortOrder = this.normalizeSortOrder(query.sortOrder, 'DESC');
    filteredItems.sort((left, right) => {
      const leftValue = new Date(
        (left as unknown as Record<string, string | Date | undefined>)[sortBy] ?? left.occurredAt,
      ).getTime();
      const rightValue = new Date(
        (right as unknown as Record<string, string | Date | undefined>)[sortBy] ?? right.occurredAt,
      ).getTime();
      const primaryDiff = sortOrder === 'ASC' ? leftValue - rightValue : rightValue - leftValue;
      if (primaryDiff !== 0) {
        return primaryDiff;
      }
      const leftType = `${left.itemType}:${left.id}`;
      const rightType = `${right.itemType}:${right.id}`;
      return sortOrder === 'ASC' ? leftType.localeCompare(rightType) : rightType.localeCompare(leftType);
    });

    return paginateArray(filteredItems, query);
  }

  private async buildStarkWorkOrderTags(
    dto: GenerateStatTagsDto,
    bindingContext: BindingContext,
  ) {
    const qb = this.workOrderRepository.createQueryBuilder('workOrder');
    if (dto.periodKey) {
      qb.andWhere("DATE_FORMAT(workOrder.updatedAt, '%Y-%m') = :periodKey", {
        periodKey: dto.periodKey,
      });
    }

    const workOrders = await qb.getMany();
    const candidates: TagCandidateInput[] = [];

    for (const workOrder of workOrders) {
      // Intake text is pending information, not a confirmed business source.
      if (isWorkOrderUnquoted(workOrder)) continue;
      const keywordText = `${workOrder.title ?? ''} ${workOrder.remark ?? ''}`;
      const employeeBinding = this.resolveEmployeeBinding(
        [
          {
            sourceSystem: 'STARK',
            sourceTable: 'users',
            sourceId: workOrder.responsibleUserId ? String(workOrder.responsibleUserId) : null,
            bindingType: 'user',
          },
          {
            sourceSystem: 'STARK',
            sourceTable: 'users',
            sourceId: String(workOrder.createdBy),
            bindingType: 'user',
          },
        ],
        bindingContext,
      );
      const vehicleTag = this.resolveVehicleTag(keywordText);
      const insuranceFlag = this.matchesKeywords(keywordText, INSURANCE_KEYWORDS);
      const tagCodes = new Set<BusinessStatTagCode>();
      if (vehicleTag) {
        tagCodes.add(vehicleTag);
      }
      if (insuranceFlag) tagCodes.add(BusinessStatTagCode.INSURANCE_CLAIM);

      const reasons = this.buildRemarkReasons({
        employeeId: employeeBinding.employeeId,
      });
      const occurredAt = this.resolveWorkOrderOccurredAt(workOrder);

      for (const tagCode of tagCodes) {
        candidates.push({
          tagCode,
          sourceSystem: 'stark',
          sourceTable: 'work_orders',
          sourceId: String(workOrder.id),
          sourceOrderNo: workOrder.workOrderNo,
          businessDomain: BusinessStatDomain.STARK_WORK_ORDER,
          responsibleEmployeeId: employeeBinding.employeeId,
          customerId: workOrder.customerMobile ?? workOrder.customerName ?? null,
          vehicleType: this.resolveVehicleTypeForTag(tagCode),
          insuranceFlag,
          occurredAt,
          periodKey: this.resolvePeriodKey(occurredAt),
          confirmedFlag: reasons.length === 0,
          remark: this.joinRemarkReasons(reasons),
          normalizedPayload: {
            workOrderId: workOrder.id,
            status: workOrder.status,
            title: workOrder.title,
            remark: workOrder.remark,
            amountDue: workOrder.amountDue,
            amountReceived: workOrder.amountReceived,
            materialCostTotal: workOrder.materialCostTotal,
          },
        });
      }
    }

    return candidates;
  }

  private async buildAbcOrderTags(dto: GenerateStatTagsDto, bindingContext: BindingContext) {
    const records = await this.abcSyncOrderRepository.find();
    const candidates: TagCandidateInput[] = [];

    for (const record of records) {
      if (dto.periodKey && this.resolvePeriodKey(record.sourceUpdatedAt ?? record.updatedAt) !== dto.periodKey) {
        continue;
      }
      const employeeBinding = this.resolveEmployeeBinding(
        this.buildAbcBindingCandidates(record.sourceMerchantId, record.sourceUserId),
        bindingContext,
      );
      const normalizedText = JSON.stringify(record.normalizedPayload ?? {});
      const vehicleTag = this.resolveVehicleTag(normalizedText);
      const insuranceFlag = this.matchesKeywords(normalizedText, INSURANCE_KEYWORDS);
      const merchantId = this.normalizeAbcMerchantId(record.sourceMerchantId, record.sourceTable);
      const isAWashCardSale = this.isAWashCardSaleOrder(record);
      const reasons = this.buildRemarkReasons({
        employeeId: employeeBinding.employeeId,
        sourceMappingConfirmed: record.mappingConfirmed,
        sourceNotes: record.mappingNotes,
      });
      if (!vehicleTag && !insuranceFlag) {
        reasons.push(this.resolveClassificationPendingReason(record, isAWashCardSale));
      }
      const occurredAt = record.sourceUpdatedAt ?? record.updatedAt;
      const periodKey = dto.periodKey ?? this.resolvePeriodKey(occurredAt);
      const basePayload = {
        ...record.normalizedPayload,
        metricCorrection: {
          abcOverallIncluded: true,
          aOrderPrimarySalesChain:
            record.sourceTable === 'goods_group_order' ? 'goods_group_order' : null,
          topUpPrimarySalesChain: false,
          cardLedgerAuxiliaryChain: false,
          aWashCardSale: isAWashCardSale,
          vehicleClassification: vehicleTag ? this.resolveVehicleTypeForTag(vehicleTag) : 'unclassified',
          insuranceFlag,
        },
      };

      candidates.push({
        tagCode: BusinessStatTagCode.ABC_OVERALL,
        sourceSystem: record.sourceSystem,
        sourceTable: record.sourceTable,
        sourceId: record.sourceId,
        sourceOrderNo: record.sourceOrderNo,
        businessDomain: BusinessStatDomain.ABC_ORDER,
        merchantId,
        responsibleEmployeeId: employeeBinding.employeeId,
        customerId: record.sourceUserId,
        insuranceFlag,
        occurredAt,
        periodKey,
        confirmedFlag: reasons.length === 0,
        remark: this.joinRemarkReasons(reasons),
        normalizedPayload: basePayload,
      });

      if (isAWashCardSale) {
        candidates.push({
          tagCode: BusinessStatTagCode.A_WASH_CARD_SALE,
          sourceSystem: record.sourceSystem,
          sourceTable: record.sourceTable,
          sourceId: record.sourceId,
          sourceOrderNo: record.sourceOrderNo,
          businessDomain: BusinessStatDomain.ABC_ORDER,
          merchantId,
          responsibleEmployeeId: employeeBinding.employeeId,
          customerId: record.sourceUserId,
          insuranceFlag,
          occurredAt,
          periodKey,
          confirmedFlag: reasons.length === 0,
          remark: this.joinRemarkReasons(reasons),
          normalizedPayload: {
            ...basePayload,
            metricCorrection: {
              ...(basePayload.metricCorrection as Record<string, unknown>),
              aWashCardPrimaryRule: 'goods_group_order.goods_group_id=47',
            },
          },
        });
      }

      if (vehicleTag) {
        candidates.push({
          tagCode: vehicleTag,
          sourceSystem: record.sourceSystem,
          sourceTable: record.sourceTable,
          sourceId: record.sourceId,
          sourceOrderNo: record.sourceOrderNo,
          businessDomain: BusinessStatDomain.ABC_ORDER,
          merchantId,
          responsibleEmployeeId: employeeBinding.employeeId,
          customerId: record.sourceUserId,
          vehicleType: this.resolveVehicleTypeForTag(vehicleTag),
          insuranceFlag,
          occurredAt,
          periodKey,
          confirmedFlag: reasons.length === 0,
          remark: this.joinRemarkReasons(reasons),
          normalizedPayload: basePayload,
        });
      }

      if (insuranceFlag) {
        candidates.push({
          tagCode: BusinessStatTagCode.INSURANCE_CLAIM,
          sourceSystem: record.sourceSystem,
          sourceTable: record.sourceTable,
          sourceId: record.sourceId,
          sourceOrderNo: record.sourceOrderNo,
          businessDomain: BusinessStatDomain.ABC_ORDER,
          merchantId,
          responsibleEmployeeId: employeeBinding.employeeId,
          customerId: record.sourceUserId,
          insuranceFlag: true,
          occurredAt,
          periodKey,
          confirmedFlag: reasons.length === 0,
          remark: this.joinRemarkReasons(reasons),
          normalizedPayload: basePayload,
        });
      }
    }

    return candidates;
  }

  private async buildAbcFundTags(dto: GenerateStatTagsDto, bindingContext: BindingContext) {
    const records = await this.abcSyncFundRepository.find();
    const candidates: TagCandidateInput[] = [];

    for (const record of records) {
      if (dto.periodKey && this.resolvePeriodKey(record.sourceUpdatedAt ?? record.updatedAt) !== dto.periodKey) {
        continue;
      }
      const employeeBinding = this.resolveEmployeeBinding(
        this.buildAbcBindingCandidates(record.sourceMerchantId, record.sourceUserId),
        bindingContext,
      );
      const reasons = this.buildRemarkReasons({
        employeeId: employeeBinding.employeeId,
        sourceMappingConfirmed: record.mappingConfirmed,
        sourceNotes: record.mappingNotes,
      });

      candidates.push({
        tagCode: BusinessStatTagCode.ABC_OVERALL,
        sourceSystem: record.sourceSystem,
        sourceTable: record.sourceTable,
        sourceId: record.sourceId,
        sourceOrderNo: record.sourceOrderNo ?? record.relatedOrderNo,
        businessDomain: BusinessStatDomain.ABC_FUND,
        merchantId: this.parseOptionalInt(record.sourceMerchantId),
        responsibleEmployeeId: employeeBinding.employeeId,
        customerId: record.sourceUserId,
        occurredAt: record.sourceUpdatedAt ?? record.updatedAt,
        periodKey: dto.periodKey ?? this.resolvePeriodKey(record.sourceUpdatedAt ?? record.updatedAt),
        confirmedFlag: reasons.length === 0,
        remark: this.joinRemarkReasons(reasons),
        normalizedPayload: record.normalizedPayload,
      });
    }

    return candidates;
  }

  private async buildAbcCardTags(dto: GenerateStatTagsDto, bindingContext: BindingContext) {
    const records = await this.abcSyncCardRepository.find();
    const candidates: TagCandidateInput[] = [];

    for (const record of records) {
      if (dto.periodKey && this.resolvePeriodKey(record.sourceUpdatedAt ?? record.updatedAt) !== dto.periodKey) {
        continue;
      }
      const employeeBinding = this.resolveEmployeeBinding(
        this.buildAbcBindingCandidates(record.sourceMerchantId, record.sourceUserId),
        bindingContext,
      );
      const merchantId = this.normalizeAbcMerchantId(record.sourceMerchantId, record.sourceTable);
      const reasons = this.buildRemarkReasons({
        employeeId: employeeBinding.employeeId,
        sourceMappingConfirmed: record.mappingConfirmed,
        sourceNotes: record.mappingNotes,
      });
      if (this.hasUnknownCardMerchant(record.sourceMerchantId, record.sourceTable)) {
        reasons.push(UNKNOWN_CARD_MERCHANT_REASON);
      }

      candidates.push({
        tagCode: BusinessStatTagCode.ABC_OVERALL,
        sourceSystem: record.sourceSystem,
        sourceTable: record.sourceTable,
        sourceId: record.sourceId,
        sourceOrderNo: record.sourceOrderNo,
        businessDomain: BusinessStatDomain.ABC_CARD,
        merchantId,
        responsibleEmployeeId: employeeBinding.employeeId,
        customerId: record.sourceUserId,
        occurredAt: record.sourceUpdatedAt ?? record.updatedAt,
        periodKey: dto.periodKey ?? this.resolvePeriodKey(record.sourceUpdatedAt ?? record.updatedAt),
        confirmedFlag: reasons.length === 0,
        remark: this.joinRemarkReasons(reasons),
        normalizedPayload: {
          ...record.normalizedPayload,
          metricCorrection: {
            abcOverallIncluded: true,
            cardLedgerAuxiliaryChain: true,
            primarySalesChain: false,
            merchantResolved: merchantId !== null,
          },
        },
      });
    }

    return candidates;
  }

  private async buildStarkRewardEvents(
    dto: GenerateRewardEventsDto,
    bindingContext: BindingContext,
    tagMap: Map<string, Set<BusinessStatTagCode>>,
    rules: RewardEventRule[],
  ) {
    const qb = this.workOrderRepository.createQueryBuilder('workOrder');
    qb.andWhere('workOrder.status IN (:...statuses)', {
      statuses: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CLOSED],
    });

    if (dto.periodKey) {
      qb.andWhere("DATE_FORMAT(workOrder.updatedAt, '%Y-%m') = :periodKey", {
        periodKey: dto.periodKey,
      });
    }

    const workOrders = await qb.getMany();
    const candidates: RewardEventCandidateInput[] = [];

    for (const workOrder of workOrders) {
      // Keep the marker guard even if a legacy writer changes the draft status.
      if (isWorkOrderUnquoted(workOrder)) continue;
      const employeeBinding = this.resolveEmployeeBinding(
        [
          {
            sourceSystem: 'STARK',
            sourceTable: 'users',
            sourceId: workOrder.responsibleUserId ? String(workOrder.responsibleUserId) : null,
            bindingType: 'user',
          },
          {
            sourceSystem: 'STARK',
            sourceTable: 'users',
            sourceId: String(workOrder.createdBy),
            bindingType: 'user',
          },
        ],
        bindingContext,
      );

      const sourceKey = this.buildSourceKey('stark', 'work_orders', String(workOrder.id));
      const tags = tagMap.get(sourceKey) ?? new Set<BusinessStatTagCode>();
      const occurredAt = this.resolveWorkOrderOccurredAt(workOrder);
      const periodKey = dto.periodKey ?? this.resolvePeriodKey(occurredAt);
      const baseReasons = this.buildRemarkReasons({
        employeeId: employeeBinding.employeeId,
      });

      candidates.push(
        this.applyRewardRule(
          {
            eventType: RewardEventType.A_ORDER_COMPLETED,
            sourceSystem: 'stark',
            sourceTable: 'work_orders',
            sourceId: String(workOrder.id),
            sourceOrderNo: workOrder.workOrderNo,
            businessDomain: BusinessStatDomain.STARK_WORK_ORDER,
            responsibleEmployeeId: employeeBinding.employeeId,
            customerId: workOrder.customerMobile ?? workOrder.customerName ?? null,
            vehicleType: this.resolveVehicleTypeFromTags(tags),
            insuranceFlag: tags.has(BusinessStatTagCode.INSURANCE_CLAIM),
            amountStandard: normalizeMoney(workOrder.amountReceived || workOrder.amountDue || '0'),
            occurredAt,
            periodKey,
            confirmedFlag: baseReasons.length === 0,
            remark: this.joinRemarkReasons(baseReasons),
            normalizedPayload: {
              workOrderId: workOrder.id,
              status: workOrder.status,
              tags: Array.from(tags),
            },
          },
          rules,
          tags,
        ),
      );

      if (tags.has(BusinessStatTagCode.PUBLIC_VEHICLE)) {
        candidates.push(
          this.applyRewardRule(
            {
              eventType: RewardEventType.PUBLIC_VEHICLE_COMPLETED,
              sourceSystem: 'stark',
              sourceTable: 'work_orders',
              sourceId: String(workOrder.id),
              sourceOrderNo: workOrder.workOrderNo,
              businessDomain: BusinessStatDomain.STARK_WORK_ORDER,
              responsibleEmployeeId: employeeBinding.employeeId,
              customerId: workOrder.customerMobile ?? workOrder.customerName ?? null,
              vehicleType: 'public',
              amountStandard: normalizeMoney(workOrder.amountReceived || workOrder.amountDue || '0'),
              occurredAt,
              periodKey,
              confirmedFlag: baseReasons.length === 0,
              remark: this.joinRemarkReasons(baseReasons),
              normalizedPayload: {
                workOrderId: workOrder.id,
                tags: Array.from(tags),
              },
            },
            rules,
            tags,
          ),
        );
      }

      if (tags.has(BusinessStatTagCode.INSURANCE_CLAIM)) {
        candidates.push(
          this.applyRewardRule(
            {
              eventType: RewardEventType.INSURANCE_CONVERSION,
              sourceSystem: 'stark',
              sourceTable: 'work_orders',
              sourceId: String(workOrder.id),
              sourceOrderNo: workOrder.workOrderNo,
              businessDomain: BusinessStatDomain.STARK_WORK_ORDER,
              responsibleEmployeeId: employeeBinding.employeeId,
              customerId: workOrder.customerMobile ?? workOrder.customerName ?? null,
              insuranceFlag: true,
              amountStandard: normalizeMoney(workOrder.amountReceived || workOrder.amountDue || '0'),
              occurredAt,
              periodKey,
              confirmedFlag: baseReasons.length === 0,
              remark: this.joinRemarkReasons(baseReasons),
              normalizedPayload: {
                workOrderId: workOrder.id,
                tags: Array.from(tags),
              },
            },
            rules,
            tags,
          ),
        );
      }

      const comboText = `${workOrder.title ?? ''} ${workOrder.remark ?? ''}`;
      if (this.matchesKeywords(comboText, COMBO_KEYWORDS)) {
        candidates.push(
          this.applyRewardRule(
            {
              eventType: RewardEventType.COMBO_SUCCESS,
              sourceSystem: 'stark',
              sourceTable: 'work_orders',
              sourceId: String(workOrder.id),
              sourceOrderNo: workOrder.workOrderNo,
              businessDomain: BusinessStatDomain.STARK_WORK_ORDER,
              responsibleEmployeeId: employeeBinding.employeeId,
              customerId: workOrder.customerMobile ?? workOrder.customerName ?? null,
              amountStandard: normalizeMoney(workOrder.amountReceived || workOrder.amountDue || '0'),
              occurredAt,
              periodKey,
              confirmedFlag: baseReasons.length === 0,
              remark: this.joinRemarkReasons(baseReasons),
              normalizedPayload: {
                workOrderId: workOrder.id,
                comboText,
              },
            },
            rules,
            tags,
          ),
        );
      }
    }

    return candidates;
  }

  private async buildAbcOrderRewardEvents(
    dto: GenerateRewardEventsDto,
    bindingContext: BindingContext,
    tagMap: Map<string, Set<BusinessStatTagCode>>,
    rules: RewardEventRule[],
  ) {
    const records = await this.abcSyncOrderRepository.find();
    const candidates: RewardEventCandidateInput[] = [];

    for (const record of records) {
      if (dto.periodKey && this.resolvePeriodKey(record.sourceUpdatedAt ?? record.updatedAt) !== dto.periodKey) {
        continue;
      }
      const sourceKey = this.buildSourceKey(record.sourceSystem, record.sourceTable, record.sourceId);
      const tags = tagMap.get(sourceKey) ?? new Set<BusinessStatTagCode>();
      const isWashCardSale =
        tags.has(BusinessStatTagCode.A_WASH_CARD_SALE) &&
        this.isAWashCardSaleOrder(record) &&
        Number(record.amountStandard ?? '0') > 1;
      const isCompletedLike = !!record.statusStandard && ['completed', 'paid', 'success'].includes(record.statusStandard);

      if (!isCompletedLike && !isWashCardSale) {
        continue;
      }

      const employeeBinding = this.resolveEmployeeBinding(
        this.buildAbcBindingCandidates(record.sourceMerchantId, record.sourceUserId),
        bindingContext,
      );
      const merchantId = this.normalizeAbcMerchantId(record.sourceMerchantId, record.sourceTable);
      const reasons = this.buildRemarkReasons({
        employeeId: employeeBinding.employeeId,
        sourceMappingConfirmed: record.mappingConfirmed,
        sourceNotes: record.mappingNotes,
      });
      if (!isCompletedLike && isWashCardSale) {
        reasons.push('A端洗车卡销售主链样本允许贯穿奖励/工资试算，但订单完成状态仍待人工确认');
      }
      const occurredAt = record.sourceUpdatedAt ?? record.updatedAt;
      const periodKey = dto.periodKey ?? this.resolvePeriodKey(occurredAt);

      candidates.push(
        this.applyRewardRule(
          {
            eventType: RewardEventType.A_ORDER_COMPLETED,
            sourceSystem: record.sourceSystem,
            sourceTable: record.sourceTable,
            sourceId: record.sourceId,
            sourceOrderNo: record.sourceOrderNo,
            businessDomain: BusinessStatDomain.ABC_ORDER,
            merchantId,
            responsibleEmployeeId: employeeBinding.employeeId,
            customerId: record.sourceUserId,
            vehicleType: this.resolveVehicleTypeFromTags(tags),
            insuranceFlag: tags.has(BusinessStatTagCode.INSURANCE_CLAIM),
            amountStandard: record.amountStandard ? normalizeMoney(record.amountStandard) : null,
            occurredAt,
            periodKey,
            confirmedFlag: reasons.length === 0,
            remark: this.joinRemarkReasons(reasons),
            normalizedPayload: {
              ...record.normalizedPayload,
              rewardFlowControl: {
                allowAOrderCompletedPropagation: isWashCardSale,
                completedStatusRequired: !isWashCardSale,
                derivedFromStatusStandard: record.statusStandard,
              },
            },
          },
          rules,
          tags,
        ),
      );

      if (tags.has(BusinessStatTagCode.PUBLIC_VEHICLE)) {
        candidates.push(
          this.applyRewardRule(
            {
              eventType: RewardEventType.PUBLIC_VEHICLE_COMPLETED,
              sourceSystem: record.sourceSystem,
              sourceTable: record.sourceTable,
              sourceId: record.sourceId,
              sourceOrderNo: record.sourceOrderNo,
              businessDomain: BusinessStatDomain.ABC_ORDER,
              merchantId,
              responsibleEmployeeId: employeeBinding.employeeId,
              customerId: record.sourceUserId,
              vehicleType: 'public',
              amountStandard: record.amountStandard ? normalizeMoney(record.amountStandard) : null,
              occurredAt,
              periodKey,
              confirmedFlag: reasons.length === 0,
              remark: this.joinRemarkReasons(reasons),
              normalizedPayload: record.normalizedPayload,
            },
            rules,
            tags,
          ),
        );
      }

      if (tags.has(BusinessStatTagCode.INSURANCE_CLAIM)) {
        candidates.push(
          this.applyRewardRule(
            {
              eventType: RewardEventType.INSURANCE_CONVERSION,
              sourceSystem: record.sourceSystem,
              sourceTable: record.sourceTable,
              sourceId: record.sourceId,
              sourceOrderNo: record.sourceOrderNo,
              businessDomain: BusinessStatDomain.ABC_ORDER,
              merchantId,
              responsibleEmployeeId: employeeBinding.employeeId,
              customerId: record.sourceUserId,
              insuranceFlag: true,
              amountStandard: record.amountStandard ? normalizeMoney(record.amountStandard) : null,
              occurredAt,
              periodKey,
              confirmedFlag: reasons.length === 0,
              remark: this.joinRemarkReasons(reasons),
              normalizedPayload: record.normalizedPayload,
            },
            rules,
            tags,
          ),
        );
      }

      const normalizedText = JSON.stringify(record.normalizedPayload ?? {});
      if (this.matchesKeywords(normalizedText, COMBO_KEYWORDS)) {
        candidates.push(
          this.applyRewardRule(
            {
              eventType: RewardEventType.COMBO_SUCCESS,
              sourceSystem: record.sourceSystem,
              sourceTable: record.sourceTable,
              sourceId: record.sourceId,
              sourceOrderNo: record.sourceOrderNo,
              businessDomain: BusinessStatDomain.ABC_ORDER,
              merchantId,
              responsibleEmployeeId: employeeBinding.employeeId,
              customerId: record.sourceUserId,
              amountStandard: record.amountStandard ? normalizeMoney(record.amountStandard) : null,
              occurredAt,
              periodKey,
              confirmedFlag: reasons.length === 0,
              remark: this.joinRemarkReasons(reasons),
              normalizedPayload: record.normalizedPayload,
            },
            rules,
            tags,
          ),
        );
      }
    }

    return candidates;
  }

  private async buildAbcCardRewardEvents(
    dto: GenerateRewardEventsDto,
    bindingContext: BindingContext,
    rules: RewardEventRule[],
  ) {
    const records = await this.abcSyncCardRepository.find();
    const candidates: RewardEventCandidateInput[] = [];

    for (const record of records) {
      if (dto.periodKey && this.resolvePeriodKey(record.sourceUpdatedAt ?? record.updatedAt) !== dto.periodKey) {
        continue;
      }
      if (record.cardObjectType !== 'user_card_account') {
        continue;
      }

      const employeeBinding = this.resolveEmployeeBinding(
        this.buildAbcBindingCandidates(record.sourceMerchantId, record.sourceUserId),
        bindingContext,
      );
      const reasons = this.buildRemarkReasons({
        employeeId: employeeBinding.employeeId,
        sourceMappingConfirmed: record.mappingConfirmed,
        sourceNotes: record.mappingNotes,
      });

      candidates.push(
        this.applyRewardRule(
          {
            eventType: RewardEventType.CARD_ISSUE,
            sourceSystem: record.sourceSystem,
            sourceTable: record.sourceTable,
            sourceId: record.sourceId,
            sourceOrderNo: record.sourceOrderNo,
            businessDomain: BusinessStatDomain.ABC_CARD,
            merchantId: this.parseOptionalInt(record.sourceMerchantId),
            responsibleEmployeeId: employeeBinding.employeeId,
            customerId: record.sourceUserId,
            amountStandard: record.amountStandard ? normalizeMoney(record.amountStandard) : null,
            occurredAt: record.sourceUpdatedAt ?? record.updatedAt,
            periodKey: dto.periodKey ?? this.resolvePeriodKey(record.sourceUpdatedAt ?? record.updatedAt),
            confirmedFlag: reasons.length === 0,
            remark: this.joinRemarkReasons(reasons),
            normalizedPayload: record.normalizedPayload,
          },
          rules,
          new Set<BusinessStatTagCode>(),
        ),
      );
    }

    return candidates;
  }

  private async buildPrivateVehicleRepurchaseEvents(
    periodKey: string | undefined,
    rules: RewardEventRule[],
  ) {
    const tags = await this.businessStatTagRepository.find({
      where: {
        tagCode: BusinessStatTagCode.PRIVATE_VEHICLE,
        ...(periodKey ? { periodKey } : {}),
      },
    });
    const grouped = new Map<string, BusinessStatTag[]>();

    for (const tag of tags) {
      if (!tag.customerId) continue;
      const key = [tag.periodKey, tag.merchantId ?? 'none', tag.customerId].join('|');
      const current = grouped.get(key) ?? [];
      current.push(tag);
      grouped.set(key, current);
    }

    const candidates: RewardEventCandidateInput[] = [];
    for (const records of grouped.values()) {
      if (records.length < 2) continue;
      for (const tag of records) {
        candidates.push(
          this.applyRewardRule(
            {
              eventType: RewardEventType.PRIVATE_VEHICLE_REPURCHASE,
              sourceSystem: tag.sourceSystem,
              sourceTable: tag.sourceTable,
              sourceId: tag.sourceId,
              sourceOrderNo: tag.sourceOrderNo,
              businessDomain: tag.businessDomain,
              merchantId: tag.merchantId,
              storeId: tag.storeId,
              responsibleEmployeeId: tag.responsibleEmployeeId,
              customerId: tag.customerId,
              vehicleType: 'private',
              insuranceFlag: tag.insuranceFlag,
              occurredAt: tag.occurredAt,
              periodKey: tag.periodKey,
              confirmedFlag: tag.confirmedFlag,
              remark: tag.remark,
              normalizedPayload: {
                statTagId: tag.id,
                repurchaseGroupSize: records.length,
              },
            },
            rules,
            new Set<BusinessStatTagCode>([BusinessStatTagCode.PRIVATE_VEHICLE]),
          ),
        );
      }
    }

    return candidates;
  }

  private applyRewardRule(
    candidate: RewardEventCandidateInput,
    rules: RewardEventRule[],
    tags: Set<BusinessStatTagCode>,
  ) {
    const matchedRule = rules.find((rule) => this.matchRewardRule(rule, candidate, tags));
    const reasons = candidate.remark?.trim() ? [candidate.remark.trim()] : [];

    if (!matchedRule) {
      reasons.push('未命中奖励规则');
      candidate.confirmedFlag = false;
    } else if (matchedRule.requiresManualConfirmation) {
      reasons.push('奖励规则要求人工确认');
      candidate.confirmedFlag = false;
    }

    candidate.remark = this.joinRemarkReasons(reasons);
    candidate.normalizedPayload = {
      ...candidate.normalizedPayload,
      matchedRule: matchedRule
        ? {
            id: matchedRule.id,
            ruleCode: matchedRule.ruleCode,
            ruleName: matchedRule.ruleName,
          }
        : null,
      derivedTags: Array.from(tags),
    };

    return candidate;
  }

  private async upsertBusinessStatTag(input: TagCandidateInput) {
    const existing = await this.businessStatTagRepository.findOne({
      where: {
        sourceSystem: input.sourceSystem,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        tagCode: input.tagCode,
        businessDomain: input.businessDomain,
      },
    });

    const payload = {
      tagCode: input.tagCode,
      sourceSystem: input.sourceSystem,
      sourceTable: input.sourceTable,
      sourceId: input.sourceId,
      sourceOrderNo: input.sourceOrderNo ?? null,
      businessDomain: input.businessDomain,
      merchantId: input.merchantId ?? null,
      storeId: input.storeId ?? null,
      responsibleEmployeeId: input.responsibleEmployeeId ?? null,
      customerId: input.customerId ?? null,
      vehicleType: input.vehicleType ?? null,
      insuranceFlag: input.insuranceFlag ?? false,
      occurredAt: input.occurredAt,
      periodKey: input.periodKey,
      confirmedFlag: input.confirmedFlag ?? false,
      remark: input.remark ?? null,
      normalizedPayload: input.normalizedPayload,
    };

    if (existing) {
      Object.assign(existing, payload);
      await this.businessStatTagRepository.save(existing);
      return 'updated' as const;
    }

    await this.businessStatTagRepository.save(this.businessStatTagRepository.create(payload));
    return 'created' as const;
  }

  private async upsertRewardEvent(input: RewardEventCandidateInput) {
    const existing = await this.rewardEventRepository.findOne({
      where: {
        sourceSystem: input.sourceSystem,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        eventType: input.eventType,
      },
    });

    const payload = {
      eventType: input.eventType,
      sourceSystem: input.sourceSystem,
      sourceTable: input.sourceTable,
      sourceId: input.sourceId,
      sourceOrderNo: input.sourceOrderNo ?? null,
      businessDomain: input.businessDomain,
      merchantId: input.merchantId ?? null,
      storeId: input.storeId ?? null,
      responsibleEmployeeId: input.responsibleEmployeeId ?? null,
      customerId: input.customerId ?? null,
      vehicleType: input.vehicleType ?? null,
      insuranceFlag: input.insuranceFlag ?? false,
      amountStandard: input.amountStandard ? normalizeMoney(input.amountStandard) : null,
      quantityStandard: input.quantityStandard ? normalizeQuantity(input.quantityStandard) : null,
      occurredAt: input.occurredAt,
      periodKey: input.periodKey,
      confirmedFlag: input.confirmedFlag ?? false,
      ignoredFlag: input.ignoredFlag ?? false,
      remark: input.remark ?? null,
      normalizedPayload: input.normalizedPayload,
    };

    if (existing) {
      existing.sourceOrderNo = payload.sourceOrderNo;
      existing.businessDomain = payload.businessDomain;
      existing.merchantId = payload.merchantId;
      existing.storeId = payload.storeId;
      existing.responsibleEmployeeId = payload.responsibleEmployeeId;
      existing.customerId = payload.customerId;
      existing.vehicleType = payload.vehicleType;
      existing.insuranceFlag = payload.insuranceFlag;
      existing.amountStandard = payload.amountStandard;
      existing.quantityStandard = payload.quantityStandard;
      existing.occurredAt = payload.occurredAt;
      existing.periodKey = payload.periodKey;
      const preserveManualConfirm =
        existing.handlingAction === PerformanceHandlingAction.CONFIRM ||
        existing.handlingAction === PerformanceHandlingAction.REBIND;
      const preserveManualIgnore =
        existing.handlingAction === PerformanceHandlingAction.IGNORE && existing.ignoredFlag;

      if (preserveManualIgnore) {
        existing.confirmedFlag = false;
        existing.ignoredFlag = true;
      } else if (preserveManualConfirm && existing.confirmedFlag) {
        existing.confirmedFlag = true;
        existing.ignoredFlag = false;
      } else {
        existing.confirmedFlag = payload.confirmedFlag;
        existing.ignoredFlag = payload.ignoredFlag;
      }
      existing.remark = payload.remark;
      existing.normalizedPayload = payload.normalizedPayload;
      await this.rewardEventRepository.save(existing);
      return 'updated' as const;
    }

    await this.rewardEventRepository.save(this.rewardEventRepository.create(payload));
    return 'created' as const;
  }

  private async upsertBusinessStatSummary(accumulator: SummaryAccumulator) {
    const summaryKey = this.buildSummaryKey(accumulator);
    const existing = await this.businessStatSummaryRepository.findOne({
      where: { summaryKey },
    });

    const payload = {
      summaryKey,
      summaryDomain: accumulator.summaryDomain,
      periodKey: accumulator.periodKey,
      merchantId: accumulator.merchantId,
      storeId: accumulator.storeId,
      responsibleEmployeeId: accumulator.responsibleEmployeeId,
      customerId: accumulator.customerId,
      tagCount: accumulator.tagCount,
      rewardEventCount: accumulator.rewardEventCount,
      confirmedRewardEventCount: accumulator.confirmedRewardEventCount,
      pendingRewardEventCount: accumulator.pendingRewardEventCount,
      amountTotal: accumulator.amountTotal,
      quantityTotal: accumulator.quantityTotal,
      normalizedPayload: {
        ...accumulator.normalizedPayload,
        sourceTables: Array.from(new Set(accumulator.normalizedPayload.sourceTables)),
      },
    };

    if (existing) {
      existing.summaryDomain = payload.summaryDomain;
      existing.periodKey = payload.periodKey;
      existing.merchantId = payload.merchantId;
      existing.storeId = payload.storeId;
      existing.responsibleEmployeeId = payload.responsibleEmployeeId;
      existing.customerId = payload.customerId;
      existing.tagCount = payload.tagCount;
      existing.rewardEventCount = payload.rewardEventCount;
      existing.confirmedRewardEventCount = payload.confirmedRewardEventCount;
      existing.pendingRewardEventCount = payload.pendingRewardEventCount;
      existing.amountTotal = payload.amountTotal;
      existing.quantityTotal = payload.quantityTotal;
      existing.normalizedPayload = payload.normalizedPayload;
      await this.businessStatSummaryRepository.save(existing);
      return 'updated' as const;
    }

    await this.businessStatSummaryRepository.save(
      this.businessStatSummaryRepository.create({
        ...payload,
        confirmedFlag: false,
      }),
    );
    return 'created' as const;
  }

  private async loadBindingContext(): Promise<BindingContext> {
    const [bindings, employees] = await Promise.all([
      this.employeeSourceBindingRepository.find({
        where: { isActive: true },
        relations: { employee: true },
      }),
      this.employeeRepository.find({
        where: { status: 1 },
      }),
    ]);

    return {
      bindings: new Map(
        bindings.map((binding) => [
          this.buildBindingKey(
            binding.sourceSystem,
            binding.sourceTable,
            binding.sourceId,
            binding.bindingType,
          ),
          binding,
        ]),
      ),
      employeeByLinkedUserId: new Map(
        employees
          .filter((item) => item.linkedUserId !== null)
          .map((item) => [item.linkedUserId as number, item]),
      ),
      employeeByMobile: this.buildEmployeeByMobileMap(employees),
    };
  }

  private buildAbcBindingCandidates(
    sourceMerchantId: string | null | undefined,
    sourceUserId: string | null | undefined,
  ): BindingCandidate[] {
    return [
      {
        sourceSystem: 'ABC',
        sourceTable: 'merchant_account',
        sourceId: sourceMerchantId,
        bindingType: 'merchant',
      },
      {
        sourceSystem: 'ABC',
        sourceTable: 'merchant',
        sourceId: sourceMerchantId,
        bindingType: 'merchant',
      },
      {
        sourceSystem: 'ABC',
        sourceTable: 'user',
        sourceId: sourceUserId,
        bindingType: 'user',
      },
    ];
  }

  private resolveEmployeeBinding(candidates: BindingCandidate[], context: BindingContext) {
    for (const candidate of candidates) {
      if (!candidate.sourceId) {
        continue;
      }

      const key = this.buildBindingKey(
        candidate.sourceSystem,
        candidate.sourceTable,
        candidate.sourceId,
        candidate.bindingType,
      );
      const exact = context.bindings.get(key);
      if (exact) {
        return { employeeId: exact.employeeId, bindingKey: key };
      }

      if (candidate.bindingType === 'mobile') {
        const normalizedMobile = normalizeMainlandMobile(candidate.sourceId);
        if (normalizedMobile) {
          const employee = context.employeeByMobile.get(normalizedMobile);
          if (employee) {
            return { employeeId: employee.id, bindingKey: `fallback:mobile:${normalizedMobile}` };
          }
        }
      }

      if (
        candidate.sourceSystem === 'STARK' &&
        candidate.sourceTable === 'users' &&
        /^\d+$/.test(candidate.sourceId)
      ) {
        const employee = context.employeeByLinkedUserId.get(Number(candidate.sourceId));
        if (employee) {
          return { employeeId: employee.id, bindingKey: `fallback:${candidate.sourceId}` };
        }
      }
    }

    return {
      employeeId: null,
      bindingKey: null,
    };
  }

  private buildRemarkReasons(input: {
    employeeId: number | null;
    sourceMappingConfirmed?: boolean;
    sourceNotes?: string | null;
  }) {
    const reasons: string[] = [];
    if (!input.employeeId) reasons.push('未绑定员工');
    if (input.sourceMappingConfirmed === false) reasons.push('来源映射未确认');
    if (input.sourceNotes?.trim()) reasons.push(input.sourceNotes.trim());
    return Array.from(new Set(reasons));
  }

  private joinRemarkReasons(reasons: string[]) {
    return reasons.length > 0 ? reasons.join('；') : null;
  }

  private normalizeRewardRuleInput(
    dto: Partial<CreateRewardEventRuleDto>,
    partial = false,
  ): Partial<RewardEventRule> {
    const result: Partial<RewardEventRule> = {};

    if (dto.ruleCode !== undefined) result.ruleCode = dto.ruleCode.trim();
    if (dto.ruleName !== undefined) result.ruleName = dto.ruleName.trim();
    if (dto.eventType !== undefined) {
      this.assertEnumValue(RewardEventType, dto.eventType, '奖励事件类型');
      result.eventType = dto.eventType as RewardEventType;
    }
    if (dto.businessDomain !== undefined) {
      this.assertEnumValue(BusinessStatDomain, dto.businessDomain, '业务域');
      result.businessDomain = dto.businessDomain as BusinessStatDomain;
    }
    if (dto.requiredTagCode !== undefined) {
      if (dto.requiredTagCode === null || dto.requiredTagCode === '') {
        result.requiredTagCode = null;
      } else {
        this.assertEnumValue(BusinessStatTagCode, dto.requiredTagCode, '统计标签');
        result.requiredTagCode = dto.requiredTagCode as BusinessStatTagCode;
      }
    }
    if (dto.vehicleType !== undefined) result.vehicleType = dto.vehicleType?.trim() || null;
    if (dto.insuranceFlag !== undefined) result.insuranceFlag = dto.insuranceFlag;
    if (dto.rewardEnabled !== undefined) result.rewardEnabled = dto.rewardEnabled;
    if (dto.requiresManualConfirmation !== undefined) {
      result.requiresManualConfirmation = dto.requiresManualConfirmation;
    }
    if (dto.defaultWeight !== undefined) result.defaultWeight = normalizeQuantity(dto.defaultWeight);
    if (dto.defaultCoefficient !== undefined) {
      result.defaultCoefficient = normalizeQuantity(dto.defaultCoefficient);
    }
    if (dto.isActive !== undefined) result.isActive = dto.isActive;
    if (dto.remark !== undefined) result.remark = dto.remark?.trim() || null;

    if (!partial) {
      const requiredFields: Array<keyof RewardEventRule> = [
        'ruleCode',
        'ruleName',
        'eventType',
        'businessDomain',
        'rewardEnabled',
        'requiresManualConfirmation',
        'isActive',
      ];
      for (const field of requiredFields) {
        if (result[field] === undefined) {
          throw new BadRequestException(`奖励规则字段缺失: ${field}`);
        }
      }
    }

    return result;
  }

  private matchRewardRule(
    rule: RewardEventRule,
    candidate: RewardEventCandidateInput,
    tags: Set<BusinessStatTagCode>,
  ) {
    if (!rule.isActive) return false;
    if (rule.eventType !== candidate.eventType) return false;
    if (rule.businessDomain !== candidate.businessDomain) return false;
    if (rule.requiredTagCode && !tags.has(rule.requiredTagCode)) return false;
    if (rule.vehicleType && rule.vehicleType !== (candidate.vehicleType ?? null)) return false;
    if (rule.insuranceFlag !== null && rule.insuranceFlag !== (candidate.insuranceFlag ?? false)) {
      return false;
    }
    return true;
  }

  private async loadTagCodeMap(periodKey?: string) {
    const tags = await this.businessStatTagRepository.find(periodKey ? { where: { periodKey } } : {});
    const map = new Map<string, Set<BusinessStatTagCode>>();
    for (const tag of tags) {
      const key = this.buildSourceKey(tag.sourceSystem, tag.sourceTable, tag.sourceId);
      const current = map.get(key) ?? new Set<BusinessStatTagCode>();
      current.add(tag.tagCode);
      map.set(key, current);
    }
    return map;
  }

  private resolveStatTagSourceTables(dto: GenerateStatTagsDto) {
    if (dto.sourceTables?.length) return dto.sourceTables;
    if (dto.scope === 'stark') return ['work_orders'];
    if (dto.scope === 'abc') return ['abc_sync_orders', 'abc_sync_funds', 'abc_sync_cards'];
    return DEFAULT_TAG_SOURCE_TABLES;
  }

  private resolveRewardSourceTables(dto: GenerateRewardEventsDto) {
    if (dto.sourceTables?.length) return dto.sourceTables;
    return DEFAULT_REWARD_SOURCE_TABLES;
  }

  private async clearExistingStatTagsByScope(
    dto: GenerateStatTagsDto,
    sourceTables: string[],
  ) {
    const businessDomains = this.resolveBusinessDomainsForStatTags(sourceTables);
    if (!businessDomains.length) return;

    const qb = this.businessStatTagRepository
      .createQueryBuilder()
      .delete()
      .from(BusinessStatTag)
      .where('businessDomain IN (:...businessDomains)', { businessDomains });

    if (dto.periodKey) {
      qb.andWhere('periodKey = :periodKey', { periodKey: dto.periodKey });
    }

    await qb.execute();
  }

  private async clearExistingStatTagsByCandidates(candidates: TagCandidateInput[]) {
    if (!candidates.length) return;

    const uniqueKeys = new Set<string>();

    for (const candidate of candidates) {
      const uniqueKey = this.buildSourceKey(candidate.sourceSystem, candidate.sourceTable, candidate.sourceId);
      const tagKey = `${uniqueKey}::${candidate.tagCode}::${candidate.businessDomain}`;
      if (uniqueKeys.has(tagKey)) {
        continue;
      }
      uniqueKeys.add(tagKey);

      await this.businessStatTagRepository.delete({
        sourceSystem: candidate.sourceSystem,
        sourceTable: candidate.sourceTable,
        sourceId: candidate.sourceId,
        tagCode: candidate.tagCode,
        businessDomain: candidate.businessDomain,
      });
    }
  }

  private async clearExistingRewardEventsByCandidates(candidates: RewardEventCandidateInput[]) {
    if (!candidates.length) return;

    const uniqueKeys = new Set<string>();

    for (const candidate of candidates) {
      const uniqueKey = `${this.buildSourceKey(candidate.sourceSystem, candidate.sourceTable, candidate.sourceId)}::${candidate.eventType}`;
      if (uniqueKeys.has(uniqueKey)) {
        continue;
      }
      uniqueKeys.add(uniqueKey);

      await this.rewardEventRepository.delete({
        sourceSystem: candidate.sourceSystem,
        sourceTable: candidate.sourceTable,
        sourceId: candidate.sourceId,
        eventType: candidate.eventType,
      });
    }
  }

  private async clearExistingRewardEventsByScope(
    dto: GenerateRewardEventsDto,
    sourceTables: string[],
  ) {
    const businessDomains = this.resolveBusinessDomainsForRewardEvents(sourceTables);
    if (!businessDomains.length) return;

    const qb = this.rewardEventRepository
      .createQueryBuilder()
      .delete()
      .from(RewardEvent)
      .where('businessDomain IN (:...businessDomains)', { businessDomains });

    if (dto.periodKey) {
      qb.andWhere('periodKey = :periodKey', { periodKey: dto.periodKey });
    }

    qb.andWhere('handlingAction IS NULL');

    await qb.execute();
  }

  private async clearExistingBusinessStatSummariesByAccumulators(
    accumulators: Map<string, SummaryAccumulator>,
  ) {
    if (!accumulators.size) return;

    const summaryKeys = Array.from(accumulators.values()).map((accumulator) =>
      this.buildSummaryKey(accumulator),
    );

    await this.businessStatSummaryRepository
      .createQueryBuilder()
      .delete()
      .from(BusinessStatSummary)
      .where('summaryKey IN (:...summaryKeys)', { summaryKeys })
      .execute();
  }

  private async clearExistingBusinessStatSummariesByScope(
    dto: GenerateBusinessStatSummariesDto,
    summaryDomains: Set<string>,
  ) {
    const qb = this.businessStatSummaryRepository
      .createQueryBuilder()
      .delete()
      .from(BusinessStatSummary)
      .where('summaryDomain IN (:...summaryDomains)', {
        summaryDomains: Array.from(summaryDomains),
      });

    if (dto.periodKey) {
      qb.andWhere('periodKey = :periodKey', { periodKey: dto.periodKey });
    }

    await qb.execute();
  }

  private resolveVehicleTag(input: string) {
    if (this.matchesKeywords(input, PUBLIC_VEHICLE_KEYWORDS)) {
      return BusinessStatTagCode.PUBLIC_VEHICLE;
    }
    if (this.matchesKeywords(input, PRIVATE_VEHICLE_KEYWORDS)) {
      return BusinessStatTagCode.PRIVATE_VEHICLE;
    }
    return null;
  }

  private matchesKeywords(input: string | null | undefined, keywords: string[]) {
    const normalized = (input ?? '').toLowerCase();
    return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
  }

  private resolveVehicleTypeForTag(tagCode: BusinessStatTagCode | null) {
    if (tagCode === BusinessStatTagCode.PUBLIC_VEHICLE) {
      return 'public';
    }
    if (tagCode === BusinessStatTagCode.PRIVATE_VEHICLE) {
      return 'private';
    }
    return null;
  }

  private resolveVehicleTypeFromTags(tags: Set<BusinessStatTagCode>) {
    if (tags.has(BusinessStatTagCode.PUBLIC_VEHICLE)) {
      return 'public';
    }
    if (tags.has(BusinessStatTagCode.PRIVATE_VEHICLE)) {
      return 'private';
    }
    return null;
  }

  private isAWashCardSaleOrder(record: AbcSyncOrder) {
    if (record.sourceTable !== 'goods_group_order') {
      return false;
    }

    const goodsGroupId =
      this.readNestedString(record.normalizedPayload, 'sourceMeta', 'goodsGroupId') ??
      this.readNestedString(record.normalizedPayload, 'rawStatuses', 'goods_group_id');

    return goodsGroupId ? A_WASH_CARD_GROUP_IDS.includes(goodsGroupId) : false;
  }

  private resolveClassificationPendingReason(record: AbcSyncOrder, isAWashCardSale: boolean) {
    if (isAWashCardSale) {
      return A_WASH_CARD_CLASSIFICATION_PENDING_REASON;
    }

    return `\u6765\u6e90 ${record.sourceTable} \u8f66\u8f86\u7c7b\u578b\u8bc1\u636e\u4e0d\u8db3\uff0c\u6682\u4e0d\u5f3a\u884c\u5f52\u5165\u79c1\u5bb6\u8f66/\u516c\u8f66/\u4fdd\u9669\u7406\u8d54`;
  }

  private normalizeAbcMerchantId(
    sourceMerchantId: string | number | null | undefined,
    sourceTable: string,
  ) {
    const merchantId = this.parseOptionalInt(sourceMerchantId);
    if (sourceTable.startsWith('user_shopping_card') && (merchantId === null || merchantId === 0)) {
      return null;
    }
    return merchantId;
  }

  private hasUnknownCardMerchant(
    sourceMerchantId: string | number | null | undefined,
    sourceTable: string,
  ) {
    const merchantId = this.parseOptionalInt(sourceMerchantId);
    return sourceTable.startsWith('user_shopping_card') && (merchantId === null || merchantId === 0);
  }

  private resolveBusinessDomainsForStatTags(sourceTables: string[]) {
    const domains = new Set<BusinessStatDomain>();
    if (sourceTables.includes('work_orders')) {
      domains.add(BusinessStatDomain.STARK_WORK_ORDER);
    }
    if (sourceTables.includes('abc_sync_orders')) {
      domains.add(BusinessStatDomain.ABC_ORDER);
    }
    if (sourceTables.includes('abc_sync_funds')) {
      domains.add(BusinessStatDomain.ABC_FUND);
    }
    if (sourceTables.includes('abc_sync_cards')) {
      domains.add(BusinessStatDomain.ABC_CARD);
    }
    return Array.from(domains);
  }

  private resolveBusinessDomainsForRewardEvents(sourceTables: string[]) {
    const domains = new Set<BusinessStatDomain>();
    if (sourceTables.includes('work_orders')) {
      domains.add(BusinessStatDomain.STARK_WORK_ORDER);
    }
    if (sourceTables.includes('abc_sync_orders')) {
      domains.add(BusinessStatDomain.ABC_ORDER);
    }
    if (sourceTables.includes('abc_sync_cards')) {
      domains.add(BusinessStatDomain.ABC_CARD);
    }
    return Array.from(domains);
  }

  private resolveWorkOrderOccurredAt(workOrder: WorkOrder) {
    return workOrder.updatedAt ?? workOrder.createdAt;
  }

  private resolveSummaryDomainForTag(tagCode: BusinessStatTagCode): RewardSummaryDomain {
    switch (tagCode) {
      case BusinessStatTagCode.A_WASH_CARD_SALE:
        return RewardSummaryDomain.ABC_OVERALL;
      case BusinessStatTagCode.PUBLIC_VEHICLE:
        return RewardSummaryDomain.PUBLIC_VEHICLE;
      case BusinessStatTagCode.PRIVATE_VEHICLE:
        return RewardSummaryDomain.PRIVATE_VEHICLE;
      case BusinessStatTagCode.INSURANCE_CLAIM:
        return RewardSummaryDomain.INSURANCE_CLAIM;
      default:
        return RewardSummaryDomain.ABC_OVERALL;
    }
  }

  private resolveSummaryDomainForRewardEvent(event: RewardEvent) {
    switch (event.eventType) {
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

  private getSummaryAccumulator(
    accumulators: Map<string, SummaryAccumulator>,
    identity: Omit<
      SummaryAccumulator,
      | 'tagCount'
      | 'rewardEventCount'
      | 'confirmedRewardEventCount'
      | 'pendingRewardEventCount'
      | 'amountTotal'
      | 'quantityTotal'
      | 'normalizedPayload'
    >,
  ) {
    const key = this.buildSummaryKey(identity);
    let accumulator = accumulators.get(key);
    if (!accumulator) {
      accumulator = {
        ...identity,
        tagCount: 0,
        rewardEventCount: 0,
        confirmedRewardEventCount: 0,
        pendingRewardEventCount: 0,
        amountTotal: '0.00',
        quantityTotal: '0.00',
        normalizedPayload: {
          tagIds: [],
          rewardEventIds: [],
          sourceTables: [],
        },
      };
      accumulators.set(key, accumulator);
    }
    return accumulator;
  }

  private buildSummaryKey(input: {
    summaryDomain: RewardSummaryDomain;
    periodKey: string;
    merchantId: number | null;
    storeId: number | null;
    responsibleEmployeeId: number | null;
    customerId: string | null;
  }) {
    return [
      input.summaryDomain,
      input.periodKey,
      input.merchantId ?? 'none',
      input.storeId ?? 'none',
      input.responsibleEmployeeId ?? 'none',
      input.customerId ?? 'none',
    ].join('::');
  }

  private buildSourceKey(sourceSystem: string, sourceTable: string, sourceId: string) {
    return [sourceSystem.toLowerCase(), sourceTable, sourceId].join('::');
  }

  private buildBindingKey(
    sourceSystem: string,
    sourceTable: string,
    sourceId: string,
    bindingType: string,
  ) {
    return [sourceSystem, sourceTable, sourceId, bindingType].join('|');
  }

  private buildEmployeeByMobileMap(employees: Employee[]) {
    const buckets = new Map<string, Employee | null>();
    for (const employee of employees) {
      const mobile = normalizeMainlandMobile(employee.mobile);
      if (!mobile) {
        continue;
      }

      const current = buckets.get(mobile);
      if (!current) {
        buckets.set(mobile, employee);
        continue;
      }

      if (current.id !== employee.id) {
        buckets.set(mobile, null);
      }
    }

    return new Map(
      Array.from(buckets.entries()).filter(
        (entry): entry is [string, Employee] => entry[1] !== null,
      ),
    );
  }

  private normalizeSortOrder(
    sortOrder: 'asc' | 'desc' | 'ASC' | 'DESC' | undefined,
    fallback: 'ASC' | 'DESC',
  ) {
    if (!sortOrder) return fallback;
    return sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }

  private resolvePeriodKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private parseOptionalInt(value: string | number | null | undefined) {
    if (value === undefined || value === null || value === '') return null;
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
  }

  private assertEnumValue(enumObject: Record<string, string>, value: string, label: string) {
    if (!Object.values(enumObject).includes(value)) {
      throw new BadRequestException(`${label}值非法`);
    }
  }

  private async ensureEmployeeExists(employeeId: number) {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId, status: 1 },
    });
    if (!employee) {
      throw new NotFoundException('员工不存在或已禁用');
    }
    return employee;
  }

  private async findRewardEventEntity(id: number) {
    const record = await this.rewardEventRepository.findOne({
      where: { id },
      relations: {
        responsibleEmployee: true,
        handledByUser: true,
      },
    });
    if (!record) throw new NotFoundException('奖励事件不存在');
    return record;
  }

  private buildSourceRecordKey(sourceTable: string, sourceId: string) {
    return `${sourceTable}::${sourceId}`;
  }

  private async buildSummaryVerificationContextMap(
    summaries: BusinessStatSummary[],
    currentUser: CurrentUser,
    mode: VerificationContextViewMode,
  ) {
    const result = new Map<number, SummaryVerificationContext | null>();
    if (!summaries.length) {
      return result;
    }

    const tagIds = [
      ...new Set(summaries.flatMap((summary) => this.readNumberArray(summary.normalizedPayload?.tagIds))),
    ];
    const rewardEventIds = [
      ...new Set(
        summaries.flatMap((summary) => this.readNumberArray(summary.normalizedPayload?.rewardEventIds)),
      ),
    ];

    const [tags, rewardEvents] = await Promise.all([
      tagIds.length
        ? this.businessStatTagRepository.find({
            where: { id: In(tagIds) },
            relations: { responsibleEmployee: true },
          })
        : Promise.resolve([]),
      rewardEventIds.length
        ? this.rewardEventRepository.find({
            where: { id: In(rewardEventIds) },
            relations: { responsibleEmployee: true, handledByUser: true },
          })
        : Promise.resolve([]),
    ]);

    const tagMap = new Map(tags.map((item) => [item.id, item]));
    const rewardEventMap = new Map(rewardEvents.map((item) => [item.id, item]));
    const recordContextMap = await this.buildRecordVerificationContextMap(
      [...tags, ...rewardEvents],
      currentUser,
      mode,
    );
    const formalBenefitContextMap = await this.loadFormalEmployeeBenefitSummaryContextMap(summaries);
    const payrollDecisionContextMap = await this.loadSummaryPayrollDecisionContextMap(summaries);
    const legacyWelfareCandidateRecordKeySet = await this.loadLegacyWelfareCandidateRecordKeySet([
      ...tags,
      ...rewardEvents,
    ]);

    for (const summary of summaries) {
      const summaryTags = this.readNumberArray(summary.normalizedPayload?.tagIds)
        .map((id) => tagMap.get(id))
        .filter((item): item is BusinessStatTag => Boolean(item));
      const summaryRewardEvents = this.readNumberArray(summary.normalizedPayload?.rewardEventIds)
        .map((id) => rewardEventMap.get(id))
        .filter((item): item is RewardEvent => Boolean(item));

      result.set(
        summary.id,
        this.buildSummaryVerificationContext(
          summary,
          [...summaryTags, ...summaryRewardEvents],
          recordContextMap,
          currentUser,
          mode,
          formalBenefitContextMap.get(summary.id) ?? null,
          payrollDecisionContextMap.get(summary.id) ?? null,
          legacyWelfareCandidateRecordKeySet,
        ),
      );
    }

    return result;
  }

  private async buildRecordVerificationContextMap(
    records: Array<BusinessStatTag | RewardEvent>,
    currentUser: CurrentUser,
    mode: VerificationContextViewMode,
  ) {
    const refs = new Map<string, VerificationSourceRecord>();

    for (const record of records) {
      const ref: VerificationSourceRecord = {
        sourceSystem: record.sourceSystem,
        sourceTable: record.sourceTable,
        sourceId: record.sourceId,
        sourceOrderNo: record.sourceOrderNo,
        customerId: record.customerId,
        occurredAt: record.occurredAt,
        amountStandard: 'amountStandard' in record ? record.amountStandard : null,
        normalizedPayload: record.normalizedPayload,
      };
      refs.set(this.buildSourceRecordKey(ref.sourceTable, ref.sourceId), ref);
    }

    if (!refs.size) {
      return new Map<string, VerificationSourceContext>();
    }

    const refList = Array.from(refs.values());
    const [rawOrderMap, rawCardMap, rawTransactionMap, workOrderMap] = await Promise.all([
      this.loadAbcRawOrderMap(refList),
      this.loadAbcRawCardMap(refList),
      this.loadAbcRawTransactionMap(refList),
      this.loadWorkOrderMap(refList),
    ]);
    const [abcSourceGoodsGroupOrderProfileMap, abcSourceUserShoppingCardProfileMap] = await Promise.all([
      this.loadAbcSourceGoodsGroupOrderProfileMap(refList),
      this.loadAbcSourceUserShoppingCardProfileMap(refList),
    ]);
    const abcSourceCustomerProfileMap = await this.loadAbcSourceCustomerProfileMap(
      refList,
      rawOrderMap,
      rawTransactionMap,
      abcSourceGoodsGroupOrderProfileMap,
      abcSourceUserShoppingCardProfileMap,
    );
    const externalCardSalesEvidenceMap = await this.loadExternalCardSalesEvidenceMap(
      refList,
      rawOrderMap,
      abcSourceCustomerProfileMap,
      abcSourceGoodsGroupOrderProfileMap,
    );

    const result = new Map<string, VerificationSourceContext>();
    for (const ref of refList) {
      const key = this.buildSourceRecordKey(ref.sourceTable, ref.sourceId);
      result.set(
        key,
        this.buildVerificationSourceContext(
          ref,
          rawOrderMap,
          rawCardMap,
          rawTransactionMap,
          workOrderMap,
          abcSourceCustomerProfileMap,
          abcSourceGoodsGroupOrderProfileMap,
          abcSourceUserShoppingCardProfileMap,
          externalCardSalesEvidenceMap,
          currentUser,
          mode,
        ),
      );
    }

    return result;
  }

  private async buildCustomerIdentificationBindingContextMap(
    records: Array<BusinessStatTag | RewardEvent>,
    recordContextMap: Map<string, VerificationSourceContext>,
  ) {
    if (!records.length) {
      return new Map<string, CustomerIdentificationBindingContext>();
    }

    const sourceSystems = Array.from(new Set(records.map((item) => item.sourceSystem)));
    const sourceTables = Array.from(new Set(records.map((item) => item.sourceTable)));
    const sourceIds = Array.from(new Set(records.map((item) => item.sourceId)));

    const existingBindings = await this.customerIdentificationBindingRepository.find({
      where: {
        sourceSystem: In(sourceSystems),
        sourceTable: In(sourceTables),
        sourceId: In(sourceIds),
      },
      relations: {
        boundByUser: true,
      },
    });

    const existingBindingMap = new Map(
      existingBindings.map((item) => [
        this.buildSourceRecordKey(item.sourceTable, item.sourceId),
        item,
      ]),
    );

    const result = new Map<string, CustomerIdentificationBindingContext>();
    for (const record of records) {
      const sourceRecordKey = this.buildSourceRecordKey(record.sourceTable, record.sourceId);
      result.set(
        sourceRecordKey,
        this.buildCustomerIdentificationBindingContext(
          record,
          recordContextMap.get(sourceRecordKey) ?? null,
          existingBindingMap.get(sourceRecordKey) ?? null,
        ),
      );
    }

    return result;
  }

  private buildCustomerIdentificationBindingContext(
    record: BusinessStatTag | RewardEvent,
    verificationContext: VerificationSourceContext | null,
    existingBinding: CustomerIdentificationBinding | null,
  ): CustomerIdentificationBindingContext {
    const sourceCustomerName =
      existingBinding?.sourceCustomerName ?? verificationContext?.sourceCustomerName ?? null;
    const sourceCustomerMobile =
      existingBinding?.sourceCustomerMobile ??
      normalizeMainlandMobile(verificationContext?.sourceCustomerMobile ?? null) ??
      null;
    const sourceCarPlate =
      existingBinding?.sourceCarPlate ?? verificationContext?.sourceCarPlate ?? null;

    const autoMatchedCandidate =
      sourceCustomerMobile && record.customerId
        ? {
            matchedCustomerId: record.customerId,
            matchedCustomerName: sourceCustomerName,
            matchedCustomerMobile: sourceCustomerMobile,
            bindingStatus: 'auto_matched' as const,
            bindingConfidence: '0.9500',
            bindingRemark: '已识别客户手机号，且来源记录自带稳定 customerId，可作为自动候选',
          }
        : null;

    const bindingStatus =
      (existingBinding?.bindingStatus as CustomerIdentificationBindingContext['bindingStatus'] | null) ??
      (autoMatchedCandidate?.bindingStatus ?? 'manual_pending');
    const matchedCustomerId =
      existingBinding?.matchedCustomerId ??
      autoMatchedCandidate?.matchedCustomerId ??
      null;
    const matchedCustomerName =
      existingBinding?.matchedCustomerName ??
      autoMatchedCandidate?.matchedCustomerName ??
      null;
    const matchedCustomerMobile =
      existingBinding?.matchedCustomerMobile ??
      autoMatchedCandidate?.matchedCustomerMobile ??
      null;
    const bindingConfidence =
      existingBinding?.bindingConfidence ??
      autoMatchedCandidate?.bindingConfidence ??
      (sourceCustomerMobile ? '0.7000' : null);
    const bindingRemark =
      existingBinding?.bindingRemark ??
      autoMatchedCandidate?.bindingRemark ??
      this.buildDefaultCustomerBindingRemark(sourceCustomerMobile, sourceCustomerName);

    const performanceReadiness = this.resolvePerformanceReadiness({
      sourceCustomerMobile,
      bindingStatus,
      responsibleEmployeeId: record.responsibleEmployeeId,
      confirmedFlag: record.confirmedFlag,
    });

    return {
      sourceCustomerName,
      sourceCustomerMobile,
      sourceCarPlate,
      matchedCustomerId,
      matchedCustomerName,
      matchedCustomerMobile,
      bindingStatus,
      bindingConfidence,
      boundBy: existingBinding?.boundBy ?? null,
      boundAt: existingBinding?.boundAt ?? null,
      bindingRemark,
      performanceReadyFlag:
        existingBinding?.performanceReadyFlag ?? performanceReadiness.performanceReadyFlag,
      performanceBlockReason:
        (existingBinding?.performanceBlockReason as CustomerIdentificationBindingContext['performanceBlockReason']) ??
        performanceReadiness.performanceBlockReason,
      performanceDecisionReason:
        existingBinding?.performanceDecisionReason ?? performanceReadiness.performanceDecisionReason,
      taskExecutionCount: existingBinding?.taskExecutionCount ?? null,
      taskOnTimeCount: existingBinding?.taskOnTimeCount ?? null,
      taskConfirmedCount: existingBinding?.taskConfirmedCount ?? null,
      taskRewardEligibleFlag: existingBinding?.taskRewardEligibleFlag ?? null,
      aiTaskScore: existingBinding?.aiTaskScore ?? null,
      aiTaskRemark: existingBinding?.aiTaskRemark ?? null,
    };
  }

  private buildDefaultCustomerBindingRemark(
    sourceCustomerMobile: string | null,
    sourceCustomerName: string | null,
  ) {
    if (!sourceCustomerMobile) {
      return '缺少客户手机号，无法形成稳定主识别键，需人工补充';
    }
    if (!sourceCustomerName) {
      return '已识别客户手机号，但缺少稳定客户姓名，仅保留手机号候选';
    }
    return '已识别客户手机号和客户姓名，但仍保留人工绑定入口';
  }

  private resolvePerformanceReadiness(input: {
    sourceCustomerMobile: string | null;
    bindingStatus: CustomerIdentificationBindingContext['bindingStatus'];
    responsibleEmployeeId: number | null;
    confirmedFlag: boolean;
  }) {
    if (!input.sourceCustomerMobile) {
      return {
        performanceReadyFlag: false,
        performanceBlockReason: 'missing_customer_mobile' as const,
        performanceDecisionReason: '缺少客户手机号，当前记录不能作为稳定绩效识别样本',
      };
    }

    if (input.bindingStatus === 'conflict') {
      return {
        performanceReadyFlag: false,
        performanceBlockReason: 'ambiguous_customer_match' as const,
        performanceDecisionReason: '同一来源记录存在冲突客户归属，需人工确认后再进入绩效识别',
      };
    }

    if (input.bindingStatus === 'manual_pending') {
      return {
        performanceReadyFlag: false,
        performanceBlockReason: 'missing_customer_binding' as const,
        performanceDecisionReason: '已识别客户手机号，但客户绑定尚未明确，先保留待人工确认',
      };
    }

    if (!input.responsibleEmployeeId) {
      return {
        performanceReadyFlag: false,
        performanceBlockReason: 'missing_employee_binding' as const,
        performanceDecisionReason: '客户已可识别，但责任员工尚未明确，不能直接进入绩效计算',
      };
    }

    if (!input.confirmedFlag) {
      return {
        performanceReadyFlag: false,
        performanceBlockReason: 'awaiting_manual_review' as const,
        performanceDecisionReason: '客户和员工识别已具备，但记录仍需人工确认后才能进入后续绩效流程',
      };
    }

    return {
      performanceReadyFlag: true,
      performanceBlockReason: null,
      performanceDecisionReason: '客户手机号、客户归属、责任员工和确认状态已满足绩效识别基础条件',
    };
  }

  private buildSummaryVerificationContext(
    summary: BusinessStatSummary,
    records: Array<BusinessStatTag | RewardEvent>,
    recordContextMap: Map<string, VerificationSourceContext>,
    currentUser: CurrentUser,
    mode: VerificationContextViewMode,
    formalBenefitContext: SummaryBenefitContext | null,
    payrollDecisionContext: SummaryPayrollDecisionContext | null,
    legacyWelfareCandidateRecordKeySet: Set<string>,
  ): SummaryVerificationContext | null {
    void currentUser;
    void mode;
    const contexts = records
      .map((record) => recordContextMap.get(this.buildSourceRecordKey(record.sourceTable, record.sourceId)))
      .filter((item): item is VerificationSourceContext => Boolean(item));

    if (!contexts.length && !formalBenefitContext) {
      return null;
    }

    const hasLegacyWelfareCandidate = records.some((record) =>
      legacyWelfareCandidateRecordKeySet.has(this.buildSourceRecordKey(record.sourceTable, record.sourceId)),
    );
    const anomaly = this.resolveSummaryAnomaly(summary, contexts);
    const primaryContext = this.pickPrimarySummaryContext(contexts);
    const businessCategory = this.resolveSummaryBusinessCategory(
      summary,
      contexts,
      anomaly.classification,
      formalBenefitContext,
      hasLegacyWelfareCandidate,
    );
    const summaryPaymentClassification = this.resolveSummaryPaymentClassification(contexts);
    const bCardStats = this.resolveSummaryBCardStats(
      contexts,
      businessCategory.category,
      formalBenefitContext,
      hasLegacyWelfareCandidate,
    );
    const bundleEvidence = this.resolveSummaryBundleEvidence(contexts, bCardStats);
    const welfareSourceType: SummaryVerificationContext['welfareSourceType'] = formalBenefitContext
      ? 'formal_employee_benefit'
      : hasLegacyWelfareCandidate
        ? 'legacy_welfare_candidate'
        : null;

    return {
      customerName:
        primaryContext?.customerName ?? this.summarizeVerificationValues(contexts.map((item) => item.customerName)),
      customerMobile:
        primaryContext?.customerMobile ??
        this.summarizeVerificationValues(contexts.map((item) => item.customerMobile)),
      carPlate:
        primaryContext?.carPlate ?? this.summarizeVerificationValues(contexts.map((item) => item.carPlate)),
      purchaseTime:
        primaryContext?.purchaseTime ?? this.summarizeVerificationDates(contexts.map((item) => item.purchaseTime)),
      sourceOrderNo:
        primaryContext?.sourceOrderNo ??
        this.summarizeVerificationValues(contexts.map((item) => item.sourceOrderNo)),
      sourceCustomerMobile:
        primaryContext?.sourceCustomerMobile ??
        this.summarizeVerificationValues(contexts.map((item) => item.sourceCustomerMobile)),
      sourceCustomerNameAlias:
        primaryContext?.sourceCustomerNameAlias ??
        this.summarizeVerificationValues(contexts.map((item) => item.sourceCustomerNameAlias)),
      matchedCustomerId:
        primaryContext?.matchedCustomerId ??
        this.summarizeVerificationValues(contexts.map((item) => item.matchedCustomerId)),
      matchedCustomerName:
        primaryContext?.matchedCustomerName ??
        this.summarizeVerificationValues(contexts.map((item) => item.matchedCustomerName)),
      matchedCustomerMobile:
        primaryContext?.matchedCustomerMobile ??
        this.summarizeVerificationValues(contexts.map((item) => item.matchedCustomerMobile)),
      matchedOrderId:
        primaryContext?.matchedOrderId ??
        this.summarizeVerificationValues(contexts.map((item) => item.matchedOrderId)),
      matchedOrderNo:
        primaryContext?.matchedOrderNo ??
        this.summarizeVerificationValues(contexts.map((item) => item.matchedOrderNo)),
      matchedSourceTable:
        primaryContext?.matchedSourceTable ??
        this.summarizeVerificationValues(contexts.map((item) => item.matchedSourceTable)),
      matchConfidence:
        primaryContext?.matchConfidence ??
        this.summarizeVerificationValues(contexts.map((item) => item.matchConfidence)),
      matchReason:
        primaryContext?.matchReason ??
        this.summarizeVerificationValues(contexts.map((item) => item.matchReason)),
      evidenceSummary:
        primaryContext?.evidenceSummary ??
        this.summarizeVerificationValues(contexts.map((item) => item.evidenceSummary)),
      packageName:
        primaryContext?.packageName ?? this.summarizeVerificationValues(contexts.map((item) => item.packageName)),
      merchantName:
        primaryContext?.merchantName ?? this.summarizeVerificationValues(contexts.map((item) => item.merchantName)),
      merchantContact:
        primaryContext?.merchantContact ??
        this.summarizeVerificationValues(contexts.map((item) => item.merchantContact)),
      sourceTable:
        primaryContext?.sourceTable ?? this.summarizeVerificationValues(contexts.map((item) => item.sourceTable)),
      sourceId: primaryContext?.sourceId ?? this.summarizeVerificationValues(contexts.map((item) => item.sourceId)),
      bCardIssuedAmount: bCardStats.issuedAmount,
      bCardConsumedAmount: bCardStats.consumedAmount,
      bCardRemainingAmount: bCardStats.remainingAmount,
      bCardIssueCount: bCardStats.issueCount,
      bCardConsumeCount: bCardStats.consumeCount,
      bCardSourceType: bCardStats.sourceType,
      bCardSourceReason: bCardStats.sourceReason,
      bundleEvidenceStrong: bundleEvidence.bundleEvidenceStrong,
      missingCItemSuspected: bundleEvidence.missingCItemSuspected,
      bundleInferenceReason: bundleEvidence.bundleInferenceReason,
      linkedBCardAmount: bundleEvidence.linkedBCardAmount,
      linkedBCardSourceType: bundleEvidence.linkedBCardSourceType,
      linkedPaidAAmount: bundleEvidence.linkedPaidAAmount,
      linkedBundleWindowDays: bundleEvidence.linkedBundleWindowDays,
      businessCategory: businessCategory.category,
      businessCategoryReason: businessCategory.reason,
      welfareSourceType,
      benefitIssueNo: formalBenefitContext?.issueNo ?? null,
      benefitPeriodKey: formalBenefitContext?.periodKey ?? null,
      benefitIssueType: formalBenefitContext?.issueType ?? null,
      benefitIssueStatus: formalBenefitContext?.issueStatus ?? null,
      benefitAmount: formalBenefitContext?.totalAmount ?? null,
      benefitValidityDays: formalBenefitContext?.validityDays ?? null,
      benefitConfirmedFlag: formalBenefitContext?.confirmedFlag ?? null,
      benefitIssuedFlag: formalBenefitContext?.issuedFlag ?? null,
      benefitNotifiedFlag: formalBenefitContext?.notifiedFlag ?? null,
      payrollDecision: payrollDecisionContext?.decision ?? null,
      payrollBlockReason: payrollDecisionContext?.blockReason ?? null,
      payrollDecisionReason: payrollDecisionContext?.decisionReason ?? null,
      paymentStatus: summaryPaymentClassification?.paymentStatus ?? null,
      isPaid: summaryPaymentClassification?.isPaid ?? null,
      settlementType: summaryPaymentClassification?.settlementType ?? null,
      isTestData: summaryPaymentClassification?.isTestData ?? null,
      sourceClassification: summaryPaymentClassification?.sourceClassification ?? null,
      reconciliationStatus: summaryPaymentClassification?.reconciliationStatus ?? null,
      reconciliationReason: summaryPaymentClassification?.reconciliationReason ?? null,
      anomalyClassification: anomaly.classification,
      anomalyReason: anomaly.reason,
    };
  }

  private async loadAbcRawOrderMap(records: VerificationSourceRecord[]) {
    const sourceTables = [
      ...new Set(records.map((item) => item.sourceTable).filter((sourceTable) => this.isOrderSourceTable(sourceTable))),
    ];
    if (!sourceTables.length) {
      return new Map<string, AbcRawOrder>();
    }

    const sourceTableSet = new Set<string>(sourceTables);

    const sourceIds = [
      ...new Set(records.filter((item) => sourceTableSet.has(item.sourceTable)).map((item) => item.sourceId)),
    ];

    const rows = await this.abcRawOrderRepository
      .createQueryBuilder('raw')
      .where('raw.sourceSystem = :sourceSystem', { sourceSystem: 'ABC' })
      .andWhere('raw.sourceTable IN (:...sourceTables)', { sourceTables })
      .andWhere('raw.sourceId IN (:...sourceIds)', { sourceIds })
      .getMany();

    return new Map(rows.map((row) => [this.buildSourceRecordKey(row.sourceTable, row.sourceId), row]));
  }

  private async loadAbcRawCardMap(records: VerificationSourceRecord[]) {
    const sourceTables = [
      ...new Set(records.map((item) => item.sourceTable).filter((sourceTable) => this.isCardSourceTable(sourceTable))),
    ];
    if (!sourceTables.length) {
      return new Map<string, AbcRawCard>();
    }

    const sourceTableSet = new Set<string>(sourceTables);

    const sourceIds = [
      ...new Set(records.filter((item) => sourceTableSet.has(item.sourceTable)).map((item) => item.sourceId)),
    ];

    const rows = await this.abcRawCardRepository
      .createQueryBuilder('raw')
      .where('raw.sourceSystem = :sourceSystem', { sourceSystem: 'ABC' })
      .andWhere('raw.sourceTable IN (:...sourceTables)', { sourceTables })
      .andWhere('raw.sourceId IN (:...sourceIds)', { sourceIds })
      .getMany();

    return new Map(rows.map((row) => [this.buildSourceRecordKey(row.sourceTable, row.sourceId), row]));
  }

  private async loadAbcRawTransactionMap(records: VerificationSourceRecord[]) {
    const sourceTables = [
      ...new Set(
        records.map((item) => item.sourceTable).filter((sourceTable) => this.isTransactionSourceTable(sourceTable)),
      ),
    ];
    if (!sourceTables.length) {
      return new Map<string, AbcRawTransaction>();
    }

    const sourceTableSet = new Set<string>(sourceTables);

    const sourceIds = [
      ...new Set(records.filter((item) => sourceTableSet.has(item.sourceTable)).map((item) => item.sourceId)),
    ];

    const rows = await this.abcRawTransactionRepository
      .createQueryBuilder('raw')
      .where('raw.sourceSystem = :sourceSystem', { sourceSystem: 'ABC' })
      .andWhere('raw.sourceTable IN (:...sourceTables)', { sourceTables })
      .andWhere('raw.sourceId IN (:...sourceIds)', { sourceIds })
      .getMany();

    return new Map(rows.map((row) => [this.buildSourceRecordKey(row.sourceTable, row.sourceId), row]));
  }

  private async loadWorkOrderMap(records: VerificationSourceRecord[]) {
    const ids = records
      .filter((item) => item.sourceTable === 'work_orders')
      .map((item) => Number(item.sourceId))
      .filter((item) => Number.isInteger(item) && item > 0);

    if (!ids.length) {
      return new Map<number, WorkOrder>();
    }

    const workOrders = await this.workOrderRepository.find({
      where: { id: In(ids) },
    });

    return new Map(workOrders.map((item) => [item.id, item]));
  }

  private async loadAbcSourceGoodsGroupOrderProfileMap(records: VerificationSourceRecord[]) {
    const pool = this.getAbcSourceReadonlyPool();
    if (!pool) {
      return new Map<string, AbcSourceGoodsGroupOrderProfile>();
    }

    const sourceIds = [
      ...new Set(
        records
          .filter((item) => item.sourceTable === 'goods_group_order')
          .map((item) => item.sourceId)
          .filter(Boolean),
      ),
    ];
    if (!sourceIds.length) {
      return new Map<string, AbcSourceGoodsGroupOrderProfile>();
    }

    try {
      const placeholders = sourceIds.map(() => '?').join(', ');
      const [rows] = await pool.query<any[]>(
        `SELECT id, user_id, created_at, order_num
           FROM goods_group_order
          WHERE id IN (${placeholders})`,
        sourceIds,
      );

      const result = new Map<string, AbcSourceGoodsGroupOrderProfile>();
      for (const row of rows) {
        result.set(this.buildSourceRecordKey('goods_group_order', String(row.id)), {
          userId: this.normalizeVerificationSourceString(row.user_id),
          purchaseTime: this.formatVerificationDate(row.created_at),
          sourceOrderNo: this.normalizeVerificationSourceString(row.order_num),
        });
      }

      return result;
    } catch {
      return new Map<string, AbcSourceGoodsGroupOrderProfile>();
    }
  }

  private async loadAbcSourceUserShoppingCardProfileMap(records: VerificationSourceRecord[]) {
    const pool = this.getAbcSourceReadonlyPool();
    if (!pool) {
      return new Map<string, AbcSourceUserShoppingCardProfile>();
    }

    const sourceIds = [
      ...new Set(
        records
          .filter((item) => item.sourceTable === 'user_shopping_card')
          .map((item) => item.sourceId)
          .filter(Boolean),
      ),
    ];
    if (!sourceIds.length) {
      return new Map<string, AbcSourceUserShoppingCardProfile>();
    }

    try {
      const placeholders = sourceIds.map(() => '?').join(', ');
      const [rows] = await pool.query<any[]>(
        `SELECT id, user_id, created_at
           FROM user_shopping_card
          WHERE id IN (${placeholders})`,
        sourceIds,
      );

      const result = new Map<string, AbcSourceUserShoppingCardProfile>();
      for (const row of rows) {
        result.set(this.buildSourceRecordKey('user_shopping_card', String(row.id)), {
          userId: this.normalizeVerificationSourceString(row.user_id),
          purchaseTime: this.formatVerificationDate(row.created_at),
        });
      }

      return result;
    } catch {
      return new Map<string, AbcSourceUserShoppingCardProfile>();
    }
  }

  private async loadAbcSourceCustomerProfileMap(
    records: VerificationSourceRecord[],
    rawOrderMap: Map<string, AbcRawOrder>,
    rawTransactionMap: Map<string, AbcRawTransaction>,
    abcSourceGoodsGroupOrderProfileMap: Map<string, AbcSourceGoodsGroupOrderProfile>,
    abcSourceUserShoppingCardProfileMap: Map<string, AbcSourceUserShoppingCardProfile>,
  ) {
    const pool = this.getAbcSourceReadonlyPool();
    if (!pool) {
      return new Map<string, AbcSourceCustomerProfile>();
    }

    const recordUserIds = new Map<string, string>();
    for (const record of records) {
      const recordKey = this.buildSourceRecordKey(record.sourceTable, record.sourceId);
      let userId: string | null = null;

      if (record.sourceTable === 'goods_group_order') {
        const rawOrder = rawOrderMap.get(recordKey);
        const orderProfile = abcSourceGoodsGroupOrderProfileMap.get(recordKey);
        userId = this.pickVerificationString(
          rawOrder?.rawPayload
            ? this.readStringFromPathCandidates([rawOrder.rawPayload], [['user_id'], ['userId']])
            : null,
          orderProfile?.userId ?? null,
        );
      } else if (record.sourceTable === 'user_shopping_card') {
        const cardProfile = abcSourceUserShoppingCardProfileMap.get(recordKey);
        userId = this.pickVerificationString(cardProfile?.userId ?? null);
      } else if (this.isTransactionSourceTable(record.sourceTable)) {
        const rawTransaction = rawTransactionMap.get(recordKey);
        userId = this.pickVerificationString(
          rawTransaction?.rawPayload
            ? this.readStringFromPathCandidates([rawTransaction.rawPayload], [['user_id'], ['userId']])
            : null,
          record.customerId ?? null,
        );
      }

      if (!userId) {
        continue;
      }

      recordUserIds.set(recordKey, userId);
    }

    const userIds = [...new Set(recordUserIds.values())];
    if (!userIds.length) {
      return new Map<string, AbcSourceCustomerProfile>();
    }

    try {
      const placeholders = userIds.map(() => '?').join(', ');
      const [userRows] = await pool.query<any[]>(
        `SELECT id, name, mobile
           FROM user_account
          WHERE id IN (${placeholders})`,
        userIds,
      );
      const [carRows] = await pool.query<any[]>(
        `SELECT user_id, num
           FROM user_car
          WHERE deleted_at IS NULL
            AND num IS NOT NULL
            AND TRIM(num) <> ''
            AND user_id IN (${placeholders})
          ORDER BY updated_at DESC, created_at DESC, id DESC`,
        userIds,
      );

      const userMap = new Map<string, { customerName: string | null; customerMobile: string | null }>();
      for (const row of userRows) {
        const customerMobile = this.normalizeVerificationSourceString(row.mobile);
        userMap.set(String(row.id), {
          customerName: this.normalizeAbcSourceCustomerName(row.name, customerMobile),
          customerMobile,
        });
      }

      const userPlateMap = new Map<string, string[]>();
      for (const row of carRows) {
        const userId = String(row.user_id);
        const plate = this.normalizeVerificationSourceString(row.num);
        if (!plate) {
          continue;
        }

        const plates = userPlateMap.get(userId) ?? [];
        if (!plates.includes(plate)) {
          plates.push(plate);
        }
        userPlateMap.set(userId, plates);
      }

      const result = new Map<string, AbcSourceCustomerProfile>();
      for (const [recordKey, userId] of recordUserIds.entries()) {
        const user = userMap.get(userId);
        const plates = userPlateMap.get(userId) ?? [];
        result.set(recordKey, {
          customerName: user?.customerName ?? null,
          customerMobile: user?.customerMobile ?? null,
          carPlate: plates.length === 1 ? plates[0] : null,
        });
      }

      return result;
    } catch {
      return new Map<string, AbcSourceCustomerProfile>();
    }
  }

  private async loadAbcSourceUsersByMobile(mobiles: string[]) {
    const pool = this.getAbcSourceReadonlyPool();
    if (!pool || !mobiles.length) {
      return new Map<string, Array<{ id: number; name: string | null; mobile: string | null }>>();
    }

    try {
      const placeholders = mobiles.map(() => '?').join(', ');
      const [rows] = await pool.query<any[]>(
        `SELECT id, name, mobile
           FROM user_account
          WHERE mobile IN (${placeholders})`,
        mobiles,
      );

      const result = new Map<string, Array<{ id: number; name: string | null; mobile: string | null }>>();
      for (const row of rows) {
        const normalizedMobile = normalizeMainlandMobile(row.mobile);
        if (!normalizedMobile) {
          continue;
        }
        const group = result.get(normalizedMobile) ?? [];
        group.push({
          id: Number(row.id),
          name: this.normalizeVerificationSourceString(row.name),
          mobile: this.normalizeVerificationSourceString(row.mobile),
        });
        result.set(normalizedMobile, group);
      }
      return result;
    } catch {
      return new Map<string, Array<{ id: number; name: string | null; mobile: string | null }>>();
    }
  }

  private async loadExternalCardSalesEvidenceMap(
    records: VerificationSourceRecord[],
    rawOrderMap: Map<string, AbcRawOrder>,
    abcSourceCustomerProfileMap: Map<string, AbcSourceCustomerProfile>,
    abcSourceGoodsGroupOrderProfileMap: Map<string, AbcSourceGoodsGroupOrderProfile>,
  ) {
    const relevantRefs = records.filter((item) => item.sourceTable === 'goods_group_order');
    if (!relevantRefs.length) {
      return new Map<string, ExternalCardSalesStagingContext>();
    }

    const periodKeys = [
      ...new Set(
        relevantRefs
          .map((item) => normalizeVerificationPeriodKey(item.occurredAt.toISOString()))
          .filter((item): item is string => Boolean(item)),
      ),
    ];
    if (!periodKeys.length) {
      return new Map<string, ExternalCardSalesStagingContext>();
    }

    const latestImportBatchNos = await this.loadLatestExternalCardSalesImportBatchNos(periodKeys);
    if (!latestImportBatchNos.length) {
      return new Map<string, ExternalCardSalesStagingContext>();
    }

    const stagingRows = await this.externalCardSalesStagingRepository.find({
      where: { periodKey: In(periodKeys), importBatchNo: In(latestImportBatchNos) },
      order: { saleDate: 'ASC', sourceRowNo: 'ASC' },
    });
    if (!stagingRows.length) {
      return new Map<string, ExternalCardSalesStagingContext>();
    }

    const stagingContexts = stagingRows.map((row) => ({
      id: row.id,
      sourceFileName: row.sourceFileName,
      sourceSheetName: row.sourceSheetName,
      sourceRowNo: row.sourceRowNo,
      saleDate: this.formatVerificationDate(row.saleDate),
      periodKey: row.periodKey,
      sourceCustomerMobile: normalizeMainlandMobile(row.normalizedMobile ?? row.customerMobile ?? null),
      sourceCustomerNameAlias: normalizeVerificationText(row.customerNameAlias),
      sourceCarPlate: normalizeVerificationPlate(row.normalizedPlate ?? row.carPlate ?? null),
      packageOrProjectName: normalizeVerificationText(row.packageOrProjectName),
      amount: normalizeVerificationAmount(row.amount),
      normalizedProjectCode: normalizeVerificationProjectCode(
        row.normalizedProjectCode ?? row.packageOrProjectName,
        row.amount,
      ),
    }));

    const stagingMobiles = [
      ...new Set(stagingContexts.map((item) => item.sourceCustomerMobile).filter((item): item is string => Boolean(item))),
    ];
    const stagingMobileUserMap = await this.loadAbcSourceUsersByMobile(stagingMobiles);

    const rowsByUserPeriod = new Map<string, Array<any>>();
    const rowsByMobilePeriod = new Map<string, Array<any>>();
    for (const row of stagingContexts) {
      const matchedUserCandidates = row.sourceCustomerMobile
        ? stagingMobileUserMap.get(row.sourceCustomerMobile) ?? []
        : [];
      const matchedUserCandidate =
        matchedUserCandidates.length === 1 ? matchedUserCandidates[0] : null;
      const matchedUserId = matchedUserCandidate ? String(matchedUserCandidate.id) : null;
      const rowWithUser = {
        ...row,
        matchedCustomerId: matchedUserId,
        matchedCustomerName: matchedUserCandidate
          ? this.normalizeAbcSourceCustomerName(matchedUserCandidate.name, row.sourceCustomerMobile)
          : null,
        matchedCustomerMobile: matchedUserCandidate
          ? normalizeMainlandMobile(matchedUserCandidate.mobile)
          : row.sourceCustomerMobile,
      };

      if (matchedUserId && row.periodKey) {
        const userPeriodKey = `${matchedUserId}:${row.periodKey}`;
        const group = rowsByUserPeriod.get(userPeriodKey) ?? [];
        group.push(rowWithUser);
        rowsByUserPeriod.set(userPeriodKey, group);
      }

      if (row.sourceCustomerMobile && row.periodKey) {
        const mobilePeriodKey = `${row.sourceCustomerMobile}:${row.periodKey}`;
        const group = rowsByMobilePeriod.get(mobilePeriodKey) ?? [];
        group.push(rowWithUser);
        rowsByMobilePeriod.set(mobilePeriodKey, group);
      }
    }

    const result = new Map<string, ExternalCardSalesStagingContext>();
    for (const ref of relevantRefs) {
      const recordKey = this.buildSourceRecordKey(ref.sourceTable, ref.sourceId);
      const rawOrder = rawOrderMap.get(recordKey);
      const orderProfile = abcSourceGoodsGroupOrderProfileMap.get(recordKey);
      const customerProfile = abcSourceCustomerProfileMap.get(recordKey);
      const sourceUserId = this.pickVerificationString(
        rawOrder?.rawPayload
          ? this.readStringFromPathCandidates([rawOrder.rawPayload], [['user_id'], ['userId']])
          : null,
        orderProfile?.userId ?? null,
        ref.customerId ?? null,
      );
      const purchaseDate = normalizeVerificationDateKey(
        orderProfile?.purchaseTime ?? rawOrder?.sourceUpdatedAt?.toISOString() ?? ref.occurredAt.toISOString(),
      );
      const periodKey = normalizeVerificationPeriodKey(purchaseDate ?? ref.occurredAt.toISOString());
      const sourceProjectCode = normalizeVerificationProjectCode(
        this.pickVerificationString(
          this.readNestedString(ref.normalizedPayload ?? null, 'sourceMeta', 'packageName'),
          this.readStringFromPathCandidates([ref.normalizedPayload ?? null, rawOrder?.rawPayload ?? null], [
            ['sourceMeta', 'goodsGroupName'],
            ['package_name'],
            ['packageName'],
            ['goods_group_name'],
            ['goodsGroupName'],
            ['project'],
            ['title'],
          ]),
        ),
        ref.amountStandard,
      );
      const sourceAmount = normalizeVerificationAmount(ref.amountStandard);

      let candidates: Array<(typeof stagingContexts)[number] & {
        matchedCustomerId: string | null;
        matchedCustomerName: string | null;
        matchedCustomerMobile: string | null;
      }> = [];
      if (sourceUserId && periodKey) {
        candidates = rowsByUserPeriod.get(`${sourceUserId}:${periodKey}`) ?? [];
      }
      if (!candidates.length && customerProfile?.customerMobile && periodKey) {
        const sourceMobile = normalizeMainlandMobile(customerProfile.customerMobile);
        if (sourceMobile) {
          candidates = rowsByMobilePeriod.get(`${sourceMobile}:${periodKey}`) ?? [];
        }
      }
      if (!candidates.length) {
        continue;
      }

      const uniqueSourceMobile = this.getSingleDistinctVerificationValue(
        candidates.map((item) => item.sourceCustomerMobile),
      );
      const uniqueSourceAlias = this.getSingleDistinctVerificationValue(
        candidates.map((item) => item.sourceCustomerNameAlias),
      );
      const uniquePlate = this.getSingleDistinctVerificationValue(
        candidates.map((item) => item.sourceCarPlate),
      );
      const uniqueMatchedCustomerId = this.getSingleDistinctVerificationValue(
        candidates.map((item) => item.matchedCustomerId),
      );
      const uniqueMatchedCustomerName = this.getSingleDistinctVerificationValue(
        candidates.map((item) => item.matchedCustomerName),
      );
      const uniqueMatchedCustomerMobile = this.getSingleDistinctVerificationValue(
        candidates.map((item) => item.matchedCustomerMobile),
      );

      const scoredCandidates = candidates
        .map((candidate) => {
          let score = 0;
          const reasons: string[] = [];

          if (sourceUserId && candidate.matchedCustomerId && candidate.matchedCustomerId === sourceUserId) {
            score += 60;
            reasons.push('手机号反查命中同一 user_id/customerId');
          }

          const dateDistance = compareVerificationDateDistance(candidate.saleDate, purchaseDate);
          if (dateDistance === 0) {
            score += 20;
            reasons.push('办卡日期与来源购买日期一致');
          } else if (dateDistance !== null && dateDistance <= 1) {
            score += 10;
            reasons.push('办卡日期与来源购买日期在 1 天窗口内');
          }

          if (sourceAmount && candidate.amount && sourceAmount === candidate.amount) {
            score += 12;
            reasons.push('金额一致');
          }

          if (
            sourceProjectCode &&
            candidate.normalizedProjectCode &&
            sourceProjectCode === candidate.normalizedProjectCode
          ) {
            score += 10;
            reasons.push('项目归一化一致');
          }

          return { candidate, score, reasons };
        })
        .sort((left, right) => right.score - left.score);

      const best = scoredCandidates[0] ?? null;
      const second = scoredCandidates[1] ?? null;
      const hasStrongUniqueMatch =
        Boolean(best) &&
        best.score >= 70 &&
        (!second || best.score - second.score >= 5);

      const baseContext = {
        sourceFileName: best?.candidate.sourceFileName ?? candidates[0].sourceFileName,
        sourceSheetName: best?.candidate.sourceSheetName ?? candidates[0].sourceSheetName,
        sourceRowNo: best?.candidate.sourceRowNo ?? candidates[0].sourceRowNo,
        saleDate: best?.candidate.saleDate ?? candidates[0].saleDate,
        periodKey,
        sourceCustomerMobile: uniqueSourceMobile ?? best?.candidate.sourceCustomerMobile ?? null,
        sourceCustomerNameAlias: uniqueSourceAlias ?? best?.candidate.sourceCustomerNameAlias ?? null,
        sourceCarPlate: uniquePlate ?? best?.candidate.sourceCarPlate ?? null,
        packageOrProjectName: best?.candidate.packageOrProjectName ?? null,
        amount: best?.candidate.amount ?? null,
        normalizedProjectCode: best?.candidate.normalizedProjectCode ?? null,
        matchedCustomerId: uniqueMatchedCustomerId,
        matchedCustomerName: uniqueMatchedCustomerName,
        matchedCustomerMobile: uniqueMatchedCustomerMobile,
      };

      if (hasStrongUniqueMatch && best) {
        result.set(recordKey, {
          ...baseContext,
          matchedOrderId: ref.sourceId,
          matchedOrderNo:
            this.pickVerificationString(ref.sourceOrderNo, orderProfile?.sourceOrderNo ?? null) ?? null,
          matchedSourceTable: ref.sourceTable,
          matchConfidence: this.scoreToConfidence(best.score),
          matchReason: best.reasons.join('；'),
          evidenceSummary: `${baseContext.sourceFileName}#${baseContext.sourceSheetName ?? 'Sheet1'}!R${
            baseContext.sourceRowNo
          } 通过手机号反查命中 customer/user，并与当前 ${ref.sourceTable} 记录完成日期/金额/项目二次校验`,
        });
        continue;
      }

      if (uniqueMatchedCustomerId && uniqueMatchedCustomerMobile) {
        result.set(recordKey, {
          ...baseContext,
          matchedOrderId: null,
          matchedOrderNo: null,
          matchedSourceTable: ref.sourceTable,
          matchConfidence: '0.7000',
          matchReason: '手机号反查可锁定客户主键，但同周期存在多条办卡明细，仍需人工核对具体一笔',
          evidenceSummary: `${baseContext.sourceFileName}#${baseContext.sourceSheetName ?? 'Sheet1'} 存在同手机号办卡记录，可反查客户主键，但具体购买行仍需人工核对`,
        });
      }
    }

    return result;
  }

  private async loadLatestExternalCardSalesImportBatchNos(periodKeys: string[]) {
    const batchRows = await this.externalCardSalesStagingRepository
      .createQueryBuilder('staging')
      .select('staging.periodKey', 'periodKey')
      .addSelect('staging.importBatchNo', 'importBatchNo')
      .addSelect('MAX(staging.importedAt)', 'latestImportedAt')
      .where('staging.periodKey IN (:...periodKeys)', { periodKeys })
      .groupBy('staging.periodKey')
      .addGroupBy('staging.importBatchNo')
      .getRawMany<{ periodKey: string; importBatchNo: string; latestImportedAt: Date | string | null }>();

    const latestByPeriod = new Map<string, { importBatchNo: string; latestImportedAt: number }>();
    for (const row of batchRows) {
      const periodKey = String(row.periodKey ?? '');
      const importBatchNo = String(row.importBatchNo ?? '');
      if (!periodKey || !importBatchNo) {
        continue;
      }
      const latestImportedAt = row.latestImportedAt
        ? new Date(row.latestImportedAt).getTime()
        : 0;
      const previous = latestByPeriod.get(periodKey);
      if (
        !previous ||
        latestImportedAt > previous.latestImportedAt ||
        (latestImportedAt === previous.latestImportedAt && importBatchNo > previous.importBatchNo)
      ) {
        latestByPeriod.set(periodKey, { importBatchNo, latestImportedAt });
      }
    }

    return [...new Set(Array.from(latestByPeriod.values()).map((item) => item.importBatchNo))];
  }

  private buildVerificationSourceContext(
    ref: VerificationSourceRecord,
    rawOrderMap: Map<string, AbcRawOrder>,
    rawCardMap: Map<string, AbcRawCard>,
    rawTransactionMap: Map<string, AbcRawTransaction>,
    workOrderMap: Map<number, WorkOrder>,
    abcSourceCustomerProfileMap: Map<string, AbcSourceCustomerProfile>,
    abcSourceGoodsGroupOrderProfileMap: Map<string, AbcSourceGoodsGroupOrderProfile>,
    abcSourceUserShoppingCardProfileMap: Map<string, AbcSourceUserShoppingCardProfile>,
    externalCardSalesEvidenceMap: Map<string, ExternalCardSalesStagingContext>,
    currentUser: CurrentUser,
    mode: VerificationContextViewMode,
  ): VerificationSourceContext {
    const key = this.buildSourceRecordKey(ref.sourceTable, ref.sourceId);
    const rawOrder = rawOrderMap.get(key);
    const rawCard = rawCardMap.get(key);
    const rawTransaction = rawTransactionMap.get(key);
    const workOrder = ref.sourceTable === 'work_orders' ? workOrderMap.get(Number(ref.sourceId)) ?? null : null;
    const abcSourceCustomerProfile = abcSourceCustomerProfileMap.get(key);
    const abcSourceGoodsGroupOrderProfile = abcSourceGoodsGroupOrderProfileMap.get(key);
    const abcSourceUserShoppingCardProfile = abcSourceUserShoppingCardProfileMap.get(key);
    const externalCardSalesEvidence = externalCardSalesEvidenceMap.get(key) ?? null;
    const normalizedPayload = ref.normalizedPayload ?? null;
    const rawPayload = rawOrder?.rawPayload ?? rawCard?.rawPayload ?? rawTransaction?.rawPayload ?? null;
    const rawPayloadSources = collectVerificationObjectSources(rawPayload);

    const sourceCustomerMobile = normalizeMainlandMobile(
      this.pickVerificationString(
        workOrder?.customerMobile ?? null,
        abcSourceCustomerProfile?.customerMobile ?? null,
        this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
          ['sourceMeta', 'customerMobile'],
          ['sourceCustomerMobile'],
          ['customer_mobile'],
          ['customerMobile'],
          ['mobile'],
          ['phone'],
          ['tel'],
        ]),
        externalCardSalesEvidence?.sourceCustomerMobile ?? null,
      ),
    );
    const sourceCustomerName = this.normalizeAbcSourceCustomerName(
      this.pickVerificationString(
        workOrder?.customerName ?? null,
        abcSourceCustomerProfile?.customerName ?? null,
        this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
          ['sourceMeta', 'customerName'],
          ['sourceCustomerName'],
          ['customer_name'],
          ['customerName'],
          ['real_name'],
        ]),
        externalCardSalesEvidence?.sourceCustomerNameAlias ?? null,
      ),
      sourceCustomerMobile,
    );
    const sourceCustomerNameAlias = this.normalizeAbcSourceCustomerName(
      externalCardSalesEvidence?.sourceCustomerNameAlias ?? null,
      sourceCustomerMobile,
    );
    const matchedCustomerName = this.normalizeAbcSourceCustomerName(
      this.pickVerificationString(
        externalCardSalesEvidence?.matchedCustomerName ?? null,
        sourceCustomerName,
        sourceCustomerNameAlias,
      ),
      this.pickVerificationString(
        externalCardSalesEvidence?.matchedCustomerMobile ?? null,
        sourceCustomerMobile,
      ),
    );
    const customerName = this.applyVerificationMask(
      matchedCustomerName ?? sourceCustomerName ?? sourceCustomerNameAlias ?? null,
      'name',
      currentUser,
      mode,
    );
    const matchedCustomerMobile = normalizeMainlandMobile(
      this.pickVerificationString(
        externalCardSalesEvidence?.matchedCustomerMobile ?? null,
        sourceCustomerMobile,
      ),
    );
    const customerMobile = this.applyVerificationMask(
      matchedCustomerMobile ?? sourceCustomerMobile,
      'mobile',
      currentUser,
      mode,
    );

    const sourceCarPlate = this.pickVerificationString(
      abcSourceCustomerProfile?.carPlate ?? null,
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['sourceMeta', 'carPlate'],
        ['car_plate'],
        ['carPlate'],
        ['car_no'],
        ['carNo'],
        ['plate'],
        ['plate_no'],
        ['license_plate'],
        ['licensePlate'],
      ]),
      externalCardSalesEvidence?.sourceCarPlate ?? null,
    );
    const carPlate = this.applyVerificationMask(
      sourceCarPlate,
      'plate',
      currentUser,
      mode,
    );

    const sourceOrderNo = this.pickVerificationString(
      ref.sourceOrderNo,
      rawOrder?.sourceOrderNo ?? null,
      rawCard?.sourceOrderNo ?? null,
      rawTransaction?.sourceOrderNo ?? null,
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['sourceMeta', 'orderNo'],
        ['sourceMeta', 'sourceOrderNo'],
        ['order_no'],
        ['orderNo'],
        ['out_trade_no'],
      ]),
    );

    const packageName = this.pickVerificationString(
      this.readNestedString(normalizedPayload, 'sourceMeta', 'packageName'),
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['sourceMeta', 'goodsGroupName'],
        ['package_name'],
        ['packageName'],
        ['goods_group_name'],
        ['goodsGroupName'],
        ['project'],
        ['title'],
      ]),
    );

    const merchantName = this.pickVerificationString(
      this.readNestedString(normalizedPayload, 'sourceRefs', 'merchantName'),
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['merchant_name'],
        ['merchantName'],
        ['merchant_title'],
      ]),
    );

    const merchantContact = this.pickVerificationString(
      this.readNestedString(normalizedPayload, 'sourceRefs', 'merchantContacts'),
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['merchant_contact'],
        ['merchantContact'],
        ['contacts'],
        ['contact_name'],
      ]),
    );

    const goodsGroupId = this.pickVerificationString(
      this.readNestedString(normalizedPayload, 'sourceMeta', 'goodsGroupId'),
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [['goods_group_id'], ['goodsGroupId']]),
    );

    const totalPriceRaw = this.pickVerificationString(
      ref.amountStandard ?? null,
      workOrder?.amountReceived ?? workOrder?.amountDue ?? null,
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['amount_standard'],
        ['amount'],
        ['money'],
        ['price'],
        ['total_price'],
        ['totalPrice'],
        ['pay_price'],
        ['real_price'],
      ]),
    );

    const pointDeductionRaw = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['point_deduction'],
        ['pointDeduction'],
        ['integral'],
      ]),
    );
    const cardIssuedAmountRaw = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['extraAmount', 'standard'],
        ['shoppingCardMoney'],
        ['shopping_card_money'],
        ['total_amount'],
        ['totalAmount'],
      ]),
    );
    const cardBalanceAmountRaw = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['primaryAmount', 'standard'],
        ['balance', 'standard'],
        ['balance_standard'],
        ['balance'],
      ]),
    );
    const cardLedgerType = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['ledgerType', 'standard'],
        ['ledger_type_standard'],
        ['sourceMeta', 'sourceType'],
      ]),
    );
    const statusStandard = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['statusStandard'],
        ['status_standard'],
        ['cardStatusStandard'],
        ['card_status_standard'],
        ['status', 'standard'],
      ]),
    );

    const anomaly = this.resolveRecordAnomaly(ref, goodsGroupId, totalPriceRaw);
    const paymentClassification = this.resolveSourcePaymentClassification({
      sourceTable: ref.sourceTable,
      statusStandard,
      amountRaw: totalPriceRaw,
      pointDeductionRaw,
      cardLedgerType,
      goodsGroupId,
      anomalyClassification: anomaly.classification,
      hasExternalCardSalesEvidence: Boolean(externalCardSalesEvidence),
      normalizedPayload,
      rawPayload,
    });

    return {
      sourceTable: ref.sourceTable,
      sourceId: ref.sourceId,
      sourceOrderNo,
      customerId: ref.customerId ?? null,
      sourceCustomerName,
      sourceCustomerMobile,
      sourceCarPlate,
      sourceCustomerNameAlias,
      customerName,
      customerMobile,
      carPlate,
      matchedCustomerId:
        externalCardSalesEvidence?.matchedCustomerId ??
        (matchedCustomerMobile ? ref.customerId ?? null : null),
      matchedCustomerName,
      matchedCustomerMobile,
      matchedOrderId: externalCardSalesEvidence?.matchedOrderId ?? null,
      matchedOrderNo: externalCardSalesEvidence?.matchedOrderNo ?? null,
      matchedSourceTable: externalCardSalesEvidence?.matchedSourceTable ?? null,
      matchConfidence: externalCardSalesEvidence?.matchConfidence ?? null,
      matchReason: externalCardSalesEvidence?.matchReason ?? null,
      evidenceSummary: externalCardSalesEvidence?.evidenceSummary ?? null,
      purchaseTime: this.resolveVerificationPurchaseTime(
        ref,
        rawOrder,
        rawCard,
        rawTransaction,
        workOrder,
        abcSourceGoodsGroupOrderProfile,
        abcSourceUserShoppingCardProfile,
      ),
      packageName,
      merchantName,
      merchantContact,
      goodsGroupId,
      totalPriceRaw,
      externalCardSalesPackageName: externalCardSalesEvidence?.packageOrProjectName ?? null,
      externalCardSalesAmount: externalCardSalesEvidence?.amount ?? null,
      pointDeductionRaw,
      cardIssuedAmountRaw,
      cardBalanceAmountRaw,
      cardLedgerType,
      paymentStatus: paymentClassification.paymentStatus,
      isPaid: paymentClassification.isPaid,
      settlementType: paymentClassification.settlementType,
      isTestData: paymentClassification.isTestData,
      sourceClassification: paymentClassification.sourceClassification,
      reconciliationStatus: paymentClassification.reconciliationStatus,
      reconciliationReason: paymentClassification.reconciliationReason,
      anomalyClassification: anomaly.classification,
      anomalyReason: anomaly.reason,
    };
  }

  private resolveVerificationPurchaseTime(
    ref: VerificationSourceRecord,
    rawOrder: AbcRawOrder | undefined,
    rawCard: AbcRawCard | undefined,
    rawTransaction: AbcRawTransaction | undefined,
    workOrder: WorkOrder | null,
    abcSourceGoodsGroupOrderProfile: AbcSourceGoodsGroupOrderProfile | undefined,
    abcSourceUserShoppingCardProfile: AbcSourceUserShoppingCardProfile | undefined,
  ) {
    return this.formatVerificationDate(
      this.pickVerificationString(
        workOrder?.updatedAt ? workOrder.updatedAt.toISOString() : null,
        rawOrder?.sourceUpdatedAt ? rawOrder.sourceUpdatedAt.toISOString() : null,
        rawCard?.sourceUpdatedAt ? rawCard.sourceUpdatedAt.toISOString() : null,
        rawTransaction?.sourceUpdatedAt ? rawTransaction.sourceUpdatedAt.toISOString() : null,
        abcSourceGoodsGroupOrderProfile?.purchaseTime ?? null,
        abcSourceUserShoppingCardProfile?.purchaseTime ?? null,
        this.readStringFromPathCandidates(
          [
            ref.normalizedPayload ?? null,
            rawOrder?.rawPayload ?? null,
            rawCard?.rawPayload ?? null,
            rawTransaction?.rawPayload ?? null,
          ],
          [
            ['purchase_time'],
            ['purchaseTime'],
            ['created_at'],
            ['createdAt'],
            ['pay_time'],
            ['payTime'],
            ['order_time'],
            ['orderTime'],
          ],
        ),
        ref.occurredAt?.toISOString?.() ?? null,
      ),
    );
  }

  private resolveRecordAnomaly(
    ref: VerificationSourceRecord,
    goodsGroupId: string | null,
    totalPriceRaw: string | null,
  ) {
    const normalizedAmount = this.normalizeAnomalyAmount(totalPriceRaw);

    if (ref.sourceTable === 'goods_group_order' && goodsGroupId === '47' && normalizedAmount === '0.01') {
      return {
        classification: 'suspected_test_data',
        reason: 'goods_group_order 0.01 amount looks like test or debug residue',
      };
    }

    if (ref.sourceTable.startsWith('user_shopping_card') && normalizedAmount === '5.00') {
      return {
        classification: 'special_business_case',
        reason: 'card balance-like amount should not be treated as normal monthly sales',
      };
    }

    if (['work_orders', 'repair_order'].includes(ref.sourceTable) && normalizedAmount === '0.00') {
      return {
        classification: 'needs_review',
        reason: 'zero-amount work order or repair order needs manual review',
      };
    }

    return {
      classification: null,
      reason: null,
    };
  }

  private resolveSourcePaymentClassification(input: {
    sourceTable: string;
    statusStandard: string | null;
    amountRaw: string | null;
    pointDeductionRaw: string | null;
    cardLedgerType: string | null;
    goodsGroupId: string | null;
    anomalyClassification: string | null;
    hasExternalCardSalesEvidence: boolean;
    normalizedPayload: Record<string, unknown> | null;
    rawPayload: Record<string, unknown> | null | undefined;
  }): SourcePaymentClassification {
    const status = (input.statusStandard ?? '').trim().toLowerCase();
    const amount = this.parseSummaryBCardAmount(input.amountRaw);
    const pointDeduction = this.parseSummaryBCardAmount(input.pointDeductionRaw);
    const ledgerType = (input.cardLedgerType ?? '').trim().toLowerCase();
    const sourceText = this.safeVerificationPayloadText(input.normalizedPayload, input.rawPayload).toLowerCase();
    const hasPointsEvidence =
      (pointDeduction !== null && pointDeduction > 0) ||
      ledgerType.includes('point') ||
      ledgerType.includes('integral');
    const hasUnpaidStatus = ['pending_payment', 'pending', 'wait', 'waiting', 'unpaid'].includes(status);
    const hasPaidStatus = ['completed', 'paid', 'success', 'recorded'].includes(status);
    const hasFailedStatus = ['failed', 'cancelled', 'canceled', 'refund', 'refunded'].includes(status);
    const isAcardSale = input.sourceTable === 'goods_group_order' && input.goodsGroupId === '47';
    const isZeroValueNonAOrder =
      input.sourceTable === 'goods_group_order' &&
      !isAcardSale &&
      amount !== null &&
      amount === 0;
    const isOrderLikeCashSource = [
      'order',
      'repair_order',
      'supermarket_order',
      'top_up_order',
      'goods_group_order',
      'transaction',
    ].includes(input.sourceTable);
    const internalAdminLike =
      /admin|internal|test/.test(sourceText) ||
      sourceText.includes('\u7cfb\u7edf\u7ba1\u7406\u5458') ||
      sourceText.includes('\u7ba1\u7406\u5458');
    const amountLooksLikeTest =
      amount !== null &&
      amount <= 1 &&
      !hasPointsEvidence &&
      !hasPaidStatus &&
      input.anomalyClassification !== 'special_business_case';
    const isTestData = input.anomalyClassification === 'suspected_test_data' || amountLooksLikeTest;

    if (isZeroValueNonAOrder && hasPaidStatus) {
      return {
        paymentStatus: 'paid_points',
        isPaid: true,
        settlementType: 'points',
        isTestData: false,
        sourceClassification: 'points_redemption',
        reconciliationStatus: 'needs_review',
        reconciliationReason: 'completed_zero_value_non_a_order_treated_as_points_redemption_needs_business_review',
      };
    }

    if (isZeroValueNonAOrder && (status === 'unknown' || hasUnpaidStatus || hasFailedStatus)) {
      return {
        paymentStatus: 'unpaid',
        isPaid: false,
        settlementType: 'none',
        isTestData: false,
        sourceClassification: 'other',
        reconciliationStatus: 'needs_review',
        reconciliationReason: `zero_value_non_a_order_status=${status || 'unknown'}_is_not_confirmed_paid`,
      };
    }

    if (internalAdminLike && !hasPaidStatus && !hasPointsEvidence) {
      return {
        paymentStatus: 'internal_admin',
        isPaid: false,
        settlementType: 'none',
        isTestData: true,
        sourceClassification: 'internal_admin',
        reconciliationStatus: 'needs_review',
        reconciliationReason: 'internal_admin_or_test_operator_evidence_without_payment',
      };
    }

    if (isTestData) {
      return {
        paymentStatus: 'test_data',
        isPaid: false,
        settlementType: 'none',
        isTestData: true,
        sourceClassification: 'test_data',
        reconciliationStatus: 'needs_review',
        reconciliationReason: 'amount_or_anomaly_audit_marks_record_as_test_data',
      };
    }

    if (hasUnpaidStatus || hasFailedStatus) {
      return {
        paymentStatus: 'unpaid',
        isPaid: false,
        settlementType: 'none',
        isTestData: false,
        sourceClassification: 'other',
        reconciliationStatus: 'needs_review',
        reconciliationReason: `status_standard=${status || 'unknown'}_is_not_paid`,
      };
    }

    if (hasPointsEvidence) {
      return {
        paymentStatus: 'paid_points',
        isPaid: true,
        settlementType: 'points',
        isTestData: false,
        sourceClassification: 'points_redemption',
        reconciliationStatus: input.hasExternalCardSalesEvidence ? 'matched_sheet' : 'manual_verified',
        reconciliationReason: input.hasExternalCardSalesEvidence
          ? 'points_record_matched_latest_card_sales_staging'
          : 'points_or_integral_payment_evidence_kept_separate_from_cash_income',
      };
    }

    if (hasPaidStatus || (isOrderLikeCashSource && amount !== null && amount > 1)) {
      return {
        paymentStatus: 'paid_cash',
        isPaid: true,
        settlementType: 'cash',
        isTestData: false,
        sourceClassification: isAcardSale ? 'a_card_sale' : 'other',
        reconciliationStatus: input.hasExternalCardSalesEvidence ? 'matched_sheet' : isAcardSale ? 'sheet_missing' : 'needs_review',
        reconciliationReason: input.hasExternalCardSalesEvidence
          ? 'matched_latest_external_card_sales_staging'
          : isAcardSale
            ? 'paid_a_card_sale_missing_from_latest_card_sales_sheet_keep_for_manual_omission_review'
            : 'paid_source_record_without_external_sheet_evidence',
      };
    }

    return {
      paymentStatus: 'unknown',
      isPaid: false,
      settlementType: 'unknown',
      isTestData: false,
      sourceClassification: 'other',
      reconciliationStatus: 'needs_review',
      reconciliationReason: 'insufficient_payment_or_settlement_evidence',
    };
  }

  private resolveStoredRecordPaymentClassification(record: {
    sourceTable: string;
    amountStandard?: string | null;
    normalizedPayload?: Record<string, unknown> | null;
  }) {
    const normalizedPayload = record.normalizedPayload ?? null;
    const statusStandard = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload], [
        ['statusStandard'],
        ['status_standard'],
        ['cardStatusStandard'],
        ['card_status_standard'],
        ['rewardFlowControl', 'derivedFromStatusStandard'],
      ]),
    );
    const goodsGroupId = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload], [
        ['sourceMeta', 'goodsGroupId'],
        ['goodsGroupId'],
        ['goods_group_id'],
      ]),
    );
    const pointDeductionRaw = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload], [
        ['point_deduction'],
        ['pointDeduction'],
        ['integral'],
      ]),
    );
    const cardLedgerType = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload], [
        ['ledgerType', 'standard'],
        ['ledgerTypeStandard'],
        ['ledger_type_standard'],
        ['sourceMeta', 'sourceType'],
      ]),
    );
    const amountRaw = this.pickVerificationString(
      record.amountStandard ?? null,
      this.readStringFromPathCandidates([normalizedPayload], [
        ['amount_standard'],
        ['amountStandard'],
        ['amount'],
        ['money'],
        ['total_price'],
        ['totalPrice'],
      ]),
    );

    return this.resolveSourcePaymentClassification({
      sourceTable: record.sourceTable,
      statusStandard,
      amountRaw,
      pointDeductionRaw,
      cardLedgerType,
      goodsGroupId,
      anomalyClassification: null,
      hasExternalCardSalesEvidence: false,
      normalizedPayload,
      rawPayload: null,
    });
  }

  private shouldIncludeInPaidBusinessStatSummary(payment: SourcePaymentClassification) {
    return (
      payment.paymentStatus !== 'unpaid' &&
      payment.paymentStatus !== 'test_data' &&
      payment.paymentStatus !== 'internal_admin' &&
      !payment.isTestData
    );
  }

  private safeVerificationPayloadText(...values: Array<Record<string, unknown> | null | undefined>) {
    const parts: string[] = [];
    for (const value of values) {
      if (!value) continue;
      try {
        parts.push(JSON.stringify(value));
      } catch {
        parts.push(String(value));
      }
    }
    return parts.join(' ');
  }

  private resolveSummaryAnomaly(summary: BusinessStatSummary, contexts: VerificationSourceContext[]) {
    const amount = this.normalizeAnomalyAmount(summary.amountTotal);

    const suspected = contexts.find((item) => item.anomalyClassification === 'suspected_test_data');
    if (suspected) {
      return {
        classification: suspected.anomalyClassification,
        reason: suspected.anomalyReason,
      };
    }

    if (amount === '5.00' && contexts.some((item) => item.sourceTable.startsWith('user_shopping_card'))) {
      return {
        classification: 'special_business_case',
        reason: 'summary amount is driven by card-balance style source records',
      };
    }

    if (amount === '0.00' && summary.rewardEventCount === 0) {
      return {
        classification: 'special_business_case',
        reason: 'tag-only summary row with no reward event amount',
      };
    }

    if (amount === '0.00' && contexts.some((item) => ['work_orders', 'repair_order'].includes(item.sourceTable))) {
      return {
        classification: 'needs_review',
        reason: 'zero-amount work-order style summary needs manual review',
      };
    }

    if (amount === '0.00') {
      return {
        classification: 'special_business_case',
        reason: 'zero-amount summary is more likely display-layer zero or special business case',
      };
    }

    return {
      classification: null,
      reason: null,
    };
  }

  private resolveSummaryPaymentClassification(
    contexts: VerificationSourceContext[],
  ): SourcePaymentClassification | null {
    if (!contexts.length) {
      return null;
    }

    const primaryContext = this.pickPrimarySummaryContext(contexts) ?? contexts[0];
    const anyUnpaid = contexts.some((item) => item.paymentStatus === 'unpaid');
    const anyTest = contexts.some((item) => item.isTestData || item.paymentStatus === 'test_data');
    const allPaid = contexts.every((item) => item.isPaid && !item.isTestData);
    const uniquePaymentStatuses = new Set(contexts.map((item) => item.paymentStatus));
    const uniqueSettlementTypes = new Set(contexts.map((item) => item.settlementType));
    const uniqueSourceClassifications = new Set(contexts.map((item) => item.sourceClassification));
    const uniqueReconciliationStatuses = new Set(contexts.map((item) => item.reconciliationStatus));

    return {
      paymentStatus:
        uniquePaymentStatuses.size === 1
          ? primaryContext.paymentStatus
          : anyTest
            ? 'test_data'
            : anyUnpaid
              ? 'unpaid'
              : primaryContext.paymentStatus,
      isPaid: allPaid,
      settlementType: uniqueSettlementTypes.size === 1 ? primaryContext.settlementType : 'unknown',
      isTestData: anyTest,
      sourceClassification:
        uniqueSourceClassifications.size === 1 ? primaryContext.sourceClassification : 'other',
      reconciliationStatus:
        uniqueReconciliationStatuses.size === 1 ? primaryContext.reconciliationStatus : 'needs_review',
      reconciliationReason:
        primaryContext.reconciliationReason ??
        this.summarizeVerificationValues(contexts.map((item) => item.reconciliationReason)),
    };
  }

  private resolveSummaryBusinessCategory(
    summary: BusinessStatSummary,
    contexts: VerificationSourceContext[],
    anomalyClassification: string | null,
    formalBenefitContext: SummaryBenefitContext | null,
    hasLegacyWelfareCandidate: boolean,
  ): SummaryBusinessCategory {
    const hasCardSource = contexts.some((item) => item.sourceTable.startsWith('user_shopping_card'));
    const hasGoodsGroupOrderSource = contexts.some((item) => item.sourceTable === 'goods_group_order');
    const hasPointDeduction = contexts.some((item) => {
      if (!item.pointDeductionRaw) return false;
      const numeric = Number(item.pointDeductionRaw);
      return Number.isFinite(numeric) && numeric > 0;
    });
    const hasPointPayment = contexts.some(
      (item) => item.paymentStatus === 'paid_points' || item.sourceClassification === 'points_redemption',
    );
    const normalizedSummaryAmount = this.normalizeAnomalyAmount(summary.amountTotal);
    const normalizedBenefitAmount = this.normalizeAnomalyAmount(formalBenefitContext?.totalAmount ?? null);
    const formalBenefitMatched = Boolean(
      formalBenefitContext &&
        normalizedSummaryAmount &&
        normalizedBenefitAmount &&
        normalizedSummaryAmount === normalizedBenefitAmount &&
        (hasCardSource || !contexts.length),
    );

    if (formalBenefitMatched) {
      return {
        category: 'employee_welfare_card',
        reason: `matched formal benefit issue ${formalBenefitContext?.issueNo ?? ''}`.trim(),
      };
    }

    if (hasLegacyWelfareCandidate) {
      return {
        category: 'needs_review',
        reason: 'legacy_welfare_candidate found in old card ledger, keep separated from formal benefit chain',
      };
    }

    if (anomalyClassification === 'needs_review') {
      return {
        category: 'needs_review',
        reason: 'summary row is marked as needs_review by anomaly audit',
      };
    }

    if (anomalyClassification === 'special_business_case') {
      return {
        category: 'special_business_case',
        reason: 'summary row is marked as special_business_case by anomaly audit',
      };
    }

    if (hasCardSource && (hasPointPayment || hasPointDeduction || normalizedSummaryAmount === '0.00')) {
      return {
        category: 'c_points_redemption',
        reason: 'card source contains point deduction or zero-cash redemption evidence',
      };
    }

    if (hasCardSource && hasGoodsGroupOrderSource) {
      return {
        category: 'a_plus_c_linked_sale',
        reason: 'card and A-side order source found in the same summary context',
      };
    }

    if (hasCardSource) {
      return {
        category: 'b_shopping_card',
        reason: 'summary context is mainly card-source records',
      };
    }

    if (hasGoodsGroupOrderSource) {
      return {
        category: 'a_sales',
        reason: 'summary context is mainly A-side goods_group_order records',
      };
    }

    return {
      category: 'needs_review',
      reason: 'insufficient source evidence for stable monthly business classification',
    };
  }

  private resolveSummaryBCardStats(
    contexts: VerificationSourceContext[],
    businessCategory: SummaryBusinessCategory['category'],
    formalBenefitContext: SummaryBenefitContext | null,
    hasLegacyWelfareCandidate: boolean,
  ): SummaryBCardStats {
    const cardContexts = contexts.filter((context) =>
      ['shopping_card', 'user_shopping_card', 'user_shopping_card_money', 'user_shopping_card_recharge'].includes(
        context.sourceTable,
      ),
    );
    const effectiveCardContexts = cardContexts.filter(
      (context) =>
        context.paymentStatus !== 'unpaid' &&
        context.paymentStatus !== 'test_data' &&
        context.paymentStatus !== 'internal_admin' &&
        !context.isTestData,
    );

    if (!cardContexts.length && !formalBenefitContext && !hasLegacyWelfareCandidate) {
      return {
        issuedAmount: '0.00',
        consumedAmount: '0.00',
        remainingAmount: '0.00',
        issueCount: 0,
        consumeCount: 0,
        sourceType: null,
        sourceReason: null,
      };
    }

    let issuedAmount = 0;
    let consumedAmount = 0;
    let remainingAmount = 0;
    let issueCount = 0;
    let consumeCount = 0;

    for (const context of effectiveCardContexts) {
      const issued = this.parseSummaryBCardAmount(context.cardIssuedAmountRaw ?? context.totalPriceRaw);
      const balance = this.parseSummaryBCardAmount(context.cardBalanceAmountRaw);
      const ledgerType = (context.cardLedgerType ?? '').toLowerCase();

      if (context.sourceTable === 'user_shopping_card') {
        if (issued !== null) {
          issuedAmount += issued;
          issueCount += 1;
        }
        if (balance !== null) {
          remainingAmount += balance;
        }
        if (issued !== null && balance !== null && issued > balance) {
          consumedAmount += issued - balance;
          consumeCount += 1;
        }
        continue;
      }

      if (context.sourceTable === 'user_shopping_card_recharge') {
        if (issued !== null) {
          issuedAmount += issued;
          issueCount += 1;
        }
        continue;
      }

      if (context.sourceTable === 'user_shopping_card_money') {
        const amount = this.parseSummaryBCardAmount(context.totalPriceRaw ?? context.cardIssuedAmountRaw);
        if (amount !== null && /consume|deduct|payment|pay|spend/.test(ledgerType)) {
          consumedAmount += amount;
          consumeCount += 1;
        }
        if (balance !== null) {
          remainingAmount += balance;
        }
      }
    }

    const hasPointsEvidence = effectiveCardContexts.some((context) => {
      const ledgerType = (context.cardLedgerType ?? '').toLowerCase();
      return (
        businessCategory === 'c_points_redemption' ||
        context.paymentStatus === 'paid_points' ||
        context.sourceClassification === 'points_redemption' ||
        ledgerType.includes('points') ||
        Boolean(context.pointDeductionRaw && Number(context.pointDeductionRaw) > 0)
      );
    });
    const hasALinkedEvidence = businessCategory === 'a_plus_c_linked_sale';
    const hasTestEvidence = cardContexts.some(
      (context) =>
        context.paymentStatus === 'test_data' ||
        context.paymentStatus === 'internal_admin' ||
        context.isTestData,
    );
    const hasManualActivityEvidence = effectiveCardContexts.some(
      (context) => context.sourceClassification === 'manual_activity',
    );
    const sourceType: SummaryBCardStats['sourceType'] =
      formalBenefitContext || hasLegacyWelfareCandidate
        ? 'issued_by_employee_welfare'
        : hasTestEvidence && !effectiveCardContexts.length
          ? 'issued_by_test'
        : hasPointsEvidence
          ? 'issued_by_points_redemption'
          : hasALinkedEvidence
            ? 'issued_by_ac_bundle'
            : hasManualActivityEvidence
              ? 'issued_by_manual_activity'
              : cardContexts.length
                ? 'issued_by_other'
                : null;

    const sourceReason =
      sourceType === 'issued_by_employee_welfare'
        ? 'matched formal employee benefit chain or legacy welfare candidate'
        : sourceType === 'issued_by_test'
          ? 'card source is test/internal/unpaid-like and excluded from effective B-card issued amount'
          : sourceType === 'issued_by_points_redemption'
            ? 'card source contains points redemption evidence and is kept separate from cash income'
          : sourceType === 'issued_by_ac_bundle'
            ? 'A-side and card sources are linked in the same summary context'
            : sourceType === 'issued_by_manual_activity'
              ? 'card source looks like manual activity issuance'
              : sourceType === 'issued_by_other'
                ? 'card source exists but is not stable enough for AC/welfare/points classification'
                : null;

    if (cardContexts.length && !effectiveCardContexts.length && !formalBenefitContext && !hasLegacyWelfareCandidate) {
      return {
        issuedAmount: '0.00',
        consumedAmount: '0.00',
        remainingAmount: '0.00',
        issueCount: 0,
        consumeCount: 0,
        sourceType,
        sourceReason,
      };
    }

    return {
      issuedAmount: this.formatSummaryBCardAmount(issuedAmount),
      consumedAmount: this.formatSummaryBCardAmount(consumedAmount),
      remainingAmount: this.formatSummaryBCardAmount(remainingAmount),
      issueCount,
      consumeCount,
      sourceType,
      sourceReason,
    };
  }

  private parseSummaryBCardAmount(value: string | null | undefined) {
    if (!value) return null;
    const parsed = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private formatSummaryBCardAmount(value: number) {
    return value.toFixed(2);
  }

  private resolveSummaryBundleEvidence(
    contexts: VerificationSourceContext[],
    bCardStats: SummaryBCardStats,
  ): SummaryBundleEvidence {
    const paidAContexts = contexts.filter(
      (context) =>
        context.sourceTable === 'goods_group_order' &&
        context.goodsGroupId === '47' &&
        context.isPaid &&
        context.paymentStatus === 'paid_cash' &&
        !context.isTestData &&
        this.isSummaryAmountEqual(context.totalPriceRaw, 600),
    );
    const paidCContexts = contexts.filter(
      (context) =>
        context.sourceTable === 'goods_group_order' &&
        context.goodsGroupId !== '47' &&
        context.isPaid &&
        context.paymentStatus === 'paid_cash' &&
        !context.isTestData &&
        this.isSummaryAmountEqual(context.totalPriceRaw, 200),
    );
    const hasExternalBundle1000 = contexts.some((context) => {
      const packageText = `${context.externalCardSalesPackageName ?? ''} ${context.packageName ?? ''}`.toLowerCase();
      return (
        this.isSummaryAmountEqual(context.externalCardSalesAmount, 1000) ||
        packageText.includes('1000') ||
        packageText.includes('1a2c')
      );
    });
    const bCardIssued600 = this.isSummaryAmountEqual(bCardStats.issuedAmount, 600);
    const linkedPaidAAmount = paidAContexts.reduce(
      (sum, context) => sum + (this.parseSummaryBCardAmount(context.totalPriceRaw) ?? 0),
      0,
    );
    const linkedWindowDays = this.resolveSummaryBundleWindowDays(contexts);
    const linkedBCardSourceType = bCardStats.sourceType;
    const disallowedBCardSources: Array<NonNullable<SummaryBCardStats['sourceType']>> = [
      'issued_by_points_redemption',
      'issued_by_employee_welfare',
      'issued_by_manual_activity',
      'issued_by_test',
    ];

    if (linkedBCardSourceType && disallowedBCardSources.includes(linkedBCardSourceType)) {
      return {
        bundleEvidenceStrong: false,
        missingCItemSuspected: false,
        bundleInferenceReason: `B端购物卡来源为 ${linkedBCardSourceType}，不能用于推断1000套餐缺失C端`,
        linkedBCardAmount: bCardStats.issuedAmount,
        linkedBCardSourceType,
        linkedPaidAAmount: linkedPaidAAmount > 0 ? this.formatSummaryBCardAmount(linkedPaidAAmount) : null,
        linkedBundleWindowDays: linkedWindowDays,
      };
    }

    const bundleEvidenceStrong =
      paidAContexts.length > 0 &&
      bCardIssued600 &&
      linkedBCardSourceType === 'issued_by_ac_bundle' &&
      hasExternalBundle1000;
    const missingCItemSuspected = bundleEvidenceStrong && paidCContexts.length < 2;
    const missingPieces: string[] = [];

    if (!paidAContexts.length) {
      missingPieces.push('未找到A端600元已支付记录');
    }
    if (!bCardIssued600 || linkedBCardSourceType !== 'issued_by_ac_bundle') {
      missingPieces.push('未找到600元且来源为A+C联动的B端购物卡证据');
    }
    if (!hasExternalBundle1000) {
      missingPieces.push('办卡明细未命中1000元套餐证据');
    }
    if (bundleEvidenceStrong && paidCContexts.length >= 2) {
      missingPieces.push('当前系统已找到2个C端200元记录，不标记缺失');
    }

    return {
      bundleEvidenceStrong,
      missingCItemSuspected,
      bundleInferenceReason: missingCItemSuspected
        ? `同手机号命中A端600元已支付、B端600元A+C联动发放、办卡明细1000元套餐；当前仅找到${paidCContexts.length}个C端200元记录，疑似缺失C端，仅作只读证据`
        : missingPieces.join('；') || '套餐证据不足，保留人工核对',
      linkedBCardAmount: bCardStats.issuedAmount,
      linkedBCardSourceType,
      linkedPaidAAmount: linkedPaidAAmount > 0 ? this.formatSummaryBCardAmount(linkedPaidAAmount) : null,
      linkedBundleWindowDays: linkedWindowDays,
    };
  }

  private isSummaryAmountEqual(value: string | null | undefined, expected: number) {
    const parsed = this.parseSummaryBCardAmount(value);
    return parsed !== null && Math.abs(parsed - expected) < 0.01;
  }

  private resolveSummaryBundleWindowDays(contexts: VerificationSourceContext[]) {
    const timestamps = contexts
      .map((context) => {
        const raw = context.purchaseTime;
        if (!raw) return null;
        const time = new Date(raw).getTime();
        return Number.isFinite(time) ? time : null;
      })
      .filter((item): item is number => item !== null);
    if (timestamps.length < 2) {
      return null;
    }

    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    return Math.round((max - min) / (24 * 60 * 60 * 1000));
  }

  private async loadFormalEmployeeBenefitSummaryContextMap(summaries: BusinessStatSummary[]) {
    const result = new Map<number, SummaryBenefitContext>();
    const scopedSummaries = summaries.filter(
      (summary) =>
        Number.isInteger(summary.responsibleEmployeeId ?? null) &&
        summary.responsibleEmployeeId !== null &&
        Boolean(summary.periodKey),
    );
    if (!scopedSummaries.length) {
      return result;
    }

    const employeeIds = [
      ...new Set(
        scopedSummaries
          .map((summary) => summary.responsibleEmployeeId)
          .filter((item): item is number => Number.isInteger(item)),
      ),
    ];
    const periodKeys = [...new Set(scopedSummaries.map((summary) => summary.periodKey).filter(Boolean))];
    if (!employeeIds.length || !periodKeys.length) {
      return result;
    }

    const issues = await this.employeeBenefitIssueRepository.find({
      where: {
        employeeId: In(employeeIds),
        periodKey: In(periodKeys),
        issueType: 'monthly_benefit',
      },
      order: { id: 'DESC' },
    });
    if (!issues.length) {
      return result;
    }

    const issueByKey = new Map<string, EmployeeBenefitIssue>();
    for (const issue of issues) {
      const key = `${issue.employeeId}::${issue.periodKey}`;
      if (!issueByKey.has(key)) {
        issueByKey.set(key, issue);
      }
    }

    const issueIds = [...new Set(Array.from(issueByKey.values()).map((issue) => issue.id))];
    const issueItems = await this.employeeBenefitIssueItemRepository.find({
      where: { issueId: In(issueIds), itemType: 'benefit_card' },
      order: { id: 'DESC' },
    });
    const itemByIssueId = new Map<number, EmployeeBenefitIssueItem>();
    for (const item of issueItems) {
      if (!itemByIssueId.has(item.issueId)) {
        itemByIssueId.set(item.issueId, item);
      }
    }

    const issueItemIds = [...new Set(Array.from(itemByIssueId.values()).map((item) => item.id))];
    const cardRecords = issueItemIds.length
      ? await this.employeeBenefitCardRecordRepository.find({
          where: { issueItemId: In(issueItemIds) },
          order: { id: 'DESC' },
        })
      : [];
    const cardRecordByIssueItemId = new Map<number, EmployeeBenefitCardRecord>();
    for (const cardRecord of cardRecords) {
      if (!cardRecordByIssueItemId.has(cardRecord.issueItemId)) {
        cardRecordByIssueItemId.set(cardRecord.issueItemId, cardRecord);
      }
    }

    const cardRecordIds = [...new Set(cardRecords.map((cardRecord) => cardRecord.id))];
    const notifications = cardRecordIds.length
      ? await this.employeeBenefitNotificationRepository.find({
          where: { cardRecordId: In(cardRecordIds) },
        })
      : [];
    const notifiedCardRecordIds = new Set<number>(notifications.map((item) => item.cardRecordId));

    for (const summary of scopedSummaries) {
      const key = `${summary.responsibleEmployeeId}::${summary.periodKey}`;
      const issue = issueByKey.get(key);
      if (!issue) continue;

      const item = itemByIssueId.get(issue.id);
      const cardRecord = item ? cardRecordByIssueItemId.get(item.id) : null;
      result.set(summary.id, {
        issueNo: issue.issueNo,
        periodKey: issue.periodKey,
        issueType: issue.issueType,
        issueStatus: issue.status,
        totalAmount: issue.totalAmount,
        validityDays: cardRecord?.validityDays ?? item?.validityDays ?? null,
        confirmedFlag: Boolean(issue.confirmedFlag),
        issuedFlag: issue.status === 'issued' || Boolean(issue.issuedAt),
        notifiedFlag: cardRecord ? notifiedCardRecordIds.has(cardRecord.id) : false,
      });
    }

    return result;
  }

  private async loadLegacyWelfareCandidateRecordKeySet(records: Array<BusinessStatTag | RewardEvent>) {
    const result = new Set<string>();
    const pool = this.getAbcSourceReadonlyPool();
    if (!pool) {
      return result;
    }

    const sourceIds = [
      ...new Set(
        records
          .filter((record) => record.sourceTable === 'user_shopping_card')
          .map((record) => record.sourceId)
          .filter(Boolean),
      ),
    ];
    if (!sourceIds.length) {
      return result;
    }

    try {
      const placeholders = sourceIds.map(() => '?').join(', ');
      const [rows] = await pool.query<any[]>(
        `SELECT user_card_id
           FROM user_shopping_card_money
          WHERE user_card_id IN (${placeholders})
            AND (remark LIKE '%公司福利%' OR remark LIKE '%福利%')
            AND (
              ABS(CAST(amount AS DECIMAL(18,2))) = 200
              OR ABS(CAST(amount AS DECIMAL(18,2))) = 20000
            )`,
        sourceIds,
      );
      for (const row of rows) {
        const sourceId = this.normalizeVerificationSourceString(row.user_card_id);
        if (!sourceId) continue;
        result.add(this.buildSourceRecordKey('user_shopping_card', sourceId));
      }
      return result;
    } catch {
      return result;
    }
  }

  private async loadSummaryPayrollDecisionContextMap(summaries: BusinessStatSummary[]) {
    const result = new Map<number, SummaryPayrollDecisionContext>();
    if (!summaries.length) {
      return result;
    }

    const summaryIds = summaries.map((summary) => summary.id);
    const rewardEventIds = [
      ...new Set(
        summaries.flatMap((summary) => this.readNumberArray(summary.normalizedPayload?.rewardEventIds)),
      ),
    ];
    const summaryDetailRows = await this.payrollTrialItemDetailRepository.find({
      where: {
        detailType: PayrollTrialDetailType.BUSINESS_STAT_SUMMARY,
        sourceRecordId: In(summaryIds),
      },
      order: { id: 'DESC' },
    });
    const rewardDetailRows = rewardEventIds.length
      ? await this.payrollTrialItemDetailRepository.find({
          where: {
            detailType: PayrollTrialDetailType.REWARD_EVENT,
            sourceRecordId: In(rewardEventIds),
          },
          order: { id: 'DESC' },
        })
      : [];
    const detailRows = [...summaryDetailRows, ...rewardDetailRows];

    const latestSummaryDetailMap = new Map<number, PayrollTrialItemDetail>();
    const latestRewardDetailMap = new Map<number, PayrollTrialItemDetail>();
    for (const detail of detailRows) {
      if (!detail.sourceRecordId) {
        continue;
      }
      if (detail.detailType === PayrollTrialDetailType.BUSINESS_STAT_SUMMARY) {
        if (!latestSummaryDetailMap.has(detail.sourceRecordId)) {
          latestSummaryDetailMap.set(detail.sourceRecordId, detail);
        }
        continue;
      }
      if (detail.detailType === PayrollTrialDetailType.REWARD_EVENT) {
        if (!latestRewardDetailMap.has(detail.sourceRecordId)) {
          latestRewardDetailMap.set(detail.sourceRecordId, detail);
        }
      }
    }

    for (const summary of summaries) {
      const detailCandidates: PayrollTrialItemDetail[] = [];
      const summaryDetail = latestSummaryDetailMap.get(summary.id);
      if (summaryDetail) {
        detailCandidates.push(summaryDetail);
      }
      for (const rewardEventId of this.readNumberArray(summary.normalizedPayload?.rewardEventIds)) {
        const rewardDetail = latestRewardDetailMap.get(rewardEventId);
        if (rewardDetail) {
          detailCandidates.push(rewardDetail);
        }
      }

      result.set(summary.id, this.resolveSummaryPayrollDecision(summary, detailCandidates));
    }

    return result;
  }

  private resolveSummaryPayrollDecision(
    summary: BusinessStatSummary,
    detailCandidates: PayrollTrialItemDetail[],
  ): SummaryPayrollDecisionContext {
    // Precedence is strict:
    // 1) included_whitelist if any linked payroll detail is already included
    // 2) pending_confirmation if linked details are still blocked
    // 3) reference_only for explanation-only summaries
    // This keeps the manual confirmation boundary intact.
    const includedDetail = detailCandidates.find((detail) => detail.includedFlag);
    if (includedDetail) {
      return {
        decision: 'included_whitelist',
        blockReason: null,
        decisionReason:
          includedDetail.includedReason ??
          '存在已进入工资试算白名单的明细，当前汇总可作为工资试算准入范围的解释结果',
      };
    }

    const pendingDetails = detailCandidates.filter((detail) => detail.pendingFlag);
    if (pendingDetails.length) {
      const rankedPending = [...pendingDetails].sort(
        (left, right) =>
          this.getPayrollReasonPriority(this.extractPrimaryPayrollReasonCode(left)) -
          this.getPayrollReasonPriority(this.extractPrimaryPayrollReasonCode(right)),
      );
      const primary = rankedPending[0];
      return {
        decision: 'pending_confirmation',
        blockReason: this.extractPrimaryPayrollReasonCode(primary),
        decisionReason: primary.excludedReason ?? '当前汇总仍存在待确认工资试算明细',
      };
    }

    const referenceDetail = detailCandidates.find((detail) => !detail.pendingFlag);
    if (referenceDetail) {
      return {
        decision: 'reference_only',
        blockReason: this.extractPrimaryPayrollReasonCode(referenceDetail),
        decisionReason:
          referenceDetail.excludedReason ?? '当前汇总仅用于展示、对账和解释，不直接形成正式工资结论',
      };
    }

    if (!summary.responsibleEmployeeId) {
      return {
        decision: 'pending_confirmation',
        blockReason: 'missing_employee_binding',
        decisionReason: '当前汇总缺少员工绑定，仅保留待确认',
      };
    }

    if (!summary.confirmedFlag) {
      return {
        decision: 'pending_confirmation',
        blockReason: 'missing_confirmation_status',
        decisionReason: '当前汇总缺少确认状态，仅保留待确认',
      };
    }

    return {
      decision: 'reference_only',
      blockReason: 'reference_only',
      decisionReason: '当前汇总默认作为统计解释来源，不直接纳入正式工资结论',
    };
  }

  private extractPrimaryPayrollReasonCode(detail: PayrollTrialItemDetail) {
    const reasonCodes = Array.isArray(detail.normalizedPayload?.reasonCodes)
      ? (detail.normalizedPayload.reasonCodes as string[])
      : [];
    const primaryReasonCode =
      typeof detail.normalizedPayload?.primaryReasonCode === 'string'
        ? detail.normalizedPayload.primaryReasonCode
        : null;
    return primaryReasonCode ?? reasonCodes[0] ?? null;
  }

  private getPayrollReasonPriority(reasonCode: string | null) {
    switch (reasonCode) {
      case 'missing_confirmation_status':
        return 1;
      case 'missing_employee_binding':
        return 2;
      case 'insufficient_evidence':
        return 3;
      case 'unknown_merchant_attribution':
        return 4;
      case 'not_in_whitelist':
        return 5;
      case 'weak_rule':
        return 6;
      case 'reference_only':
        return 7;
      case 'ignored':
        return 8;
      default:
        return 99;
    }
  }

  private pickPrimarySummaryContext(contexts: VerificationSourceContext[]) {
    if (!contexts.length) {
      return null;
    }

    // Phone is the primary business anchor; plate only helps as secondary context.
    return [...contexts].sort((left, right) => this.scoreSummaryContext(right) - this.scoreSummaryContext(left))[0];
  }

  private scoreSummaryContext(context: VerificationSourceContext) {
    let score = 0;
    if (context.customerMobile) score += 100;
    if (context.purchaseTime) score += 20;
    if (context.sourceTable === 'goods_group_order') score += 10;
    if (context.sourceOrderNo) score += 5;
    if (context.customerName) score += 3;
    if (context.carPlate) score += 1;
    return score;
  }

  private isOrderSourceTable(sourceTable: string) {
    return ['order', 'repair_order', 'supermarket_order', 'top_up_order', 'goods_group_order'].includes(
      sourceTable,
    );
  }

  private isCardSourceTable(sourceTable: string) {
    return [
      'goods_group',
      'shopping_card',
      'user_shopping_card',
      'user_shopping_card_money',
      'user_shopping_card_recharge',
    ].includes(sourceTable);
  }

  private isTransactionSourceTable(sourceTable: string) {
    return sourceTable === 'transaction';
  }

  private summarizeVerificationValues(values: Array<string | null | undefined>) {
    const normalized = [
      ...new Set(values.map((item) => item?.trim()).filter((item): item is string => Boolean(item))),
    ];
    if (!normalized.length) return null;
    if (normalized.length === 1) return normalized[0];
    return `${normalized[0]} 等${normalized.length}项`;
  }

  private summarizeVerificationDates(values: Array<string | null | undefined>) {
    const normalized = [...new Set(values.filter((item): item is string => Boolean(item)))].sort();
    if (!normalized.length) return null;
    if (normalized.length === 1) return normalized[0];
    return `${normalized[0]} ~ ${normalized[normalized.length - 1]}`;
  }

  private pickVerificationString(...values: Array<string | null | undefined>) {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return null;
  }

  private readStringFromPathCandidates(
    sources: Array<Record<string, unknown> | null | undefined>,
    pathCandidates: string[][],
  ) {
    for (const source of sources) {
      if (!source) continue;
      for (const path of pathCandidates) {
        const value = this.readNestedValue(source, ...path);
        if (value === undefined || value === null || value === '') continue;
        const normalized = String(value).trim();
        if (normalized) {
          return normalized;
        }
      }
    }
    return null;
  }

  private readNestedValue(value: Record<string, unknown> | null | undefined, ...path: string[]) {
    let current: unknown = value;
    for (const key of path) {
      if (!current || typeof current !== 'object' || !(key in current)) {
        return null;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private getSingleDistinctVerificationValue(values: Array<string | null | undefined>) {
    const normalized = [
      ...new Set(values.map((item) => item?.trim()).filter((item): item is string => Boolean(item))),
    ];
    if (normalized.length === 1) {
      return normalized[0];
    }
    return null;
  }

  private scoreToConfidence(score: number) {
    const normalized = Math.max(0.5, Math.min(0.99, score / 100));
    return normalized.toFixed(4);
  }

  private canViewFullVerificationContext(
    currentUser: CurrentUser | null | undefined,
    mode: VerificationContextViewMode,
  ) {
    void mode;
    return canViewFullContact(currentUser);
  }

  private applyVerificationMask(
    value: string | null,
    kind: 'name' | 'mobile' | 'plate',
    currentUser: CurrentUser | null | undefined,
    mode: VerificationContextViewMode,
  ) {
    if (!value) return null;
    if (this.canViewFullVerificationContext(currentUser, mode)) {
      return value;
    }

    if (kind === 'name') {
      if (value.length <= 1) return '*';
      if (value.length === 2) return `${value.slice(0, 1)}*`;
      return `${value.slice(0, 1)}${'*'.repeat(Math.max(1, value.length - 2))}${value.slice(-1)}`;
    }

    if (kind === 'mobile') {
      return maskPhoneNumber(value) ?? '****';
    }

    if (kind === 'plate') {
      return `***${value.slice(-4)}`;
    }

    return value;
  }

  private normalizeAnomalyAmount(value: string | null | undefined) {
    if (!value) return null;
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return null;
    return normalized.toFixed(2);
  }

  private formatVerificationDate(value: unknown) {
    if (!value) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    const numeric = Number(raw);
    let date: Date | null = null;
    if (Number.isFinite(numeric) && /^\d+$/.test(raw)) {
      if (raw.length === 10) date = new Date(numeric * 1000);
      else if (raw.length === 13) date = new Date(numeric);
    }

    if (!date) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        date = parsed;
      }
    }

    if (!date || Number.isNaN(date.getTime())) {
      return raw;
    }

    const pad = (item: number) => String(item).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private mapStatTag(
    record: BusinessStatTag,
    verificationContext: VerificationSourceContext | null = null,
    customerBindingContext: CustomerIdentificationBindingContext | null = null,
    currentUser?: CurrentUser | null,
    mode: VerificationContextViewMode = 'list',
  ) {
    return {
      id: record.id,
      tagCode: record.tagCode,
      sourceSystem: record.sourceSystem,
      sourceTable: record.sourceTable,
      sourceId: record.sourceId,
      sourceOrderNo: record.sourceOrderNo,
      businessDomain: record.businessDomain,
      merchantId: record.merchantId,
      storeId: record.storeId,
      responsibleEmployeeId: record.responsibleEmployeeId,
      responsibleEmployeeName: record.responsibleEmployee?.name ?? null,
      customerId: record.customerId,
      vehicleType: record.vehicleType,
      insuranceFlag: record.insuranceFlag,
      occurredAt: record.occurredAt,
      periodKey: record.periodKey,
      confirmedFlag: record.confirmedFlag,
      customerName: verificationContext?.customerName ?? null,
      customerMobile: verificationContext?.customerMobile ?? null,
      carPlate: verificationContext?.carPlate ?? null,
      sourceCustomerMobile: this.applyVerificationMask(
        verificationContext?.sourceCustomerMobile ?? null,
        'mobile',
        currentUser,
        mode,
      ),
      sourceCustomerNameAlias: this.applyVerificationMask(
        verificationContext?.sourceCustomerNameAlias ?? null,
        'name',
        currentUser,
        mode,
      ),
      matchedCustomerId: verificationContext?.matchedCustomerId ?? null,
      matchedCustomerName: this.applyVerificationMask(
        verificationContext?.matchedCustomerName ?? null,
        'name',
        currentUser,
        mode,
      ),
      matchedCustomerMobile: this.applyVerificationMask(
        verificationContext?.matchedCustomerMobile ?? null,
        'mobile',
        currentUser,
        mode,
      ),
      matchedOrderId: verificationContext?.matchedOrderId ?? null,
      matchedOrderNo: verificationContext?.matchedOrderNo ?? null,
      matchedSourceTable: verificationContext?.matchedSourceTable ?? null,
      matchConfidence: verificationContext?.matchConfidence ?? null,
      matchReason: verificationContext?.matchReason ?? null,
      evidenceSummary: verificationContext?.evidenceSummary ?? null,
      purchaseTime: verificationContext?.purchaseTime ?? null,
      packageName: verificationContext?.packageName ?? null,
      merchantName: verificationContext?.merchantName ?? null,
      merchantContact: verificationContext?.merchantContact ?? null,
      goodsGroupId: verificationContext?.goodsGroupId ?? null,
      paymentStatus: verificationContext?.paymentStatus ?? null,
      isPaid: verificationContext?.isPaid ?? null,
      settlementType: verificationContext?.settlementType ?? null,
      isTestData: verificationContext?.isTestData ?? null,
      sourceClassification: verificationContext?.sourceClassification ?? null,
      reconciliationStatus: verificationContext?.reconciliationStatus ?? null,
      reconciliationReason: verificationContext?.reconciliationReason ?? null,
      anomalyClassification: verificationContext?.anomalyClassification ?? null,
      anomalyReason: verificationContext?.anomalyReason ?? null,
      customerBinding: this.mapCustomerIdentificationBinding(
        customerBindingContext,
        currentUser,
        mode,
      ),
      verificationContext: verificationContext
        ? this.mapVerificationContextView(verificationContext, currentUser, mode)
        : null,
      remark: record.remark,
      normalizedPayload: record.normalizedPayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapRewardEvent(
    record: RewardEvent,
    currentUser: CurrentUser,
    verificationContext: VerificationSourceContext | null = null,
    customerBindingContext: CustomerIdentificationBindingContext | null = null,
    mode: VerificationContextViewMode = 'list',
  ) {
    return {
      id: record.id,
      eventType: record.eventType,
      sourceSystem: record.sourceSystem,
      sourceTable: record.sourceTable,
      sourceId: record.sourceId,
      sourceOrderNo: record.sourceOrderNo,
      businessDomain: record.businessDomain,
      merchantId: record.merchantId,
      storeId: record.storeId,
      responsibleEmployeeId: record.responsibleEmployeeId,
      responsibleEmployeeName: record.responsibleEmployee?.name ?? null,
      customerId: record.customerId,
      vehicleType: record.vehicleType,
      insuranceFlag: record.insuranceFlag,
      amountStandard: this.maskAmountByRole(record.amountStandard, currentUser),
      quantityStandard: record.quantityStandard,
      occurredAt: record.occurredAt,
      periodKey: record.periodKey,
      confirmedFlag: record.confirmedFlag,
      ignoredFlag: record.ignoredFlag,
      customerName: verificationContext?.customerName ?? null,
      customerMobile: verificationContext?.customerMobile ?? null,
      carPlate: verificationContext?.carPlate ?? null,
      sourceCustomerMobile: this.applyVerificationMask(
        verificationContext?.sourceCustomerMobile ?? null,
        'mobile',
        currentUser,
        mode,
      ),
      sourceCustomerNameAlias: this.applyVerificationMask(
        verificationContext?.sourceCustomerNameAlias ?? null,
        'name',
        currentUser,
        mode,
      ),
      matchedCustomerId: verificationContext?.matchedCustomerId ?? null,
      matchedCustomerName: this.applyVerificationMask(
        verificationContext?.matchedCustomerName ?? null,
        'name',
        currentUser,
        mode,
      ),
      matchedCustomerMobile: this.applyVerificationMask(
        verificationContext?.matchedCustomerMobile ?? null,
        'mobile',
        currentUser,
        mode,
      ),
      matchedOrderId: verificationContext?.matchedOrderId ?? null,
      matchedOrderNo: verificationContext?.matchedOrderNo ?? null,
      matchedSourceTable: verificationContext?.matchedSourceTable ?? null,
      matchConfidence: verificationContext?.matchConfidence ?? null,
      matchReason: verificationContext?.matchReason ?? null,
      evidenceSummary: verificationContext?.evidenceSummary ?? null,
      purchaseTime: verificationContext?.purchaseTime ?? null,
      packageName: verificationContext?.packageName ?? null,
      merchantName: verificationContext?.merchantName ?? null,
      merchantContact: verificationContext?.merchantContact ?? null,
      goodsGroupId: verificationContext?.goodsGroupId ?? null,
      paymentStatus: verificationContext?.paymentStatus ?? null,
      isPaid: verificationContext?.isPaid ?? null,
      settlementType: verificationContext?.settlementType ?? null,
      isTestData: verificationContext?.isTestData ?? null,
      sourceClassification: verificationContext?.sourceClassification ?? null,
      reconciliationStatus: verificationContext?.reconciliationStatus ?? null,
      reconciliationReason: verificationContext?.reconciliationReason ?? null,
      anomalyClassification: verificationContext?.anomalyClassification ?? null,
      anomalyReason: verificationContext?.anomalyReason ?? null,
      customerBinding: this.mapCustomerIdentificationBinding(
        customerBindingContext,
        currentUser,
        mode,
      ),
      verificationContext: verificationContext
        ? this.mapVerificationContextView(verificationContext, currentUser, mode)
        : null,
      handledBy: record.handledBy,
      handledByName: record.handledByUser?.realName ?? null,
      handledAt: record.handledAt,
      handlingAction: record.handlingAction,
      remark: record.remark,
      normalizedPayload: record.normalizedPayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapCustomerIdentificationBinding(
    context: CustomerIdentificationBindingContext | null,
    currentUser?: CurrentUser | null,
    mode: VerificationContextViewMode = 'list',
  ) {
    if (!context) {
      return null;
    }

    return {
      sourceCustomerName: this.applyVerificationMask(
        context.sourceCustomerName,
        'name',
        currentUser ?? undefined,
        mode,
      ),
      sourceCustomerMobile: this.applyVerificationMask(
        context.sourceCustomerMobile,
        'mobile',
        currentUser ?? undefined,
        mode,
      ),
      sourceCarPlate: this.applyVerificationMask(
        context.sourceCarPlate,
        'plate',
        currentUser ?? undefined,
        mode,
      ),
      matchedCustomerId: context.matchedCustomerId,
      matchedCustomerName: this.applyVerificationMask(
        context.matchedCustomerName,
        'name',
        currentUser ?? undefined,
        mode,
      ),
      matchedCustomerMobile: this.applyVerificationMask(
        context.matchedCustomerMobile,
        'mobile',
        currentUser ?? undefined,
        mode,
      ),
      bindingStatus: context.bindingStatus,
      bindingConfidence: context.bindingConfidence,
      boundBy: context.boundBy,
      boundAt: context.boundAt,
      bindingRemark: context.bindingRemark,
      performanceReadyFlag: context.performanceReadyFlag,
      performanceBlockReason: context.performanceBlockReason,
      performanceDecisionReason: context.performanceDecisionReason,
      taskExecutionCount: context.taskExecutionCount,
      taskOnTimeCount: context.taskOnTimeCount,
      taskConfirmedCount: context.taskConfirmedCount,
      taskRewardEligibleFlag: context.taskRewardEligibleFlag,
      aiTaskScore: context.aiTaskScore,
      aiTaskRemark: context.aiTaskRemark,
    };
  }

  private mapSummaryVerificationContextView(
    context: SummaryVerificationContext | null,
    currentUser?: CurrentUser | null,
    mode: VerificationContextViewMode = 'detail',
  ) {
    if (!context) {
      return null;
    }

    return {
      ...context,
      sourceCustomerMobile: this.applyVerificationMask(
        context.sourceCustomerMobile,
        'mobile',
        currentUser ?? undefined,
        mode,
      ),
      sourceCustomerNameAlias: this.applyVerificationMask(
        context.sourceCustomerNameAlias,
        'name',
        currentUser ?? undefined,
        mode,
      ),
      matchedCustomerName: this.applyVerificationMask(
        context.matchedCustomerName,
        'name',
        currentUser ?? undefined,
        mode,
      ),
      matchedCustomerMobile: this.applyVerificationMask(
        context.matchedCustomerMobile,
        'mobile',
        currentUser ?? undefined,
        mode,
      ),
    };
  }

  private mapVerificationContextView(
    verificationContext: VerificationSourceContext,
    currentUser?: CurrentUser | null,
    mode: VerificationContextViewMode = 'list',
  ) {
    return {
      sourceTable: verificationContext.sourceTable,
      sourceId: verificationContext.sourceId,
      sourceOrderNo: verificationContext.sourceOrderNo,
      customerId: verificationContext.customerId,
      sourceCustomerMobile: this.applyVerificationMask(
        verificationContext.sourceCustomerMobile,
        'mobile',
        currentUser ?? undefined,
        mode,
      ),
      sourceCustomerNameAlias: this.applyVerificationMask(
        verificationContext.sourceCustomerNameAlias,
        'name',
        currentUser ?? undefined,
        mode,
      ),
      customerName: verificationContext.customerName,
      customerMobile: verificationContext.customerMobile,
      carPlate: verificationContext.carPlate,
      matchedCustomerId: verificationContext.matchedCustomerId,
      matchedCustomerName: this.applyVerificationMask(
        verificationContext.matchedCustomerName,
        'name',
        currentUser ?? undefined,
        mode,
      ),
      matchedCustomerMobile: this.applyVerificationMask(
        verificationContext.matchedCustomerMobile,
        'mobile',
        currentUser ?? undefined,
        mode,
      ),
      matchedOrderId: verificationContext.matchedOrderId,
      matchedOrderNo: verificationContext.matchedOrderNo,
      matchedSourceTable: verificationContext.matchedSourceTable,
      matchConfidence: verificationContext.matchConfidence,
      matchReason: verificationContext.matchReason,
      evidenceSummary: verificationContext.evidenceSummary,
      purchaseTime: verificationContext.purchaseTime,
      packageName: verificationContext.packageName,
      merchantName: verificationContext.merchantName,
      merchantContact: verificationContext.merchantContact,
      goodsGroupId: verificationContext.goodsGroupId,
      totalPriceRaw: verificationContext.totalPriceRaw,
      pointDeductionRaw: verificationContext.pointDeductionRaw,
      cardIssuedAmountRaw: verificationContext.cardIssuedAmountRaw,
      cardBalanceAmountRaw: verificationContext.cardBalanceAmountRaw,
      cardLedgerType: verificationContext.cardLedgerType,
      paymentStatus: verificationContext.paymentStatus,
      isPaid: verificationContext.isPaid,
      settlementType: verificationContext.settlementType,
      isTestData: verificationContext.isTestData,
      sourceClassification: verificationContext.sourceClassification,
      reconciliationStatus: verificationContext.reconciliationStatus,
      reconciliationReason: verificationContext.reconciliationReason,
      anomalyClassification: verificationContext.anomalyClassification,
      anomalyReason: verificationContext.anomalyReason,
      fullContextVisible: this.canViewFullVerificationContext(currentUser, mode),
    };
  }

  private mapRewardEventRule(record: RewardEventRule) {
    return {
      id: record.id,
      ruleCode: record.ruleCode,
      ruleName: record.ruleName,
      eventType: record.eventType,
      businessDomain: record.businessDomain,
      requiredTagCode: record.requiredTagCode,
      vehicleType: record.vehicleType,
      insuranceFlag: record.insuranceFlag,
      rewardEnabled: record.rewardEnabled,
      requiresManualConfirmation: record.requiresManualConfirmation,
      defaultWeight: record.defaultWeight,
      defaultCoefficient: record.defaultCoefficient,
      isActive: record.isActive,
      remark: record.remark,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapBusinessStatSummary(
    record: BusinessStatSummary,
    currentUser: CurrentUser,
    verificationContext: SummaryVerificationContext | null = null,
  ) {
    return {
      id: record.id,
      summaryKey: record.summaryKey,
      summaryDomain: record.summaryDomain,
      periodKey: record.periodKey,
      merchantId: record.merchantId,
      storeId: record.storeId,
      responsibleEmployeeId: record.responsibleEmployeeId,
      responsibleEmployeeName: record.responsibleEmployee?.name ?? null,
      customerId: record.customerId,
      tagCount: record.tagCount,
      rewardEventCount: record.rewardEventCount,
      confirmedRewardEventCount: record.confirmedRewardEventCount,
      pendingRewardEventCount: record.pendingRewardEventCount,
      amountTotal: this.maskAmountByRole(record.amountTotal, currentUser),
      quantityTotal: record.quantityTotal,
      customerName: verificationContext?.customerName ?? null,
      customerMobile: verificationContext?.customerMobile ?? null,
      carPlate: verificationContext?.carPlate ?? null,
      sourceCustomerMobile: this.applyVerificationMask(
        verificationContext?.sourceCustomerMobile ?? null,
        'mobile',
        currentUser,
        'detail',
      ),
      sourceCustomerNameAlias: this.applyVerificationMask(
        verificationContext?.sourceCustomerNameAlias ?? null,
        'name',
        currentUser,
        'detail',
      ),
      matchedCustomerId: verificationContext?.matchedCustomerId ?? null,
      matchedCustomerName: this.applyVerificationMask(
        verificationContext?.matchedCustomerName ?? null,
        'name',
        currentUser,
        'detail',
      ),
      matchedCustomerMobile: this.applyVerificationMask(
        verificationContext?.matchedCustomerMobile ?? null,
        'mobile',
        currentUser,
        'detail',
      ),
      matchedOrderId: verificationContext?.matchedOrderId ?? null,
      matchedOrderNo: verificationContext?.matchedOrderNo ?? null,
      matchedSourceTable: verificationContext?.matchedSourceTable ?? null,
      matchConfidence: verificationContext?.matchConfidence ?? null,
      matchReason: verificationContext?.matchReason ?? null,
      evidenceSummary: verificationContext?.evidenceSummary ?? null,
      purchaseTime: verificationContext?.purchaseTime ?? null,
      sourceOrderNo: verificationContext?.sourceOrderNo ?? null,
      packageName: verificationContext?.packageName ?? null,
      merchantName: verificationContext?.merchantName ?? null,
      merchantContact: verificationContext?.merchantContact ?? null,
      sourceTableDisplay: verificationContext?.sourceTable ?? null,
      sourceIdDisplay: verificationContext?.sourceId ?? null,
      bCardIssuedAmount: verificationContext?.bCardIssuedAmount ?? '0.00',
      bCardConsumedAmount: verificationContext?.bCardConsumedAmount ?? '0.00',
      bCardRemainingAmount: verificationContext?.bCardRemainingAmount ?? '0.00',
      bCardIssueCount: verificationContext?.bCardIssueCount ?? 0,
      bCardConsumeCount: verificationContext?.bCardConsumeCount ?? 0,
      bCardSourceType: verificationContext?.bCardSourceType ?? null,
      bCardSourceReason: verificationContext?.bCardSourceReason ?? null,
      bundleEvidenceStrong: verificationContext?.bundleEvidenceStrong ?? false,
      missingCItemSuspected: verificationContext?.missingCItemSuspected ?? false,
      bundleInferenceReason: verificationContext?.bundleInferenceReason ?? null,
      linkedBCardAmount: verificationContext?.linkedBCardAmount ?? null,
      linkedBCardSourceType: verificationContext?.linkedBCardSourceType ?? null,
      linkedPaidAAmount: verificationContext?.linkedPaidAAmount ?? null,
      linkedBundleWindowDays: verificationContext?.linkedBundleWindowDays ?? null,
      businessCategory: verificationContext?.businessCategory ?? null,
      businessCategoryReason: verificationContext?.businessCategoryReason ?? null,
      welfareSourceType: verificationContext?.welfareSourceType ?? null,
      benefitIssueNo: verificationContext?.benefitIssueNo ?? null,
      benefitPeriodKey: verificationContext?.benefitPeriodKey ?? null,
      benefitIssueType: verificationContext?.benefitIssueType ?? null,
      benefitIssueStatus: verificationContext?.benefitIssueStatus ?? null,
      benefitAmount: verificationContext?.benefitAmount ?? null,
      benefitValidityDays: verificationContext?.benefitValidityDays ?? null,
      benefitConfirmedFlag: verificationContext?.benefitConfirmedFlag ?? null,
      benefitIssuedFlag: verificationContext?.benefitIssuedFlag ?? null,
      benefitNotifiedFlag: verificationContext?.benefitNotifiedFlag ?? null,
      payrollDecision: verificationContext?.payrollDecision ?? null,
      payrollBlockReason: verificationContext?.payrollBlockReason ?? null,
      payrollDecisionReason: verificationContext?.payrollDecisionReason ?? null,
      paymentStatus: verificationContext?.paymentStatus ?? null,
      isPaid: verificationContext?.isPaid ?? null,
      settlementType: verificationContext?.settlementType ?? null,
      isTestData: verificationContext?.isTestData ?? null,
      sourceClassification: verificationContext?.sourceClassification ?? null,
      reconciliationStatus: verificationContext?.reconciliationStatus ?? null,
      reconciliationReason: verificationContext?.reconciliationReason ?? null,
      anomalyClassification: verificationContext?.anomalyClassification ?? null,
      anomalyReason: verificationContext?.anomalyReason ?? null,
      verificationContext: this.mapSummaryVerificationContextView(
        verificationContext,
        currentUser,
        'detail',
      ),
      confirmedFlag: record.confirmedFlag,
      confirmedBy: record.confirmedBy,
      confirmedByName: record.confirmedByUser?.realName ?? null,
      confirmedAt: record.confirmedAt,
      remark: record.remark,
      normalizedPayload: record.normalizedPayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private hasBusinessStatSummaryDerivedFilters(query: QueryBusinessStatSummariesDto) {
    return Boolean(
      query.dateFrom ||
        query.dateTo ||
      query.businessCategory ||
        query.payrollDecision ||
        query.payrollBlockReason ||
        query.paymentStatus ||
        query.sourceClassification ||
        query.reconciliationStatus,
    );
  }

  private matchesBusinessStatSummaryDerivedFilters(
    item: Record<string, unknown>,
    query: QueryBusinessStatSummariesDto,
  ) {
    return (
      this.matchesDerivedDateRange(item, query.dateFrom, query.dateTo) &&
      this.matchesMultiValueFilter(item.businessCategory, query.businessCategory) &&
      this.matchesMultiValueFilter(item.payrollDecision, query.payrollDecision) &&
      this.matchesMultiValueFilter(item.payrollBlockReason, query.payrollBlockReason) &&
      this.matchesMultiValueFilter(item.paymentStatus, query.paymentStatus) &&
      this.matchesMultiValueFilter(item.sourceClassification, query.sourceClassification) &&
      this.matchesMultiValueFilter(item.reconciliationStatus, query.reconciliationStatus)
    );
  }

  private matchesBusinessStatPendingDerivedFilters(
    item: PendingItemView,
    query: QueryStatPendingItemsDto,
  ) {
    const payload = (item.payload ?? {}) as Record<string, unknown>;
    const customerBinding = (payload.customerBinding ?? {}) as Record<string, unknown>;
    return (
      this.matchesDerivedDateRange(
        {
          occurredAt: item.occurredAt,
          updatedAt: item.updatedAt,
          createdAt: item.createdAt,
          purchaseTime: payload.purchaseTime,
          timeAnchorDate: payload.timeAnchorDate,
          periodKey: payload.periodKey,
        },
        query.dateFrom,
        query.dateTo,
      ) &&
      this.matchesMultiValueFilter(
        customerBinding.performanceBlockReason ?? payload.performanceBlockReason,
        query.performanceBlockReason,
      ) &&
      this.matchesMultiValueFilter(payload.paymentStatus, query.paymentStatus) &&
      this.matchesMultiValueFilter(payload.sourceClassification, query.sourceClassification) &&
      this.matchesMultiValueFilter(payload.reconciliationStatus, query.reconciliationStatus)
    );
  }

  private matchesDerivedDateRange(
    item: Record<string, unknown>,
    dateFrom?: string | null,
    dateTo?: string | null,
  ) {
    if (!dateFrom && !dateTo) {
      return true;
    }

    const anchorCandidates = [
      item.purchaseTime,
      item.occurredAt,
      item.updatedAt,
      item.createdAt,
      item.timeAnchorDate,
      item.periodKey ? `${String(item.periodKey)}-01T00:00:00` : null,
    ];
    const anchorDate = anchorCandidates
      .map((value) => (value ? new Date(String(value)) : null))
      .find((value) => value instanceof Date && !Number.isNaN(value.getTime()));

    if (!anchorDate) {
      return false;
    }

    if (dateFrom) {
      const start = new Date(dateFrom);
      if (!Number.isNaN(start.getTime()) && anchorDate.getTime() < start.getTime()) {
        return false;
      }
    }

    if (dateTo) {
      const end = new Date(dateTo);
      if (!Number.isNaN(end.getTime()) && anchorDate.getTime() > end.getTime()) {
        return false;
      }
    }

    return true;
  }

  private matchesMultiValueFilter(value: unknown, rawFilter?: string | null) {
    const filterValues = this.parseMultiValueFilter(rawFilter);
    if (!filterValues.length) {
      return true;
    }

    const normalizedValue = String(value ?? '').trim().toLowerCase();
    if (!normalizedValue) {
      return false;
    }

    return filterValues.includes(normalizedValue);
  }

  private parseMultiValueFilter(rawFilter?: string | null) {
    if (!rawFilter) {
      return [];
    }

    return String(rawFilter)
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  private maskAmountByRole(amount: string | null, currentUser: CurrentUser) {
    if (!amount) return amount;
    if (currentUser.roleCodes.includes('admin') || currentUser.roleCodes.includes('finance')) {
      return amount;
    }
    return null;
  }

  private readNumberArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
  }

  private readNestedString(
    value: Record<string, unknown> | null | undefined,
    ...path: string[]
  ) {
    let current: unknown = value;
    for (const key of path) {
      if (!current || typeof current !== 'object' || !(key in current)) {
        return null;
      }
      current = (current as Record<string, unknown>)[key];
    }

    if (current === undefined || current === null || current === '') {
      return null;
    }

    return String(current);
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

  private normalizeVerificationSourceString(value: unknown) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
  }

  private normalizeAbcSourceCustomerName(value: unknown, mobile: string | null) {
    const normalized = this.normalizeVerificationSourceString(value);
    if (!normalized) {
      return null;
    }

    const digitsOnly = normalized.replace(/\D/g, '');
    const mobileDigits = mobile?.replace(/\D/g, '') ?? '';
    if ((digitsOnly && digitsOnly === mobileDigits) || /^\d{6,}$/.test(normalized)) {
      return null;
    }

    if (['微信用户', '微信客户', '用户'].includes(normalized)) {
      return null;
    }

    if (looksLikeProjectOrPackageName(normalized)) {
      return null;
    }

    return normalized;
  }
}
