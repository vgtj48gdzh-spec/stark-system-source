import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { paginateArray } from '../../common/utils/pagination.util';
import { ApprovalStatus } from '../../shared/enums/approval-status.enum';
import { PaymentStatus } from '../../shared/enums/payment-status.enum';
import { AbcSyncFund } from '../abc-sync/entities/abc-sync-fund.entity';
import { ApprovalRequest } from '../approval-requests/entities/approval-request.entity';
import { PaymentRecord } from '../payment-records/entities/payment-record.entity';
import { PayoutRecord } from '../payout-records/entities/payout-record.entity';
import { QueryFundTruthReconciliationsDto } from './dto/query-fund-truth-reconciliations.dto';
import {
  FundTruthActionItem,
  FundTruthAnchorConfidence,
  FundTruthBasicInfoItem,
  FundTruthGapPlan,
  FundTruthLinkedObjectItem,
  FundTruthMappingKeyItem,
  FundTruthMappingReadiness,
  FundTruthMappingReadinessStatus,
  FundTruthMissingAnchorItem,
  FundTruthPrimaryObjectType,
  FundTruthReconciliationStatus,
  FundTruthReconciliationViewModel,
  FundTruthSourceRole,
  FundTruthVisibilityScope,
} from './view-models/fund-truth-reconciliation.view-model';

@Injectable()
export class FundTruthReconciliationsService {
  constructor(
    @InjectRepository(ApprovalRequest)
    private readonly approvalRequestRepository: Repository<ApprovalRequest>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRecordRepository: Repository<PaymentRecord>,
    @InjectRepository(PayoutRecord)
    private readonly payoutRecordRepository: Repository<PayoutRecord>,
    @InjectRepository(AbcSyncFund)
    private readonly abcSyncFundRepository: Repository<AbcSyncFund>,
  ) {}

  async findAll(query: QueryFundTruthReconciliationsDto, currentUser: CurrentUser) {
    const visibilityScope = this.resolveVisibilityScope(currentUser);
    const [approvalRequests, paymentRecords, payoutRecords, abcSyncFunds] = await Promise.all([
      this.loadApprovalRequests(),
      this.loadPaymentRecords(),
      this.loadPayoutRecords(),
      this.loadAbcSyncFunds(),
    ]);

    const merged = [
      ...approvalRequests.map((item) =>
        this.buildApprovalRequestView(item, visibilityScope, false),
      ),
      ...paymentRecords.map((item) => this.buildPaymentRecordView(item, visibilityScope, false)),
      ...payoutRecords.map((item) => this.buildPayoutRecordView(item, visibilityScope, false)),
      ...abcSyncFunds.map((item) => this.buildAbcSyncFundView(item, visibilityScope, false)),
    ];

    const filtered = merged
      .filter((item) =>
        query.primaryObjectType ? item.primaryObjectType === query.primaryObjectType : true,
      )
      .filter((item) => (query.sourceRole ? item.sourceRole === query.sourceRole : true))
      .filter((item) => (query.truthLevel ? item.truthLevel === query.truthLevel : true))
      .filter((item) =>
        query.reconciliationStatus
          ? item.reconciliationStatus === query.reconciliationStatus
          : true,
      )
      .sort((left, right) => {
        const rightTime = right.sortTime ? new Date(right.sortTime).getTime() : 0;
        const leftTime = left.sortTime ? new Date(left.sortTime).getTime() : 0;
        return rightTime - leftTime || right.primaryObjectId - left.primaryObjectId;
      });

    return paginateArray(filtered, query);
  }

  async findOne(
    primaryObjectType: FundTruthPrimaryObjectType,
    primaryObjectId: number,
    currentUser: CurrentUser,
  ) {
    const visibilityScope = this.resolveVisibilityScope(currentUser);

    switch (primaryObjectType) {
      case 'approval_request': {
        const request = await this.approvalRequestRepository.findOne({
          where: { id: primaryObjectId },
          relations: {
            applicantUser: true,
            finalApprover: true,
            relatedWorkOrder: {
              responsibleUser: true,
              paymentRecords: true,
            },
            payoutRecords: true,
            approvalLogs: true,
          },
        });
        if (!request) {
          throw new NotFoundException('审批单不存在');
        }
        return this.buildApprovalRequestView(request, visibilityScope, true);
      }
      case 'payment_record': {
        const record = await this.paymentRecordRepository.findOne({
          where: { id: primaryObjectId },
          relations: {
            workOrder: {
              responsibleUser: true,
            },
          },
        });
        if (!record) {
          throw new NotFoundException('收款记录不存在');
        }
        return this.buildPaymentRecordView(record, visibilityScope, true);
      }
      case 'payout_record': {
        const record = await this.payoutRecordRepository.findOne({
          where: { id: primaryObjectId },
          relations: {
            approvalRequest: {
              applicantUser: true,
              finalApprover: true,
              relatedWorkOrder: {
                paymentRecords: true,
              },
            },
          },
        });
        if (!record) {
          throw new NotFoundException('付款记录不存在');
        }
        return this.buildPayoutRecordView(record, visibilityScope, true);
      }
      case 'abc_sync_fund': {
        const fund = await this.abcSyncFundRepository.findOne({ where: { id: primaryObjectId } });
        if (!fund) {
          throw new NotFoundException('同步资金记录不存在');
        }
        return this.buildAbcSyncFundView(fund, visibilityScope, true);
      }
      default:
        throw new NotFoundException('只读对照对象不存在');
    }
  }

  private async loadApprovalRequests() {
    return this.approvalRequestRepository.find({
      order: { updatedAt: 'DESC', id: 'DESC' },
      relations: {
        applicantUser: true,
        finalApprover: true,
        relatedWorkOrder: {
          responsibleUser: true,
          paymentRecords: true,
        },
        payoutRecords: true,
        approvalLogs: true,
      },
    });
  }

  private async loadPaymentRecords() {
    return this.paymentRecordRepository.find({
      order: { createdAt: 'DESC', id: 'DESC' },
      relations: {
        workOrder: {
          responsibleUser: true,
        },
      },
    });
  }

  private async loadPayoutRecords() {
    return this.payoutRecordRepository.find({
      order: { createdAt: 'DESC', id: 'DESC' },
      relations: {
        approvalRequest: {
          applicantUser: true,
          finalApprover: true,
          relatedWorkOrder: {
            paymentRecords: true,
          },
        },
      },
    });
  }

  private async loadAbcSyncFunds() {
    return this.abcSyncFundRepository.find({
      order: { updatedAt: 'DESC', id: 'DESC' },
    });
  }

