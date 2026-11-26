import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { getPagination, PaginationQuery } from '../../common/utils/pagination.util';
import { ApprovalStatus } from '../../shared/enums/approval-status.enum';
import { ApprovalType } from '../../shared/enums/approval-type.enum';
import { InventoryAdjustmentAction } from '../../shared/enums/inventory-adjustment-action.enum';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { PayoutRecord } from '../payout-records/entities/payout-record.entity';
import { SequenceService } from '../sequence/sequence.service';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { ApproveApprovalRequestDto } from './dto/approve-approval-request.dto';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';
import { RejectApprovalRequestDto } from './dto/reject-approval-request.dto';
import { createPendingApprovalRequest } from './approval-request-pending.factory';
import {
  assertSubmittedApprovalDraftActorChain,
  assertSubmittedApprovalDraftEvidenceCurrent,
} from './approval-request-drafts.service';
import { ApprovalLog } from './entities/approval-log.entity';
import { ApprovalRequest } from './entities/approval-request.entity';
import { ApprovalRequestDraft } from './entities/approval-request-draft.entity';

export type ApprovalCommandBlockedReason =
  | 'approval_not_pending'
  | 'linked_context_missing'
  | 'payout_already_executed'
  | 'self_approval_forbidden'
  | 'actor_not_allowed';

export type ApprovalCommandBlockedStage =
  | 'approval_status'
  | 'linked_business_context'
  | 'payout_execution'
  | 'role_permission';

export type ApprovalCommandCheckResult = 'pass' | 'warn' | 'fail';
export type ApprovalCommandPrecheckStatus = 'pass' | 'warn' | 'fail';
export type ApprovalHandlingPlanVisibility = 'full' | 'restricted';

export interface ApprovalCommandCheck {
  checkKey: string;
  checkName: string;
  checkResult: ApprovalCommandCheckResult;
  checkReason: string;
}

export interface ApprovalCommandPrecheckResult {
  precheckStatus: ApprovalCommandPrecheckStatus;
  checks: ApprovalCommandCheck[];
  canExecute: boolean;
  blockedReason: ApprovalCommandBlockedReason | null;
  blockedStage: ApprovalCommandBlockedStage | null;
  remediationSuggestions: string[];
  verificationCodeStatus: string;
  approvalStatusAllowsExecute: boolean;
  linkedBusinessContextPresent: boolean;
  linkedPayoutState: string;
  actorAllowed: boolean;
}

export interface ApprovalHandlingPlanActionItem {
  actionKey: string;
  title: string;
  description: string;
  ownerScope: string;
  status: 'pending' | 'ready' | 'blocked' | 'done' | 'not_applicable';
}

@Injectable()
export class ApprovalRequestsService {
  constructor(
    @InjectRepository(ApprovalRequest)
    private readonly approvalRequestRepository: Repository<ApprovalRequest>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async create(dto: CreateApprovalRequestDto, currentUser: CurrentUser) {
    this.assertLegacyApprovalCreateAllowed(currentUser);
    return this.dataSource.transaction((manager) =>
      createPendingApprovalRequest({
        manager,
        input: dto,
        currentUser,
        sequenceService: this.sequenceService,
        operationLogsService: this.operationLogsService,
      }),
    );
  }

  async findAll(query: PaginationQuery, currentUser: CurrentUser) {
    this.assertApprovalReadAllowed(currentUser);
    const { skip, take, page, pageSize } = getPagination(query);
    const [list, total] = await this.approvalRequestRepository.findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip,
      take,
      relations: {
        applicantUser: true,
        finalApprover: true,
        relatedWorkOrder: {
          responsibleUser: true,
          createdByUser: true,
          paymentRecords: {
            createdByUser: true,
          },
        },
        relatedInventoryTransaction: true,
        payoutRecords: {
          createdByUser: true,
        },
        approvalLogs: {
          actionByUser: true,
        },
      },
    });
    const sourceDraftsByApprovalId = await this.loadLinkedDraftMapReadonly(
      list.map((item) => item.id),
    );

    return {
      list: list.map((item) =>
        this.buildApprovalCommandView(
          item,
          currentUser,
          false,
          sourceDraftsByApprovalId.get(item.id) ?? null,
        ),
      ),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: number, currentUser: CurrentUser) {
    this.assertApprovalReadAllowed(currentUser);
    const request = await this.loadApprovalRequestOrThrow(id);
    const sourceDraft = this.canViewLinkedDraftEvidence(currentUser)
      ? await this.loadSingleLinkedDraftReadonly(id)
      : null;
    return this.buildApprovalCommandView(request, currentUser, true, sourceDraft);
  }

  async getPrecheck(id: number, currentUser: CurrentUser) {
    this.assertApprovalReadAllowed(currentUser);
    const request = await this.loadApprovalRequestOrThrow(id);
    const sourceDraft = await this.loadSingleLinkedDraftReadonly(id);
    return this.buildPrecheckResult(request, currentUser, sourceDraft);
  }

  async approve(id: number, dto: ApproveApprovalRequestDto, currentUser: CurrentUser) {
    this.assertApprovalExecutorRole(currentUser);
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(ApprovalRequest);
      const logRepo = manager.getRepository(ApprovalLog);
      const request = await requestRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException('审批记录不存在');
      }
      this.assertApprovalDecisionAllowed(request, currentUser, false);

      const sourceDraft = await this.lockSingleLinkedDraft(manager, request.id);
      if (sourceDraft) {
        assertSubmittedApprovalDraftActorChain(sourceDraft, request, currentUser.id);
        await assertSubmittedApprovalDraftEvidenceCurrent(manager, sourceDraft, request);
      }
      const payoutRecords = await manager.getRepository(PayoutRecord).find({
        where: { approvalRequestId: request.id },
        lock: { mode: 'pessimistic_read' },
      });
      this.assertApprovalDecisionAllowed(request, currentUser, payoutRecords.length > 0);

      request.currentStatus = ApprovalStatus.APPROVED;
      request.finalApproverId = currentUser.id;
      const saved = await requestRepo.save(request);

      await logRepo.save(
        logRepo.create({
          approvalRequestId: saved.id,
          actionBy: currentUser.id,
          actionType: 'approved',
          actionRemark: dto.remark ?? null,
        }),
      );

      await this.operationLogsService.create(
        {
          module: 'approval_request',
          targetId: saved.id,
          action: OperationLogAction.APPROVE_APPROVAL,
          operatorId: currentUser.id,
          detail: `审批通过 ${saved.approvalNo}`,
        },
        manager,
      );

