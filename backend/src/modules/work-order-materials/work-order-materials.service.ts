import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager, IsNull, QueryFailedError, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  addMoney,
  compareQuantity,
  multiplyMoney,
  normalizeMoney,
  normalizeQuantity,
} from '../../common/utils/decimal.util';
import { InventoryTransactionType } from '../../shared/enums/inventory-transaction-type.enum';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { WorkOrderMaterialSource } from '../../shared/enums/work-order-material-source.enum';
import { InventoryTransactionsService } from '../inventory-transactions/inventory-transactions.service';
import { MaterialPreparationsService } from '../material-preparations/material-preparations.service';
import { Material } from '../materials/entities/material.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { assertWorkOrderNotUnquoted } from '../work-orders/work-order-intake.policy';
import { CreateWorkOrderMaterialDto } from './dto/create-work-order-material.dto';
import { UpdateWorkOrderMaterialDto } from './dto/update-work-order-material.dto';
import { WorkOrderMaterial } from './entities/work-order-material.entity';

interface MaterialLineState {
  materialId: number;
  sourceType: WorkOrderMaterialSource;
  warehouseId: number | null;
  preparationId: number | null;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  remark: string | null;
}

interface PreparedMaterialLineState {
  material: Material;
  nextState: MaterialLineState;
}

interface InventoryImpactResult {
  affected: boolean;
  inventoryTransactionIds: number[];
}

