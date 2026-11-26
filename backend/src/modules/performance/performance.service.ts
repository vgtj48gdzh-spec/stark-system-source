import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createPool, Pool } from 'mysql2/promise';
import { In, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  addMoney,
  addQuantity,
  normalizeMoney,
  normalizeQuantity,
} from '../../common/utils/decimal.util';
import { normalizeMainlandMobile } from '../../common/utils/mobile.util';
import { canViewFullContact, maskPhoneNumber } from '../../common/utils/contact-permission.util';
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
import {
  buildPaginationResult,
  getPagination,
  paginateArray,
} from '../../common/utils/pagination.util';
import { PerformanceEventSourceDomain } from '../../shared/enums/performance-event-source-domain.enum';
import { PerformanceHandlingAction } from '../../shared/enums/performance-handling-action.enum';
import { PerformancePeriodStatus } from '../../shared/enums/performance-period-status.enum';
import { PerformancePeriodType } from '../../shared/enums/performance-period-type.enum';
import { AbcRawCard } from '../abc-raw/entities/abc-raw-card.entity';
import { AbcRawOrder } from '../abc-raw/entities/abc-raw-order.entity';
import { AbcRawTransaction } from '../abc-raw/entities/abc-raw-transaction.entity';
import { AbcSyncCardLedger } from '../abc-sync/entities/abc-sync-card-ledger.entity';
import { AbcSyncFund } from '../abc-sync/entities/abc-sync-fund.entity';
import { AbcSyncOrder } from '../abc-sync/entities/abc-sync-order.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { User } from '../users/entities/user.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { ConfirmPerformanceSummaryCustomerBindingDto } from './dto/confirm-performance-summary-customer-binding.dto';
import { CreateEmployeeSourceBindingDto } from './dto/create-employee-source-binding.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { DecidePerformanceSummaryManualDecisionDto } from './dto/decide-performance-summary-manual-decision.dto';
import { GeneratePerformanceEventsDto } from './dto/generate-performance-events.dto';
import { GeneratePerformanceSummariesDto } from './dto/generate-performance-summaries.dto';
import { IgnorePerformanceEventDto } from './dto/ignore-performance-event.dto';
import { QueryEmployeeSourceBindingsDto } from './dto/query-employee-source-bindings.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { QueryPendingPerformanceItemsDto } from './dto/query-pending-performance-items.dto';
import { QueryPerformanceEventsDto } from './dto/query-performance-events.dto';
import { QueryPerformanceRulesDto } from './dto/query-performance-rules.dto';
import { QueryPerformanceSummaryDetailDto } from './dto/query-performance-summary-detail.dto';
import { QueryPerformanceSummariesDto } from './dto/query-performance-summaries.dto';
import { RebindPerformanceEventDto } from './dto/rebind-performance-event.dto';
import { UpdateEmployeeSourceBindingDto } from './dto/update-employee-source-binding.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ConfirmPerformanceEventDto } from './dto/confirm-performance-event.dto';
import { CreatePerformanceRuleDto } from './dto/create-performance-rule.dto';
import { CustomerIdentificationBinding } from './entities/customer-identification-binding.entity';
import { EmployeeSourceBinding } from './entities/employee-source-binding.entity';
import { Employee } from './entities/employee.entity';
import { ExternalCardSalesStaging } from './entities/external-card-sales-staging.entity';
import { PerformanceEvent } from './entities/performance-event.entity';
import { PerformanceEventClassification } from './entities/performance-event-classification.entity';
import { PerformancePeriod } from './entities/performance-period.entity';
import { PerformanceRule } from './entities/performance-rule.entity';
import { PerformanceSummaryManualDecision } from './entities/performance-summary-manual-decision.entity';
import { PerformanceSummary } from './entities/performance-summary.entity';
import { UpdatePerformanceRuleDto } from './dto/update-performance-rule.dto';

type SortDirection = 'ASC' | 'DESC';

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

interface UpsertEventInput {
  employeeId: number | null;
  sourceDomain: PerformanceEventSourceDomain;
  eventType: string;
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  sourceOrderNo: string | null;
  amountStandard: string | null;
  quantityStandard: string | null;
  occurredAt: Date;
  confirmedFlag: boolean;
  remark: string | null;
  normalizedPayload: Record<string, unknown>;
}

export interface EventGenerateSummary {
  sourceDomain: PerformanceEventSourceDomain;
  generatedEvents: number;
  createdEvents: number;
  updatedEvents: number;
  unconfirmedEvents: number;
}

interface UpsertEventResult {
  action: 'created' | 'updated';
  confirmedFlag: boolean;
}

interface PerformanceVerificationSourceContext {
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
  packageName: string | null;
  goodsGroupId: string | null;
  totalPriceRaw: string | null;
  externalCardSalesPackageName: string | null;
  externalCardSalesAmount: string | null;
  cardIssuedAmountRaw: string | null;
  cardBalanceAmountRaw: string | null;
  bundleCItemCountRaw: string | null;
  cardLedgerType: string | null;
  paymentStatus: PerformancePaymentStatus;
  isPaid: boolean;
  settlementType: PerformanceSettlementType;
  isTestData: boolean;
  sourceClassification: PerformanceSourceClassification;
  reconciliationStatus: PerformanceReconciliationStatus;
  reconciliationReason: string | null;
}

