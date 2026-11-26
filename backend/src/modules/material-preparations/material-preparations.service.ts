import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  multiplyMoney,
  normalizeMoney,
  normalizeQuantity,
} from '../../common/utils/decimal.util';
import { BIZ_SEQUENCE_CONFIG } from '../../shared/constants/biz-sequence.constant';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { PreparationBindStatus } from '../../shared/enums/preparation-bind-status.enum';
import { InventoryTransaction } from '../inventory-transactions/entities/inventory-transaction.entity';
import { Material } from '../materials/entities/material.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SequenceService } from '../sequence/sequence.service';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { User } from '../users/entities/user.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { BindMaterialPreparationDto } from './dto/bind-material-preparation.dto';
import { CreateMaterialPreparationDto } from './dto/create-material-preparation.dto';
import { QueryMaterialPreparationsDto } from './dto/query-material-preparations.dto';
import { MaterialPreparation } from './entities/material-preparation.entity';

interface EnsureConsumablePreparationInput {
  preparationId: number;
  workOrderId: number;
  materialId: number;
  currentWorkOrderMaterialId?: number | null;
}

@Injectable()
export class MaterialPreparationsService {
  constructor(
    @InjectRepository(MaterialPreparation)
    private readonly materialPreparationRepository: Repository<MaterialPreparation>,
    @InjectRepository(Material)
    private readonly materialRepository: Repository<Material>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly dataSource: DataSource,
    private readonly sequenceService: SequenceService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  async create(dto: CreateMaterialPreparationDto, currentUser: CurrentUser) {
    const [material, supplier, warehouse, workOrder, responsibleUser] = await Promise.all([
      this.materialRepository.findOne({ where: { id: dto.materialId } }),
      dto.supplierId
        ? this.supplierRepository.findOne({ where: { id: dto.supplierId } })
        : Promise.resolve(null),
      dto.warehouseId
        ? this.warehouseRepository.findOne({ where: { id: dto.warehouseId } })
        : Promise.resolve(null),
      dto.linkedWorkOrderId
        ? this.workOrderRepository.findOne({ where: { id: dto.linkedWorkOrderId } })
        : Promise.resolve(null),
      dto.responsibleUserId
        ? this.userRepository.findOne({ where: { id: dto.responsibleUserId, status: 1 } })
        : Promise.resolve(null),
    ]);

    if (!material) {
      throw new NotFoundException('材料不存在');
    }

    if (dto.supplierId && !supplier) {
      throw new NotFoundException('供应商不存在');
    }

    if (dto.warehouseId && !warehouse) {
      throw new NotFoundException('库房不存在');
    }

    if (dto.linkedWorkOrderId && !workOrder) {
      throw new NotFoundException('工单不存在');
    }

    if (dto.responsibleUserId && !responsibleUser) {
      throw new NotFoundException('责任人不存在或已禁用');
    }

    return this.dataSource.transaction(async (manager) => {
      const preparationNo = await this.sequenceService.generateBizNo(
        BIZ_SEQUENCE_CONFIG.MATERIAL_PREPARATION.bizType,
        BIZ_SEQUENCE_CONFIG.MATERIAL_PREPARATION.prefix,
        manager,
      );
      const quantity = normalizeQuantity(dto.quantity);
      const unitPrice = normalizeMoney(dto.unitPrice);
      const totalPrice = multiplyMoney(quantity, unitPrice);
      const repo = manager.getRepository(MaterialPreparation);
      const record = repo.create({
        preparationNo,
        materialId: dto.materialId,
        supplierId: dto.supplierId ?? null,
        warehouseId: dto.warehouseId ?? null,
        quantity,
        unitPrice,
        totalPrice,
        linkedWorkOrderId: dto.linkedWorkOrderId ?? null,
        responsibleUserId: dto.responsibleUserId ?? null,
        bindStatus: dto.linkedWorkOrderId
          ? PreparationBindStatus.BOUND
          : PreparationBindStatus.UNBOUND,
        preparedAt: dto.preparedAt ? new Date(dto.preparedAt) : null,
        bindDeadlineAt: dto.bindDeadlineAt ? new Date(dto.bindDeadlineAt) : null,
        consumedWorkOrderMaterialId: null,
        consumedAt: null,
        remark: dto.remark ?? null,
        createdBy: currentUser.id,
      });
      const saved = await repo.save(record);

      await this.operationLogsService.create(
        {
          module: 'material_preparation',
          targetId: saved.id,
          action: OperationLogAction.CREATE_MATERIAL_PREPARATION,
          operatorId: currentUser.id,
          detail: `创建备料记录 ${saved.preparationNo}`,
          detailJson: {
            preparationNo: saved.preparationNo,
            materialId: saved.materialId,
            supplierId: saved.supplierId,
            warehouseId: saved.warehouseId,
            quantity: saved.quantity,
            unitPrice: saved.unitPrice,
            totalPrice: saved.totalPrice,
            linkedWorkOrderId: saved.linkedWorkOrderId,
            responsibleUserId: saved.responsibleUserId,
            bindStatus: saved.bindStatus,
          },
        },
        manager,
      );

      if (saved.linkedWorkOrderId) {
        await this.operationLogsService.create(
          {
            module: 'material_preparation',
            targetId: saved.id,
            action: OperationLogAction.BIND_MATERIAL_PREPARATION,
            operatorId: currentUser.id,
            detail: `备料记录 ${saved.preparationNo} 绑定工单 ${saved.linkedWorkOrderId}`,
            detailJson: {
              before: {
                linkedWorkOrderId: null,
                bindStatus: PreparationBindStatus.UNBOUND,
              },
              after: {
                linkedWorkOrderId: saved.linkedWorkOrderId,
                bindStatus: saved.bindStatus,
              },
              inventoryAffected: false,
              inventoryTransactionIds: [],
              relatedSourceType: {
                before: null,
                after: 'preparation',
              },
            },
          },
          manager,
        );
      }

      return this.decoratePreparation(saved);
    });
  }

  async findAll(query: QueryMaterialPreparationsDto = {}) {
    const qb = this.materialPreparationRepository
      .createQueryBuilder('preparation')
      .orderBy('preparation.created_at', 'DESC');

    if (query.responsibleUserId) {
      qb.andWhere('preparation.responsible_user_id = :responsibleUserId', {
        responsibleUserId: query.responsibleUserId,
      });
    }

    if (query.supplierId) {
      qb.andWhere('preparation.supplier_id = :supplierId', {
        supplierId: query.supplierId,
      });
    }

    if (query.materialId) {
      qb.andWhere('preparation.material_id = :materialId', {
        materialId: query.materialId,
      });
    }

    if (query.warehouseId) {
      qb.andWhere('preparation.warehouse_id = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }

    if (query.bindStatus) {
      qb.andWhere('preparation.bind_status = :bindStatus', {
        bindStatus: query.bindStatus,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('COALESCE(preparation.prepared_at, preparation.created_at) >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo) {
      qb.andWhere('COALESCE(preparation.prepared_at, preparation.created_at) <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }

    if (query.isOverdue) {
      qb.andWhere('preparation.bind_status = :overdueStatus', {
        overdueStatus: PreparationBindStatus.UNBOUND,
      })
        .andWhere('preparation.bind_deadline_at IS NOT NULL')
        .andWhere('preparation.bind_deadline_at < :now', {
          now: new Date(),
        });
    }

    const list = await qb.getMany();
    return list.map((item) => this.decoratePreparation(item));
  }

  async findOne(id: number) {
    const record = await this.materialPreparationRepository.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException('备料记录不存在');
    }

    return this.decoratePreparation(record);
  }

  async findAudit(id: number) {
    const record = await this.materialPreparationRepository.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException('备料记录不存在');
    }

    const inventoryTransactions = await this.dataSource.getRepository(InventoryTransaction).find({
      where: {
        relatedPreparationId: id,
      },
      order: { createdAt: 'ASC' },
    });
    const operationLogs = await this.operationLogsService.findAuditLogs({
      module: 'material_preparation',
      targetId: id,
    });

    return {
      preparation: this.decoratePreparation(record),
      inventoryTransactions,
      operationLogs,
      consumption: {
        linkedWorkOrderId: record.linkedWorkOrderId,
        consumedWorkOrderMaterialId: record.consumedWorkOrderMaterialId,
        bindStatus: record.bindStatus,
        consumedAt: record.consumedAt ? record.consumedAt.toISOString() : null,
      },
    };
  }

  async bindWorkOrder(id: number, dto: BindMaterialPreparationDto, currentUser: CurrentUser) {
    const [record, workOrder] = await Promise.all([
      this.materialPreparationRepository.findOne({ where: { id } }),
      this.workOrderRepository.findOne({ where: { id: dto.workOrderId } }),
    ]);

    if (!record) {
      throw new NotFoundException('备料记录不存在');
    }

    if (!workOrder) {
      throw new NotFoundException('工单不存在');
    }

    if (record.linkedWorkOrderId && record.linkedWorkOrderId !== dto.workOrderId) {
      throw new BadRequestException('备料记录已绑定其他工单');
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(MaterialPreparation);
      const before = this.buildPreparationSnapshot(record);
      const shouldWriteLog =
        record.linkedWorkOrderId !== dto.workOrderId ||
        record.bindStatus !== PreparationBindStatus.BOUND;

      record.linkedWorkOrderId = dto.workOrderId;
      record.bindStatus = PreparationBindStatus.BOUND;
      const saved = await repo.save(record);

      if (shouldWriteLog) {
        await this.operationLogsService.create(
          {
            module: 'material_preparation',
            targetId: saved.id,
            action: OperationLogAction.BIND_MATERIAL_PREPARATION,
            operatorId: currentUser.id,
            detail: `绑定备料记录 ${saved.preparationNo} 到工单 ${dto.workOrderId}`,
            detailJson: {
              before,
              after: this.buildPreparationSnapshot(saved),
              inventoryAffected: false,
              inventoryTransactionIds: [],
              relatedSourceType: {
                before: null,
                after: 'preparation',
              },
            },
          },
          manager,
        );
      }

      return this.decoratePreparation(saved);
    });
  }

  async ensureConsumableForWorkOrderMaterial(
    input: EnsureConsumablePreparationInput,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(MaterialPreparation)
      : this.materialPreparationRepository;
    const record = await repo.findOne({
      where: {
        id: input.preparationId,
      },
    });

    if (!record) {
      throw new NotFoundException('备料记录不存在');
    }

    if (record.materialId !== input.materialId) {
      throw new BadRequestException('备料记录与材料不匹配');
    }

    if (record.linkedWorkOrderId && record.linkedWorkOrderId !== input.workOrderId) {
      throw new BadRequestException('备料记录已绑定其他工单');
    }

    if (!record.warehouseId) {
      throw new BadRequestException('备料记录未配置库房，禁止用于工单领料');
    }

    if (
      record.consumedWorkOrderMaterialId &&
      record.consumedWorkOrderMaterialId !== (input.currentWorkOrderMaterialId ?? null)
    ) {
      throw new BadRequestException('该备料记录已被完整消费，禁止重复使用');
    }

    return record;
  }

  async consumeForWorkOrderMaterial(
    preparationId: number,
    workOrderId: number,
    workOrderMaterialId: number,
    currentUser: CurrentUser,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(MaterialPreparation)
      : this.materialPreparationRepository;
    const record = await repo.findOne({ where: { id: preparationId } });

    if (!record) {
      throw new NotFoundException('备料记录不存在');
    }

    await this.ensureConsumableForWorkOrderMaterial(
      {
        preparationId,
        workOrderId,
        materialId: record.materialId,
        currentWorkOrderMaterialId: workOrderMaterialId,
      },
      manager,
    );

    const before = this.buildPreparationSnapshot(record);
    const shouldWriteLog =
      record.linkedWorkOrderId !== workOrderId ||
      record.bindStatus !== PreparationBindStatus.BOUND ||
      record.consumedWorkOrderMaterialId !== workOrderMaterialId ||
      !record.consumedAt;

    record.linkedWorkOrderId = workOrderId;
    record.bindStatus = PreparationBindStatus.BOUND;
    record.consumedWorkOrderMaterialId = workOrderMaterialId;
    record.consumedAt = record.consumedAt ?? new Date();

    const saved = await repo.save(record);

    if (shouldWriteLog) {
      await this.operationLogsService.create(
        {
          module: 'material_preparation',
          targetId: saved.id,
          action: OperationLogAction.BIND_MATERIAL_PREPARATION,
          operatorId: currentUser.id,
          detail: `备料记录 ${saved.preparationNo} 被工单材料 #${workOrderMaterialId} 完整消费`,
          detailJson: {
            before,
            after: this.buildPreparationSnapshot(saved),
            inventoryAffected: false,
            inventoryTransactionIds: [],
            relatedSourceType: {
              before: null,
              after: 'preparation',
            },
            relatedWorkOrderMaterialId: workOrderMaterialId,
          },
        },
        manager,
      );
    }

    return saved;
  }

  private decoratePreparation(record: MaterialPreparation) {
    const isOverdue =
      record.bindStatus === PreparationBindStatus.UNBOUND &&
      !!record.bindDeadlineAt &&
      record.bindDeadlineAt.getTime() < Date.now();

    return {
      ...record,
      isOverdue,
      isConsumed: !!record.consumedWorkOrderMaterialId,
    };
  }

  private buildPreparationSnapshot(record: MaterialPreparation) {
    return {
      id: record.id,
      preparationNo: record.preparationNo,
      linkedWorkOrderId: record.linkedWorkOrderId,
      bindStatus: record.bindStatus,
      consumedWorkOrderMaterialId: record.consumedWorkOrderMaterialId,
      consumedAt: record.consumedAt ? record.consumedAt.toISOString() : null,
      warehouseId: record.warehouseId,
      materialId: record.materialId,
      quantity: record.quantity,
      unitPrice: record.unitPrice,
      totalPrice: record.totalPrice,
    };
  }
}