      return saved;
    });
  }

  async reject(id: number, dto: RejectApprovalRequestDto, currentUser: CurrentUser) {
    this.assertApprovalExecutorRole(currentUser);
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(ApprovalRequest);
      const logRepo = manager.getRepository(ApprovalLog);
      const request = await requestRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException('审批记录不存在');
      }
      this.assertApprovalDecisionAllowed(request, currentUser, false);

      const sourceDraft = await this.lockSingleLinkedDraft(manager, request.id);
      if (sourceDraft) {
        assertSubmittedApprovalDraftActorChain(sourceDraft, request, currentUser.id);
      }

      const payoutRecords = await manager.getRepository(PayoutRecord).find({
        where: { approvalRequestId: request.id },
        lock: { mode: 'pessimistic_read' },
      });
      this.assertApprovalDecisionAllowed(request, currentUser, payoutRecords.length > 0);

      request.currentStatus = ApprovalStatus.REJECTED;
      request.finalApproverId = currentUser.id;
      const saved = await requestRepo.save(request);

      await logRepo.save(
        logRepo.create({
          approvalRequestId: saved.id,
          actionBy: currentUser.id,
          actionType: 'rejected',
          actionRemark: dto.remark,
        }),
      );

      await this.operationLogsService.create(
        {
          module: 'approval_request',
          targetId: saved.id,
          action: OperationLogAction.REJECT_APPROVAL,
          operatorId: currentUser.id,
          detail: `审批驳回 ${saved.approvalNo}`,
        },
        manager,
      );

      return saved;
    });
  }

  private assertLegacyApprovalCreateAllowed(currentUser: CurrentUser) {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    if (!roleCodes.has('admin')) {
      throw new ForbiddenException(
        '[approval_role_forbidden] 旧版直接创建审批单仅限管理员使用，请优先使用证据草稿提交链',
      );
    }
  }

  private assertApprovalReadAllowed(currentUser: CurrentUser) {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    if (
      !roleCodes.has('finance') &&
      !roleCodes.has('approver') &&
      !roleCodes.has('admin')
    ) {
      throw new ForbiddenException('[approval_role_forbidden] 当前角色不能查看审批单');
    }
  }

  private assertApprovalExecutorRole(currentUser: CurrentUser) {
    if (!this.canCurrentUserExecuteApproval(currentUser)) {
      throw new ForbiddenException('[approval_role_forbidden] 当前角色不能执行审批');
    }
  }

  private async loadSingleLinkedDraftReadonly(approvalRequestId: number) {
    const linkedDrafts = await this.loadLinkedDraftMapReadonly([approvalRequestId]);
    return linkedDrafts.get(approvalRequestId) ?? null;
  }

  private async loadLinkedDraftMapReadonly(approvalRequestIds: number[]) {
    if (!approvalRequestIds.length) {
      return new Map<number, ApprovalRequestDraft>();
    }
    const linkedDrafts = await this.dataSource.getRepository(ApprovalRequestDraft).find({
      where: { linkedApprovalRequestId: In(approvalRequestIds) },
      order: { id: 'ASC' },
    });
    const draftsByApprovalId = new Map<number, ApprovalRequestDraft>();
    for (const draft of linkedDrafts) {
      const approvalRequestId = draft.linkedApprovalRequestId;
      if (!approvalRequestId) {
        continue;
      }
      if (draftsByApprovalId.has(approvalRequestId)) {
        throw new BadRequestException(
          '[approval_evidence_inconsistent] 审批单关联了多份提交草稿，请人工复核',
        );
      }
      draftsByApprovalId.set(approvalRequestId, draft);
    }
    return draftsByApprovalId;
  }

  private async lockSingleLinkedDraft(manager: EntityManager, approvalRequestId: number) {
    const linkedDrafts = await manager.getRepository(ApprovalRequestDraft).find({
      where: { linkedApprovalRequestId: approvalRequestId },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (linkedDrafts.length > 1) {
      throw new BadRequestException(
        '[approval_evidence_inconsistent] 审批单关联了多份提交草稿，禁止执行并请人工复核',
      );
    }
    return linkedDrafts[0] ?? null;
  }

  private async loadApprovalRequestOrThrow(id: number) {
    const request = await this.approvalRequestRepository.findOne({
      where: { id },
      relations: {
        applicantUser: true,
        finalApprover: true,
        relatedWorkOrder: {
          responsibleUser: true,
          createdByUser: true,
          paymentRecords: {
            createdByUser: true,
          },
        },
        relatedInventoryTransaction: true,
        payoutRecords: {
          createdByUser: true,
        },
        approvalLogs: {
          actionByUser: true,
        },
      },
    });

    if (!request) {
      throw new NotFoundException('审批记录不存在');
    }

    return request;
  }

  private buildApprovalCommandView(
    request: ApprovalRequest,
    currentUser: CurrentUser,
    includeDetail: boolean,
    sourceDraft: ApprovalRequestDraft | null = null,
  ) {
    const visibilityScope = this.resolveVisibilityScope(currentUser);
    const precheck = this.buildPrecheckResult(request, currentUser, sourceDraft);
    const approvalLogs = [...(request.approvalLogs ?? [])].sort(
      (left, right) =>
        new Date(left.actionAt).getTime() - new Date(right.actionAt).getTime() || left.id - right.id,
    );
    const payoutRecords = [...(request.payoutRecords ?? [])].sort(
      (left, right) =>
        new Date(left.paidAt).getTime() - new Date(right.paidAt).getTime() || left.id - right.id,
    );
    const paymentRecords = [...(request.relatedWorkOrder?.paymentRecords ?? [])].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || left.id - right.id,
    );
    const approvedLog = [...approvalLogs].reverse().find((item) => item.actionType === 'approved');
    const rejectedLog = [...approvalLogs].reverse().find((item) => item.actionType === 'rejected');
    const latestPayout = payoutRecords.length ? payoutRecords[payoutRecords.length - 1] : null;
    const latestPayment = paymentRecords.length ? paymentRecords[paymentRecords.length - 1] : null;
    const verificationCodeValue =
      visibilityScope === 'full'
        ? request.verificationCode
        : this.maskSensitiveValue(request.verificationCode);
    const verificationCodeRoleText = request.verificationCode
      ? '验证码当前只进入 precheck / handlingPlan / 解释链，仍不是 approve / reject 的强阻断条件。'
      : '当前审批单未填写验证码，本轮仍按人工审批与日志留痕处理。';
    const linkedBusinessContext = this.buildLinkedBusinessContext(
      request,
      visibilityScope,
      paymentRecords,
    );
    const linkedPayout = this.buildLinkedPayoutContext(payoutRecords, visibilityScope);
    const executionTrace = this.buildExecutionTrace(
      request,
      precheck,
      paymentRecords,
      payoutRecords,
      approvedLog,
      rejectedLog,
    );
    const auditTrail = this.buildAuditTrail(request, paymentRecords, payoutRecords, visibilityScope);
    const visibleExecutionTrace =
      visibilityScope === 'full'
        ? executionTrace
        : {
            currentStatus: executionTrace.currentStatus,
            latestApprovalAction: executionTrace.latestApprovalAction,
            canExecute: executionTrace.canExecute,
            verificationCodeRole: executionTrace.verificationCodeRole,
            latestPaymentNo: null,
            latestPaymentAt: null,
            latestPayoutNo: null,
            latestPayoutAt: null,
          };
    const visibleAuditTrail = visibilityScope === 'full' ? auditTrail : [];
    const handlingPlan = this.buildHandlingPlan(
      request,
      precheck,
      visibilityScope,
      verificationCodeRoleText,
      linkedBusinessContext,
      latestPayout,
    );
    const explanation = this.buildCommandExplanation(
      request,
      precheck,
      handlingPlan.summary,
      verificationCodeRoleText,
      latestPayment,
      latestPayout,
    );
    const suggestedNextStep =
      handlingPlan.diagnosis.suggestedNextStep ??
      this.buildSuggestedNextStep(request, precheck, latestPayout);

    const basePayload = {
      id: request.id,
      approvalNo: request.approvalNo,
      approvalType: request.approvalType,
      currentStatus: request.currentStatus,
      status: request.currentStatus,
      relatedWorkOrderId: request.relatedWorkOrderId,
      relatedInventoryTransactionId: request.relatedInventoryTransactionId,
      inventoryAdjustmentAction: request.inventoryAdjustmentAction,
      inventoryTargetQuantity: request.inventoryTargetQuantity,
      inventoryTargetUnitPrice: request.inventoryTargetUnitPrice,
      inventoryAdjustmentExecuted: Boolean(request.executionIdempotencyKey),
      applicantUserId: request.applicantUserId,
      finalApproverId: request.finalApproverId,
      amount: request.amount,
      requestAmount: request.amount,
      reason: request.reason,
      verificationCode: verificationCodeValue,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      requester: this.mapUser(request.applicantUser),
      approver: this.mapUser(request.finalApprover),
      approvedAt: approvedLog?.actionAt ?? null,
      rejectedAt: rejectedLog?.actionAt ?? null,
      blockedReason: precheck.blockedReason,
      blockedStage: precheck.blockedStage,
      precheckStatus: precheck.precheckStatus,
      canExecute: precheck.canExecute,
      suggestedAction: handlingPlan.listSummary,
      executionCapability: this.resolveExecutionCapability(precheck, request),
      suggestedNextStep,
      handlingPlan,
      blockers: this.buildBlockers(precheck),
      commandExplanation: explanation,
      approvalPrecheck: precheck,
      linkedBusinessContext,
      linkedPayout,
      executionTrace: visibleExecutionTrace,
      auditTrail: visibleAuditTrail,
      citedKnowledge: [] as Array<Record<string, unknown>>,
      citedManualDecisions: [] as Array<Record<string, unknown>>,
      linkedDraftEvidence: includeDetail ? this.buildLinkedDraftEvidence(sourceDraft) : null,
      approval: {
        id: request.id,
        approvalNo: request.approvalNo,
        approvalType: request.approvalType,
        status: request.currentStatus,
        requestAmount: request.amount,
        reason: request.reason,
        requester: this.mapUser(request.applicantUser),
        approver: this.mapUser(request.finalApprover),
        approvedAt: approvedLog?.actionAt ?? null,
        rejectedAt: rejectedLog?.actionAt ?? null,
        verificationCode: verificationCodeValue,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      },
    };

    if (!includeDetail) {
      return basePayload;
    }

    const detailExecutionTrace =
      visibilityScope === 'full' ? executionTrace : visibleExecutionTrace;

    return {
      ...basePayload,
      executionTrace: detailExecutionTrace,
      auditTrail: visibleAuditTrail,
      logs: approvalLogs.map((item) => ({
        id: item.id,
        actionType: item.actionType,
        actionRemark:
          visibilityScope === 'full' ? item.actionRemark : this.compactRemark(item.actionRemark),
        actionAt: item.actionAt,
        actionBy: item.actionBy,
        actionByName: item.actionByUser?.realName ?? item.actionByUser?.username ?? null,
      })),
    };
  }

  private canViewLinkedDraftEvidence(currentUser: CurrentUser) {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    return roleCodes.has('finance') || roleCodes.has('approver') || roleCodes.has('admin');
  }

  private isIndependentApprovalActor(
    request: ApprovalRequest,
    currentUser: CurrentUser,
    sourceDraft: ApprovalRequestDraft | null,
  ) {
    if (!Number.isInteger(currentUser.id) || currentUser.id <= 0) {
      return false;
    }
    if (!sourceDraft) {
      return request.applicantUserId !== currentUser.id;
    }
    try {
      const actorChain = assertSubmittedApprovalDraftActorChain(sourceDraft, request);
      return (
        currentUser.id !== actorChain.creatorUserId &&
        currentUser.id !== actorChain.submitterUserId
      );
    } catch {
      return false;
    }
  }

  private buildLinkedDraftEvidence(sourceDraft: ApprovalRequestDraft | null) {
    if (!sourceDraft) {
      return null;
    }

    const snapshot = this.asSafeRecord(sourceDraft.evidenceSnapshotJson);
    const learningContext = this.asSafeRecord(sourceDraft.learningContextJson);
    const evidenceSummary = this.asSafeRecord(snapshot?.evidenceSummary);
    const submissionEvidence = this.asSafeRecord(learningContext?.submissionEvidence);

    return {
      draftId: sourceDraft.id,
      draftNo: sourceDraft.draftNo,
      draftStatus: sourceDraft.draftStatus,
      candidateRef: sourceDraft.candidateRef,
      candidateType: sourceDraft.candidateType,
      sourceSystem: sourceDraft.sourceSystem,
      sourceEntityType: sourceDraft.sourceEntityType,
      sourceRef: sourceDraft.sourceRef,
      amount: sourceDraft.amount,
      evidenceStatus: snapshot?.status ?? null,
      requiredGuards: Array.isArray(snapshot?.requiredGuards)
        ? snapshot.requiredGuards.filter((item): item is string => typeof item === 'string')
        : [],
      evidenceSummary: evidenceSummary
        ? {
            warehouse: this.asSafeRecord(evidenceSummary.warehouse),
            material: this.asSafeRecord(evidenceSummary.material),
            supplier: this.asSafeRecord(evidenceSummary.supplier),
            workOrder: this.asSafeRecord(evidenceSummary.workOrder),
            inventory: this.asSafeRecord(evidenceSummary.inventory),
            sourceEvidence: Array.isArray(evidenceSummary.sourceEvidence)
              ? evidenceSummary.sourceEvidence.filter((item) => typeof item === 'string')
              : [],
          }
        : null,
      submissionEvidence,
      boundary: {
        humanSubmitted: true,
        humanApprovalStillRequired: true,
        paymentExecuted: false,
        inventoryMutatedBySubmission: false,
        bankSmsConfirmed: false,
        virtualLedgerMutated: false,
      },
    };
  }

  private asSafeRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private buildPrecheckResult(
    request: ApprovalRequest,
    currentUser: CurrentUser,
    sourceDraft: ApprovalRequestDraft | null = null,
  ): ApprovalCommandPrecheckResult {
    const isInventoryAdjustment = request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT;
    const hasLinkedBusinessContext = this.hasApprovalTypeBusinessContext(request);
    const payoutCount = request.payoutRecords?.length ?? 0;
    const payoutAlreadyExecuted = payoutCount > 0;
    const approvalStatusAllowsExecute = request.currentStatus === ApprovalStatus.PENDING;
    const actorAllowed = this.canCurrentUserExecuteApproval(currentUser);
    const independentApprover = this.isIndependentApprovalActor(
      request,
      currentUser,
      sourceDraft,
    );
    const verificationCodeStatus = request.verificationCode
      ? 'warn:present_for_hint_only'
      : 'warn:not_provided';
    const linkedPayoutState = isInventoryAdjustment
      ? 'not_applicable'
      : payoutAlreadyExecuted
      ? 'already_executed'
      : request.currentStatus === ApprovalStatus.APPROVED
        ? 'awaiting_payout'
        : request.currentStatus === ApprovalStatus.REJECTED
          ? 'not_applicable'
          : 'not_started';

    const checks: ApprovalCommandCheck[] = [
      {
        checkKey: 'approval_status',
        checkName: '审批状态是否允许执行',
        checkResult: approvalStatusAllowsExecute ? 'pass' : 'fail',
        checkReason: approvalStatusAllowsExecute
          ? '当前审批单仍处于 pending，可继续人工 approve / reject。'
          : `当前审批单状态为 ${request.currentStatus}，本轮不再重复执行审批动作。`,
      },
      {
        checkKey: 'linked_business_context',
        checkName: '是否存在关联业务上下文',
        checkResult: hasLinkedBusinessContext ? 'pass' : 'fail',
        checkReason: hasLinkedBusinessContext
          ? isInventoryAdjustment
            ? `已关联不可变库存流水 #${request.relatedInventoryTransactionId}，可继续审核冲销/调整申请。`
            : `已关联工单 #${request.relatedWorkOrderId}，可继续参考工单与收款上下文。`
          : '当前审批单缺少与审批类型匹配的真实业务上下文。',
      },
      {
        checkKey: 'payout_state',
        checkName: '付款是否已经登记',
        checkResult: isInventoryAdjustment ? 'pass' : payoutAlreadyExecuted ? 'fail' : 'pass',
        checkReason: isInventoryAdjustment
          ? '库存修正审批不进入付款链；审批只授权后续不可变冲销/调整流水。'
          : payoutAlreadyExecuted
            ? `当前审批单已关联 ${payoutCount} 条付款记录，不应再次执行审批动作。`
            : '当前尚未登记付款记录，可以继续沿审批链处理。',
      },
      {
        checkKey: 'actor_permission',
        checkName: '当前角色是否可执行审批',
        checkResult: actorAllowed ? 'pass' : 'fail',
        checkReason: actorAllowed
          ? '当前角色具备 approve / reject 的执行权限。'
          : '当前角色仅建议查看 handlingPlan 与审计补充，不能直接执行 approve / reject。',
      },
      {
        checkKey: 'independent_approver',
        checkName: '经办、提交与审批人是否分离',
        checkResult: independentApprover ? 'pass' : 'fail',
        checkReason: independentApprover
          ? sourceDraft
            ? '当前审批人既不是草稿经办人，也不是提交人，满足三方分离要求。'
            : '当前审批人不是本单提交人，满足独立人工审批要求。'
          : sourceDraft
            ? '草稿经办人、提交人和审批人必须互不相同，并且提交身份链必须完整。'
            : '提交人不能审批自己提交的申请，必须交由另一名审批人处理。',
      },
      {
        checkKey: 'verification_code',
        checkName: '验证码提示检查',
        checkResult: 'warn',
        checkReason: request.verificationCode
          ? '审批单已填写 verificationCode，但本轮只作为提示与诊断信息，不作为强阻断规则。'
          : '当前审批单没有 verificationCode，本轮也不会因此自动阻断审批。',
      },
      {
        checkKey: 'payment_context',
        checkName: '收款上下文是否已留痕',
        checkResult: isInventoryAdjustment
          ? 'pass'
          : hasLinkedBusinessContext && (request.relatedWorkOrder?.paymentRecords?.length ?? 0) > 0
            ? 'pass'
            : 'warn',
        checkReason:
          isInventoryAdjustment
            ? '库存修正申请已绑定原始流水，不需要收款上下文。'
            : hasLinkedBusinessContext && (request.relatedWorkOrder?.paymentRecords?.length ?? 0) > 0
            ? `已关联 ${(request.relatedWorkOrder?.paymentRecords?.length ?? 0).toString()} 条收款记录，可作为审批背景。`
            : '当前未找到明确的收款留痕，本轮先提示人工复核，不把它提升成新的强阻断规则。',
      },
    ];

    const blockedReason = this.resolveBlockedReason(
      approvalStatusAllowsExecute,
      hasLinkedBusinessContext,
      isInventoryAdjustment ? false : payoutAlreadyExecuted,
      actorAllowed,
      independentApprover,
    );
    const blockedStage = this.resolveBlockedStage(blockedReason);
    const canExecute = !blockedReason;
    const precheckStatus = this.resolvePrecheckStatus(checks);
    const remediationSuggestions = this.buildRemediationSuggestions(
      request,
      blockedReason,
      actorAllowed,
      hasLinkedBusinessContext,
      isInventoryAdjustment ? false : payoutAlreadyExecuted,
    );

    return {
      precheckStatus,
      checks,
      canExecute,
      blockedReason,
      blockedStage,
      remediationSuggestions,
      verificationCodeStatus,
      approvalStatusAllowsExecute,
      linkedBusinessContextPresent: hasLinkedBusinessContext,
      linkedPayoutState,
      actorAllowed,
    };
  }

  private buildHandlingPlan(
    request: ApprovalRequest,
    precheck: ApprovalCommandPrecheckResult,
    visibilityScope: ApprovalHandlingPlanVisibility,
    verificationCodeRoleText: string,
    linkedBusinessContext: Record<string, unknown> | null,
    latestPayout: { payoutNo?: string } | null,
  ) {
    const summary = this.buildHandlingPlanSummary(request, precheck, linkedBusinessContext, latestPayout);
    const listSummary = this.buildHandlingPlanListSummary(request, precheck);
    const actionItems = this.buildHandlingPlanActionItems(request, precheck, latestPayout);

    return {
      visibilityScope,
      summary,
      listSummary,
      diagnosis: {
        blockedReason: precheck.blockedReason,
        blockedStage: precheck.blockedStage,
        precheckStatus: precheck.precheckStatus,
        canExecute: precheck.canExecute,
        suggestedNextStep: this.buildSuggestedNextStep(request, precheck, latestPayout),
        verificationCodeRole: verificationCodeRoleText,
      },
      boundary: {
        executionBoundary:
          request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT
            ? '本审批只授权后续不可变库存冲销/调整流水；不会覆盖原流水，也不会自动执行付款、对账或入账。'
            : '本轮只复用 approval_requests / approval_logs / payout_records 既有对象与状态，不重写 approve / reject 语义，也不扩展到发票、银行对账、虚拟账户或多公司审批状态机。',
        humanConfirmationBoundary:
          'approve / reject 与后续付款仍需人工点击与日志留痕；AI 与 handlingPlan 只负责解释、预检与收口，不会跳过人工确认层。',
        payrollBoundary:
          '不会自动推进正式工资，也不会改动 confirmed / inferred / uncertain 或 included / pending / excluded 分层。',
        generalizationBoundary:
          request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT
            ? '当前 handlingPlan 仅适用于这张审批单及其绑定的原始库存流水；通过审批仍不等于自动修改库存。'
            : '当前 handlingPlan 只适用于这张审批单及其已关联的工单/收款/付款上下文；verificationCode 本轮只进入 precheck / 解释链，不升级为强阻断规则。',
      },
      actionItems,
      precheckSnapshot: {
        precheckStatus: precheck.precheckStatus,
        canExecute: precheck.canExecute,
        blockedReason: precheck.blockedReason,
        blockedStage: precheck.blockedStage,
        remediationSuggestions: precheck.remediationSuggestions,
        verificationCodeStatus: precheck.verificationCodeStatus,
        approvalStatusAllowsExecute: precheck.approvalStatusAllowsExecute,
        linkedBusinessContextPresent: precheck.linkedBusinessContextPresent,
        linkedPayoutState: precheck.linkedPayoutState,
        actorAllowed: precheck.actorAllowed,
      },
      aiDiagnosis: null,
    };
  }

  private buildHandlingPlanSummary(
    request: ApprovalRequest,
    precheck: ApprovalCommandPrecheckResult,
    linkedBusinessContext: Record<string, unknown> | null,
    latestPayout: { payoutNo?: string } | null,
  ) {
    if (request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT) {
      const sourceLabel = `#${request.relatedInventoryTransactionId ?? '-'}`;
      const actionLabel =
        request.inventoryAdjustmentAction === 'reverse' ? '冲销' : '调整';
      if (request.currentStatus === ApprovalStatus.REJECTED) {
        return `库存流水 ${sourceLabel} 的${actionLabel}申请已驳回；原始流水与库存均保持不变。`;
      }
      if (request.currentStatus === ApprovalStatus.APPROVED) {
        return request.executionIdempotencyKey
          ? `库存流水 ${sourceLabel} 的${actionLabel}审批已由独立执行人消费，并生成不可变修正流水。`
          : `库存流水 ${sourceLabel} 的${actionLabel}审批已通过；仍需独立执行人使用幂等请求生成修正流水。`;
      }
      if (!precheck.canExecute) {
        return `库存流水 ${sourceLabel} 的${actionLabel}申请当前不能审批：${this.describeBlockedReason(
          precheck.blockedReason,
        )}`;
      }
      return `库存流水 ${sourceLabel} 的${actionLabel}申请仍在 pending，等待独立审批人处理；当前不会修改库存。`;
    }

    const workOrderNo =
      typeof linkedBusinessContext?.workOrderNo === 'string' ? linkedBusinessContext.workOrderNo : null;
    const amountReceived =
      typeof linkedBusinessContext?.amountReceived === 'string'
        ? linkedBusinessContext.amountReceived
        : null;

    if (request.currentStatus === ApprovalStatus.REJECTED) {
      return `这张审批单因工单 ${workOrderNo || `#${request.relatedWorkOrderId}`} 的付款申请而存在，当前已驳回，后续只保留原因说明与日志，不再进入本轮付款。`;
    }

    if (request.currentStatus === ApprovalStatus.APPROVED) {
      if (latestPayout?.payoutNo) {
        return `这张审批单因工单 ${workOrderNo || `#${request.relatedWorkOrderId}`} 的付款申请而存在，审批与付款都已留痕，当前以审计复核为主。`;
      }
      return `这张审批单因工单 ${workOrderNo || `#${request.relatedWorkOrderId}`} 的付款申请而存在，审批已通过，当前等待财务继续登记付款。`;
    }

    if (!precheck.canExecute) {
      return `这张审批单因工单 ${workOrderNo || `#${request.relatedWorkOrderId}`} 的付款申请而存在，但当前不能直接执行审批：${this.describeBlockedReason(
        precheck.blockedReason,
      )}`;
    }

    return `这张审批单因工单 ${workOrderNo || `#${request.relatedWorkOrderId}`} 的付款申请而存在，当前仍在 pending，可继续人工审批${amountReceived ? `；已收款 ${amountReceived}` : ''}。`;
  }

  private buildHandlingPlanListSummary(
    request: ApprovalRequest,
    precheck: ApprovalCommandPrecheckResult,
  ) {
    if (request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT) {
      if (request.currentStatus === ApprovalStatus.REJECTED) {
        return '库存修正已驳回；原始流水和库存保持不变。';
      }
      if (request.currentStatus === ApprovalStatus.APPROVED) {
        return request.executionIdempotencyKey
          ? '库存修正已按审批生成不可变流水，转入审计复核。'
          : '审批已通过；等待第三名正式身份执行人应用冲销/调整。';
      }
    }

    if (request.currentStatus === ApprovalStatus.REJECTED) {
      return '审批已驳回；保留驳回原因与审计日志，不再进入本轮付款。';
    }

    if (request.currentStatus === ApprovalStatus.APPROVED) {
      if (precheck.linkedPayoutState === 'already_executed') {
        return '财务已完成付款留痕；当前以审计复核为主。';
      }
      return '财务继续登记付款并补齐日志；审批结论已形成。';
    }

    if (!precheck.actorAllowed) {
      return '当前角色先看 handlingPlan 与预检；实际 approve / reject 需审批人或管理员处理。';
    }

    if (precheck.blockedReason === 'self_approval_forbidden') {
      return '提交人与审批人必须分离；请交由另一名审批人处理。';
    }

    if (precheck.blockedReason === 'linked_context_missing') {
      return '先补齐关联工单/收款上下文，再回到审批动作。';
    }

    if (precheck.blockedReason === 'payout_already_executed') {
      return '付款已留痕，无需再次执行审批动作，转入审计复核。';
    }

    return '审批人继续人工审批；验证码仅作提示，不是强阻断规则。';
  }

  private buildHandlingPlanActionItems(
    request: ApprovalRequest,
    precheck: ApprovalCommandPrecheckResult,
    latestPayout: { payoutNo?: string } | null,
  ): ApprovalHandlingPlanActionItem[] {
    if (request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT) {
      return [
        {
          actionKey: 'review_inventory_source',
          title: '核对原始库存流水',
          description: precheck.linkedBusinessContextPresent
            ? '已绑定一条不可变原始库存流水，可继续人工核对。'
            : '缺少原始库存流水，禁止审批和执行。',
          ownerScope: 'human_review',
          status: precheck.linkedBusinessContextPresent ? 'done' : 'blocked',
        },
        {
          actionKey: 'approval_decision',
          title: '执行独立审批',
          description: precheck.canExecute
            ? '由非申请人的审批人执行 approve / reject。'
            : `当前不能审批：${this.describeBlockedReason(precheck.blockedReason)}`,
          ownerScope: 'authorized_roles',
          status:
            request.currentStatus === ApprovalStatus.PENDING
              ? precheck.canExecute
                ? 'ready'
                : 'blocked'
              : 'done',
        },
        {
          actionKey: 'independent_inventory_execution',
          title: '独立执行冲销/调整',
          description:
            request.currentStatus === ApprovalStatus.APPROVED
              ? request.executionIdempotencyKey
                ? '已生成不可变冲销/调整流水，原始流水未被覆盖。'
                : '由既非申请人也非审批人的正式身份执行人使用幂等键应用。'
              : '审批结论形成前禁止修改库存。',
          ownerScope: 'formal_independent_executor',
          status:
            request.executionIdempotencyKey
              ? 'done'
              : request.currentStatus === ApprovalStatus.APPROVED
                ? 'ready'
                : request.currentStatus === ApprovalStatus.REJECTED
                  ? 'not_applicable'
                  : 'pending',
        },
      ];
    }

    return [
      {
        actionKey: 'review_business_context',
        title: '确认关联工单与收款上下文',
        description: precheck.linkedBusinessContextPresent
          ? '当前已挂到真实工单与收款链，可继续把它作为审批说明。'
          : '当前缺少真实工单上下文，先补齐关联对象，再进入人工审批。',
        ownerScope: 'human_review',
        status: precheck.linkedBusinessContextPresent ? 'done' : 'blocked',
      },
      {
        actionKey: 'approval_decision',
        title: '执行审批决定',
        description: precheck.canExecute
          ? '由审批人或管理员继续人工 approve / reject，并保留日志。'
          : !precheck.actorAllowed
            ? '当前角色只能查看 handlingPlan；approve / reject 仍需审批人或管理员执行。'
            : `当前不能直接执行审批：${this.describeBlockedReason(precheck.blockedReason)}`,
        ownerScope: 'authorized_roles',
        status:
          request.currentStatus === ApprovalStatus.PENDING
            ? precheck.canExecute
              ? 'ready'
              : 'blocked'
            : 'done',
      },
      {
        actionKey: 'payout_followup',
        title: '付款与审计留痕',
        description:
          request.currentStatus === ApprovalStatus.APPROVED
            ? latestPayout?.payoutNo
              ? `已登记付款 ${latestPayout.payoutNo}，当前以审计复核为主。`
              : '审批通过后由财务继续登记付款，并把付款留痕补齐。'
            : request.currentStatus === ApprovalStatus.REJECTED
              ? '当前审批已驳回，本轮不进入付款。'
              : '审批未结束前不进入付款，只保留预检与日志。',
        ownerScope: 'authorized_roles',
        status:
          request.currentStatus === ApprovalStatus.APPROVED
            ? latestPayout?.payoutNo
              ? 'done'
              : 'pending'
            : request.currentStatus === ApprovalStatus.REJECTED
              ? 'not_applicable'
              : 'pending',
      },
    ];
  }

  private buildLinkedBusinessContext(
    request: ApprovalRequest,
    visibilityScope: ApprovalHandlingPlanVisibility,
    paymentRecords: Array<{
      id: number;
      paymentNo?: string;
      amount: string;
      paymentMethod: string;
      paymentStatus: string;
      paidAt: Date | null;
      payerName: string | null;
      createdAt: Date;
    }>,
  ) {
    if (
      request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT &&
      request.relatedInventoryTransaction
    ) {
      return {
        contextType: 'inventory_adjustment',
        sourceTransactionId: request.relatedInventoryTransaction.id,
        sourceTransactionNo: request.relatedInventoryTransaction.transactionNo,
        sourceTransactionType: request.relatedInventoryTransaction.transactionType,
        sourceEntryKind: request.relatedInventoryTransaction.entryKind,
        warehouseId: request.relatedInventoryTransaction.warehouseId,
        materialId: request.relatedInventoryTransaction.materialId,
        originalQuantity: request.relatedInventoryTransaction.quantity,
        originalUnitPrice: request.relatedInventoryTransaction.unitPrice,
        originalTotalPrice: request.relatedInventoryTransaction.totalPrice,
        adjustmentAction: request.inventoryAdjustmentAction,
        targetQuantity: request.inventoryTargetQuantity,
        targetUnitPrice: request.inventoryTargetUnitPrice,
        executionStatus: request.executionIdempotencyKey ? 'executed' : 'not_executed',
      };
    }

    if (!request.relatedWorkOrder) {
      return null;
    }

    const latestPayment = paymentRecords.length ? paymentRecords[paymentRecords.length - 1] : null;
    const baseContext = {
      workOrderId: request.relatedWorkOrder.id,
      workOrderNo: request.relatedWorkOrder.workOrderNo,
      title: request.relatedWorkOrder.title,
      customerName: request.relatedWorkOrder.customerName,
      customerMobile:
        visibilityScope === 'full'
          ? request.relatedWorkOrder.customerMobile
          : this.maskSensitiveValue(request.relatedWorkOrder.customerMobile),
      status: request.relatedWorkOrder.status,
      amountDue: request.relatedWorkOrder.amountDue,
      amountReceived: request.relatedWorkOrder.amountReceived,
      responsibleUser:
        request.relatedWorkOrder.responsibleUser?.realName ??
        request.relatedWorkOrder.responsibleUser?.username ??
        null,
      createdBy:
        request.relatedWorkOrder.createdByUser?.realName ??
        request.relatedWorkOrder.createdByUser?.username ??
        null,
      paymentRecordCount: paymentRecords.length,
      latestPaymentAt: latestPayment?.paidAt ?? latestPayment?.createdAt ?? null,
      latestPaymentStatus: latestPayment?.paymentStatus ?? null,
      latestPaymentAmount: latestPayment?.amount ?? null,
    };

    if (visibilityScope !== 'full') {
      return baseContext;
    }

    return {
      ...baseContext,
      paymentRecords: paymentRecords.map((item) => ({
        id: item.id,
        paymentNo: item.paymentNo ?? null,
        amount: item.amount,
        paymentMethod: item.paymentMethod,
        paymentStatus: item.paymentStatus,
        paidAt: item.paidAt,
        payerName: item.payerName,
        createdAt: item.createdAt,
      })),
    };
  }

  private buildLinkedPayoutContext(
    payoutRecords: Array<{
      id: number;
      payoutNo: string;
      amount: string;
      payeeName: string;
      paymentMethod: string;
      paidAt: Date;
      createdAt: Date;
      createdByUser?: { realName?: string | null; username?: string | null } | null;
    }>,
    visibilityScope: ApprovalHandlingPlanVisibility,
  ) {
    if (!payoutRecords.length) {
      return null;
    }

    const latest = payoutRecords.length ? payoutRecords[payoutRecords.length - 1] : null;
    const summary = {
      payoutCount: payoutRecords.length,
      latestPayoutNo: latest?.payoutNo ?? null,
      latestPaidAt: latest?.paidAt ?? latest?.createdAt ?? null,
      latestAmount: latest?.amount ?? null,
      latestPayeeName: latest?.payeeName ?? null,
    };

    if (visibilityScope !== 'full') {
      return summary;
    }

    return {
      ...summary,
      records: payoutRecords.map((item) => ({
        id: item.id,
        payoutNo: item.payoutNo,
        amount: item.amount,
        payeeName: item.payeeName,
        paymentMethod: item.paymentMethod,
        paidAt: item.paidAt,
        createdAt: item.createdAt,
        createdByName: item.createdByUser?.realName ?? item.createdByUser?.username ?? null,
      })),
    };
  }

  private buildExecutionTrace(
    request: ApprovalRequest,
    precheck: ApprovalCommandPrecheckResult,
    paymentRecords: Array<{ id: number; paymentNo?: string; createdAt: Date; paidAt: Date | null }>,
    payoutRecords: Array<{ id: number; payoutNo: string; createdAt: Date; paidAt: Date }>,
    approvedLog: ApprovalLog | undefined,
    rejectedLog: ApprovalLog | undefined,
  ) {
    const latestPayment = paymentRecords.length ? paymentRecords[paymentRecords.length - 1] : null;
    const latestPayout = payoutRecords.length ? payoutRecords[payoutRecords.length - 1] : null;

    return {
      currentStatus: request.currentStatus,
      latestApprovalAction:
        rejectedLog?.actionType ??
        approvedLog?.actionType ??
        (request.approvalLogs?.length
          ? request.approvalLogs[request.approvalLogs.length - 1].actionType
          : null) ??
        'submitted',
      canExecute: precheck.canExecute,
      blockedReason: precheck.blockedReason,
      blockedStage: precheck.blockedStage,
      verificationCodeRole:
        request.verificationCode !== null
          ? 'present_for_hint_only'
          : 'not_provided_but_not_blocking',
      latestPaymentNo: latestPayment?.paymentNo ?? null,
      latestPaymentAt: latestPayment?.paidAt ?? latestPayment?.createdAt ?? null,
      latestPayoutNo: latestPayout?.payoutNo ?? null,
      latestPayoutAt: latestPayout?.paidAt ?? latestPayout?.createdAt ?? null,
    };
  }

  private buildAuditTrail(
    request: ApprovalRequest,
    paymentRecords: Array<{
      id: number;
      paymentNo?: string;
      amount: string;
      paymentMethod: string;
      paymentStatus: string;
      paidAt: Date | null;
      createdAt: Date;
      payerName: string | null;
      createdByUser?: { realName?: string | null; username?: string | null } | null;
    }>,
    payoutRecords: Array<{
      id: number;
      payoutNo: string;
      amount: string;
      paymentMethod: string;
      paidAt: Date;
      createdAt: Date;
      payeeName: string;
      createdByUser?: { realName?: string | null; username?: string | null } | null;
    }>,
    visibilityScope: ApprovalHandlingPlanVisibility,
  ) {
    const trail: Array<Record<string, unknown>> = [];

    for (const item of paymentRecords) {
      trail.push({
        eventKey: `payment-${item.id}`,
        stage: 'payment',
        action: 'payment_recorded',
        actionLabel: '收款已登记',
        detail: `收款 ${item.paymentNo ?? `#${item.id}`} / ${item.amount} / ${item.paymentMethod}`,
        actorId: null,
        actorName: item.createdByUser?.realName ?? item.createdByUser?.username ?? null,
        actionAt: item.paidAt ?? item.createdAt,
        extra:
          visibilityScope === 'full'
            ? {
                paymentStatus: item.paymentStatus,
                payerName: item.payerName,
              }
            : null,
      });
    }

    for (const item of request.approvalLogs ?? []) {
      trail.push({
        eventKey: `approval-log-${item.id}`,
        stage: 'approval',
        action: item.actionType,
        actionLabel: this.formatApprovalLogLabel(item.actionType),
        detail:
          visibilityScope === 'full'
            ? item.actionRemark ?? this.formatApprovalLogLabel(item.actionType)
            : this.compactRemark(item.actionRemark) ?? this.formatApprovalLogLabel(item.actionType),
        actorId: item.actionBy,
        actorName: item.actionByUser?.realName ?? item.actionByUser?.username ?? null,
        actionAt: item.actionAt,
      });
    }

    for (const item of payoutRecords) {
      trail.push({
        eventKey: `payout-${item.id}`,
        stage: 'payout',
        action: 'payout_recorded',
        actionLabel: '付款已登记',
        detail: `付款 ${item.payoutNo} / ${item.amount} / ${item.paymentMethod}`,
        actorId: null,
        actorName: item.createdByUser?.realName ?? item.createdByUser?.username ?? null,
        actionAt: item.paidAt ?? item.createdAt,
        extra:
          visibilityScope === 'full'
            ? {
                payeeName: item.payeeName,
              }
            : null,
      });
    }

    return trail.sort(
      (left, right) =>
        new Date(left.actionAt as string | Date).getTime() -
          new Date(right.actionAt as string | Date).getTime() ||
        String(left.eventKey).localeCompare(String(right.eventKey)),
    );
  }

  private buildCommandExplanation(
    request: ApprovalRequest,
    precheck: ApprovalCommandPrecheckResult,
    summary: string,
    verificationCodeRoleText: string,
    latestPayment:
      | {
          paymentNo?: string;
          amount: string;
          paymentStatus: string;
        }
      | null,
    latestPayout:
      | {
          payoutNo?: string;
          amount?: string;
        }
      | null,
  ) {
    const parts = [summary];

    if (latestPayment) {
      parts.push(
        `当前最近一条收款留痕是 ${latestPayment.paymentNo ?? '-'} / ${latestPayment.amount} / ${latestPayment.paymentStatus}。`,
      );
    }

    if (latestPayout?.payoutNo) {
      parts.push(`当前已存在付款留痕 ${latestPayout.payoutNo}，因此不会再次执行审批动作。`);
    } else if (request.currentStatus === ApprovalStatus.APPROVED) {
      parts.push(
        request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT
          ? '审批结论已经形成，但库存修正仍需第三名正式身份执行人单独应用。'
          : '审批结论已经形成，后续重点转为付款登记与审计补充。',
      );
    }

    if (!precheck.canExecute) {
      parts.push(`当前 blocked 原因是 ${this.describeBlockedReason(precheck.blockedReason)}。`);
    }

    parts.push(verificationCodeRoleText);
    return parts.join(' ');
  }

  private assertApprovalDecisionAllowed(
    request: ApprovalRequest,
    currentUser: CurrentUser,
    payoutAlreadyExecuted: boolean,
  ) {
    const blockedReason = this.resolveBlockedReason(
      request.currentStatus === ApprovalStatus.PENDING,
      this.hasApprovalTypeBusinessContext(request),
      request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT
        ? false
        : payoutAlreadyExecuted,
      this.canCurrentUserExecuteApproval(currentUser),
      request.applicantUserId !== currentUser.id,
    );

    switch (blockedReason) {
      case 'linked_context_missing':
        throw new BadRequestException('当前审批单缺少关联工单或业务上下文，不能继续执行审批');
      case 'payout_already_executed':
        throw new BadRequestException('当前审批单已经登记付款，不能重复执行审批');
      case 'approval_not_pending':
        throw new BadRequestException(
          '[approval_not_pending] 当前审批状态已结束，不能重复执行 approve / reject',
        );
      case 'actor_not_allowed':
        throw new ForbiddenException('[approval_role_forbidden] 当前角色不能执行审批');
      case 'self_approval_forbidden':
        throw new ForbiddenException(
          '[approval_actor_not_separated] 提交人不能审批自己提交的申请，请交由另一名审批人处理',
        );
      default:
        return;
    }
  }

  private hasApprovalTypeBusinessContext(request: ApprovalRequest) {
    if (request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT) {
      const hasImmutableRequestEvidence = Boolean(
        request.relatedInventoryTransactionId &&
          request.relatedWorkOrderId === null &&
          request.requestIdempotencyKey &&
          request.requestFingerprint,
      );
      if (!hasImmutableRequestEvidence) {
        return false;
      }
      if (request.inventoryAdjustmentAction === InventoryAdjustmentAction.REVERSE) {
        return (
          request.inventoryTargetQuantity === null &&
          request.inventoryTargetUnitPrice === null
        );
      }
      return (
        request.inventoryAdjustmentAction === InventoryAdjustmentAction.ADJUST &&
        Boolean(request.inventoryTargetQuantity && request.inventoryTargetUnitPrice)
      );
    }

    return Boolean(
      request.relatedWorkOrderId &&
        (request.relatedInventoryTransactionId === null ||
          request.relatedInventoryTransactionId === undefined),
    );
  }

  private buildSuggestedNextStep(
    request: ApprovalRequest,
    precheck: ApprovalCommandPrecheckResult,
    latestPayout: { payoutNo?: string } | null,
  ) {
    if (request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT) {
      if (request.currentStatus === ApprovalStatus.REJECTED) {
        return '保留驳回说明；如需再次修正，必须重新发起新的审批申请。';
      }
      if (request.currentStatus === ApprovalStatus.APPROVED) {
        return request.executionIdempotencyKey
          ? '修正流水已生成，下一步只做审计复核。'
          : '由既非申请人也非审批人的正式执行人使用幂等键应用修正。';
      }
      if (precheck.canExecute) {
        return '由独立审批人继续人工 approve / reject；审批前库存保持不变。';
      }
    }

    if (request.currentStatus === ApprovalStatus.REJECTED) {
      return '保留驳回说明与日志，如需重提请重新发起审批单。';
    }

    if (request.currentStatus === ApprovalStatus.APPROVED) {
      return latestPayout?.payoutNo
        ? '当前审批与付款都已留痕，建议继续做审计复核。'
        : '审批已通过，下一步由财务登记付款并补齐留痕。';
    }

    if (precheck.blockedReason === 'linked_context_missing') {
      return '先补齐关联工单或收款上下文，再回到审批动作。';
    }

    if (precheck.blockedReason === 'payout_already_executed') {
      return '付款已登记，当前无需再次审批，转入审计复核即可。';
    }

    if (precheck.blockedReason === 'actor_not_allowed') {
      return '当前角色先查看 handlingPlan 与日志，再交由审批人或管理员执行 approve / reject。';
    }

    if (precheck.blockedReason === 'self_approval_forbidden') {
      return '请交由另一名审批人执行 approve / reject，提交人不能审批自己的申请。';
    }

    if (precheck.canExecute) {
      return '由审批人或管理员继续人工 approve / reject；验证码只作提示，不作强阻断。';
    }

    return '继续人工核对当前审批单的业务上下文与审计留痕。';
  }

  private resolveExecutionCapability(
    precheck: ApprovalCommandPrecheckResult,
    request: ApprovalRequest,
  ) {
    if (request.approvalType === ApprovalType.INVENTORY_ADJUSTMENT) {
      if (request.currentStatus === ApprovalStatus.APPROVED) {
        return request.executionIdempotencyKey
          ? 'inventory_adjustment_executed'
          : 'awaiting_independent_inventory_executor';
      }
      if (request.currentStatus === ApprovalStatus.REJECTED) {
        return 'closed_after_reject';
      }
      return precheck.canExecute ? 'approve_or_reject' : 'blocked';
    }

    if (request.currentStatus === ApprovalStatus.APPROVED && precheck.linkedPayoutState === 'already_executed') {
      return 'audit_only';
    }
    if (request.currentStatus === ApprovalStatus.APPROVED) {
      return 'awaiting_payout_followup';
    }
    if (request.currentStatus === ApprovalStatus.REJECTED) {
      return 'closed_after_reject';
    }
    if (!precheck.actorAllowed) {
      return 'review_only';
    }
    return precheck.canExecute ? 'approve_or_reject' : 'blocked';
  }

  private resolveVisibilityScope(currentUser: CurrentUser): ApprovalHandlingPlanVisibility {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    return roleCodes.has('admin') || roleCodes.has('founder') || roleCodes.has('super_admin')
      ? 'full'
      : 'restricted';
  }

  private canCurrentUserExecuteApproval(currentUser: CurrentUser) {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    return roleCodes.has('admin') || roleCodes.has('approver');
  }

  private resolvePrecheckStatus(checks: ApprovalCommandCheck[]): ApprovalCommandPrecheckStatus {
    if (checks.some((item) => item.checkResult === 'fail')) {
      return 'fail';
    }
    if (checks.some((item) => item.checkResult === 'warn')) {
      return 'warn';
    }
    return 'pass';
  }

  private resolveBlockedReason(
    approvalStatusAllowsExecute: boolean,
    linkedBusinessContextPresent: boolean,
    payoutAlreadyExecuted: boolean,
    actorAllowed: boolean,
    independentApprover: boolean,
  ): ApprovalCommandBlockedReason | null {
    if (!linkedBusinessContextPresent) {
      return 'linked_context_missing';
    }
    if (payoutAlreadyExecuted) {
      return 'payout_already_executed';
    }
    if (!approvalStatusAllowsExecute) {
      return 'approval_not_pending';
    }
    if (!actorAllowed) {
      return 'actor_not_allowed';
    }
    if (!independentApprover) {
      return 'self_approval_forbidden';
    }
    return null;
  }

  private resolveBlockedStage(
    blockedReason: ApprovalCommandBlockedReason | null,
  ): ApprovalCommandBlockedStage | null {
    switch (blockedReason) {
      case 'linked_context_missing':
        return 'linked_business_context';
      case 'payout_already_executed':
        return 'payout_execution';
      case 'actor_not_allowed':
      case 'self_approval_forbidden':
        return 'role_permission';
      case 'approval_not_pending':
        return 'approval_status';
      default:
        return null;
    }
  }

  private buildRemediationSuggestions(
    request: ApprovalRequest,
    blockedReason: ApprovalCommandBlockedReason | null,
    actorAllowed: boolean,
    linkedBusinessContextPresent: boolean,
    payoutAlreadyExecuted: boolean,
  ) {
    const suggestions = new Set<string>();

    if (!linkedBusinessContextPresent) {
      suggestions.add('先补齐审批单与真实工单的关联关系，再回到审批动作。');
    }

    if (!actorAllowed) {
      suggestions.add('当前角色先查看 handlingPlan、precheck 与日志，再交由审批人或管理员执行 approve / reject。');
    }

    if (blockedReason === 'self_approval_forbidden') {
      suggestions.add('请改由另一名审批人处理；提交人不能 approve / reject 自己提交的申请。');
    }

    if (request.verificationCode) {
      suggestions.add('verificationCode 目前只做提示，请继续人工核对，不要把它当成新的强阻断。');
    } else {
      suggestions.add('当前没有 verificationCode 也不会自动阻断审批，继续按人工审批链处理即可。');
    }

    if (
      request.approvalType !== ApprovalType.INVENTORY_ADJUSTMENT &&
      (request.relatedWorkOrder?.paymentRecords?.length ?? 0) === 0
    ) {
      suggestions.add('若收款留痕仍未出现，请先人工核对工单收款背景，但本轮不把它升级成新的强阻断。');
    }

    if (blockedReason === 'approval_not_pending') {
      suggestions.add('当前审批结论已经形成，只需继续做后续付款或审计复核。');
    }

    if (payoutAlreadyExecuted) {
      suggestions.add('付款已登记，建议转入审计复核，不再重复执行审批动作。');
    }

    return Array.from(suggestions);
  }

  private buildBlockers(precheck: ApprovalCommandPrecheckResult) {
    const blockers: string[] = [];

    if (precheck.blockedReason) {
      blockers.push(precheck.blockedReason);
    }
    if (!precheck.canExecute && precheck.blockedStage) {
      blockers.push(precheck.blockedStage);
    }
    if (precheck.verificationCodeStatus.startsWith('warn:')) {
      blockers.push('verification_code_hint_only');
    }

    return blockers;
  }

  private describeBlockedReason(reason: ApprovalCommandBlockedReason | null) {
    switch (reason) {
      case 'approval_not_pending':
        return '审批状态已结束，不能重复执行 approve / reject';
      case 'linked_context_missing':
        return '缺少关联工单或业务上下文';
      case 'payout_already_executed':
        return '付款记录已经存在';
      case 'actor_not_allowed':
        return '当前角色没有执行 approve / reject 的权限';
      case 'self_approval_forbidden':
        return '提交人与审批人必须分离，不能审批自己提交的申请';
      default:
        return '当前没有硬阻塞';
    }
  }

  private formatApprovalLogLabel(actionType: string) {
    switch (actionType) {
      case 'submitted':
        return '已提交审批';
      case 'approved':
        return '审批通过';
      case 'rejected':
        return '审批驳回';
      default:
        return actionType;
    }
  }

  private compactRemark(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    return normalized.length > 60 ? `${normalized.slice(0, 60)}...` : normalized;
  }

  private maskSensitiveValue(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.length <= 4) {
      return '已设置';
    }

    return `${'*'.repeat(Math.max(2, normalized.length - 4))}${normalized.slice(-4)}`;
  }

  private mapUser(user: { id: number; realName?: string | null; username?: string | null } | null | undefined) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.realName ?? user.username ?? null,
    };
  }
}