interface PerformanceCustomerBindingContext {
  sourceCustomerName: string | null;
  sourceCustomerMobile: string | null;
  sourceCarPlate: string | null;
  matchedCustomerId: string | null;
  matchedCustomerName: string | null;
  matchedCustomerMobile: string | null;
  bindingStatus: 'auto_matched' | 'manual_pending' | 'manually_bound' | 'conflict';
  bindingConfidence: string | null;
  boundBy: number | null;
  boundByName: string | null;
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

interface PerformanceSummaryCandidateRecord {
  event: PerformanceEvent;
  verificationContext: PerformanceVerificationSourceContext | null;
  customerBinding: PerformanceCustomerBindingContext | null;
}

interface PerformanceSummaryCustomerContext {
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
  packageName: string | null;
  paymentStatus: PerformancePaymentStatus | null;
  isPaid: boolean | null;
  settlementType: PerformanceSettlementType | null;
  isTestData: boolean | null;
  sourceClassification: PerformanceSourceClassification | null;
  reconciliationStatus: PerformanceReconciliationStatus | null;
  reconciliationReason: string | null;
  bundleEvidenceStrong: boolean;
  missingCItemSuspected: boolean;
  bundleInferenceReason: string | null;
  linkedBCardAmount: string | null;
  linkedBCardSourceType: PerformanceLinkedBCardSourceType | null;
  linkedPaidAAmount: string | null;
  linkedBundleWindowDays: number | null;
  customerBinding: PerformanceCustomerBindingContext | null;
  performanceReadyFlag: boolean | null;
  performanceBlockReason: PerformanceCustomerBindingContext['performanceBlockReason'];
  performanceDecisionReason: string | null;
  customerBindingSummary: {
    eventCount: number;
    eventCountWithMobile: number;
    distinctCustomerMobileCount: number;
    note: string | null;
  };
}

interface AbcSourceCustomerProfile {
  customerName: string | null;
  customerMobile: string | null;
  carPlate: string | null;
}

interface AbcSourceGoodsGroupOrderProfile {
  userId: string | null;
  purchaseTime: string | null;
  sourceOrderNo: string | null;
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
  matchedOrderNo: string | null;
  matchedSourceTable: string | null;
  matchConfidence: string | null;
  matchReason: string | null;
  evidenceSummary: string | null;
}

type PerformanceVerificationContextViewMode = 'list' | 'detail';

type PerformancePaymentStatus = 'paid_cash' | 'paid_points' | 'unpaid' | 'test_data' | 'internal_admin' | 'unknown';
type PerformanceSettlementType = 'cash' | 'points' | 'none' | 'unknown';
type PerformanceSourceClassification =
  | 'a_card_sale'
  | 'points_redemption'
  | 'manual_activity'
  | 'test_data'
  | 'internal_admin'
  | 'other';
type PerformanceReconciliationStatus =
  | 'matched_sheet'
  | 'sheet_missing'
  | 'bank_verified'
  | 'manual_verified'
  | 'needs_review';

type PerformanceLinkedBCardSourceType =
  | 'issued_by_ac_bundle'
  | 'issued_by_points_redemption'
  | 'issued_by_employee_welfare'
  | 'issued_by_manual_activity'
  | 'issued_by_test'
  | 'issued_by_other';

type PerformanceSummaryManualDecisionAction =
  | 'confirm_binding'
  | 'reject_candidate'
  | 'reassign_customer'
  | 'reclassify_record'
  | 'hold_pending';

type PerformanceManualClassification =
  | 'a_card_sale'
  | 'a_plus_c_bundle'
  | 'points_redemption'
  | 'employee_welfare'
  | 'manual_activity'
  | 'test_data'
  | 'sheet_missing'
  | 'self_recharge'
  | 'other';

type PerformanceManualDecisionScope =
  | 'case_only'
  | 'same_pattern'
  | 'same_product_family'
  | 'same_source_rule'
  | 'global_rule'
  | 'temporary_rule';

type PerformanceManualJudgmentBasis =
  | 'price_abnormal'
  | 'non_catalog_product'
  | 'manual_omission'
  | 'bank_verified'
  | 'paid_fact_overrides_sheet'
  | 'points_redemption'
  | 'employee_test'
  | 'admin_test'
  | 'source_conflict'
  | 'operator_experience'
  | 'other';

type PerformanceManualAiLearningMode =
  | 'do_not_generalize'
  | 'suggest_same_pattern_only'
  | 'can_generalize_with_review'
  | 'treat_as_global_reference';

interface PerformancePaymentClassification {
  paymentStatus: PerformancePaymentStatus;
  isPaid: boolean;
  settlementType: PerformanceSettlementType;
  isTestData: boolean;
  sourceClassification: PerformanceSourceClassification;
  reconciliationStatus: PerformanceReconciliationStatus;
  reconciliationReason: string | null;
}

interface PerformanceBundleEvidence {
  bundleEvidenceStrong: boolean;
  missingCItemSuspected: boolean;
  bundleInferenceReason: string | null;
  linkedBCardAmount: string | null;
  linkedBCardSourceType: PerformanceLinkedBCardSourceType | null;
  linkedPaidAAmount: string | null;
  linkedBundleWindowDays: number | null;
}

interface PerformanceSummaryManualDecisionContext {
  id: number;
  actionType: PerformanceSummaryManualDecisionAction;
  sourceSummaryId: number;
  originalMatchedCustomerId: string | null;
  finalMatchedCustomerId: string | null;
  originalClassification: PerformanceManualClassification | null;
  finalClassification: PerformanceManualClassification | null;
  originalBindingStatus: PerformanceCustomerBindingContext['bindingStatus'] | null;
  finalBindingStatus: PerformanceCustomerBindingContext['bindingStatus'] | null;
  operatorId: number;
  operatorName: string | null;
  operatedAt: Date;
  reasonCode: string | null;
  decisionScope: PerformanceManualDecisionScope;
  judgmentBasis: PerformanceManualJudgmentBasis[];
  aiLearningMode: PerformanceManualAiLearningMode;
  remark: string | null;
  affectPerformanceFlag: boolean;
  affectBCardFlag: boolean;
  normalizedPayload: Record<string, unknown> | null;
}

interface ClassificationSnapshot {
  ruleId: number | null;
  ruleCode: string | null;
  ruleName: string | null;
  classificationKey: string | null;
  includeInPerformance: boolean;
  weight: string;
  coefficient: string;
  requiresManualConfirmation: boolean;
  ruleMatchedFlag: boolean;
}

const EMPLOYEE_SORT_COLUMNS = {
  name: 'employee.name',
  mobile: 'employee.mobile',
  status: 'employee.status',
  importedAt: 'employee.importedAt',
  createdAt: 'employee.createdAt',
  updatedAt: 'employee.updatedAt',
} as const;

const BINDING_SORT_COLUMNS = {
  employeeId: 'binding.employeeId',
  sourceSystem: 'binding.sourceSystem',
  sourceTable: 'binding.sourceTable',
  bindingType: 'binding.bindingType',
  createdAt: 'binding.createdAt',
  updatedAt: 'binding.updatedAt',
} as const;

const EVENT_SORT_COLUMNS = {
  occurredAt: 'event.occurredAt',
  periodKey: 'event.periodKey',
  sourceDomain: 'event.sourceDomain',
  eventType: 'event.eventType',
  amountStandard: 'event.amountStandard',
  quantityStandard: 'event.quantityStandard',
  confirmedFlag: 'event.confirmedFlag',
  createdAt: 'event.createdAt',
  updatedAt: 'event.updatedAt',
} as const;

const SUMMARY_SORT_COLUMNS = {
  periodKey: 'period.periodKey',
  sourceDomain: 'summary.sourceDomain',
  eventCount: 'summary.eventCount',
  confirmedEventCount: 'summary.confirmedEventCount',
  pendingEventCount: 'summary.pendingEventCount',
  amountTotal: 'summary.amountTotal',
  quantityTotal: 'summary.quantityTotal',
  createdAt: 'summary.createdAt',
  updatedAt: 'summary.updatedAt',
} as const;

const RULE_SORT_COLUMNS = {
  sourceDomain: 'rule.sourceDomain',
  eventType: 'rule.eventType',
  ruleCode: 'rule.ruleCode',
  classificationKey: 'rule.classificationKey',
  isActive: 'rule.isActive',
  updatedAt: 'rule.updatedAt',
  createdAt: 'rule.createdAt',
} as const;

const SUMMARY_DETAIL_SORT_COLUMNS = {
  occurredAt: 'event.occurredAt',
  eventType: 'event.eventType',
  confirmedFlag: 'event.confirmedFlag',
  amountStandard: 'event.amountStandard',
  updatedAt: 'event.updatedAt',
} as const;

@Injectable()
export class PerformanceService {
  private abcSourceReadonlyPool: Pool | null | undefined;

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
    @InjectRepository(PerformanceEvent)
    private readonly performanceEventRepository: Repository<PerformanceEvent>,
    @InjectRepository(PerformanceEventClassification)
    private readonly performanceEventClassificationRepository: Repository<PerformanceEventClassification>,
    @InjectRepository(PerformancePeriod)
    private readonly performancePeriodRepository: Repository<PerformancePeriod>,
    @InjectRepository(PerformanceRule)
    private readonly performanceRuleRepository: Repository<PerformanceRule>,
    @InjectRepository(PerformanceSummaryManualDecision)
    private readonly performanceSummaryManualDecisionRepository: Repository<PerformanceSummaryManualDecision>,
    @InjectRepository(PerformanceSummary)
    private readonly performanceSummaryRepository: Repository<PerformanceSummary>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(WorkOrderMaterial)
    private readonly workOrderMaterialRepository: Repository<WorkOrderMaterial>,
    @InjectRepository(AbcSyncOrder)
    private readonly abcSyncOrderRepository: Repository<AbcSyncOrder>,
    @InjectRepository(AbcSyncFund)
    private readonly abcSyncFundRepository: Repository<AbcSyncFund>,
    @InjectRepository(AbcSyncCardLedger)
    private readonly abcSyncCardLedgerRepository: Repository<AbcSyncCardLedger>,
    @InjectRepository(AbcRawOrder)
    private readonly abcRawOrderRepository: Repository<AbcRawOrder>,
    @InjectRepository(AbcRawCard)
    private readonly abcRawCardRepository: Repository<AbcRawCard>,
    @InjectRepository(AbcRawTransaction)
    private readonly abcRawTransactionRepository: Repository<AbcRawTransaction>,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async findEmployees(query: QueryEmployeesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.employeeRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.linkedUser', 'linkedUser');

    if (query.keyword) {
      qb.andWhere(
        '(employee.name LIKE :keyword OR employee.nameRemark LIKE :keyword OR employee.mobile LIKE :keyword OR employee.sourceCompanyName LIKE :keyword OR employee.positionName LIKE :keyword OR employee.importBatchNo LIKE :keyword OR employee.sourceFileName LIKE :keyword OR employee.remark LIKE :keyword OR linkedUser.username LIKE :keyword OR linkedUser.realName LIKE :keyword)',
        { keyword: `%${query.keyword}%` },
      );
    }

    if (query.status !== undefined) {
      qb.andWhere('employee.status = :status', { status: query.status });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        EMPLOYEE_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .addOrderBy('employee.id', this.normalizeSortOrder(query.sortOrder, 'DESC'))
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(
      query,
      list.map((item) => this.mapEmployee(item)),
      total,
    );
  }

  async createEmployee(dto: CreateEmployeeDto, currentUser: CurrentUser) {
    if (dto.linkedUserId) {
      await this.ensureLinkedUserExists(dto.linkedUserId);
      await this.ensureEmployeeLinkedUserIsAvailable(dto.linkedUserId);
    }
    if (dto.referredByEmployeeId) {
      await this.ensureEmployeeExists(dto.referredByEmployeeId);
    }

    const normalizedMobile = this.normalizeEmployeeMobileInput(dto.mobile, '员工手机号');
    if (normalizedMobile) {
      await this.ensureEmployeeMobileIsAvailable(normalizedMobile);
    }

    const normalizedEmployeeName = this.normalizeEmployeeNameInput(dto.name, dto.nameRemark);
    const employee = this.employeeRepository.create({
      name: normalizedEmployeeName.legalName,
      nameRemark: normalizedEmployeeName.nameRemark,
      linkedUserId: dto.linkedUserId ?? null,
      mobile: normalizedMobile ?? null,
      sourceCompanyName: this.resolveEmployeeCompanyName(dto),
      positionName: this.normalizeOptionalString(dto.positionName) ?? null,
      status: dto.status ?? 1,
      sourceFileName: this.normalizeOptionalString(dto.sourceFileName) ?? null,
      sourceRowIndex: dto.sourceRowIndex ?? null,
      importedAt: this.normalizeEmployeeImportedAt(dto.importedAt),
      importBatchNo: this.normalizeOptionalString(dto.importBatchNo) ?? null,
      importConflictNote: this.normalizeOptionalString(dto.importConflictNote) ?? null,
      referralCode: this.normalizeOptionalString(dto.referralCode) ?? null,
      referredByEmployeeId: dto.referredByEmployeeId ?? null,
      referredByEmployeeMobile:
        this.normalizeEmployeeMobileInput(dto.referredByEmployeeMobile, '推荐人手机号') ?? null,
      referralSourceType: this.normalizeOptionalString(dto.referralSourceType) ?? null,
      remark: this.normalizeOptionalString(dto.remark) ?? null,
    });
    const saved = await this.employeeRepository.save(employee);

    await this.operationLogsService.create({
      module: 'performance_employee',
      targetId: saved.id,
      action: 'create_employee',
      operatorId: currentUser.id,
      detail: `创建员工 ${saved.name}`,
      detailJson: {
        employeeId: saved.id,
        employeeName: saved.name,
        linkedUserId: saved.linkedUserId,
      },
    });

    return this.findEmployeeById(saved.id);
  }

  async updateEmployee(id: number, dto: UpdateEmployeeDto, currentUser: CurrentUser) {
    const employee = await this.findEmployeeById(id);
    const before = this.mapEmployee(employee);

    if (dto.linkedUserId && dto.linkedUserId !== employee.linkedUserId) {
      await this.ensureLinkedUserExists(dto.linkedUserId);
      await this.ensureEmployeeLinkedUserIsAvailable(dto.linkedUserId, employee.id);
    }
    if (dto.referredByEmployeeId && dto.referredByEmployeeId !== employee.referredByEmployeeId) {
      await this.ensureEmployeeExists(dto.referredByEmployeeId);
    }

    const nextMobile = this.normalizeEmployeeMobileInput(dto.mobile, '员工手机号');
    if (nextMobile && nextMobile !== employee.mobile) {
      await this.ensureEmployeeMobileIsAvailable(nextMobile, employee.id);
    }

    if (dto.name !== undefined || dto.nameRemark !== undefined) {
      const normalizedEmployeeName = this.normalizeEmployeeNameInput(
        dto.name ?? employee.name,
        dto.nameRemark !== undefined ? dto.nameRemark : employee.nameRemark,
      );
      employee.name = normalizedEmployeeName.legalName;
      employee.nameRemark = normalizedEmployeeName.nameRemark;
    }
    if (dto.linkedUserId !== undefined) employee.linkedUserId = dto.linkedUserId ?? null;
    if (dto.mobile !== undefined) employee.mobile = nextMobile ?? null;
    if (dto.companyName !== undefined || dto.sourceCompanyName !== undefined) {
      employee.sourceCompanyName = this.resolveEmployeeCompanyName(dto);
    }
    if (dto.positionName !== undefined) {
      employee.positionName = this.normalizeOptionalString(dto.positionName) ?? null;
    }
    if (dto.status !== undefined) employee.status = dto.status;
    if (dto.sourceFileName !== undefined) {
      employee.sourceFileName = this.normalizeOptionalString(dto.sourceFileName) ?? null;
    }
    if (dto.sourceRowIndex !== undefined) employee.sourceRowIndex = dto.sourceRowIndex ?? null;
    if (dto.importedAt !== undefined) {
      employee.importedAt = this.normalizeEmployeeImportedAt(dto.importedAt) ?? null;
    }
    if (dto.importBatchNo !== undefined) {
      employee.importBatchNo = this.normalizeOptionalString(dto.importBatchNo) ?? null;
    }
    if (dto.importConflictNote !== undefined) {
      employee.importConflictNote = this.normalizeOptionalString(dto.importConflictNote) ?? null;
    }
    if (dto.referralCode !== undefined) {
      employee.referralCode = this.normalizeOptionalString(dto.referralCode) ?? null;
    }
    if (dto.referredByEmployeeId !== undefined) {
      employee.referredByEmployeeId = dto.referredByEmployeeId ?? null;
    }
    if (dto.referredByEmployeeMobile !== undefined) {
      employee.referredByEmployeeMobile =
        this.normalizeEmployeeMobileInput(dto.referredByEmployeeMobile, '推荐人手机号') ?? null;
    }
    if (dto.referralSourceType !== undefined) {
      employee.referralSourceType = this.normalizeOptionalString(dto.referralSourceType) ?? null;
    }
    if (dto.remark !== undefined) employee.remark = this.normalizeOptionalString(dto.remark) ?? null;

    const saved = await this.employeeRepository.save(employee);

    await this.operationLogsService.create({
      module: 'performance_employee',
      targetId: saved.id,
      action: 'update_employee',
      operatorId: currentUser.id,
      detail: `更新员工 ${saved.name}`,
      detailJson: {
        before,
        after: this.mapEmployee(saved),
      },
    });

    return this.findEmployeeById(saved.id);
  }

  async findEmployeeSourceBindings(query: QueryEmployeeSourceBindingsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.employeeSourceBindingRepository
      .createQueryBuilder('binding')
      .leftJoinAndSelect('binding.employee', 'employee');

    if (query.employeeId) qb.andWhere('binding.employeeId = :employeeId', { employeeId: query.employeeId });
    if (query.sourceSystem) qb.andWhere('binding.sourceSystem = :sourceSystem', { sourceSystem: query.sourceSystem });
    if (query.sourceTable) qb.andWhere('binding.sourceTable = :sourceTable', { sourceTable: query.sourceTable });
    if (query.bindingType) qb.andWhere('binding.bindingType = :bindingType', { bindingType: query.bindingType });
    if (query.isActive !== undefined) qb.andWhere('binding.isActive = :isActive', { isActive: query.isActive });

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        BINDING_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(
      query,
      list.map((item) => this.mapBinding(item)),
      total,
    );
  }

  async createEmployeeSourceBinding(dto: CreateEmployeeSourceBindingDto, currentUser: CurrentUser) {
    await this.ensureEmployeeExists(dto.employeeId);
    const normalizedSourceId = this.normalizeBindingSourceId(dto.sourceId, dto.bindingType);

    const existing = await this.employeeSourceBindingRepository.findOne({
      where: {
        sourceSystem: dto.sourceSystem,
        sourceTable: dto.sourceTable,
        sourceId: normalizedSourceId,
        bindingType: dto.bindingType,
      },
    });
    if (existing) {
      throw new BadRequestException('该来源绑定已存在');
    }

    const binding = this.employeeSourceBindingRepository.create({
      employeeId: dto.employeeId,
      sourceSystem: dto.sourceSystem.trim(),
      sourceTable: dto.sourceTable.trim(),
      sourceId: normalizedSourceId,
      bindingType: dto.bindingType.trim(),
      isActive: dto.isActive ?? true,
      remark: dto.remark?.trim() || null,
    });
    const saved = await this.employeeSourceBindingRepository.save(binding);

    await this.operationLogsService.create({
      module: 'performance_binding',
      targetId: saved.id,
      action: 'create_employee_source_binding',
      operatorId: currentUser.id,
      detail: `创建员工绑定 ${saved.sourceSystem}/${saved.sourceTable}/${saved.sourceId}`,
      detailJson: this.mapBinding(saved),
    });

    return this.findBindingById(saved.id);
  }

  async updateEmployeeSourceBinding(
    id: number,
    dto: UpdateEmployeeSourceBindingDto,
    currentUser: CurrentUser,
  ) {
    const binding = await this.findBindingById(id);
    const before = this.mapBinding(binding);

    if (dto.employeeId && dto.employeeId !== binding.employeeId) {
      await this.ensureEmployeeExists(dto.employeeId);
    }

    const nextSourceSystem = dto.sourceSystem?.trim() ?? binding.sourceSystem;
    const nextSourceTable = dto.sourceTable?.trim() ?? binding.sourceTable;
    const nextBindingType = dto.bindingType?.trim() ?? binding.bindingType;
    const nextSourceId = this.normalizeBindingSourceId(dto.sourceId ?? binding.sourceId, nextBindingType);

    const duplicate = await this.employeeSourceBindingRepository.findOne({
      where: {
        sourceSystem: nextSourceSystem,
        sourceTable: nextSourceTable,
        sourceId: nextSourceId,
        bindingType: nextBindingType,
      },
    });
    if (duplicate && duplicate.id !== binding.id) {
      throw new BadRequestException('更新后的来源绑定键已存在');
    }

    if (dto.employeeId !== undefined) binding.employeeId = dto.employeeId;
    if (dto.sourceSystem !== undefined) binding.sourceSystem = nextSourceSystem;
    if (dto.sourceTable !== undefined) binding.sourceTable = nextSourceTable;
    if (dto.sourceId !== undefined) binding.sourceId = nextSourceId;
    if (dto.bindingType !== undefined) binding.bindingType = nextBindingType;
    if (dto.isActive !== undefined) binding.isActive = dto.isActive;
    if (dto.remark !== undefined) binding.remark = dto.remark?.trim() || null;

    const saved = await this.employeeSourceBindingRepository.save(binding);

    await this.operationLogsService.create({
      module: 'performance_binding',
      targetId: saved.id,
      action: 'update_employee_source_binding',
      operatorId: currentUser.id,
      detail: `更新员工绑定 ${saved.sourceSystem}/${saved.sourceTable}/${saved.sourceId}`,
      detailJson: {
        before,
        after: this.mapBinding(saved),
      },
    });

    return this.findBindingById(saved.id);
  }

  async findPerformanceRules(query: QueryPerformanceRulesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.performanceRuleRepository.createQueryBuilder('rule');

    if (query.sourceDomain) {
      qb.andWhere('rule.sourceDomain = :sourceDomain', { sourceDomain: query.sourceDomain });
    }
    if (query.eventType) {
      qb.andWhere('rule.eventType = :eventType', { eventType: query.eventType });
    }
    if (query.classificationKey) {
      qb.andWhere('rule.classificationKey = :classificationKey', {
        classificationKey: query.classificationKey,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('rule.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.includeInPerformance !== undefined) {
      qb.andWhere('rule.includeInPerformance = :includeInPerformance', {
        includeInPerformance: query.includeInPerformance,
      });
    }
    if (query.requiresManualConfirmation !== undefined) {
      qb.andWhere('rule.requiresManualConfirmation = :requiresManualConfirmation', {
        requiresManualConfirmation: query.requiresManualConfirmation,
      });
    }

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

    return buildPaginationResult(
      query,
      list.map((item) => this.mapPerformanceRule(item)),
      total,
    );
  }

  async createPerformanceRule(dto: CreatePerformanceRuleDto, currentUser: CurrentUser) {
    await this.ensureRuleUniqueness(dto.sourceDomain, dto.eventType, dto.ruleCode);

    const rule = this.performanceRuleRepository.create({
      sourceDomain: dto.sourceDomain,
      eventType: dto.eventType.trim(),
      ruleCode: dto.ruleCode.trim(),
      ruleName: dto.ruleName.trim(),
      classificationKey: dto.classificationKey.trim(),
      includeInPerformance: dto.includeInPerformance ?? true,
      defaultWeight: normalizeQuantity(dto.defaultWeight ?? '1'),
      defaultCoefficient: normalizeQuantity(dto.defaultCoefficient ?? '1'),
      requiresManualConfirmation: dto.requiresManualConfirmation ?? false,
      isActive: dto.isActive ?? true,
      remark: dto.remark?.trim() || null,
      createdBy: currentUser.id,
      updatedBy: currentUser.id,
    });
    const saved = await this.performanceRuleRepository.save(rule);

    await this.reclassifyEventsForRule(saved);

    await this.operationLogsService.create({
      module: 'performance_rule',
      targetId: saved.id,
      action: 'create_performance_rule',
      operatorId: currentUser.id,
      detail: `创建绩效规则 ${saved.ruleCode}`,
      detailJson: this.mapPerformanceRule(saved),
    });

    return this.findPerformanceRuleById(saved.id);
  }

  async updatePerformanceRule(
    id: number,
    dto: UpdatePerformanceRuleDto,
    currentUser: CurrentUser,
  ) {
    const rule = await this.findPerformanceRuleById(id);
    const before = this.mapPerformanceRule(rule);

    const nextSourceDomain = dto.sourceDomain ?? rule.sourceDomain;
    const nextEventType = dto.eventType?.trim() ?? rule.eventType;
    const nextRuleCode = dto.ruleCode?.trim() ?? rule.ruleCode;
    await this.ensureRuleUniqueness(nextSourceDomain, nextEventType, nextRuleCode, rule.id);

    if (dto.sourceDomain !== undefined) rule.sourceDomain = dto.sourceDomain;
    if (dto.eventType !== undefined) rule.eventType = nextEventType;
    if (dto.ruleCode !== undefined) rule.ruleCode = nextRuleCode;
    if (dto.ruleName !== undefined) rule.ruleName = dto.ruleName.trim();
    if (dto.classificationKey !== undefined) rule.classificationKey = dto.classificationKey.trim();
    if (dto.includeInPerformance !== undefined) {
      rule.includeInPerformance = dto.includeInPerformance;
    }
    if (dto.defaultWeight !== undefined) {
      rule.defaultWeight = normalizeQuantity(dto.defaultWeight);
    }
    if (dto.defaultCoefficient !== undefined) {
      rule.defaultCoefficient = normalizeQuantity(dto.defaultCoefficient);
    }
    if (dto.requiresManualConfirmation !== undefined) {
      rule.requiresManualConfirmation = dto.requiresManualConfirmation;
    }
    if (dto.isActive !== undefined) {
      rule.isActive = dto.isActive;
    }
    if (dto.remark !== undefined) {
      rule.remark = dto.remark?.trim() || null;
    }
    rule.updatedBy = currentUser.id;

    const saved = await this.performanceRuleRepository.save(rule);
    await this.reclassifyEventsForRule(saved);

    await this.operationLogsService.create({
      module: 'performance_rule',
      targetId: saved.id,
      action: 'update_performance_rule',
      operatorId: currentUser.id,
      detail: `更新绩效规则 ${saved.ruleCode}`,
      detailJson: {
        before,
        after: this.mapPerformanceRule(saved),
      },
    });

    return this.findPerformanceRuleById(saved.id);
  }

  async generatePerformanceEvents(
    dto: GeneratePerformanceEventsDto,
    currentUser: CurrentUser,
  ) {
    const context = await this.buildBindingContext();
    const domains = dto.sourceDomains?.length
      ? dto.sourceDomains
      : [
          PerformanceEventSourceDomain.WORK_ORDERS,
          PerformanceEventSourceDomain.ORDERS,
          PerformanceEventSourceDomain.FUNDS,
          PerformanceEventSourceDomain.CARDS,
        ];

    const results: EventGenerateSummary[] = [];

    if (domains.includes(PerformanceEventSourceDomain.WORK_ORDERS)) {
      results.push(await this.generateStarkWorkOrderEvents(context));
      results.push(await this.generateStarkWorkOrderMaterialEvents(context));
    }
    if (domains.includes(PerformanceEventSourceDomain.ORDERS)) {
      results.push(await this.generateAbcOrderEvents(context));
    }
    if (domains.includes(PerformanceEventSourceDomain.FUNDS)) {
      results.push(await this.generateAbcFundEvents(context));
    }
    if (domains.includes(PerformanceEventSourceDomain.CARDS)) {
      results.push(await this.generateAbcCardLedgerEvents(context));
    }

    const result = {
      sourceDomains: domains,
      results,
      totalGenerated: results.reduce((sum, item) => sum + item.generatedEvents, 0),
      totalCreated: results.reduce((sum, item) => sum + item.createdEvents, 0),
      totalUpdated: results.reduce((sum, item) => sum + item.updatedEvents, 0),
      totalUnconfirmed: results.reduce((sum, item) => sum + item.unconfirmedEvents, 0),
      generatedAt: new Date().toISOString(),
    };

    await this.operationLogsService.create({
      module: 'performance_event',
      targetId: 0,
      action: 'generate_performance_events',
      operatorId: currentUser.id,
      detail: `重跑绩效事件生成，目标域：${domains.join(', ')}`,
      detailJson: result,
    });

    return result;
  }

  async generatePerformanceSummaries(
    dto: GeneratePerformanceSummariesDto,
    currentUser: CurrentUser,
  ) {
    const result = await this.regenerateSummaries({
      periodKey: dto.periodKey,
      sourceDomains: dto.sourceDomains,
    });

    await this.operationLogsService.create({
      module: 'performance_summary',
      targetId: 0,
      action: 'generate_performance_summaries',
      operatorId: currentUser.id,
      detail: `重跑绩效月度汇总，周期：${result.periodKeys.join(', ') || '全部'}`,
      detailJson: result,
    });

    return result;
  }

  async findPerformanceEvents(query: QueryPerformanceEventsDto, currentUser: CurrentUser) {
    const { skip, take } = getPagination(query);
    const qb = this.buildPerformanceEventsQuery(query);
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

    const canViewAmounts = this.canViewSensitiveAmounts(currentUser);
    const verificationContextMap = await this.buildPerformanceEventVerificationContextMap(
      list,
      currentUser,
      'list',
    );
    const customerBindingContextMap = await this.buildPerformanceEventCustomerBindingContextMap(
      list,
      verificationContextMap,
    );

    return buildPaginationResult(
      query,
      list.map((item) =>
        this.mapPerformanceEvent(
          item,
          canViewAmounts,
          currentUser,
          verificationContextMap.get(item.id) ?? null,
          customerBindingContextMap.get(item.id) ?? null,
        ),
      ),
      total,
    );
  }

  async findPerformanceSummaries(
    query: QueryPerformanceSummariesDto,
    currentUser: CurrentUser,
  ) {
    const qb = this.buildPerformanceSummariesQuery(query);
    const sortedQb = qb
      .clone()
      .orderBy(
        SUMMARY_SORT_COLUMNS[query.sortBy ?? 'periodKey'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .addOrderBy('summary.id', this.normalizeSortOrder(query.sortOrder, 'DESC'));

    const canViewAmounts = this.canViewSensitiveAmounts(currentUser);
    if (this.hasPerformanceSummaryDerivedFilters(query)) {
      const list = await sortedQb.getMany();
      const summaryCustomerContextMap = await this.buildPerformanceSummaryCustomerContextMap(
        list,
        currentUser,
        'list',
      );
      const mapped = list.map((item) =>
        this.mapPerformanceSummary(
          item,
          canViewAmounts,
          currentUser,
          summaryCustomerContextMap.get(item.id) ?? null,
          'list',
        ),
      );
      const filtered = mapped.filter((item) => this.matchesPerformanceSummaryDerivedFilters(item, query));
      return buildPaginationResult(query, paginateArray(filtered, query).list, filtered.length);
    }

    const { skip, take } = getPagination(query);
    const total = await qb.getCount();
    const list = await sortedQb.skip(skip).take(take).getMany();
    const summaryCustomerContextMap = await this.buildPerformanceSummaryCustomerContextMap(
      list,
      currentUser,
      'list',
    );
    return buildPaginationResult(
      query,
      list.map((item) =>
        this.mapPerformanceSummary(
          item,
          canViewAmounts,
          currentUser,
          summaryCustomerContextMap.get(item.id) ?? null,
          'list',
        ),
      ),
      total,
    );
  }

  async findPendingPerformanceItems(
    query: QueryPendingPerformanceItemsDto,
    currentUser: CurrentUser,
  ) {
    const qb = this.buildPerformanceEventsQuery(query);

    if (query.includeResolved) {
      qb.andWhere(
        '((event.employeeId IS NULL OR event.confirmedFlag = :confirmedFlag) OR event.handlingAction IS NOT NULL OR event.ignoredFlag = :ignoredFlag)',
        {
          confirmedFlag: false,
          ignoredFlag: true,
        },
      );
    } else {
      qb.andWhere(
        '(event.employeeId IS NULL OR event.confirmedFlag = :confirmedFlag) AND event.ignoredFlag = :ignoredFlag',
        {
          confirmedFlag: false,
          ignoredFlag: false,
        },
      );
    }

    const sortedQb = qb
      .clone()
      .orderBy(
        EVENT_SORT_COLUMNS[query.sortBy ?? 'occurredAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .addOrderBy('event.id', this.normalizeSortOrder(query.sortOrder, 'DESC'));

    const canViewAmounts = this.canViewSensitiveAmounts(currentUser);
    if (this.hasPendingPerformanceDerivedFilters(query)) {
      const list = await sortedQb.getMany();
      const verificationContextMap = await this.buildPerformanceEventVerificationContextMap(
        list,
        currentUser,
        'list',
      );
      const customerBindingContextMap = await this.buildPerformanceEventCustomerBindingContextMap(
        list,
        verificationContextMap,
      );
      const mapped = list.map((item) =>
        this.mapPerformanceEvent(
          item,
          canViewAmounts,
          currentUser,
          verificationContextMap.get(item.id) ?? null,
          customerBindingContextMap.get(item.id) ?? null,
        ),
      );
      const filtered = mapped.filter((item) => this.matchesPendingPerformanceDerivedFilters(item, query));
      return buildPaginationResult(query, paginateArray(filtered, query).list, filtered.length);
    }

    const { skip, take } = getPagination(query);
    const total = await qb.getCount();
    const list = await sortedQb.skip(skip).take(take).getMany();
    const verificationContextMap = await this.buildPerformanceEventVerificationContextMap(
      list,
      currentUser,
      'list',
    );
    const customerBindingContextMap = await this.buildPerformanceEventCustomerBindingContextMap(
      list,
      verificationContextMap,
    );

    return buildPaginationResult(
      query,
      list.map((item) =>
        this.mapPerformanceEvent(
          item,
          canViewAmounts,
          currentUser,
          verificationContextMap.get(item.id) ?? null,
          customerBindingContextMap.get(item.id) ?? null,
        ),
      ),
      total,
    );
  }

  async rebindPendingPerformanceItem(
    id: number,
    dto: RebindPerformanceEventDto,
    currentUser: CurrentUser,
  ) {
    const event = await this.findPerformanceEventById(id);
    await this.ensureEmployeeExists(dto.employeeId);

    const before = this.mapPerformanceEvent(event);
    event.employeeId = dto.employeeId;
    event.employee = { id: dto.employeeId } as Employee;
    event.ignoredFlag = false;
    event.handledBy = currentUser.id;
    event.handledByUser = { id: currentUser.id } as User;
    event.handledAt = new Date();
    event.handlingAction = PerformanceHandlingAction.REBIND;
    event.handlingRemark = dto.remark?.trim() || null;

    await this.performanceEventRepository.save(event);
    await this.syncClassificationForEvent(event);
    const saved = await this.findPerformanceEventById(id);
    await this.regenerateSummariesForEvent(saved);

    await this.operationLogsService.create({
      module: 'performance_pending',
      targetId: saved.id,
      action: 'rebind_performance_event',
      operatorId: currentUser.id,
      detail: `重新绑定绩效事件 ${saved.id}`,
      detailJson: {
        before,
        after: this.mapPerformanceEvent(saved),
      },
    });

    return this.mapPerformanceEvent(saved, this.canViewSensitiveAmounts(currentUser));
  }

  async confirmPendingPerformanceItem(
    id: number,
    dto: ConfirmPerformanceEventDto,
    currentUser: CurrentUser,
  ) {
    const event = await this.findPerformanceEventById(id);
    const before = this.mapPerformanceEvent(event);

    if (dto.employeeId !== undefined) {
      await this.ensureEmployeeExists(dto.employeeId);
      event.employeeId = dto.employeeId;
      event.employee = { id: dto.employeeId } as Employee;
    }

    event.ignoredFlag = false;
    event.handledBy = currentUser.id;
    event.handledByUser = { id: currentUser.id } as User;
    event.handledAt = new Date();
    event.handlingAction = PerformanceHandlingAction.CONFIRM;
    event.handlingRemark = dto.remark?.trim() || null;

    await this.performanceEventRepository.save(event);
    await this.syncClassificationForEvent(event);
    const saved = await this.findPerformanceEventById(id);
    await this.regenerateSummariesForEvent(saved);

    await this.operationLogsService.create({
      module: 'performance_pending',
      targetId: saved.id,
      action: 'confirm_performance_event',
      operatorId: currentUser.id,
      detail: `手工确认绩效事件 ${saved.id}`,
      detailJson: {
        before,
        after: this.mapPerformanceEvent(saved),
      },
    });

    return this.mapPerformanceEvent(saved, this.canViewSensitiveAmounts(currentUser));
  }

  async ignorePendingPerformanceItem(
    id: number,
    dto: IgnorePerformanceEventDto,
    currentUser: CurrentUser,
  ) {
    const event = await this.findPerformanceEventById(id);
    const before = this.mapPerformanceEvent(event);

    event.ignoredFlag = true;
    event.confirmedFlag = false;
    event.handledBy = currentUser.id;
    event.handledByUser = { id: currentUser.id } as User;
    event.handledAt = new Date();
    event.handlingAction = PerformanceHandlingAction.IGNORE;
    event.handlingRemark = dto.remark?.trim() || null;

    await this.performanceEventRepository.save(event);
    await this.syncClassificationForEvent(event);
    const saved = await this.findPerformanceEventById(id);
    await this.regenerateSummariesForEvent(saved);

    await this.operationLogsService.create({
      module: 'performance_pending',
      targetId: saved.id,
      action: 'ignore_performance_event',
      operatorId: currentUser.id,
      detail: `忽略绩效事件 ${saved.id}`,
      detailJson: {
        before,
        after: this.mapPerformanceEvent(saved),
      },
    });

    return this.mapPerformanceEvent(saved, this.canViewSensitiveAmounts(currentUser));
  }

  async confirmPerformanceSummaryCustomerBinding(
    summaryId: number,
    dto: ConfirmPerformanceSummaryCustomerBindingDto,
    currentUser: CurrentUser,
  ) {
    const summary = await this.performanceSummaryRepository.findOne({
      where: { id: summaryId },
      relations: {
        employee: true,
        performancePeriod: true,
      },
    });
    if (!summary) {
      throw new NotFoundException('绩效汇总不存在');
    }

    const candidates = await this.loadPerformanceSummaryCandidateRecords(summary, currentUser, 'detail');
    if (!candidates.length) {
      throw new BadRequestException('当前汇总没有可确认的客户候选');
    }

    const primary = this.pickPrimaryPerformanceSummaryCandidate(candidates);
    const verificationContext = primary.verificationContext;
    if (!verificationContext) {
      throw new BadRequestException('当前汇总缺少客户核对上下文，暂不能执行人工确认');
    }

    const matchedCustomerId =
      primary.customerBinding?.matchedCustomerId ?? verificationContext.matchedCustomerId ?? null;
    if (!matchedCustomerId) {
      throw new BadRequestException('当前汇总尚未锁定唯一客户候选，不能执行人工确认');
    }

    if (String(dto.matchedCustomerId).trim() !== String(matchedCustomerId).trim()) {
      throw new BadRequestException('传入的 matchedCustomerId 与当前汇总候选不一致，请刷新页面后重试');
    }

    const sourceCustomerMobile = normalizeMainlandMobile(
      primary.customerBinding?.sourceCustomerMobile ??
        verificationContext.sourceCustomerMobile ??
        verificationContext.customerMobile ??
        null,
    );
    if (!sourceCustomerMobile) {
      throw new BadRequestException('当前候选缺少稳定手机号，不能执行人工确认');
    }

    const confirmRemark = dto.confirmRemark.trim();
    const existingBinding = await this.customerIdentificationBindingRepository.findOne({
      where: {
        sourceSystem: primary.event.sourceSystem,
        sourceTable: primary.event.sourceTable,
        sourceId: primary.event.sourceId,
      },
      relations: {
        boundByUser: true,
      },
    });

    const before =
      this.mapPerformanceCustomerBinding(
        this.buildPerformanceCustomerBindingContext(
          primary.event,
          verificationContext,
          existingBinding ?? null,
        ),
        currentUser,
        'detail',
      ) ?? null;

    const readiness = this.resolvePerformanceReadiness({
      sourceCustomerMobile,
      bindingStatus: 'manually_bound',
      employeeId: primary.event.employeeId,
      confirmedFlag: primary.event.confirmedFlag,
    });

    const now = new Date();
    const binding =
      existingBinding ??
      this.customerIdentificationBindingRepository.create({
        sourceSystem: primary.event.sourceSystem,
        sourceTable: primary.event.sourceTable,
        sourceId: primary.event.sourceId,
      });

    binding.sourceCustomerName =
      verificationContext.sourceCustomerName ?? verificationContext.customerName ?? null;
    binding.sourceCustomerMobile = sourceCustomerMobile;
    binding.sourceCarPlate = verificationContext.sourceCarPlate ?? verificationContext.carPlate ?? null;
    binding.matchedCustomerId = matchedCustomerId;
    binding.matchedCustomerName =
      verificationContext.matchedCustomerName ?? verificationContext.customerName ?? null;
    binding.matchedCustomerMobile =
      normalizeMainlandMobile(verificationContext.matchedCustomerMobile ?? sourceCustomerMobile) ??
      sourceCustomerMobile;
    binding.bindingStatus = 'manually_bound';
    binding.bindingConfidence = '1.0000';
    binding.boundBy = currentUser.id;
    binding.boundAt = now;
    binding.bindingRemark = confirmRemark;
    binding.performanceReadyFlag = readiness.performanceReadyFlag;
    binding.performanceBlockReason = readiness.performanceBlockReason;
    binding.performanceDecisionReason = readiness.performanceDecisionReason;
    binding.normalizedPayload = {
      ...(existingBinding?.normalizedPayload ?? {}),
      source: 'manual_confirmation_from_summary_candidate',
      summaryId,
      performancePeriodId: summary.performancePeriodId,
      employeeId: summary.employeeId,
      matchedCustomerId,
      matchedCustomerName: verificationContext.matchedCustomerName ?? verificationContext.customerName ?? null,
      matchedCustomerMobile:
        normalizeMainlandMobile(verificationContext.matchedCustomerMobile ?? sourceCustomerMobile) ??
        sourceCustomerMobile,
      sourceCustomerMobile,
      matchConfidence: verificationContext.matchConfidence ?? null,
      matchReason: verificationContext.matchReason ?? null,
      evidenceSummary: verificationContext.evidenceSummary ?? null,
      matchedOrderId: verificationContext.matchedOrderId ?? null,
      matchedOrderNo: verificationContext.matchedOrderNo ?? null,
      matchedSourceTable: verificationContext.matchedSourceTable ?? null,
      paymentStatus: verificationContext.paymentStatus,
      sourceClassification: verificationContext.sourceClassification,
      reconciliationStatus: verificationContext.reconciliationStatus,
      reconciliationReason: verificationContext.reconciliationReason,
      confirmedBy: currentUser.id,
      confirmedAt: now.toISOString(),
      confirmRemark,
    };

    const saved = await this.customerIdentificationBindingRepository.save(binding);
    const refreshedBinding = await this.customerIdentificationBindingRepository.findOne({
      where: { id: saved.id },
      relations: {
        boundByUser: true,
      },
    });

    await this.recordPerformanceSummaryManualDecision({
      sourceSummaryId: summaryId,
      actionType: 'confirm_binding',
      sourceSystem: primary.event.sourceSystem,
      sourceTable: primary.event.sourceTable,
      sourceId: primary.event.sourceId,
      originalMatchedCustomerId: before?.matchedCustomerId ?? null,
      finalMatchedCustomerId: matchedCustomerId,
      originalClassification: this.normalizePerformanceManualClassification(
        verificationContext.sourceClassification,
      ),
      finalClassification: this.normalizePerformanceManualClassification(
        verificationContext.sourceClassification,
      ),
      originalBindingStatus: before?.bindingStatus ?? null,
      finalBindingStatus: 'manually_bound',
      operatorId: currentUser.id,
      operatorName: currentUser.realName || currentUser.username,
      reasonCode: 'manual_confirmation_from_summary_candidate',
      decisionScope: 'case_only',
      judgmentBasis: ['operator_experience'],
      aiLearningMode: 'do_not_generalize',
      remark: confirmRemark,
      affectPerformanceFlag: true,
      affectBCardFlag:
        this.normalizePerformanceManualClassification(verificationContext.sourceClassification) ===
        'a_plus_c_bundle',
      normalizedPayload: {
        source: 'manual_confirmation_from_summary_candidate',
        decisionScope: 'case_only',
        judgmentBasis: ['operator_experience'],
        aiLearningMode: 'do_not_generalize',
        summaryId,
        matchedCustomerId,
        paymentStatus: verificationContext.paymentStatus,
        sourceClassification: verificationContext.sourceClassification,
        reconciliationStatus: verificationContext.reconciliationStatus,
        reconciliationReason: verificationContext.reconciliationReason,
      },
    });

    const after =
      this.mapPerformanceCustomerBinding(
        this.buildPerformanceCustomerBindingContext(
          primary.event,
          verificationContext,
          refreshedBinding ?? saved,
        ),
        currentUser,
        'detail',
      ) ?? null;

    await this.operationLogsService.create({
      module: 'performance_customer_binding',
      targetId: saved.id,
      action: 'confirm_summary_customer_binding',
      operatorId: currentUser.id,
      detail: `人工确认绩效汇总 ${summaryId} 的客户绑定 ${primary.event.sourceTable}#${primary.event.sourceId} -> ${matchedCustomerId}`,
      detailJson: {
        summaryId,
        employeeId: summary.employeeId,
        sourceSystem: primary.event.sourceSystem,
        sourceTable: primary.event.sourceTable,
        sourceId: primary.event.sourceId,
        matchedCustomerId,
        confirmRemark,
        before,
        after,
      },
    });

    const detailQuery = {
      page: 1,
      pageSize: 10,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
    } as QueryPerformanceSummaryDetailDto;
    const detail = await this.findPerformanceSummaryDetail(summaryId, detailQuery, currentUser);

    return {
      bindingId: saved.id,
      sourceSystem: primary.event.sourceSystem,
      sourceTable: primary.event.sourceTable,
      sourceId: primary.event.sourceId,
      matchedCustomerId,
      confirmedBy: currentUser.id,
      confirmedAt: now,
      confirmRemark,
      summary: detail.summary,
      events: detail.events,
    };
  }

  async decidePerformanceSummaryManualDecision(
    summaryId: number,
    dto: DecidePerformanceSummaryManualDecisionDto,
    currentUser: CurrentUser,
  ) {
    const target = await this.loadPerformanceSummaryManualDecisionTarget(summaryId, currentUser);
    const { summary, primary, verificationContext, existingBinding, before } = target;
    const actionType = dto.actionType as PerformanceSummaryManualDecisionAction;
    let reasonCode = dto.reasonCode?.trim() ? dto.reasonCode.trim() : null;
    const decisionScope = dto.decisionScope as PerformanceManualDecisionScope;
    const judgmentBasis = Array.from(
      new Set((dto.judgmentBasis ?? []).map((item) => item.trim()).filter(Boolean)),
    ) as PerformanceManualJudgmentBasis[];
    const aiLearningMode = dto.aiLearningMode as PerformanceManualAiLearningMode;
    reasonCode = this.buildPerformanceManualDecisionReasonCode(
      reasonCode,
      judgmentBasis,
      decisionScope,
    );
    const remark = dto.remark.trim();
    if (!judgmentBasis.length) {
      throw new BadRequestException('judgmentBasis is required');
    }

    if (!remark) {
      throw new BadRequestException('人工裁决必须填写备注');
    }

    const currentMatchedCustomerId =
      before?.matchedCustomerId ?? verificationContext.matchedCustomerId ?? null;
    if (
      dto.matchedCustomerId &&
      currentMatchedCustomerId &&
      dto.matchedCustomerId.trim() !== String(currentMatchedCustomerId)
    ) {
      throw new BadRequestException('当前候选客户已变化，请刷新页面后重试');
    }

    const originalClassification = this.normalizePerformanceManualClassification(
      verificationContext.sourceClassification,
    );
    let finalClassification =
      (dto.finalClassification as PerformanceManualClassification | undefined) ??
      originalClassification ??
      'other';
    let finalBindingStatus =
      (before?.bindingStatus as PerformanceCustomerBindingContext['bindingStatus'] | null) ??
      'manual_pending';
    let finalMatchedCustomerId = currentMatchedCustomerId;
    let finalMatchedCustomerName =
      verificationContext.matchedCustomerName ?? verificationContext.customerName ?? null;
    let finalMatchedCustomerMobile =
      normalizeMainlandMobile(
        verificationContext.matchedCustomerMobile ??
          verificationContext.sourceCustomerMobile ??
          verificationContext.customerMobile ??
          null,
      ) ?? null;

    switch (actionType) {
      case 'confirm_binding':
        if (!currentMatchedCustomerId) {
          throw new BadRequestException('当前没有可确认的客户候选');
        }
        finalBindingStatus = 'manually_bound';
        break;
      case 'reject_candidate':
        finalBindingStatus = 'manual_pending';
        finalMatchedCustomerId = null;
        finalMatchedCustomerName = null;
        finalMatchedCustomerMobile = null;
        break;
      case 'reassign_customer': {
        if (!dto.finalMatchedCustomerId?.trim()) {
          throw new BadRequestException('改绑其他客户时必须填写 finalMatchedCustomerId');
        }
        const reassignedCustomer = await this.loadPerformanceAbcSourceUserById(
          dto.finalMatchedCustomerId.trim(),
        );
        if (!reassignedCustomer) {
          throw new BadRequestException('指定的 customerId 在 ABC user_account 中不存在');
        }
        finalBindingStatus = 'manually_bound';
        finalMatchedCustomerId = reassignedCustomer.id;
        finalMatchedCustomerName = reassignedCustomer.name;
        finalMatchedCustomerMobile = reassignedCustomer.mobile;
        break;
      }
      case 'reclassify_record':
        if (!dto.finalClassification) {
          throw new BadRequestException('改分类时必须选择 finalClassification');
        }
        finalClassification = dto.finalClassification as PerformanceManualClassification;
        break;
      case 'hold_pending':
        finalBindingStatus = 'manual_pending';
        break;
      default:
        throw new BadRequestException('不支持的人工裁决动作');
    }

    const sourceCustomerMobile = normalizeMainlandMobile(
      before?.sourceCustomerMobile ??
        verificationContext.sourceCustomerMobile ??
        verificationContext.customerMobile ??
        null,
    );
    const readiness = this.resolvePerformanceReadiness({
      sourceCustomerMobile,
      bindingStatus: finalBindingStatus,
      employeeId: primary.event.employeeId,
      confirmedFlag: primary.event.confirmedFlag,
    });

    let savedBinding: CustomerIdentificationBinding | null = null;
    if (actionType !== 'reclassify_record' || existingBinding) {
      const binding =
        existingBinding ??
        this.customerIdentificationBindingRepository.create({
          sourceSystem: primary.event.sourceSystem,
          sourceTable: primary.event.sourceTable,
          sourceId: primary.event.sourceId,
        });

      binding.sourceCustomerName =
        verificationContext.sourceCustomerName ?? verificationContext.customerName ?? null;
      binding.sourceCustomerMobile = sourceCustomerMobile;
      binding.sourceCarPlate = verificationContext.sourceCarPlate ?? verificationContext.carPlate ?? null;
      binding.matchedCustomerId = finalMatchedCustomerId;
      binding.matchedCustomerName = finalMatchedCustomerName;
      binding.matchedCustomerMobile = finalMatchedCustomerMobile;
      binding.bindingStatus = finalBindingStatus;
      binding.bindingConfidence = finalBindingStatus === 'manually_bound' ? '1.0000' : null;
      binding.boundBy = finalBindingStatus === 'manually_bound' ? currentUser.id : null;
      binding.boundAt = finalBindingStatus === 'manually_bound' ? new Date() : null;
      binding.bindingRemark = remark;
      binding.performanceReadyFlag = readiness.performanceReadyFlag;
      binding.performanceBlockReason = readiness.performanceBlockReason;
      binding.performanceDecisionReason = readiness.performanceDecisionReason;
      binding.normalizedPayload = {
        ...(existingBinding?.normalizedPayload ?? {}),
        latestManualDecision: {
          actionType,
          reasonCode,
          decisionScope,
          judgmentBasis,
          aiLearningMode,
          finalClassification,
          remark,
          operatorId: currentUser.id,
          operatedAt: new Date().toISOString(),
          source: 'manual_decision_from_summary_detail',
        },
        summaryId,
        sourceClassification: verificationContext.sourceClassification,
        paymentStatus: verificationContext.paymentStatus,
        reconciliationStatus: verificationContext.reconciliationStatus,
        reconciliationReason: verificationContext.reconciliationReason,
      };

      savedBinding = await this.customerIdentificationBindingRepository.save(binding);
    }

    const impacts = this.resolvePerformanceManualDecisionImpact(finalClassification);
    const decision = await this.recordPerformanceSummaryManualDecision({
      sourceSummaryId: summaryId,
      actionType,
      sourceSystem: primary.event.sourceSystem,
      sourceTable: primary.event.sourceTable,
      sourceId: primary.event.sourceId,
      originalMatchedCustomerId: currentMatchedCustomerId,
      finalMatchedCustomerId,
      originalClassification,
      finalClassification,
      originalBindingStatus: before?.bindingStatus ?? null,
      finalBindingStatus,
      operatorId: currentUser.id,
      operatorName: currentUser.realName || currentUser.username,
      reasonCode,
      decisionScope,
      judgmentBasis,
      aiLearningMode,
      remark,
      affectPerformanceFlag: impacts.affectPerformanceFlag,
      affectBCardFlag: impacts.affectBCardFlag,
      normalizedPayload: {
        source: 'manual_decision_from_summary_detail',
        decisionScope,
        judgmentBasis,
        aiLearningMode,
        originalMatchedCustomerName: before?.matchedCustomerName ?? verificationContext.matchedCustomerName ?? null,
        originalMatchedCustomerMobile:
          before?.matchedCustomerMobile ?? verificationContext.matchedCustomerMobile ?? null,
        finalMatchedCustomerName,
        finalMatchedCustomerMobile,
        sourceCustomerMobile,
        sourceCustomerName:
          verificationContext.sourceCustomerName ?? verificationContext.customerName ?? null,
        sourceClassification: verificationContext.sourceClassification,
        paymentStatus: verificationContext.paymentStatus,
        reconciliationStatus: verificationContext.reconciliationStatus,
        reconciliationReason: verificationContext.reconciliationReason,
        matchedSourceTable: verificationContext.matchedSourceTable,
        matchedOrderId: verificationContext.matchedOrderId,
        matchedOrderNo: verificationContext.matchedOrderNo,
        evidenceSummary: verificationContext.evidenceSummary,
        matchReason: verificationContext.matchReason,
      },
    });

    await this.operationLogsService.create({
      module: 'performance_customer_binding',
      targetId: savedBinding?.id ?? decision.id,
      action: `summary_manual_decision_${actionType}`,
      operatorId: currentUser.id,
      detail: `绩效汇总 ${summaryId} 执行人工裁决 ${actionType}`,
      detailJson: {
        summaryId,
        actionType,
        sourceSystem: primary.event.sourceSystem,
        sourceTable: primary.event.sourceTable,
        sourceId: primary.event.sourceId,
        originalMatchedCustomerId: currentMatchedCustomerId,
        finalMatchedCustomerId,
        originalClassification,
        finalClassification,
        originalBindingStatus: before?.bindingStatus ?? null,
        finalBindingStatus,
        reasonCode,
        decisionScope,
        judgmentBasis,
        aiLearningMode,
        remark,
        affectPerformanceFlag: impacts.affectPerformanceFlag,
        affectBCardFlag: impacts.affectBCardFlag,
      },
    });

    const detailQuery = {
      page: 1,
      pageSize: 10,
      sortBy: 'occurredAt',
      sortOrder: 'desc',
    } as QueryPerformanceSummaryDetailDto;
    const detail = await this.findPerformanceSummaryDetail(summaryId, detailQuery, currentUser);

    return {
      decisionId: decision.id,
      summary: detail.summary,
      events: detail.events,
    };
  }

  async findPerformanceSummaryDetail(
    id: number,
    query: QueryPerformanceSummaryDetailDto,
    currentUser: CurrentUser,
  ) {
    const summary = await this.performanceSummaryRepository.findOne({
      where: { id },
      relations: {
        employee: true,
        performancePeriod: true,
      },
    });
    if (!summary) {
      throw new NotFoundException('绩效汇总不存在');
    }

    const { skip, take } = getPagination(query);
    const eventQb = this.performanceEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.employee', 'employee')
      .leftJoinAndSelect('event.handledByUser', 'handledByUser')
      .leftJoinAndSelect('event.classification', 'classification')
      .leftJoinAndSelect('classification.performanceRule', 'rule')
      .where('event.employeeId = :employeeId', { employeeId: summary.employeeId })
      .andWhere('event.sourceDomain = :sourceDomain', { sourceDomain: summary.sourceDomain })
      .andWhere('event.periodKey = :periodKey', {
        periodKey: summary.performancePeriod.periodKey,
      })
      .andWhere('event.ignoredFlag = :ignoredFlag', { ignoredFlag: false })
      .andWhere('classification.includeInPerformance = :includeInPerformance', {
        includeInPerformance: true,
      });
    const includedEventIds = this.readPerformanceSummaryEventIds(summary.normalizedPayload);
    if (includedEventIds.length) {
      eventQb.andWhere('event.id IN (:...includedEventIds)', { includedEventIds });
    }

    if (query.confirmedFlag !== undefined) {
      eventQb.andWhere('event.confirmedFlag = :confirmedFlag', {
        confirmedFlag: query.confirmedFlag,
      });
    }

    const total = await eventQb.getCount();
    const list = await eventQb
      .clone()
      .orderBy(
        SUMMARY_DETAIL_SORT_COLUMNS[query.sortBy ?? 'occurredAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    const canViewAmounts = this.canViewSensitiveAmounts(currentUser);
    const verificationContextMap = await this.buildPerformanceEventVerificationContextMap(
      list,
      currentUser,
      'detail',
    );
    const customerBindingContextMap = await this.buildPerformanceEventCustomerBindingContextMap(
      list,
      verificationContextMap,
    );

    const summaryCustomerContextMap = await this.buildPerformanceSummaryCustomerContextMap(
      [summary],
      currentUser,
      'detail',
    );
    const manualDecisionBundle = await this.loadPerformanceSummaryManualDecisionBundle(
      summary,
      currentUser,
      summaryCustomerContextMap.get(summary.id) ?? null,
    );
    const mappedSummary = this.mapPerformanceSummary(
      summary,
      canViewAmounts,
      currentUser,
      summaryCustomerContextMap.get(summary.id) ?? null,
      'detail',
    );

    return {
      summary: {
        ...mappedSummary,
        manualDecision: manualDecisionBundle.latestDecision,
        manualDecisionHistory: manualDecisionBundle.history,
        latestDecisionAction: manualDecisionBundle.latestDecision?.actionType ?? null,
        latestDecisionReason:
          manualDecisionBundle.latestDecision?.reasonCode ??
          manualDecisionBundle.latestDecision?.judgmentBasis?.join(', ') ??
          null,
        latestDecisionBy: manualDecisionBundle.latestDecision?.operatorName ?? null,
        latestDecisionAt: manualDecisionBundle.latestDecision?.operatedAt ?? null,
      },
      events: buildPaginationResult(
        query,
        list.map((item) =>
          this.mapPerformanceEvent(
            item,
            canViewAmounts,
            currentUser,
            verificationContextMap.get(item.id) ?? null,
            customerBindingContextMap.get(item.id) ?? null,
          ),
        ),
        total,
      ),
    };
  }

  private async loadPerformanceSummaryManualDecisionTarget(
    summaryId: number,
    currentUser: CurrentUser,
  ) {
    const summary = await this.performanceSummaryRepository.findOne({
      where: { id: summaryId },
      relations: {
        employee: true,
        performancePeriod: true,
      },
    });
    if (!summary) {
      throw new NotFoundException('绩效汇总不存在');
    }

    const candidates = await this.loadPerformanceSummaryCandidateRecords(summary, currentUser, 'detail');
    if (!candidates.length) {
      throw new BadRequestException('当前汇总没有可裁决的客户候选');
    }

    const primary = this.pickPrimaryPerformanceSummaryCandidate(candidates);
    const verificationContext = primary.verificationContext;
    if (!verificationContext) {
      throw new BadRequestException('当前汇总缺少客户核对上下文，暂不能执行人工裁决');
    }

    const existingBinding = await this.customerIdentificationBindingRepository.findOne({
      where: {
        sourceSystem: primary.event.sourceSystem,
        sourceTable: primary.event.sourceTable,
        sourceId: primary.event.sourceId,
      },
      relations: {
        boundByUser: true,
      },
    });

    const before =
      this.mapPerformanceCustomerBinding(
        this.buildPerformanceCustomerBindingContext(
          primary.event,
          verificationContext,
          existingBinding ?? null,
        ),
        currentUser,
        'detail',
      ) ?? null;

    return {
      summary,
      primary,
      verificationContext,
      existingBinding,
      before,
    };
  }

  private async loadPerformanceSummaryManualDecisionBundle(
    summary: PerformanceSummary,
    currentUser: CurrentUser,
    customerContext: PerformanceSummaryCustomerContext | null,
  ) {
    const decisions = await this.performanceSummaryManualDecisionRepository.find({
      where: { sourceSummaryId: summary.id },
      relations: { operator: true },
      order: { operatedAt: 'DESC', id: 'DESC' },
      take: 10,
    });

    const mappedHistory = decisions.map((item) =>
      this.mapPerformanceSummaryManualDecision(item, currentUser, 'detail'),
    );
    if (mappedHistory.length) {
      return {
        latestDecision: mappedHistory[0],
        history: mappedHistory,
      };
    }

    const candidates = await this.loadPerformanceSummaryCandidateRecords(summary, currentUser, 'detail');
    if (!candidates.length) {
      return {
        latestDecision: null,
        history: [],
      };
    }

    const primary = this.pickPrimaryPerformanceSummaryCandidate(candidates);
    const verificationContext = primary.verificationContext;
    if (!verificationContext) {
      return {
        latestDecision: null,
        history: [],
      };
    }

    const existingBinding = await this.customerIdentificationBindingRepository.findOne({
      where: {
        sourceSystem: primary.event.sourceSystem,
        sourceTable: primary.event.sourceTable,
        sourceId: primary.event.sourceId,
      },
      relations: {
        boundByUser: true,
      },
    });

    if (
      existingBinding?.bindingStatus !== 'manually_bound' ||
      !existingBinding.boundAt ||
      !(existingBinding.normalizedPayload as Record<string, unknown> | null)?.source
    ) {
      return {
        latestDecision: null,
        history: [],
      };
    }

    const payload = (existingBinding.normalizedPayload ?? {}) as Record<string, unknown>;
    const fallbackDecision: PerformanceSummaryManualDecisionContext = {
      id: 0,
      actionType: 'confirm_binding',
      sourceSummaryId: summary.id,
      originalMatchedCustomerId:
        this.pickVerificationString(
          this.readStringFromPathCandidates([payload], [['matchedCustomerId']]),
          customerContext?.matchedCustomerId ?? null,
        ) ?? null,
      finalMatchedCustomerId: existingBinding.matchedCustomerId ?? null,
      originalClassification: this.normalizePerformanceManualClassification(
        this.pickVerificationString(
          this.readStringFromPathCandidates([payload], [['sourceClassification']]),
          customerContext?.sourceClassification ?? null,
        ),
      ),
      finalClassification: this.normalizePerformanceManualClassification(
        this.pickVerificationString(
          this.readStringFromPathCandidates([payload], [['sourceClassification']]),
          customerContext?.sourceClassification ?? null,
        ),
      ),
      originalBindingStatus: 'manual_pending',
      finalBindingStatus: 'manually_bound',
      operatorId: existingBinding.boundBy ?? 0,
      operatorName:
        existingBinding.boundByUser?.realName ??
        existingBinding.boundByUser?.username ??
        null,
      operatedAt: existingBinding.boundAt,
      reasonCode: 'manual_confirmation_from_summary_candidate',
      decisionScope: this.normalizePerformanceManualDecisionScope(
        this.readStringFromPathCandidates([payload], [['latestManualDecision', 'decisionScope']]),
      ),
      judgmentBasis: this.normalizePerformanceManualJudgmentBasis(
        this.readStringArrayFromPathCandidates([payload], [['latestManualDecision', 'judgmentBasis']]),
      ),
      aiLearningMode: this.normalizePerformanceManualAiLearningMode(
        this.readStringFromPathCandidates([payload], [['latestManualDecision', 'aiLearningMode']]),
      ),
      remark: existingBinding.bindingRemark,
      affectPerformanceFlag: true,
      affectBCardFlag:
        this.normalizePerformanceManualClassification(customerContext?.sourceClassification ?? null) ===
        'a_plus_c_bundle',
      normalizedPayload: {
        source: 'derived_from_existing_binding',
        decisionScope: this.readStringFromPathCandidates([payload], [['latestManualDecision', 'decisionScope']]),
        judgmentBasis: this.readStringArrayFromPathCandidates([payload], [['latestManualDecision', 'judgmentBasis']]),
        aiLearningMode: this.readStringFromPathCandidates([payload], [['latestManualDecision', 'aiLearningMode']]),
        finalMatchedCustomerName: existingBinding.matchedCustomerName,
        finalMatchedCustomerMobile: existingBinding.matchedCustomerMobile,
      },
    };

    return {
      latestDecision: this.maskPerformanceSummaryManualDecision(fallbackDecision, currentUser, 'detail'),
      history: [this.maskPerformanceSummaryManualDecision(fallbackDecision, currentUser, 'detail')],
    };
  }

  private async buildPerformanceSummaryCustomerContextMap(
    summaries: PerformanceSummary[],
    currentUser: CurrentUser,
    mode: PerformanceVerificationContextViewMode,
  ) {
    const result = new Map<number, PerformanceSummaryCustomerContext>();
    if (!summaries.length) {
      return result;
    }

    const eventIdsBySummaryId = new Map<number, number[]>();
    const eventIds = new Set<number>();
    for (const summary of summaries) {
      const includedEventIds = this.readPerformanceSummaryEventIds(summary.normalizedPayload);
      eventIdsBySummaryId.set(summary.id, includedEventIds);
      includedEventIds.forEach((eventId) => eventIds.add(eventId));
    }

    if (!eventIds.size) {
      return result;
    }

    const events = await this.performanceEventRepository.find({
      where: { id: In(Array.from(eventIds)) },
      relations: {
        employee: true,
        handledByUser: true,
        classification: {
          performanceRule: true,
        },
      },
      order: {
        occurredAt: 'ASC',
        id: 'ASC',
      },
    });
    const eventMap = new Map(events.map((event) => [event.id, event]));
    const verificationContextMap = await this.buildPerformanceEventVerificationContextMap(
      events,
      currentUser,
      mode,
    );
    const customerBindingContextMap = await this.buildPerformanceEventCustomerBindingContextMap(
      events,
      verificationContextMap,
    );

    for (const summary of summaries) {
      const candidates = (eventIdsBySummaryId.get(summary.id) ?? [])
        .map((eventId) => {
          const event = eventMap.get(eventId);
          if (!event) return null;
          return {
            event,
            verificationContext: verificationContextMap.get(event.id) ?? null,
            customerBinding: customerBindingContextMap.get(event.id) ?? null,
          };
        })
        .filter((item): item is PerformanceSummaryCandidateRecord => Boolean(item));

      const context = this.buildPerformanceSummaryCustomerContext(candidates);
      if (context) {
        result.set(summary.id, context);
      }
    }

    return result;
  }

  private async loadPerformanceSummaryCandidateRecords(
    summary: PerformanceSummary,
    currentUser: CurrentUser,
    mode: PerformanceVerificationContextViewMode,
  ) {
    const includedEventIds = this.readPerformanceSummaryEventIds(summary.normalizedPayload);
    if (!includedEventIds.length) {
      return [] as PerformanceSummaryCandidateRecord[];
    }

    const events = await this.performanceEventRepository.find({
      where: { id: In(includedEventIds) },
      relations: {
        employee: true,
        handledByUser: true,
        classification: {
          performanceRule: true,
        },
      },
      order: {
        occurredAt: 'ASC',
        id: 'ASC',
      },
    });
    if (!events.length) {
      return [] as PerformanceSummaryCandidateRecord[];
    }

    const verificationContextMap = await this.buildPerformanceEventVerificationContextMap(
      events,
      currentUser,
      mode,
    );
    const customerBindingContextMap = await this.buildPerformanceEventCustomerBindingContextMap(
      events,
      verificationContextMap,
    );

    return events.map((event) => ({
      event,
      verificationContext: verificationContextMap.get(event.id) ?? null,
      customerBinding: customerBindingContextMap.get(event.id) ?? null,
    }));
  }

  private pickPrimaryPerformanceSummaryCandidate(candidates: PerformanceSummaryCandidateRecord[]) {
    return (
      candidates.find(
        (candidate) =>
          candidate.customerBinding?.performanceReadyFlag && candidate.verificationContext?.customerMobile,
      ) ??
      candidates.find((candidate) => candidate.verificationContext?.customerMobile) ??
      candidates.find((candidate) => candidate.customerBinding?.sourceCustomerMobile) ??
      candidates[0]
    );
  }

  private buildPerformanceSummaryCustomerContext(
    candidates: PerformanceSummaryCandidateRecord[],
  ): PerformanceSummaryCustomerContext | null {
    if (!candidates.length) {
      return null;
    }

    const mobileKeys = new Set<string>();
    let eventCountWithMobile = 0;
    for (const candidate of candidates) {
      const mobile = this.pickVerificationString(
        candidate.customerBinding?.matchedCustomerMobile,
        candidate.customerBinding?.sourceCustomerMobile,
        candidate.verificationContext?.sourceCustomerMobile,
        candidate.verificationContext?.matchedCustomerMobile,
      );
      if (mobile) {
        eventCountWithMobile += 1;
        mobileKeys.add(mobile);
      }
    }

    const primary = this.pickPrimaryPerformanceSummaryCandidate(candidates);

    const blockers = candidates
      .map((candidate) => candidate.customerBinding?.performanceBlockReason ?? null)
      .filter((item): item is NonNullable<PerformanceCustomerBindingContext['performanceBlockReason']> => Boolean(item));
    const uniqueBlockers = Array.from(new Set(blockers));
    const allReady = candidates.length > 0 && blockers.length === 0;
    const multiCustomerNote =
      mobileKeys.size > 1
        ? `汇总内包含 ${mobileKeys.size} 个不同手机号，列表显示第一候选；请进入详情逐条核对`
        : null;
    const primaryCandidates = this.filterPerformanceCandidatesByPrimaryCustomer(primary, candidates);
    const scopedCandidates = primaryCandidates.length ? primaryCandidates : [primary];
    const scopedVerificationContexts = scopedCandidates
      .map((candidate) => candidate.verificationContext)
      .filter((item): item is PerformanceVerificationSourceContext => Boolean(item));

    const customerBinding = primary.customerBinding
      ? {
          ...primary.customerBinding,
          performanceReadyFlag: multiCustomerNote ? primary.customerBinding.performanceReadyFlag : allReady,
          performanceBlockReason: multiCustomerNote
            ? primary.customerBinding.performanceBlockReason
            : allReady
              ? null
              : uniqueBlockers[0] ?? 'other',
          performanceDecisionReason: multiCustomerNote
            ? primary.customerBinding.performanceDecisionReason
            : allReady
              ? primary.customerBinding.performanceDecisionReason
              : `汇总内仍有 ${blockers.length} 条事件未满足绩效识别基础：${uniqueBlockers.join(', ') || 'other'}`,
          bindingRemark: multiCustomerNote
            ? [primary.customerBinding.bindingRemark, multiCustomerNote].filter(Boolean).join('；')
            : primary.customerBinding.bindingRemark,
      }
      : null;
    const summaryPaymentClassification = this.resolvePerformanceSummaryPaymentClassification(
      scopedVerificationContexts,
    );
    const bundleEvidence = this.resolvePerformanceSummaryBundleEvidence(scopedCandidates);

    return {
      customerName: primary.verificationContext?.customerName ?? null,
      customerMobile: primary.verificationContext?.customerMobile ?? null,
      carPlate: primary.verificationContext?.carPlate ?? null,
      sourceCustomerMobile: primary.verificationContext?.sourceCustomerMobile ?? null,
      sourceCustomerNameAlias: primary.verificationContext?.sourceCustomerNameAlias ?? null,
      matchedCustomerId:
        primary.customerBinding?.matchedCustomerId ?? primary.verificationContext?.matchedCustomerId ?? null,
      matchedCustomerName:
        primary.customerBinding?.matchedCustomerName ?? primary.verificationContext?.matchedCustomerName ?? null,
      matchedCustomerMobile:
        primary.customerBinding?.matchedCustomerMobile ?? primary.verificationContext?.matchedCustomerMobile ?? null,
      matchedOrderId: primary.verificationContext?.matchedOrderId ?? null,
      matchedOrderNo: primary.verificationContext?.matchedOrderNo ?? null,
      matchedSourceTable: primary.verificationContext?.matchedSourceTable ?? null,
      matchConfidence: primary.verificationContext?.matchConfidence ?? null,
      matchReason: [primary.verificationContext?.matchReason, multiCustomerNote].filter(Boolean).join('；') || null,
      evidenceSummary: [primary.verificationContext?.evidenceSummary, multiCustomerNote].filter(Boolean).join('；') || null,
      packageName: primary.verificationContext?.packageName ?? null,
      paymentStatus: summaryPaymentClassification?.paymentStatus ?? null,
      isPaid: summaryPaymentClassification?.isPaid ?? null,
      settlementType: summaryPaymentClassification?.settlementType ?? null,
      isTestData: summaryPaymentClassification?.isTestData ?? null,
      sourceClassification: summaryPaymentClassification?.sourceClassification ?? null,
      reconciliationStatus: summaryPaymentClassification?.reconciliationStatus ?? null,
      reconciliationReason: summaryPaymentClassification?.reconciliationReason ?? null,
      bundleEvidenceStrong: bundleEvidence.bundleEvidenceStrong,
      missingCItemSuspected: bundleEvidence.missingCItemSuspected,
      bundleInferenceReason: bundleEvidence.bundleInferenceReason,
      linkedBCardAmount: bundleEvidence.linkedBCardAmount,
      linkedBCardSourceType: bundleEvidence.linkedBCardSourceType,
      linkedPaidAAmount: bundleEvidence.linkedPaidAAmount,
      linkedBundleWindowDays: bundleEvidence.linkedBundleWindowDays,
      customerBinding,
      performanceReadyFlag: customerBinding?.performanceReadyFlag ?? null,
      performanceBlockReason: customerBinding?.performanceBlockReason ?? null,
      performanceDecisionReason: customerBinding?.performanceDecisionReason ?? null,
      customerBindingSummary: {
        eventCount: candidates.length,
        eventCountWithMobile,
        distinctCustomerMobileCount: mobileKeys.size,
        note: multiCustomerNote,
      },
    };
  }

  private filterPerformanceCandidatesByPrimaryCustomer(
    primary: PerformanceSummaryCandidateRecord,
    candidates: PerformanceSummaryCandidateRecord[],
  ) {
    const primaryMatchedCustomerId =
      primary.customerBinding?.matchedCustomerId ?? primary.verificationContext?.matchedCustomerId ?? null;
    if (primaryMatchedCustomerId) {
      return candidates.filter((candidate) => {
        const candidateMatchedCustomerId =
          candidate.customerBinding?.matchedCustomerId ?? candidate.verificationContext?.matchedCustomerId ?? null;
        return candidateMatchedCustomerId === primaryMatchedCustomerId;
      });
    }

    const primaryMobile = this.pickVerificationString(
      primary.customerBinding?.matchedCustomerMobile,
      primary.customerBinding?.sourceCustomerMobile,
      primary.verificationContext?.sourceCustomerMobile,
      primary.verificationContext?.matchedCustomerMobile,
      primary.verificationContext?.customerMobile,
    );
    if (!primaryMobile) {
      return [];
    }

    return candidates.filter((candidate) => {
      const candidateMobile = this.pickVerificationString(
        candidate.customerBinding?.matchedCustomerMobile,
        candidate.customerBinding?.sourceCustomerMobile,
        candidate.verificationContext?.sourceCustomerMobile,
        candidate.verificationContext?.matchedCustomerMobile,
        candidate.verificationContext?.customerMobile,
      );
      return candidateMobile === primaryMobile;
    });
  }

  private async recordPerformanceSummaryManualDecision(input: {
    sourceSummaryId: number;
    actionType: PerformanceSummaryManualDecisionAction;
    sourceSystem: string | null;
    sourceTable: string | null;
    sourceId: string | null;
    originalMatchedCustomerId: string | null;
    finalMatchedCustomerId: string | null;
    originalClassification: PerformanceManualClassification | null;
    finalClassification: PerformanceManualClassification | null;
    originalBindingStatus: PerformanceCustomerBindingContext['bindingStatus'] | null;
    finalBindingStatus: PerformanceCustomerBindingContext['bindingStatus'] | null;
    operatorId: number;
    operatorName: string | null;
    reasonCode: string | null;
    decisionScope: PerformanceManualDecisionScope;
    judgmentBasis: PerformanceManualJudgmentBasis[];
    aiLearningMode: PerformanceManualAiLearningMode;
    remark: string;
    affectPerformanceFlag: boolean;
    affectBCardFlag: boolean;
    normalizedPayload: Record<string, unknown> | null;
  }) {
    const record = this.performanceSummaryManualDecisionRepository.create({
      sourceSummaryId: input.sourceSummaryId,
      actionType: input.actionType,
      sourceSystem: input.sourceSystem,
      sourceTable: input.sourceTable,
      sourceId: input.sourceId,
      originalMatchedCustomerId: input.originalMatchedCustomerId,
      finalMatchedCustomerId: input.finalMatchedCustomerId,
      originalClassification: input.originalClassification,
      finalClassification: input.finalClassification,
      originalBindingStatus: input.originalBindingStatus,
      finalBindingStatus: input.finalBindingStatus,
      operatorId: input.operatorId,
      operatorName: input.operatorName,
      reasonCode: input.reasonCode,
      remark: input.remark,
      affectPerformanceFlag: input.affectPerformanceFlag,
      affectBCardFlag: input.affectBCardFlag,
      normalizedPayload: input.normalizedPayload,
    });

    return this.performanceSummaryManualDecisionRepository.save(record);
  }

  private mapPerformanceSummaryManualDecision(
    decision: PerformanceSummaryManualDecision,
    currentUser: CurrentUser,
    mode: PerformanceVerificationContextViewMode,
  ): PerformanceSummaryManualDecisionContext {
    const payload = (decision.normalizedPayload ?? {}) as Record<string, unknown>;
    return this.maskPerformanceSummaryManualDecision(
      {
        id: decision.id,
        actionType: decision.actionType as PerformanceSummaryManualDecisionAction,
        sourceSummaryId: decision.sourceSummaryId,
        originalMatchedCustomerId: decision.originalMatchedCustomerId,
        finalMatchedCustomerId: decision.finalMatchedCustomerId,
        originalClassification: this.normalizePerformanceManualClassification(
          decision.originalClassification,
        ),
        finalClassification: this.normalizePerformanceManualClassification(
          decision.finalClassification,
        ),
        originalBindingStatus:
          (decision.originalBindingStatus as PerformanceCustomerBindingContext['bindingStatus'] | null) ??
          null,
        finalBindingStatus:
          (decision.finalBindingStatus as PerformanceCustomerBindingContext['bindingStatus'] | null) ??
          null,
        operatorId: decision.operatorId,
        operatorName: decision.operatorName ?? decision.operator?.realName ?? decision.operator?.username ?? null,
        operatedAt: decision.operatedAt,
        reasonCode: decision.reasonCode,
        decisionScope: this.normalizePerformanceManualDecisionScope(
          this.readStringFromPathCandidates([payload], [['decisionScope']]),
        ),
        judgmentBasis: this.normalizePerformanceManualJudgmentBasis(
          this.readStringArrayFromPathCandidates([payload], [['judgmentBasis']]),
        ),
        aiLearningMode: this.normalizePerformanceManualAiLearningMode(
          this.readStringFromPathCandidates([payload], [['aiLearningMode']]),
        ),
        remark: decision.remark,
        affectPerformanceFlag: decision.affectPerformanceFlag,
        affectBCardFlag: decision.affectBCardFlag,
        normalizedPayload: decision.normalizedPayload,
      },
      currentUser,
      mode,
    );
  }

  private maskPerformanceSummaryManualDecision(
    decision: PerformanceSummaryManualDecisionContext,
    currentUser: CurrentUser,
    mode: PerformanceVerificationContextViewMode,
  ): PerformanceSummaryManualDecisionContext {
    const payload = decision.normalizedPayload ?? {};

    return {
      ...decision,
      normalizedPayload: {
        ...payload,
        originalMatchedCustomerName: this.applyVerificationMask(
          this.readStringFromPathCandidates([payload], [['originalMatchedCustomerName']]),
          'name',
          currentUser,
          mode,
        ),
        originalMatchedCustomerMobile: this.applyVerificationMask(
          this.readStringFromPathCandidates([payload], [['originalMatchedCustomerMobile']]),
          'mobile',
          currentUser,
          mode,
        ),
        finalMatchedCustomerName: this.applyVerificationMask(
          this.readStringFromPathCandidates([payload], [['finalMatchedCustomerName']]),
          'name',
          currentUser,
          mode,
        ),
        finalMatchedCustomerMobile: this.applyVerificationMask(
          this.readStringFromPathCandidates([payload], [['finalMatchedCustomerMobile']]),
          'mobile',
          currentUser,
          mode,
        ),
        sourceCustomerName: this.applyVerificationMask(
          this.readStringFromPathCandidates([payload], [['sourceCustomerName']]),
          'name',
          currentUser,
          mode,
        ),
        sourceCustomerMobile: this.applyVerificationMask(
          this.readStringFromPathCandidates([payload], [['sourceCustomerMobile']]),
          'mobile',
          currentUser,
          mode,
        ),
      },
    };
  }

  private normalizePerformanceManualClassification(
    value: string | null | undefined,
  ): PerformanceManualClassification | null {
    if (!value) {
      return null;
    }

    if (value === 'internal_admin') {
      return 'test_data';
    }

    if (
      value === 'a_card_sale' ||
      value === 'a_plus_c_bundle' ||
      value === 'points_redemption' ||
      value === 'employee_welfare' ||
      value === 'manual_activity' ||
      value === 'test_data' ||
      value === 'sheet_missing' ||
      value === 'self_recharge' ||
      value === 'other'
    ) {
      return value;
    }

    return null;
  }

  private normalizePerformanceManualDecisionScope(
    value: string | null | undefined,
  ): PerformanceManualDecisionScope {
    if (
      value === 'case_only' ||
      value === 'same_pattern' ||
      value === 'same_product_family' ||
      value === 'same_source_rule' ||
      value === 'global_rule' ||
      value === 'temporary_rule'
    ) {
      return value;
    }

    return 'case_only';
  }

  private normalizePerformanceManualJudgmentBasis(
    values: string[] | null | undefined,
  ): PerformanceManualJudgmentBasis[] {
    const normalized = [
      ...new Set(
        (values ?? []).filter(
          (value): value is PerformanceManualJudgmentBasis =>
            value === 'price_abnormal' ||
            value === 'non_catalog_product' ||
            value === 'manual_omission' ||
            value === 'bank_verified' ||
            value === 'paid_fact_overrides_sheet' ||
            value === 'points_redemption' ||
            value === 'employee_test' ||
            value === 'admin_test' ||
            value === 'source_conflict' ||
            value === 'operator_experience' ||
            value === 'other',
        ),
      ),
    ];

    return normalized.length ? normalized : ['other'];
  }

  private normalizePerformanceManualAiLearningMode(
    value: string | null | undefined,
  ): PerformanceManualAiLearningMode {
    if (
      value === 'do_not_generalize' ||
      value === 'suggest_same_pattern_only' ||
      value === 'can_generalize_with_review' ||
      value === 'treat_as_global_reference'
    ) {
      return value;
    }

    return 'do_not_generalize';
  }

  private buildPerformanceManualDecisionReasonCode(
    reasonCode: string | null | undefined,
    judgmentBasis: PerformanceManualJudgmentBasis[],
    decisionScope: PerformanceManualDecisionScope,
  ) {
    const normalized = this.pickVerificationString(reasonCode ?? null);
    if (normalized) {
      return normalized.slice(0, 100);
    }

    if (judgmentBasis.length === 1) {
      return `auto_basis_${judgmentBasis[0]}`.slice(0, 100);
    }

    if (judgmentBasis.length > 1) {
      return 'auto_basis_multiple';
    }

    return `auto_scope_${decisionScope}`.slice(0, 100);
  }

  private resolvePerformanceManualDecisionImpact(
    finalClassification: PerformanceManualClassification | null,
  ) {
    switch (finalClassification) {
      case 'a_card_sale':
      case 'sheet_missing':
        return { affectPerformanceFlag: true, affectBCardFlag: false };
      case 'a_plus_c_bundle':
        return { affectPerformanceFlag: true, affectBCardFlag: true };
      case 'points_redemption':
      case 'employee_welfare':
      case 'manual_activity':
        return { affectPerformanceFlag: false, affectBCardFlag: true };
      case 'test_data':
      case 'self_recharge':
      case 'other':
      default:
        return { affectPerformanceFlag: false, affectBCardFlag: false };
    }
  }

  private async loadPerformanceAbcSourceUserById(customerId: string) {
    const pool = this.getAbcSourceReadonlyPool();
    if (!pool) {
      return null;
    }

    try {
      const [rows] = await pool.query<any[]>(
        `SELECT id, name, mobile
           FROM user_account
          WHERE id = ?
          LIMIT 1`,
        [customerId],
      );
      const row = rows?.[0];
      if (!row) {
        return null;
      }

      return {
        id: String(row.id),
        name: this.normalizeAbcSourceCustomerName(
          this.normalizeVerificationSourceString(row.name),
          normalizeMainlandMobile(row.mobile),
        ),
        mobile: normalizeMainlandMobile(row.mobile) ?? null,
      };
    } catch {
      return null;
    }
  }

  private readPerformanceSummaryEventIds(payload: Record<string, unknown> | null | undefined) {
    const value = payload?.includedEventIds;
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
  }

  private resolvePerformanceSummaryPaymentClassification(
    contexts: PerformanceVerificationSourceContext[],
  ): PerformancePaymentClassification | null {
    if (!contexts.length) {
      return null;
    }

    const primaryContext = contexts.find((item) => item.customerMobile) ?? contexts[0];
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

  private resolvePerformanceSummaryBundleEvidence(
    candidates: Array<{
      event: PerformanceEvent;
      verificationContext: PerformanceVerificationSourceContext | null;
      customerBinding: PerformanceCustomerBindingContext | null;
    }>,
  ): PerformanceBundleEvidence {
    const resolveBundleCandidateAmount = (context: PerformanceVerificationSourceContext) => {
      const parsed = this.parsePerformanceAmount(context.cardIssuedAmountRaw ?? context.totalPriceRaw);
      if (
        parsed !== null &&
        context.goodsGroupId === '47' &&
        this.isPerformanceAmountEqual(context.totalPriceRaw, 600) &&
        parsed > 1000
      ) {
        return parsed / 100;
      }
      return parsed;
    };
    const contexts = candidates
      .map((candidate) => ({ event: candidate.event, context: candidate.verificationContext }))
      .filter(
        (item): item is { event: PerformanceEvent; context: PerformanceVerificationSourceContext } =>
          Boolean(item.context),
      );
    const paidAContexts = contexts.filter(
      ({ event, context }) =>
        event.sourceTable === 'goods_group_order' &&
        context.goodsGroupId === '47' &&
        context.isPaid &&
        context.paymentStatus === 'paid_cash' &&
        !context.isTestData &&
        this.isPerformanceAmountEqual(context.totalPriceRaw, 600),
    );
    const paidCContexts = contexts.filter(
      ({ event, context }) =>
        event.sourceTable === 'goods_group_order' &&
        context.goodsGroupId !== '47' &&
        context.isPaid &&
        context.paymentStatus === 'paid_cash' &&
        !context.isTestData &&
        this.isPerformanceAmountEqual(context.totalPriceRaw, 200),
    );
    const cardContexts = contexts.filter(({ event }) =>
      ['shopping_card', 'user_shopping_card', 'user_shopping_card_money', 'user_shopping_card_recharge'].includes(
        event.sourceTable,
      ),
    );
    const effectiveCardContexts = cardContexts.filter(
      ({ context }) =>
        context.paymentStatus !== 'unpaid' &&
        context.paymentStatus !== 'test_data' &&
        context.paymentStatus !== 'internal_admin' &&
        !context.isTestData,
    );
    const orderBundleCardContexts = paidAContexts.filter(({ context }) => {
      const bundleCItemCount = Number(context.bundleCItemCountRaw ?? '0');
      return (
        this.isPerformanceAmountEqual(
          resolveBundleCandidateAmount(context)?.toFixed(2) ?? null,
          600,
        ) &&
        Number.isFinite(bundleCItemCount) &&
        bundleCItemCount >= 2
      );
    });
    const effectiveBCardEvidenceContexts = effectiveCardContexts.length
      ? effectiveCardContexts
      : orderBundleCardContexts;
    const hasExternalBundle1000 = contexts.some(({ context }) => {
      const packageText = `${context.externalCardSalesPackageName ?? ''} ${context.packageName ?? ''}`.toLowerCase();
      return (
        this.isPerformanceAmountEqual(context.externalCardSalesAmount, 1000) ||
        packageText.includes('1000') ||
        packageText.includes('1a2c')
      );
    });
    const hasOrderPayloadBundleEvidence = orderBundleCardContexts.length > 0;
    const hasBundle1000Evidence = hasExternalBundle1000 || hasOrderPayloadBundleEvidence;
    const linkedBCardAmountValue = effectiveBCardEvidenceContexts.reduce((sum, { context }) => {
      const amount = resolveBundleCandidateAmount(context);
      return sum + (amount ?? 0);
    }, 0);
    const linkedPaidAAmountValue = paidAContexts.reduce(
      (sum, { context }) => sum + (this.parsePerformanceAmount(context.totalPriceRaw) ?? 0),
      0,
    );
    const linkedBCardSourceType = effectiveCardContexts.length
      ? this.resolvePerformanceBCardSourceType(
          effectiveCardContexts.map((item) => item.context),
          Boolean(paidAContexts.length),
          hasBundle1000Evidence,
          this.isPerformanceAmountEqual(String(linkedBCardAmountValue), 600),
        )
      : hasOrderPayloadBundleEvidence && this.isPerformanceAmountEqual(String(linkedBCardAmountValue), 600)
        ? 'issued_by_ac_bundle'
        : null;
    const linkedWindowDays = this.resolvePerformanceBundleWindowDays(candidates.map((item) => item.event.occurredAt));
    const disallowedBCardSources: PerformanceLinkedBCardSourceType[] = [
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
        linkedBCardAmount: linkedBCardAmountValue > 0 ? this.formatPerformanceAmount(linkedBCardAmountValue) : null,
        linkedBCardSourceType,
        linkedPaidAAmount: linkedPaidAAmountValue > 0 ? this.formatPerformanceAmount(linkedPaidAAmountValue) : null,
        linkedBundleWindowDays: linkedWindowDays,
      };
    }

    const bundleEvidenceStrong =
      paidAContexts.length > 0 &&
      this.isPerformanceAmountEqual(String(linkedBCardAmountValue), 600) &&
      linkedBCardSourceType === 'issued_by_ac_bundle' &&
      hasBundle1000Evidence &&
      (effectiveCardContexts.length > 0 || hasExternalBundle1000);
    const missingCItemSuspected = bundleEvidenceStrong && paidCContexts.length < 2;
    const missingPieces: string[] = [];

    if (!paidAContexts.length) {
      missingPieces.push('未找到A端600元已支付记录');
    }
    if (!this.isPerformanceAmountEqual(String(linkedBCardAmountValue), 600) || linkedBCardSourceType !== 'issued_by_ac_bundle') {
      missingPieces.push('未找到600元且来源为A+C联动的B端购物卡证据');
    }
    if (!hasBundle1000Evidence) {
      missingPieces.push('办卡明细未命中1000元套餐证据');
    }
    if (hasOrderPayloadBundleEvidence && !effectiveCardContexts.length && !hasExternalBundle1000) {
      missingPieces.push('源订单 payload 已声明 600 元 B 卡与 2 个 C 端，但当前缺独立 B 卡台账或办卡明细佐证');
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
      linkedBCardAmount: linkedBCardAmountValue > 0 ? this.formatPerformanceAmount(linkedBCardAmountValue) : null,
      linkedBCardSourceType,
      linkedPaidAAmount: linkedPaidAAmountValue > 0 ? this.formatPerformanceAmount(linkedPaidAAmountValue) : null,
      linkedBundleWindowDays: linkedWindowDays,
    };
  }

  private resolvePerformanceBCardSourceType(
    contexts: PerformanceVerificationSourceContext[],
    hasPaidAContext: boolean,
    hasExternalBundle1000: boolean,
    hasBCard600: boolean,
  ): PerformanceLinkedBCardSourceType | null {
    if (!contexts.length) {
      return null;
    }
    if (contexts.some((context) => context.paymentStatus === 'test_data' || context.paymentStatus === 'internal_admin' || context.isTestData)) {
      return 'issued_by_test';
    }
    if (contexts.some((context) => context.paymentStatus === 'paid_points' || context.sourceClassification === 'points_redemption')) {
      return 'issued_by_points_redemption';
    }
    if (contexts.some((context) => context.sourceClassification === 'manual_activity')) {
      return 'issued_by_manual_activity';
    }
    if (hasPaidAContext && hasExternalBundle1000 && hasBCard600) {
      return 'issued_by_ac_bundle';
    }
    return 'issued_by_other';
  }

  private isPerformanceAmountEqual(value: string | null | undefined, expected: number) {
    const parsed = this.parsePerformanceAmount(value);
    return parsed !== null && Math.abs(parsed - expected) < 0.01;
  }

  private formatPerformanceAmount(value: number) {
    return value.toFixed(2);
  }

  private resolvePerformanceBundleWindowDays(values: Array<Date | string | null | undefined>) {
    const timestamps = values
      .map((value) => {
        if (!value) return null;
        const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
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

  private async generateStarkWorkOrderEvents(context: BindingContext) {
    const records = await this.workOrderRepository.find({
      where: { status: 'completed' as never },
    });

    return this.generateEventsFromRows(
      records,
      PerformanceEventSourceDomain.WORK_ORDERS,
      async (record) => {
        const binding = this.resolveEmployeeBinding(
          [
            {
              sourceSystem: 'STARK',
              sourceTable: 'users',
              sourceId: record.responsibleUserId ? String(record.responsibleUserId) : null,
              bindingType: 'user',
            },
            {
              sourceSystem: 'STARK',
              sourceTable: 'users',
              sourceId: String(record.createdBy),
              bindingType: 'user',
            },
          ],
          context,
        );
        const reasons = this.buildRemarkReasons({
          employeeId: binding.employeeId,
        });

        return this.upsertPerformanceEvent({
          employeeId: binding.employeeId,
          sourceDomain: PerformanceEventSourceDomain.WORK_ORDERS,
          eventType: 'stark_work_order_completed',
          sourceSystem: 'STARK',
          sourceTable: 'work_orders',
          sourceId: String(record.id),
          sourceOrderNo: record.workOrderNo,
          amountStandard: this.pickWorkOrderAmount(record),
          quantityStandard: null,
          occurredAt: record.updatedAt ?? record.createdAt,
          confirmedFlag: reasons.length === 0,
          remark: this.joinRemarkReasons(reasons),
          normalizedPayload: {
            workOrderNo: record.workOrderNo,
            status: record.status,
            amountDue: record.amountDue,
            amountReceived: record.amountReceived,
            materialCostTotal: record.materialCostTotal,
            responsibleUserId: record.responsibleUserId,
            createdBy: record.createdBy,
            bindingMatched: binding.bindingKey,
          },
        });
      },
    );
  }

  private async generateStarkWorkOrderMaterialEvents(context: BindingContext) {
    const records = await this.workOrderMaterialRepository
      .createQueryBuilder('material')
      .where('material.deletedAt IS NULL')
      .getMany();

    return this.generateEventsFromRows(
      records,
      PerformanceEventSourceDomain.WORK_ORDERS,
      async (record) => {
        const binding = this.resolveEmployeeBinding(
          [
            {
              sourceSystem: 'STARK',
              sourceTable: 'users',
              sourceId: record.updatedBy ? String(record.updatedBy) : null,
              bindingType: 'user',
            },
            {
              sourceSystem: 'STARK',
              sourceTable: 'users',
              sourceId: String(record.createdBy),
              bindingType: 'user',
            },
          ],
          context,
        );
        const reasons = this.buildRemarkReasons({
          employeeId: binding.employeeId,
        });

        return this.upsertPerformanceEvent({
          employeeId: binding.employeeId,
          sourceDomain: PerformanceEventSourceDomain.WORK_ORDERS,
          eventType: 'stark_work_order_material_cost',
          sourceSystem: 'STARK',
          sourceTable: 'work_order_materials',
          sourceId: String(record.id),
          sourceOrderNo: null,
          amountStandard: normalizeMoney(record.totalPrice),
          quantityStandard: normalizeQuantity(record.quantity),
          occurredAt: record.updatedAt ?? record.createdAt,
          confirmedFlag: reasons.length === 0,
          remark: this.joinRemarkReasons(reasons),
          normalizedPayload: {
            workOrderId: record.workOrderId,
            materialId: record.materialId,
            sourceType: record.sourceType,
            warehouseId: record.warehouseId,
            preparationId: record.preparationId,
            unitPrice: record.unitPrice,
            totalPrice: record.totalPrice,
            bindingMatched: binding.bindingKey,
          },
        });
      },
    );
  }

  private async generateAbcOrderEvents(context: BindingContext) {
    const records = await this.abcSyncOrderRepository.find();

    return this.generateEventsFromRows(records, PerformanceEventSourceDomain.ORDERS, async (record) => {
      const binding = this.resolveEmployeeBinding(
        this.buildAbcBindingCandidates(record.sourceMerchantId, record.sourceUserId),
        context,
      );
      const reasons = this.buildRemarkReasons({
        employeeId: binding.employeeId,
        sourceMappingConfirmed: record.mappingConfirmed,
        sourceNotes: record.mappingNotes,
      });

      return this.upsertPerformanceEvent({
        employeeId: binding.employeeId,
        sourceDomain: PerformanceEventSourceDomain.ORDERS,
        eventType: 'abc_order_event',
        sourceSystem: record.sourceSystem,
        sourceTable: record.sourceTable,
        sourceId: record.sourceId,
        sourceOrderNo: record.sourceOrderNo,
        amountStandard: record.amountStandard ? normalizeMoney(record.amountStandard) : null,
        quantityStandard: null,
        occurredAt: record.sourceUpdatedAt ?? record.syncedAt,
        confirmedFlag: reasons.length === 0,
        remark: this.joinRemarkReasons(reasons),
        normalizedPayload: {
          businessType: record.businessType,
          statusStandard: record.statusStandard,
          sourceUserId: record.sourceUserId,
          sourceMerchantId: record.sourceMerchantId,
          syncBatchNo: record.syncBatchNo,
          mappingConfirmed: record.mappingConfirmed,
          mappingNotes: record.mappingNotes,
          bindingMatched: binding.bindingKey,
        },
      });
    });
  }

  private async generateAbcFundEvents(context: BindingContext) {
    const records = await this.abcSyncFundRepository.find();

    return this.generateEventsFromRows(records, PerformanceEventSourceDomain.FUNDS, async (record) => {
      const binding = this.resolveEmployeeBinding(
        this.buildAbcBindingCandidates(record.sourceMerchantId, record.sourceUserId),
        context,
      );
      const reasons = this.buildRemarkReasons({
        employeeId: binding.employeeId,
        sourceMappingConfirmed: record.mappingConfirmed,
        sourceNotes: record.mappingNotes,
      });

      return this.upsertPerformanceEvent({
        employeeId: binding.employeeId,
        sourceDomain: PerformanceEventSourceDomain.FUNDS,
        eventType: `abc_fund_${record.fundTypeStandard ?? 'event'}`,
        sourceSystem: record.sourceSystem,
        sourceTable: record.sourceTable,
        sourceId: record.sourceId,
        sourceOrderNo: record.sourceOrderNo,
        amountStandard: record.amountStandard ? normalizeMoney(record.amountStandard) : null,
        quantityStandard: null,
        occurredAt: record.sourceUpdatedAt ?? record.syncedAt,
        confirmedFlag: reasons.length === 0,
        remark: this.joinRemarkReasons(reasons),
        normalizedPayload: {
          fundTypeStandard: record.fundTypeStandard,
          statusStandard: record.statusStandard,
          directionStandard: record.directionStandard,
          relatedOrderNo: record.relatedOrderNo,
          sourceUserId: record.sourceUserId,
          sourceMerchantId: record.sourceMerchantId,
          syncBatchNo: record.syncBatchNo,
          mappingConfirmed: record.mappingConfirmed,
          mappingNotes: record.mappingNotes,
          bindingMatched: binding.bindingKey,
        },
      });
    });
  }

  private async generateAbcCardLedgerEvents(context: BindingContext) {
    const records = await this.abcSyncCardLedgerRepository.find();

    return this.generateEventsFromRows(records, PerformanceEventSourceDomain.CARDS, async (record) => {
      const binding = this.resolveEmployeeBinding(
        this.buildAbcBindingCandidates(record.sourceMerchantId, record.sourceUserId),
        context,
      );
      const reasons = this.buildRemarkReasons({
        employeeId: binding.employeeId,
        sourceMappingConfirmed: record.mappingConfirmed,
        sourceNotes: record.mappingNotes,
      });

      return this.upsertPerformanceEvent({
        employeeId: binding.employeeId,
        sourceDomain: PerformanceEventSourceDomain.CARDS,
        eventType:
          record.sourceTable === 'user_shopping_card_recharge'
            ? 'abc_card_recharge_event'
            : 'abc_card_ledger_event',
        sourceSystem: record.sourceSystem,
        sourceTable: record.sourceTable,
        sourceId: record.sourceId,
        sourceOrderNo: record.sourceOrderNo,
        amountStandard: record.amountStandard ? normalizeMoney(record.amountStandard) : null,
        quantityStandard: null,
        occurredAt: record.sourceUpdatedAt ?? record.syncedAt,
        confirmedFlag: reasons.length === 0,
        remark: this.joinRemarkReasons(reasons),
        normalizedPayload: {
          ledgerTypeStandard: record.ledgerTypeStandard,
          statusStandard: record.statusStandard,
          balanceStandard: record.balanceStandard,
          relatedCardSourceId: record.relatedCardSourceId,
          relatedOrderNo: record.relatedOrderNo,
          sourceUserId: record.sourceUserId,
          sourceMerchantId: record.sourceMerchantId,
          syncBatchNo: record.syncBatchNo,
          mappingConfirmed: record.mappingConfirmed,
          mappingNotes: record.mappingNotes,
          bindingMatched: binding.bindingKey,
        },
      });
    });
  }

  private async generateEventsFromRows<T>(
    rows: T[],
    sourceDomain: PerformanceEventSourceDomain,
    resolver: (row: T) => Promise<UpsertEventResult>,
  ): Promise<EventGenerateSummary> {
    const summary: EventGenerateSummary = {
      sourceDomain,
      generatedEvents: rows.length,
      createdEvents: 0,
      updatedEvents: 0,
      unconfirmedEvents: 0,
    };

    for (const row of rows) {
      const result = await resolver(row);
      if (result.action === 'created') {
        summary.createdEvents += 1;
      } else if (result.action === 'updated') {
        summary.updatedEvents += 1;
      }

      if (!result.confirmedFlag) {
        summary.unconfirmedEvents += 1;
      }
    }

    return summary;
  }

  private async upsertPerformanceEvent(input: UpsertEventInput) {
    const existing = await this.performanceEventRepository.findOne({
      where: {
        sourceSystem: input.sourceSystem,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        eventType: input.eventType,
      },
    });

    const payload = {
      employeeId: input.employeeId,
      sourceDomain: input.sourceDomain,
      eventType: input.eventType,
      sourceSystem: input.sourceSystem,
      sourceTable: input.sourceTable,
      sourceId: input.sourceId,
      sourceOrderNo: input.sourceOrderNo,
      amountStandard: input.amountStandard,
      quantityStandard: input.quantityStandard,
      occurredAt: input.occurredAt,
      periodKey: this.resolvePeriodKey(input.occurredAt),
      confirmedFlag: input.confirmedFlag,
      remark: input.remark,
      normalizedPayload: input.normalizedPayload,
    };

    if (!existing) {
      const saved = await this.performanceEventRepository.save(
        this.performanceEventRepository.create({
          ...payload,
          ignoredFlag: false,
          handledBy: null,
          handledAt: null,
          handlingAction: null,
          handlingRemark: null,
        }),
      );
      await this.syncClassificationForEvent(saved);
      const refreshed = await this.findPerformanceEventById(saved.id);
      return {
        action: 'created',
        confirmedFlag: refreshed.confirmedFlag,
      } satisfies UpsertEventResult;
    }

    Object.assign(existing, payload);
    const saved = await this.performanceEventRepository.save(existing);
    await this.syncClassificationForEvent(saved);
    const refreshed = await this.findPerformanceEventById(saved.id);
    return {
      action: 'updated',
      confirmedFlag: refreshed.confirmedFlag,
    } satisfies UpsertEventResult;
  }

  private buildPerformanceEventsQuery(query: QueryPerformanceEventsDto) {
    const qb = this.performanceEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.employee', 'employee')
      .leftJoinAndSelect('event.handledByUser', 'handledByUser')
      .leftJoinAndSelect('event.classification', 'classification')
      .leftJoinAndSelect('classification.performanceRule', 'rule');

    if (query.employeeId) {
      qb.andWhere('event.employeeId = :employeeId', { employeeId: query.employeeId });
    }
    if (query.sourceDomain) {
      qb.andWhere('event.sourceDomain = :sourceDomain', { sourceDomain: query.sourceDomain });
    }
    if (query.eventType) {
      qb.andWhere('event.eventType = :eventType', { eventType: query.eventType });
    }
    if (query.sourceTable) {
      qb.andWhere('event.sourceTable = :sourceTable', { sourceTable: query.sourceTable });
    }
    if (query.confirmedFlag !== undefined) {
      qb.andWhere('event.confirmedFlag = :confirmedFlag', {
        confirmedFlag: query.confirmedFlag,
      });
    }
    if (query.periodKey) {
      qb.andWhere('event.periodKey = :periodKey', { periodKey: query.periodKey });
    }
    if (query.dateFrom) {
      qb.andWhere('event.occurredAt >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }
    if (query.dateTo) {
      qb.andWhere('event.occurredAt <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private buildPerformanceSummariesQuery(query: QueryPerformanceSummariesDto) {
    const qb = this.performanceSummaryRepository
      .createQueryBuilder('summary')
      .leftJoinAndSelect('summary.employee', 'employee')
      .leftJoinAndSelect('summary.performancePeriod', 'period');

    if (query.employeeId) {
      qb.andWhere('summary.employeeId = :employeeId', { employeeId: query.employeeId });
    }
    if (query.sourceDomain) {
      qb.andWhere('summary.sourceDomain = :sourceDomain', { sourceDomain: query.sourceDomain });
    }
    if (query.periodKey) {
      qb.andWhere('period.periodKey = :periodKey', { periodKey: query.periodKey });
    }

    return qb;
  }

  private async regenerateSummaries(filters: {
    periodKey?: string;
    sourceDomains?: PerformanceEventSourceDomain[];
    eventIds?: number[];
  }) {
    const eventQb = this.performanceEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.classification', 'classification')
      .where('event.employeeId IS NOT NULL')
      .andWhere('event.ignoredFlag = :ignoredFlag', { ignoredFlag: false })
      .andWhere('classification.includeInPerformance = :includeInPerformance', {
        includeInPerformance: true,
      });

    if (filters.periodKey) {
      eventQb.andWhere('event.periodKey = :periodKey', { periodKey: filters.periodKey });
    }
    if (filters.sourceDomains?.length) {
      eventQb.andWhere('event.sourceDomain IN (:...sourceDomains)', {
        sourceDomains: filters.sourceDomains,
      });
    }
    if (filters.eventIds?.length) {
      eventQb.andWhere('event.id IN (:...eventIds)', { eventIds: filters.eventIds });
    }

    const allEvents = await eventQb.getMany();
    const events = allEvents.filter((event) => this.shouldIncludePerformanceEventInDefaultSummary(event));
    const targetPeriodKeys = filters.periodKey
      ? [filters.periodKey]
      : Array.from(new Set(allEvents.map((item) => item.periodKey)));
    const targetSourceDomains =
      filters.sourceDomains?.length
        ? filters.sourceDomains
        : Array.from(new Set(allEvents.map((item) => item.sourceDomain)));

    const periodMap = new Map<string, PerformancePeriod>();
    for (const periodKey of targetPeriodKeys) {
      periodMap.set(periodKey, await this.ensurePerformancePeriod(periodKey));
    }

    if (periodMap.size > 0) {
      const deleteQb = this.performanceSummaryRepository
        .createQueryBuilder()
        .delete()
        .where('performance_period_id IN (:...periodIds)', {
          periodIds: Array.from(periodMap.values()).map((item) => item.id),
        });

      if (targetSourceDomains.length > 0) {
        deleteQb.andWhere('source_domain IN (:...sourceDomains)', {
          sourceDomains: targetSourceDomains,
        });
      }

      await deleteQb.execute();
    }

    const grouped = new Map<string, PerformanceSummary>();
    for (const event of events) {
      const period = periodMap.get(event.periodKey);
      if (!period || !event.employeeId) {
        continue;
      }

      const key = `${period.id}|${event.employeeId}|${event.sourceDomain}`;
      const current =
        grouped.get(key) ??
        this.performanceSummaryRepository.create({
          performancePeriodId: period.id,
          employeeId: event.employeeId,
          sourceDomain: event.sourceDomain,
          eventCount: 0,
          confirmedEventCount: 0,
          pendingEventCount: 0,
          amountTotal: '0.00',
          quantityTotal: '0.00',
          normalizedPayload: {
            periodKey: period.periodKey,
            sourceDomain: event.sourceDomain,
            includedEventIds: [],
          },
        });

      current.eventCount += 1;
      current.confirmedEventCount += event.confirmedFlag ? 1 : 0;
      current.pendingEventCount += event.confirmedFlag ? 0 : 1;
      current.amountTotal = addMoney(current.amountTotal, event.amountStandard ?? '0.00');
      current.quantityTotal = addQuantity(current.quantityTotal, event.quantityStandard ?? '0.00');
      current.normalizedPayload = {
        ...current.normalizedPayload,
        eventCount: current.eventCount,
        confirmedEventCount: current.confirmedEventCount,
        pendingEventCount: current.pendingEventCount,
        includedEventIds: [
          ...(((current.normalizedPayload as Record<string, unknown>).includedEventIds as number[]) ??
            []),
          event.id,
        ],
      };
      grouped.set(key, current);
    }

    const summaries = Array.from(grouped.values());
    if (summaries.length > 0) {
      await this.performanceSummaryRepository.save(summaries);
    }

    return {
      periodKeys: targetPeriodKeys,
      sourceDomains: targetSourceDomains,
      eventCount: events.length,
      generatedSummaryCount: summaries.length,
      generatedAt: new Date().toISOString(),
    };
  }

  private shouldIncludePerformanceEventInDefaultSummary(event: PerformanceEvent) {
    if (event.sourceSystem !== 'ABC') {
      return true;
    }

    const payment = this.resolvePerformancePaymentClassificationFromEvent(event);
    return (
      payment.paymentStatus !== 'unpaid' &&
      payment.paymentStatus !== 'test_data' &&
      payment.paymentStatus !== 'internal_admin' &&
      !payment.isTestData
    );
  }

  private resolvePerformancePaymentClassificationFromEvent(event: PerformanceEvent) {
    const normalizedPayload = (event.normalizedPayload ?? {}) as Record<string, unknown>;
    const statusStandard = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload], [
        ['statusStandard'],
        ['status_standard'],
        ['cardStatusStandard'],
        ['card_status_standard'],
        ['rewardFlowControl', 'derivedFromStatusStandard'],
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
    const goodsGroupId = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload], [
        ['sourceMeta', 'goodsGroupId'],
        ['goodsGroupId'],
        ['goods_group_id'],
      ]),
    );

    return this.resolvePerformancePaymentClassification({
      sourceTable: event.sourceTable,
      statusStandard,
      amountRaw: event.amountStandard,
      pointDeductionRaw,
      cardLedgerType,
      goodsGroupId,
      hasExternalCardSalesEvidence: false,
      normalizedPayload,
      rawPayload: null,
    });
  }

  private async reclassifyEventsForRule(rule: PerformanceRule) {
    const events = await this.performanceEventRepository.find({
      where: {
        sourceDomain: rule.sourceDomain,
        eventType: rule.eventType,
      },
    });

    for (const event of events) {
      await this.syncClassificationForEvent(event);
    }

    const periodKeys = Array.from(new Set(events.map((item) => item.periodKey)));
    for (const periodKey of periodKeys) {
      await this.regenerateSummaries({
        periodKey,
        sourceDomains: [rule.sourceDomain],
      });
    }
  }

  private async regenerateSummariesForEvent(event: PerformanceEvent) {
    await this.regenerateSummaries({
      periodKey: event.periodKey,
      sourceDomains: [event.sourceDomain],
    });
  }

  private async syncClassificationForEvent(event: PerformanceEvent) {
    const rule = await this.resolvePerformanceRule(event.sourceDomain, event.eventType);
    const snapshot = this.buildClassificationSnapshot(rule);
    const existing = await this.performanceEventClassificationRepository.findOne({
      where: { performanceEventId: event.id },
    });

    const classification =
      existing ??
      this.performanceEventClassificationRepository.create({
        performanceEventId: event.id,
      });

    classification.performanceRuleId = snapshot.ruleId;
    classification.classificationKey = snapshot.classificationKey;
    classification.includeInPerformance = snapshot.includeInPerformance;
    classification.weight = snapshot.weight;
    classification.coefficient = snapshot.coefficient;
    classification.requiresManualConfirmation = snapshot.requiresManualConfirmation;
    classification.ruleMatchedFlag = snapshot.ruleMatchedFlag;
    classification.normalizedPayload = {
      sourceDomain: event.sourceDomain,
      eventType: event.eventType,
      ruleCode: snapshot.ruleCode,
      ruleName: snapshot.ruleName,
      classificationKey: snapshot.classificationKey,
      includeInPerformance: snapshot.includeInPerformance,
      requiresManualConfirmation: snapshot.requiresManualConfirmation,
      ruleMatchedFlag: snapshot.ruleMatchedFlag,
      updatedAt: new Date().toISOString(),
    };

    await this.performanceEventClassificationRepository.save(classification);

    const confirmedFlag = this.computePerformanceEventConfirmedFlag(event, snapshot);
    const remark = this.composePerformanceEventRemark(event, snapshot);

    if (event.confirmedFlag !== confirmedFlag || event.remark !== remark) {
      event.confirmedFlag = confirmedFlag;
      event.remark = remark;
      await this.performanceEventRepository.save(event);
    }
  }

  private async resolvePerformanceRule(
    sourceDomain: PerformanceEventSourceDomain,
    eventType: string,
  ) {
    return this.performanceRuleRepository.findOne({
      where: {
        sourceDomain,
        eventType,
        isActive: true,
      },
    });
  }

  private buildClassificationSnapshot(rule: PerformanceRule | null): ClassificationSnapshot {
    if (!rule || !rule.isActive) {
      return {
        ruleId: null,
        ruleCode: null,
        ruleName: null,
        classificationKey: null,
        includeInPerformance: false,
        weight: '1.00',
        coefficient: '1.00',
        requiresManualConfirmation: false,
        ruleMatchedFlag: false,
      };
    }

    return {
      ruleId: rule.id,
      ruleCode: rule.ruleCode,
      ruleName: rule.ruleName,
      classificationKey: rule.classificationKey,
      includeInPerformance: rule.includeInPerformance,
      weight: normalizeQuantity(rule.defaultWeight),
      coefficient: normalizeQuantity(rule.defaultCoefficient),
      requiresManualConfirmation: rule.requiresManualConfirmation,
      ruleMatchedFlag: true,
    };
  }

  private computePerformanceEventConfirmedFlag(
    event: PerformanceEvent,
    classification: ClassificationSnapshot,
  ) {
    if (event.ignoredFlag) {
      return false;
    }

    if (!event.employeeId) {
      return false;
    }

    if ((event.normalizedPayload as Record<string, unknown>)?.mappingConfirmed === false) {
      return false;
    }

    if (!classification.ruleMatchedFlag) {
      return false;
    }

    if (
      classification.requiresManualConfirmation &&
      event.handlingAction !== PerformanceHandlingAction.CONFIRM
    ) {
      return false;
    }

    return true;
  }

  private composePerformanceEventRemark(
    event: PerformanceEvent,
    classification: ClassificationSnapshot,
  ) {
    const reasons: string[] = [];
    const payload = (event.normalizedPayload ?? {}) as Record<string, unknown>;

    if (event.ignoredFlag) {
      reasons.push('已忽略');
    } else {
      if (!event.employeeId) {
        reasons.push('未绑定员工');
      }
      if (payload.mappingConfirmed === false) {
        reasons.push('来源映射未确认');
      }
      if (!classification.ruleMatchedFlag) {
        reasons.push('未命中绩效规则');
      }
      if (
        classification.requiresManualConfirmation &&
        event.handlingAction !== PerformanceHandlingAction.CONFIRM
      ) {
        reasons.push('待人工确认');
      }
    }

    if (typeof payload.mappingNotes === 'string' && payload.mappingNotes.trim()) {
      reasons.push(payload.mappingNotes.trim());
    }
    if (event.handlingRemark?.trim()) {
      reasons.push(`处理备注：${event.handlingRemark.trim()}`);
    }

    return reasons.length > 0 ? Array.from(new Set(reasons)).join('；') : null;
  }

  private async buildBindingContext(): Promise<BindingContext> {
    const [bindings, employees] = await Promise.all([
      this.employeeSourceBindingRepository.find({
        where: { isActive: true },
      }),
      this.employeeRepository.find({
        where: { status: 1 },
      }),
    ]);

    return {
      bindings: new Map(
        bindings.map((item) => [
          this.buildBindingKey(
            item.sourceSystem,
            item.sourceTable,
            item.sourceId,
            item.bindingType,
          ),
          item,
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

      const exactKey = this.buildBindingKey(
        candidate.sourceSystem,
        candidate.sourceTable,
        candidate.sourceId,
        candidate.bindingType,
      );
      const exact = context.bindings.get(exactKey);
      if (exact) {
        return {
          employeeId: exact.employeeId,
          bindingKey: exactKey,
        };
      }

      if (candidate.bindingType === 'mobile') {
        const normalizedMobile = normalizeMainlandMobile(candidate.sourceId);
        if (normalizedMobile) {
          const employee = context.employeeByMobile.get(normalizedMobile);
          if (employee) {
            return {
              employeeId: employee.id,
              bindingKey: `fallback:mobile:${normalizedMobile}`,
            };
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
          return {
            employeeId: employee.id,
            bindingKey: `fallback:${candidate.sourceId}`,
          };
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

    if (!input.employeeId) {
      reasons.push('未绑定员工');
    }
    if (input.sourceMappingConfirmed === false) {
      reasons.push('来源映射未确认');
    }
    if (input.sourceNotes?.trim()) {
      reasons.push(input.sourceNotes.trim());
    }

    return Array.from(new Set(reasons));
  }

  private joinRemarkReasons(reasons: string[]) {
    return reasons.length > 0 ? reasons.join('；') : null;
  }

  private buildBindingKey(
    sourceSystem: string,
    sourceTable: string,
    sourceId: string,
    bindingType: string,
  ) {
    return [sourceSystem, sourceTable, sourceId, bindingType].join('|');
  }

  private normalizeBindingSourceId(sourceId: string, bindingType: string) {
    const normalizedSourceId = sourceId.trim();
    if (bindingType.trim() !== 'mobile') {
      return normalizedSourceId;
    }

    const normalizedMobile = normalizeMainlandMobile(normalizedSourceId);
    if (!normalizedMobile) {
      throw new BadRequestException('手机号绑定的 sourceId 必须是有效手机号');
    }
    return normalizedMobile;
  }

  private resolvePeriodKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private async ensurePerformancePeriod(periodKey: string) {
    const existing = await this.performancePeriodRepository.findOne({
      where: {
        periodType: PerformancePeriodType.MONTHLY,
        periodKey,
      },
    });
    if (existing) {
      return existing;
    }

    const [year, month] = periodKey.split('-').map((item) => Number(item));
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return this.performancePeriodRepository.save(
      this.performancePeriodRepository.create({
        periodType: PerformancePeriodType.MONTHLY,
        periodKey,
        periodStart: this.formatDateOnly(startDate),
        periodEnd: this.formatDateOnly(endDate),
        status: PerformancePeriodStatus.OPEN,
        remark: null,
      }),
    );
  }

  private formatDateOnly(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private pickWorkOrderAmount(workOrder: WorkOrder) {
    if (Number(workOrder.amountReceived) > 0) {
      return normalizeMoney(workOrder.amountReceived);
    }

    return normalizeMoney(workOrder.amountDue);
  }

  private mapEmployee(employee: Employee) {
    const displayName = this.composeEmployeeDisplayName(employee.name, employee.nameRemark);
    return {
      id: employee.id,
      name: employee.name,
      employeeName: employee.name,
      legalName: employee.name,
      nameRemark: employee.nameRemark,
      displayName,
      linkedUserId: employee.linkedUserId,
      linkedUserName: employee.linkedUser?.realName ?? null,
      linkedUsername: employee.linkedUser?.username ?? null,
      mobile: employee.mobile,
      employeeMobile: employee.mobile,
      companyId: null,
      companyName: employee.sourceCompanyName,
      sourceCompanyName: employee.sourceCompanyName,
      positionName: employee.positionName,
      enabledFlag: employee.status === 1,
      status: employee.status,
      sourceFileName: employee.sourceFileName,
      sourceRowIndex: employee.sourceRowIndex,
      importedAt: employee.importedAt,
      importBatchNo: employee.importBatchNo,
      importConflictNote: employee.importConflictNote,
      referralCode: employee.referralCode,
      referredByEmployeeId: employee.referredByEmployeeId,
      referredByEmployeeMobile: employee.referredByEmployeeMobile,
      referralSourceType: employee.referralSourceType,
      remark: employee.remark,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

  private mapBinding(binding: EmployeeSourceBinding) {
    return {
      id: binding.id,
      employeeId: binding.employeeId,
      employeeName: binding.employee?.name ?? null,
      employeeNameRemark: binding.employee?.nameRemark ?? null,
      employeeDisplayName: this.composeEmployeeDisplayName(
        binding.employee?.name ?? '',
        binding.employee?.nameRemark ?? null,
      ),
      employeeMobile: binding.employee?.mobile ?? null,
      employeeCompanyName: binding.employee?.sourceCompanyName ?? null,
      employeePositionName: binding.employee?.positionName ?? null,
      sourceSystem: binding.sourceSystem,
      sourceTable: binding.sourceTable,
      sourceId: binding.sourceId,
      bindingType: binding.bindingType,
      isActive: binding.isActive,
      remark: binding.remark,
      createdAt: binding.createdAt,
      updatedAt: binding.updatedAt,
    };
  }

  private async buildPerformanceEventVerificationContextMap(
    events: PerformanceEvent[],
    currentUser: CurrentUser,
    mode: PerformanceVerificationContextViewMode,
  ) {
    if (!events.length) {
      return new Map<number, PerformanceVerificationSourceContext>();
    }

    const [rawOrderMap, rawCardMap, rawTransactionMap, workOrderMap] = await Promise.all([
      this.loadPerformanceAbcRawOrderMap(events),
      this.loadPerformanceAbcRawCardMap(events),
      this.loadPerformanceAbcRawTransactionMap(events),
      this.loadPerformanceWorkOrderMap(events),
    ]);
    const abcSourceCustomerProfileMap = await this.loadPerformanceAbcSourceCustomerProfileMap(
      events,
      rawOrderMap,
      rawCardMap,
      rawTransactionMap,
    );
    const abcSourceGoodsGroupOrderProfileMap =
      await this.loadPerformanceAbcSourceGoodsGroupOrderProfileMap(events);
    const externalCardSalesEvidenceMap = await this.loadPerformanceExternalCardSalesEvidenceMap(
      events,
      rawOrderMap,
      abcSourceCustomerProfileMap,
      abcSourceGoodsGroupOrderProfileMap,
    );

    const result = new Map<number, PerformanceVerificationSourceContext>();
    for (const event of events) {
      result.set(
        event.id,
        this.buildPerformanceVerificationContext(
          event,
          rawOrderMap,
          rawCardMap,
          rawTransactionMap,
          workOrderMap,
          abcSourceCustomerProfileMap,
          abcSourceGoodsGroupOrderProfileMap,
          externalCardSalesEvidenceMap,
          currentUser,
          mode,
        ),
      );
    }

    return result;
  }

  private async buildPerformanceEventCustomerBindingContextMap(
    events: PerformanceEvent[],
    verificationContextMap: Map<number, PerformanceVerificationSourceContext>,
  ) {
    if (!events.length) {
      return new Map<number, PerformanceCustomerBindingContext>();
    }

    const sourceSystems = Array.from(new Set(events.map((item) => item.sourceSystem)));
    const sourceTables = Array.from(new Set(events.map((item) => item.sourceTable)));
    const sourceIds = Array.from(new Set(events.map((item) => item.sourceId)));

    const existingBindings = await this.customerIdentificationBindingRepository
      .createQueryBuilder('binding')
      .leftJoinAndSelect('binding.boundByUser', 'boundByUser')
      .where('binding.sourceSystem IN (:...sourceSystems)', { sourceSystems })
      .andWhere('binding.sourceTable IN (:...sourceTables)', { sourceTables })
      .andWhere('binding.sourceId IN (:...sourceIds)', { sourceIds })
      .getMany();

    const existingBindingMap = new Map(
      existingBindings.map((item) => [
        this.buildSourceRecordKey(item.sourceTable, item.sourceId),
        item,
      ]),
    );

    const result = new Map<number, PerformanceCustomerBindingContext>();
    for (const event of events) {
      const sourceRecordKey = this.buildSourceRecordKey(event.sourceTable, event.sourceId);
      result.set(
        event.id,
        this.buildPerformanceCustomerBindingContext(
          event,
          verificationContextMap.get(event.id) ?? null,
          existingBindingMap.get(sourceRecordKey) ?? null,
        ),
      );
    }

    return result;
  }

  private async loadPerformanceAbcRawOrderMap(events: PerformanceEvent[]) {
    const sourceTables = [
      ...new Set(
        events
          .filter((item) => item.sourceSystem === 'ABC')
          .map((item) => item.sourceTable)
          .filter((sourceTable) => this.isOrderSourceTable(sourceTable)),
      ),
    ];
    if (!sourceTables.length) {
      return new Map<string, AbcRawOrder>();
    }

    const sourceTableSet = new Set<string>(sourceTables);
    const sourceIds = [
      ...new Set(
        events
          .filter((item) => item.sourceSystem === 'ABC' && sourceTableSet.has(item.sourceTable))
          .map((item) => item.sourceId),
      ),
    ];
    if (!sourceIds.length) {
      return new Map<string, AbcRawOrder>();
    }

    const rows = await this.abcRawOrderRepository
      .createQueryBuilder('raw')
      .where('raw.sourceSystem = :sourceSystem', { sourceSystem: 'ABC' })
      .andWhere('raw.sourceTable IN (:...sourceTables)', { sourceTables })
      .andWhere('raw.sourceId IN (:...sourceIds)', { sourceIds })
      .getMany();

    return new Map(rows.map((row) => [this.buildSourceRecordKey(row.sourceTable, row.sourceId), row]));
  }

  private async loadPerformanceAbcRawCardMap(events: PerformanceEvent[]) {
    const sourceTables = [
      ...new Set(
        events
          .filter((item) => item.sourceSystem === 'ABC')
          .map((item) => item.sourceTable)
          .filter((sourceTable) => this.isCardSourceTable(sourceTable)),
      ),
    ];
    if (!sourceTables.length) {
      return new Map<string, AbcRawCard>();
    }

    const sourceTableSet = new Set<string>(sourceTables);
    const sourceIds = [
      ...new Set(
        events
          .filter((item) => item.sourceSystem === 'ABC' && sourceTableSet.has(item.sourceTable))
          .map((item) => item.sourceId),
      ),
    ];
    if (!sourceIds.length) {
      return new Map<string, AbcRawCard>();
    }

    const rows = await this.abcRawCardRepository
      .createQueryBuilder('raw')
      .where('raw.sourceSystem = :sourceSystem', { sourceSystem: 'ABC' })
      .andWhere('raw.sourceTable IN (:...sourceTables)', { sourceTables })
      .andWhere('raw.sourceId IN (:...sourceIds)', { sourceIds })
      .getMany();

    return new Map(rows.map((row) => [this.buildSourceRecordKey(row.sourceTable, row.sourceId), row]));
  }

  private async loadPerformanceAbcRawTransactionMap(events: PerformanceEvent[]) {
    const sourceTables = [
      ...new Set(
        events
          .filter((item) => item.sourceSystem === 'ABC')
          .map((item) => item.sourceTable)
          .filter((sourceTable) => this.isTransactionSourceTable(sourceTable)),
      ),
    ];
    if (!sourceTables.length) {
      return new Map<string, AbcRawTransaction>();
    }

    const sourceTableSet = new Set<string>(sourceTables);
    const sourceIds = [
      ...new Set(
        events
          .filter((item) => item.sourceSystem === 'ABC' && sourceTableSet.has(item.sourceTable))
          .map((item) => item.sourceId),
      ),
    ];
    if (!sourceIds.length) {
      return new Map<string, AbcRawTransaction>();
    }

    const rows = await this.abcRawTransactionRepository
      .createQueryBuilder('raw')
      .where('raw.sourceSystem = :sourceSystem', { sourceSystem: 'ABC' })
      .andWhere('raw.sourceTable IN (:...sourceTables)', { sourceTables })
      .andWhere('raw.sourceId IN (:...sourceIds)', { sourceIds })
      .getMany();

    return new Map(rows.map((row) => [this.buildSourceRecordKey(row.sourceTable, row.sourceId), row]));
  }

  private async loadPerformanceWorkOrderMap(events: PerformanceEvent[]) {
    const ids = events
      .map((item) => this.resolveWorkOrderIdForPerformanceEvent(item))
      .filter((item): item is number => typeof item === 'number' && Number.isInteger(item) && item > 0);

    if (!ids.length) {
      return new Map<number, WorkOrder>();
    }

    const workOrders = await this.workOrderRepository
      .createQueryBuilder('workOrder')
      .where('workOrder.id IN (:...ids)', { ids: [...new Set(ids)] })
      .getMany();

    return new Map(workOrders.map((item) => [item.id, item]));
  }

  private async loadPerformanceAbcSourceCustomerProfileMap(
    events: PerformanceEvent[],
    rawOrderMap: Map<string, AbcRawOrder>,
    rawCardMap: Map<string, AbcRawCard>,
    rawTransactionMap: Map<string, AbcRawTransaction>,
  ) {
    const pool = this.getAbcSourceReadonlyPool();
    if (!pool) {
      return new Map<string, AbcSourceCustomerProfile>();
    }

    const recordUserIds = new Map<string, string>();
    for (const event of events) {
      const recordKey = this.buildSourceRecordKey(event.sourceTable, event.sourceId);
      const normalizedPayload = (event.normalizedPayload ?? {}) as Record<string, unknown>;
      const rawOrder = rawOrderMap.get(recordKey);
      const rawCard = rawCardMap.get(recordKey);
      const rawTransaction = rawTransactionMap.get(recordKey);
      const rawPayload =
        rawOrder?.rawPayload ?? rawCard?.rawPayload ?? rawTransaction?.rawPayload ?? null;

      const userId = this.pickVerificationString(
        this.readStringFromPathCandidates([normalizedPayload], [['sourceUserId']]),
        this.readStringFromPathCandidates([normalizedPayload], [['sourceRefs', 'userId']]),
        this.readStringFromPathCandidates([rawPayload], [['user_id'], ['userId']]),
      );

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

  private async loadPerformanceAbcSourceGoodsGroupOrderProfileMap(events: PerformanceEvent[]) {
    const pool = this.getAbcSourceReadonlyPool();
    if (!pool) {
      return new Map<string, AbcSourceGoodsGroupOrderProfile>();
    }

    const sourceIds = [
      ...new Set(
        events
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

  private async loadPerformanceExternalCardSalesEvidenceMap(
    events: PerformanceEvent[],
    rawOrderMap: Map<string, AbcRawOrder>,
    abcSourceCustomerProfileMap: Map<string, AbcSourceCustomerProfile>,
    abcSourceGoodsGroupOrderProfileMap: Map<string, AbcSourceGoodsGroupOrderProfile>,
  ) {
    const relevantEvents = events.filter((item) => item.sourceTable === 'goods_group_order');
    if (!relevantEvents.length) {
      return new Map<string, ExternalCardSalesStagingContext>();
    }

    const periodKeys = [
      ...new Set(
        relevantEvents
          .map((item) => normalizeVerificationPeriodKey(item.occurredAt.toISOString()))
          .filter((item): item is string => Boolean(item)),
      ),
    ];
    if (!periodKeys.length) {
      return new Map<string, ExternalCardSalesStagingContext>();
    }

    const latestImportBatchNos = await this.loadLatestPerformanceExternalCardSalesImportBatchNos(periodKeys);
    if (!latestImportBatchNos.length) {
      return new Map<string, ExternalCardSalesStagingContext>();
    }

    const scopedStagingRows = await this.externalCardSalesStagingRepository
      .createQueryBuilder('staging')
      .where('staging.periodKey IN (:...periodKeys)', { periodKeys })
      .andWhere('staging.importBatchNo IN (:...importBatchNos)', {
        importBatchNos: latestImportBatchNos,
      })
      .orderBy('staging.saleDate', 'ASC')
      .addOrderBy('staging.sourceRowNo', 'ASC')
      .getMany();
    if (!scopedStagingRows.length) {
      return new Map<string, ExternalCardSalesStagingContext>();
    }

    const stagingContexts = scopedStagingRows.map((row) => ({
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
    const stagingMobileUserMap = await this.loadPerformanceAbcSourceUsersByMobile(stagingMobiles);

    const rowsByUserPeriod = new Map<string, Array<any>>();
    const rowsByMobilePeriod = new Map<string, Array<any>>();
    for (const row of stagingContexts) {
      const matchedUserCandidates = row.sourceCustomerMobile
        ? stagingMobileUserMap.get(row.sourceCustomerMobile) ?? []
        : [];
      const matchedUserCandidate = matchedUserCandidates.length === 1 ? matchedUserCandidates[0] : null;
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
    for (const event of relevantEvents) {
      const recordKey = this.buildSourceRecordKey(event.sourceTable, event.sourceId);
      const rawOrder = rawOrderMap.get(recordKey);
      const orderProfile = abcSourceGoodsGroupOrderProfileMap.get(recordKey);
      const customerProfile = abcSourceCustomerProfileMap.get(recordKey);
      const normalizedPayload = (event.normalizedPayload ?? {}) as Record<string, unknown>;
      const rawPayload = rawOrder?.rawPayload ?? null;
      const sourceUserId = this.pickVerificationString(
        this.readStringFromPathCandidates([normalizedPayload], [['sourceCustomerId']]),
        this.readStringFromPathCandidates([normalizedPayload], [['sourceRefs', 'userId']]),
        this.readStringFromPathCandidates([rawPayload], [['user_id'], ['userId']]),
        orderProfile?.userId ?? null,
      );
      const purchaseDate = normalizeVerificationDateKey(
        orderProfile?.purchaseTime ?? event.occurredAt.toISOString(),
      );
      const periodKey = normalizeVerificationPeriodKey(purchaseDate ?? event.periodKey);
      const sourceProjectCode = normalizeVerificationProjectCode(
        this.pickVerificationString(
          this.readStringFromPathCandidates([normalizedPayload], [['packageName'], ['projectName']]),
          this.readStringFromPathCandidates([rawPayload], [
            ['package_name'],
            ['packageName'],
            ['goods_group_name'],
            ['goodsGroupName'],
            ['project'],
            ['title'],
          ]),
        ),
        event.amountStandard,
      );
      const sourceAmount = normalizeVerificationAmount(event.amountStandard);

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
          matchedOrderNo:
            this.pickVerificationString(event.sourceOrderNo, orderProfile?.sourceOrderNo ?? null) ?? null,
          matchedSourceTable: event.sourceTable,
          matchConfidence: this.scoreToConfidence(best.score),
          matchReason: best.reasons.join('；'),
          evidenceSummary: `${baseContext.sourceFileName}#${baseContext.sourceSheetName ?? 'Sheet1'}!R${
            baseContext.sourceRowNo
          } 通过手机号反查命中 customer/user，并与当前 goods_group_order 记录完成日期/金额/项目二次校验`,
        });
        continue;
      }

      if (uniqueMatchedCustomerId && uniqueMatchedCustomerMobile) {
        result.set(recordKey, {
          ...baseContext,
          matchedOrderNo: null,
          matchedSourceTable: event.sourceTable,
          matchConfidence: '0.7000',
          matchReason: '手机号反查可锁定客户主键，但同周期存在多条办卡明细，仍需人工核对具体一笔',
          evidenceSummary: `${baseContext.sourceFileName}#${baseContext.sourceSheetName ?? 'Sheet1'} 存在同手机号办卡记录，可反查客户主键，但具体购买行仍需人工核对`,
        });
      }
    }

    return result;
  }

  private async loadLatestPerformanceExternalCardSalesImportBatchNos(periodKeys: string[]) {
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

  private async loadPerformanceAbcSourceUsersByMobile(mobiles: string[]) {
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

  private buildPerformanceVerificationContext(
    event: PerformanceEvent,
    rawOrderMap: Map<string, AbcRawOrder>,
    rawCardMap: Map<string, AbcRawCard>,
    rawTransactionMap: Map<string, AbcRawTransaction>,
    workOrderMap: Map<number, WorkOrder>,
    abcSourceCustomerProfileMap: Map<string, AbcSourceCustomerProfile>,
    abcSourceGoodsGroupOrderProfileMap: Map<string, AbcSourceGoodsGroupOrderProfile>,
    externalCardSalesEvidenceMap: Map<string, ExternalCardSalesStagingContext>,
    currentUser: CurrentUser,
    mode: PerformanceVerificationContextViewMode,
  ): PerformanceVerificationSourceContext {
    const key = this.buildSourceRecordKey(event.sourceTable, event.sourceId);
    const rawOrder = rawOrderMap.get(key);
    const rawCard = rawCardMap.get(key);
    const rawTransaction = rawTransactionMap.get(key);
    const rawPayload =
      rawOrder?.rawPayload ?? rawCard?.rawPayload ?? rawTransaction?.rawPayload ?? null;
    const rawPayloadSources = collectVerificationObjectSources(rawPayload);
    const normalizedPayload = (event.normalizedPayload ?? {}) as Record<string, unknown>;
    const workOrderId = this.resolveWorkOrderIdForPerformanceEvent(event);
    const workOrder = workOrderId ? workOrderMap.get(workOrderId) ?? null : null;
    const abcSourceCustomerProfile = abcSourceCustomerProfileMap.get(key);
    const abcSourceGoodsGroupOrderProfile = abcSourceGoodsGroupOrderProfileMap.get(key);
    const externalCardSalesEvidence = externalCardSalesEvidenceMap.get(key) ?? null;
    const sourceUserId = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload], [['sourceUserId'], ['source_user_id']]),
      this.readStringFromPathCandidates([normalizedPayload], [['sourceCustomerId']]),
      this.readStringFromPathCandidates([normalizedPayload], [['sourceRefs', 'userId']]),
      this.readStringFromPathCandidates([rawPayload], [['user_id'], ['userId']]),
      abcSourceGoodsGroupOrderProfile?.userId ?? null,
    );

    const rawCustomerMobile = this.pickVerificationString(
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
    );
    const sourceCustomerMobile = normalizeMainlandMobile(rawCustomerMobile) ?? null;

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
    const matchedCustomerMobile =
      normalizeMainlandMobile(
        this.pickVerificationString(
          externalCardSalesEvidence?.matchedCustomerMobile ?? null,
          sourceCustomerMobile,
        ),
      ) ?? null;

    const sourceCarPlate = this.pickVerificationString(
      abcSourceCustomerProfile?.carPlate ?? null,
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['sourceMeta', 'carPlate'],
        ['sourceCarPlate'],
        ['car_plate'],
        ['carPlate'],
        ['car_num'],
        ['carNo'],
        ['plate'],
        ['plate_no'],
        ['license_plate'],
      ]),
      externalCardSalesEvidence?.sourceCarPlate ?? null,
    );
    const packageName = this.pickVerificationString(
      externalCardSalesEvidence?.packageOrProjectName ?? null,
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['sourceMeta', 'packageName'],
        ['sourceMeta', 'goodsGroupName'],
        ['packageName'],
        ['package_name'],
        ['goodsGroupName'],
        ['goods_group_name'],
        ['projectName'],
        ['project_name'],
        ['title'],
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
    const pointDeductionRaw = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['point_deduction'],
        ['pointDeduction'],
        ['integral'],
      ]),
    );
    const cardLedgerType = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['ledgerType', 'standard'],
        ['ledgerTypeStandard'],
        ['ledger_type_standard'],
        ['sourceMeta', 'sourceType'],
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
    const bundleCItemCountRaw = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['sourceMeta', 'quantityC'],
        ['quantityC'],
        ['quantity_c'],
      ]),
    );
    const goodsGroupId = this.pickVerificationString(
      this.readStringFromPathCandidates([normalizedPayload, ...rawPayloadSources], [
        ['sourceMeta', 'goodsGroupId'],
        ['goodsGroupId'],
        ['goods_group_id'],
      ]),
    );
    const paymentClassification = this.resolvePerformancePaymentClassification({
      sourceTable: event.sourceTable,
      statusStandard,
      amountRaw: event.amountStandard,
      pointDeductionRaw,
      cardLedgerType,
      goodsGroupId,
      hasExternalCardSalesEvidence: Boolean(externalCardSalesEvidence),
      normalizedPayload,
      rawPayload,
    });

    return {
      sourceCustomerName,
      sourceCustomerMobile,
      sourceCarPlate,
      sourceCustomerNameAlias,
      customerName: this.applyVerificationMask(
        matchedCustomerName ?? sourceCustomerName ?? sourceCustomerNameAlias,
        'name',
        currentUser,
        mode,
      ),
      customerMobile: this.applyVerificationMask(
        matchedCustomerMobile ?? sourceCustomerMobile,
        'mobile',
        currentUser,
        mode,
      ),
      carPlate: this.applyVerificationMask(sourceCarPlate, 'plate', currentUser, mode),
      matchedCustomerId: externalCardSalesEvidence?.matchedCustomerId ?? sourceUserId ?? null,
      matchedCustomerName: this.applyVerificationMask(
        externalCardSalesEvidence?.matchedCustomerName ?? matchedCustomerName,
        'name',
        currentUser,
        mode,
      ),
      matchedCustomerMobile: this.applyVerificationMask(
        externalCardSalesEvidence?.matchedCustomerMobile ?? matchedCustomerMobile,
        'mobile',
        currentUser,
        mode,
      ),
      matchedOrderId: event.sourceTable === 'goods_group_order' ? event.sourceId : null,
      matchedOrderNo:
        externalCardSalesEvidence?.matchedOrderNo ??
        this.pickVerificationString(event.sourceOrderNo, abcSourceGoodsGroupOrderProfile?.sourceOrderNo ?? null),
      matchedSourceTable: externalCardSalesEvidence?.matchedSourceTable ?? (sourceUserId ? 'user_account' : event.sourceTable),
      matchConfidence: externalCardSalesEvidence?.matchConfidence ?? (sourceUserId && sourceCustomerMobile ? '0.9000' : null),
      matchReason:
        externalCardSalesEvidence?.matchReason ??
        (sourceUserId && sourceCustomerMobile
          ? '源订单 user_id 与 ABC user_account.mobile 唯一命中，可作为强候选客户绑定'
          : null),
      evidenceSummary:
        externalCardSalesEvidence?.evidenceSummary ??
        (sourceUserId && sourceCustomerMobile
          ? `goods_group_order#${event.sourceId} -> sourceUserId=${sourceUserId} -> user_account.mobile=${sourceCustomerMobile}，该记录已具备只读强候选客户证据，但仍需人工确认正式绑定`
          : null),
      packageName,
      goodsGroupId,
      totalPriceRaw: event.amountStandard ?? null,
      externalCardSalesPackageName: externalCardSalesEvidence?.packageOrProjectName ?? null,
      externalCardSalesAmount: externalCardSalesEvidence?.amount ?? null,
      cardIssuedAmountRaw,
      cardBalanceAmountRaw,
      bundleCItemCountRaw,
      cardLedgerType,
      paymentStatus: paymentClassification.paymentStatus,
      isPaid: paymentClassification.isPaid,
      settlementType: paymentClassification.settlementType,
      isTestData: paymentClassification.isTestData,
      sourceClassification: paymentClassification.sourceClassification,
      reconciliationStatus: paymentClassification.reconciliationStatus,
      reconciliationReason: paymentClassification.reconciliationReason,
    };
  }

  private resolvePerformancePaymentClassification(input: {
    sourceTable: string;
    statusStandard: string | null;
    amountRaw: string | null;
    pointDeductionRaw: string | null;
    cardLedgerType: string | null;
    goodsGroupId: string | null;
    hasExternalCardSalesEvidence: boolean;
    normalizedPayload: Record<string, unknown> | null;
    rawPayload: Record<string, unknown> | null | undefined;
  }): PerformancePaymentClassification {
    const status = (input.statusStandard ?? '').trim().toLowerCase();
    const amount = this.parsePerformanceAmount(input.amountRaw);
    const pointDeduction = this.parsePerformanceAmount(input.pointDeductionRaw);
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
    const isTestData = amount !== null && amount <= 1 && !hasPointsEvidence && !hasPaidStatus;

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
        reconciliationReason: 'small_amount_without_points_or_paid_status_marks_test_data',
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
            ? 'manual_omission'
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

  private parsePerformanceAmount(value: string | null | undefined) {
    if (!value) return null;
    const parsed = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
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

  private buildPerformanceCustomerBindingContext(
    event: PerformanceEvent,
    verificationContext: PerformanceVerificationSourceContext | null,
    existingBinding: CustomerIdentificationBinding | null,
  ): PerformanceCustomerBindingContext {
    const sourceCustomerName =
      existingBinding?.sourceCustomerName ?? verificationContext?.sourceCustomerName ?? null;
    const sourceCustomerMobile =
      existingBinding?.sourceCustomerMobile ??
      normalizeMainlandMobile(verificationContext?.sourceCustomerMobile ?? null) ??
      null;
    const sourceCarPlate =
      existingBinding?.sourceCarPlate ?? verificationContext?.sourceCarPlate ?? null;

    const bindingStatus =
      (existingBinding?.bindingStatus as PerformanceCustomerBindingContext['bindingStatus'] | null) ??
      'manual_pending';
    const hasStrongReadonlyCandidate =
      !existingBinding && Boolean(verificationContext?.matchedCustomerId) && Boolean(sourceCustomerMobile);
    const performanceReadiness = this.resolvePerformanceReadiness({
      sourceCustomerMobile,
      bindingStatus,
      employeeId: event.employeeId,
      confirmedFlag: event.confirmedFlag,
    });

    return {
      sourceCustomerName,
      sourceCustomerMobile,
      sourceCarPlate,
      matchedCustomerId:
        existingBinding?.matchedCustomerId ?? verificationContext?.matchedCustomerId ?? null,
      matchedCustomerName:
        existingBinding?.matchedCustomerName ?? verificationContext?.matchedCustomerName ?? null,
      matchedCustomerMobile:
        existingBinding?.matchedCustomerMobile ?? verificationContext?.matchedCustomerMobile ?? null,
      bindingStatus,
      bindingConfidence:
        existingBinding?.bindingConfidence ??
        (hasStrongReadonlyCandidate ? verificationContext?.matchConfidence ?? '0.9000' : sourceCustomerMobile ? '0.7000' : null),
      boundBy: existingBinding?.boundBy ?? null,
      boundByName: existingBinding?.boundByUser?.realName ?? existingBinding?.boundByUser?.username ?? null,
      boundAt: existingBinding?.boundAt ?? null,
      bindingRemark:
        existingBinding?.bindingRemark ??
        (hasStrongReadonlyCandidate
          ? '已通过源订单 sourceUserId + ABC user_account.mobile 锁定唯一客户候选，当前仅作为只读强候选展示，仍需人工确认后写入正式绑定'
          : this.buildDefaultPerformanceCustomerBindingRemark(sourceCustomerMobile, sourceCustomerName)),
      performanceReadyFlag:
        existingBinding?.performanceReadyFlag ?? performanceReadiness.performanceReadyFlag,
      performanceBlockReason:
        (existingBinding?.performanceBlockReason as PerformanceCustomerBindingContext['performanceBlockReason']) ??
        performanceReadiness.performanceBlockReason,
      performanceDecisionReason:
        existingBinding?.performanceDecisionReason ??
        (hasStrongReadonlyCandidate
          ? '已锁定唯一客户候选主键，但正式 customer binding 尚未落库，当前继续保留待人工确认'
          : performanceReadiness.performanceDecisionReason),
      taskExecutionCount: existingBinding?.taskExecutionCount ?? null,
      taskOnTimeCount: existingBinding?.taskOnTimeCount ?? null,
      taskConfirmedCount: existingBinding?.taskConfirmedCount ?? null,
      taskRewardEligibleFlag: existingBinding?.taskRewardEligibleFlag ?? null,
      aiTaskScore: existingBinding?.aiTaskScore ?? null,
      aiTaskRemark: existingBinding?.aiTaskRemark ?? null,
    };
  }

  private buildDefaultPerformanceCustomerBindingRemark(
    sourceCustomerMobile: string | null,
    sourceCustomerName: string | null,
  ) {
    if (!sourceCustomerMobile) {
      return '源链暂无稳定手机号，当前记录仍需人工补充客户主识别键';
    }
    if (!sourceCustomerName) {
      return '已识别客户手机号，但缺少稳定客户姓名，继续保留人工绑定入口';
    }
    return '已识别客户手机号和客户姓名，但当前仍保留人工确认绑定入口';
  }

  private resolvePerformanceReadiness(input: {
    sourceCustomerMobile: string | null;
    bindingStatus: PerformanceCustomerBindingContext['bindingStatus'];
    employeeId: number | null;
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
        performanceDecisionReason: '同一来源记录存在冲突客户归属，需人工确认后再进入后续绩效流程',
      };
    }

    if (input.bindingStatus === 'manual_pending') {
      return {
        performanceReadyFlag: false,
        performanceBlockReason: 'missing_customer_binding' as const,
        performanceDecisionReason: '已识别客户手机号，但客户绑定尚未明确，先保留待人工确认',
      };
    }

    if (!input.employeeId) {
      return {
        performanceReadyFlag: false,
        performanceBlockReason: 'missing_employee_binding' as const,
        performanceDecisionReason: '客户已可识别，但责任员工尚未明确，暂不能进入后续绩效计算',
      };
    }

    if (!input.confirmedFlag) {
      return {
        performanceReadyFlag: false,
        performanceBlockReason: 'awaiting_manual_review' as const,
        performanceDecisionReason: '客户与员工识别已具备，但记录仍需人工确认后才能进入后续绩效流程',
      };
    }

    return {
      performanceReadyFlag: true,
      performanceBlockReason: null,
      performanceDecisionReason: '客户手机号、客户绑定、责任员工和确认状态已满足绩效识别基础条件',
    };
  }

  private mapPerformanceCustomerBinding(
    context: PerformanceCustomerBindingContext | null,
    currentUser?: CurrentUser | null,
    mode: PerformanceVerificationContextViewMode = 'list',
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
      boundByName: context.boundByName,
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

  private resolveWorkOrderIdForPerformanceEvent(event: PerformanceEvent) {
    if (event.sourceTable === 'work_orders' && /^\d+$/.test(event.sourceId)) {
      return Number(event.sourceId);
    }

    const normalizedPayload = (event.normalizedPayload ?? {}) as Record<string, unknown>;
    const workOrderId = this.readNestedValue(normalizedPayload, 'workOrderId');
    if (typeof workOrderId === 'number' && Number.isInteger(workOrderId) && workOrderId > 0) {
      return workOrderId;
    }
    if (typeof workOrderId === 'string' && /^\d+$/.test(workOrderId)) {
      return Number(workOrderId);
    }
    return null;
  }

  private buildSourceRecordKey(sourceTable: string, sourceId: string) {
    return `${sourceTable}|${sourceId}`;
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

  private pickVerificationString(...values: Array<string | null | undefined>) {
    for (const value of values) {
      if (value === undefined || value === null) {
        continue;
      }
      const normalized = String(value).trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  private readStringFromPathCandidates(
    sources: Array<Record<string, unknown> | null | undefined>,
    pathCandidates: string[][],
  ) {
    for (const source of sources) {
      if (!source) {
        continue;
      }

      for (const path of pathCandidates) {
        const value = this.readNestedValue(source, ...path);
        if (value === undefined || value === null || value === '') {
          continue;
        }

        const normalized = String(value).trim();
        if (normalized) {
          return normalized;
        }
      }
    }

    return null;
  }

  private readStringArrayFromPathCandidates(
    sources: Array<Record<string, unknown> | null | undefined>,
    pathCandidates: string[][],
  ) {
    for (const source of sources) {
      if (!source) {
        continue;
      }

      for (const path of pathCandidates) {
        const value = this.readNestedValue(source, ...path);
        if (!Array.isArray(value)) {
          continue;
        }

        const normalized = [
          ...new Set(
            value
              .map((item) => (item === undefined || item === null ? null : String(item).trim()))
              .filter((item): item is string => Boolean(item)),
          ),
        ];
        if (normalized.length) {
          return normalized;
        }
      }
    }

    return [];
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

  private summarizeVerificationValues(values: Array<string | null | undefined>) {
    const normalized = [
      ...new Set(values.map((item) => item?.trim()).filter((item): item is string => Boolean(item))),
    ];
    if (!normalized.length) return null;
    if (normalized.length === 1) return normalized[0];
    return `${normalized[0]} + ${normalized.length - 1} more`;
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

  private formatVerificationDate(value: unknown) {
    if (!value) {
      return null;
    }

    const raw = String(value).trim();
    if (!raw) {
      return null;
    }

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return normalizeVerificationDateKey(raw);
    }

    const pad = (item: number) => String(item).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private canViewFullVerificationContext(
    currentUser: CurrentUser | null | undefined,
    mode: PerformanceVerificationContextViewMode,
  ) {
    void mode;
    return canViewFullContact(currentUser);
  }

  private applyVerificationMask(
    value: string | null,
    kind: 'name' | 'mobile' | 'plate',
    currentUser: CurrentUser | null | undefined,
    mode: PerformanceVerificationContextViewMode,
  ) {
    if (!value) {
      return null;
    }
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

  private mapPerformanceRule(rule: PerformanceRule) {
    return {
      id: rule.id,
      sourceDomain: rule.sourceDomain,
      eventType: rule.eventType,
      ruleCode: rule.ruleCode,
      ruleName: rule.ruleName,
      classificationKey: rule.classificationKey,
      includeInPerformance: rule.includeInPerformance,
      defaultWeight: rule.defaultWeight,
      defaultCoefficient: rule.defaultCoefficient,
      requiresManualConfirmation: rule.requiresManualConfirmation,
      isActive: rule.isActive,
      remark: rule.remark,
      createdBy: rule.createdBy,
      updatedBy: rule.updatedBy,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }

  private mapPerformanceEvent(
    event: PerformanceEvent,
    canViewAmounts = true,
    currentUser?: CurrentUser | null,
    verificationContext: PerformanceVerificationSourceContext | null = null,
    customerBinding: PerformanceCustomerBindingContext | null = null,
  ) {
    return {
      id: event.id,
      employeeId: event.employeeId,
      employeeName: event.employee?.name ?? null,
      sourceDomain: event.sourceDomain,
      eventType: event.eventType,
      sourceSystem: event.sourceSystem,
      sourceTable: event.sourceTable,
      sourceId: event.sourceId,
      sourceOrderNo: event.sourceOrderNo,
      amountStandard: canViewAmounts ? event.amountStandard : null,
      quantityStandard: event.quantityStandard,
      occurredAt: event.occurredAt,
      periodKey: event.periodKey,
      confirmedFlag: event.confirmedFlag,
      ignoredFlag: event.ignoredFlag,
      handledBy: event.handledBy,
      handledByName: event.handledByUser?.realName ?? event.handledByUser?.username ?? null,
      handledAt: event.handledAt,
      handlingAction: event.handlingAction,
      handlingRemark: event.handlingRemark,
      classificationId: event.classification?.id ?? null,
      classificationKey: event.classification?.classificationKey ?? null,
      includeInPerformance: event.classification?.includeInPerformance ?? false,
      weight: event.classification?.weight ?? '1.00',
      coefficient: event.classification?.coefficient ?? '1.00',
      requiresManualConfirmation:
        event.classification?.requiresManualConfirmation ?? false,
      ruleMatchedFlag: event.classification?.ruleMatchedFlag ?? false,
      ruleId: event.classification?.performanceRuleId ?? null,
      ruleCode: event.classification?.performanceRule?.ruleCode ?? null,
      ruleName: event.classification?.performanceRule?.ruleName ?? null,
      customerName: verificationContext?.customerName ?? null,
      customerMobile: verificationContext?.customerMobile ?? null,
      carPlate: verificationContext?.carPlate ?? null,
      sourceCustomerMobile: this.applyVerificationMask(
        verificationContext?.sourceCustomerMobile ?? null,
        'mobile',
        currentUser ?? null,
        'list',
      ),
      sourceCustomerNameAlias: this.applyVerificationMask(
        verificationContext?.sourceCustomerNameAlias ?? null,
        'name',
        currentUser ?? null,
        'list',
      ),
      matchedCustomerId:
        customerBinding?.matchedCustomerId ?? verificationContext?.matchedCustomerId ?? null,
      matchedCustomerName: this.applyVerificationMask(
        customerBinding?.matchedCustomerName ?? verificationContext?.matchedCustomerName ?? null,
        'name',
        currentUser ?? null,
        'list',
      ),
      matchedCustomerMobile: this.applyVerificationMask(
        customerBinding?.matchedCustomerMobile ?? verificationContext?.matchedCustomerMobile ?? null,
        'mobile',
        currentUser ?? null,
        'list',
      ),
      matchedOrderId: verificationContext?.matchedOrderId ?? null,
      matchedOrderNo: verificationContext?.matchedOrderNo ?? null,
      matchedSourceTable: verificationContext?.matchedSourceTable ?? null,
      matchConfidence: verificationContext?.matchConfidence ?? null,
      matchReason: verificationContext?.matchReason ?? null,
      evidenceSummary: verificationContext?.evidenceSummary ?? null,
      packageName: verificationContext?.packageName ?? null,
      paymentStatus: verificationContext?.paymentStatus ?? null,
      isPaid: verificationContext?.isPaid ?? null,
      settlementType: verificationContext?.settlementType ?? null,
      isTestData: verificationContext?.isTestData ?? null,
      sourceClassification: verificationContext?.sourceClassification ?? null,
      reconciliationStatus: verificationContext?.reconciliationStatus ?? null,
      reconciliationReason: verificationContext?.reconciliationReason ?? null,
      customerBinding: this.mapPerformanceCustomerBinding(
        customerBinding,
        currentUser ?? null,
        'list',
      ),
      performanceReadyFlag: customerBinding?.performanceReadyFlag ?? null,
      performanceBlockReason: customerBinding?.performanceBlockReason ?? null,
      performanceDecisionReason: customerBinding?.performanceDecisionReason ?? null,
      remark: event.remark,
      normalizedPayload: event.normalizedPayload,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  private mapPerformanceSummary(
    summary: PerformanceSummary,
    canViewAmounts = true,
    currentUser?: CurrentUser | null,
    customerContext: PerformanceSummaryCustomerContext | null = null,
    mode: PerformanceVerificationContextViewMode = 'list',
  ) {
    return {
      id: summary.id,
      performancePeriodId: summary.performancePeriodId,
      periodKey: summary.performancePeriod?.periodKey ?? null,
      employeeId: summary.employeeId,
      employeeName: summary.employee?.name ?? null,
      sourceDomain: summary.sourceDomain,
      eventCount: summary.eventCount,
      confirmedEventCount: summary.confirmedEventCount,
      pendingEventCount: summary.pendingEventCount,
      amountTotal: canViewAmounts ? summary.amountTotal : null,
      quantityTotal: summary.quantityTotal,
      customerName: customerContext?.customerName ?? null,
      customerMobile: customerContext?.customerMobile ?? null,
      carPlate: customerContext?.carPlate ?? null,
      sourceCustomerMobile: this.applyVerificationMask(
        customerContext?.sourceCustomerMobile ?? null,
        'mobile',
        currentUser ?? undefined,
        mode,
      ),
      sourceCustomerNameAlias: this.applyVerificationMask(
        customerContext?.sourceCustomerNameAlias ?? null,
        'name',
        currentUser ?? undefined,
        mode,
      ),
      matchedCustomerId: customerContext?.matchedCustomerId ?? null,
      matchedCustomerName: this.applyVerificationMask(
        customerContext?.matchedCustomerName ?? null,
        'name',
        currentUser ?? undefined,
        mode,
      ),
      matchedCustomerMobile: this.applyVerificationMask(
        customerContext?.matchedCustomerMobile ?? null,
        'mobile',
        currentUser ?? undefined,
        mode,
      ),
      matchedOrderId: customerContext?.matchedOrderId ?? null,
      matchedOrderNo: customerContext?.matchedOrderNo ?? null,
      matchedSourceTable: customerContext?.matchedSourceTable ?? null,
      matchConfidence: customerContext?.matchConfidence ?? null,
      matchReason: customerContext?.matchReason ?? null,
      evidenceSummary: customerContext?.evidenceSummary ?? null,
      packageName: customerContext?.packageName ?? null,
      paymentStatus: customerContext?.paymentStatus ?? null,
      isPaid: customerContext?.isPaid ?? null,
      settlementType: customerContext?.settlementType ?? null,
      isTestData: customerContext?.isTestData ?? null,
      sourceClassification: customerContext?.sourceClassification ?? null,
      reconciliationStatus: customerContext?.reconciliationStatus ?? null,
      reconciliationReason: customerContext?.reconciliationReason ?? null,
      bundleEvidenceStrong: customerContext?.bundleEvidenceStrong ?? false,
      missingCItemSuspected: customerContext?.missingCItemSuspected ?? false,
      bundleInferenceReason: customerContext?.bundleInferenceReason ?? null,
      linkedBCardAmount: customerContext?.linkedBCardAmount ?? null,
      linkedBCardSourceType: customerContext?.linkedBCardSourceType ?? null,
      linkedPaidAAmount: customerContext?.linkedPaidAAmount ?? null,
      linkedBundleWindowDays: customerContext?.linkedBundleWindowDays ?? null,
      customerBinding: this.mapPerformanceCustomerBinding(
        customerContext?.customerBinding ?? null,
        currentUser ?? null,
        mode,
      ),
      customerBindingSummary: customerContext?.customerBindingSummary ?? null,
      performanceReadyFlag: customerContext?.performanceReadyFlag ?? null,
      performanceBlockReason: customerContext?.performanceBlockReason ?? null,
      performanceDecisionReason: customerContext?.performanceDecisionReason ?? null,
      normalizedPayload: summary.normalizedPayload,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    };
  }

  private hasPerformanceSummaryDerivedFilters(query: QueryPerformanceSummariesDto) {
    return Boolean(
      query.dateFrom ||
        query.dateTo ||
      query.performanceBlockReason ||
        query.paymentStatus ||
        query.sourceClassification ||
        query.reconciliationStatus,
    );
  }

  private hasPendingPerformanceDerivedFilters(query: QueryPendingPerformanceItemsDto) {
    return Boolean(
      query.performanceBlockReason ||
        query.paymentStatus ||
        query.sourceClassification ||
        query.reconciliationStatus,
    );
  }

  private matchesPerformanceSummaryDerivedFilters(
    item: Record<string, unknown>,
    query: QueryPerformanceSummariesDto,
  ) {
    return (
      this.matchesDerivedDateRange(item, query.dateFrom, query.dateTo) &&
      this.matchesMultiValueFilter(item.performanceBlockReason, query.performanceBlockReason) &&
      this.matchesMultiValueFilter(item.paymentStatus, query.paymentStatus) &&
      this.matchesMultiValueFilter(item.sourceClassification, query.sourceClassification) &&
      this.matchesMultiValueFilter(item.reconciliationStatus, query.reconciliationStatus)
    );
  }

  private matchesPendingPerformanceDerivedFilters(
    item: Record<string, unknown>,
    query: QueryPendingPerformanceItemsDto,
  ) {
    return (
      this.matchesDerivedDateRange(item, query.dateFrom, query.dateTo) &&
      this.matchesMultiValueFilter(item.performanceBlockReason, query.performanceBlockReason) &&
      this.matchesMultiValueFilter(item.paymentStatus, query.paymentStatus) &&
      this.matchesMultiValueFilter(item.sourceClassification, query.sourceClassification) &&
      this.matchesMultiValueFilter(item.reconciliationStatus, query.reconciliationStatus)
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

  private async ensureRuleUniqueness(
    sourceDomain: PerformanceEventSourceDomain,
    eventType: string,
    ruleCode: string,
    excludeId?: number,
  ) {
    const duplicatedByDomainEvent = await this.performanceRuleRepository.findOne({
      where: {
        sourceDomain,
        eventType,
      },
    });
    if (duplicatedByDomainEvent && duplicatedByDomainEvent.id !== excludeId) {
      throw new BadRequestException('该来源域与事件类型已存在绩效规则');
    }

    const duplicatedByRuleCode = await this.performanceRuleRepository.findOne({
      where: {
        ruleCode,
      },
    });
    if (duplicatedByRuleCode && duplicatedByRuleCode.id !== excludeId) {
      throw new BadRequestException('该规则编码已存在');
    }
  }

  private canViewSensitiveAmounts(currentUser: CurrentUser) {
    return (
      currentUser.roleCodes.includes('admin') ||
      currentUser.roleCodes.includes('finance')
    );
  }

  private async ensureLinkedUserExists(linkedUserId: number) {
    const user = await this.userRepository.findOne({
      where: { id: linkedUserId, status: 1 },
    });
    if (!user) {
      throw new NotFoundException('关联用户不存在或已禁用');
    }
  }

  private async ensureEmployeeLinkedUserIsAvailable(linkedUserId: number, excludeId?: number) {
    const existing = await this.employeeRepository.findOne({
      where: { linkedUserId },
    });
    if (existing && existing.id !== excludeId) {
      throw new BadRequestException('该用户已关联其他员工');
    }
  }

  private async ensureEmployeeMobileIsAvailable(mobile: string, excludeId?: number) {
    const existingEmployees = await this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.mobile IS NOT NULL')
      .getMany();
    const existing = existingEmployees.find((item) => {
      const normalizedMobile = normalizeMainlandMobile(item.mobile);
      return normalizedMobile === mobile && item.id !== excludeId;
    });
    if (existing) {
      throw new BadRequestException('该手机号已关联其他员工');
    }
  }

  private async ensureEmployeeExists(employeeId: number) {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('员工不存在');
    }
    return employee;
  }

  private async findPerformanceRuleById(id: number) {
    const rule = await this.performanceRuleRepository.findOne({
      where: { id },
    });
    if (!rule) {
      throw new NotFoundException('绩效规则不存在');
    }
    return rule;
  }

  private async findPerformanceEventById(id: number) {
    const event = await this.performanceEventRepository.findOne({
      where: { id },
      relations: {
        employee: true,
        handledByUser: true,
        classification: {
          performanceRule: true,
        },
      },
    });
    if (!event) {
      throw new NotFoundException('绩效事件不存在');
    }
    return event;
  }

  private async findEmployeeById(id: number) {
    const employee = await this.employeeRepository.findOne({
      where: { id },
      relations: { linkedUser: true },
    });
    if (!employee) {
      throw new NotFoundException('员工不存在');
    }
    return employee;
  }

  private normalizeEmployeeNameInput(name: string, nameRemark?: string | null) {
    const parsed = this.splitEmployeeNameAndRemark(name);
    return {
      legalName: this.normalizeRequiredEmployeeName(parsed.legalName),
      nameRemark:
        this.normalizeOptionalString(nameRemark) ??
        this.normalizeOptionalString(parsed.nameRemark) ??
        null,
    };
  }

  private normalizeRequiredEmployeeName(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException('员工姓名不能为空');
    }
    return normalized;
  }

  private splitEmployeeNameAndRemark(value: string) {
    const normalized = value.trim();
    const match = normalized.match(/^(?<legalName>.+?)[（(]\s*(?<nameRemark>[^（）()]+?)\s*[）)]$/);
    if (!match?.groups) {
      return {
        legalName: normalized,
        nameRemark: null,
      };
    }

    return {
      legalName: match.groups.legalName.trim(),
      nameRemark: match.groups.nameRemark.trim(),
    };
  }

  private composeEmployeeDisplayName(name: string, nameRemark: string | null) {
    if (!nameRemark) {
      return name;
    }
    return `${name}（${nameRemark}）`;
  }

  private normalizeOptionalString(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }
    const normalized = value?.trim() ?? '';
    return normalized || null;
  }

  private normalizeEmployeeMobileInput(
    value: string | null | undefined,
    fieldLabel: string,
  ) {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || !value.trim()) {
      return null;
    }
    const normalized = normalizeMainlandMobile(value);
    if (!normalized) {
      throw new BadRequestException(`${fieldLabel}格式无效`);
    }
    return normalized;
  }

  private resolveEmployeeCompanyName(
    dto: Pick<CreateEmployeeDto, 'companyName' | 'sourceCompanyName'>,
  ) {
    const companyName = this.normalizeOptionalString(dto.companyName);
    if (companyName) {
      return companyName;
    }
    return this.normalizeOptionalString(dto.sourceCompanyName) ?? null;
  }

  private normalizeEmployeeImportedAt(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      return null;
    }
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('导入时间格式无效');
    }
    return date;
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

  private async findBindingById(id: number) {
    const binding = await this.employeeSourceBindingRepository.findOne({
      where: { id },
      relations: { employee: true },
    });
    if (!binding) {
      throw new NotFoundException('员工绑定不存在');
    }
    return binding;
  }

  private normalizeSortOrder(
    sortOrder: 'asc' | 'desc' | 'ASC' | 'DESC' | undefined,
    fallback: SortDirection,
  ): SortDirection {
    if (!sortOrder) {
      return fallback;
    }

    return sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }
}
