import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  addQuantity,
  compareQuantity,
  multiplyMoney,
  normalizeMoney,
  normalizeQuantity,
  subtractQuantity,
} from '../../common/utils/decimal.util';
import { buildPaginationResult, getPagination } from '../../common/utils/pagination.util';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { ApprovalStatus } from '../../shared/enums/approval-status.enum';
import { ApprovalType } from '../../shared/enums/approval-type.enum';
import { InventoryAdjustmentAction } from '../../shared/enums/inventory-adjustment-action.enum';
import { InventoryTransactionEntryKind } from '../../shared/enums/inventory-transaction-entry-kind.enum';
import { InventoryTransactionType } from '../../shared/enums/inventory-transaction-type.enum';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { ApprovalLog } from '../approval-requests/entities/approval-log.entity';
import { ApprovalRequest } from '../approval-requests/entities/approval-request.entity';
import { MaterialPreparation } from '../material-preparations/entities/material-preparation.entity';
import { Material } from '../materials/entities/material.entity';
import { MaterialStock } from '../material-stocks/entities/material-stock.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SequenceService } from '../sequence/sequence.service';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { CreateInventoryInboundDto } from './dto/create-inventory-inbound.dto';
import { CreateInventoryOutboundDto } from './dto/create-inventory-outbound.dto';
import { ApplyInventoryAdjustmentDto } from './dto/apply-inventory-adjustment.dto';
import { QueryInventoryTransactionsDto } from './dto/query-inventory-transactions.dto';
import { RequestInventoryAdjustmentApprovalDto } from './dto/request-inventory-adjustment-approval.dto';
import { InventoryTransaction } from './entities/inventory-transaction.entity';

interface RecordInventoryTransactionInput {
  transactionType: InventoryTransactionType;
  warehouseId: number;
  materialId: number;
  quantity: string;
  unitPrice: string;
  relatedWorkOrderId?: number | null;
  relatedPreparationId?: number | null;
  relatedWorkOrderMaterialId?: number | null;
  remark?: string;
  requestIdempotencyKey?: string | null;
  entryKind?: InventoryTransactionEntryKind;
  sourceTransactionId?: number | null;
  approvalRequestId?: number | null;
  adjustmentReason?: string | null;
}

interface FindInventoryTransactionFilters {
  transactionType?: InventoryTransactionType;
  relatedPreparationId?: number;
  relatedWorkOrderMaterialId?: number;
  materialId?: number;
  warehouseId?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'transactionType' | 'quantity' | 'unitPrice' | 'totalPrice';
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
}

const INVENTORY_TRANSACTION_SORT_COLUMNS: Record<
  NonNullable<FindInventoryTransactionFilters['sortBy']>,
  string
> = {
  createdAt: 'transaction.created_at',
  transactionType: 'transaction.transaction_type',
  quantity: 'transaction.quantity',
  unitPrice: 'transaction.unit_price',
  totalPrice: 'transaction.total_price',
};

@Injectable()
export class InventoryTransactionsService {
  constructor(
    @InjectRepository(InventoryTransaction)
    private readonly inventoryTransactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(MaterialStock)
    private readonly materialStockRepository: Repository<MaterialStock>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Material)
    private readonly materialRepository: Repository<Material>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(MaterialPreparation)
    private readonly materialPreparationRepository: Repository<MaterialPreparation>,
    @InjectRepository(WorkOrderMaterial)
    private readonly workOrderMaterialRepository: Repository<WorkOrderMaterial>,
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async createInbound(dto: CreateInventoryInboundDto, currentUser: CurrentUser) {
    return this.executeDirectInventoryRequest(
      {
        transactionType: InventoryTransactionType.INBOUND,
        ...dto,
      },
      currentUser,
    );
  }

  async createOutbound(dto: CreateInventoryOutboundDto, currentUser: CurrentUser) {
    return this.executeDirectInventoryRequest(
      {
        transactionType: InventoryTransactionType.OUTBOUND,
        ...dto,
      },
      currentUser,
    );
  }

