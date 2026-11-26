import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { addMoney, normalizeMoney } from '../../common/utils/decimal.util';
import { getPagination, PaginationQuery } from '../../common/utils/pagination.util';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { WorkOrderStatus } from '../../shared/enums/work-order-status.enum';
import { OperationLog } from '../operation-logs/entities/operation-log.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SequenceService } from '../sequence/sequence.service';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { assertWorkOrderNotUnquoted } from '../work-orders/work-order-intake.policy';
import { CreatePaymentRecordDto } from './dto/create-payment-record.dto';
import { PaymentRecord } from './entities/payment-record.entity';

type PaymentRecordCommandBlockedReason =
  | 'payment_not_actionable'
  | 'linked_work_order_missing'
  | 'duplicate_success_risk'
  | 'actor_not_allowed'
  | 'already_applied_to_work_order';

type PaymentRecordCommandBlockedStage =
  | 'payment_status'
  | 'linked_work_order'
  | 'duplicate_success_check'
  | 'role_permission'
  | 'work_order_state';

type PaymentRecordCommandCheckResult = 'pass' | 'warn' | 'fail';
type PaymentRecordCommandPrecheckStatus = 'pass' | 'warn' | 'fail';
type PaymentHandlingPlanVisibility = 'full' | 'restricted';

interface PaymentRecordCommandCheck {
  checkKey: string;
  checkName: string;
  checkResult: PaymentRecordCommandCheckResult;
  checkReason: string;
}

interface PaymentChannelRecognition {
  status: 'recognized' | 'warn_unrecognized';
  rawChannel: string;
  normalizedChannel: string | null;
  summary: string;
}

interface PaymentAmountConsistency {
  status: 'pass' | 'warn';
  outstandingAmount: string | null;
  exceedsAmountDue: boolean;
  exceedsOutstanding: boolean;
  summary: string;
}

interface PaymentWorkOrderStateImpact {
  currentWorkOrderStatus: string | null;
  currentWorkOrderAmountReceived: string | null;
  expectedWorkOrderAmountReceivedAfterFinalize: string | null;
  expectedWorkOrderStatusAfterFinalize: string | null;
  statusAppliedToWorkOrder: boolean;
  summary: string;
}

interface PaymentDuplicateSuccessRisk {
  riskLevel: 'none' | 'high';
  duplicatePaymentId: number | null;
  duplicatePaymentNo: string | null;
  summary: string;
}

interface PaymentRecordCommandPrecheckResult {
  precheckStatus: PaymentRecordCommandPrecheckStatus;
  checks: PaymentRecordCommandCheck[];
  canExecute: boolean;
  blockedReason: PaymentRecordCommandBlockedReason | null;
  blockedStage: PaymentRecordCommandBlockedStage | null;
  remediationSuggestions: string[];
  paymentStatusAllowsFinalize: boolean;
  linkedWorkOrderPresent: boolean;
  duplicateSuccessRisk: PaymentDuplicateSuccessRisk;
  paymentChannelRecognition: PaymentChannelRecognition;
  amountConsistency: PaymentAmountConsistency;
  workOrderStateImpact: PaymentWorkOrderStateImpact;
  actorAllowed: boolean;
}

interface PaymentHandlingPlanActionItem {
  actionKey: string;
  title: string;
  description: string;
  ownerScope: string;
  status: 'pending' | 'ready' | 'blocked' | 'done' | 'not_applicable';
}

const PAYMENT_CHANNEL_ALIASES: Record<string, string> = {
  bank_transfer: 'bank_transfer',
  transfer: 'bank_transfer',
  wire_transfer: 'bank_transfer',
  offline_transfer: 'bank_transfer',
  '银行转账': 'bank_transfer',
  转账: 'bank_transfer',
  cash: 'cash',
  现金: 'cash',
  wechat: 'wechat_pay',
  wechat_pay: 'wechat_pay',
  '微信': 'wechat_pay',
  微信支付: 'wechat_pay',
  alipay: 'alipay',
  支付宝: 'alipay',
  pos: 'pos',
  card: 'pos',
  刷卡: 'pos',
  银行卡: 'pos',
};

@Injectable()
export class PaymentRecordsService {
  constructor(
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepository: Repository<PaymentRecord>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(OperationLog)
    private readonly operationLogRepository: Repository<OperationLog>,
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async create(dto: CreatePaymentRecordDto, currentUser: CurrentUser) {
    if (!Object.values(PaymentStatus).includes(dto.paymentStatus)) {
      throw new BadRequestException('收款状态非法');
    }

    if (!this.canCurrentUserWritePayment(currentUser)) {
      throw new BadRequestException('当前角色不能沿现有 payment_records 写入路径处理到账确认');
    }

    return this.dataSource.transaction(async (manager) => {
      const paymentNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.PAYMENT_RECORD.bizType,
        BIZ_SEQUENCE_CONFIG.PAYMENT_RECORD.prefix,
        manager,
      );
      const paymentRepo = manager.getRepository(PaymentRecord);
      const workOrderRepo = manager.getRepository(WorkOrder);
      const workOrder = await workOrderRepo.findOne({
        where: { id: dto.workOrderId },
        relations: {
          paymentRecords: true,
        },
      });

      if (!workOrder) {
        throw new NotFoundException('工单不存在');
      }
      assertWorkOrderNotUnquoted(workOrder);

      if (dto.paymentStatus === PaymentStatus.SUCCESS) {
        const duplicateSuccess = await this.findDuplicateSuccessRecordForCreate(paymentRepo, dto);
        if (duplicateSuccess) {
          throw new BadRequestException(
            `Duplicate success payment record ${duplicateSuccess.paymentNo} already exists for this work order`,
          );
          /*
          throw new BadRequestException(
            `当前工单下已存在疑似重复 success 留痕 ${duplicateSuccess.paymentNo}，不能重复写入到账结果`,
          );
          */
        }
      }

      const paymentRecord = paymentRepo.create({
        paymentNo,
        workOrderId: dto.workOrderId,
        amount: normalizeMoney(dto.amount),
        paymentMethod: dto.paymentMethod,
        paymentStatus: dto.paymentStatus,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : null,
        payerName: dto.payerName ?? null,
        remark: dto.remark ?? null,
        createdBy: currentUser.id,
      });

      const saved = await paymentRepo.save(paymentRecord);

      await this.operationLogsService.create(
        {
          module: 'payment_record',
          targetId: saved.id,
          action: OperationLogAction.CREATE_PAYMENT_RECORD,
          operatorId: currentUser.id,
          detail: `创建收款记录 ${saved.paymentNo}`,
        },
        manager,
      );

      if (saved.paymentStatus === PaymentStatus.SUCCESS) {
        const nextReceived = addMoney(workOrder.amountReceived, saved.amount);

        await workOrderRepo.update(workOrder.id, {
          amountReceived: nextReceived,
          status: WorkOrderStatus.PAID,
        });

        await this.operationLogsService.create(
          {
            module: 'work_order',
            targetId: workOrder.id,
            action: OperationLogAction.PAYMENT_SUCCESS,
            operatorId: currentUser.id,
            detail: `收款成功，工单 ${workOrder.workOrderNo} 更新为 paid`,
          },
          manager,
        );
      }

      return saved;
    });
  }