  private buildApprovalRequestView(
    request: ApprovalRequest,
    visibilityScope: FundTruthVisibilityScope,
    includeDetail: boolean,
  ): FundTruthReconciliationViewModel {
    void includeDetail;
    const paymentRecords = this.sortByDate(
      [...(request.relatedWorkOrder?.paymentRecords ?? [])],
      (item) => item.paidAt ?? item.createdAt,
    );
    const payoutRecords = this.sortByDate(
      [...(request.payoutRecords ?? [])],
      (item) => item.paidAt ?? item.createdAt,
    );
    const latestPayment = paymentRecords.at(-1) ?? null;
    const latestPayout = payoutRecords.at(-1) ?? null;
    const reconciliationStatus = this.resolveApprovalRequestStatus(request, latestPayout);
    const currentArrivalBasis = latestPayment
      ? `当前只参考关联工单最近一条收款留痕 ${latestPayment.paymentNo ?? `#${latestPayment.id}`}，以 payment_records.paymentStatus=${latestPayment.paymentStatus} 说明业务到账语义。`
      : '当前审批单没有稳定挂到收款留痕；到账依据仍需人工补查。';
    const currentPayoutBasis = latestPayout
      ? `当前只参考 payout_records ${latestPayout.payoutNo} 的登记结果；这说明仓库里已经登记过付款，不代表银行主账。`
      : request.currentStatus === ApprovalStatus.APPROVED
        ? '审批已通过，但当前还没有 payout_records 登记，付款依据仍未落到业务留痕。'
        : '当前还没有付款登记依据。';
    const currentApprovalBasis = `当前审批依据来自 approval_requests.currentStatus=${request.currentStatus}，并由 approval_logs 保留人工审批留痕。`;
    const sourceOfTruthBoundary =
      'approval_requests 属于审批控制对象，只能说明“谁申请、谁审批、审批结论是什么”，不是银行主账，也不是到账真相源。';
    const gapSummary = this.buildApprovalRequestGapSummary(
      request,
      latestPayment,
      latestPayout,
      reconciliationStatus,
    );
    const nextOwnerRole = this.resolveApprovalRequestNextOwner(request, latestPayout);
    const recommendedNextStep = this.buildApprovalRequestNextStep(request, latestPayout);
    const summary = this.buildApprovalRequestSummary(request, latestPayment, latestPayout);
    const listSummary = this.buildApprovalRequestListSummary(request, latestPayout);
    const auditHints = [
      `审批日志 ${request.approvalLogs?.length ?? 0} 条，仍应以人工审批链留痕为准。`,
      latestPayment
        ? `关联工单最近收款留痕为 ${latestPayment.paymentNo ?? `#${latestPayment.id}`}，可作为审批背景，不可上升为银行真相。`
        : '当前没有稳定收款留痕，审批背景仍需人工补齐。',
      latestPayout
        ? `当前已登记付款 ${latestPayout.payoutNo}，下一步重点是核对登记语义与真实出款凭证是否一致。`
        : '当前还没有付款登记，不能把审批结论误判为资金已实际流转。',
    ];
    const basicInfo = this.buildBasicInfo([
      this.textItem('approvalNo', '审批编号', request.approvalNo),
      this.textItem('approvalStatus', '审批状态', request.currentStatus),
      this.textItem('approvalType', '审批类型', request.approvalType),
      this.moneyItem('amount', '申请金额', request.amount),
      this.textItem(
        'workOrderNo',
        '关联工单',
        request.relatedWorkOrder?.workOrderNo ?? this.asDisplayId(request.relatedWorkOrderId),
      ),
      this.textItem(
        'applicantUser',
        '申请人',
        request.applicantUser?.realName ?? request.applicantUser?.username ?? '-',
      ),
      this.textItem(
        'finalApprover',
        '最终审批人',
        request.finalApprover?.realName ?? request.finalApprover?.username ?? '-',
      ),
      this.textItem(
        'reason',
        '申请事由',
        visibilityScope === 'full' ? request.reason : this.compactText(request.reason),
        2,
      ),
      this.dateTimeItem('createdAt', '申请时间', request.createdAt),
      this.dateTimeItem('updatedAt', '更新时间', request.updatedAt),
    ]);
    const linkedObjectRefs = {
      approvalRequestId: request.id,
      paymentRecordId: latestPayment?.id ?? null,
      payoutRecordId: latestPayout?.id ?? null,
      abcSyncFundId: null,
      workOrderId: request.relatedWorkOrderId ?? null,
    };
    const linkedObjectList: FundTruthLinkedObjectItem[] = this.compactLinkedItems([
      this.linkedItem(
        '关联工单',
        'work_order',
        request.relatedWorkOrder?.id ?? request.relatedWorkOrderId ?? null,
        request.relatedWorkOrder?.workOrderNo ?? this.asDisplayId(request.relatedWorkOrderId),
        request.relatedWorkOrder ? request.relatedWorkOrder.title : null,
      ),
      latestPayment
        ? this.linkedItem(
            '最近收款留痕',
            'payment_record',
            latestPayment.id,
            latestPayment.paymentNo ?? this.asDisplayId(latestPayment.id),
            paymentRecords.length > 1 ? `共 ${paymentRecords.length} 条收款留痕` : null,
          )
        : null,
      latestPayout
        ? this.linkedItem(
            '最近付款登记',
            'payout_record',
            latestPayout.id,
            latestPayout.payoutNo ?? this.asDisplayId(latestPayout.id),
            payoutRecords.length > 1 ? `共 ${payoutRecords.length} 条付款登记` : null,
          )
        : null,
    ]);
    const mappingReadiness = this.buildMappingReadiness({
      visibilityScope,
      mappingReadinessStatus: request.relatedWorkOrderId ? 'partially_ready' : 'weak_anchor_only',
      stableMappingKeys: [
        this.mappingKeyItem(
          'approval_request_id',
          '审批对象主键',
          request.id,
          'approval_requests.id',
          '仓内审批对象的稳定主键，可作为只读映射层的内部锚点。',
        ),
        this.mappingKeyItem(
          'approval_no',
          '审批编号',
          request.approvalNo,
          'approval_requests.approval_no',
          '审批编号在 approval_requests 中唯一，适合继续作为审批侧稳定编号。',
        ),
        this.mappingKeyItem(
          'related_work_order_id',
          '关联工单主键',
          request.relatedWorkOrderId ?? null,
          'approval_requests.related_work_order_id',
          '这是审批链挂回业务主干的稳定锚点，但只在已有工单绑定时成立。',
        ),
        this.mappingKeyItem(
          'work_order_no',
          '工单编号',
          request.relatedWorkOrder?.workOrderNo ?? null,
          'work_orders.work_order_no',
          '工单编号可与 payment_records 共用，适合作为审批侧到业务侧的只读桥。',
        ),
      ],
      weakMatchingHints: [
        this.mappingKeyItem(
          'approval_amount',
          '审批金额',
          request.amount,
          'approval_requests.amount',
          '金额只能作为弱匹配线索，不能单独充当稳定映射键。',
        ),
        this.mappingKeyItem(
          'approval_status',
          '审批状态',
          request.currentStatus,
          'approval_requests.current_status',
          '状态只能说明审批结论，不能替代审批到资金真相的稳定锚点。',
        ),
        this.mappingKeyItem(
          'latest_payout_no',
          '最近付款登记编号',
          latestPayout?.payoutNo ?? null,
          'payout_records.payout_no',
          '这是当前审批链上的上下文线索，但“最近一条”不是长期稳定的一对一锚点。',
        ),
        this.mappingKeyItem(
          'latest_payment_no',
          '最近到账语义编号',
          latestPayment?.paymentNo ?? null,
          'payment_records.payment_no',
          '当前只作为审批背景线索使用，不能把最近到账记录误当成审批侧主绑定键。',
        ),
      ],
      missingAnchors: [
        this.missingAnchorItem(
          'approval_to_bank_payout_anchor',
          '审批到银行出款的稳定锚点',
          request.relatedWorkOrderId
            ? '当前 approval_requests 只能稳定挂到工单，缺少能把审批结论继续只读挂到银行真相源的外部出款流水号或回单号。'
            : '当前 approval_requests 连稳定工单锚点都不完整，更缺少审批到银行出款的外部流水号或回单号。',
          'finance_data_review',
        ),
        this.missingAnchorItem(
          'approval_to_payout_bridge',
          '审批到付款登记的一致性锚点',
          latestPayout
            ? '虽然已有 payout_records 关系，但仍缺一个可长期复用的审批到真实出款对象桥接键，不能只靠“最新一条付款登记”。'
            : '当前还缺审批到 payout_records 的稳定桥接结果，未来银行真相源进来前应先把审批与付款登记的锚点站稳。',
          latestPayout ? 'finance_data_review' : 'finance',
        ),
        this.missingAnchorItem(
          'external_payout_reference',
          '外部出款凭证号 / 银行流水号',
          '审批对象当前完全没有银行回单号、外部出款流水号或账户侧对账编号，无法直接挂接未来银行真相源。',
          'finance_audit',
        ),
      ],
      anchorConfidence: request.relatedWorkOrderId ? 'medium' : 'low',
      anchorPlanSummary: request.relatedWorkOrderId
        ? '先以 approvalNo + relatedWorkOrderId/workOrderNo 站稳审批侧主锚，再补审批到付款登记/银行出款的稳定桥。'
        : '当前只有审批自身编号，先补 relatedWorkOrderId/workOrderNo，再谈审批到付款登记或银行真相的只读映射。',
      recommendedAnchorPlan: request.relatedWorkOrderId
        ? '推荐先保留 approval_requests.approval_no 与 approval_requests.related_work_order_id 作为审批侧主锚；未来银行真相源接入时，由财务补充“银行流水号/回单号 -> payoutNo/approvalNo”的只读映射，不把 approval_request 直接升格为银行真相源。'
        : '推荐先由审批/管理侧补齐 approval_requests.related_work_order_id 与 work_orders.work_order_no 这层业务锚点，再由财务在付款登记后追加外部出款流水号或回单号的只读映射。',
      mappingEvidence: [
        'approval_requests.approval_no 是审批对象唯一编号。',
        'approval_requests.related_work_order_id 可以只读挂到 work_orders.id。',
        'payout_records.approval_request_id 说明审批链可以延伸到付款登记，但当前仍缺银行真相锚点。',
      ],
      futureTruthIngestionBoundary:
        '未来银行真相源只能作为 approvalNo / payoutNo 之后的新只读对照层进入，当前 approval_requests 仍只负责审批控制，不写银行流水、不改金额、不触发自动对账。',
    });
    const truthGapPlan = this.buildTruthGapPlan({
      visibilityScope,
      summary,
      listSummary,
      sourceRole: 'approval_control',
      truthLevel: 'supporting_source',
      reconciliationStatus,
      currentArrivalBasis,
      currentPayoutBasis,
      currentApprovalBasis,
      gapSummary,
      nextOwnerRole,
      recommendedNextStep,
      sourceOfTruthBoundary,
      actionItems: [
        this.actionItem(
          'review_approval_boundary',
          '确认这是一张审批控制对象',
          '先把审批、到账、付款、银行真相边界拆开：approval_requests 只说明审批结论，不说明银行真实收付。',
          'shared_manual_review',
          request.relatedWorkOrderId ? 'done' : 'blocked',
        ),
        this.actionItem(
          'follow_payout_registration',
          request.currentStatus === ApprovalStatus.APPROVED ? '跟进付款登记' : '保留审批留痕',
          recommendedNextStep,
          nextOwnerRole,
          request.currentStatus === ApprovalStatus.REJECTED
            ? 'not_applicable'
            : latestPayout
              ? 'done'
              : request.currentStatus === ApprovalStatus.APPROVED
                ? 'pending'
                : 'ready',
        ),
      ],
      auditHints,
    });

    return {
      recordKey: `approval_request:${request.id}`,
      visibilityScope,
      sourceRole: 'approval_control',
      truthLevel: 'supporting_source',
      reconciliationStatus,
      primaryObjectType: 'approval_request',
      primaryObjectId: request.id,
      primaryObjectNo: request.approvalNo,
      primaryObjectStatus: request.currentStatus,
      summary,
      listSummary,
      linkedObjectRefs,
      linkedObjectList,
      currentArrivalBasis,
      currentPayoutBasis,
      currentApprovalBasis,
      sourceOfTruthBoundary,
      gapSummary,
      nextOwnerRole,
      recommendedNextStep,
      mappingReadinessStatus: mappingReadiness.mappingReadinessStatus,
      anchorPlanSummary: mappingReadiness.anchorPlanSummary,
      mappingReadiness,
      auditHints,
      basicInfo,
      truthGapPlan,
      sortTime: request.updatedAt ?? request.createdAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private resolveApprovalRequestStatus(
    request: ApprovalRequest,
    latestPayout: PayoutRecord | null,
  ): FundTruthReconciliationStatus {
    if (!request.relatedWorkOrderId) {
      return 'missing_link';
    }
    if (request.currentStatus === ApprovalStatus.PENDING) {
      return 'needs_manual_review';
    }
    if (request.currentStatus === ApprovalStatus.REJECTED) {
      return 'aligned';
    }
    if (request.currentStatus === ApprovalStatus.APPROVED && latestPayout) {
      return 'aligned';
    }
    return 'partially_aligned';
  }

  private buildApprovalRequestSummary(
    request: ApprovalRequest,
    latestPayment: PaymentRecord | null,
    latestPayout: PayoutRecord | null,
  ) {
    if (request.currentStatus === ApprovalStatus.PENDING) {
      return `审批单 ${request.approvalNo} 当前仍处于待审批状态；它只定义审批控制边界，尚未形成资金真相。`;
    }
    if (request.currentStatus === ApprovalStatus.REJECTED) {
      return `审批单 ${request.approvalNo} 已被驳回；当前只保留审批控制留痕，不进入付款或银行真相结论。`;
    }
    if (latestPayout) {
      return `审批单 ${request.approvalNo} 已通过，且仓库里已经登记付款 ${latestPayout.payoutNo}；但这仍只说明审批与业务登记闭合，不等于银行真相。`;
    }
    if (latestPayment) {
      return `审批单 ${request.approvalNo} 已通过，并已挂到收款背景 ${latestPayment.paymentNo ?? `#${latestPayment.id}`}；下一步仍需人工登记付款并核对真实出款依据。`;
    }
    return `审批单 ${request.approvalNo} 已通过，但当前只形成审批结论，还没有稳定付款登记或银行真相来源。`;
  }

  private buildApprovalRequestListSummary(
    request: ApprovalRequest,
    latestPayout: PayoutRecord | null,
  ) {
    if (request.currentStatus === ApprovalStatus.PENDING) {
      return '先完成人工审批，再区分审批结论与真实收付真相。';
    }
    if (request.currentStatus === ApprovalStatus.REJECTED) {
      return '保留审批驳回留痕，不再进入本轮付款。';
    }
    if (latestPayout) {
      return '审批已过且已登记付款，当前重点转到登记语义与真实出款凭证核对。';
    }
    return '审批已过，但仍需财务登记付款并补齐真实出款依据。';
  }

  private buildApprovalRequestGapSummary(
    request: ApprovalRequest,
    latestPayment: PaymentRecord | null,
    latestPayout: PayoutRecord | null,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return '审批单缺少稳定业务上下文，当前无法把它挂到真实工单或资金对象上。';
    }
    if (request.currentStatus === ApprovalStatus.PENDING) {
      return '当前仍缺审批结论、付款登记和银行出款主对象；审批控制还没有走完。';
    }
    if (request.currentStatus === ApprovalStatus.REJECTED) {
      return '审批已经结束，但驳回并不产生资金真相；这张单据只剩审批控制留痕价值。';
    }
    if (latestPayout) {
      return '当前已经形成审批结论与业务付款登记，但仍缺银行主账、银行回单或账户级对账依据。';
    }
    if (latestPayment) {
      return '当前只有审批结论与到账背景，仍缺付款登记与银行真相源。';
    }
    return '当前只有审批结论，还没有稳定付款登记或银行真相来源。';
  }

  private resolveApprovalRequestNextOwner(
    request: ApprovalRequest,
    latestPayout: PayoutRecord | null,
  ) {
    if (request.currentStatus === ApprovalStatus.PENDING) {
      return 'approver_or_admin';
    }
    if (request.currentStatus === ApprovalStatus.REJECTED) {
      return 'business_requester';
    }
    if (latestPayout) {
      return 'finance_audit';
    }
    return 'finance';
  }

  private buildApprovalRequestNextStep(
    request: ApprovalRequest,
    latestPayout: PayoutRecord | null,
  ) {
    if (request.currentStatus === ApprovalStatus.PENDING) {
      return '继续由审批人或管理员人工完成审批，避免把审批草稿误报为资金真相。';
    }
    if (request.currentStatus === ApprovalStatus.REJECTED) {
      return '保留驳回原因与审批日志；如业务需要重走流程，应重新发起审批。';
    }
    if (latestPayout) {
      return '把已登记付款与真实出款凭证做人工核对，确认这只是付款登记而非银行主账。';
    }
    return '由财务继续登记 payout_records，并明确“审批结论”与“真实出款”仍是两层语义。';
  }

  private buildPaymentRecordView(
    record: PaymentRecord,
    visibilityScope: FundTruthVisibilityScope,
    includeDetail: boolean,
  ): FundTruthReconciliationViewModel {
    void includeDetail;
    const reconciliationStatus = this.resolvePaymentRecordStatus(record);
    const sourceOfTruthBoundary =
      'payment_records 只代表当前仓库里的到账业务语义：它说明“系统里认为这笔钱已到/待确认/失败”，不是银行真相源。';
    const currentArrivalBasis = record.workOrder
      ? `当前到账依据来自 payment_records.paymentStatus=${record.paymentStatus}，并辅以 work_orders.amountReceived / status 的业务结果留痕。`
      : `当前只剩 payment_records.paymentStatus=${record.paymentStatus} 这一层业务留痕；关联工单上下文缺失。`;
    const currentPayoutBasis = 'payment_records 不承担付款依据；如需付款语义应转看 payout_records。';
    const currentApprovalBasis = 'payment_records 不承担审批依据；如需审批语义应转看 approval_requests。';
    const gapSummary = this.buildPaymentRecordGapSummary(record, reconciliationStatus);
    const nextOwnerRole = this.resolvePaymentRecordNextOwner(record, reconciliationStatus);
    const recommendedNextStep = this.buildPaymentRecordNextStep(record, reconciliationStatus);
    const summary = this.buildPaymentRecordSummary(record, reconciliationStatus);
    const listSummary = this.buildPaymentRecordListSummary(record, reconciliationStatus);
    const auditHints = [
      record.workOrder
        ? `关联工单 ${record.workOrder.workOrderNo} 当前实收 ${record.workOrder.amountReceived}，应先核对这条业务留痕与人工确认结论是否一致。`
        : '当前缺少工单上下文，任何到账结论都只能先停留在待确认层。',
      `paymentStatus=${record.paymentStatus} 只代表仓库内到账语义，不应直接等同于银行流水或银行回单。`,
      '若要形成银行真相边界，仍缺银行流水主对象、回单或账户级对账依据。',
    ];
    const basicInfo = this.buildBasicInfo([
      this.textItem('paymentNo', '收款编号', record.paymentNo),
      this.textItem('paymentStatus', '收款状态', record.paymentStatus),
      this.textItem('paymentMethod', '收款渠道', record.paymentMethod),
      this.moneyItem('amount', '金额', record.amount),
      this.textItem(
        'workOrderNo',
        '关联工单',
        record.workOrder?.workOrderNo ?? this.asDisplayId(record.workOrderId),
      ),
      this.textItem(
        'payerName',
        '付款人',
        visibilityScope === 'full'
          ? record.payerName ?? '-'
          : this.maskValue(record.payerName) ?? '-',
      ),
      this.textItem(
        'remark',
        '备注',
        visibilityScope === 'full' ? record.remark ?? '-' : this.compactText(record.remark),
        2,
      ),
      this.dateTimeItem('paidAt', '业务时间', record.paidAt ?? record.createdAt),
      this.dateTimeItem('createdAt', '创建时间', record.createdAt),
    ]);
    const linkedObjectRefs = {
      approvalRequestId: null,
      paymentRecordId: record.id,
      payoutRecordId: null,
      abcSyncFundId: null,
      workOrderId: record.workOrderId ?? null,
    };
    const linkedObjectList: FundTruthLinkedObjectItem[] = this.compactLinkedItems([
      this.linkedItem(
        '关联工单',
        'work_order',
        record.workOrder?.id ?? record.workOrderId ?? null,
        record.workOrder?.workOrderNo ?? this.asDisplayId(record.workOrderId),
        record.workOrder?.title ?? null,
      ),
    ]);
    const mappingReadiness = this.buildMappingReadiness({
      visibilityScope,
      mappingReadinessStatus: record.workOrder ? 'partially_ready' : 'weak_anchor_only',
      stableMappingKeys: [
        this.mappingKeyItem(
          'payment_record_id',
          '到账语义对象主键',
          record.id,
          'payment_records.id',
          '仓内到账语义对象的稳定主键，只能用于仓内只读映射。',
        ),
        this.mappingKeyItem(
          'payment_no',
          '到账语义编号',
          record.paymentNo,
          'payment_records.payment_no',
          'paymentNo 在 payment_records 中唯一，是当前最稳定的到账侧编号。',
        ),
        this.mappingKeyItem(
          'work_order_id',
          '工单主键',
          record.workOrderId ?? null,
          'payment_records.work_order_id',
          '到账语义通过 work_order_id 挂回业务主干，这是当前仓内最稳定的业务锚点。',
        ),
        this.mappingKeyItem(
          'work_order_no',
          '工单编号',
          record.workOrder?.workOrderNo ?? null,
          'work_orders.work_order_no',
          '工单编号可与 approval_requests 一起复用，但仍不等于银行真相源键。',
        ),
      ],
      weakMatchingHints: [
        this.mappingKeyItem(
          'amount',
          '到账金额',
          record.amount,
          'payment_records.amount',
          '金额只能作为弱匹配线索，不能单独证明到账真相。',
        ),
        this.mappingKeyItem(
          'paid_at',
          '到账时间',
          this.formatLocalDateTime(record.paidAt ?? record.createdAt),
          'payment_records.paid_at',
          '时间可用于人工核对，但不能代替外部流水号或银行回单号。',
        ),
        this.mappingKeyItem(
          'payment_method',
          '支付方式',
          record.paymentMethod,
          'payment_records.payment_method',
          '支付方式只能缩小匹配范围，不能充当稳定锚点。',
        ),
        this.mappingKeyItem(
          'payer_name',
          '付款方',
          visibilityScope === 'full'
            ? record.payerName ?? null
            : this.maskValue(record.payerName) ?? null,
          'payment_records.payer_name',
          '付款方名称只适合作为辅助线索，restricted 视图保持收口展示。',
        ),
      ],
      missingAnchors: [
        this.missingAnchorItem(
          'bank_transaction_reference',
          '银行流水号 / 第三方交易号',
          'payment_records 当前没有任何外部交易流水号，无法把到账语义稳定挂到未来银行真相源。',
          'finance_data_review',
        ),
        this.missingAnchorItem(
          'bank_statement_line_id',
          '银行回单号 / 对账行号',
          '当前缺少账户侧回单或银行对账行号，不能把 payment_records.success 直接解释为银行到账真相。',
          'finance_audit',
        ),
        this.missingAnchorItem(
          'cross_system_business_anchor',
          '统一业务编号',
          record.workOrder
            ? '当前可借助 workOrderId/workOrderNo 站稳业务侧锚点，但仍缺一个能跨到账语义与银行真相源复用的统一业务编号。'
            : '当前连稳定工单锚点都不完整，更缺统一业务编号，未来接银行真相前要先把业务侧主锚站稳。',
          record.workOrder ? 'data_governance' : 'admin_data_review',
        ),
      ],
      anchorConfidence: record.workOrder ? 'medium' : 'low',
      anchorPlanSummary: record.workOrder
        ? '先用 paymentNo + workOrderId/workOrderNo 站稳仓内到账锚点，再补银行流水号或回单号的只读映射。'
        : '当前只有到账对象自身编号，先补工单锚点，再谈与未来银行真相源的只读挂接。',
      recommendedAnchorPlan: record.workOrder
        ? '推荐继续把 payment_records.payment_no 与 payment_records.work_order_id 作为到账语义主锚；未来银行真相源进来时，由财务把“银行流水号/第三方交易号/回单号”只读挂到 paymentNo，而不是把 payment_records 直接升级为银行真相源。'
        : '推荐先补齐 payment_records.work_order_id 与 work_orders.work_order_no，再由财务追加外部流水号或回单号的只读映射；在此之前只能停留在到账语义层。',
      mappingEvidence: [
        'payment_records.payment_no 是到账语义对象的唯一编号。',
        'payment_records.work_order_id 可以只读挂到 work_orders.id。',
        'payment_records.payment_status 只表达仓内到账语义，不是银行真相字段。',
      ],
      futureTruthIngestionBoundary:
        '未来银行真相源只允许以“外部流水号/回单号 -> paymentNo/workOrderNo”的只读对照层接入；当前 payment_records 继续保持到账语义对象定位，不写银行流水、不改状态分层。',
    });
    const truthGapPlan = this.buildTruthGapPlan({
      visibilityScope,
      summary,
      listSummary,
      sourceRole: 'business_arrival_semantics',
      truthLevel: 'supporting_source',
      reconciliationStatus,
      currentArrivalBasis,
      currentPayoutBasis,
      currentApprovalBasis,
      gapSummary,
      nextOwnerRole,
      recommendedNextStep,
      sourceOfTruthBoundary,
      actionItems: [
        this.actionItem(
          'review_arrival_semantics',
          '确认到账语义边界',
          '先确认这条 payment_records 只说明业务到账语义，不要把它误报为银行主账。',
          'shared_manual_review',
          'done',
        ),
        this.actionItem(
          'manual_arrival_followup',
          '继续人工核对到账依据',
          recommendedNextStep,
          nextOwnerRole,
          reconciliationStatus === 'missing_link'
            ? 'blocked'
            : reconciliationStatus === 'partially_aligned'
              ? 'pending'
              : reconciliationStatus === 'no_truth_source'
                ? 'not_applicable'
                : 'ready',
        ),
      ],
      auditHints,
    });

    return {
      recordKey: `payment_record:${record.id}`,
      visibilityScope,
      sourceRole: 'business_arrival_semantics',
      truthLevel: 'supporting_source',
      reconciliationStatus,
      primaryObjectType: 'payment_record',
      primaryObjectId: record.id,
      primaryObjectNo: record.paymentNo,
      primaryObjectStatus: record.paymentStatus,
      summary,
      listSummary,
      linkedObjectRefs,
      linkedObjectList,
      currentArrivalBasis,
      currentPayoutBasis,
      currentApprovalBasis,
      sourceOfTruthBoundary,
      gapSummary,
      nextOwnerRole,
      recommendedNextStep,
      mappingReadinessStatus: mappingReadiness.mappingReadinessStatus,
      anchorPlanSummary: mappingReadiness.anchorPlanSummary,
      mappingReadiness,
      auditHints,
      basicInfo,
      truthGapPlan,
      sortTime: record.paidAt ?? record.createdAt,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
    };
  }

  private buildPayoutRecordView(
    record: PayoutRecord,
    visibilityScope: FundTruthVisibilityScope,
    includeDetail: boolean,
  ): FundTruthReconciliationViewModel {
    void includeDetail;
    const approvalRequest = record.approvalRequest ?? null;
    const relatedWorkOrder = approvalRequest?.relatedWorkOrder ?? null;
    const latestPayment =
      this.sortByDate(
        [...(relatedWorkOrder?.paymentRecords ?? [])],
        (item) => item.paidAt ?? item.createdAt,
      ).at(-1) ?? null;
    const reconciliationStatus = this.resolvePayoutRecordStatus(record);
    const currentArrivalBasis = latestPayment
      ? `当前只参考关联工单最近一条收款留痕 ${latestPayment.paymentNo ?? `#${latestPayment.id}`} 作为背景；它不是这条付款登记的真相源。`
      : '当前没有稳定的到账背景留痕；付款登记只能先按业务对象单独查看。';
    const currentPayoutBasis = `当前付款依据只落在 payout_records ${record.payoutNo} 的登记字段：paidAt / amount / paymentMethod。`;
    const currentApprovalBasis = approvalRequest
      ? `当前审批依据来自 approval_requests ${approvalRequest.approvalNo}（状态 ${approvalRequest.currentStatus}）。`
      : '当前缺少关联 approval_requests，付款登记没有稳定审批依据。';
    const sourceOfTruthBoundary =
      'payout_records 只是付款登记薄壳，用来说明“系统里登记过一笔付款”，离银行真相最远，不能替代银行出款主账。';
    const gapSummary = this.buildPayoutRecordGapSummary(record, approvalRequest, reconciliationStatus);
    const nextOwnerRole = this.resolvePayoutRecordNextOwner(approvalRequest, reconciliationStatus);
    const recommendedNextStep = this.buildPayoutRecordNextStep(
      approvalRequest,
      reconciliationStatus,
    );
    const summary = this.buildPayoutRecordSummary(record, approvalRequest);
    const listSummary = this.buildPayoutRecordListSummary(
      approvalRequest,
      reconciliationStatus,
    );
    const auditHints = [
      approvalRequest
        ? `关联审批单 ${approvalRequest.approvalNo} 当前状态 ${approvalRequest.currentStatus}，仍需确认审批结论与付款登记是否一致。`
        : '当前付款登记缺少审批链支撑，优先核对这条业务对象为什么会存在。',
      'payout_records 只能证明仓库里登记过付款，不等于银行实际出款或银行回单。',
      '若后续要做银行真相对账，仍缺银行流水主对象、回单或账户侧对账凭证。',
    ];
    const basicInfo = this.buildBasicInfo([
      this.textItem('payoutNo', '付款编号', record.payoutNo),
      this.moneyItem('amount', '付款金额', record.amount),
      this.textItem('paymentMethod', '付款方式', record.paymentMethod),
      this.textItem(
        'payeeName',
        '收款方',
        visibilityScope === 'full' ? record.payeeName : this.maskValue(record.payeeName) ?? '-',
      ),
      this.textItem(
        'approvalNo',
        '关联审批单',
        approvalRequest?.approvalNo ?? this.asDisplayId(record.approvalRequestId),
      ),
      this.textItem('workOrderNo', '关联工单', relatedWorkOrder?.workOrderNo ?? '-'),
      this.dateTimeItem('paidAt', '付款时间', record.paidAt),
      this.dateTimeItem('createdAt', '登记时间', record.createdAt),
    ]);
    const linkedObjectRefs = {
      approvalRequestId: approvalRequest?.id ?? record.approvalRequestId ?? null,
      paymentRecordId: latestPayment?.id ?? null,
      payoutRecordId: record.id,
      abcSyncFundId: null,
      workOrderId: relatedWorkOrder?.id ?? null,
    };
    const linkedObjectList: FundTruthLinkedObjectItem[] = this.compactLinkedItems([
      approvalRequest
        ? this.linkedItem(
            '关联审批单',
            'approval_request',
            approvalRequest.id,
            approvalRequest.approvalNo ?? this.asDisplayId(approvalRequest.id),
            approvalRequest.currentStatus,
          )
        : null,
      relatedWorkOrder
        ? this.linkedItem(
            '关联工单',
            'work_order',
            relatedWorkOrder.id,
            relatedWorkOrder.workOrderNo,
            relatedWorkOrder.title,
          )
        : null,
      latestPayment
        ? this.linkedItem(
            '最近收款留痕',
            'payment_record',
            latestPayment.id,
            latestPayment.paymentNo ?? this.asDisplayId(latestPayment.id),
            latestPayment.paymentStatus,
          )
        : null,
    ]);
    const mappingReadiness = this.buildMappingReadiness({
      visibilityScope,
      mappingReadinessStatus: approvalRequest ? 'partially_ready' : 'weak_anchor_only',
      stableMappingKeys: [
        this.mappingKeyItem(
          'payout_record_id',
          '付款登记对象主键',
          record.id,
          'payout_records.id',
          '仓内付款登记对象的稳定主键，只用于当前仓库内只读映射。',
        ),
        this.mappingKeyItem(
          'payout_no',
          '付款登记编号',
          record.payoutNo,
          'payout_records.payout_no',
          'payoutNo 在 payout_records 中唯一，是当前付款登记侧最稳定的编号。',
        ),
        this.mappingKeyItem(
          'approval_request_id',
          '关联审批主键',
          record.approvalRequestId ?? null,
          'payout_records.approval_request_id',
          '付款登记当前通过 approval_request_id 挂回审批链，是最稳定的业务桥之一。',
        ),
        this.mappingKeyItem(
          'approval_no',
          '审批编号',
          approvalRequest?.approvalNo ?? null,
          'approval_requests.approval_no',
          '审批编号能帮助付款登记继续挂回审批链，但仍不是银行真相源键。',
        ),
        this.mappingKeyItem(
          'work_order_no',
          '工单编号',
          relatedWorkOrder?.workOrderNo ?? null,
          'work_orders.work_order_no',
          '当审批已挂工单时，工单编号可以继续承担仓内业务桥接作用。',
        ),
      ],
      weakMatchingHints: [
        this.mappingKeyItem(
          'amount',
          '付款金额',
          record.amount,
          'payout_records.amount',
          '金额只能作为弱匹配线索，不能代替外部出款流水或回单号。',
        ),
        this.mappingKeyItem(
          'paid_at',
          '付款时间',
          this.formatLocalDateTime(record.paidAt),
          'payout_records.paid_at',
          '付款时间适合人工核对，但不足以充当稳定映射键。',
        ),
        this.mappingKeyItem(
          'payment_method',
          '付款方式',
          record.paymentMethod,
          'payout_records.payment_method',
          '付款方式只能缩小人工核对范围，不能直接挂接银行真相。',
        ),
        this.mappingKeyItem(
          'payee_name',
          '收款方',
          visibilityScope === 'full'
            ? record.payeeName ?? null
            : this.maskValue(record.payeeName) ?? null,
          'payout_records.payee_name',
          '收款方名称仅作弱线索，restricted 视图继续收口展示。',
        ),
      ],
      missingAnchors: [
        this.missingAnchorItem(
          'bank_debit_transaction_no',
          '银行出款流水号',
          'payout_records 当前只有仓内付款登记，没有外部银行出款流水号，无法直接挂接未来银行真相源。',
          'finance_data_review',
        ),
        this.missingAnchorItem(
          'bank_statement_or_receipt_no',
          '银行回单号 / 对账行号',
          '当前缺少银行回单号或账户侧对账行号，不能把付款登记对象误判成真实出款主账。',
          'finance_audit',
        ),
        this.missingAnchorItem(
          'approval_to_bank_bridge',
          '审批到真实出款对象的桥接键',
          approvalRequest
            ? '当前虽已通过 approval_request_id 挂回审批链，但仍缺审批到银行真实出款对象的稳定桥接键。'
            : '当前连稳定审批锚点都不完整，更无法建立审批到真实出款对象的稳定桥接键。',
          approvalRequest ? 'finance' : 'approver_or_admin',
        ),
      ],
      anchorConfidence: approvalRequest && relatedWorkOrder ? 'medium' : 'low',
      anchorPlanSummary: approvalRequest
        ? '先用 payoutNo + approvalRequestId/approvalNo 站稳付款登记锚点，再补银行出款流水号或回单号。'
        : '当前只有付款登记自身编号，先补稳定审批锚点，再谈未来银行真相接入。',
      recommendedAnchorPlan: approvalRequest
        ? '推荐继续把 payout_records.payout_no 与 payout_records.approval_request_id 作为付款登记主锚；未来银行真相源接入时，由财务把“银行出款流水号/回单号”只读挂到 payoutNo 或 approvalNo，而不是把 payout_records 当成银行主账。'
        : '推荐先补齐 payout_records.approval_request_id 与 approval_requests.approval_no 这条审批桥，再由财务追加外部出款流水号或回单号的只读映射。',
      mappingEvidence: [
        'payout_records.payout_no 是付款登记对象的唯一编号。',
        'payout_records.approval_request_id 可以只读挂到 approval_requests.id。',
        'approval_requests.related_work_order_id 能把付款登记继续挂回业务工单，但当前仍缺银行真相锚点。',
      ],
      futureTruthIngestionBoundary:
        '未来银行真相源只能作为“银行出款流水号/回单号 -> payoutNo/approvalNo”的只读对照层接入；当前 payout_records 仍只是付款登记对象，不写银行流水、不自动闭环。',
    });
    const truthGapPlan = this.buildTruthGapPlan({
      visibilityScope,
      summary,
      listSummary,
      sourceRole: 'payout_registration',
      truthLevel: 'not_truth_source',
      reconciliationStatus,
      currentArrivalBasis,
      currentPayoutBasis,
      currentApprovalBasis,
      gapSummary,
      nextOwnerRole,
      recommendedNextStep,
      sourceOfTruthBoundary,
      actionItems: [
        this.actionItem(
          'review_payout_boundary',
          '确认这只是付款登记对象',
          '先明确 payout_records 只负责业务登记，不是银行出款真相源。',
          'shared_manual_review',
          'done',
        ),
        this.actionItem(
          'verify_bank_gap',
          '补齐真实出款依据',
          recommendedNextStep,
          nextOwnerRole,
          reconciliationStatus === 'missing_link' ? 'blocked' : 'pending',
        ),
      ],
      auditHints,
    });

    return {
      recordKey: `payout_record:${record.id}`,
      visibilityScope,
      sourceRole: 'payout_registration',
      truthLevel: 'not_truth_source',
      reconciliationStatus,
      primaryObjectType: 'payout_record',
      primaryObjectId: record.id,
      primaryObjectNo: record.payoutNo,
      primaryObjectStatus: approvalRequest?.currentStatus ?? null,
      summary,
      listSummary,
      linkedObjectRefs,
      linkedObjectList,
      currentArrivalBasis,
      currentPayoutBasis,
      currentApprovalBasis,
      sourceOfTruthBoundary,
      gapSummary,
      nextOwnerRole,
      recommendedNextStep,
      mappingReadinessStatus: mappingReadiness.mappingReadinessStatus,
      anchorPlanSummary: mappingReadiness.anchorPlanSummary,
      mappingReadiness,
      auditHints,
      basicInfo,
      truthGapPlan,
      sortTime: record.paidAt ?? record.createdAt,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
    };
  }

  private resolvePaymentRecordStatus(record: PaymentRecord): FundTruthReconciliationStatus {
    if (!record.workOrderId || !record.workOrder) {
      return 'missing_link';
    }
    if (record.paymentStatus === PaymentStatus.SUCCESS) {
      return 'partially_aligned';
    }
    if (record.paymentStatus === PaymentStatus.PENDING) {
      return 'needs_manual_review';
    }
    return 'no_truth_source';
  }

  private buildPaymentRecordSummary(
    record: PaymentRecord,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return `收款记录 ${record.paymentNo} 缺少稳定工单上下文；当前只能把它视为待核对的业务到账留痕。`;
    }
    if (record.paymentStatus === PaymentStatus.SUCCESS) {
      return `收款记录 ${record.paymentNo} 已在仓库内形成到账语义，并已影响业务状态；但这仍不是银行真相源。`;
    }
    if (record.paymentStatus === PaymentStatus.PENDING) {
      return `收款记录 ${record.paymentNo} 当前只表示“待确认到账”的业务语义，仍需人工核对到账依据。`;
    }
    return `收款记录 ${record.paymentNo} 当前是 failed 留痕；它只能说明业务失败结果，不能作为到账真相依据。`;
  }