  async requestAdjustmentApproval(
    sourceTransactionId: number,
    dto: RequestInventoryAdjustmentApprovalDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const transactionRepo = manager.getRepository(InventoryTransaction);
      const approvalRepo = manager.getRepository(ApprovalRequest);
      const approvalLogRepo = manager.getRepository(ApprovalLog);
      const source = await transactionRepo.findOne({
        where: { id: sourceTransactionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!source) {
        throw new NotFoundException('库存流水不存在');
      }
      if (source.entryKind !== InventoryTransactionEntryKind.ORIGINAL) {
        throw new BadRequestException(
          '[inventory_adjustment_source_invalid] 只能对原始库存流水申请冲销或调整',
        );
      }
      this.assertOriginalSourceEvidence(source);
      if (source.relatedWorkOrderMaterialId) {
        throw new BadRequestException(
          '[work_order_material_correction_contract_required] 工单材料库存流水必须由专用的工单材料修正合同同步变更业务行；本窗口保持 fail-closed',
        );
      }

      const normalizedTarget = this.normalizeAdjustmentTarget(source, dto);
      const fingerprint = this.buildAdjustmentRequestFingerprint(
        source,
        dto.action,
        dto.reason,
        normalizedTarget.quantity,
        normalizedTarget.unitPrice,
        currentUser.id,
      );

      const existingByKey = await approvalRepo.findOne({
        where: { requestIdempotencyKey: dto.requestIdempotencyKey },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingByKey) {
        this.assertMatchingFingerprint(existingByKey.requestFingerprint, fingerprint);
        return existingByKey;
      }

      const activeForSource = await approvalRepo.find({
        where: {
          approvalType: ApprovalType.INVENTORY_ADJUSTMENT,
          relatedInventoryTransactionId: source.id,
          currentStatus: In([ApprovalStatus.PENDING, ApprovalStatus.APPROVED]),
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (activeForSource.length > 0) {
        throw new BadRequestException(
          '[inventory_adjustment_already_active] 该原始流水已有待审或已通过的修正申请',
        );
      }

      const approvalNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.APPROVAL_REQUEST.bizType,
        BIZ_SEQUENCE_CONFIG.APPROVAL_REQUEST.prefix,
        manager,
      );
      const request = approvalRepo.create({
        approvalNo,
        approvalType: ApprovalType.INVENTORY_ADJUSTMENT,
        relatedWorkOrderId: null,
        relatedInventoryTransactionId: source.id,
        requestIdempotencyKey: dto.requestIdempotencyKey,
        requestFingerprint: fingerprint,
        inventoryAdjustmentAction: dto.action,
        inventoryTargetQuantity: normalizedTarget.quantity,
        inventoryTargetUnitPrice: normalizedTarget.unitPrice,
        executionIdempotencyKey: null,
        executionFingerprint: null,
        applicantUserId: currentUser.id,
        amount: source.totalPrice,
        reason: dto.reason.trim(),
        currentStatus: ApprovalStatus.PENDING,
        finalApproverId: null,
        verificationCode: dto.verificationCode?.trim() || null,
      });
      const saved = await approvalRepo.save(request);

      await approvalLogRepo.save(
        approvalLogRepo.create({
          approvalRequestId: saved.id,
          actionBy: currentUser.id,
          actionType: 'submitted',
          actionRemark: dto.reason.trim(),
        }),
      );
      await this.operationLogsService.create(
        {
          module: 'approval_request',
          targetId: saved.id,
          action: OperationLogAction.REQUEST_INVENTORY_ADJUSTMENT,
          operatorId: currentUser.id,
          detail: `提交库存${dto.action === InventoryAdjustmentAction.REVERSE ? '冲销' : '调整'}审批 ${saved.approvalNo}`,
          detailJson: {
            approvalType: saved.approvalType,
            sourceTransactionId: source.id,
            adjustmentAction: dto.action,
            requestFingerprint: fingerprint,
          },
        },
        manager,
      );

      return saved;
    });
  }

  async applyApprovedAdjustment(
    sourceTransactionId: number,
    dto: ApplyInventoryAdjustmentDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const approvalRepo = manager.getRepository(ApprovalRequest);
      const transactionRepo = manager.getRepository(InventoryTransaction);
      const source = await transactionRepo.findOne({
        where: { id: sourceTransactionId },
        lock: { mode: 'pessimistic_write' },
      });
      const approval = await approvalRepo.findOne({
        where: { id: dto.approvalRequestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!approval || !source) {
        throw new NotFoundException('库存流水或审批记录不存在');
      }
      this.assertOriginalSourceEvidence(source);
      this.assertApprovedAdjustmentExecution(approval, source, currentUser);
      this.assertMatchingFingerprint(
        approval.requestFingerprint,
        this.buildAdjustmentRequestFingerprint(
          source,
          approval.inventoryAdjustmentAction!,
          approval.reason,
          approval.inventoryTargetQuantity,
          approval.inventoryTargetUnitPrice,
          approval.applicantUserId,
        ),
      );

      const executionFingerprint = this.hashContract({
        contractVersion: 'p0c_inventory_adjustment_execution_v1',
        approvalRequestId: approval.id,
        approvalRequestFingerprint: approval.requestFingerprint,
        sourceTransactionId: source.id,
        action: approval.inventoryAdjustmentAction,
        targetQuantity: approval.inventoryTargetQuantity,
        targetUnitPrice: approval.inventoryTargetUnitPrice,
        executorUserId: currentUser.id,
      });

      if (approval.executionIdempotencyKey) {
        if (approval.executionIdempotencyKey !== dto.requestIdempotencyKey) {
          throw new BadRequestException(
            '[inventory_adjustment_execution_conflict] 该审批已由不同执行请求消费',
          );
        }
        this.assertMatchingFingerprint(approval.executionFingerprint, executionFingerprint);
        return this.loadAdjustmentExecutionResult(manager, approval);
      }

      const existingCorrections = await transactionRepo.find({
        where: { sourceTransactionId: source.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingCorrections.length > 0) {
        throw new BadRequestException(
          '[inventory_adjustment_source_already_corrected] 原始流水已存在冲销或调整记录',
        );
      }

      const isAdjustment =
        approval.inventoryAdjustmentAction === InventoryAdjustmentAction.ADJUST;
      if (
        isAdjustment &&
        (!approval.inventoryTargetQuantity || !approval.inventoryTargetUnitPrice)
      ) {
        throw new BadRequestException(
          '[inventory_adjustment_target_missing] 调整审批缺少不可变目标数量或单价',
        );
      }

      approval.executionIdempotencyKey = dto.requestIdempotencyKey;
      approval.executionFingerprint = executionFingerprint;
      await approvalRepo.save(approval);

      const recordReversal = () =>
        this.recordTransaction(
          {
          transactionType: this.oppositeTransactionType(source.transactionType),
          entryKind: InventoryTransactionEntryKind.REVERSAL,
          requestIdempotencyKey: this.deriveChildIdempotencyKey(
            dto.requestIdempotencyKey,
            'reversal',
          ),
          warehouseId: source.warehouseId,
          materialId: source.materialId,
          quantity: source.quantity,
          unitPrice: source.unitPrice,
          relatedWorkOrderId: source.relatedWorkOrderId,
          relatedPreparationId: source.relatedPreparationId,
          relatedWorkOrderMaterialId: source.relatedWorkOrderMaterialId,
          sourceTransactionId: source.id,
          approvalRequestId: approval.id,
          adjustmentReason: approval.reason,
          remark: `冲销原流水 ${source.transactionNo}`,
          },
          currentUser,
          manager,
        );

      const recordAdjustment = () =>
        this.recordTransaction(
          {
            transactionType: source.transactionType,
            entryKind: InventoryTransactionEntryKind.ADJUSTMENT,
            requestIdempotencyKey: this.deriveChildIdempotencyKey(
              dto.requestIdempotencyKey,
              'adjustment',
            ),
            warehouseId: source.warehouseId,
            materialId: source.materialId,
            quantity: approval.inventoryTargetQuantity!,
            unitPrice: approval.inventoryTargetUnitPrice!,
            relatedWorkOrderId: source.relatedWorkOrderId,
            relatedPreparationId: source.relatedPreparationId,
            relatedWorkOrderMaterialId: source.relatedWorkOrderMaterialId,
            sourceTransactionId: source.id,
            approvalRequestId: approval.id,
            adjustmentReason: approval.reason,
            remark: `按审批调整原流水 ${source.transactionNo}`,
          },
          currentUser,
          manager,
        );

      let reversal: InventoryTransaction;
      let adjustment: InventoryTransaction | null = null;
      if (isAdjustment && source.transactionType === InventoryTransactionType.INBOUND) {
        // Apply the replacement inbound before its reversal so availability is
        // checked against the final net quantity, not a transient negative state.
        adjustment = await recordAdjustment();
        reversal = await recordReversal();
      } else {
        reversal = await recordReversal();
        if (isAdjustment) {
          adjustment = await recordAdjustment();
        }
      }

      return {
        sourceTransactionId: source.id,
        approvalRequestId: approval.id,
        action: approval.inventoryAdjustmentAction,
        reversal,
        adjustment,
        executionFingerprint,
      };
    });
  }

  private async executeDirectInventoryRequest(
    input: RecordInventoryTransactionInput,
    currentUser: CurrentUser,
  ) {
    try {
      return await this.dataSource.transaction((manager) =>
        this.recordTransaction(input, currentUser, manager),
      );
    } catch (error) {
      if (!input.requestIdempotencyKey || !this.isDuplicateEntryError(error)) {
        throw error;
      }
      const existing = await this.inventoryTransactionRepository.findOne({
        where: { requestIdempotencyKey: input.requestIdempotencyKey },
      });
      if (!existing) {
        throw error;
      }
      const fingerprint = this.buildInventoryRequestFingerprint(input, currentUser);
      this.assertMatchingFingerprint(existing.requestFingerprint, fingerprint);
      return existing;
    }
  }

  async recordTransaction(
    input: RecordInventoryTransactionInput,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    if (!manager) {
      throw new BadRequestException(
        '[inventory_transaction_requires_transaction] 库存变更必须在调用方事务内执行',
      );
    }
    const executor = manager;
    const warehouseRepo = executor.getRepository(Warehouse);
    const materialRepo = executor.getRepository(Material);
    const workOrderRepo = executor.getRepository(WorkOrder);
    const preparationRepo = executor.getRepository(MaterialPreparation);
    const workOrderMaterialRepo = executor.getRepository(WorkOrderMaterial);
    const stockRepo = executor.getRepository(MaterialStock);
    const transactionRepo = executor.getRepository(InventoryTransaction);

    const quantity = normalizeQuantity(input.quantity);
    const unitPrice = normalizeMoney(input.unitPrice);
    if (compareQuantity(quantity, '0.00') <= 0) {
      throw new BadRequestException('库存数量必须大于 0');
    }
    const totalPrice = multiplyMoney(quantity, unitPrice);
    const normalizedInput: RecordInventoryTransactionInput = {
      ...input,
      quantity,
      unitPrice,
      entryKind: input.entryKind ?? InventoryTransactionEntryKind.ORIGINAL,
      requestIdempotencyKey: input.requestIdempotencyKey?.trim() || null,
      sourceTransactionId: input.sourceTransactionId ?? null,
      approvalRequestId: input.approvalRequestId ?? null,
      adjustmentReason: input.adjustmentReason?.trim() || null,
      remark: input.remark?.trim() || undefined,
    };
    const requestFingerprint = normalizedInput.requestIdempotencyKey
      ? this.buildInventoryRequestFingerprint(normalizedInput, currentUser)
      : null;

    if (normalizedInput.requestIdempotencyKey) {
      const existing = await transactionRepo.findOne({
        where: { requestIdempotencyKey: normalizedInput.requestIdempotencyKey },
      });
      if (existing) {
        this.assertMatchingFingerprint(existing.requestFingerprint, requestFingerprint);
        return existing;
      }
    }

    const [warehouse, material] = await Promise.all([
      warehouseRepo.findOne({ where: { id: input.warehouseId } }),
      materialRepo.findOne({ where: { id: input.materialId } }),
    ]);

    if (!warehouse) {
      throw new NotFoundException('库房不存在');
    }

    if (!material) {
      throw new NotFoundException('材料不存在');
    }

    if (input.relatedWorkOrderId) {
      const workOrder = await workOrderRepo.findOne({
        where: { id: input.relatedWorkOrderId },
      });

      if (!workOrder) {
        throw new NotFoundException('工单不存在');
      }
    }

    if (input.relatedPreparationId) {
      const preparation = await preparationRepo.findOne({
        where: { id: input.relatedPreparationId },
      });

      if (!preparation) {
        throw new NotFoundException('备料记录不存在');
      }
    }

    if (input.relatedWorkOrderMaterialId) {
      const workOrderMaterial = await workOrderMaterialRepo.findOne({
        where: { id: input.relatedWorkOrderMaterialId },
      });

      if (!workOrderMaterial) {
        throw new NotFoundException('工单材料明细不存在');
      }
    }

    await stockRepo
      .createQueryBuilder()
      .insert()
      .into(MaterialStock)
      .values({
        warehouseId: input.warehouseId,
        materialId: input.materialId,
        currentQuantity: '0.00',
      })
      .orIgnore()
      .execute();

    const stock = await stockRepo.findOne({
      where: {
        warehouseId: input.warehouseId,
        materialId: input.materialId,
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!stock) {
      throw new BadRequestException(
        '[inventory_stock_lock_missing] 无法建立库存行级锁，库存未发生变化',
      );
    }

    if (normalizedInput.requestIdempotencyKey) {
      const existingAfterStockLock = await transactionRepo.findOne({
        where: { requestIdempotencyKey: normalizedInput.requestIdempotencyKey },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingAfterStockLock) {
        this.assertMatchingFingerprint(
          existingAfterStockLock.requestFingerprint,
          requestFingerprint,
        );
        return existingAfterStockLock;
      }
    }

    if (
      input.transactionType === InventoryTransactionType.OUTBOUND &&
      compareQuantity(stock.currentQuantity, quantity) < 0
    ) {
      throw new BadRequestException('库存数量不足');
    }

    stock.currentQuantity =
      input.transactionType === InventoryTransactionType.INBOUND
        ? addQuantity(stock.currentQuantity, quantity)
        : subtractQuantity(stock.currentQuantity, quantity);
    await stockRepo.save(stock);

    const transactionNo = await this.sequenceService.generateBizNo(
      BIZ_SEQUENCE_CONFIG.INVENTORY_TRANSACTION.bizType,
      BIZ_SEQUENCE_CONFIG.INVENTORY_TRANSACTION.prefix,
      executor,
    );

    const record = transactionRepo.create({
      transactionNo,
      transactionType: normalizedInput.transactionType,
      entryKind: normalizedInput.entryKind,
      requestIdempotencyKey: normalizedInput.requestIdempotencyKey,
      requestFingerprint,
      warehouseId: input.warehouseId,
      materialId: input.materialId,
      quantity,
      unitPrice,
      totalPrice,
      relatedWorkOrderId: normalizedInput.relatedWorkOrderId ?? null,
      relatedPreparationId: normalizedInput.relatedPreparationId ?? null,
      relatedWorkOrderMaterialId: normalizedInput.relatedWorkOrderMaterialId ?? null,
      remark: normalizedInput.remark ?? null,
      sourceTransactionId: normalizedInput.sourceTransactionId ?? null,
      approvalRequestId: normalizedInput.approvalRequestId ?? null,
      adjustmentReason: normalizedInput.adjustmentReason ?? null,
      createdBy: currentUser.id,
    });
    const saved = await transactionRepo.save(record);

    await this.operationLogsService.create(
      {
        module: 'inventory_transaction',
        targetId: saved.id,
        action: this.resolveInventoryOperationLogAction(saved),
        operatorId: currentUser.id,
        detail: `${
          input.transactionType === InventoryTransactionType.INBOUND ? '入库' : '出库'
        }交易 ${saved.transactionNo}`,
        detailJson: {
          transactionNo: saved.transactionNo,
          transactionType: saved.transactionType,
          entryKind: saved.entryKind,
          warehouseId: saved.warehouseId,
          materialId: saved.materialId,
          quantity: saved.quantity,
          unitPrice: saved.unitPrice,
          totalPrice: saved.totalPrice,
          relatedWorkOrderId: saved.relatedWorkOrderId,
          relatedPreparationId: saved.relatedPreparationId,
          relatedWorkOrderMaterialId: saved.relatedWorkOrderMaterialId,
          sourceTransactionId: saved.sourceTransactionId,
          approvalRequestId: saved.approvalRequestId,
          requestFingerprint: saved.requestFingerprint,
          remark: saved.remark,
        },
      },
      executor,
    );

    return saved;
  }

  async findAll(query: QueryInventoryTransactionsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildFilteredQuery(this.inventoryTransactionRepository, query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        INVENTORY_TRANSACTION_SORT_COLUMNS[query.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findForAudit(filters: FindInventoryTransactionFilters) {
    return this.buildFilteredQuery(this.inventoryTransactionRepository, filters)
      .orderBy(
        INVENTORY_TRANSACTION_SORT_COLUMNS[filters.sortBy ?? 'createdAt'],
        this.normalizeSortOrder(filters.sortOrder, 'ASC'),
      )
      .getMany();
  }

  async findOne(id: number) {
    const record = await this.inventoryTransactionRepository.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException('库存流水不存在');
    }

    return record;
  }

  private normalizeAdjustmentTarget(
    source: InventoryTransaction,
    dto: RequestInventoryAdjustmentApprovalDto,
  ) {
    if (dto.action === InventoryAdjustmentAction.REVERSE) {
      if (dto.targetQuantity !== undefined || dto.targetUnitPrice !== undefined) {
        throw new BadRequestException(
          '[inventory_reversal_target_forbidden] 冲销申请不得携带目标数量或单价',
        );
      }
      return { quantity: null, unitPrice: null };
    }

    if (!dto.targetQuantity || !dto.targetUnitPrice) {
      throw new BadRequestException(
        '[inventory_adjustment_target_missing] 调整申请必须提供目标数量和单价',
      );
    }
    const quantity = normalizeQuantity(dto.targetQuantity);
    const unitPrice = normalizeMoney(dto.targetUnitPrice);
    if (compareQuantity(quantity, '0.00') <= 0) {
      throw new BadRequestException('目标数量必须大于 0');
    }
    if (quantity === source.quantity && unitPrice === source.unitPrice) {
      throw new BadRequestException(
        '[inventory_adjustment_no_change] 目标数量和单价均未变化，无需发起调整',
      );
    }
    return { quantity, unitPrice };
  }

  private assertApprovedAdjustmentExecution(
    approval: ApprovalRequest,
    source: InventoryTransaction,
    currentUser: CurrentUser,
  ) {
    if (
      approval.approvalType !== ApprovalType.INVENTORY_ADJUSTMENT ||
      approval.relatedInventoryTransactionId !== source.id ||
      source.entryKind !== InventoryTransactionEntryKind.ORIGINAL
    ) {
      throw new BadRequestException(
        '[inventory_adjustment_approval_mismatch] 审批单与原始库存流水不匹配',
      );
    }
    if (
      source.relatedWorkOrderMaterialId ||
      !approval.requestIdempotencyKey ||
      !approval.requestFingerprint ||
      (approval.inventoryAdjustmentAction === InventoryAdjustmentAction.REVERSE &&
        (approval.inventoryTargetQuantity !== null ||
          approval.inventoryTargetUnitPrice !== null)) ||
      (approval.inventoryAdjustmentAction === InventoryAdjustmentAction.ADJUST &&
        (!approval.inventoryTargetQuantity || !approval.inventoryTargetUnitPrice))
    ) {
      throw new BadRequestException(
        '[inventory_adjustment_contract_incomplete] 审批证据或业务联动合同不完整，禁止修改库存',
      );
    }
    if (
      approval.currentStatus !== ApprovalStatus.APPROVED ||
      !approval.finalApproverId ||
      !approval.inventoryAdjustmentAction
    ) {
      throw new BadRequestException(
        '[inventory_adjustment_not_approved] 只有完成独立人工审批的修正申请可以执行',
      );
    }
    if (
      currentUser.id === approval.applicantUserId ||
      currentUser.id === approval.finalApproverId ||
      approval.applicantUserId === approval.finalApproverId
    ) {
      throw new BadRequestException(
        '[inventory_adjustment_actor_separation_required] 申请人、审批人和执行人必须互不相同',
      );
    }
  }

  private async loadAdjustmentExecutionResult(
    manager: EntityManager,
    approval: ApprovalRequest,
  ) {
    const records = await manager.getRepository(InventoryTransaction).find({
      where: {
        approvalRequestId: approval.id,
        sourceTransactionId: approval.relatedInventoryTransactionId!,
      },
      order: { id: 'ASC' },
    });
    const reversal = records.find(
      (item) => item.entryKind === InventoryTransactionEntryKind.REVERSAL,
    );
    const adjustment = records.find(
      (item) => item.entryKind === InventoryTransactionEntryKind.ADJUSTMENT,
    );
    const expectedCount =
      approval.inventoryAdjustmentAction === InventoryAdjustmentAction.ADJUST ? 2 : 1;
    if (!reversal || records.length !== expectedCount || (expectedCount === 2 && !adjustment)) {
      throw new BadRequestException(
        '[inventory_adjustment_execution_incomplete] 已消费执行请求的库存流水证据不完整',
      );
    }
    return {
      sourceTransactionId: approval.relatedInventoryTransactionId,
      approvalRequestId: approval.id,
      action: approval.inventoryAdjustmentAction,
      reversal,
      adjustment: adjustment ?? null,
      executionFingerprint: approval.executionFingerprint,
    };
  }

  private buildInventoryRequestFingerprint(
    input: RecordInventoryTransactionInput,
    currentUser: CurrentUser,
  ) {
    return this.hashContract({
      contractVersion: 'p0c_inventory_transaction_v1',
      transactionType: input.transactionType,
      entryKind: input.entryKind ?? InventoryTransactionEntryKind.ORIGINAL,
      warehouseId: input.warehouseId,
      materialId: input.materialId,
      quantity: normalizeQuantity(input.quantity),
      unitPrice: normalizeMoney(input.unitPrice),
      relatedWorkOrderId: input.relatedWorkOrderId ?? null,
      relatedPreparationId: input.relatedPreparationId ?? null,
      relatedWorkOrderMaterialId: input.relatedWorkOrderMaterialId ?? null,
      sourceTransactionId: input.sourceTransactionId ?? null,
      approvalRequestId: input.approvalRequestId ?? null,
      adjustmentReason: input.adjustmentReason?.trim() || null,
      remark: input.remark?.trim() || null,
      actorId: currentUser.id,
    });
  }

  private buildAdjustmentRequestFingerprint(
    source: InventoryTransaction,
    action: InventoryAdjustmentAction,
    reason: string,
    targetQuantity: string | null,
    targetUnitPrice: string | null,
    applicantUserId: number,
  ) {
    return this.hashContract({
      contractVersion: 'p0c_inventory_adjustment_request_v1',
      sourceTransactionId: source.id,
      sourceFingerprint: source.requestFingerprint,
      action,
      reason: reason.trim(),
      targetQuantity,
      targetUnitPrice,
      applicantUserId,
    });
  }

  private assertOriginalSourceEvidence(source: InventoryTransaction) {
    if (!source.requestIdempotencyKey || !source.requestFingerprint) {
      throw new BadRequestException(
        '[inventory_legacy_source_evidence_missing] 缺少 P0C 不可变幂等证据的历史流水不能在本合同中修正',
      );
    }
    const recomputed = this.buildInventoryRequestFingerprint(
      {
        transactionType: source.transactionType,
        entryKind: source.entryKind,
        requestIdempotencyKey: source.requestIdempotencyKey,
        warehouseId: source.warehouseId,
        materialId: source.materialId,
        quantity: source.quantity,
        unitPrice: source.unitPrice,
        relatedWorkOrderId: source.relatedWorkOrderId,
        relatedPreparationId: source.relatedPreparationId,
        relatedWorkOrderMaterialId: source.relatedWorkOrderMaterialId,
        sourceTransactionId: source.sourceTransactionId,
        approvalRequestId: source.approvalRequestId,
        adjustmentReason: source.adjustmentReason,
        remark: source.remark ?? undefined,
      },
      {
        id: source.createdBy,
        username: '',
        realName: '',
        roleCodes: [],
      },
    );
    this.assertMatchingFingerprint(source.requestFingerprint, recomputed);
  }

  private hashContract(value: Record<string, unknown>) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private assertMatchingFingerprint(existing: string | null, expected: string | null) {
    if (!existing || !expected || existing !== expected) {
      throw new BadRequestException(
        '[idempotency_key_payload_conflict] 同一幂等键不得用于不同请求内容',
      );
    }
  }

  private deriveChildIdempotencyKey(parent: string, suffix: string) {
    return `p0c-${createHash('sha256').update(`${parent}:${suffix}`).digest('hex')}`;
  }

  private oppositeTransactionType(transactionType: InventoryTransactionType) {
    return transactionType === InventoryTransactionType.INBOUND
      ? InventoryTransactionType.OUTBOUND
      : InventoryTransactionType.INBOUND;
  }

  private resolveInventoryOperationLogAction(record: InventoryTransaction) {
    if (record.entryKind === InventoryTransactionEntryKind.REVERSAL) {
      return OperationLogAction.APPLY_INVENTORY_REVERSAL;
    }
    if (record.entryKind === InventoryTransactionEntryKind.ADJUSTMENT) {
      return OperationLogAction.APPLY_INVENTORY_ADJUSTMENT;
    }
    return record.transactionType === InventoryTransactionType.INBOUND
      ? OperationLogAction.INVENTORY_INBOUND
      : OperationLogAction.INVENTORY_OUTBOUND;
  }

  private isDuplicateEntryError(error: unknown) {
    const candidate = error as { code?: string; errno?: number } | null;
    return candidate?.code === 'ER_DUP_ENTRY' || candidate?.errno === 1062;
  }

  private buildFilteredQuery(
    repo: Repository<InventoryTransaction>,
    filters: FindInventoryTransactionFilters,
  ): SelectQueryBuilder<InventoryTransaction> {
    const qb = repo.createQueryBuilder('transaction');

    if (filters.transactionType) {
      qb.andWhere('transaction.transaction_type = :transactionType', {
        transactionType: filters.transactionType,
      });
    }

    if (filters.relatedPreparationId) {
      qb.andWhere('transaction.related_preparation_id = :relatedPreparationId', {
        relatedPreparationId: filters.relatedPreparationId,
      });
    }

    if (filters.relatedWorkOrderMaterialId) {
      qb.andWhere(
        'transaction.related_work_order_material_id = :relatedWorkOrderMaterialId',
        {
          relatedWorkOrderMaterialId: filters.relatedWorkOrderMaterialId,
        },
      );
    }

    if (filters.materialId) {
      qb.andWhere('transaction.material_id = :materialId', {
        materialId: filters.materialId,
      });
    }

    if (filters.warehouseId) {
      qb.andWhere('transaction.warehouse_id = :warehouseId', {
        warehouseId: filters.warehouseId,
      });
    }

    if (filters.dateFrom) {
      qb.andWhere('transaction.created_at >= :dateFrom', {
        dateFrom: new Date(filters.dateFrom),
      });
    }

    if (filters.dateTo) {
      qb.andWhere('transaction.created_at <= :dateTo', {
        dateTo: new Date(filters.dateTo),
      });
    }

    return qb;
  }

  private normalizeSortOrder(
    value: FindInventoryTransactionFilters['sortOrder'],
    fallback: 'ASC' | 'DESC',
  ) {
    if (!value) {
      return fallback;
    }

    return value.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }
}
