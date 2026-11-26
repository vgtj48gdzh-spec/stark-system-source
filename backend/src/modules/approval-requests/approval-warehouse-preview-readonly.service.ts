import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AbcSyncInventoryLedger } from '../abc-sync/entities/abc-sync-inventory-ledger.entity';
import { AbcSyncMaterial } from '../abc-sync/entities/abc-sync-material.entity';
import { AbcSyncSupplier } from '../abc-sync/entities/abc-sync-supplier.entity';
import { AbcSyncWarehouse } from '../abc-sync/entities/abc-sync-warehouse.entity';
import { InventoryTransaction } from '../inventory-transactions/entities/inventory-transaction.entity';
import { MaterialStock } from '../material-stocks/entities/material-stock.entity';
import { Material } from '../materials/entities/material.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import {
  ApprovalWarehouseEvidenceCandidatePreview,
  ApprovalWarehouseEvidenceIntakeInput,
} from './approval-warehouse-evidence-intake.contract';
import { ApprovalWarehouseEvidenceIntakeService } from './approval-warehouse-evidence-intake.service';
import { QueryApprovalWarehousePreviewDto } from './dto/query-approval-warehouse-preview.dto';

const DEFAULT_PREVIEW_LIMIT = 50;
const MAX_PREVIEW_LIMIT = 100;
const MAX_BUILDER_CANDIDATES = 500;

type PreviewBoundary = ApprovalWarehouseEvidenceCandidatePreview['boundary'] & {
  readonlySurface: true;
  writesDatabase: false;
};

