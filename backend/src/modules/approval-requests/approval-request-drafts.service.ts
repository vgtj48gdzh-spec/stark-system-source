import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { normalizeMoney, normalizeQuantity } from '../../common/utils/decimal.util';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { ApprovalStatus } from '../../shared/enums/approval-status.enum';
import { InventoryTransactionType } from '../../shared/enums/inventory-transaction-type.enum';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { WorkOrderMaterialSource } from '../../shared/enums/work-order-material-source.enum';
import { WorkOrderStatus } from '../../shared/enums/work-order-status.enum';
import { InventoryTransaction } from '../inventory-transactions/entities/inventory-transaction.entity';
import { Material } from '../materials/entities/material.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SequenceService } from '../sequence/sequence.service';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { createPendingApprovalRequest } from './approval-request-pending.factory';
import { ApprovalWarehouseEvidenceCandidatePreview } from './approval-warehouse-evidence-intake.contract';
import { ApprovalWarehousePreviewReadonlyService } from './approval-warehouse-preview-readonly.service';
import { CreateApprovalRequestDraftFromWarehousePreviewDto } from './dto/create-approval-request-draft-from-warehouse-preview.dto';
import { SubmitApprovalRequestDraftDto } from './dto/submit-approval-request-draft.dto';
import { ApprovalRequest } from './entities/approval-request.entity';
import { ApprovalRequestDraft } from './entities/approval-request-draft.entity';

type ManualDraftBoundary = {
  manualDraftOnly: true;
  humanApprovalRequired: true;
  aiAutoApprovalEnabled: false;
  createsApprovalRequest: false;
  createsPaymentIntent: false;
  executesPayment: false;
  confirmsBankSms: false;
  writesOldAbc: false;
  mutatesVirtualLedger: false;
  mutatesFinanceReconciliation: false;
};

type DraftSubmissionBoundary = {
  manualSubmission: true;
  humanApprovalRequired: true;
  independentApproverRequired: true;
  createsApprovalRequest: true;
  createsPaymentIntent: false;
  executesPayment: false;
  confirmsBankSms: false;
  writesOldAbc: false;
  mutatesInventory: false;
  mutatesVirtualLedger: false;
  mutatesFinanceReconciliation: false;
};

type SubmissionEvidence = {
  candidateRef: string;
  candidateType: string;
  sourceSystem: string;
  sourceEntityType: 'work_order_materials';
  sourceRef: string;
  amount: string;
  workOrderId: number;
  workOrderMaterialId: number;
  materialId: number;
  warehouseId: number | null;
  supplierId: number | null;
  supplierStatus: string | null;
  sourceType: WorkOrderMaterialSource;
  quantity: string;
  unitPrice: string;
  workOrderStatus: WorkOrderStatus;
  workOrderAmountDue: string;
  workOrderAmountReceived: string;
  outboundInventoryTransactionIds: number[];
  displaySummary: Record<string, unknown>;
};

const WORK_ORDER_MATERIAL_SUBMISSION_GUARDS = new Set([
  'source_authority_guard',
  'redaction_guard',
  'audit_guard',
  'idempotency_guard',
  'bank_confirmation_guard',
  'virtual_ledger_guard',
  'work_order_guard',
  'warehouse_material_guard',
  'material_usage_guard',
  'amount_consistency_guard',
]);