@Injectable()
export class WorkOrderMaterialsService {
  constructor(
    @InjectRepository(WorkOrderMaterial)
    private readonly workOrderMaterialRepository: Repository<WorkOrderMaterial>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(Material)
    private readonly materialRepository: Repository<Material>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly dataSource: DataSource,
    private readonly inventoryTransactionsService: InventoryTransactionsService,
    private readonly materialPreparationsService: MaterialPreparationsService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async findByWorkOrder(workOrderId: number, includeDeleted = false) {
    await this.ensureWorkOrderExists(workOrderId);

    return this.workOrderMaterialRepository.find({
      where: {
        workOrderId,
        ...(includeDeleted ? {} : { deletedAt: IsNull() }),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findAuditTrail(workOrderId: number, id: number) {
    await this.ensureWorkOrderExists(workOrderId);

    const line = await this.workOrderMaterialRepository.findOne({
      where: {
        id,
        workOrderId,
      },
    });

    if (!line) {
      throw new NotFoundException('工单材料明细不存在');
    }

    const inventoryTransactions = await this.inventoryTransactionsService.findForAudit({
      relatedWorkOrderMaterialId: id,
    });
    const inventoryTransactionIds = inventoryTransactions.map((item) => item.id);
    const [workOrderMaterialLogs, inventoryLogs, preparationLogs, workOrderCostLogs] =
      await Promise.all([
        this.operationLogsService.findAuditLogs({
          module: 'work_order_material',
          targetId: id,
        }),
        inventoryTransactionIds.length
          ? this.operationLogsService.findAuditLogs({
              module: 'inventory_transaction',
              targetIds: inventoryTransactionIds,
            })
          : Promise.resolve([]),
        line.preparationId
          ? this.operationLogsService.findAuditLogs({
              module: 'material_preparation',
              targetId: line.preparationId,
            })
          : Promise.resolve([]),
        this.operationLogsService.findAuditLogs({
          module: 'work_order',
          targetId: workOrderId,
          action: OperationLogAction.RECALCULATE_WORK_ORDER_MATERIAL_COST,
        }),
      ]);

    return {
      line,
      inventoryTransactions,
      logs: {
        workOrderMaterial: workOrderMaterialLogs,
        inventory: inventoryLogs,
        preparation: preparationLogs,
        workOrderCost: workOrderCostLogs,
      },
    };
  }

  async create(workOrderId: number, dto: CreateWorkOrderMaterialDto, currentUser: CurrentUser) {
    const requestFingerprint = this.buildCreateRequestFingerprint(
      workOrderId,
      dto,
      currentUser,
    );
    try {
      return await this.dataSource.transaction(async (manager) => {
        const workOrder = await this.getWorkOrder(manager, workOrderId);
        const repo = manager.getRepository(WorkOrderMaterial);
        const existing = await repo.findOne({
          where: { requestIdempotencyKey: dto.requestIdempotencyKey },
          lock: { mode: 'pessimistic_write' },
        });
        if (existing) {
          this.assertMatchingRequestFingerprint(existing.requestFingerprint, requestFingerprint);
          return existing;
        }

        const { material, nextState } = await this.prepareLineState(manager, workOrder, dto);
        const record = repo.create({
          workOrderId,
          requestIdempotencyKey: dto.requestIdempotencyKey,
          requestFingerprint,
          materialId: nextState.materialId,
          sourceType: nextState.sourceType,
          warehouseId: nextState.warehouseId,
          preparationId: nextState.preparationId,
          quantity: nextState.quantity,
          unitPrice: nextState.unitPrice,
          totalPrice: nextState.totalPrice,
          remark: nextState.remark,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          deletedAt: null,
          deletedBy: null,
        });

        let saved = await this.saveLine(repo, record);
        const inventoryImpact = await this.applyMaterialInventoryImpact(
          manager,
          workOrder,
          saved,
          currentUser,
          '新增工单材料扣减库存',
          this.deriveInventoryRequestIdempotencyKey(dto.requestIdempotencyKey),
        );

        if (saved.sourceType === WorkOrderMaterialSource.PREPARATION && saved.preparationId) {
          await this.materialPreparationsService.consumeForWorkOrderMaterial(
            saved.preparationId,
            workOrder.id,
            saved.id,
            currentUser,
            manager,
          );
        }

        await this.recalculateWorkOrderMaterialCost(manager, workOrder, currentUser.id);
        saved = await repo.findOneByOrFail({ id: saved.id });

        const logDetail = this.buildOperationLogDetail({
          action: OperationLogAction.CREATE_WORK_ORDER_MATERIAL,
          workOrderNo: workOrder.workOrderNo,
          lineId: saved.id,
          before: null,
          after: this.serializeLine(saved),
          inventoryAffected: inventoryImpact.affected,
          inventoryTransactionIds: inventoryImpact.inventoryTransactionIds,
        });

        await this.operationLogsService.create(
          {
            module: 'work_order_material',
            targetId: saved.id,
            action: OperationLogAction.CREATE_WORK_ORDER_MATERIAL,
            operatorId: currentUser.id,
            detail: `${logDetail.detail}（${material.name}）`,
            detailJson: logDetail.detailJson,
          },
          manager,
        );

        return saved;
      });
    } catch (error) {
      if (!this.isRequestIdempotencyDuplicate(error)) {
        throw error;
      }
      const existing = await this.workOrderMaterialRepository.findOne({
        where: { requestIdempotencyKey: dto.requestIdempotencyKey },
      });
      if (!existing) {
        throw error;
      }
      this.assertMatchingRequestFingerprint(existing.requestFingerprint, requestFingerprint);
      return existing;
    }
  }

  async update(
    workOrderId: number,
    id: number,
    dto: UpdateWorkOrderMaterialDto,
    currentUser: CurrentUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(WorkOrderMaterial);
      const line = await this.getActiveLine(manager, workOrderId, id);
      const workOrder = await this.getWorkOrder(manager, workOrderId);
      const before = this.serializeLine(line);
      const { nextState } = await this.prepareLineState(manager, workOrder, dto, line);
      const inventoryAffecting = this.isInventoryAffectingChange(line, nextState);
      if (inventoryAffecting) {
        throw new BadRequestException(
          '[inventory_correction_approval_required] 已影响库存的工单材料不得直接改数量、单价、材料、来源或库房；必须走审批后的不可变冲销/调整合同',
        );
      }

      const inventoryTransactionIds: number[] = [];

      this.applyNextState(line, nextState, currentUser.id);
      let saved = await this.saveLine(repo, line);

      if (saved.sourceType === WorkOrderMaterialSource.PREPARATION && saved.preparationId) {
        await this.materialPreparationsService.consumeForWorkOrderMaterial(
          saved.preparationId,
          workOrder.id,
          saved.id,
          currentUser,
          manager,
        );
      }

      await this.recalculateWorkOrderMaterialCost(manager, workOrder, currentUser.id);
      saved = await repo.findOneByOrFail({ id: saved.id });

      const logDetail = this.buildOperationLogDetail({
        action: OperationLogAction.UPDATE_WORK_ORDER_MATERIAL,
        workOrderNo: workOrder.workOrderNo,
        lineId: saved.id,
        before,
        after: this.serializeLine(saved),
        inventoryAffected: inventoryAffecting,
        inventoryTransactionIds,
      });

      await this.operationLogsService.create(
        {
          module: 'work_order_material',
          targetId: saved.id,
          action: OperationLogAction.UPDATE_WORK_ORDER_MATERIAL,
          operatorId: currentUser.id,
          detail: logDetail.detail,
          detailJson: logDetail.detailJson,
        },
        manager,
      );

      return saved;
    });
  }

  async remove(workOrderId: number, id: number, currentUser: CurrentUser) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(WorkOrderMaterial);
      const line = await this.getActiveLine(manager, workOrderId, id);
      const workOrder = await this.getWorkOrder(manager, workOrderId);
      const before = this.serializeLine(line);

      if (this.isInventoryManagedSource(line.sourceType)) {
        throw new BadRequestException(
          '[inventory_correction_approval_required] 已影响库存的工单材料不得直接删除；必须走审批后的不可变冲销合同',
        );
      }

      line.deletedAt = new Date();
      line.deletedBy = currentUser.id;
      line.updatedBy = currentUser.id;
      const saved = await repo.save(line);

      await this.recalculateWorkOrderMaterialCost(manager, workOrder, currentUser.id);

      const logDetail = this.buildOperationLogDetail({
        action: OperationLogAction.DELETE_WORK_ORDER_MATERIAL,
        workOrderNo: workOrder.workOrderNo,
        lineId: saved.id,
        before,
        after: this.serializeLine(saved),
        inventoryAffected: false,
        inventoryTransactionIds: [],
      });

      await this.operationLogsService.create(
        {
          module: 'work_order_material',
          targetId: saved.id,
          action: OperationLogAction.DELETE_WORK_ORDER_MATERIAL,
          operatorId: currentUser.id,
          detail: logDetail.detail,
          detailJson: logDetail.detailJson,
        },
        manager,
      );

      return {
        id: saved.id,
        deleted: true,
      };
    });
  }

