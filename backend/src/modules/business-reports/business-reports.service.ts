import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginationQuery, paginateArray } from '../../common/utils/pagination.util';
import { MaterialPreparation } from '../material-preparations/entities/material-preparation.entity';
import { Material } from '../materials/entities/material.entity';
import { MaterialStock } from '../material-stocks/entities/material-stock.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Warehouse } from '../warehouses/entities/warehouse.entity';
import { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { QueryInventoryAlertsDto } from './dto/query-inventory-alerts.dto';
import { QuerySupplierMaterialUsageDto } from './dto/query-supplier-material-usage.dto';
import { QueryUnboundOverduePreparationsDto } from './dto/query-unbound-overdue-preparations.dto';
import { QueryWorkOrderMaterialCostsDto } from './dto/query-work-order-material-costs.dto';

type SortOrder = 'ASC' | 'DESC';

@Injectable()
export class BusinessReportsService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly workOrderRepository: Repository<WorkOrder>,
    @InjectRepository(MaterialStock)
    private readonly materialStockRepository: Repository<MaterialStock>,
    @InjectRepository(MaterialPreparation)
    private readonly materialPreparationRepository: Repository<MaterialPreparation>,
    private readonly dataSource: DataSource,
  ) {}

  async getWorkOrderMaterialCosts(query: QueryWorkOrderMaterialCostsDto) {
    const qb = this.workOrderRepository
      .createQueryBuilder('wo')
      .leftJoin(WorkOrderMaterial, 'wom', 'wom.work_order_id = wo.id AND wom.deleted_at IS NULL')
      .select([
        'wo.id AS workOrderId',
        'wo.work_order_no AS workOrderNo',
        'wo.title AS title',
        'wo.customer_name AS customerName',
        'wo.status AS status',
        'wo.amount_due AS amountDue',
        'wo.amount_received AS amountReceived',
        'wo.material_cost_total AS materialCostTotal',
        'COUNT(wom.id) AS materialLineCount',
        'wo.created_at AS createdAt',
        'wo.updated_at AS updatedAt',
      ])
      .where("wo.status <> 'draft'")
      .andWhere("(wo.remark IS NULL OR wo.remark NOT LIKE :intakeMarker)", { intakeMarker: 'STARK_INTAKE_V1:%' })
      .groupBy('wo.id');

    if (query.workOrderNo) {
      qb.andWhere('wo.work_order_no LIKE :workOrderNo', {
        workOrderNo: `%${query.workOrderNo}%`,
      });
    }

    if (query.status) {
      qb.andWhere('wo.status = :status', { status: query.status });
    }

    if (query.customerName) {
      qb.andWhere('wo.customer_name LIKE :customerName', {
        customerName: `%${query.customerName}%`,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('wo.created_at >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo) {
      qb.andWhere('wo.created_at <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }

    const rows = await qb.getRawMany();
    const sortedRows = this.sortRows(
      rows,
      query,
      {
        workOrderNo: 'workOrderNo',
        title: 'title',
        customerName: 'customerName',
        status: 'status',
        amountDue: 'amountDue',
        amountReceived: 'amountReceived',
        materialCostTotal: 'materialCostTotal',
        materialLineCount: 'materialLineCount',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      },
      'updatedAt',
      'DESC',
    );

    return this.buildReportResult(sortedRows, query);
  }

  async getInventoryAlerts(query: QueryInventoryAlertsDto) {
    const qb = this.materialStockRepository
      .createQueryBuilder('stock')
      .innerJoin(Material, 'material', 'material.id = stock.material_id')
      .innerJoin(Warehouse, 'warehouse', 'warehouse.id = stock.warehouse_id')
      .leftJoin(Supplier, 'supplier', 'supplier.id = material.default_supplier_id')
      .select([
        'stock.id AS stockId',
        'warehouse.id AS warehouseId',
        'warehouse.name AS warehouseName',
        'warehouse.code AS warehouseCode',
        'material.id AS materialId',
        'material.material_no AS materialNo',
        'material.name AS materialName',
        'material.specification AS specification',
        'material.unit AS unit',
        'material.category AS category',
        'supplier.id AS supplierId',
        'supplier.name AS supplierName',
        'stock.current_quantity AS currentQuantity',
        'material.warning_quantity AS warningQuantity',
        '(material.warning_quantity - stock.current_quantity) AS shortageQuantity',
        'stock.updated_at AS updatedAt',
      ])
      .where('material.warning_quantity > 0');

    if (query.warehouseId) {
      qb.andWhere('stock.warehouse_id = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }

    if (query.materialId) {
      qb.andWhere('stock.material_id = :materialId', {
        materialId: query.materialId,
      });
    }

    if (query.supplierId) {
      qb.andWhere('material.default_supplier_id = :supplierId', {
        supplierId: query.supplierId,
      });
    }

    if (query.category) {
      qb.andWhere('material.category = :category', {
        category: query.category,
      });
    }

    if (query.onlyAlerts !== false) {
      qb.andWhere('stock.current_quantity <= material.warning_quantity');
    }

    const rows = await qb.getRawMany();
    const sortedRows = this.sortRows(
      rows,
      query,
      {
        warehouseName: 'warehouseName',
        materialName: 'materialName',
        currentQuantity: 'currentQuantity',
        warningQuantity: 'warningQuantity',
        shortageQuantity: 'shortageQuantity',
        updatedAt: 'updatedAt',
      },
      'shortageQuantity',
      'DESC',
    );

    return this.buildReportResult(sortedRows, query);
  }

  async getUnboundOverduePreparations(query: QueryUnboundOverduePreparationsDto) {
    const qb = this.materialPreparationRepository
      .createQueryBuilder('preparation')
      .innerJoin(Material, 'material', 'material.id = preparation.material_id')
      .leftJoin(Supplier, 'supplier', 'supplier.id = preparation.supplier_id')
      .leftJoin(Warehouse, 'warehouse', 'warehouse.id = preparation.warehouse_id')
      .select([
        'preparation.id AS id',
        'preparation.preparation_no AS preparationNo',
        'preparation.material_id AS materialId',
        'material.name AS materialName',
        'material.specification AS specification',
        'preparation.supplier_id AS supplierId',
        'supplier.name AS supplierName',
        'preparation.warehouse_id AS warehouseId',
        'warehouse.name AS warehouseName',
        'preparation.responsible_user_id AS responsibleUserId',
        'preparation.quantity AS quantity',
        'preparation.unit_price AS unitPrice',
        'preparation.total_price AS totalPrice',
        'preparation.bind_deadline_at AS bindDeadlineAt',
        'preparation.prepared_at AS preparedAt',
        'preparation.created_at AS createdAt',
        'true AS isOverdue',
      ])
      .where('preparation.bind_status = :bindStatus', { bindStatus: 'unbound' })
      .andWhere('preparation.bind_deadline_at IS NOT NULL')
      .andWhere('preparation.bind_deadline_at < :now', { now: new Date() });

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

    const rows = await qb.getRawMany();
    const sortedRows = this.sortRows(
      rows,
      query,
      {
        preparationNo: 'preparationNo',
        supplierName: 'supplierName',
        materialName: 'materialName',
        quantity: 'quantity',
        totalPrice: 'totalPrice',
        bindDeadlineAt: 'bindDeadlineAt',
        preparedAt: 'preparedAt',
        createdAt: 'createdAt',
      },
      'bindDeadlineAt',
      'ASC',
    );

    return this.buildReportResult(sortedRows, query);
  }

  async getSupplierMaterialUsage(query: QuerySupplierMaterialUsageDto) {
    const clauses = ['wom.deleted_at IS NULL'];
    const params: Array<number | string | Date> = [];

    if (query.supplierId) {
      clauses.push('COALESCE(prep.supplier_id, material.default_supplier_id) = ?');
      params.push(query.supplierId);
    }

    if (query.materialId) {
      clauses.push('wom.material_id = ?');
      params.push(query.materialId);
    }

    if (query.category) {
      clauses.push('material.category = ?');
      params.push(query.category);
    }

    if (query.dateFrom) {
      clauses.push('wom.created_at >= ?');
      params.push(new Date(query.dateFrom));
    }

    if (query.dateTo) {
      clauses.push('wom.created_at <= ?');
      params.push(new Date(query.dateTo));
    }

    const rows = await this.dataSource.query(
      `
        SELECT
          COALESCE(prep.supplier_id, material.default_supplier_id) AS supplierId,
          supplier.name AS supplierName,
          wom.material_id AS materialId,
          material.material_no AS materialNo,
          material.name AS materialName,
          material.specification AS specification,
          material.unit AS unit,
          material.category AS category,
          COUNT(wom.id) AS usageCount,
          SUM(wom.quantity) AS totalQuantity,
          SUM(wom.total_price) AS totalAmount,
          COUNT(DISTINCT wom.work_order_id) AS workOrderCount
        FROM work_order_materials wom
        INNER JOIN materials material ON material.id = wom.material_id
        LEFT JOIN material_preparations prep ON prep.id = wom.preparation_id
        LEFT JOIN suppliers supplier ON supplier.id = COALESCE(prep.supplier_id, material.default_supplier_id)
        WHERE ${clauses.join(' AND ')}
        GROUP BY
          COALESCE(prep.supplier_id, material.default_supplier_id),
          supplier.name,
          wom.material_id,
          material.material_no,
          material.name,
          material.specification,
          material.unit,
          material.category
      `,
      params,
    );

    const sortedRows = this.sortRows(
      rows,
      query,
      {
        supplierName: 'supplierName',
        materialName: 'materialName',
        usageCount: 'usageCount',
        totalQuantity: 'totalQuantity',
        totalAmount: 'totalAmount',
        workOrderCount: 'workOrderCount',
      },
      'totalAmount',
      'DESC',
    );

    return this.buildReportResult(sortedRows, query);
  }

  private buildReportResult<T>(rows: T[], query: PaginationQuery) {
    return paginateArray(rows, query);
  }

  private sortRows<T extends Record<string, unknown>>(
    rows: T[],
    query: { sortBy?: string; sortOrder?: string },
    sortableFields: Record<string, keyof T>,
    defaultSortBy: string,
    defaultSortOrder: SortOrder,
  ) {
    const sortBy = sortableFields[query.sortBy ?? defaultSortBy] ?? sortableFields[defaultSortBy];
    const sortOrder = this.normalizeSortOrder(query.sortOrder, defaultSortOrder);
    const factor = sortOrder === 'ASC' ? 1 : -1;

    return [...rows].sort((left, right) => {
      const leftValue = this.normalizeComparableValue(left[sortBy]);
      const rightValue = this.normalizeComparableValue(right[sortBy]);

      if (leftValue === rightValue) {
        return 0;
      }

      if (leftValue === null) {
        return 1;
      }

      if (rightValue === null) {
        return -1;
      }

      return leftValue > rightValue ? factor : -factor;
    });
  }

  private normalizeSortOrder(value: string | undefined, fallback: SortOrder): SortOrder {
    if (!value) {
      return fallback;
    }

    return value.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  }

  private normalizeComparableValue(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    const text = String(value).trim();

    if (!text) {
      return '';
    }

    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return Number(text);
    }

    const timestamp = Date.parse(text);

    if (!Number.isNaN(timestamp) && /[-T:]/.test(text)) {
      return timestamp;
    }

    return text.toLowerCase();
  }
}