@Injectable()
export class ApprovalRequestDraftsService {
  constructor(
    @InjectRepository(ApprovalRequestDraft)
    private readonly approvalRequestDraftRepository: Repository<ApprovalRequestDraft>,
    private readonly approvalWarehousePreviewReadonlyService: ApprovalWarehousePreviewReadonlyService,
    private readonly sequenceService: SequenceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async createFromWarehousePreview(
    dto: CreateApprovalRequestDraftFromWarehousePreviewDto,
    currentUser: CurrentUser,
  ) {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    if (!roleCodes.has('finance') && !roleCodes.has('admin')) {
      throw new ForbiddenException(
        '[approval_role_forbidden] 只有财务人员或管理员可以创建审批草稿',
      );
    }

    const initialPreview = await this.approvalWarehousePreviewReadonlyService.findPreviewByCandidateRef(
      dto.candidateRef,
    );

    if (!initialPreview) {
      throw new NotFoundException('Approval warehouse preview candidate not found');
    }

    if (dto.idempotencyKey && dto.idempotencyKey !== initialPreview.idempotencyKey) {
      throw new BadRequestException('idempotencyKey does not match preview candidate');
    }

    const aiSuggestionSnapshot = scrubSensitiveValue(dto.aiSuggestionSnapshot ?? null);
    const candidateDraftExistsHint = await this.approvalRequestDraftRepository.exists({
      where: { candidateRef: initialPreview.candidateRef },
    });
    return this.approvalRequestDraftRepository.manager.transaction(async (manager) => {
      const draftRepository = manager.getRepository(ApprovalRequestDraft);
      if (candidateDraftExistsHint) {
        await draftRepository.find({
          where: { candidateRef: initialPreview.candidateRef },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
      } else {
        await this.sequenceService.lockApprovalRequestDraftCreateMutex(manager);
        await draftRepository.find({
          where: { candidateRef: initialPreview.candidateRef },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
      }

      const lockedSource = await this.lockPreviewSource(manager, initialPreview);
      const preview = lockedSource
        ? await this.approvalWarehousePreviewReadonlyService.rebuildLockedWorkOrderMaterialPreview(
            initialPreview,
            lockedSource,
            manager,
          )
        : initialPreview;
      if (!preview || preview.idempotencyKey !== initialPreview.idempotencyKey) {
        throw new BadRequestException(
          '[approval_evidence_changed] 审批证据已发生变化，请刷新候选并重新人工核对',
        );
      }

      const candidateDrafts = await draftRepository.find({
        where: { candidateRef: preview.candidateRef },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const sameEvidenceDrafts = candidateDrafts.filter(
        (draft) =>
          draft.draftStatus !== 'voided' &&
          readPreviewIdempotencyKey(draft) === preview.idempotencyKey,
      );

      const reusableDraft = sameEvidenceDrafts.find(
        (draft) => draft.draftStatus === 'draft_created',
      );
      if (reusableDraft) {
        return this.buildDraftResponse(reusableDraft, true);
      }

      for (const submittedDraft of candidateDrafts.filter(
        (draft) => draft.draftStatus === 'submitted',
      )) {
        if (!submittedDraft.linkedApprovalRequestId) {
          throw new BadRequestException(
            '[approval_candidate_inconsistent] 已提交草稿缺少关联审批单，禁止重建',
          );
        }
        const linkedApproval = await manager.getRepository(ApprovalRequest).findOne({
          where: { id: submittedDraft.linkedApprovalRequestId },
        });
        if (!linkedApproval) {
          throw new BadRequestException(
            '[approval_candidate_inconsistent] 已提交草稿的关联审批单不存在，禁止重建',
          );
        }
        if (linkedApproval.currentStatus !== ApprovalStatus.REJECTED) {
          throw new BadRequestException(
            '[approval_candidate_active] 该证据已有待审批或已通过审批单，请先由独立审批人处理，禁止重复创建',
          );
        }
      }

      const nextRevision =
        candidateDrafts.reduce(
          (maxRevision, draft) => Math.max(maxRevision, readEvidenceRevision(draft)),
          0,
        ) + 1;
      const internalIdempotencyKey = buildDraftIdempotencyKey(
        preview.candidateRef,
        preview.idempotencyKey,
        nextRevision,
      );

      for (const staleDraft of candidateDrafts.filter(
        (draft) => draft.draftStatus === 'draft_created',
      )) {
        staleDraft.draftStatus = 'voided';
        staleDraft.learningContextJson = scrubSensitiveValue({
          ...(asRecord(staleDraft.learningContextJson) ?? {}),
          voidAudit: {
            reason: 'evidence_version_superseded',
            voidedByUserId: currentUser.id,
            supersededByPreviewIdempotencyKey: preview.idempotencyKey,
            supersededByRevision: nextRevision,
          },
        });
        const voidedDraft = await draftRepository.save(staleDraft);
        await this.operationLogsService.create(
          {
            module: 'approval_request_draft',
            targetId: voidedDraft.id,
            action: OperationLogAction.VOID_APPROVAL_REQUEST_DRAFT,
            operatorId: currentUser.id,
            detail: `Voided superseded approval draft ${voidedDraft.draftNo}`,
            detailJson: {
              candidateRef: voidedDraft.candidateRef,
              reason: 'evidence_version_superseded',
              supersededByRevision: nextRevision,
              boundary: buildManualDraftBoundary(),
            },
          },
          manager,
        );
      }

      const draftNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.APPROVAL_REQUEST_DRAFT.bizType,
        BIZ_SEQUENCE_CONFIG.APPROVAL_REQUEST_DRAFT.prefix,
        manager,
      );
      const learningContext = buildLearningContext(preview, dto, aiSuggestionSnapshot);
      const evidenceSnapshot = buildEvidenceSnapshot(
        preview,
        internalIdempotencyKey,
        nextRevision,
      );
      const draft = draftRepository.create({
        draftNo,
        candidateRef: preview.candidateRef,
        idempotencyKey: internalIdempotencyKey,
        candidateType: preview.candidateType,
        sourceSystem: preview.sourceSystem,
        sourceEntityType: preview.sourceEntityType,
        sourceRef: scrubOptionalText(preview.sourceRef) ?? 'redacted_source_ref',
        amount: preview.amount,
        draftReason: scrubOptionalText(dto.draftReason),
        draftStatus: 'draft_created',
        evidenceSnapshotJson: evidenceSnapshot,
        learningContextJson: learningContext,
        aiSuggestionSnapshotJson: aiSuggestionSnapshot,
        createdByUserId: currentUser.id ?? null,
        linkedApprovalRequestId: null,
      });
      const saved = await draftRepository.save(draft);

      await this.operationLogsService.create(
        {
          module: 'approval_request_draft',
          targetId: saved.id,
          action: OperationLogAction.CREATE_APPROVAL_REQUEST_DRAFT,
          operatorId: currentUser.id,
          detail: `Created manual approval draft ${saved.draftNo}`,
          detailJson: {
            candidateRef: saved.candidateRef,
            idempotencyKey: saved.idempotencyKey,
            previewIdempotencyKey: preview.idempotencyKey,
            evidenceRevision: nextRevision,
            sourceSystem: saved.sourceSystem,
            sourceEntityType: saved.sourceEntityType,
            boundary: buildManualDraftBoundary(),
          },
        },
        manager,
      );

      return this.buildDraftResponse(saved, false);
    });
  }

  async submit(
    draftId: number,
    dto: SubmitApprovalRequestDraftDto,
    currentUser: CurrentUser,
  ) {
    const roleCodes = new Set(currentUser.roleCodes ?? []);
    if (!roleCodes.has('finance') && !roleCodes.has('admin')) {
      throw new ForbiddenException(
        '[approval_role_forbidden] 只有财务人员或管理员可以人工提交审批草稿',
      );
    }

    if (dto.confirmHumanSubmission !== true) {
      throw new BadRequestException('必须确认本次审批提交由人工主动发起');
    }

    if (dto.confirmEvidenceReviewed !== true) {
      throw new BadRequestException('必须由财务人工确认已核对工单、材料、仓库和出库证据');
    }

    if (dto.confirmNormalMaterial !== true) {
      throw new BadRequestException('必须人工确认该材料不属于特殊材料审批范围');
    }

    return this.approvalRequestDraftRepository.manager.transaction(async (manager) => {
      const draftRepository = manager.getRepository(ApprovalRequestDraft);
      const draft = await draftRepository.findOne({
        where: { id: draftId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!draft) {
        throw new NotFoundException('审批草稿不存在');
      }

      if (dto.idempotencyKey !== draft.idempotencyKey) {
        throw new BadRequestException('idempotencyKey 与审批草稿不一致');
      }

      if (draft.draftStatus === 'submitted') {
        return this.buildSubmittedReplay(manager, draft);
      }

      if (draft.draftStatus !== 'draft_created') {
        throw new BadRequestException(`当前草稿状态 ${draft.draftStatus} 不允许提交`);
      }

      if (draft.linkedApprovalRequestId) {
        throw new BadRequestException('审批草稿关联状态不一致，请先人工复核');
      }

      assertDraftSubmitterSeparated(draft, currentUser.id);

      const evidence = await this.resolveSubmissionEvidence(manager, draft);
      const submissionReason = scrubOptionalText(dto.submissionReason);

      if (!submissionReason) {
        throw new BadRequestException('请填写本次提交审批的人工核对说明');
      }

      const approvalRequest = await createPendingApprovalRequest({
        manager,
        input: {
          relatedWorkOrderId: evidence.workOrderId,
          amount: evidence.amount,
          reason: submissionReason,
          verificationCode: null,
        },
        currentUser,
        sequenceService: this.sequenceService,
        operationLogsService: this.operationLogsService,
      });

      draft.draftStatus = 'submitted';
      draft.linkedApprovalRequestId = approvalRequest.id;
      draft.learningContextJson = scrubSensitiveValue({
        ...(asRecord(draft.learningContextJson) ?? {}),
        humanDecision: 'submitted_for_independent_approval',
        decisionReason: submissionReason,
        submittedByUserId: currentUser.id,
        submissionEvidence: {
          workOrderId: evidence.workOrderId,
          workOrderMaterialId: evidence.workOrderMaterialId,
          materialId: evidence.materialId,
          warehouseId: evidence.warehouseId,
          supplierId: evidence.supplierId,
          supplierStatus: evidence.supplierStatus,
          sourceType: evidence.sourceType,
          quantity: evidence.quantity,
          unitPrice: evidence.unitPrice,
          workOrderStatus: evidence.workOrderStatus,
          workOrderAmountDue: evidence.workOrderAmountDue,
          workOrderAmountReceived: evidence.workOrderAmountReceived,
          outboundInventoryTransactionIds: evidence.outboundInventoryTransactionIds,
          amount: evidence.amount,
          candidateRef: evidence.candidateRef,
          candidateType: evidence.candidateType,
          sourceSystem: evidence.sourceSystem,
          sourceEntityType: evidence.sourceEntityType,
          sourceRef: evidence.sourceRef,
          displaySummary: evidence.displaySummary,
        },
        humanOverrideAiSuggestion: dto.humanOverrideAiSuggestion ?? false,
      });
      assertSubmittedApprovalDraftActorChain(draft, approvalRequest);
      const savedDraft = await draftRepository.save(draft);

      await this.operationLogsService.create(
        {
          module: 'approval_request_draft',
          targetId: savedDraft.id,
          action: OperationLogAction.SUBMIT_APPROVAL_REQUEST_DRAFT,
          operatorId: currentUser.id,
          detail: `Submitted manual approval draft ${savedDraft.draftNo} for independent approval`,
          detailJson: {
            linkedApprovalRequestId: approvalRequest.id,
            candidateRef: savedDraft.candidateRef,
            workOrderId: evidence.workOrderId,
            workOrderMaterialId: evidence.workOrderMaterialId,
            outboundInventoryTransactionIds: evidence.outboundInventoryTransactionIds,
            boundary: buildDraftSubmissionBoundary(),
          },
        },
        manager,
      );

      return this.buildSubmissionResponse(savedDraft, approvalRequest, evidence, false);
    });
  }

  private async buildSubmittedReplay(manager: EntityManager, draft: ApprovalRequestDraft) {
    if (!draft.linkedApprovalRequestId) {
      throw new BadRequestException('已提交草稿缺少关联审批单，请先人工复核');
    }

    const approvalRequest = await manager.getRepository(ApprovalRequest).findOne({
      where: { id: draft.linkedApprovalRequestId },
    });

    if (!approvalRequest) {
      throw new BadRequestException('草稿关联的审批单不存在，请先人工复核');
    }

    assertSubmittedApprovalDraftActorChain(draft, approvalRequest);

    const evidence = this.readStoredSubmissionEvidence(draft);
    if (
      approvalRequest.relatedWorkOrderId !== evidence.workOrderId ||
      normalizeMoney(approvalRequest.amount) !== evidence.amount
    ) {
      throw new BadRequestException('草稿与关联审批单的工单或金额不一致，请先人工复核');
    }

    return this.buildSubmissionResponse(draft, approvalRequest, evidence, true);
  }

  private async resolveSubmissionEvidence(
    manager: EntityManager,
    draft: ApprovalRequestDraft,
  ): Promise<SubmissionEvidence> {
    const snapshot = asRecord(draft.evidenceSnapshotJson);
    const summary = asRecord(snapshot?.evidenceSummary);
    const workOrder = asRecord(summary?.workOrder);
    const material = asRecord(summary?.material);
    const warehouse = asRecord(summary?.warehouse);
    const supplier = asRecord(summary?.supplier);
    const supplierFieldPresent = hasOwn(summary, 'supplier');
    const supplierExplicitNull = supplierFieldPresent && summary?.supplier === null;
    const inventory = asRecord(summary?.inventory);
    const workOrderId = positiveInteger(workOrder?.workOrderId);
    const workOrderMaterialId = positiveInteger(inventory?.workOrderMaterialId);
    const materialId = positiveInteger(material?.materialId);
    const warehouseId = positiveInteger(warehouse?.warehouseId);
    const snapshotSupplierId = positiveInteger(supplier?.supplierId);
    const snapshotSupplierStatus = nonEmptyString(supplier?.status);
    const snapshotAmount = normalizePositiveMoney(snapshot?.amount ?? draft.amount);
    const draftAmount = normalizePositiveMoney(draft.amount);
    const rawRequiredGuards = snapshot?.requiredGuards;
    const requiredGuardsHaveValidShape =
      Array.isArray(rawRequiredGuards) &&
      rawRequiredGuards.length === WORK_ORDER_MATERIAL_SUBMISSION_GUARDS.size &&
      rawRequiredGuards.every((item) => typeof item === 'string') &&
      new Set(rawRequiredGuards).size === rawRequiredGuards.length;
    const requiredGuards = requiredGuardsHaveValidShape
      ? (rawRequiredGuards as string[])
      : [];

    if (snapshot?.status !== 'evidence_ready') {
      throw new BadRequestException('只有 evidence_ready 的草稿可以提交正式审批');
    }

    if (
      draft.candidateType !== 'reimbursement' ||
      draft.sourceSystem !== 'stark_work_order' ||
      draft.sourceEntityType !== 'work_order_materials' ||
      snapshot?.candidateType !== draft.candidateType ||
      snapshot?.sourceSystem !== draft.sourceSystem ||
      snapshot?.sourceEntityType !== draft.sourceEntityType
    ) {
      throw new BadRequestException('当前仅允许从工单材料证据提交审批，禁止自由录入或旁路关联');
    }

    if (
      snapshot?.candidateRef !== draft.candidateRef ||
      snapshot?.idempotencyKey !== draft.idempotencyKey
    ) {
      throw new BadRequestException('草稿证据快照与候选或幂等标识不一致，请重新生成草稿');
    }

    const guardSet = new Set(requiredGuards);
    const guardsMatchApprovedProfile =
      requiredGuardsHaveValidShape &&
      guardSet.size === WORK_ORDER_MATERIAL_SUBMISSION_GUARDS.size &&
      [...WORK_ORDER_MATERIAL_SUBMISSION_GUARDS].every((guard) => guardSet.has(guard));
    const materialStatus = String(material?.status ?? '').toLowerCase();
    const specialMaterialMarked =
      material?.specialApprovalRequired === true ||
      Boolean(material?.specialFlag) ||
      materialStatus.includes('special');

    if (!guardsMatchApprovedProfile || specialMaterialMarked) {
      throw new BadRequestException(
        '材料证据含有特殊、未知或未完成的审批守卫，不能进入普通材料审批',
      );
    }

    if (
      !workOrderId ||
      !workOrderMaterialId ||
      !materialId ||
      !warehouseId ||
      !snapshotAmount ||
      !draftAmount ||
      !material
    ) {
      throw new BadRequestException('草稿缺少工单、材料、金额或工单材料证据，不能提交审批');
    }

    if (
      !supplierFieldPresent ||
      (!supplierExplicitNull && !supplier) ||
      (supplier !== null && (!snapshotSupplierId || !snapshotSupplierStatus)) ||
      (supplierExplicitNull && (snapshotSupplierId || snapshotSupplierStatus))
    ) {
      throw new BadRequestException('草稿供应商证据不完整，不能提交审批');
    }

    if (draftAmount !== snapshotAmount) {
      throw new BadRequestException('草稿金额与冻结证据金额不一致，请重新生成草稿');
    }

    const expectedSourceRef = `work_order_materials:${workOrderMaterialId}`;
    if (draft.sourceRef !== expectedSourceRef || snapshot?.sourceRef !== expectedSourceRef) {
      throw new BadRequestException('草稿来源引用与工单材料不一致，请重新生成草稿');
    }

    const line = await manager.getRepository(WorkOrderMaterial).findOne({
      where: { id: workOrderMaterialId, deletedAt: IsNull() },
      lock: { mode: 'pessimistic_write' },
    });

    if (!line || line.workOrderId !== workOrderId) {
      throw new BadRequestException('工单材料已经不存在或与草稿关联不一致，请重新生成草稿');
    }

    if (
      ![WorkOrderMaterialSource.WAREHOUSE, WorkOrderMaterialSource.PREPARATION].includes(
        line.sourceType,
      ) ||
      !line.warehouseId
    ) {
      throw new BadRequestException('手工材料明细没有库存出库证据，不能进入普通材料审批提交');
    }

    const snapshotQuantity = normalizePositiveQuantity(inventory?.quantity ?? material.quantity);
    const snapshotUnitPrice = normalizePositiveMoney(inventory?.unitPrice);
    if (
      line.materialId !== materialId ||
      line.warehouseId !== warehouseId ||
      line.sourceType !== inventory?.sourceType ||
      !snapshotQuantity ||
      !snapshotUnitPrice ||
      normalizeQuantity(line.quantity) !== snapshotQuantity ||
      normalizeMoney(line.unitPrice) !== snapshotUnitPrice ||
      normalizeMoney(line.totalPrice) !== snapshotAmount
    ) {
      throw new BadRequestException('工单材料成本已经变化，请重新生成并人工核对草稿');
    }

    const workOrderEntity = await manager.getRepository(WorkOrder).findOne({
      where: { id: workOrderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!workOrderEntity) {
      throw new BadRequestException('草稿关联工单不存在，请重新生成草稿');
    }

    const allowedWorkOrderStatuses = new Set<WorkOrderStatus>([
      WorkOrderStatus.PAID,
      WorkOrderStatus.COMPLETED,
      WorkOrderStatus.CLOSED,
    ]);
    const amountDueCents = moneyCents(workOrderEntity.amountDue);
    const amountReceivedCents = moneyCents(workOrderEntity.amountReceived);
    if (
      !allowedWorkOrderStatuses.has(workOrderEntity.status) ||
      amountDueCents <= 0n ||
      amountReceivedCents <= 0n ||
      amountReceivedCents < amountDueCents
    ) {
      throw new BadRequestException('工单尚未完成收款或结算，不能提交材料审批');
    }

    const materialEntity = await manager.getRepository(Material).findOne({
      where: { id: materialId },
      lock: { mode: 'pessimistic_write' },
    });
    const currentSupplierId = positiveInteger(materialEntity?.defaultSupplierId);
    if (
      !materialEntity ||
      materialEntity.id !== line.materialId ||
      currentSupplierId !== snapshotSupplierId
    ) {
      throw new BadRequestException('材料默认供应商已经变化，请重新生成并人工核对草稿');
    }

    let supplierStatus: string | null = null;
    if (snapshotSupplierId) {
      const supplierEntity = await manager.getRepository(Supplier).findOne({
        where: { id: snapshotSupplierId },
        lock: { mode: 'pessimistic_write' },
      });
      supplierStatus = supplierEntity ? String(supplierEntity.status) : null;
      if (!supplierEntity || supplierStatus !== snapshotSupplierStatus) {
        throw new BadRequestException('供应商状态已经变化，请重新生成并人工核对草稿');
      }
    }

    const relatedTransactions = await manager.getRepository(InventoryTransaction).find({
      where: {
        relatedWorkOrderMaterialId: line.id,
      },
      order: { createdAt: 'ASC', id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });

    const latestTransaction = relatedTransactions[relatedTransactions.length - 1];
    if (
      !latestTransaction ||
      latestTransaction.transactionType !== InventoryTransactionType.OUTBOUND ||
      latestTransaction.relatedWorkOrderId !== line.workOrderId ||
      latestTransaction.relatedWorkOrderMaterialId !== line.id ||
      latestTransaction.warehouseId !== line.warehouseId ||
      latestTransaction.materialId !== line.materialId ||
      normalizeQuantity(latestTransaction.quantity) !== normalizeQuantity(line.quantity) ||
      normalizeMoney(latestTransaction.unitPrice) !== normalizeMoney(line.unitPrice) ||
      normalizeMoney(latestTransaction.totalPrice) !== normalizeMoney(line.totalPrice)
    ) {
      throw new BadRequestException('未找到与工单材料对应的正式出库流水，不能提交审批');
    }

    return {
      candidateRef: draft.candidateRef,
      candidateType: draft.candidateType,
      sourceSystem: draft.sourceSystem,
      sourceEntityType: 'work_order_materials',
      sourceRef: expectedSourceRef,
      amount: snapshotAmount,
      workOrderId,
      workOrderMaterialId,
      materialId: line.materialId,
      warehouseId: line.warehouseId,
      supplierId: snapshotSupplierId,
      supplierStatus,
      sourceType: line.sourceType,
      quantity: normalizeQuantity(line.quantity),
      unitPrice: normalizeMoney(line.unitPrice),
      workOrderStatus: workOrderEntity.status,
      workOrderAmountDue: normalizeMoney(workOrderEntity.amountDue),
      workOrderAmountReceived: normalizeMoney(workOrderEntity.amountReceived),
      outboundInventoryTransactionIds: [latestTransaction.id],
      displaySummary: buildDisplaySummary(summary),
    };
  }

  private readStoredSubmissionEvidence(draft: ApprovalRequestDraft): SubmissionEvidence {
    return parseStoredSubmissionEvidence(draft);
  }

  private buildSubmissionResponse(
    draft: ApprovalRequestDraft,
    approvalRequest: ApprovalRequest,
    evidence: SubmissionEvidence,
    idempotentReplay: boolean,
  ) {
    return {
      draft: {
        id: draft.id,
        draftNo: draft.draftNo,
        draftStatus: draft.draftStatus,
        linkedApprovalRequestId: draft.linkedApprovalRequestId,
      },
      approvalRequest: {
        id: approvalRequest.id,
        approvalNo: approvalRequest.approvalNo,
        status: approvalRequest.currentStatus,
        relatedWorkOrderId: approvalRequest.relatedWorkOrderId,
        amount: approvalRequest.amount,
      },
      linkedEvidence: evidence,
      idempotentReplay,
      boundary: buildDraftSubmissionBoundary(),
    };
  }

  private async lockPreviewSource(
    manager: EntityManager,
    preview: ApprovalWarehouseEvidenceCandidatePreview,
  ): Promise<WorkOrderMaterial | null> {
    if (
      preview.sourceSystem !== 'stark_work_order' ||
      preview.sourceEntityType !== 'work_order_materials'
    ) {
      return null;
    }

    const workOrderMaterialId = positiveInteger(preview.sourceRef.split(':').pop());
    if (!workOrderMaterialId) {
      throw new BadRequestException('工单材料证据来源引用无效，禁止创建审批草稿');
    }

    const source = await manager.getRepository(WorkOrderMaterial).findOne({
      where: { id: workOrderMaterialId, deletedAt: IsNull() },
      lock: { mode: 'pessimistic_write' },
    });
    if (!source) {
      throw new BadRequestException('工单材料证据已不存在，请刷新候选后重试');
    }
    return source;
  }

  private buildDraftResponse(draft: ApprovalRequestDraft, idempotentReplay: boolean) {
    return {
      draft: {
        id: draft.id,
        draftNo: draft.draftNo,
        candidateRef: draft.candidateRef,
        idempotencyKey: draft.idempotencyKey,
        previewIdempotencyKey: readPreviewIdempotencyKey(draft),
        evidenceRevision: readEvidenceRevision(draft),
        candidateType: draft.candidateType,
        sourceSystem: draft.sourceSystem,
        sourceEntityType: draft.sourceEntityType,
        sourceRef: draft.sourceRef,
        amount: draft.amount,
        draftReason: draft.draftReason,
        draftStatus: draft.draftStatus,
        evidenceSnapshot: draft.evidenceSnapshotJson,
        learningContext: draft.learningContextJson,
        aiSuggestionSnapshot: draft.aiSuggestionSnapshotJson,
        createdByUserId: draft.createdByUserId,
        linkedApprovalRequestId: draft.linkedApprovalRequestId,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      },
      idempotentReplay,
      boundary: buildManualDraftBoundary(),
    };
  }
}

function assertDraftSubmitterSeparated(draft: ApprovalRequestDraft, submitterUserId: number) {
  const creatorUserId = positiveInteger(draft.createdByUserId);
  const normalizedSubmitterUserId = positiveInteger(submitterUserId);
  if (!creatorUserId || !normalizedSubmitterUserId) {
    throw new BadRequestException(
      '[approval_actor_chain_inconsistent] 审批草稿缺少有效的经办人或提交人身份',
    );
  }
  if (creatorUserId === normalizedSubmitterUserId) {
    throw new ForbiddenException(
      '[approval_actor_not_separated] 审批草稿经办人与提交人必须分离，请交由另一名财务人员提交',
    );
  }
}

export function assertSubmittedApprovalDraftActorChain(
  draft: ApprovalRequestDraft,
  approvalRequest: ApprovalRequest,
  decisionUserId?: number,
) {
  const learningContext = asRecord(draft.learningContextJson);
  const creatorUserId = positiveInteger(draft.createdByUserId);
  const submitterUserId = positiveInteger(learningContext?.submittedByUserId);
  const applicantUserId = positiveInteger(approvalRequest.applicantUserId);

  if (
    draft.draftStatus !== 'submitted' ||
    draft.linkedApprovalRequestId !== approvalRequest.id ||
    !creatorUserId ||
    !submitterUserId ||
    !applicantUserId ||
    submitterUserId !== applicantUserId ||
    creatorUserId === submitterUserId
  ) {
    throw new BadRequestException(
      '[approval_actor_chain_inconsistent] 审批单的经办、提交或申请人身份链不一致，请人工复核',
    );
  }

  if (decisionUserId !== undefined) {
    const approverUserId = positiveInteger(decisionUserId);
    if (!approverUserId) {
      throw new ForbiddenException('[approval_role_forbidden] 当前审批人身份无效，不能执行审批');
    }
    if (approverUserId === creatorUserId || approverUserId === submitterUserId) {
      throw new ForbiddenException(
        '[approval_actor_not_separated] 经办人、提交人和审批人必须三方分离，请交由独立审批人处理',
      );
    }
  }

  return { creatorUserId, submitterUserId, applicantUserId };
}

export async function assertSubmittedApprovalDraftEvidenceCurrent(
  manager: EntityManager,
  draft: ApprovalRequestDraft,
  approvalRequest: ApprovalRequest,
) {
  const evidence = parseStoredSubmissionEvidence(draft);
  const stale = (reason: string): never => {
    throw new BadRequestException(
      `[approval_evidence_stale] ${reason}，请驳回当前审批并从最新证据重新创建草稿`,
    );
  };

  if (
    draft.draftStatus !== 'submitted' ||
    draft.linkedApprovalRequestId !== approvalRequest.id ||
    draft.candidateRef !== evidence.candidateRef ||
    draft.sourceSystem !== evidence.sourceSystem ||
    draft.sourceEntityType !== evidence.sourceEntityType ||
    draft.sourceRef !== evidence.sourceRef ||
    approvalRequest.relatedWorkOrderId !== evidence.workOrderId ||
    normalizeMoney(approvalRequest.amount) !== evidence.amount
  ) {
    stale('审批单、草稿与冻结证据关联不一致');
  }

  const line = await manager.getRepository(WorkOrderMaterial).findOne({
    where: { id: evidence.workOrderMaterialId, deletedAt: IsNull() },
    lock: { mode: 'pessimistic_write' },
  });
  if (
    !line ||
    line.workOrderId !== evidence.workOrderId ||
    line.materialId !== evidence.materialId ||
    line.warehouseId !== evidence.warehouseId ||
    line.sourceType !== evidence.sourceType ||
    normalizeQuantity(line.quantity) !== evidence.quantity ||
    normalizeMoney(line.unitPrice) !== evidence.unitPrice ||
    normalizeMoney(line.totalPrice) !== evidence.amount
  ) {
    stale('工单材料明细已删除或发生变化');
  }

  const workOrder = await manager.getRepository(WorkOrder).findOne({
    where: { id: evidence.workOrderId },
    lock: { mode: 'pessimistic_write' },
  });
  const allowedStatuses = new Set<WorkOrderStatus>([
    WorkOrderStatus.PAID,
    WorkOrderStatus.COMPLETED,
    WorkOrderStatus.CLOSED,
  ]);
  if (
    !workOrder ||
    !allowedStatuses.has(workOrder.status) ||
    workOrder.status !== evidence.workOrderStatus ||
    normalizeMoney(workOrder.amountDue) !== evidence.workOrderAmountDue ||
    normalizeMoney(workOrder.amountReceived) !== evidence.workOrderAmountReceived ||
    moneyCents(workOrder.amountDue) <= 0n ||
    moneyCents(workOrder.amountReceived) < moneyCents(workOrder.amountDue)
  ) {
    stale('工单状态或结算证据已发生变化');
  }

  const material = await manager.getRepository(Material).findOne({
    where: { id: evidence.materialId },
    lock: { mode: 'pessimistic_write' },
  });
  if (
    !material ||
    material.id !== evidence.materialId ||
    positiveInteger(material.defaultSupplierId) !== evidence.supplierId
  ) {
    stale('材料默认供应商已发生变化');
  }

  if (evidence.supplierId) {
    const supplier = await manager.getRepository(Supplier).findOne({
      where: { id: evidence.supplierId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!supplier || String(supplier.status) !== evidence.supplierStatus) {
      stale('供应商状态已发生变化');
    }
  }

  const latestTransaction = await manager.getRepository(InventoryTransaction).findOne({
    where: { relatedWorkOrderMaterialId: evidence.workOrderMaterialId },
    order: { createdAt: 'DESC', id: 'DESC' },
    lock: { mode: 'pessimistic_write' },
  });
  if (
    evidence.outboundInventoryTransactionIds.length !== 1 ||
    !latestTransaction ||
    latestTransaction.id !== evidence.outboundInventoryTransactionIds[0] ||
    latestTransaction.transactionType !== InventoryTransactionType.OUTBOUND ||
    latestTransaction.relatedWorkOrderId !== evidence.workOrderId ||
    latestTransaction.relatedWorkOrderMaterialId !== evidence.workOrderMaterialId ||
    latestTransaction.warehouseId !== evidence.warehouseId ||
    latestTransaction.materialId !== evidence.materialId ||
    normalizeQuantity(latestTransaction.quantity) !== evidence.quantity ||
    normalizeMoney(latestTransaction.unitPrice) !== evidence.unitPrice ||
    normalizeMoney(latestTransaction.totalPrice) !== evidence.amount
  ) {
    stale('最新库存流水不再是冻结的正式出库证据');
  }

  return evidence;
}

function parseStoredSubmissionEvidence(draft: ApprovalRequestDraft): SubmissionEvidence {
  const learningContext = asRecord(draft.learningContextJson);
  const stored = asRecord(learningContext?.submissionEvidence);
  const workOrderId = positiveInteger(stored?.workOrderId);
  const workOrderMaterialId = positiveInteger(stored?.workOrderMaterialId);
  const materialId = positiveInteger(stored?.materialId);
  const warehouseId = positiveInteger(stored?.warehouseId);
  const supplierIdFieldPresent = hasOwn(stored, 'supplierId');
  const supplierStatusFieldPresent = hasOwn(stored, 'supplierStatus');
  const rawSupplierId = stored?.supplierId;
  const rawSupplierStatus = stored?.supplierStatus;
  const supplierId = rawSupplierId === null || rawSupplierId === undefined
    ? null
    : positiveInteger(rawSupplierId);
  const supplierStatus = nonEmptyString(rawSupplierStatus);
  const supplierEvidenceExplicitNull = rawSupplierId === null && rawSupplierStatus === null;
  const supplierEvidencePopulated = supplierId !== null && supplierStatus !== null;
  const amount = normalizePositiveMoney(stored?.amount);
  const quantity = normalizePositiveQuantity(stored?.quantity);
  const unitPrice = normalizePositiveMoney(stored?.unitPrice);
  const outboundIds = Array.isArray(stored?.outboundInventoryTransactionIds)
    ? stored.outboundInventoryTransactionIds
        .map((item) => positiveInteger(item))
        .filter((item): item is number => Boolean(item))
    : [];

  const sourceType = stored?.sourceType;
  const workOrderStatus = stored?.workOrderStatus;
  if (
    !stored ||
    !workOrderId ||
    !workOrderMaterialId ||
    !materialId ||
    !warehouseId ||
    !amount ||
    !quantity ||
    !unitPrice ||
    !outboundIds.length ||
    !supplierIdFieldPresent ||
    !supplierStatusFieldPresent ||
    (!supplierEvidenceExplicitNull && !supplierEvidencePopulated) ||
    stored.sourceEntityType !== 'work_order_materials' ||
    stored.sourceSystem !== 'stark_work_order' ||
    stored.candidateType !== 'reimbursement' ||
    ![WorkOrderMaterialSource.WAREHOUSE, WorkOrderMaterialSource.PREPARATION].includes(
      sourceType as WorkOrderMaterialSource,
    ) ||
    ![WorkOrderStatus.PAID, WorkOrderStatus.COMPLETED, WorkOrderStatus.CLOSED].includes(
      workOrderStatus as WorkOrderStatus,
    )
  ) {
    throw new BadRequestException('已提交草稿缺少完整提交证据，请先人工复核');
  }

  return {
    candidateRef: String(stored.candidateRef ?? draft.candidateRef),
    candidateType: 'reimbursement',
    sourceSystem: 'stark_work_order',
    sourceEntityType: 'work_order_materials',
    sourceRef: String(stored.sourceRef ?? draft.sourceRef),
    amount,
    workOrderId,
    workOrderMaterialId,
    materialId,
    warehouseId,
    supplierId,
    supplierStatus,
    sourceType: sourceType as WorkOrderMaterialSource,
    quantity,
    unitPrice,
    workOrderStatus: workOrderStatus as WorkOrderStatus,
    workOrderAmountDue: normalizeMoney(String(stored.workOrderAmountDue ?? '0')),
    workOrderAmountReceived: normalizeMoney(String(stored.workOrderAmountReceived ?? '0')),
    outboundInventoryTransactionIds: outboundIds,
    displaySummary: asRecord(stored.displaySummary) ?? {},
  };
}

function buildEvidenceSnapshot(
  preview: ApprovalWarehouseEvidenceCandidatePreview,
  internalIdempotencyKey: string,
  evidenceRevision: number,
) {
  return scrubSensitiveValue({
    candidateRef: preview.candidateRef,
    idempotencyKey: internalIdempotencyKey,
    previewIdempotencyKey: preview.idempotencyKey,
    evidenceRevision,
    candidateType: preview.candidateType,
    sourceSystem: preview.sourceSystem,
    sourceEntityType: preview.sourceEntityType,
    sourceRef: preview.sourceRef,
    evidenceSummary: preview.evidenceSummary,
    amount: preview.amount,
    status: preview.status,
    requiredGuards: preview.requiredGuards,
    redactionPolicy: preview.redactionPolicy,
    auditPolicy: preview.auditPolicy,
    boundary: preview.boundary,
  });
}

function buildLearningContext(
  preview: ApprovalWarehouseEvidenceCandidatePreview,
  dto: CreateApprovalRequestDraftFromWarehousePreviewDto,
  aiSuggestionSnapshot: Record<string, unknown> | null,
) {
  const reasonCodes = scrubStringList(dto.reasonCodes ?? []);
  const riskLabels = scrubStringList([
    ...(dto.riskLabels ?? []),
    ...deriveRiskLabels(preview),
  ]);

  return scrubSensitiveValue({
    humanDecision: null,
    decisionReason: null,
    reasonCodes,
    riskLabels,
    evidenceCompleteness: deriveEvidenceCompleteness(preview),
    amountConfidence: preview.amount ? 'medium' : 'unknown',
    supplierConfidence:
      preview.candidateType === 'supplier_payment' || preview.evidenceSummary.supplier
        ? 'medium'
        : 'unknown',
    materialPriceConfidence: preview.amount ? 'medium' : 'unknown',
    requiresOwnerReview: preview.status === 'owner_review_required',
    requiresFinanceReview: true,
    aiSuggestionSnapshot,
    humanOverrideAiSuggestion: null,
  });
}

function buildManualDraftBoundary(): ManualDraftBoundary {
  return {
    manualDraftOnly: true,
    humanApprovalRequired: true,
    aiAutoApprovalEnabled: false,
    createsApprovalRequest: false,
    createsPaymentIntent: false,
    executesPayment: false,
    confirmsBankSms: false,
    writesOldAbc: false,
    mutatesVirtualLedger: false,
    mutatesFinanceReconciliation: false,
  };
}

function buildDraftSubmissionBoundary(): DraftSubmissionBoundary {
  return {
    manualSubmission: true,
    humanApprovalRequired: true,
    independentApproverRequired: true,
    createsApprovalRequest: true,
    createsPaymentIntent: false,
    executesPayment: false,
    confirmsBankSms: false,
    writesOldAbc: false,
    mutatesInventory: false,
    mutatesVirtualLedger: false,
    mutatesFinanceReconciliation: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hasOwn(record: Record<string, unknown> | null, key: string) {
  return Boolean(record) && Object.prototype.hasOwnProperty.call(record, key);
}

function normalizePositiveMoney(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = normalizeMoney(String(value));
  return Number(normalized) > 0 ? normalized : null;
}

function normalizePositiveQuantity(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = normalizeQuantity(String(value));
  return Number(normalized) > 0 ? normalized : null;
}

function moneyCents(value: string | number) {
  return BigInt(normalizeMoney(value).replace('.', ''));
}

function buildDisplaySummary(summary: Record<string, unknown> | null) {
  const workOrder = asRecord(summary?.workOrder);
  const material = asRecord(summary?.material);
  const warehouse = asRecord(summary?.warehouse);
  const supplier = asRecord(summary?.supplier);

  return scrubSensitiveValue({
    workOrder: pickFields(workOrder, ['workOrderId', 'workOrderNo', 'title', 'status']),
    material: pickFields(material, ['materialId', 'materialNo', 'name', 'unit', 'quantity']),
    warehouse: pickFields(warehouse, ['warehouseId', 'warehouseNo', 'name', 'code', 'status']),
    supplier: pickFields(supplier, ['supplierId', 'supplierNo', 'name', 'status']),
  });
}

function readPreviewIdempotencyKey(draft: ApprovalRequestDraft) {
  const snapshot = asRecord(draft.evidenceSnapshotJson);
  return String(snapshot?.previewIdempotencyKey ?? snapshot?.idempotencyKey ?? draft.idempotencyKey);
}

function readEvidenceRevision(draft: ApprovalRequestDraft) {
  const snapshot = asRecord(draft.evidenceSnapshotJson);
  return positiveInteger(snapshot?.evidenceRevision) ?? 0;
}

function buildDraftIdempotencyKey(
  candidateRef: string,
  previewIdempotencyKey: string,
  evidenceRevision: number,
) {
  const candidateHash = createHash('sha256').update(candidateRef).digest('hex').slice(0, 16);
  const evidenceHash = createHash('sha256')
    .update(previewIdempotencyKey)
    .digest('hex')
    .slice(0, 16);
  return `approval_request_draft:${candidateHash}:r${evidenceRevision}:${evidenceHash}`;
}

function pickFields(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) {
    return null;
  }

  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (record[key] !== undefined) {
      result[key] = record[key];
    }
  }
  return result;
}

function deriveEvidenceCompleteness(preview: ApprovalWarehouseEvidenceCandidatePreview) {
  if (preview.status === 'evidence_ready') {
    return 'evidence_ready';
  }

  if (preview.status === 'owner_review_required') {
    return 'owner_review_required';
  }

  return 'partial';
}

function deriveRiskLabels(preview: ApprovalWarehouseEvidenceCandidatePreview) {
  const labels = new Set<string>();

  if (!preview.amount) {
    labels.add('amount_missing');
  }
  if (preview.status === 'owner_review_required') {
    labels.add('owner_review_required');
  }
  if (preview.requiredGuards.length) {
    labels.add('guard_review_required');
  }

  return Array.from(labels);
}

function scrubStringList(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => scrubOptionalText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function scrubOptionalText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return scrubText(trimmed).slice(0, 500);
}

function scrubSensitiveValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return scrubText(value) as T;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveValue(item)) as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenSnapshotKey(key)) {
        continue;
      }
      result[key] = scrubSensitiveValue(childValue);
    }
    return result as T;
  }

  return value;
}

function isForbiddenSnapshotKey(key: string) {
  return [
    /phone/i,
    /mobile/i,
    /bank.*account/i,
    /raw.*sms/i,
    /raw.*payload/i,
    /raw.*json/i,
    /normalized.*payload/i,
    /token/i,
    /secret/i,
    /credential/i,
    /password/i,
    /private.*key/i,
  ].some((pattern) => pattern.test(key));
}

function scrubText(value: string) {
  return value
    .replace(/\b1[3-9]\d{9}\b/g, '[redacted-phone]')
    .replace(/\b\d{13,19}\b/g, '[redacted-number]')
    .replace(/BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY/gi, '[redacted-sensitive]')
    .replace(/private\s+key/gi, '[redacted-sensitive]')
    .replace(/password/gi, '[redacted-sensitive]')
    .replace(/token/gi, '[redacted-sensitive]')
    .replace(/secret/gi, '[redacted-sensitive]')
    .replace(/credential/gi, '[redacted-sensitive]');
}