  private isInventoryAffectingChange(
    currentLine: WorkOrderMaterial,
    nextState: MaterialLineState,
  ) {
    const currentManaged = this.isInventoryManagedSource(currentLine.sourceType);
    const nextManaged = this.isInventoryManagedSource(nextState.sourceType);

    if (!currentManaged && !nextManaged) {
      return false;
    }

    return (
      currentLine.sourceType !== nextState.sourceType ||
      currentLine.materialId !== nextState.materialId ||
      (currentLine.warehouseId ?? null) !== (nextState.warehouseId ?? null) ||
      (currentLine.preparationId ?? null) !== (nextState.preparationId ?? null) ||
      compareQuantity(currentLine.quantity, nextState.quantity) !== 0 ||
      currentLine.unitPrice !== nextState.unitPrice
    );
  }

  private async applyMaterialInventoryImpact(
    manager: EntityManager,
    workOrder: WorkOrder,
    line: WorkOrderMaterial,
    currentUser: CurrentUser,
    remark: string,
    requestIdempotencyKey: string,
  ): Promise<InventoryImpactResult> {
    if (!this.isInventoryManagedSource(line.sourceType)) {
      return {
        affected: false,
        inventoryTransactionIds: [],
      };
    }

    if (!line.warehouseId) {
      throw new BadRequestException('当前工单材料缺少库房信息，无法写入库存流水');
    }

    const transaction = await this.inventoryTransactionsService.recordTransaction(
      {
        transactionType: InventoryTransactionType.OUTBOUND,
        warehouseId: line.warehouseId,
        materialId: line.materialId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        relatedWorkOrderId: workOrder.id,
        relatedPreparationId: line.preparationId ?? null,
        relatedWorkOrderMaterialId: line.id,
        requestIdempotencyKey,
        remark: `工单 ${workOrder.workOrderNo} ${remark}`,
      },
      currentUser,
      manager,
    );

    return {
      affected: true,
      inventoryTransactionIds: [transaction.id],
    };
  }