@Injectable()
export class ApprovalWarehousePreviewReadonlyService {
  constructor(
    @InjectRepository(AbcSyncMaterial)
    private readonly abcSyncMaterialRepository: Repository<AbcSyncMaterial>,
    @InjectRepository(AbcSyncSupplier)
    private readonly abcSyncSupplierRepository: Repository<AbcSyncSupplier>,
    @InjectRepository(AbcSyncWarehouse)
    private readonly abcSyncWarehouseRepository: Repository<AbcSyncWarehouse>,
    @InjectRepository(AbcSyncInventoryLedger)
    private readonly abcSyncInventoryLedgerRepository: Repository<AbcSyncInventoryLedger>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Material)
    private readonly materialRepository: Repository<Material>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(MaterialStock)
    private readonly materialStockRepository: Repository<MaterialStock>,
    @InjectRepository(InventoryTransaction)
    private readonly inventoryTransactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(WorkOrderMaterial)
    private readonly workOrderMaterialRepository: Repository<WorkOrderMaterial>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    private readonly intakeService: ApprovalWarehouseEvidenceIntakeService,
  ) {}

  async findPreviews(query: QueryApprovalWarehousePreviewDto = {}) {
    const limit = normalizeLimit(query.limit);
    return this.collectPreviews(query, limit, Math.max(limit, DEFAULT_PREVIEW_LIMIT));
  }

  async findPreviewByCandidateRef(candidateRef: string) {
    const sourceResults = await Promise.all(
      (['stark_work_order', 'stark_inventory', 'stark_abc_sync'] as const).map((sourceSystem) =>
        this.collectPreviews(
          { sourceSystem },
          MAX_BUILDER_CANDIDATES,
          MAX_BUILDER_CANDIDATES,
        ),
      ),
    );

    for (const result of sourceResults) {
      const preview = result.list.find((item) => item.candidateRef === candidateRef);
      if (preview) {
        if (
          preview.sourceSystem === 'stark_work_order' &&
          preview.sourceEntityType === 'work_order_materials'
        ) {
          const sourceId = Number(preview.sourceRef.split(':').pop());
          if (!Number.isInteger(sourceId) || sourceId <= 0) {
            return null;
          }
          const source = await this.workOrderMaterialRepository.findOne({
            where: { id: sourceId },
          });
          return source
            ? this.buildTargetedWorkOrderMaterialPreview(preview, source)
            : null;
        }
        return preview;
      }
    }

    return null;
  }

  async rebuildLockedWorkOrderMaterialPreview(
    originalPreview: ApprovalWarehouseEvidenceCandidatePreview,
    source: WorkOrderMaterial,
    manager: EntityManager,
  ) {
    if (
      originalPreview.sourceSystem !== 'stark_work_order' ||
      originalPreview.sourceEntityType !== 'work_order_materials' ||
      originalPreview.sourceRef !== `work_order_materials:${source.id}`
    ) {
      return null;
    }

    return this.buildTargetedWorkOrderMaterialPreview(originalPreview, source, manager);
  }

  private async buildTargetedWorkOrderMaterialPreview(
    originalPreview: ApprovalWarehouseEvidenceCandidatePreview,
    source: WorkOrderMaterial,
    manager?: EntityManager,
  ) {
    const workOrderRepository = manager?.getRepository(WorkOrder) ?? this.workOrderRepository;
    const materialRepository = manager?.getRepository(Material) ?? this.materialRepository;
    const warehouseRepository = manager?.getRepository(Warehouse) ?? this.warehouseRepository;
    const supplierRepository = manager?.getRepository(Supplier) ?? this.supplierRepository;
    const lock = manager ? { lock: { mode: 'pessimistic_read' as const } } : {};

    const workOrder = await workOrderRepository.findOne({
      where: { id: source.workOrderId },
      ...lock,
    });
    const material = await materialRepository.findOne({
      where: { id: source.materialId },
      ...lock,
    });
    const warehouse = source.warehouseId
      ? await warehouseRepository.findOne({
          where: { id: source.warehouseId },
          ...lock,
        })
      : null;
    const supplier = material?.defaultSupplierId
      ? await supplierRepository.findOne({
          where: { id: material.defaultSupplierId },
          ...lock,
        })
      : null;

    const previews = this.intakeService.buildCandidatePreviews({
      warehouses: warehouse ? [mapWarehouse(warehouse)] : [],
      materials: material ? [mapMaterial(material)] : [],
      suppliers: supplier ? [mapSupplier(supplier)] : [],
      workOrderMaterials: [mapWorkOrderMaterial(source)],
      workOrders: workOrder ? [mapWorkOrder(workOrder)] : [],
      options: { maxCandidates: 10 },
    });

    return previews.find((item) => item.candidateRef === originalPreview.candidateRef) ?? null;
  }

  private async collectPreviews(
    query: QueryApprovalWarehousePreviewDto,
    limit: number,
    repositoryLimit: number,
  ) {
    const includeAbc = !query.sourceSystem || query.sourceSystem === 'stark_abc_sync';
    const includeInventory = !query.sourceSystem || query.sourceSystem === 'stark_inventory';
    const includeWorkOrder = !query.sourceSystem || query.sourceSystem === 'stark_work_order';
    const includeLocalContext = includeInventory || includeWorkOrder;

    const [
      abcMaterials,
      abcSuppliers,
      abcWarehouses,
      abcInventoryLedger,
      warehouses,
      materials,
      suppliers,
      materialStocks,
      inventoryTransactions,
      workOrderMaterials,
      workOrders,
    ] = await Promise.all([
      includeAbc ? this.abcSyncMaterialRepository.find({ order: { updatedAt: 'DESC' }, take: repositoryLimit }) : [],
      includeAbc ? this.abcSyncSupplierRepository.find({ order: { updatedAt: 'DESC' }, take: repositoryLimit }) : [],
      includeAbc ? this.abcSyncWarehouseRepository.find({ order: { updatedAt: 'DESC' }, take: repositoryLimit }) : [],
      includeAbc
        ? this.abcSyncInventoryLedgerRepository.find({ order: { updatedAt: 'DESC' }, take: repositoryLimit })
        : [],
      includeLocalContext ? this.warehouseRepository.find({ order: { updatedAt: 'DESC' }, take: repositoryLimit }) : [],
      includeLocalContext ? this.materialRepository.find({ order: { updatedAt: 'DESC' }, take: repositoryLimit }) : [],
      includeLocalContext ? this.supplierRepository.find({ order: { updatedAt: 'DESC' }, take: repositoryLimit }) : [],
      includeInventory ? this.materialStockRepository.find({ order: { updatedAt: 'DESC' }, take: repositoryLimit }) : [],
      includeInventory
        ? this.inventoryTransactionRepository.find({ order: { createdAt: 'DESC' }, take: repositoryLimit })
        : [],
      includeWorkOrder
        ? this.workOrderMaterialRepository.find({ order: { createdAt: 'DESC' }, take: repositoryLimit })
        : [],
      includeWorkOrder ? this.workOrderRepository.find({ order: { updatedAt: 'DESC' }, take: repositoryLimit }) : [],
    ]);

    const relatedMaterialIds = uniquePositiveIds(workOrderMaterials.map((item) => item.materialId));
    const relatedWarehouseIds = uniquePositiveIds(
      workOrderMaterials.map((item) => item.warehouseId),
    );
    const relatedWorkOrderIds = uniquePositiveIds(
      workOrderMaterials.map((item) => item.workOrderId),
    );
    const [relatedMaterials, relatedWarehouses, relatedWorkOrders] = await Promise.all([
      relatedMaterialIds.length
        ? this.materialRepository.findBy({ id: In(relatedMaterialIds) })
        : [],
      relatedWarehouseIds.length
        ? this.warehouseRepository.findBy({ id: In(relatedWarehouseIds) })
        : [],
      relatedWorkOrderIds.length
        ? this.workOrderRepository.findBy({ id: In(relatedWorkOrderIds) })
        : [],
    ]);
    const allMaterials = mergeEntitiesById(materials, relatedMaterials);
    const relatedSupplierIds = uniquePositiveIds(
      allMaterials.map((item) => item.defaultSupplierId),
    );
    const relatedSuppliers = relatedSupplierIds.length
      ? await this.supplierRepository.findBy({ id: In(relatedSupplierIds) })
      : [];
    const allWarehouses = mergeEntitiesById(warehouses, relatedWarehouses);
    const allSuppliers = mergeEntitiesById(suppliers, relatedSuppliers);
    const allWorkOrders = mergeEntitiesById(workOrders, relatedWorkOrders);

    const previews = this.intakeService.buildCandidatePreviews({
      abcMaterials: abcMaterials.map(mapAbcMaterial),
      abcSuppliers: abcSuppliers.map(mapAbcSupplier),
      abcWarehouses: abcWarehouses.map(mapAbcWarehouse),
      abcInventoryLedger: abcInventoryLedger.map(mapAbcInventoryLedger),
      warehouses: allWarehouses.map(mapWarehouse),
      materials: allMaterials.map(mapMaterial),
      suppliers: allSuppliers.map(mapSupplier),
      materialStocks: materialStocks.map(mapMaterialStock),
      inventoryTransactions: inventoryTransactions.map(mapInventoryTransaction),
      workOrderMaterials: workOrderMaterials.map(mapWorkOrderMaterial),
      workOrders: allWorkOrders.map(mapWorkOrder),
      options: { maxCandidates: MAX_BUILDER_CANDIDATES },
    } satisfies ApprovalWarehouseEvidenceIntakeInput);

    const filteredPreviews = previews
      .filter((preview) => !query.candidateType || preview.candidateType === query.candidateType)
      .filter((preview) => !query.sourceSystem || preview.sourceSystem === query.sourceSystem)
      .filter((preview) => !query.status || preview.status === query.status);
    const list = filteredPreviews.slice(0, limit);

    return {
      list,
      summary: {
        total: list.length,
        totalBeforeLimit: filteredPreviews.length,
        limit,
        filters: {
          candidateType: query.candidateType ?? null,
          sourceSystem: query.sourceSystem ?? null,
          status: query.status ?? null,
        },
        byCandidateType: countBy(list, (preview) => preview.candidateType),
        byStatus: countBy(list, (preview) => preview.status),
        bySourceSystem: countBy(list, (preview) => preview.sourceSystem),
        sourceEvidenceAreas: [
          'abc_sync_materials',
          'abc_sync_suppliers',
          'abc_sync_warehouses',
          'abc_sync_inventory_ledger',
          'warehouses',
          'materials',
          'suppliers',
          'material_stocks',
          'inventory_transactions',
          'work_order_materials',
          'work_orders',
        ],
        boundary: buildReadonlyBoundary(),
      },
      boundary: buildReadonlyBoundary(),
    };
  }
}