  async findAll(query: PaginationQuery, currentUser: CurrentUser) {
    const { skip, take, page, pageSize } = getPagination(query);
    const [list, total] = await this.paymentRecordRepository.findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip,
      take,
      relations: {
        createdByUser: true,
        workOrder: {
          responsibleUser: true,
          createdByUser: true,
          paymentRecords: {
            createdByUser: true,
          },
        },
      },
    });

    return {
      list: await Promise.all(
        list.map((item) => this.buildPaymentCommandView(item, currentUser, false)),
      ),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: number, currentUser: CurrentUser) {
    const record = await this.loadPaymentRecordOrThrow(id);
    return this.buildPaymentCommandView(record, currentUser, true);
  }

  async getPrecheck(id: number, currentUser: CurrentUser) {
    const record = await this.loadPaymentRecordOrThrow(id);
    return this.buildPrecheckResult(record, currentUser);
  }

  private async loadPaymentRecordOrThrow(id: number) {
    const record = await this.paymentRecordRepository.findOne({
      where: { id },
      relations: {
        createdByUser: true,
        workOrder: {
          responsibleUser: true,
          createdByUser: true,
          paymentRecords: {
            createdByUser: true,
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('收款记录不存在');
    }

    return record;
  }

  private async buildPaymentCommandView(
    record: PaymentRecord,
    currentUser: CurrentUser,
    includeDetail: boolean,
  ) {
    const visibilityScope = this.resolveVisibilityScope(currentUser);
    const precheck = this.buildPrecheckResult(record, currentUser);
    const linkedWorkOrderSummary = this.buildLinkedWorkOrderSummary(record.workOrder ?? null);
    const amountImpact = this.buildAmountImpact(record, precheck);
    const handlingPlan = this.buildHandlingPlan(
      record,
      precheck,
      visibilityScope,
      linkedWorkOrderSummary,
    );
    const commandExplanation = this.buildCommandExplanation(record, handlingPlan, precheck);
    const suggestedNextStep =
      handlingPlan.diagnosis.suggestedNextStep ??
      '当前仍需人工沿现有 payment_records 写入路径继续核对。';
    const executionTrace = this.buildExecutionTrace(record, precheck);
    const visibleExecutionTrace =
      visibilityScope === 'full'
        ? executionTrace
        : {
            currentStatus: executionTrace.currentStatus,
            canExecute: executionTrace.canExecute,
            workOrderStatus: executionTrace.workOrderStatus,
            statusAppliedToWorkOrder: executionTrace.statusAppliedToWorkOrder,
            latestOperation: executionTrace.latestOperation,
            latestPaymentNo: null,
            latestPaymentAt: null,
            currentWorkOrderAmountReceived: null,
            expectedWorkOrderAmountReceivedAfterFinalize:
              executionTrace.expectedWorkOrderAmountReceivedAfterFinalize,
            expectedWorkOrderStatusAfterFinalize:
              executionTrace.expectedWorkOrderStatusAfterFinalize,
          };
    const payment = this.buildPaymentInfo(record, visibilityScope);
    const linkedWorkOrder = this.buildLinkedWorkOrder(record.workOrder ?? null, visibilityScope);
    const auditTrail =
      includeDetail && visibilityScope === 'full'
        ? await this.buildAuditTrail(record)
        : [];

    const basePayload = {
      id: record.id,
      paymentNo: record.paymentNo,
      workOrderId: record.workOrderId,
      amount: record.amount,
      paymentMethod: record.paymentMethod,
      paymentStatus: record.paymentStatus,
      status: record.paymentStatus,
      paidAt: record.paidAt,
      payerName: record.payerName,
      remark: visibilityScope === 'full' ? record.remark : this.compactRemark(record.remark),
      createdBy: visibilityScope === 'full' ? record.createdBy : null,
      createdAt: record.createdAt,
      channel: record.paymentMethod,
      requestSource: null,
      blockedReason: precheck.blockedReason,
      blockedStage: precheck.blockedStage,
      precheckStatus: precheck.precheckStatus,
      canExecute: precheck.canExecute,
      suggestedAction: handlingPlan.listSummary,
      executionCapability: this.resolveExecutionCapability(precheck, record),
      suggestedNextStep,
      linkedWorkOrderSummary,
      sourceOfTruth: this.buildSourceOfTruth(),
      handlingPlan,
      commandExplanation,
      executionTrace: visibleExecutionTrace,
      auditTrail: visibilityScope === 'full' ? auditTrail : [],
      blockers: this.buildBlockers(precheck),
      payment: includeDetail ? payment : undefined,
      paymentPrecheck: includeDetail ? precheck : undefined,
      linkedWorkOrder: includeDetail ? linkedWorkOrder : undefined,
      amountImpact: includeDetail ? amountImpact : undefined,
    };

    if (!includeDetail) {
      return basePayload;
    }

    return {
      ...basePayload,
      payment,
      linkedWorkOrder,
      amountImpact,
      paymentPrecheck: precheck,
      executionTrace: visibleExecutionTrace,
      auditTrail: visibilityScope === 'full' ? auditTrail : [],
    };
  }

  private buildPrecheckResult(
    record: PaymentRecord,
    currentUser: CurrentUser,
  ): PaymentRecordCommandPrecheckResult {
    const workOrder = record.workOrder ?? null;
    const linkedWorkOrderPresent = Boolean(workOrder);
    const paymentStatusAllowsFinalize = record.paymentStatus === PaymentStatus.PENDING;
    const actorAllowed = this.canCurrentUserHandlePayment(currentUser);
    const duplicateSuccessRisk = this.buildDuplicateSuccessRisk(record, workOrder);
    const paymentChannelRecognition = this.buildPaymentChannelRecognition(record.paymentMethod);
    const amountConsistency = this.buildAmountConsistency(record, workOrder);
    const alreadyAppliedToWorkOrder =
      record.paymentStatus === PaymentStatus.SUCCESS && linkedWorkOrderPresent;
    const workOrderStateImpact = this.buildWorkOrderStateImpact(
      record,
      workOrder,
      paymentStatusAllowsFinalize,
      alreadyAppliedToWorkOrder,
    );

    const checks: PaymentRecordCommandCheck[] = [
      {
        checkKey: 'payment_status',
        checkName: '当前 paymentStatus 是否仍可继续确认到账',
        checkResult: paymentStatusAllowsFinalize
          ? 'pass'
          : record.paymentStatus === PaymentStatus.SUCCESS
            ? 'warn'
            : 'fail',
        checkReason: paymentStatusAllowsFinalize
          ? '当前记录仍是 pending，可继续按现有 paymentStatus 写入路径做人工到账确认。'
          : record.paymentStatus === PaymentStatus.SUCCESS
            ? '当前记录已经是 success，应优先按已到账留痕查看，而不是重复确认。'
            : '当前记录已经是 failed，不能继续当作到账确认对象处理。',
      },
      {
        checkKey: 'linked_work_order',
        checkName: '是否存在关联工单上下文',
        checkResult: linkedWorkOrderPresent ? 'pass' : 'fail',
        checkReason: linkedWorkOrderPresent
          ? `已关联工单 ${workOrder?.workOrderNo ?? `#${record.workOrderId}` }，可继续引用工单实收与状态上下文。`
          : '当前记录缺少有效工单上下文，无法继续解释到账影响。',
      },
      {
        checkKey: 'duplicate_success_risk',
        checkName: '是否存在疑似重复 success 留痕',
        checkResult: duplicateSuccessRisk.riskLevel === 'high' ? 'fail' : 'pass',
        checkReason: duplicateSuccessRisk.summary,
      },
      {
        checkKey: 'actor_permission',
        checkName: '当前角色是否可继续处理到账确认',
        checkResult: actorAllowed ? 'pass' : 'fail',
        checkReason: actorAllowed
          ? '当前角色可继续沿现有收款写入路径处理。'
          : '当前角色默认只看 handlingPlan-first，需要交由财务或管理员继续处理。',
      },
      {
        checkKey: 'payment_channel_recognition',
        checkName: 'paymentMethod 渠道识别',
        checkResult:
          paymentChannelRecognition.status === 'recognized' ? 'pass' : 'warn',
        checkReason: paymentChannelRecognition.summary,
      },
      {
        checkKey: 'amount_consistency',
        checkName: '金额与当前工单上下文是否一致',
        checkResult: amountConsistency.status === 'pass' ? 'pass' : 'warn',
        checkReason: amountConsistency.summary,
      },
      {
        checkKey: 'work_order_state_impact',
        checkName: '当前记录是否已经作用到工单状态',
        checkResult: alreadyAppliedToWorkOrder ? 'fail' : 'pass',
        checkReason: workOrderStateImpact.summary,
      },
    ];

    const blockedReason = this.resolveBlockedReason(
      linkedWorkOrderPresent,
      duplicateSuccessRisk,
      alreadyAppliedToWorkOrder,
      paymentStatusAllowsFinalize,
      actorAllowed,
    );
    const blockedStage = this.resolveBlockedStage(blockedReason);
    const canExecute = !blockedReason;
    const precheckStatus = this.resolvePrecheckStatus(checks);
    const remediationSuggestions = this.buildRemediationSuggestions(
      record,
      blockedReason,
      paymentChannelRecognition,
      amountConsistency,
    );

    return {
      precheckStatus,
      checks,
      canExecute,
      blockedReason,
      blockedStage,
      remediationSuggestions,
      paymentStatusAllowsFinalize,
      linkedWorkOrderPresent,
      duplicateSuccessRisk,
      paymentChannelRecognition,
      amountConsistency,
      workOrderStateImpact,
      actorAllowed,
    };
  }

  private buildHandlingPlan(
    record: PaymentRecord,
    precheck: PaymentRecordCommandPrecheckResult,
    visibilityScope: PaymentHandlingPlanVisibility,
    linkedWorkOrderSummary: Record<string, unknown> | null,
  ) {
    const summary = this.buildHandlingPlanSummary(record, precheck, linkedWorkOrderSummary);
    const listSummary = this.buildHandlingPlanListSummary(record, precheck);
    const actionItems = this.buildHandlingPlanActionItems(record, precheck);

    return {
      visibilityScope,
      summary,
      listSummary,
      diagnosis: {
        blockedReason: precheck.blockedReason,
        blockedStage: precheck.blockedStage,
        precheckStatus: precheck.precheckStatus,
        canExecute: precheck.canExecute,
        missingCondition: this.buildMissingCondition(record, precheck),
        nextOwner: this.resolveNextOwner(precheck),
        currentArrivalBasis: this.describeCurrentArrivalBasis(record),
        suggestedNextStep: this.buildSuggestedNextStep(record, precheck),
      },
      boundary: {
        executionBoundary:
          '本轮只复用 payment_records / work_orders / operation_logs 既有对象与现有 paymentStatus 写入语义，不扩展到银行对账、虚拟账户、发票或多公司审批状态机。',
        humanConfirmationBoundary:
          '到账确认仍需人工沿现有写入路径处理；handlingPlan 与 AI 只负责解释、预检与收口，不会跳过人工确认层。',
        payrollBoundary:
          '不会自动推进正式工资，也不会改动 confirmed / inferred / uncertain 与 included / pending / excluded 的状态分层。',
        generalizationBoundary:
          '当前 handlingPlan 只适用于这条 payment_record 及其已关联工单；paymentMethod 本轮只做识别提示，不升级为新的强规则。',
      },
      actionItems,
      precheckSnapshot: {
        precheckStatus: precheck.precheckStatus,
        canExecute: precheck.canExecute,
        blockedReason: precheck.blockedReason,
        blockedStage: precheck.blockedStage,
        remediationSuggestions: precheck.remediationSuggestions,
        paymentStatusAllowsFinalize: precheck.paymentStatusAllowsFinalize,
        linkedWorkOrderPresent: precheck.linkedWorkOrderPresent,
        duplicateSuccessRisk: precheck.duplicateSuccessRisk,
        paymentChannelRecognition: precheck.paymentChannelRecognition,
        amountConsistency: precheck.amountConsistency,
        workOrderStateImpact: precheck.workOrderStateImpact,
        actorAllowed: precheck.actorAllowed,
      },
      aiDiagnosis: null,
    };
  }

  private buildHandlingPlanSummary(
    record: PaymentRecord,
    precheck: PaymentRecordCommandPrecheckResult,
    linkedWorkOrderSummary: Record<string, unknown> | null,
  ) {
    const workOrderNo =
      typeof linkedWorkOrderSummary?.workOrderNo === 'string'
        ? linkedWorkOrderSummary.workOrderNo
        : `#${record.workOrderId}`;

    if (precheck.blockedReason === 'already_applied_to_work_order') {
      return `这条收款记录因工单 ${workOrderNo} 的到账留痕而存在，当前 paymentStatus=success，现有仓库语义已经把它作用到工单实收与状态，当前只建议查看与审计。`;
    }

    if (precheck.blockedReason === 'duplicate_success_risk') {
      return `这条收款记录因工单 ${workOrderNo} 的收款留痕而存在，但当前发现同工单下有疑似重复 success 记录，必须先人工复核重复风险。`;
    }

    if (precheck.blockedReason === 'linked_work_order_missing') {
      return '这条收款记录已经存在，但当前缺少有效工单上下文，无法继续判断它是否可以作为到账确认对象。';
    }

    if (precheck.blockedReason === 'actor_not_allowed') {
      return `这条收款记录因工单 ${workOrderNo} 的收款留痕而存在，当前仍待人工确认到账，但当前角色只可查看 handlingPlan-first 收口版。`;
    }

    if (precheck.blockedReason === 'payment_not_actionable') {
      return `这条收款记录因工单 ${workOrderNo} 的收款留痕而存在，但当前 paymentStatus=${record.paymentStatus}，不能继续当作待确认到账对象处理。`;
    }

    return `这条收款记录因工单 ${workOrderNo} 的收款留痕而存在，当前工单、角色与金额上下文已具备，可继续按现有写入路径做人工到账确认。`;
  }

  private buildHandlingPlanListSummary(
    record: PaymentRecord,
    precheck: PaymentRecordCommandPrecheckResult,
  ) {
    switch (precheck.blockedReason) {
      case 'linked_work_order_missing':
        return '先补齐工单上下文，再判断是否可以继续把这条记录当作到账留痕。';
      case 'duplicate_success_risk':
        return '先复核疑似重复 success 留痕，再决定是否继续处理当前记录。';
      case 'already_applied_to_work_order':
        return '当前记录已按 success 语义收口；后续只做工单实收与日志复核。';
      case 'actor_not_allowed':
        return '当前角色先看 handlingPlan；若要确认到账，交由财务或管理员沿现有写入路径处理。';
      case 'payment_not_actionable':
        return record.paymentStatus === PaymentStatus.FAILED
          ? 'failed 留痕只保留失败结果；如需重新确认到账，应新建新的收款留痕。'
          : '当前记录已经处于已到账结果态，不再重复确认。';
      default:
        return '财务沿现有 paymentStatus 写入路径继续人工确认到账；命令壳只负责解释、预检与收口。';
    }
  }

  private buildHandlingPlanActionItems(
    record: PaymentRecord,
    precheck: PaymentRecordCommandPrecheckResult,
  ): PaymentHandlingPlanActionItem[] {
    const workOrderLabel =
      record.workOrder?.workOrderNo ?? (record.workOrderId ? `工单 #${record.workOrderId}` : '当前工单');

    return [
      {
        actionKey: 'review_payment_context',
        title: '核对这条收款记录为什么存在',
        description: `确认 ${record.paymentNo} 与 ${workOrderLabel} 的金额、渠道、时间与备注是否对应当前收款场景。`,
        ownerScope: 'human_review',
        status: precheck.linkedWorkOrderPresent ? 'ready' : 'blocked',
      },
      {
        actionKey: 'confirm_or_handoff_payment',
        title: '确认到账或交接给可处理角色',
        description: precheck.canExecute
          ? '如需确认到账，仍沿现有 payment_records 写入路径处理；本 pilot 不新增 execute 接口。'
          : this.buildSuggestedNextStep(record, precheck),
        ownerScope: 'finance_admin',
        status: precheck.blockedReason === 'already_applied_to_work_order'
          ? 'done'
          : precheck.canExecute
            ? 'ready'
            : precheck.blockedReason === 'payment_not_actionable'
              ? 'not_applicable'
              : 'blocked',
      },
      {
        actionKey: 'review_work_order_impact',
        title: '核对工单实收与状态影响',
        description: precheck.workOrderStateImpact.summary,
        ownerScope: 'finance_admin',
        status: precheck.blockedReason === 'already_applied_to_work_order'
          ? 'done'
          : precheck.linkedWorkOrderPresent
            ? 'pending'
            : 'blocked',
      },
    ];
  }

  private buildSuggestedNextStep(
    record: PaymentRecord,
    precheck: PaymentRecordCommandPrecheckResult,
  ) {
    switch (precheck.blockedReason) {
      case 'linked_work_order_missing':
        return '先补齐关联工单，再判断这条收款记录是否能进入到账确认语义。';
      case 'duplicate_success_risk':
        return '先人工比对同工单 success 记录的金额、渠道和时间，确认不是重复到账后再继续。';
      case 'already_applied_to_work_order':
        return '当前到账留痕已经收口，下一步只需查看工单实收、状态与操作日志是否一致。';
      case 'actor_not_allowed':
        return '当前角色先查看 handlingPlan 与审计补充，再交由财务或管理员沿现有写入路径处理。';
      case 'payment_not_actionable':
        return record.paymentStatus === PaymentStatus.FAILED
          ? 'failed 记录只保留失败留痕；若要重新确认到账，请录入新的收款记录。'
          : '当前记录已经处在已到账结果态，不再重复处理。';
      default:
        return '如需确认到账，仍沿现有 payment_records 写入路径处理；命令壳本身不提供新的 execute 接口。';
    }
  }

  private buildCommandExplanation(
    record: PaymentRecord,
    handlingPlan: Record<string, unknown>,
    precheck: PaymentRecordCommandPrecheckResult,
  ) {
    const summary =
      typeof handlingPlan.summary === 'string' ? handlingPlan.summary : '当前处理摘要尚未生成。';
    const diagnosis =
      (handlingPlan.diagnosis as Record<string, unknown> | undefined) ?? {};
    const missingCondition =
      typeof diagnosis.missingCondition === 'string'
        ? diagnosis.missingCondition
        : '当前上下文已经具备，但仍需人工确认。';
    const nextOwner =
      typeof diagnosis.nextOwner === 'string' ? diagnosis.nextOwner : '人工复核';
    const arrivalBasis =
      typeof diagnosis.currentArrivalBasis === 'string'
        ? diagnosis.currentArrivalBasis
        : this.describeCurrentArrivalBasis(record);

    return `${summary} 缺口：${missingCondition}。下一步由 ${nextOwner} 处理。到账依据：${arrivalBasis}${
      precheck.remediationSuggestions.length
        ? ` 建议先做：${precheck.remediationSuggestions.slice(0, 2).join('；')}`
        : ''
    }。`;
  }

  private buildPaymentInfo(
    record: PaymentRecord,
    visibilityScope: PaymentHandlingPlanVisibility,
  ) {
    return {
      id: record.id,
      paymentNo: record.paymentNo,
      paymentStatus: record.paymentStatus,
      channel: record.paymentMethod,
      requestSource: null,
      amount: record.amount,
      paidAt: record.paidAt,
      createdAt: record.createdAt,
      payerName: record.payerName,
      remark:
        visibilityScope === 'full' ? record.remark : this.compactRemark(record.remark),
      createdByUser:
        visibilityScope === 'full' ? this.mapUser(record.createdByUser) : null,
    };
  }

  private buildLinkedWorkOrderSummary(workOrder: WorkOrder | null) {
    if (!workOrder) {
      return null;
    }

    const paymentRecords = this.sortPaymentRecords(workOrder.paymentRecords ?? []);
    return {
      id: workOrder.id,
      workOrderNo: workOrder.workOrderNo,
      title: workOrder.title,
      status: workOrder.status,
      amountDue: workOrder.amountDue,
      amountReceived: workOrder.amountReceived,
      outstandingAmount: this.calculateOutstandingAmount(
        workOrder.amountDue,
        workOrder.amountReceived,
      ),
      responsibleUserName:
        workOrder.responsibleUser?.realName ?? workOrder.responsibleUser?.username ?? null,
      paymentRecordCount: paymentRecords.length,
      successPaymentCount: paymentRecords.filter(
        (item) => item.paymentStatus === PaymentStatus.SUCCESS,
      ).length,
    };
  }

  private buildLinkedWorkOrder(
    workOrder: WorkOrder | null,
    visibilityScope: PaymentHandlingPlanVisibility,
  ) {
    if (!workOrder) {
      return null;
    }

    const summary = this.buildLinkedWorkOrderSummary(workOrder);
    if (visibilityScope !== 'full') {
      return summary;
    }

    const paymentRecords = this.sortPaymentRecords(workOrder.paymentRecords ?? []);

    return {
      ...summary,
      customerName: workOrder.customerName,
      customerMobile: workOrder.customerMobile,
      remark: workOrder.remark,
      createdAt: workOrder.createdAt,
      updatedAt: workOrder.updatedAt,
      createdByUser: this.mapUser(workOrder.createdByUser),
      paymentRecords: paymentRecords.map((item) => ({
        id: item.id,
        paymentNo: item.paymentNo,
        amount: item.amount,
        paymentStatus: item.paymentStatus,
        channel: item.paymentMethod,
        paidAt: item.paidAt,
        createdAt: item.createdAt,
        payerName: item.payerName,
        createdByUser: this.mapUser(item.createdByUser),
      })),
    };
  }

  private buildAmountImpact(
    record: PaymentRecord,
    precheck: PaymentRecordCommandPrecheckResult,
  ) {
    return {
      appliesToWorkOrderAmountReceived:
        record.paymentStatus === PaymentStatus.SUCCESS ||
        precheck.paymentStatusAllowsFinalize,
      alreadyAppliedToWorkOrder:
        precheck.blockedReason === 'already_applied_to_work_order',
      currentWorkOrderAmountReceived:
        precheck.workOrderStateImpact.currentWorkOrderAmountReceived,
      expectedWorkOrderAmountReceivedAfterFinalize:
        precheck.workOrderStateImpact.expectedWorkOrderAmountReceivedAfterFinalize,
      currentWorkOrderStatus: precheck.workOrderStateImpact.currentWorkOrderStatus,
      expectedWorkOrderStatusAfterFinalize:
        precheck.workOrderStateImpact.expectedWorkOrderStatusAfterFinalize,
      summary: precheck.workOrderStateImpact.summary,
    };
  }

  private buildExecutionTrace(
    record: PaymentRecord,
    precheck: PaymentRecordCommandPrecheckResult,
  ) {
    return {
      currentStatus: record.paymentStatus,
      canExecute: precheck.canExecute,
      workOrderStatus: precheck.workOrderStateImpact.currentWorkOrderStatus,
      statusAppliedToWorkOrder:
        precheck.workOrderStateImpact.statusAppliedToWorkOrder,
      latestOperation:
        precheck.blockedReason === 'already_applied_to_work_order'
          ? 'payment_success_already_applied'
          : precheck.canExecute
            ? 'ready_for_manual_finalize'
            : 'review_only',
      latestPaymentNo: record.paymentNo,
      latestPaymentAt: record.paidAt ?? record.createdAt,
      currentWorkOrderAmountReceived:
        precheck.workOrderStateImpact.currentWorkOrderAmountReceived,
      expectedWorkOrderAmountReceivedAfterFinalize:
        precheck.workOrderStateImpact.expectedWorkOrderAmountReceivedAfterFinalize,
      expectedWorkOrderStatusAfterFinalize:
        precheck.workOrderStateImpact.expectedWorkOrderStatusAfterFinalize,
    };
  }

  private async buildAuditTrail(record: PaymentRecord) {
    const where: Array<FindOptionsWhere<OperationLog>> = [
      { module: 'payment_record', targetId: record.id },
    ];

    if (record.workOrderId) {
      where.push({ module: 'work_order', targetId: record.workOrderId });
    }

    const logs = await this.operationLogRepository.find({
      where,
      relations: {
        operator: true,
      },
      order: {
        createdAt: 'ASC',
        id: 'ASC',
      },
    });

    return logs.map((item) => ({
      eventKey: `${item.module}:${item.id}`,
      module: item.module,
      action: item.action,
      actionLabel: this.describeAuditAction(item.action),
      detail: item.detail,
      actionAt: item.createdAt,
      stage: this.resolveAuditStage(item),
      actorName: item.operator?.realName ?? item.operator?.username ?? null,
    }));
  }

  private resolveVisibilityScope(currentUser: CurrentUser): PaymentHandlingPlanVisibility {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    return roleCodes.has('admin') || roleCodes.has('founder') || roleCodes.has('super_admin')
      ? 'full'
      : 'restricted';
  }

  private canCurrentUserHandlePayment(currentUser: CurrentUser) {
    return this.canCurrentUserWritePayment(currentUser);
  }

  private canCurrentUserWritePayment(currentUser: CurrentUser) {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    return roleCodes.has('admin') || roleCodes.has('finance');
  }

  private buildDuplicateSuccessRisk(
    record: PaymentRecord,
    workOrder: WorkOrder | null,
  ): PaymentDuplicateSuccessRisk {
    const duplicate = this.findDuplicateSuccessRecord(record, workOrder);

    if (!duplicate) {
      return {
        riskLevel: 'none',
        duplicatePaymentId: null,
        duplicatePaymentNo: null,
        summary: '当前未发现同工单下金额/渠道/时间完全重叠的 success 留痕。',
      };
    }

    return {
      riskLevel: 'high',
      duplicatePaymentId: duplicate.id,
      duplicatePaymentNo: duplicate.paymentNo,
      summary: `同工单下已存在疑似重复 success 留痕 ${duplicate.paymentNo}，需先人工复核避免重复到账。`,
    };
  }

  private buildPaymentChannelRecognition(paymentMethod: string): PaymentChannelRecognition {
    const rawChannel = paymentMethod?.trim() ?? '';
    const normalizedChannel = this.normalizePaymentChannel(rawChannel);

    if (!rawChannel) {
      return {
        status: 'warn_unrecognized',
        rawChannel: '',
        normalizedChannel: null,
        summary: '当前没有有效 paymentMethod，本轮只能保留为空并提示人工补充渠道信息。',
      };
    }

    if (normalizedChannel) {
      return {
        status: 'recognized',
        rawChannel,
        normalizedChannel,
        summary: `当前 paymentMethod=${rawChannel}，本轮按渠道提示识别为 ${normalizedChannel}，不会升级成新的强规则。`,
      };
    }

    return {
      status: 'warn_unrecognized',
      rawChannel,
      normalizedChannel: null,
      summary: `当前 paymentMethod=${rawChannel}，仓库暂无稳定标准化映射，本轮只做提示，不直接阻断。`,
    };
  }

  private buildAmountConsistency(
    record: PaymentRecord,
    workOrder: WorkOrder | null,
  ): PaymentAmountConsistency {
    if (!workOrder) {
      return {
        status: 'warn',
        outstandingAmount: null,
        exceedsAmountDue: false,
        exceedsOutstanding: false,
        summary: '当前缺少工单上下文，无法校验金额与应收/实收的一致性。',
      };
    }

    const amount = this.toMoneyNumber(record.amount);
    const amountDue = this.toMoneyNumber(workOrder.amountDue);
    const outstandingAmount = this.calculateOutstandingAmount(
      workOrder.amountDue,
      workOrder.amountReceived,
    );
    const outstanding = this.toMoneyNumber(outstandingAmount);
    const exceedsAmountDue = amount > amountDue;
    const exceedsOutstanding = amount > outstanding && record.paymentStatus !== PaymentStatus.SUCCESS;

    if (!exceedsAmountDue && !exceedsOutstanding) {
      return {
        status: 'pass',
        outstandingAmount,
        exceedsAmountDue: false,
        exceedsOutstanding: false,
        summary: `当前金额 ${record.amount} 与工单应收/实收上下文一致，当前剩余待收 ${outstandingAmount}。`,
      };
    }

    const reasons: string[] = [];
    if (exceedsAmountDue) {
      reasons.push(`当前金额 ${record.amount} 已超过工单应收 ${workOrder.amountDue}`);
    }
    if (exceedsOutstanding) {
      reasons.push(`当前金额 ${record.amount} 已超过当前待收 ${outstandingAmount}`);
    }

    return {
      status: 'warn',
      outstandingAmount,
      exceedsAmountDue,
      exceedsOutstanding,
      summary: `${reasons.join('；')}，请先人工复核金额上下文。`,
    };
  }

  private buildWorkOrderStateImpact(
    record: PaymentRecord,
    workOrder: WorkOrder | null,
    paymentStatusAllowsFinalize: boolean,
    alreadyAppliedToWorkOrder: boolean,
  ): PaymentWorkOrderStateImpact {
    if (!workOrder) {
      return {
        currentWorkOrderStatus: null,
        currentWorkOrderAmountReceived: null,
        expectedWorkOrderAmountReceivedAfterFinalize: null,
        expectedWorkOrderStatusAfterFinalize: null,
        statusAppliedToWorkOrder: false,
        summary: '当前没有关联工单，无法判断这条记录对工单实收与状态的影响。',
      };
    }

    if (alreadyAppliedToWorkOrder) {
      return {
        currentWorkOrderStatus: workOrder.status,
        currentWorkOrderAmountReceived: workOrder.amountReceived,
        expectedWorkOrderAmountReceivedAfterFinalize: workOrder.amountReceived,
        expectedWorkOrderStatusAfterFinalize: workOrder.status,
        statusAppliedToWorkOrder: true,
        summary: '当前记录已经按 success 语义作用到工单实收与状态，后续只需查看结果与日志是否一致。',
      };
    }

    if (paymentStatusAllowsFinalize) {
      return {
        currentWorkOrderStatus: workOrder.status,
        currentWorkOrderAmountReceived: workOrder.amountReceived,
        expectedWorkOrderAmountReceivedAfterFinalize: addMoney(
          workOrder.amountReceived,
          record.amount,
        ),
        expectedWorkOrderStatusAfterFinalize: WorkOrderStatus.PAID,
        statusAppliedToWorkOrder: false,
        summary: '若沿现有 success 写入路径确认到账，会累计工单实收并把工单状态更新为 paid。',
      };
    }

    return {
      currentWorkOrderStatus: workOrder.status,
      currentWorkOrderAmountReceived: workOrder.amountReceived,
      expectedWorkOrderAmountReceivedAfterFinalize: workOrder.amountReceived,
      expectedWorkOrderStatusAfterFinalize: workOrder.status,
      statusAppliedToWorkOrder: false,
        summary:
        record.paymentStatus === PaymentStatus.FAILED
          ? '当前记录是 failed，不会触发工单实收与状态更新。'
          : '当前记录已经处于结果态，本轮不再重复作用工单状态。',
    };
  }

  private resolveBlockedReason(
    linkedWorkOrderPresent: boolean,
    duplicateSuccessRisk: PaymentDuplicateSuccessRisk,
    alreadyAppliedToWorkOrder: boolean,
    paymentStatusAllowsFinalize: boolean,
    actorAllowed: boolean,
  ): PaymentRecordCommandBlockedReason | null {
    if (!linkedWorkOrderPresent) {
      return 'linked_work_order_missing';
    }
    if (duplicateSuccessRisk.riskLevel === 'high') {
      return 'duplicate_success_risk';
    }
    if (alreadyAppliedToWorkOrder) {
      return 'already_applied_to_work_order';
    }
    if (!paymentStatusAllowsFinalize) {
      return 'payment_not_actionable';
    }
    if (!actorAllowed) {
      return 'actor_not_allowed';
    }
    return null;
  }

  private resolveBlockedStage(
    blockedReason: PaymentRecordCommandBlockedReason | null,
  ): PaymentRecordCommandBlockedStage | null {
    switch (blockedReason) {
      case 'linked_work_order_missing':
        return 'linked_work_order';
      case 'duplicate_success_risk':
        return 'duplicate_success_check';
      case 'already_applied_to_work_order':
        return 'work_order_state';
      case 'payment_not_actionable':
        return 'payment_status';
      case 'actor_not_allowed':
        return 'role_permission';
      default:
        return null;
    }
  }

  private resolvePrecheckStatus(
    checks: PaymentRecordCommandCheck[],
  ): PaymentRecordCommandPrecheckStatus {
    if (checks.some((item) => item.checkResult === 'fail')) {
      return 'fail';
    }
    if (checks.some((item) => item.checkResult === 'warn')) {
      return 'warn';
    }
    return 'pass';
  }

  private buildRemediationSuggestions(
    record: PaymentRecord,
    blockedReason: PaymentRecordCommandBlockedReason | null,
    paymentChannelRecognition: PaymentChannelRecognition,
    amountConsistency: PaymentAmountConsistency,
  ) {
    const suggestions = new Set<string>();

    switch (blockedReason) {
      case 'linked_work_order_missing':
        suggestions.add('先补齐 payment_record 与 work_order 的真实关联，再回到到账确认判断。');
        break;
      case 'duplicate_success_risk':
        suggestions.add('先人工比对同工单 success 记录的金额、渠道、时间和备注，确认不是重复到账。');
        break;
      case 'already_applied_to_work_order':
        suggestions.add('当前记录已按 success 语义收口，请转为查看工单实收、状态与操作日志是否一致。');
        break;
      case 'actor_not_allowed':
        suggestions.add('当前角色先看 handlingPlan-first，再交由财务或管理员沿现有写入路径处理。');
        break;
      case 'payment_not_actionable':
        suggestions.add(
          record.paymentStatus === PaymentStatus.FAILED
            ? 'failed 记录只保留失败留痕；如需重新确认到账，请新建新的收款记录。'
            : '当前记录已经是 success 结果态，不再重复确认到账。',
        );
        break;
      default:
        suggestions.add('如需确认到账，仍沿现有 payment_records 写入路径处理；本 pilot 只做解释与预检。');
        break;
    }

    if (paymentChannelRecognition.status !== 'recognized') {
      suggestions.add('当前 paymentMethod 先保留原值展示，必要时由人工补充更明确的渠道说明。');
    }

    if (amountConsistency.status !== 'pass') {
      suggestions.add('金额与当前工单应收/实收有偏差，请先人工复核金额上下文。');
    }

    return Array.from(suggestions);
  }

  private buildMissingCondition(
    record: PaymentRecord,
    precheck: PaymentRecordCommandPrecheckResult,
  ) {
    switch (precheck.blockedReason) {
      case 'linked_work_order_missing':
        return '缺少真实工单上下文。';
      case 'duplicate_success_risk':
        return '存在疑似重复 success 留痕，必须先排重。';
      case 'already_applied_to_work_order':
        return '当前记录已经按 success 语义完成收口，没有继续确认的空间。';
      case 'actor_not_allowed':
        return '当前角色不是可继续处理到账确认的角色。';
      case 'payment_not_actionable':
        return record.paymentStatus === PaymentStatus.FAILED
          ? '当前记录已是 failed，不再作为到账确认对象。'
          : '当前记录已经进入已到账结果态。';
      default:
        if (precheck.amountConsistency.status !== 'pass') {
          return '金额与工单应收/实收仍需人工复核。';
        }
        if (precheck.paymentChannelRecognition.status !== 'recognized') {
          return 'paymentMethod 仍需人工补充更清晰的渠道说明。';
        }
        return '当前上下文已经具备，但仍需人工沿现有写入路径确认到账。';
    }
  }

  private resolveNextOwner(precheck: PaymentRecordCommandPrecheckResult) {
    switch (precheck.blockedReason) {
      case 'actor_not_allowed':
        return '财务或管理员';
      case 'already_applied_to_work_order':
        return '财务做结果复核';
      case 'duplicate_success_risk':
        return '财务人工复核';
      case 'linked_work_order_missing':
        return '人工补上下文';
      case 'payment_not_actionable':
        return '人工复核并决定是否重录';
      default:
        return '财务';
    }
  }

  private describeCurrentArrivalBasis(record: PaymentRecord) {
    switch (record.paymentStatus) {
      case PaymentStatus.SUCCESS:
        return '当前仓库以 payment_records.paymentStatus=success 作为到账留痕，并同步参考 work_orders.amountReceived / status 与 operation_logs；这不是未来银行真相源。';
      case PaymentStatus.PENDING:
        return '当前仓库尚未把这条记录视为已到账；只有沿现有写入路径把 paymentStatus 落到 success，才会影响 work_orders.amountReceived / status。';
      case PaymentStatus.FAILED:
      default:
        return '当前仓库把这条记录保留在 failed，只作为失败留痕，不据此改变工单实收或状态。';
    }
  }

  private resolveExecutionCapability(
    precheck: PaymentRecordCommandPrecheckResult,
    record: PaymentRecord,
  ) {
    if (precheck.blockedReason === 'already_applied_to_work_order') {
      return 'view_applied_result';
    }
    if (precheck.blockedReason === 'actor_not_allowed') {
      return 'review_only';
    }
    if (precheck.blockedReason === 'duplicate_success_risk') {
      return 'blocked_duplicate_risk';
    }
    if (precheck.blockedReason === 'linked_work_order_missing') {
      return 'repair_context_first';
    }
    if (precheck.blockedReason === 'payment_not_actionable') {
      return record.paymentStatus === PaymentStatus.FAILED
        ? 'view_failed_result'
        : 'view_only_result';
    }
    return 'confirm_via_existing_write_path';
  }

  private buildBlockers(precheck: PaymentRecordCommandPrecheckResult) {
    const blockers: string[] = [];

    if (precheck.blockedReason) {
      blockers.push(precheck.blockedReason);
    }
    if (precheck.paymentChannelRecognition.status !== 'recognized') {
      blockers.push('payment_channel_unrecognized');
    }
    if (precheck.amountConsistency.status !== 'pass') {
      blockers.push('amount_consistency_warn');
    }

    return blockers;
  }

  private buildSourceOfTruth() {
    return '当前以 payment_records.paymentStatus + work_orders.amountReceived/status 作为到账依据，operation_logs 为审计补充';
  }

  private sortPaymentRecords(records: PaymentRecord[]) {
    return [...records].sort((left, right) => {
      const leftTime = this.resolvePaymentAnchorTime(left);
      const rightTime = this.resolvePaymentAnchorTime(right);
      return leftTime - rightTime || left.id - right.id;
    });
  }

  private resolvePaymentAnchorTime(record: Pick<PaymentRecord, 'paidAt' | 'createdAt'>) {
    return new Date(record.paidAt ?? record.createdAt).getTime();
  }

  private findDuplicateSuccessRecord(record: PaymentRecord, workOrder: WorkOrder | null) {
    if (!workOrder || record.paymentStatus === PaymentStatus.FAILED) {
      return null;
    }

    const currentAmount = normalizeMoney(record.amount);
    const currentChannel =
      this.normalizePaymentChannel(record.paymentMethod) ??
      record.paymentMethod.trim().toLowerCase();
    return this.sortPaymentRecords(workOrder.paymentRecords ?? []).find((item) => {
      if (item.id === record.id || item.paymentStatus !== PaymentStatus.SUCCESS) {
        return false;
      }

      const itemChannel =
        this.normalizePaymentChannel(item.paymentMethod) ??
        item.paymentMethod.trim().toLowerCase();
      return (
        normalizeMoney(item.amount) === currentAmount &&
        itemChannel === currentChannel &&
        this.isSamePaymentFingerprintTime(item.paidAt, record.paidAt)
      );
    }) ?? null;
  }

  private async findDuplicateSuccessRecordForCreate(
    paymentRepo: Repository<PaymentRecord>,
    dto: Pick<CreatePaymentRecordDto, 'workOrderId' | 'amount' | 'paymentMethod' | 'paidAt'>,
  ) {
    const currentAmount = normalizeMoney(dto.amount);
    const currentChannel =
      this.normalizePaymentChannel(dto.paymentMethod) ?? dto.paymentMethod.trim().toLowerCase();
    const successRecords = await paymentRepo.find({
      where: {
        workOrderId: dto.workOrderId,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    return this.sortPaymentRecords(successRecords).find((item) => {
      if (item.paymentStatus !== PaymentStatus.SUCCESS) {
        return false;
      }

      const itemChannel =
        this.normalizePaymentChannel(item.paymentMethod) ??
        item.paymentMethod.trim().toLowerCase();
      return (
        normalizeMoney(item.amount) === currentAmount &&
        itemChannel === currentChannel &&
        this.isSamePaymentFingerprintTime(item.paidAt, dto.paidAt)
      );
    }) ?? null;
  }

  private normalizePaymentChannel(value: string | null | undefined) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return PAYMENT_CHANNEL_ALIASES[normalized] ?? null;
  }

  private isSamePaymentFingerprintTime(
    left: string | Date | null | undefined,
    right: string | Date | null | undefined,
  ) {
    if (!left && !right) {
      return true;
    }
    if (!left || !right) {
      return false;
    }

    return Math.abs(new Date(left).getTime() - new Date(right).getTime()) < 1000;
  }

  private calculateOutstandingAmount(amountDue: string | number, amountReceived: string | number) {
    const outstanding = this.toMoneyNumber(amountDue) - this.toMoneyNumber(amountReceived);
    return Math.max(outstanding, 0).toFixed(2);
  }

  private toMoneyNumber(value: string | number | null | undefined) {
    if (value === undefined || value === null || value === '') {
      return 0;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private compactRemark(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length <= 24) {
      return trimmed;
    }

    return `${trimmed.slice(0, 21)}...`;
  }

  private mapUser(user?: {
    id?: number;
    username?: string | null;
    realName?: string | null;
  } | null) {
    if (!user?.id) {
      return null;
    }

    return {
      id: user.id,
      username: user.username ?? null,
      name: user.realName ?? user.username ?? null,
    };
  }

  private describeAuditAction(action: string) {
    switch (action) {
      case OperationLogAction.CREATE_PAYMENT_RECORD:
        return '创建收款记录';
      case OperationLogAction.PAYMENT_SUCCESS:
        return '工单实收与状态更新';
      default:
        return action;
    }
  }

  private resolveAuditStage(log: OperationLog) {
    if (log.module === 'payment_record') {
      return 'payment_record';
    }
    if (log.action === OperationLogAction.PAYMENT_SUCCESS) {
      return 'work_order_state';
    }
    return log.module;
  }
}