  async recalculateWorkOrderMaterialCost(
    manager: EntityManager,
    workOrder: WorkOrder,
    operatorId: number,
  ) {
    assertWorkOrderNotUnquoted(workOrder);
    const lines = await manager.getRepository(WorkOrderMaterial).find({
      where: {
        workOrderId: workOrder.id,
        deletedAt: IsNull(),
      },
    });
    const materialCostTotal = lines.reduce((sum, line) => addMoney(sum, line.totalPrice), '0.00');

    await manager.getRepository(WorkOrder).update(workOrder.id, {
      materialCostTotal,
    });

    await this.operationLogsService.create(
      {
        module: 'work_order',
        targetId: workOrder.id,
        action: OperationLogAction.RECALCULATE_WORK_ORDER_MATERIAL_COST,
        operatorId,
        detail: `重算工单 ${workOrder.workOrderNo} 材料成本`,
        detailJson: {
          workOrderId: workOrder.id,
          workOrderNo: workOrder.workOrderNo,
          materialCostTotal,
          materialLineCount: lines.length,
        },
      },
      manager,
    );
  }

  private buildOperationLogDetail(params: {
    action: OperationLogAction;
    workOrderNo: string;
    lineId: number;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    inventoryAffected: boolean;
    inventoryTransactionIds: number[];
  }) {
    const actionTextMap: Partial<Record<OperationLogAction, string>> = {
      [OperationLogAction.CREATE_WORK_ORDER]: '创建工单',
      [OperationLogAction.UPDATE_WORK_ORDER]: '修改工单',
      [OperationLogAction.CREATE_PAYMENT_RECORD]: '创建收款记录',
      [OperationLogAction.PAYMENT_SUCCESS]: '收款成功',
      [OperationLogAction.SUBMIT_APPROVAL]: '提交审批',
      [OperationLogAction.APPROVE_APPROVAL]: '审批通过',
      [OperationLogAction.REJECT_APPROVAL]: '审批拒绝',
      [OperationLogAction.CREATE_PAYOUT_RECORD]: '创建付款记录',
      [OperationLogAction.CREATE_WAREHOUSE]: '创建库房',
      [OperationLogAction.UPDATE_WAREHOUSE]: '修改库房',
      [OperationLogAction.CREATE_SUPPLIER]: '创建供应商',
      [OperationLogAction.UPDATE_SUPPLIER]: '修改供应商',
      [OperationLogAction.CREATE_MATERIAL]: '创建材料',
      [OperationLogAction.UPDATE_MATERIAL]: '修改材料',
      [OperationLogAction.INVENTORY_INBOUND]: '库存入库',
      [OperationLogAction.INVENTORY_OUTBOUND]: '库存出库',
      [OperationLogAction.CREATE_MATERIAL_PREPARATION]: '创建备料记录',
      [OperationLogAction.BIND_MATERIAL_PREPARATION]: '绑定备料记录',
      [OperationLogAction.CREATE_WORK_ORDER_MATERIAL]: '新增工单材料',
      [OperationLogAction.UPDATE_WORK_ORDER_MATERIAL]: '修改工单材料',
      [OperationLogAction.DELETE_WORK_ORDER_MATERIAL]: '删除工单材料',
      [OperationLogAction.RECALCULATE_WORK_ORDER_MATERIAL_COST]: '重算工单材料成本',
      [OperationLogAction.START_SYNC_JOB_RUN]: '启动同步任务',
      [OperationLogAction.COMPLETE_SYNC_JOB_RUN]: '完成同步任务',
      [OperationLogAction.FAIL_SYNC_JOB_RUN]: '同步任务失败',
    };

    return {
      detail: `工单 ${params.workOrderNo} ${actionTextMap[params.action]} #${params.lineId}`,
      detailJson: {
        before: params.before,
        after: params.after,
        inventoryAffected: params.inventoryAffected,
        inventoryTransactionIds: params.inventoryTransactionIds,
        relatedSourceType: {
          before: params.before?.sourceType ?? null,
          after: params.after?.sourceType ?? null,
        },
      },
    };
  }