function normalizeLimit(value: number | undefined) {
  const numeric = Number(value ?? DEFAULT_PREVIEW_LIMIT);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_PREVIEW_LIMIT;
  }
  return Math.min(MAX_PREVIEW_LIMIT, Math.max(1, Math.trunc(numeric)));
}

function buildReadonlyBoundary(): PreviewBoundary {
  return {
    readonlySurface: true,
    previewOnly: true,
    oldAbcReadonly: true,
    writesOldAbc: false,
    writesStark: false,
    writesDatabase: false,
    createsApprovalRequest: false,
    createsPaymentIntent: false,
    confirmsBankSms: false,
    createsSuggestedLink: false,
    mutatesVirtualLedger: false,
  };
}

function countBy<T>(values: T[], getKey: (value: T) => string) {
  return values.reduce<Record<string, number>>((result, value) => {
    const key = getKey(value);
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
}

function uniquePositiveIds(values: Array<number | null | undefined>) {
  return [
    ...new Set(
      values.filter(
        (value): value is number =>
          typeof value === 'number' && Number.isInteger(value) && value > 0,
      ),
    ),
  ];
}

function mergeEntitiesById<T extends { id: number }>(primary: T[], related: T[]) {
  const merged = new Map<number, T>();
  for (const item of [...primary, ...related]) {
    merged.set(item.id, item);
  }
  return [...merged.values()];
}

function mapAbcMaterial(material: AbcSyncMaterial) {
  return {
    sourceSystem: material.sourceSystem,
    sourceTable: material.sourceTable,
    sourceId: material.sourceId,
    materialName: material.materialName,
    materialCode: material.materialCode,
    warningQuantityStandard: material.warningQuantityStandard,
    storageAmountStandard: material.storageAmountStandard,
    saleAmountStandard: material.saleAmountStandard,
    quantityUnit: material.quantityUnit,
    supplierIdsRaw: material.supplierIdsRaw,
    mappingConfirmed: material.mappingConfirmed,
  };
}

function mapAbcSupplier(supplier: AbcSyncSupplier) {
  return {
    sourceSystem: supplier.sourceSystem,
    sourceTable: supplier.sourceTable,
    sourceId: supplier.sourceId,
    supplierName: supplier.supplierName,
    supplierStatusStandard: supplier.supplierStatusStandard,
    mappingConfirmed: supplier.mappingConfirmed,
  };
}

function mapAbcWarehouse(warehouse: AbcSyncWarehouse) {
  return {
    sourceSystem: warehouse.sourceSystem,
    sourceTable: warehouse.sourceTable,
    sourceId: warehouse.sourceId,
    warehouseSourceId: warehouse.warehouseSourceId,
    warehouseName: warehouse.warehouseName,
    warehouseStatusStandard: warehouse.warehouseStatusStandard,
    quantityStandard: warehouse.quantityStandard,
    amountStandard: warehouse.amountStandard,
    supplierSourceId: warehouse.supplierSourceId,
    materialSourceId: warehouse.materialSourceId,
    mappingConfirmed: warehouse.mappingConfirmed,
  };
}

function mapAbcInventoryLedger(ledger: AbcSyncInventoryLedger) {
  return {
    sourceSystem: ledger.sourceSystem,
    sourceTable: ledger.sourceTable,
    sourceId: ledger.sourceId,
    ledgerTypeStandard: ledger.ledgerTypeStandard,
    statusStandard: ledger.statusStandard,
    quantityStandard: ledger.quantityStandard,
    amountStandard: ledger.amountStandard,
    warehouseSourceId: ledger.warehouseSourceId,
    materialSourceId: ledger.materialSourceId,
    supplierSourceId: ledger.supplierSourceId,
    mappingConfirmed: ledger.mappingConfirmed,
  };
}

function mapWarehouse(warehouse: Warehouse) {
  return {
    id: warehouse.id,
    warehouseNo: warehouse.warehouseNo,
    name: warehouse.name,
    code: warehouse.code,
    status: warehouse.status,
  };
}

function mapMaterial(material: Material) {
  return {
    id: material.id,
    materialNo: material.materialNo,
    name: material.name,
    unit: material.unit,
    defaultSupplierId: material.defaultSupplierId,
    defaultUnitPrice: material.defaultUnitPrice,
    warningQuantity: material.warningQuantity,
    status: material.status,
  };
}

function mapSupplier(supplier: Supplier) {
  return {
    id: supplier.id,
    supplierNo: supplier.supplierNo,
    name: supplier.name,
    status: supplier.status,
  };
}

function mapMaterialStock(stock: MaterialStock) {
  return {
    id: stock.id,
    warehouseId: stock.warehouseId,
    materialId: stock.materialId,
    currentQuantity: stock.currentQuantity,
  };
}

function mapInventoryTransaction(transaction: InventoryTransaction) {
  return {
    id: transaction.id,
    transactionNo: transaction.transactionNo,
    transactionType: transaction.transactionType,
    warehouseId: transaction.warehouseId,
    materialId: transaction.materialId,
    quantity: transaction.quantity,
    unitPrice: transaction.unitPrice,
    totalPrice: transaction.totalPrice,
    relatedWorkOrderId: transaction.relatedWorkOrderId,
    relatedPreparationId: transaction.relatedPreparationId,
    relatedWorkOrderMaterialId: transaction.relatedWorkOrderMaterialId,
  };
}

function mapWorkOrderMaterial(item: WorkOrderMaterial) {
  return {
    id: item.id,
    workOrderId: item.workOrderId,
    materialId: item.materialId,
    warehouseId: item.warehouseId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    sourceType: item.sourceType,
  };
}

function mapWorkOrder(workOrder: WorkOrder) {
  return {
    id: workOrder.id,
    workOrderNo: workOrder.workOrderNo,
    title: workOrder.title,
    materialCostTotal: workOrder.materialCostTotal,
    status: workOrder.status,
  };
}