  private buildPaymentRecordListSummary(
    record: PaymentRecord,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return '先补工单上下文，再判断这条到账语义是否可信。';
    }
    if (record.paymentStatus === PaymentStatus.SUCCESS) {
      return '已形成业务到账语义，但仍缺银行主账。';
    }
    if (record.paymentStatus === PaymentStatus.PENDING) {
      return '继续由财务人工核对到账依据，不要直接推进为银行真相。';
    }
    return '保留失败留痕，不把 failed 误判为到账。';
  }

  private buildPaymentRecordGapSummary(
    record: PaymentRecord,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return '当前收款记录缺少稳定工单上下文，连业务到账语义都还没有站稳。';
    }
    if (record.paymentStatus === PaymentStatus.SUCCESS) {
      return '当前 success 只说明仓库内到账语义已经成立；仍缺银行流水、回单或账户级主对象。';
    }
    if (record.paymentStatus === PaymentStatus.PENDING) {
      return '当前只有待确认到账语义，既缺银行真相源，也缺到账完成的人工作结论。';
    }
    return '当前 failed 只保留失败结果，没有可继续放大的资金真相价值。';
  }

  private resolvePaymentRecordNextOwner(
    record: PaymentRecord,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return 'admin_data_review';
    }
    if (record.paymentStatus === PaymentStatus.SUCCESS) {
      return 'finance_audit';
    }
    if (record.paymentStatus === PaymentStatus.PENDING) {
      return 'finance';
    }
    return 'finance_manual_review';
  }

  private buildPaymentRecordNextStep(
    record: PaymentRecord,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return '先补齐关联工单，再判断这条 payment_records 是否还能作为到账语义留痕使用。';
    }
    if (record.paymentStatus === PaymentStatus.SUCCESS) {
      return '继续把它当作业务到账语义看待，同时人工核对是否存在独立银行依据；不要把 success 直接升级成银行真相。';
    }
    if (record.paymentStatus === PaymentStatus.PENDING) {
      return '由财务沿现有人工确认边界继续核对到账依据，确认后再决定业务是否收口。';
    }
    return '保留失败结果；如业务重试，应产生新的业务留痕，而不是复用 failed 记录冒充到账。';
  }

  private resolvePayoutRecordStatus(record: PayoutRecord): FundTruthReconciliationStatus {
    if (!record.approvalRequestId || !record.approvalRequest) {
      return 'missing_link';
    }
    if (record.approvalRequest.currentStatus !== ApprovalStatus.APPROVED) {
      return 'needs_manual_review';
    }
    return 'partially_aligned';
  }

  private buildPayoutRecordSummary(record: PayoutRecord, approvalRequest: ApprovalRequest | null) {
    if (!approvalRequest) {
      return `付款记录 ${record.payoutNo} 当前缺少稳定审批链；它只是孤立的付款登记留痕。`;
    }
    return `付款记录 ${record.payoutNo} 当前只说明仓库里登记过一笔付款，并挂到了审批单 ${approvalRequest.approvalNo}；它仍然不是银行真相源。`;
  }

  private buildPayoutRecordListSummary(
    approvalRequest: ApprovalRequest | null,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return '先补齐审批链，再判断这条付款登记是否可信。';
    }
    if (approvalRequest?.currentStatus === ApprovalStatus.APPROVED) {
      return '当前有付款登记，但仍缺真实出款主对象。';
    }
    return '付款登记存在，但审批链与真实出款边界仍需人工复核。';
  }

  private buildPayoutRecordGapSummary(
    record: PayoutRecord,
    approvalRequest: ApprovalRequest | null,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return `付款记录 ${record.payoutNo} 缺少稳定审批链，当前只能视作待核对的业务登记对象。`;
    }
    if (approvalRequest?.currentStatus !== ApprovalStatus.APPROVED) {
      return '当前付款登记没有稳固站在“审批已过”的边界上，仍需人工确认它为什么已经存在。';
    }
    return '当前只有业务付款登记，仍缺银行流水、出款回单或账户级对账主对象。';
  }

  private resolvePayoutRecordNextOwner(
    approvalRequest: ApprovalRequest | null,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return 'admin_data_review';
    }
    if (approvalRequest?.currentStatus === ApprovalStatus.APPROVED) {
      return 'finance_audit';
    }
    return 'approver_or_admin';
  }

  private buildPayoutRecordNextStep(
    approvalRequest: ApprovalRequest | null,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return '先补齐审批链和业务上下文，再判断这条付款登记是否应该保留。';
    }
    if (approvalRequest?.currentStatus === ApprovalStatus.APPROVED) {
      return '继续人工核对 payout_records 登记与真实出款凭证，明确它只是付款登记，不是银行主账。';
    }
    return '先核对为什么在审批未稳定闭合前就出现了付款登记，避免把薄 CRUD 对象误用为资金真相。';
  }

  private buildAbcSyncFundView(
    fund: AbcSyncFund,
    visibilityScope: FundTruthVisibilityScope,
    includeDetail: boolean,
  ): FundTruthReconciliationViewModel {
    void includeDetail;
    const reconciliationStatus = this.resolveAbcSyncFundStatus(fund);
    const sourceRole: FundTruthSourceRole = 'sync_replica';
    const currentBasis = `当前依据来自 abc_sync_funds.source_table=${fund.sourceTable} / source_id=${fund.sourceId} / status_standard=${fund.statusStandard ?? '-'} / amount_standard=${fund.amountStandard ?? '-'} 的标准化同步快照。`;
    const currentArrivalBasis =
      fund.directionStandard === 'in' || fund.directionStandard === 'inbound'
        ? `${currentBasis} 它只说明 ABC 同步副本里的入账快照，不代表银行主账。`
        : currentBasis;
    const currentPayoutBasis =
      fund.directionStandard === 'out' || fund.directionStandard === 'outbound'
        ? `${currentBasis} 它只说明 ABC 同步副本里的出账快照，不代表银行主账。`
        : currentBasis;
    const currentApprovalBasis =
      'abc_sync_funds 不承担审批依据；它更像同步标准化副本，而不是审批或银行真相主对象。';
    const sourceOfTruthBoundary =
      'abc_sync_funds 是标准化同步副本：它把 ABC 原始资金类数据整理成统一字段，但不是银行主账，也不能自动等同于 payment_records / payout_records。';
    const gapSummary = this.buildAbcSyncFundGapSummary(fund, reconciliationStatus);
    const nextOwnerRole = this.resolveAbcSyncFundNextOwner(fund, reconciliationStatus);
    const recommendedNextStep = this.buildAbcSyncFundNextStep(fund, reconciliationStatus);
    const summary = this.buildAbcSyncFundSummary(fund, reconciliationStatus);
    const listSummary = this.buildAbcSyncFundListSummary(fund, reconciliationStatus);
    const auditHints = [
      `当前同步副本来源 ${fund.sourceTable}/${fund.sourceId}，应先确认它描述的是哪一类资金事件，再决定是否能挂到业务对象。`,
      'abc_sync_funds 只保留标准化同步结果，不能直接替代银行流水、银行回单或账户侧对账。',
      fund.mappingConfirmed
        ? '当前映射已标记 confirmed，但仍不代表已经形成银行真相源。'
        : '当前映射尚未 confirmed，任何业务关联都应保留人工确认边界。',
    ];
    const basicInfo = this.buildBasicInfo([
      this.textItem('sourceTable', '来源表', fund.sourceTable),
      this.textItem('sourceId', '来源ID', fund.sourceId),
      this.textItem('sourceOrderNo', '来源单号', fund.sourceOrderNo ?? '-'),
      this.textItem('relatedOrderNo', '关联单号', fund.relatedOrderNo ?? '-'),
      this.textItem('statusStandard', '标准状态', fund.statusStandard ?? fund.statusRaw ?? '-'),
      this.textItem('directionStandard', '资金方向', fund.directionStandard ?? '-'),
      this.moneyItem('amountStandard', '标准金额', fund.amountStandard ?? null),
      this.textItem('mappingConfirmed', '映射确认', fund.mappingConfirmed ? 'true' : 'false'),
      this.textItem(
        'mappingNotes',
        '映射备注',
        visibilityScope === 'full'
          ? fund.mappingNotes ?? '-'
          : this.compactText(fund.mappingNotes),
        2,
      ),
      this.textItem(
        'sourceMerchantId',
        '来源商户',
        visibilityScope === 'full'
          ? fund.sourceMerchantId ?? '-'
          : this.maskValue(fund.sourceMerchantId) ?? '-',
      ),
      this.dateTimeItem('sourceUpdatedAt', '来源更新时间', fund.sourceUpdatedAt),
      this.dateTimeItem('syncedAt', '同步时间', fund.syncedAt),
    ]);
    const linkedObjectRefs = {
      approvalRequestId: null,
      paymentRecordId: null,
      payoutRecordId: null,
      abcSyncFundId: fund.id,
      workOrderId: null,
    };
    const mappingReadiness = this.buildMappingReadiness({
      visibilityScope,
      mappingReadinessStatus:
        fund.mappingConfirmed || fund.relatedOrderNo || fund.sourceOrderNo
          ? 'weak_anchor_only'
          : 'not_ready',
      stableMappingKeys: [
        this.mappingKeyItem(
          'abc_sync_fund_id',
          '同步副本主键',
          fund.id,
          'abc_sync_funds.id',
          '这是同步副本对象自身的稳定主键，只适合仓内只读对照。',
        ),
        this.mappingKeyItem(
          'source_object_key',
          '源对象复合键',
          `${fund.sourceSystem}/${fund.sourceTable}/${fund.sourceId}`,
          'abc_sync_funds.source_system + source_table + source_id',
          'sourceSystem/sourceTable/sourceId 组合是当前副本侧最稳定的源对象标识。',
        ),
        this.mappingKeyItem(
          'raw_record_key',
          '原始记录复合键',
          `${fund.rawTableName}/${fund.rawRecordId}`,
          'abc_sync_funds.raw_table_name + raw_record_id',
          'raw_table_name/raw_record_id 可回指同步前的原始记录，但仍只是副本锚点。',
        ),
        this.mappingKeyItem(
          'source_order_no',
          '源单号',
          fund.sourceOrderNo ?? null,
          'abc_sync_funds.source_order_no',
          '源单号只在当前 source_table 作用域内可复用，不能直接等同银行真相源键。',
        ),
      ],
      weakMatchingHints: [
        this.mappingKeyItem(
          'related_order_no',
          '关联单号',
          fund.relatedOrderNo ?? null,
          'abc_sync_funds.related_order_no',
          '关联单号目前只是同步侧线索，不能自动推出稳定业务桥。',
        ),
        this.mappingKeyItem(
          'amount_standard',
          '标准金额',
          fund.amountStandard ?? null,
          'abc_sync_funds.amount_standard',
          '金额标准化结果只能作弱匹配线索，不能替代稳定映射键。',
        ),
        this.mappingKeyItem(
          'direction_standard',
          '资金方向',
          fund.directionStandard ?? null,
          'abc_sync_funds.direction_standard',
          '资金方向只说明副本语义，不足以确定真实资金主链。',
        ),
        this.mappingKeyItem(
          'status_standard',
          '标准状态',
          fund.statusStandard ?? fund.statusRaw ?? null,
          'abc_sync_funds.status_standard',
          '标准状态只能补充说明同步结果，不能当成真相锚点。',
        ),
        this.mappingKeyItem(
          'source_merchant_id',
          '源商户',
          visibilityScope === 'full'
            ? fund.sourceMerchantId ?? null
            : this.maskValue(fund.sourceMerchantId) ?? null,
          'abc_sync_funds.source_merchant_id',
          '源商户字段仍是同步副本上下文，restricted 视图保持收口。',
        ),
      ],
      missingAnchors: [
        this.missingAnchorItem(
          'business_primary_mapping',
          '稳定业务主键映射',
          'abc_sync_funds 当前还没有能稳定挂到 approval_requests / payment_records / payout_records 的主键映射层。',
          'data_governance',
        ),
        this.missingAnchorItem(
          'bank_truth_reference',
          '银行流水号 / 回单号',
          '同步副本当前没有银行流水号、回单号或账户侧对账编号，不能直接接入未来银行真相源。',
          'finance_data_review',
        ),
        this.missingAnchorItem(
          'cross_table_unified_business_no',
          '统一业务编号',
          '不同 source_table 之间还缺统一业务编号，未来银行真相进来前必须先把跨表桥接键收口清楚。',
          'data_governance',
        ),
      ],
      anchorConfidence: 'low',
      anchorPlanSummary:
        '先把 sourceSystem/sourceTable/sourceId 作为副本侧唯一主锚，再人工补齐到 approval/payment/payout 的业务桥，最后才谈银行真相接入。',
      recommendedAnchorPlan:
        '推荐继续把 abc_sync_funds.source_system + source_table + source_id 作为同步副本主锚；未来银行真相源接入前，先由数据治理补“副本 -> paymentNo / payoutNo / approvalNo”的只读桥，再由财务追加银行流水号或回单号。',
      mappingEvidence: [
        'abc_sync_funds.source_system + source_table + source_id 共同定义同步来源对象。',
        'abc_sync_funds.raw_table_name + raw_record_id 能回指原始同步记录。',
        'abc_sync_funds.mapping_confirmed 只说明副本映射被确认，不等于银行真相已建立。',
      ],
      futureTruthIngestionBoundary:
        '未来银行真相源不能直接挂在 abc_sync_funds 本体上，只能作为“银行流水号/回单号 -> 副本侧稳定业务桥”的新增只读对照层接入；当前继续保持 replica_only，不写库、不自动闭环。',
    });
    const truthGapPlan = this.buildTruthGapPlan({
      visibilityScope,
      summary,
      listSummary,
      sourceRole,
      truthLevel: 'replica_only',
      reconciliationStatus,
      currentArrivalBasis,
      currentPayoutBasis,
      currentApprovalBasis,
      gapSummary,
      nextOwnerRole,
      recommendedNextStep,
      sourceOfTruthBoundary,
      actionItems: [
        this.actionItem(
          'review_sync_boundary',
          '确认同步副本边界',
          '先确认 abc_sync_funds 只是标准化同步副本，不是银行主账。',
          'shared_manual_review',
          'done',
        ),
        this.actionItem(
          'fill_mapping_gap',
          '补齐业务映射缺口',
          recommendedNextStep,
          nextOwnerRole,
          fund.mappingConfirmed ? 'pending' : 'ready',
        ),
      ],
      auditHints,
    });

    return {
      recordKey: `abc_sync_fund:${fund.id}`,
      visibilityScope,
      sourceRole,
      truthLevel: 'replica_only',
      reconciliationStatus,
      primaryObjectType: 'abc_sync_fund',
      primaryObjectId: fund.id,
      primaryObjectNo: fund.sourceOrderNo ?? fund.sourceId ?? this.asDisplayId(fund.id),
      primaryObjectStatus: fund.statusStandard ?? fund.statusRaw,
      summary,
      listSummary,
      linkedObjectRefs,
      linkedObjectList: [],
      currentArrivalBasis,
      currentPayoutBasis,
      currentApprovalBasis,
      sourceOfTruthBoundary,
      gapSummary,
      nextOwnerRole,
      recommendedNextStep,
      mappingReadinessStatus: mappingReadiness.mappingReadinessStatus,
      anchorPlanSummary: mappingReadiness.anchorPlanSummary,
      mappingReadiness,
      auditHints,
      basicInfo,
      truthGapPlan,
      sortTime: fund.sourceUpdatedAt ?? fund.syncedAt ?? fund.updatedAt,
      createdAt: fund.createdAt,
      updatedAt: fund.updatedAt,
    };
  }

  private buildTruthGapPlan(input: {
    visibilityScope: FundTruthVisibilityScope;
    summary: string;
    listSummary: string;
    sourceRole: FundTruthSourceRole;
    truthLevel: 'supporting_source' | 'not_truth_source' | 'replica_only';
    reconciliationStatus: FundTruthReconciliationStatus;
    currentArrivalBasis: string | null;
    currentPayoutBasis: string | null;
    currentApprovalBasis: string | null;
    gapSummary: string;
    nextOwnerRole: string;
    recommendedNextStep: string;
    sourceOfTruthBoundary: string;
    actionItems: FundTruthActionItem[];
    auditHints: string[];
  }): FundTruthGapPlan {
    return {
      visibilityScope: input.visibilityScope,
      summary: input.summary,
      listSummary: input.listSummary,
      diagnosis: {
        sourceRole: input.sourceRole,
        truthLevel: input.truthLevel,
        reconciliationStatus: input.reconciliationStatus,
        currentArrivalBasis: input.currentArrivalBasis,
        currentPayoutBasis: input.currentPayoutBasis,
        currentApprovalBasis: input.currentApprovalBasis,
        gapSummary: input.gapSummary,
        nextOwnerRole: input.nextOwnerRole,
        recommendedNextStep: input.recommendedNextStep,
      },
      boundary: {
        sourceOfTruthBoundary: input.sourceOfTruthBoundary,
        humanConfirmationBoundary:
          '本 pilot 只做只读对照，不跳过人工确认层；员工绑定、审批、到账、付款与 AI 执行边界都保持人工入口。',
        payrollBoundary:
          '本 pilot 不改工资公式，不推进正式工资，也不改变 confirmed / inferred / uncertain 与 included / pending / excluded 分层。',
        writeBoundary:
          '本 pilot 不新增写入逻辑、不扩命令壳、不引入银行流水落库，也不改数据库 schema。',
      },
      actionItems: input.actionItems,
      auditHints: input.auditHints,
    };
  }

  private resolveAbcSyncFundStatus(fund: AbcSyncFund): FundTruthReconciliationStatus {
    if (!fund.mappingConfirmed && !fund.relatedOrderNo && !fund.sourceOrderNo) {
      return 'missing_link';
    }
    if (!fund.mappingConfirmed) {
      return 'needs_manual_review';
    }
    return 'partially_aligned';
  }

  private buildAbcSyncFundSummary(
    fund: AbcSyncFund,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return `同步资金 ${fund.sourceTable}/${fund.sourceId} 目前只有标准化快照，尚未形成稳定业务映射。`;
    }
    if (!fund.mappingConfirmed) {
      return `同步资金 ${fund.sourceTable}/${fund.sourceId} 已被整理进 abc_sync_funds，但映射仍待人工确认；它仍只是同步副本。`;
    }
    return `同步资金 ${fund.sourceTable}/${fund.sourceId} 已形成标准化副本，但它仍不是银行主账，只能作为对照补充来源。`;
  }

  private buildAbcSyncFundListSummary(
    fund: AbcSyncFund,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    void fund;
    if (reconciliationStatus === 'missing_link') {
      return '先补稳定映射，再谈业务对照。';
    }
    if (reconciliationStatus === 'needs_manual_review') {
      return '当前只是待确认同步副本，不能直接挂成资金真相。';
    }
    return '已是稳定同步副本，但仍不是银行主账。';
  }

  private buildAbcSyncFundGapSummary(
    fund: AbcSyncFund,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    if (reconciliationStatus === 'missing_link') {
      return '当前同步副本没有稳定业务映射，也没有银行主账边界，无法直接归到审批/到账/付款真相。';
    }
    if (!fund.mappingConfirmed) {
      return '当前同步副本虽然有标准化字段，但映射仍未 confirmed，稳定映射键尚未成立，任何业务归属都应保留人工确认边界。';
    }
    return '当前同步副本已较稳定，但仍缺银行主账、银行回单，以及和 payment_records / payout_records 的稳定主键映射。';
  }

  private resolveAbcSyncFundNextOwner(
    fund: AbcSyncFund,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    void fund;
    if (reconciliationStatus === 'missing_link') {
      return 'data_governance';
    }
    if (reconciliationStatus === 'needs_manual_review') {
      return 'finance_data_review';
    }
    return 'finance_audit';
  }

  private buildAbcSyncFundNextStep(
    fund: AbcSyncFund,
    reconciliationStatus: FundTruthReconciliationStatus,
  ) {
    void fund;
    if (reconciliationStatus === 'missing_link') {
      return '先补稳定映射主键或业务挂接规则，再判断它能否参与资金只读对照。';
    }
    if (reconciliationStatus === 'needs_manual_review') {
      return '继续人工确认这条同步副本对应的真实业务对象，但不要把 confirmed 映射误读成银行真相源。';
    }
    return '把它继续作为同步副本使用，并补充与业务对象的只读对照说明；不要误报成银行主账。';
  }

  private resolveVisibilityScope(currentUser: CurrentUser): FundTruthVisibilityScope {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    return roleCodes.has('admin') || roleCodes.has('founder') || roleCodes.has('super_admin')
      ? 'full'
      : 'restricted';
  }

  private sortByDate<T>(items: T[], dateSelector: (item: T) => Date | null | undefined) {
    return items.sort((left, right) => {
      const leftDate = dateSelector(left);
      const rightDate = dateSelector(right);
      const leftTime = leftDate ? new Date(leftDate).getTime() : 0;
      const rightTime = rightDate ? new Date(rightDate).getTime() : 0;
      return leftTime - rightTime;
    });
  }

  private textItem(
    key: string,
    label: string,
    value: string | number | null | undefined,
    span = 1,
  ): FundTruthBasicInfoItem {
    return {
      key,
      label,
      value: value ?? null,
      valueType: 'text',
      span,
    };
  }

  private moneyItem(
    key: string,
    label: string,
    value: string | number | null | undefined,
    span = 1,
  ): FundTruthBasicInfoItem {
    return {
      key,
      label,
      value: value ?? null,
      valueType: 'money',
      span,
    };
  }

  private dateTimeItem(
    key: string,
    label: string,
    value: Date | null | undefined,
    span = 1,
  ): FundTruthBasicInfoItem {
    return {
      key,
      label,
      value: value ?? null,
      valueType: 'datetime',
      span,
    };
  }

  private buildBasicInfo(items: FundTruthBasicInfoItem[]) {
    return items.filter(Boolean);
  }

  private actionItem(
    actionKey: string,
    title: string,
    description: string,
    ownerScope: string,
    status: FundTruthActionItem['status'],
  ): FundTruthActionItem {
    return {
      actionKey,
      title,
      description,
      ownerScope,
      status,
    };
  }

  private buildMappingReadiness(input: {
    visibilityScope: FundTruthVisibilityScope;
    mappingReadinessStatus: FundTruthMappingReadinessStatus;
    stableMappingKeys: Array<FundTruthMappingKeyItem | null>;
    weakMatchingHints: Array<FundTruthMappingKeyItem | null>;
    missingAnchors: Array<FundTruthMissingAnchorItem | null>;
    anchorConfidence: FundTruthAnchorConfidence;
    anchorPlanSummary: string;
    recommendedAnchorPlan: string;
    mappingEvidence: Array<string | null | undefined>;
    futureTruthIngestionBoundary: string;
  }): FundTruthMappingReadiness {
    const stableMappingKeys = input.stableMappingKeys.filter(
      (item): item is FundTruthMappingKeyItem => Boolean(item),
    );
    const weakMatchingHints = input.weakMatchingHints.filter(
      (item): item is FundTruthMappingKeyItem => Boolean(item),
    );
    const missingAnchors = input.missingAnchors.filter(
      (item): item is FundTruthMissingAnchorItem => Boolean(item),
    );
    const mappingEvidence = input.mappingEvidence.filter(
      (item): item is string => Boolean(item && item.trim()),
    );
    const isFullView = input.visibilityScope === 'full';

    return {
      visibilityScope: input.visibilityScope,
      mappingReadinessStatus: input.mappingReadinessStatus,
      stableMappingKeys: isFullView
        ? stableMappingKeys
        : this.buildRestrictedMappingKeys(stableMappingKeys),
      weakMatchingHints: isFullView
        ? weakMatchingHints
        : this.buildRestrictedMappingKeys(weakMatchingHints),
      missingAnchors,
      anchorConfidence: input.anchorConfidence,
      anchorPlanSummary: input.anchorPlanSummary,
      recommendedAnchorPlan: input.recommendedAnchorPlan,
      mappingEvidence: isFullView
        ? mappingEvidence
        : this.buildRestrictedMappingEvidence({
            stableCount: stableMappingKeys.length,
            weakCount: weakMatchingHints.length,
            missingCount: missingAnchors.length,
            mappingReadinessStatus: input.mappingReadinessStatus,
          }),
      futureTruthIngestionBoundary: input.futureTruthIngestionBoundary,
    };
  }

  private buildRestrictedMappingKeys(items: FundTruthMappingKeyItem[]) {
    return items.map((item) => ({
      ...item,
      sourceField: '收口隐藏',
    }));
  }

  private buildRestrictedMappingEvidence(input: {
    stableCount: number;
    weakCount: number;
    missingCount: number;
    mappingReadinessStatus: FundTruthMappingReadinessStatus;
  }) {
    return [
      `当前已识别 ${input.stableCount} 个仓内稳定锚点，可支撑只读映射准备度评估。`,
      `当前保留 ${input.weakCount} 类弱匹配线索，仅供人工核对，不返回原始 sourceField 或底层字段证据。`,
      `当前仍缺 ${input.missingCount} 类关键锚点，因此准备度继续停留在 ${this.describeMappingReadinessStatus(input.mappingReadinessStatus)}，暂不具备直接接入银行真相源的条件。`,
    ];
  }

  private describeMappingReadinessStatus(status: FundTruthMappingReadinessStatus) {
    switch (status) {
      case 'ready':
        return 'ready';
      case 'partially_ready':
        return 'partially_ready';
      case 'weak_anchor_only':
        return 'weak_anchor_only';
      case 'not_ready':
        return 'not_ready';
      default:
        return status;
    }
  }

  private mappingKeyItem(
    key: string,
    label: string,
    value: string | number | null | undefined,
    sourceField: string,
    note: string,
  ): FundTruthMappingKeyItem | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return {
      key,
      label,
      value,
      sourceField,
      note,
    };
  }

  private missingAnchorItem(
    key: string,
    label: string,
    description: string,
    ownerScope: string,
  ): FundTruthMissingAnchorItem {
    return {
      key,
      label,
      description,
      ownerScope,
    };
  }

  private linkedItem(
    label: string,
    objectType: FundTruthLinkedObjectItem['objectType'],
    objectId: number | null,
    displayValue: string | null,
    note?: string | null,
  ): FundTruthLinkedObjectItem | null {
    if (!objectId) {
      return null;
    }

    return {
      label,
      objectType,
      objectId,
      displayValue: displayValue ?? this.asDisplayId(objectId),
      note: note ?? null,
    };
  }

  private compactLinkedItems(items: Array<FundTruthLinkedObjectItem | null>) {
    return items.filter((item): item is FundTruthLinkedObjectItem => Boolean(item));
  }

  private compactText(value: string | null | undefined, maxLength = 48) {
    if (!value) {
      return '-';
    }
    if (value.length <= maxLength) {
      return value;
    }
    return `${value.slice(0, maxLength)}...`;
  }

  private maskValue(value: string | null | undefined) {
    if (!value) {
      return null;
    }
    if (value.length <= 2) {
      return `${value.slice(0, 1)}*`;
    }
    return `${value.slice(0, 1)}***${value.slice(-1)}`;
  }

  private asDisplayId(value: number | null | undefined) {
    return value ? `#${value}` : '-';
  }

  private formatLocalDateTime(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
}