  private async prepareLineState(
    manager: EntityManager,
    workOrder: WorkOrder,
    dto: CreateWorkOrderMaterialDto | UpdateWorkOrderMaterialDto,
    currentLine?: WorkOrderMaterial,
  ): Promise<PreparedMaterialLineState> {
    const materialId = dto.materialId ?? currentLine?.materialId;

    if (!materialId) {
      throw new BadRequestException('materialId 不能为空');
    }

    const material = await this.getMaterial(manager, materialId);
    const sourceType = dto.sourceType ?? currentLine?.sourceType ?? WorkOrderMaterialSource.MANUAL;
    const quantity =
      dto.quantity === undefined
        ? currentLine?.quantity ?? null
        : normalizeQuantity(dto.quantity);
    const unitPrice =
      dto.unitPrice === undefined
        ? currentLine?.unitPrice ?? null
        : normalizeMoney(dto.unitPrice);

    if (!quantity) {
      throw new BadRequestException('数量不能为空');
    }

    if (!unitPrice) {
      throw new BadRequestException('单价不能为空');
    }

    if (dto.warehouseId !== undefined && sourceType !== WorkOrderMaterialSource.WAREHOUSE) {
      throw new BadRequestException('只有 warehouse 来源才允许传入 warehouseId');
    }

    if (dto.preparationId !== undefined && sourceType !== WorkOrderMaterialSource.PREPARATION) {
      throw new BadRequestException('只有 preparation 来源才允许传入 preparationId');
    }

    let warehouseId: number | null = null;
    let preparationId: number | null = null;

    if (sourceType === WorkOrderMaterialSource.WAREHOUSE) {
      warehouseId =
        dto.warehouseId ??
        (currentLine?.sourceType === WorkOrderMaterialSource.WAREHOUSE
          ? currentLine.warehouseId
          : null);

      if (!warehouseId) {
        throw new BadRequestException('warehouse 来源必须提供 warehouseId');
      }

      await this.ensureWarehouseExists(warehouseId);
    }

    if (sourceType === WorkOrderMaterialSource.PREPARATION) {
      preparationId =
        dto.preparationId ??
        (currentLine?.sourceType === WorkOrderMaterialSource.PREPARATION
          ? currentLine.preparationId
          : null);

      if (!preparationId) {
        throw new BadRequestException('preparation 来源必须提供 preparationId');
      }

      const preparation = await this.materialPreparationsService.ensureConsumableForWorkOrderMaterial(
        {
          preparationId,
          workOrderId: workOrder.id,
          materialId,
          currentWorkOrderMaterialId: currentLine?.id ?? null,
        },
        manager,
      );
      warehouseId = preparation.warehouseId;
    }

    return {
      material,
      nextState: {
        materialId,
        sourceType,
        warehouseId,
        preparationId,
        quantity,
        unitPrice,
        totalPrice: multiplyMoney(quantity, unitPrice),
        remark: dto.remark === undefined ? currentLine?.remark ?? null : dto.remark ?? null,
      },
    };
  }

  private applyNextState(
    line: WorkOrderMaterial,
    nextState: MaterialLineState,
    operatorId: number,
  ) {
    line.materialId = nextState.materialId;
    line.sourceType = nextState.sourceType;
    line.warehouseId = nextState.warehouseId;
    line.preparationId = nextState.preparationId;
    line.quantity = nextState.quantity;
    line.unitPrice = nextState.unitPrice;
    line.totalPrice = nextState.totalPrice;
    line.remark = nextState.remark;
    line.updatedBy = operatorId;
  }

  private serializeLine(line: WorkOrderMaterial) {
    return {
      id: line.id,
      workOrderId: line.workOrderId,
      materialId: line.materialId,
      sourceType: line.sourceType,
      warehouseId: line.warehouseId,
      preparationId: line.preparationId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      totalPrice: line.totalPrice,
      remark: line.remark,
      deletedAt: line.deletedAt ? line.deletedAt.toISOString() : null,
      deletedBy: line.deletedBy,
    };
  }

  private isInventoryManagedSource(sourceType: WorkOrderMaterialSource) {
    return sourceType !== WorkOrderMaterialSource.MANUAL;
  }

  private async saveLine(
    repo: Repository<WorkOrderMaterial>,
    line: WorkOrderMaterial,
  ) {
    try {
      return await repo.save(line);
    } catch (error) {
      this.handlePreparationDuplicateError(error);
      throw error;
    }
  }

  private handlePreparationDuplicateError(error: unknown) {
    if (!(error instanceof QueryFailedError)) {
      return;
    }

    const mysqlError = error as QueryFailedError & {
      driverError?: {
        code?: string;
        message?: string;
      };
    };
    const code = mysqlError.driverError?.code;
    const message = mysqlError.driverError?.message ?? '';

    if (code === 'ER_DUP_ENTRY' && message.includes('uniq_work_order_materials_preparation_id')) {
      throw new BadRequestException('该备料记录已被工单材料占用，禁止重复消费');
    }
  }

  private async ensureWarehouseExists(warehouseId: number) {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundException('库房不存在');
    }
  }

  private async ensureWorkOrderExists(workOrderId: number) {
    const workOrder = await this.workOrderRepository.findOne({ where: { id: workOrderId } });

    if (!workOrder) {
      throw new NotFoundException('工单不存在');
    }
    assertWorkOrderNotUnquoted(workOrder);
  }

  private async getWorkOrder(manager: EntityManager, workOrderId: number) {
    const workOrder = await manager.getRepository(WorkOrder).findOne({
      where: { id: workOrderId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!workOrder) {
      throw new NotFoundException('工单不存在');
    }
    assertWorkOrderNotUnquoted(workOrder);

    return workOrder;
  }

  private buildCreateRequestFingerprint(
    workOrderId: number,
    dto: CreateWorkOrderMaterialDto,
    currentUser: CurrentUser,
  ) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          contractVersion: 'p0c_work_order_material_create_v1',
          workOrderId,
          materialId: dto.materialId,
          sourceType: dto.sourceType,
          warehouseId: dto.warehouseId ?? null,
          preparationId: dto.preparationId ?? null,
          quantity: normalizeQuantity(dto.quantity),
          unitPrice: normalizeMoney(dto.unitPrice),
          remark: dto.remark?.trim() || null,
          actorId: currentUser.id,
        }),
      )
      .digest('hex');
  }

  private deriveInventoryRequestIdempotencyKey(parent: string) {
    return `p0c-${createHash('sha256')
      .update(`${parent}:work-order-material-inventory`)
      .digest('hex')}`;
  }

  private assertMatchingRequestFingerprint(existing: string | null, expected: string) {
    if (!existing || existing !== expected) {
      throw new BadRequestException(
        '[idempotency_key_payload_conflict] 同一幂等键不得用于不同工单材料请求',
      );
    }
  }

  private isRequestIdempotencyDuplicate(error: unknown) {
    const candidate = error as QueryFailedError & {
      driverError?: { code?: string; message?: string };
    };
    return (
      candidate?.driverError?.code === 'ER_DUP_ENTRY' &&
      (candidate.driverError.message ?? '').includes(
        'uq_work_order_materials_request_idempotency_key',
      )
    );
  }

  private async getMaterial(manager: EntityManager, materialId: number) {
    const material = await manager.getRepository(Material).findOne({ where: { id: materialId } });

    if (!material) {
      throw new NotFoundException('材料不存在');
    }

    return material;
  }

  private async getActiveLine(manager: EntityManager, workOrderId: number, id: number) {
    const line = await manager.getRepository(WorkOrderMaterial).findOne({
      where: {
        id,
        workOrderId,
        deletedAt: IsNull(),
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!line) {
      throw new NotFoundException('工单材料明细不存在');
    }

    return line;
  }
}
