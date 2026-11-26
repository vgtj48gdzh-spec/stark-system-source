import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import {
  buildPaginationResult,
  getPagination,
  paginateArray,
} from '../../common/utils/pagination.util';
import { AbcMappingConfidence } from '../../shared/enums/abc-mapping-confidence.enum';
import { AbcSyncTargetDomain } from '../../shared/enums/abc-sync-target-domain.enum';
import { OperationLogAction } from '../../shared/enums/operation-log-action.enum';
import { SyncJobRunStatus } from '../../shared/enums/sync-job-run-status.enum';
import { ManualNormalizeAbcSyncDto } from '../abc-integration/dto/manual-normalize-abc-sync.dto';
import { AbcRawCard } from '../abc-raw/entities/abc-raw-card.entity';
import { AbcRawInventory } from '../abc-raw/entities/abc-raw-inventory.entity';
import { AbcRawOrder } from '../abc-raw/entities/abc-raw-order.entity';
import { AbcRawTransaction } from '../abc-raw/entities/abc-raw-transaction.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import { SourceSystemsService } from '../source-systems/source-systems.service';
import { SyncCheckpoint } from '../sync-jobs/entities/sync-checkpoint.entity';
import { SyncJobRun } from '../sync-jobs/entities/sync-job-run.entity';
import { SyncJob } from '../sync-jobs/entities/sync-job.entity';
import { SyncJobsService } from '../sync-jobs/sync-jobs.service';
import { CreateAbcAmountRuleDto } from './dto/create-abc-amount-rule.dto';
import { CreateAbcStatusMappingDto } from './dto/create-abc-status-mapping.dto';
import { QueryAbcAmountRulesDto } from './dto/query-abc-amount-rules.dto';
import { QueryAbcStatusMappingsDto } from './dto/query-abc-status-mappings.dto';
import { QueryAbcSyncCardLedgerDto } from './dto/query-abc-sync-card-ledger.dto';
import { QueryAbcSyncCardMappingExceptionsDto } from './dto/query-abc-sync-card-mapping-exceptions.dto';
import { QueryAbcSyncCardsDto } from './dto/query-abc-sync-cards.dto';
import { QueryAbcSyncCheckpointsDto } from './dto/query-abc-sync-checkpoints.dto';
import { QueryAbcSyncDashboardDto } from './dto/query-abc-sync-dashboard.dto';
import { QueryAbcSyncFundsDto } from './dto/query-abc-sync-funds.dto';
import { QueryAbcSyncInventoryLedgerDto } from './dto/query-abc-sync-inventory-ledger.dto';
import { QueryAbcSyncInventoryMappingExceptionsDto } from './dto/query-abc-sync-inventory-mapping-exceptions.dto';
import { QueryAbcSyncJobRunsDto } from './dto/query-abc-sync-job-runs.dto';
import { QueryAbcSyncMaterialsDto } from './dto/query-abc-sync-materials.dto';
import { QueryAbcSyncMappingExceptionsDto } from './dto/query-abc-sync-mapping-exceptions.dto';
import { QueryAbcSyncOrdersDto } from './dto/query-abc-sync-orders.dto';
import { QueryAbcSyncSuppliersDto } from './dto/query-abc-sync-suppliers.dto';
import { QueryAbcSyncWarehousesDto } from './dto/query-abc-sync-warehouses.dto';
import { ToggleAbcRuleDto } from './dto/toggle-abc-rule.dto';
import { UpdateAbcAmountRuleDto } from './dto/update-abc-amount-rule.dto';
import { UpdateAbcStatusMappingDto } from './dto/update-abc-status-mapping.dto';
import { AbcAmountRule } from './entities/abc-amount-rule.entity';
import { AbcSyncCardLedger } from './entities/abc-sync-card-ledger.entity';
import { AbcSyncCard } from './entities/abc-sync-card.entity';
import { AbcSyncInventoryLedger } from './entities/abc-sync-inventory-ledger.entity';
import { AbcSyncMaterial } from './entities/abc-sync-material.entity';
import { AbcStatusMapping } from './entities/abc-status-mapping.entity';
import { AbcSyncFund } from './entities/abc-sync-fund.entity';
import { AbcSyncOrder } from './entities/abc-sync-order.entity';
import { AbcSyncSupplier } from './entities/abc-sync-supplier.entity';
import { AbcSyncWarehouse } from './entities/abc-sync-warehouse.entity';

type RawRow = Record<string, unknown>;
type SortDirection = 'ASC' | 'DESC';

export interface NormalizationTarget {
  targetDomain: AbcSyncTargetDomain;
  sourceTable: string;
  rawTableName: string;
  targetTable: string;
}

export interface NormalizeTargetInput {
  sourceSystemCode: string;
  batchNo: string;
  syncedAt: Date;
  target: NormalizationTarget;
}

export interface NormalizeTargetSummary {
  targetDomain: AbcSyncTargetDomain;
  sourceTable: string;
  rawTableName: string;
  targetTable: string;
  totalRecords: number;
  createdRecords: number;
  updatedRecords: number;
  unconfirmedRecords: number;
  checkpointValue: string | null;
}

interface MappingResult {
  sourceField: string | null;
  rawValue: string | null;
  standardValue: string | null;
  standardUnit?: string | null;
  confidenceLevel: AbcMappingConfidence;
  notes: string[];
  confirmed: boolean;
}

interface OrderTableConfig {
  businessType: string;
  statusField: string;
  additionalStatusFields: string[];
  amountField: string;
}

interface FundTableConfig {
  rawTableName: string;
  amountField: string;
  statusField: string;
  relatedOrderField: string;
  fundTypeField?: string;
  fundTypeConstant?: string;
}

interface CardTableConfig {
  cardObjectType: string;
  statusField: string;
  amountField?: string;
  extraAmountField?: string;
  cardNameField?: string;
  cardNumberField?: string;
  sourceCardIdField?: string;
  sourceUserIdField?: string;
  sourceMerchantIdField?: string;
}

interface CardLedgerTableConfig {
  ledgerTypeField?: string;
  ledgerTypeConstant?: string;
  statusField: string;
  amountField: string;
  balanceField?: string;
  relatedCardField?: string;
  relatedOrderField?: string;
  sourceUserIdField?: string;
  sourceMerchantIdField?: string;
}

interface InventoryMaterialTableConfig {
  statusField: string;
  codeField: string;
  nameField: string;
  storageAmountField: string;
  saleAmountField: string;
  warningQuantityField: string;
  quantityUnitField?: string;
  supplierIdsField?: string;
  sourceMerchantIdField?: string;
}

interface InventorySupplierTableConfig {
  statusField: string;
  nameField: string;
  contactField?: string;
  phoneField?: string;
  emailField?: string;
  companySiteField?: string;
  sourceMerchantIdField?: string;
}

interface InventoryWarehouseTableConfig {
  statusField: string;
  warehouseSourceIdField: string;
  warehouseNameField?: string;
  quantityField?: string;
  quantityUnit?: string;
  amountField?: string;
  sourceMerchantIdField?: string;
  supplierSourceIdField?: string;
  materialSourceIdField?: string;
}

interface InventoryLedgerTableConfig {
  ledgerTypeField?: string;
  ledgerTypeConstant?: string;
  statusField: string;
  quantityField?: string;
  quantityUnit?: string;
  amountField?: string;
  warehouseSourceIdField?: string;
  materialSourceIdField?: string;
  supplierSourceIdField?: string;
  sourceMerchantIdField?: string;
  sourceOrderField?: string;
  splitGoodsList?: boolean;
}

export interface MappingExceptionItem {
  targetDomain: 'orders' | 'funds';
  id: number;
  sourceTable: string;
  sourceId: string;
  sourceOrderNo: string | null;
  statusStandard: string | null;
  mappingConfirmed: boolean;
  mappingNotes: string | null;
  syncedAt: Date;
  sourceUpdatedAt: Date | null;
  syncBatchNo: string;
  exceptionTypes: string[];
  normalizedPayload: Record<string, unknown>;
}

export interface CardMappingExceptionItem {
  recordType: 'cards' | 'card_ledger';
  id: number;
  sourceTable: string;
  sourceId: string;
  sourceOrderNo: string | null;
  statusStandard: string | null;
  mappingConfirmed: boolean;
  mappingNotes: string | null;
  syncedAt: Date;
  sourceUpdatedAt: Date | null;
  syncBatchNo: string;
  exceptionTypes: string[];
  normalizedPayload: Record<string, unknown>;
}

export interface InventoryMappingExceptionItem {
  recordType: 'materials' | 'suppliers' | 'warehouses' | 'inventory_ledger';
  id: number;
  sourceTable: string;
  sourceId: string;
  sourceOrderNo: string | null;
  statusStandard: string | null;
  mappingConfirmed: boolean;
  mappingNotes: string | null;
  syncedAt: Date;
  sourceUpdatedAt: Date | null;
  syncBatchNo: string;
  exceptionTypes: string[];
  normalizedPayload: Record<string, unknown>;
}

interface DashboardExceptionItem {
  domain: 'orders' | 'funds' | 'cards' | 'inventory';
  sourceTable: string;
  sourceOrderNo: string | null;
  statusStandard: string | null;
  mappingConfirmed: boolean;
  mappingNotes: string | null;
  syncedAt: Date;
  sourceUpdatedAt: Date | null;
  exceptionTypes: string[];
}

interface AbcDashboardCountItem {
  key: string;
  label: string;
  count: number;
}

interface AbcDashboardAmountItem extends AbcDashboardCountItem {
  amountStandard?: string;
}

const ORDER_TARGETS: NormalizationTarget[] = [
  { targetDomain: AbcSyncTargetDomain.ORDERS, sourceTable: 'order', rawTableName: 'abc_raw_orders', targetTable: 'abc_sync_orders' },
  { targetDomain: AbcSyncTargetDomain.ORDERS, sourceTable: 'repair_order', rawTableName: 'abc_raw_orders', targetTable: 'abc_sync_orders' },
  { targetDomain: AbcSyncTargetDomain.ORDERS, sourceTable: 'supermarket_order', rawTableName: 'abc_raw_orders', targetTable: 'abc_sync_orders' },
  { targetDomain: AbcSyncTargetDomain.ORDERS, sourceTable: 'top_up_order', rawTableName: 'abc_raw_orders', targetTable: 'abc_sync_orders' },
  { targetDomain: AbcSyncTargetDomain.ORDERS, sourceTable: 'goods_group_order', rawTableName: 'abc_raw_orders', targetTable: 'abc_sync_orders' },
];

const FUND_TARGETS: NormalizationTarget[] = [
  { targetDomain: AbcSyncTargetDomain.FUNDS, sourceTable: 'transaction', rawTableName: 'abc_raw_transactions', targetTable: 'abc_sync_funds' },
  { targetDomain: AbcSyncTargetDomain.FUNDS, sourceTable: 'top_up_order', rawTableName: 'abc_raw_orders', targetTable: 'abc_sync_funds' },
];

const CARD_TARGETS: NormalizationTarget[] = [
  { targetDomain: AbcSyncTargetDomain.CARDS, sourceTable: 'shopping_card', rawTableName: 'abc_raw_cards', targetTable: 'abc_sync_cards' },
  { targetDomain: AbcSyncTargetDomain.CARDS, sourceTable: 'goods_group', rawTableName: 'abc_raw_cards', targetTable: 'abc_sync_cards' },
  { targetDomain: AbcSyncTargetDomain.CARDS, sourceTable: 'user_shopping_card', rawTableName: 'abc_raw_cards', targetTable: 'abc_sync_cards' },
  { targetDomain: AbcSyncTargetDomain.CARDS, sourceTable: 'user_shopping_card_money', rawTableName: 'abc_raw_cards', targetTable: 'abc_sync_card_ledger' },
  { targetDomain: AbcSyncTargetDomain.CARDS, sourceTable: 'user_shopping_card_recharge', rawTableName: 'abc_raw_cards', targetTable: 'abc_sync_card_ledger' },
];

const INVENTORY_TARGETS: NormalizationTarget[] = [
  { targetDomain: AbcSyncTargetDomain.INVENTORY, sourceTable: 'merchant_material', rawTableName: 'abc_raw_inventory', targetTable: 'abc_sync_materials' },
  { targetDomain: AbcSyncTargetDomain.INVENTORY, sourceTable: 'merchant_supplier', rawTableName: 'abc_raw_inventory', targetTable: 'abc_sync_suppliers' },
  { targetDomain: AbcSyncTargetDomain.INVENTORY, sourceTable: 'merchant_warehouse', rawTableName: 'abc_raw_inventory', targetTable: 'abc_sync_warehouses' },
  { targetDomain: AbcSyncTargetDomain.INVENTORY, sourceTable: 'merchant_warehouse_out', rawTableName: 'abc_raw_inventory', targetTable: 'abc_sync_inventory_ledger' },
];

const ORDER_TABLE_CONFIGS: Record<string, OrderTableConfig> = {
  order: { businessType: 'service_order', statusField: 'status', additionalStatusFields: ['new_status', 'pay_type'], amountField: 'amount' },
  repair_order: { businessType: 'repair_order', statusField: 'order_status', additionalStatusFields: ['status', 'user_order_status', 'repair_user_status', 'settlement_status'], amountField: 'amount' },
  supermarket_order: { businessType: 'supermarket_order', statusField: 'take_status', additionalStatusFields: ['online_status', 'order_type', 'distribution_type', 'pay_type'], amountField: 'money' },
  top_up_order: { businessType: 'top_up_order', statusField: 'pay_status', additionalStatusFields: ['is_billing', 'source'], amountField: 'amount' },
  goods_group_order: {
    businessType: 'goods_group_order',
    statusField: 'status',
    additionalStatusFields: ['type', 'award', 'resell_status', 'source_type', 'goods_group_id', 'shopping_card_id'],
    amountField: 'total_price',
  },
};

const FUND_TABLE_CONFIGS: Record<string, FundTableConfig> = {
  transaction: { rawTableName: 'abc_raw_transactions', amountField: 'amount', statusField: 'type', relatedOrderField: 'order_num', fundTypeField: 'type' },
  top_up_order: { rawTableName: 'abc_raw_orders', amountField: 'amount', statusField: 'pay_status', relatedOrderField: 'num', fundTypeConstant: 'recharge' },
};

const CARD_TABLE_CONFIGS: Record<string, CardTableConfig> = {
  shopping_card: {
    cardObjectType: 'card_template',
    statusField: 'status',
    cardNameField: 'name',
    sourceCardIdField: 'id',
    sourceMerchantIdField: 'merchant_id',
  },
  goods_group: {
    cardObjectType: 'goods_group_package',
    statusField: 'status',
    amountField: 'price',
    extraAmountField: 'shopping_card_money',
    cardNameField: 'name',
    sourceCardIdField: 'shopping_card_id',
    sourceMerchantIdField: 'merchant_id',
  },
  user_shopping_card: {
    cardObjectType: 'user_card_account',
    statusField: 'derived_status',
    amountField: 'balance',
    extraAmountField: 'total_amount',
    cardNumberField: 'card_number',
    sourceCardIdField: 'card_id',
    sourceUserIdField: 'user_id',
    sourceMerchantIdField: 'merchant_id',
  },
};

const CARD_LEDGER_TABLE_CONFIGS: Record<string, CardLedgerTableConfig> = {
  user_shopping_card_money: {
    ledgerTypeField: 'source_type',
    statusField: 'derived_status',
    amountField: 'amount',
    balanceField: 'balance',
    relatedCardField: 'user_card_id',
    sourceUserIdField: 'user_id',
  },
  user_shopping_card_recharge: {
    ledgerTypeConstant: 'recharge',
    statusField: 'status',
    amountField: 'amount',
    relatedCardField: 'user_card_id',
    relatedOrderField: 'order_num',
    sourceUserIdField: 'user_id',
  },
};

const INVENTORY_MATERIAL_TABLE_CONFIG: InventoryMaterialTableConfig = {
  statusField: 'derived_status',
  codeField: 'encode',
  nameField: 'name',
  storageAmountField: 'storage_price',
  saleAmountField: 'price',
  warningQuantityField: 'min_stock_warning',
  quantityUnitField: 'unit',
  supplierIdsField: 'supplier_ids',
  sourceMerchantIdField: 'merchant_id',
};

const INVENTORY_SUPPLIER_TABLE_CONFIG: InventorySupplierTableConfig = {
  statusField: 'derived_status',
  nameField: 'name',
  contactField: 'contact',
  phoneField: 'phone',
  emailField: 'email',
  companySiteField: 'company_site',
  sourceMerchantIdField: 'merchant_id',
};

const INVENTORY_WAREHOUSE_TABLE_CONFIG: InventoryWarehouseTableConfig = {
  statusField: 'status',
  warehouseSourceIdField: 'storeroom_id',
  warehouseNameField: 'create_name',
  quantityField: 'num',
  quantityUnit: 'count',
  amountField: 'price',
  sourceMerchantIdField: 'merchant_id',
  supplierSourceIdField: 'supplier_id',
  materialSourceIdField: 'material_id',
};

const INVENTORY_LEDGER_TABLE_CONFIG: InventoryLedgerTableConfig = {
  ledgerTypeField: 'type',
  statusField: 'derived_status',
  quantityField: 'goods_list[].num',
  quantityUnit: 'count',
  amountField: 'goods_list[].price',
  warehouseSourceIdField: 'goods_list[].storeroom_id',
  materialSourceIdField: 'goods_list[].material_id',
  sourceMerchantIdField: 'merchant_id',
  sourceOrderField: 'invoice_id',
  splitGoodsList: true,
};

const ORDER_SORT_COLUMNS = {
  sourceTable: 'sync.sourceTable',
  sourceOrderNo: 'sync.sourceOrderNo',
  statusStandard: 'sync.statusStandard',
  amountStandard: 'sync.amountStandard',
  mappingConfirmed: 'sync.mappingConfirmed',
  sourceUpdatedAt: 'sync.sourceUpdatedAt',
  syncedAt: 'sync.syncedAt',
  updatedAt: 'sync.updatedAt',
  createdAt: 'sync.createdAt',
} as const;

const FUND_SORT_COLUMNS = {
  sourceTable: 'sync.sourceTable',
  sourceOrderNo: 'sync.sourceOrderNo',
  fundTypeStandard: 'sync.fundTypeStandard',
  statusStandard: 'sync.statusStandard',
  amountStandard: 'sync.amountStandard',
  mappingConfirmed: 'sync.mappingConfirmed',
  sourceUpdatedAt: 'sync.sourceUpdatedAt',
  syncedAt: 'sync.syncedAt',
  updatedAt: 'sync.updatedAt',
  createdAt: 'sync.createdAt',
} as const;

const CARD_SORT_COLUMNS = {
  sourceTable: 'sync.sourceTable',
  sourceOrderNo: 'sync.sourceOrderNo',
  cardObjectType: 'sync.cardObjectType',
  cardStatusStandard: 'sync.cardStatusStandard',
  amountStandard: 'sync.amountStandard',
  mappingConfirmed: 'sync.mappingConfirmed',
  sourceUpdatedAt: 'sync.sourceUpdatedAt',
  syncedAt: 'sync.syncedAt',
  updatedAt: 'sync.updatedAt',
  createdAt: 'sync.createdAt',
} as const;

const CARD_LEDGER_SORT_COLUMNS = {
  sourceTable: 'sync.sourceTable',
  sourceOrderNo: 'sync.sourceOrderNo',
  ledgerTypeStandard: 'sync.ledgerTypeStandard',
  statusStandard: 'sync.statusStandard',
  amountStandard: 'sync.amountStandard',
  mappingConfirmed: 'sync.mappingConfirmed',
  sourceUpdatedAt: 'sync.sourceUpdatedAt',
  syncedAt: 'sync.syncedAt',
  updatedAt: 'sync.updatedAt',
  createdAt: 'sync.createdAt',
} as const;

const MATERIAL_SORT_COLUMNS = {
  sourceTable: 'sync.sourceTable',
  sourceOrderNo: 'sync.sourceOrderNo',
  materialCode: 'sync.materialCode',
  materialName: 'sync.materialName',
  materialStatusStandard: 'sync.materialStatusStandard',
  storageAmountStandard: 'sync.storageAmountStandard',
  saleAmountStandard: 'sync.saleAmountStandard',
  mappingConfirmed: 'sync.mappingConfirmed',
  sourceUpdatedAt: 'sync.sourceUpdatedAt',
  syncedAt: 'sync.syncedAt',
  updatedAt: 'sync.updatedAt',
  createdAt: 'sync.createdAt',
} as const;

const SUPPLIER_SORT_COLUMNS = {
  sourceTable: 'sync.sourceTable',
  supplierName: 'sync.supplierName',
  supplierStatusStandard: 'sync.supplierStatusStandard',
  mappingConfirmed: 'sync.mappingConfirmed',
  sourceUpdatedAt: 'sync.sourceUpdatedAt',
  syncedAt: 'sync.syncedAt',
  updatedAt: 'sync.updatedAt',
  createdAt: 'sync.createdAt',
} as const;

const WAREHOUSE_SORT_COLUMNS = {
  sourceTable: 'sync.sourceTable',
  warehouseSourceId: 'sync.warehouseSourceId',
  warehouseName: 'sync.warehouseName',
  warehouseStatusStandard: 'sync.warehouseStatusStandard',
  quantityStandard: 'sync.quantityStandard',
  amountStandard: 'sync.amountStandard',
  mappingConfirmed: 'sync.mappingConfirmed',
  sourceUpdatedAt: 'sync.sourceUpdatedAt',
  syncedAt: 'sync.syncedAt',
  updatedAt: 'sync.updatedAt',
  createdAt: 'sync.createdAt',
} as const;

const INVENTORY_LEDGER_SORT_COLUMNS = {
  sourceTable: 'sync.sourceTable',
  sourceOrderNo: 'sync.sourceOrderNo',
  ledgerTypeStandard: 'sync.ledgerTypeStandard',
  statusStandard: 'sync.statusStandard',
  quantityStandard: 'sync.quantityStandard',
  amountStandard: 'sync.amountStandard',
  mappingConfirmed: 'sync.mappingConfirmed',
  sourceUpdatedAt: 'sync.sourceUpdatedAt',
  syncedAt: 'sync.syncedAt',
  updatedAt: 'sync.updatedAt',
  createdAt: 'sync.createdAt',
} as const;

const JOB_RUN_SORT_COLUMNS = {
  sourceTable: 'job.sourceTable',
  batchNo: 'run.batchNo',
  runStatus: 'run.runStatus',
  startedAt: 'run.startedAt',
  finishedAt: 'run.finishedAt',
  totalRecords: 'run.totalRecords',
  importedRecords: 'run.importedRecords',
  failedRecords: 'run.failedRecords',
  createdAt: 'run.createdAt',
} as const;

const CHECKPOINT_SORT_COLUMNS = {
  sourceTable: 'job.sourceTable',
  batchNo: 'checkpoint.batchNo',
  checkpointKey: 'checkpoint.checkpointKey',
  checkpointValue: 'checkpoint.checkpointValue',
  lastSyncedAt: 'checkpoint.lastSyncedAt',
  updatedAt: 'checkpoint.updatedAt',
  createdAt: 'checkpoint.createdAt',
} as const;

const STATUS_MAPPING_SORT_COLUMNS = {
  sourceTable: 'mapping.sourceTable',
  sourceField: 'mapping.sourceField',
  sourceValue: 'mapping.sourceValue',
  targetDomain: 'mapping.targetDomain',
  targetValue: 'mapping.targetValue',
  confidenceLevel: 'mapping.confidenceLevel',
  isActive: 'mapping.isActive',
  updatedAt: 'mapping.updatedAt',
  createdAt: 'mapping.createdAt',
} as const;

const AMOUNT_RULE_SORT_COLUMNS = {
  sourceTable: 'rule.sourceTable',
  amountField: 'rule.amountField',
  amountUnitRaw: 'rule.amountUnitRaw',
  standardUnit: 'rule.standardUnit',
  confidenceLevel: 'rule.confidenceLevel',
  isActive: 'rule.isActive',
  updatedAt: 'rule.updatedAt',
  createdAt: 'rule.createdAt',
} as const;

@Injectable()
export class AbcSyncService {
  constructor(
    @InjectRepository(AbcRawCard)
    private readonly abcRawCardRepository: Repository<AbcRawCard>,
    @InjectRepository(AbcRawInventory)
    private readonly abcRawInventoryRepository: Repository<AbcRawInventory>,
    @InjectRepository(AbcRawOrder)
    private readonly abcRawOrderRepository: Repository<AbcRawOrder>,
    @InjectRepository(AbcRawTransaction)
    private readonly abcRawTransactionRepository: Repository<AbcRawTransaction>,
    @InjectRepository(AbcSyncCard)
    private readonly abcSyncCardRepository: Repository<AbcSyncCard>,
    @InjectRepository(AbcSyncCardLedger)
    private readonly abcSyncCardLedgerRepository: Repository<AbcSyncCardLedger>,
    @InjectRepository(AbcSyncInventoryLedger)
    private readonly abcSyncInventoryLedgerRepository: Repository<AbcSyncInventoryLedger>,
    @InjectRepository(AbcSyncMaterial)
    private readonly abcSyncMaterialRepository: Repository<AbcSyncMaterial>,
    @InjectRepository(AbcSyncOrder)
    private readonly abcSyncOrderRepository: Repository<AbcSyncOrder>,
    @InjectRepository(AbcSyncFund)
    private readonly abcSyncFundRepository: Repository<AbcSyncFund>,
    @InjectRepository(AbcSyncSupplier)
    private readonly abcSyncSupplierRepository: Repository<AbcSyncSupplier>,
    @InjectRepository(AbcSyncWarehouse)
    private readonly abcSyncWarehouseRepository: Repository<AbcSyncWarehouse>,
    @InjectRepository(AbcStatusMapping)
    private readonly abcStatusMappingRepository: Repository<AbcStatusMapping>,
    @InjectRepository(AbcAmountRule)
    private readonly abcAmountRuleRepository: Repository<AbcAmountRule>,
    @InjectRepository(SyncJob)
    private readonly syncJobRepository: Repository<SyncJob>,
    @InjectRepository(SyncJobRun)
    private readonly syncJobRunRepository: Repository<SyncJobRun>,
    @InjectRepository(SyncCheckpoint)
    private readonly syncCheckpointRepository: Repository<SyncCheckpoint>,
    private readonly sourceSystemsService: SourceSystemsService,
    private readonly syncJobsService: SyncJobsService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  getNormalizationTargets(
    targetDomains: AbcSyncTargetDomain[],
    sourceTables?: string[],
  ): NormalizationTarget[] {
    const requested = new Set(targetDomains);
    const allowedSourceTables = sourceTables?.length
      ? new Set(sourceTables.map((item) => item.trim().toLowerCase()))
      : null;
    const targets = [
      ...(requested.has(AbcSyncTargetDomain.ORDERS) ? ORDER_TARGETS : []),
      ...(requested.has(AbcSyncTargetDomain.FUNDS) ? FUND_TARGETS : []),
      ...(requested.has(AbcSyncTargetDomain.CARDS) ? CARD_TARGETS : []),
      ...(requested.has(AbcSyncTargetDomain.INVENTORY) ? INVENTORY_TARGETS : []),
    ];

    if (!allowedSourceTables) {
      return targets;
    }

    return targets.filter((target) => allowedSourceTables.has(target.sourceTable));
  }

  async runManualNormalization(dto: ManualNormalizeAbcSyncDto, currentUser: CurrentUser) {
    const sourceSystemCode = dto.sourceSystemCode.trim().toUpperCase();
    const targetDomains = dto.targetDomains?.length
      ? dto.targetDomains
      : [AbcSyncTargetDomain.ORDERS, AbcSyncTargetDomain.FUNDS];
    const syncBatchNo = dto.batchNo?.trim() || this.buildBatchNo(sourceSystemCode, 'sync');
    const syncedAt = new Date();
    const targets = this.getNormalizationTargets(targetDomains, dto.sourceTables);

    if (!targets.length) {
      throw new BadRequestException('No supported normalization targets were selected.');
    }

    const sourceSystem = await this.sourceSystemsService.ensureSourceSystem({
      sourceSystemCode,
      name: 'ABC Source System',
      syncScope: ['readonly', 'offline', 'raw', 'sync'],
    });

    const summaries: NormalizeTargetSummary[] = [];

    for (const target of targets) {
      const syncJob = await this.syncJobsService.ensureNormalizationJob({
        sourceSystemId: sourceSystem.id,
        sourceSystemCode,
        sourceTable: target.sourceTable,
        targetTable: target.targetTable,
        targetDomain: target.targetDomain,
        syncScope: ['readonly', 'offline', 'sync', target.targetDomain],
        checkpointKey: 'source_updated_at_or_source_id',
      });

      const syncRun = await this.syncJobsService.startRun({
        syncJobId: syncJob.id,
        batchNo: syncBatchNo,
        inputFormat: null,
        inputPath: `${target.rawTableName}:${target.sourceTable}`,
        createdBy: currentUser.id,
      });

      await this.operationLogsService.create({
        module: 'abc_sync',
        targetId: syncRun.id,
        action: OperationLogAction.START_SYNC_JOB_RUN,
        operatorId: currentUser.id,
        detail: `Start ABC normalization for ${target.sourceTable}`,
        detailJson: {
          sourceSystemCode,
          batchNo: syncBatchNo,
          targetDomain: target.targetDomain,
          sourceTable: target.sourceTable,
          rawTableName: target.rawTableName,
          targetTable: target.targetTable,
        },
      });

      try {
        const summary = await this.normalizeTarget({
          sourceSystemCode,
          batchNo: syncBatchNo,
          syncedAt,
          target,
        });

        await this.syncJobsService.updateCheckpoint({
          syncJobId: syncJob.id,
          checkpointKey: 'source_updated_at_or_source_id',
          checkpointValue: summary.checkpointValue,
          batchNo: syncBatchNo,
          lastSyncedAt: syncedAt,
        });

        await this.syncJobsService.completeRun({
          runId: syncRun.id,
          runStatus: SyncJobRunStatus.SUCCESS,
          totalRecords: summary.totalRecords,
          importedRecords: summary.createdRecords,
          skippedRecords: 0,
          failedRecords: 0,
          resultPayload: {
            targetDomain: target.targetDomain,
            sourceTable: target.sourceTable,
            rawTableName: target.rawTableName,
            targetTable: target.targetTable,
            createdRecords: summary.createdRecords,
            updatedRecords: summary.updatedRecords,
            unconfirmedRecords: summary.unconfirmedRecords,
            checkpointValue: summary.checkpointValue,
          },
        });

        await this.operationLogsService.create({
          module: 'abc_sync',
          targetId: syncRun.id,
          action: OperationLogAction.COMPLETE_SYNC_JOB_RUN,
          operatorId: currentUser.id,
          detail: `Completed ABC normalization for ${target.sourceTable}`,
          detailJson: {
            sourceSystemCode,
            batchNo: syncBatchNo,
            targetDomain: target.targetDomain,
            sourceTable: target.sourceTable,
            targetTable: target.targetTable,
            totalRecords: summary.totalRecords,
            createdRecords: summary.createdRecords,
            updatedRecords: summary.updatedRecords,
            unconfirmedRecords: summary.unconfirmedRecords,
          },
        });

        summaries.push(summary);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown normalization error';

        await this.syncJobsService.completeRun({
          runId: syncRun.id,
          runStatus: SyncJobRunStatus.FAILED,
          totalRecords: 0,
          importedRecords: 0,
          skippedRecords: 0,
          failedRecords: 1,
          errorMessage,
          resultPayload: {
            targetDomain: target.targetDomain,
            sourceTable: target.sourceTable,
            targetTable: target.targetTable,
            batchNo: syncBatchNo,
          },
        });

        await this.operationLogsService.create({
          module: 'abc_sync',
          targetId: syncRun.id,
          action: OperationLogAction.FAIL_SYNC_JOB_RUN,
          operatorId: currentUser.id,
          detail: `Failed ABC normalization for ${target.sourceTable}`,
          detailJson: {
            sourceSystemCode,
            batchNo: syncBatchNo,
            targetDomain: target.targetDomain,
            sourceTable: target.sourceTable,
            targetTable: target.targetTable,
            errorMessage,
          },
        });

        throw error;
      }
    }

    await this.sourceSystemsService.touchLastSyncedAt(sourceSystem.id, syncedAt);

    return {
      sourceSystemCode,
      batchNo: syncBatchNo,
      targetsProcessed: summaries.length,
      results: summaries,
    };
  }

  async findOrders(query: QueryAbcSyncOrdersDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildOrdersQuery(query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        ORDER_SORT_COLUMNS[query.sortBy ?? 'syncedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findFunds(query: QueryAbcSyncFundsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildFundsQuery(query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        FUND_SORT_COLUMNS[query.sortBy ?? 'syncedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findCards(query: QueryAbcSyncCardsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildCardsQuery(query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        CARD_SORT_COLUMNS[query.sortBy ?? 'syncedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findCardLedger(query: QueryAbcSyncCardLedgerDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildCardLedgerQuery(query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        CARD_LEDGER_SORT_COLUMNS[query.sortBy ?? 'syncedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findMaterials(query: QueryAbcSyncMaterialsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildMaterialsQuery(query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        MATERIAL_SORT_COLUMNS[query.sortBy ?? 'syncedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findSuppliers(query: QueryAbcSyncSuppliersDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildSuppliersQuery(query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        SUPPLIER_SORT_COLUMNS[query.sortBy ?? 'syncedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findWarehouses(query: QueryAbcSyncWarehousesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildWarehousesQuery(query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        WAREHOUSE_SORT_COLUMNS[query.sortBy ?? 'syncedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findInventoryLedger(query: QueryAbcSyncInventoryLedgerDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildInventoryLedgerQuery(query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        INVENTORY_LEDGER_SORT_COLUMNS[query.sortBy ?? 'syncedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async getDashboard(query: QueryAbcSyncDashboardDto, currentUser: CurrentUser) {
    const canViewBusinessDetails =
      currentUser.roleCodes.includes('admin') || currentUser.roleCodes.includes('finance');
    const [
      baseExceptionItems,
      cardExceptionItems,
      inventoryExceptionItems,
      latestRuns,
      latestCheckpoints,
      orders,
      funds,
      cards,
      cardLedger,
      materials,
      suppliers,
      warehouses,
      inventoryLedger,
    ] = await Promise.all([
      this.getMappingExceptionItems(query),
      this.getCardMappingExceptionItems({
        ...query,
        recordType: undefined,
      }),
      this.getInventoryMappingExceptionItems({
        ...query,
        recordType: undefined,
      }),
      this.buildJobRunsQuery(query)
        .clone()
        .orderBy(JOB_RUN_SORT_COLUMNS.startedAt, 'DESC')
        .take(8)
        .getMany(),
      this.buildCheckpointsQuery(query)
        .clone()
        .orderBy(CHECKPOINT_SORT_COLUMNS.lastSyncedAt, 'DESC')
        .take(8)
        .getMany(),
      canViewBusinessDetails ? this.buildOrdersQuery(query).getMany() : Promise.resolve([]),
      canViewBusinessDetails ? this.buildFundsQuery(query).getMany() : Promise.resolve([]),
      canViewBusinessDetails ? this.buildCardsQuery(query).getMany() : Promise.resolve([]),
      canViewBusinessDetails ? this.buildCardLedgerQuery(query).getMany() : Promise.resolve([]),
      canViewBusinessDetails ? this.buildMaterialsQuery(query).getMany() : Promise.resolve([]),
      canViewBusinessDetails ? this.buildSuppliersQuery(query).getMany() : Promise.resolve([]),
      canViewBusinessDetails ? this.buildWarehousesQuery(query).getMany() : Promise.resolve([]),
      canViewBusinessDetails
        ? this.buildInventoryLedgerQuery(query).getMany()
        : Promise.resolve([]),
    ]);

    const latestBatchNo =
      latestRuns[0]?.batchNo ?? latestCheckpoints[0]?.batchNo ?? query.batchNo ?? null;
    const dashboardExceptions: DashboardExceptionItem[] = [
      ...baseExceptionItems.map((item) => ({
        domain: item.targetDomain,
        sourceTable: item.sourceTable,
        sourceOrderNo: item.sourceOrderNo,
        statusStandard: item.statusStandard,
        mappingConfirmed: item.mappingConfirmed,
        mappingNotes: item.mappingNotes,
        syncedAt: item.syncedAt,
        sourceUpdatedAt: item.sourceUpdatedAt,
        exceptionTypes: item.exceptionTypes,
      })),
      ...cardExceptionItems.map((item) => ({
        domain: 'cards' as const,
        sourceTable: item.sourceTable,
        sourceOrderNo: item.sourceOrderNo,
        statusStandard: item.statusStandard,
        mappingConfirmed: item.mappingConfirmed,
        mappingNotes: item.mappingNotes,
        syncedAt: item.syncedAt,
        sourceUpdatedAt: item.sourceUpdatedAt,
        exceptionTypes: item.exceptionTypes,
      })),
      ...inventoryExceptionItems.map((item) => ({
        domain: 'inventory' as const,
        sourceTable: item.sourceTable,
        sourceOrderNo: item.sourceOrderNo,
        statusStandard: item.statusStandard,
        mappingConfirmed: item.mappingConfirmed,
        mappingNotes: item.mappingNotes,
        syncedAt: item.syncedAt,
        sourceUpdatedAt: item.sourceUpdatedAt,
        exceptionTypes: item.exceptionTypes,
      })),
    ];
    const unresolvedItems = dashboardExceptions.filter((item) => !item.mappingConfirmed);
    const sortedExceptions = [...dashboardExceptions].sort(
      (left, right) => right.syncedAt.getTime() - left.syncedAt.getTime(),
    );
    const cardRecords = [...cards, ...cardLedger];
    const inventoryRecords = [...materials, ...suppliers, ...warehouses, ...inventoryLedger];
    const governanceEntries = [
      {
        domain: 'orders',
        label: '订单与资金异常',
        path: '/abc-sync/mapping-exceptions',
        allowedRoles: ['admin', 'finance', 'approver'],
      },
      {
        domain: 'cards',
        label: '卡域异常',
        path: '/abc-sync/card-mapping-exceptions',
        allowedRoles: ['admin', 'finance'],
      },
      {
        domain: 'inventory',
        label: '库存域异常',
        path: '/abc-sync/inventory-mapping-exceptions',
        allowedRoles: ['admin', 'finance'],
      },
      {
        domain: 'rules',
        label: '映射规则管理',
        path: '/abc-sync/rules',
        allowedRoles: ['admin'],
      },
    ];

    return {
      filters: {
        sourceTable: query.sourceTable ?? null,
        batchNo: query.batchNo ?? null,
        mappingConfirmed:
          typeof query.mappingConfirmed === 'boolean' ? query.mappingConfirmed : null,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
      },
      orderOverview: canViewBusinessDetails
        ? {
            total: orders.length,
            sourceTableCounts: this.buildCountItems(orders, (item) => item.sourceTable),
            mappingSummary: {
              confirmed: orders.filter((item) => item.mappingConfirmed).length,
              unconfirmed: orders.filter((item) => !item.mappingConfirmed).length,
            },
            statusDistribution: this.buildCountItems(
              orders,
              (item) => item.statusStandard ?? 'unknown',
            ),
          }
        : null,
      fundOverview: canViewBusinessDetails
        ? {
            total: funds.length,
            fundTypeDistribution: this.buildCountItems(
              funds,
              (item) => item.fundTypeStandard ?? 'unknown',
            ),
            statusDistribution: this.buildCountItems(
              funds,
              (item) => item.statusStandard ?? 'unknown',
            ),
            amountTotal: this.sumDecimal(funds.map((item) => item.amountStandard)),
          }
        : null,
      cardOverview: canViewBusinessDetails
        ? {
            cardTotal: cards.length,
            cardLedgerTotal: cardLedger.length,
            amountTotal: this.sumDecimal(cardRecords.map((item) => item.amountStandard)),
            cardBalanceTotal: this.sumDecimal(cards.map((item) => item.amountStandard)),
            ledgerAmountTotal: this.sumDecimal(cardLedger.map((item) => item.amountStandard)),
            mappingSummary: {
              confirmed: cardRecords.filter((item) => item.mappingConfirmed).length,
              unconfirmed: cardRecords.filter((item) => !item.mappingConfirmed).length,
            },
            sourceTableCounts: this.buildCountItems(cardRecords, (item) => item.sourceTable),
          }
        : null,
      inventoryOverview: canViewBusinessDetails
        ? {
            materialCount: materials.length,
            supplierCount: suppliers.length,
            warehouseCount: warehouses.length,
            inventoryLedgerCount: inventoryLedger.length,
            mappingSummary: {
              confirmed: inventoryRecords.filter((item) => item.mappingConfirmed).length,
              unconfirmed: inventoryRecords.filter((item) => !item.mappingConfirmed).length,
            },
            sourceTableCounts: this.buildCountItems(
              inventoryRecords,
              (item) => item.sourceTable,
            ),
          }
        : null,
      syncHealth: {
        latestBatchNo,
        latestRun: latestRuns[0]
          ? {
              sourceTable: latestRuns[0].syncJob?.sourceTable ?? null,
              batchNo: latestRuns[0].batchNo,
              runStatus: latestRuns[0].runStatus,
              startedAt: latestRuns[0].startedAt,
              finishedAt: latestRuns[0].finishedAt,
            }
          : null,
        recentRunSummary: {
          total: latestRuns.length,
          success: latestRuns.filter((item) => item.runStatus === SyncJobRunStatus.SUCCESS).length,
          failed: latestRuns.filter((item) => item.runStatus === SyncJobRunStatus.FAILED).length,
        },
        latestCheckpoints: latestCheckpoints.map((item) => ({
          sourceTable: item.syncJob?.sourceTable ?? null,
          checkpointKey: item.checkpointKey,
          checkpointValue: item.checkpointValue,
          batchNo: item.batchNo,
          lastSyncedAt: item.lastSyncedAt,
          })),
        currentExceptionCount: dashboardExceptions.length,
        exceptionDomainDistribution: this.buildCountItems(
          dashboardExceptions,
          (item) => item.domain,
        ),
        exceptionSourceTableDistribution: this.buildCountItems(
          dashboardExceptions,
          (item) => item.sourceTable,
        ),
      },
      remediation: {
        currentUnconfirmedCount: unresolvedItems.length,
        recentExceptions: sortedExceptions.slice(0, 8)
          .map((item) => ({
            targetDomain: item.domain,
            sourceTable: item.sourceTable,
            sourceOrderNo: item.sourceOrderNo,
            mappingNotes: item.mappingNotes,
            syncedAt: item.syncedAt,
            exceptionTypes: item.exceptionTypes,
          })),
        unconfirmedByDomain: this.buildCountItems(unresolvedItems, (item) => item.domain),
        unresolvedSourceTables: this.buildCountItems(
          unresolvedItems,
          (item) => item.sourceTable,
        ),
        missingRuleSourceTables: Array.from(
          new Set(
            dashboardExceptions
              .filter((item) =>
                item.exceptionTypes.some(
                  (type) => type === 'missing_status_mapping' || type === 'missing_amount_rule',
                ),
              )
              .map((item) => item.sourceTable),
          ),
        ),
        governanceEntries: governanceEntries.map((item) => ({
          ...item,
          exceptionCount:
            item.domain === 'orders'
              ? dashboardExceptions.filter(
                  (exception) => exception.domain === 'orders' || exception.domain === 'funds',
                ).length
              : item.domain === 'rules'
                ? unresolvedItems.length
                : dashboardExceptions.filter((exception) => exception.domain === item.domain).length,
        })),
      },
    };
  }

  async findJobRuns(query: QueryAbcSyncJobRunsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildJobRunsQuery(query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        JOB_RUN_SORT_COLUMNS[query.sortBy ?? 'startedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findCheckpoints(query: QueryAbcSyncCheckpointsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.buildCheckpointsQuery(query);
    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        CHECKPOINT_SORT_COLUMNS[query.sortBy ?? 'lastSyncedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async findMappingExceptions(query: QueryAbcSyncMappingExceptionsDto) {
    const exceptionItems = await this.getMappingExceptionItems(query);
    const sortedItems = this.sortMappingExceptions(
      exceptionItems,
      query.sortBy ?? 'updatedAt',
      this.normalizeSortOrder(query.sortOrder, 'DESC'),
    );

    return paginateArray(sortedItems, query);
  }

  async findCardMappingExceptions(query: QueryAbcSyncCardMappingExceptionsDto) {
    const exceptionItems = await this.getCardMappingExceptionItems(query);
    const sortedItems = this.sortCardMappingExceptions(
      exceptionItems,
      query.sortBy ?? 'updatedAt',
      this.normalizeSortOrder(query.sortOrder, 'DESC'),
    );

    return paginateArray(sortedItems, query);
  }

  async findInventoryMappingExceptions(query: QueryAbcSyncInventoryMappingExceptionsDto) {
    const exceptionItems = await this.getInventoryMappingExceptionItems(query);
    const sortedItems = this.sortInventoryMappingExceptions(
      exceptionItems,
      query.sortBy ?? 'updatedAt',
      this.normalizeSortOrder(query.sortOrder, 'DESC'),
    );

    return paginateArray(sortedItems, query);
  }

  async findStatusMappings(query: QueryAbcStatusMappingsDto) {
    const { skip, take } = getPagination(query);
    const qb = this.abcStatusMappingRepository.createQueryBuilder('mapping');

    if (query.sourceTable) {
      qb.andWhere('mapping.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.targetDomain) {
      qb.andWhere('mapping.target_domain = :targetDomain', { targetDomain: query.targetDomain });
    }

    if (typeof query.isActive === 'boolean') {
      qb.andWhere('mapping.is_active = :isActive', { isActive: query.isActive });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        STATUS_MAPPING_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async createStatusMapping(dto: CreateAbcStatusMappingDto, currentUser: CurrentUser) {
    const existing = await this.abcStatusMappingRepository.findOne({
      where: {
        sourceSystem: 'ABC',
        sourceTable: dto.sourceTable,
        sourceField: dto.sourceField,
        sourceValue: dto.sourceValue,
        targetDomain: dto.targetDomain,
      },
    });

    if (existing) {
      throw new BadRequestException('ABC status mapping already exists.');
    }

    const entity = this.abcStatusMappingRepository.create({
      sourceSystem: 'ABC',
      sourceTable: dto.sourceTable,
      sourceField: dto.sourceField,
      sourceValue: dto.sourceValue,
      targetDomain: dto.targetDomain,
      targetValue: dto.targetValue,
      confidenceLevel: dto.confidenceLevel ?? AbcMappingConfidence.INFERRED,
      notes: dto.notes ?? null,
      isActive: dto.isActive ?? true,
    });

    const saved = await this.abcStatusMappingRepository.save(entity);

    await this.operationLogsService.create({
      module: 'abc_sync_rule',
      targetId: saved.id,
      action: 'create_abc_status_mapping',
      operatorId: currentUser.id,
      detail: `Create ABC status mapping ${saved.sourceTable}.${saved.sourceField}`,
      detailJson: saved as unknown as Record<string, unknown>,
    });

    return saved;
  }

  async updateStatusMapping(id: number, dto: UpdateAbcStatusMappingDto, currentUser: CurrentUser) {
    const mapping = await this.abcStatusMappingRepository.findOne({
      where: { id },
    });

    if (!mapping) {
      throw new NotFoundException('ABC status mapping not found.');
    }

    const before = { ...mapping };

    Object.assign(mapping, {
      sourceTable: dto.sourceTable ?? mapping.sourceTable,
      sourceField: dto.sourceField ?? mapping.sourceField,
      sourceValue: dto.sourceValue ?? mapping.sourceValue,
      targetDomain: dto.targetDomain ?? mapping.targetDomain,
      targetValue: dto.targetValue ?? mapping.targetValue,
      confidenceLevel: dto.confidenceLevel ?? mapping.confidenceLevel,
      notes: dto.notes ?? mapping.notes,
      isActive: dto.isActive ?? mapping.isActive,
    });

    const saved = await this.abcStatusMappingRepository.save(mapping);

    await this.operationLogsService.create({
      module: 'abc_sync_rule',
      targetId: saved.id,
      action: 'update_abc_status_mapping',
      operatorId: currentUser.id,
      detail: `Update ABC status mapping ${saved.sourceTable}.${saved.sourceField}`,
      detailJson: {
        before,
        after: saved,
      },
    });

    return saved;
  }

  async toggleStatusMapping(id: number, dto: ToggleAbcRuleDto, currentUser: CurrentUser) {
    return this.updateStatusMapping(id, { isActive: dto.isActive }, currentUser);
  }

  async findAmountRules(query: QueryAbcAmountRulesDto) {
    const { skip, take } = getPagination(query);
    const qb = this.abcAmountRuleRepository.createQueryBuilder('rule');

    if (query.sourceTable) {
      qb.andWhere('rule.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.amountField) {
      qb.andWhere('rule.amount_field = :amountField', { amountField: query.amountField });
    }

    if (typeof query.isActive === 'boolean') {
      qb.andWhere('rule.is_active = :isActive', { isActive: query.isActive });
    }

    const total = await qb.getCount();
    const list = await qb
      .clone()
      .orderBy(
        AMOUNT_RULE_SORT_COLUMNS[query.sortBy ?? 'updatedAt'],
        this.normalizeSortOrder(query.sortOrder, 'DESC'),
      )
      .skip(skip)
      .take(take)
      .getMany();

    return buildPaginationResult(query, list, total);
  }

  async createAmountRule(dto: CreateAbcAmountRuleDto, currentUser: CurrentUser) {
    const existing = await this.abcAmountRuleRepository.findOne({
      where: {
        sourceSystem: 'ABC',
        sourceTable: dto.sourceTable,
        amountField: dto.amountField,
      },
    });

    if (existing) {
      throw new BadRequestException('ABC amount rule already exists.');
    }

    const entity = this.abcAmountRuleRepository.create({
      sourceSystem: 'ABC',
      sourceTable: dto.sourceTable,
      amountField: dto.amountField,
      amountUnitRaw: dto.amountUnitRaw,
      standardUnit: dto.standardUnit ?? 'yuan',
      conversionRate: dto.conversionRate ?? '1.000000',
      standardScale: dto.standardScale ?? 2,
      confidenceLevel: dto.confidenceLevel ?? AbcMappingConfidence.INFERRED,
      notes: dto.notes ?? null,
      isActive: dto.isActive ?? true,
    });

    const saved = await this.abcAmountRuleRepository.save(entity);

    await this.operationLogsService.create({
      module: 'abc_sync_rule',
      targetId: saved.id,
      action: 'create_abc_amount_rule',
      operatorId: currentUser.id,
      detail: `Create ABC amount rule ${saved.sourceTable}.${saved.amountField}`,
      detailJson: saved as unknown as Record<string, unknown>,
    });

    return saved;
  }

  async updateAmountRule(id: number, dto: UpdateAbcAmountRuleDto, currentUser: CurrentUser) {
    const rule = await this.abcAmountRuleRepository.findOne({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('ABC amount rule not found.');
    }

    const before = { ...rule };

    Object.assign(rule, {
      sourceTable: dto.sourceTable ?? rule.sourceTable,
      amountField: dto.amountField ?? rule.amountField,
      amountUnitRaw: dto.amountUnitRaw ?? rule.amountUnitRaw,
      standardUnit: dto.standardUnit ?? rule.standardUnit,
      conversionRate: dto.conversionRate ?? rule.conversionRate,
      standardScale: dto.standardScale ?? rule.standardScale,
      confidenceLevel: dto.confidenceLevel ?? rule.confidenceLevel,
      notes: dto.notes ?? rule.notes,
      isActive: dto.isActive ?? rule.isActive,
    });

    const saved = await this.abcAmountRuleRepository.save(rule);

    await this.operationLogsService.create({
      module: 'abc_sync_rule',
      targetId: saved.id,
      action: 'update_abc_amount_rule',
      operatorId: currentUser.id,
      detail: `Update ABC amount rule ${saved.sourceTable}.${saved.amountField}`,
      detailJson: {
        before,
        after: saved,
      },
    });

    return saved;
  }

  async toggleAmountRule(id: number, dto: ToggleAbcRuleDto, currentUser: CurrentUser) {
    return this.updateAmountRule(id, { isActive: dto.isActive }, currentUser);
  }

  async normalizeTarget(input: NormalizeTargetInput): Promise<NormalizeTargetSummary> {
    if (input.target.targetDomain === AbcSyncTargetDomain.ORDERS) {
      return this.normalizeOrdersTarget(input);
    }

    if (input.target.targetDomain === AbcSyncTargetDomain.CARDS) {
      return input.target.targetTable === 'abc_sync_cards'
        ? this.normalizeCardsTarget(input)
        : this.normalizeCardLedgerTarget(input);
    }

    if (input.target.targetDomain === AbcSyncTargetDomain.INVENTORY) {
      if (input.target.targetTable === 'abc_sync_materials') {
        return this.normalizeMaterialsTarget(input);
      }

      if (input.target.targetTable === 'abc_sync_suppliers') {
        return this.normalizeSuppliersTarget(input);
      }

      if (input.target.targetTable === 'abc_sync_warehouses') {
        return this.normalizeWarehousesTarget(input);
      }

      return this.normalizeInventoryLedgerTarget(input);
    }

    return this.normalizeFundsTarget(input);
  }

  private buildJobRunsQuery(
    query: QueryAbcSyncJobRunsDto | QueryAbcSyncDashboardDto,
  ) {
    const qb = this.syncJobRunRepository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.syncJob', 'job')
      .where("job.import_mode = 'normalize'");

    if (query.sourceTable) {
      qb.andWhere('job.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.batchNo) {
      qb.andWhere('run.batch_no = :batchNo', { batchNo: query.batchNo });
    }

    if ('runStatus' in query && query.runStatus) {
      qb.andWhere('run.run_status = :runStatus', { runStatus: query.runStatus });
    }

    if (query.dateFrom) {
      qb.andWhere('run.started_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('run.started_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private buildCheckpointsQuery(
    query: QueryAbcSyncCheckpointsDto | QueryAbcSyncDashboardDto,
  ) {
    const qb = this.syncCheckpointRepository
      .createQueryBuilder('checkpoint')
      .leftJoinAndSelect('checkpoint.syncJob', 'job')
      .where("job.import_mode = 'normalize'");

    if (query.sourceTable) {
      qb.andWhere('job.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.batchNo) {
      qb.andWhere('checkpoint.batch_no = :batchNo', { batchNo: query.batchNo });
    }

    if (query.dateFrom) {
      qb.andWhere('checkpoint.last_synced_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('checkpoint.last_synced_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private buildOrdersQuery(
    query:
      | QueryAbcSyncOrdersDto
      | QueryAbcSyncMappingExceptionsDto
      | QueryAbcSyncDashboardDto,
  ) {
    const qb = this.abcSyncOrderRepository.createQueryBuilder('sync');

    if (query.sourceTable) {
      qb.andWhere('sync.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.batchNo) {
      qb.andWhere('sync.sync_batch_no = :batchNo', { batchNo: query.batchNo });
    }

    if (typeof query.mappingConfirmed === 'boolean') {
      qb.andWhere('sync.mapping_confirmed = :mappingConfirmed', {
        mappingConfirmed: query.mappingConfirmed,
      });
    }

    if (query.statusStandard) {
      qb.andWhere('sync.status_standard = :statusStandard', {
        statusStandard: query.statusStandard,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('sync.synced_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('sync.synced_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private buildFundsQuery(
    query:
      | QueryAbcSyncFundsDto
      | QueryAbcSyncMappingExceptionsDto
      | QueryAbcSyncDashboardDto,
  ) {
    const qb = this.abcSyncFundRepository.createQueryBuilder('sync');

    if (query.sourceTable) {
      qb.andWhere('sync.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.batchNo) {
      qb.andWhere('sync.sync_batch_no = :batchNo', { batchNo: query.batchNo });
    }

    if (typeof query.mappingConfirmed === 'boolean') {
      qb.andWhere('sync.mapping_confirmed = :mappingConfirmed', {
        mappingConfirmed: query.mappingConfirmed,
      });
    }

    if (query.statusStandard) {
      qb.andWhere('sync.status_standard = :statusStandard', {
        statusStandard: query.statusStandard,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('sync.synced_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('sync.synced_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private buildCardsQuery(
    query: QueryAbcSyncCardsDto | QueryAbcSyncCardMappingExceptionsDto,
  ) {
    const qb = this.abcSyncCardRepository.createQueryBuilder('sync');

    if (query.sourceTable) {
      qb.andWhere('sync.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.batchNo) {
      qb.andWhere('sync.sync_batch_no = :batchNo', { batchNo: query.batchNo });
    }

    if (typeof query.mappingConfirmed === 'boolean') {
      qb.andWhere('sync.mapping_confirmed = :mappingConfirmed', {
        mappingConfirmed: query.mappingConfirmed,
      });
    }

    if (query.statusStandard) {
      qb.andWhere('sync.card_status_standard = :statusStandard', {
        statusStandard: query.statusStandard,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('sync.synced_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('sync.synced_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private buildCardLedgerQuery(
    query: QueryAbcSyncCardLedgerDto | QueryAbcSyncCardMappingExceptionsDto,
  ) {
    const qb = this.abcSyncCardLedgerRepository.createQueryBuilder('sync');

    if (query.sourceTable) {
      qb.andWhere('sync.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.batchNo) {
      qb.andWhere('sync.sync_batch_no = :batchNo', { batchNo: query.batchNo });
    }

    if (typeof query.mappingConfirmed === 'boolean') {
      qb.andWhere('sync.mapping_confirmed = :mappingConfirmed', {
        mappingConfirmed: query.mappingConfirmed,
      });
    }

    if (query.statusStandard) {
      qb.andWhere('sync.status_standard = :statusStandard', {
        statusStandard: query.statusStandard,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('sync.synced_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('sync.synced_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private buildMaterialsQuery(query: QueryAbcSyncMaterialsDto | QueryAbcSyncInventoryMappingExceptionsDto) {
    const qb = this.abcSyncMaterialRepository.createQueryBuilder('sync');

    if (query.sourceTable) {
      qb.andWhere('sync.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.batchNo) {
      qb.andWhere('sync.sync_batch_no = :batchNo', { batchNo: query.batchNo });
    }

    if (typeof query.mappingConfirmed === 'boolean') {
      qb.andWhere('sync.mapping_confirmed = :mappingConfirmed', {
        mappingConfirmed: query.mappingConfirmed,
      });
    }

    if (query.statusStandard) {
      qb.andWhere('sync.material_status_standard = :statusStandard', {
        statusStandard: query.statusStandard,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('sync.synced_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('sync.synced_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private buildSuppliersQuery(
    query: QueryAbcSyncSuppliersDto | QueryAbcSyncInventoryMappingExceptionsDto,
  ) {
    const qb = this.abcSyncSupplierRepository.createQueryBuilder('sync');

    if (query.sourceTable) {
      qb.andWhere('sync.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.batchNo) {
      qb.andWhere('sync.sync_batch_no = :batchNo', { batchNo: query.batchNo });
    }

    if (typeof query.mappingConfirmed === 'boolean') {
      qb.andWhere('sync.mapping_confirmed = :mappingConfirmed', {
        mappingConfirmed: query.mappingConfirmed,
      });
    }

    if (query.statusStandard) {
      qb.andWhere('sync.supplier_status_standard = :statusStandard', {
        statusStandard: query.statusStandard,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('sync.synced_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('sync.synced_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private buildWarehousesQuery(
    query: QueryAbcSyncWarehousesDto | QueryAbcSyncInventoryMappingExceptionsDto,
  ) {
    const qb = this.abcSyncWarehouseRepository.createQueryBuilder('sync');

    if (query.sourceTable) {
      qb.andWhere('sync.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.batchNo) {
      qb.andWhere('sync.sync_batch_no = :batchNo', { batchNo: query.batchNo });
    }

    if (typeof query.mappingConfirmed === 'boolean') {
      qb.andWhere('sync.mapping_confirmed = :mappingConfirmed', {
        mappingConfirmed: query.mappingConfirmed,
      });
    }

    if (query.statusStandard) {
      qb.andWhere('sync.warehouse_status_standard = :statusStandard', {
        statusStandard: query.statusStandard,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('sync.synced_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('sync.synced_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private buildInventoryLedgerQuery(
    query: QueryAbcSyncInventoryLedgerDto | QueryAbcSyncInventoryMappingExceptionsDto,
  ) {
    const qb = this.abcSyncInventoryLedgerRepository.createQueryBuilder('sync');

    if (query.sourceTable) {
      qb.andWhere('sync.source_table = :sourceTable', { sourceTable: query.sourceTable });
    }

    if (query.batchNo) {
      qb.andWhere('sync.sync_batch_no = :batchNo', { batchNo: query.batchNo });
    }

    if (typeof query.mappingConfirmed === 'boolean') {
      qb.andWhere('sync.mapping_confirmed = :mappingConfirmed', {
        mappingConfirmed: query.mappingConfirmed,
      });
    }

    if (query.statusStandard) {
      qb.andWhere('sync.status_standard = :statusStandard', {
        statusStandard: query.statusStandard,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('sync.synced_at >= :dateFrom', { dateFrom: new Date(query.dateFrom) });
    }

    if (query.dateTo) {
      qb.andWhere('sync.synced_at <= :dateTo', { dateTo: new Date(query.dateTo) });
    }

    return qb;
  }

  private async getMappingExceptionItems(
    query: QueryAbcSyncMappingExceptionsDto | QueryAbcSyncDashboardDto,
  ) {
    const items: MappingExceptionItem[] = [];
    const targetDomain = 'targetDomain' in query ? query.targetDomain : undefined;

    if (!targetDomain || targetDomain === 'orders') {
      const orders = await this.buildOrdersQuery(query).getMany();
      items.push(...orders.map((record) => this.toMappingExceptionItem('orders', record)));
    }

    if (!targetDomain || targetDomain === 'funds') {
      const funds = await this.buildFundsQuery(query).getMany();
      items.push(...funds.map((record) => this.toMappingExceptionItem('funds', record)));
    }

    return items.filter((item) => item.exceptionTypes.length > 0);
  }

  private async getCardMappingExceptionItems(query: QueryAbcSyncCardMappingExceptionsDto) {
    const items: CardMappingExceptionItem[] = [];

    if (!query.recordType || query.recordType === 'cards') {
      const cards = await this.buildCardsQuery(query).getMany();
      items.push(...cards.map((record) => this.toCardMappingExceptionItem('cards', record)));
    }

    if (!query.recordType || query.recordType === 'card_ledger') {
      const ledgerRecords = await this.buildCardLedgerQuery(query).getMany();
      items.push(
        ...ledgerRecords.map((record) => this.toCardMappingExceptionItem('card_ledger', record)),
      );
    }

    return items.filter((item) => item.exceptionTypes.length > 0);
  }

  private async getInventoryMappingExceptionItems(
    query: QueryAbcSyncInventoryMappingExceptionsDto,
  ) {
    const items: InventoryMappingExceptionItem[] = [];

    if (!query.recordType || query.recordType === 'materials') {
      const materials = await this.buildMaterialsQuery(query).getMany();
      items.push(
        ...materials.map((record) => this.toInventoryMappingExceptionItem('materials', record)),
      );
    }

    if (!query.recordType || query.recordType === 'suppliers') {
      const suppliers = await this.buildSuppliersQuery(query).getMany();
      items.push(
        ...suppliers.map((record) => this.toInventoryMappingExceptionItem('suppliers', record)),
      );
    }

    if (!query.recordType || query.recordType === 'warehouses') {
      const warehouses = await this.buildWarehousesQuery(query).getMany();
      items.push(
        ...warehouses.map((record) => this.toInventoryMappingExceptionItem('warehouses', record)),
      );
    }

    if (!query.recordType || query.recordType === 'inventory_ledger') {
      const ledgerItems = await this.buildInventoryLedgerQuery(query).getMany();
      items.push(
        ...ledgerItems.map((record) =>
          this.toInventoryMappingExceptionItem('inventory_ledger', record),
        ),
      );
    }

    return items.filter((item) => item.exceptionTypes.length > 0);
  }

  private async normalizeOrdersTarget(
    input: NormalizeTargetInput,
  ): Promise<NormalizeTargetSummary> {
    const config = ORDER_TABLE_CONFIGS[input.target.sourceTable];
    const rawRecords = await this.abcRawOrderRepository.find({
      where: {
        sourceSystem: input.sourceSystemCode,
        sourceTable: input.target.sourceTable,
      },
      order: {
        id: 'ASC',
      },
    });
    const statusMappings = await this.loadStatusMappings(
      input.sourceSystemCode,
      input.target.sourceTable,
    );
    const amountRules = await this.loadAmountRules(input.sourceSystemCode, input.target.sourceTable);
    const merchantAccountRefs = await this.loadMerchantAccountRefs(input.sourceSystemCode);

    let createdRecords = 0;
    let updatedRecords = 0;
    let unconfirmedRecords = 0;

    for (const rawRecord of rawRecords) {
      const rawRow = rawRecord.rawPayload as RawRow;
      const status = this.resolveMappedValue({
        sourceTable: input.target.sourceTable,
        sourceField: config.statusField,
        rawRow,
        targetDomain: 'order_status',
        statusMappings,
      });
      const amount = this.normalizeAmount({
        sourceTable: input.target.sourceTable,
        amountField: config.amountField,
        rawRow,
        amountRules,
      });
      const mappingNotes = [...status.notes, ...amount.notes];
      const mappingConfirmed = status.confirmed && amount.confirmed;
      const sourceMerchantId = this.readString(rawRow, 'merchant_id');
      const merchantAccountRef = this.resolveMerchantAccountRef(
        merchantAccountRefs,
        sourceMerchantId,
      );

      if (!mappingConfirmed) {
        unconfirmedRecords += 1;
      }

      const normalizedPayload = {
        domain: AbcSyncTargetDomain.ORDERS,
        businessType: config.businessType,
        sourceTable: input.target.sourceTable,
        rawTableName: input.target.rawTableName,
        status: {
          field: status.sourceField,
          raw: status.rawValue,
          standard: status.standardValue,
          confidenceLevel: status.confidenceLevel,
        },
        amount: {
          field: amount.sourceField,
          raw: amount.rawValue,
          standard: amount.standardValue,
          unit: amount.standardUnit,
          confidenceLevel: amount.confidenceLevel,
        },
        sourceRefs: {
          userId: this.readString(rawRow, 'user_id'),
          merchantId: sourceMerchantId,
          merchantName: merchantAccountRef?.name ?? null,
          merchantUsername: merchantAccountRef?.username ?? null,
          merchantContacts: merchantAccountRef?.contacts ?? null,
        },
        rawStatuses: this.collectFields(rawRow, config.additionalStatusFields),
        sourceMeta: this.buildOrderSourceMeta(input.target.sourceTable, rawRow),
        mappingConfirmed,
        mappingNotes,
      } as Record<string, unknown>;

      const existing = await this.abcSyncOrderRepository.findOne({
        where: {
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
        },
      });

      if (existing) {
        existing.sourceOrderNo = rawRecord.sourceOrderNo;
        existing.sourceUpdatedAt = rawRecord.sourceUpdatedAt;
        existing.rawRecordId = rawRecord.id;
        existing.rawTableName = input.target.rawTableName;
        existing.businessType = config.businessType;
        existing.statusField = status.sourceField;
        existing.statusRaw = status.rawValue;
        existing.statusStandard = status.standardValue;
        existing.amountField = amount.sourceField;
        existing.amountRaw = amount.rawValue;
        existing.amountStandard = amount.standardValue;
        existing.amountUnit = amount.standardUnit ?? null;
        existing.sourceUserId = this.readString(rawRow, 'user_id');
        existing.sourceMerchantId = sourceMerchantId;
        existing.mappingConfirmed = mappingConfirmed;
        existing.mappingNotes = mappingNotes.length ? mappingNotes.join(' | ') : null;
        existing.normalizedPayload = normalizedPayload;
        existing.syncedAt = input.syncedAt;
        existing.syncBatchNo = input.batchNo;
        await this.abcSyncOrderRepository.save(existing);
        updatedRecords += 1;
      } else {
        const entity = this.abcSyncOrderRepository.create({
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
          sourceOrderNo: rawRecord.sourceOrderNo,
          sourceUpdatedAt: rawRecord.sourceUpdatedAt,
          rawRecordId: rawRecord.id,
          rawTableName: input.target.rawTableName,
          businessType: config.businessType,
          statusField: status.sourceField,
          statusRaw: status.rawValue,
          statusStandard: status.standardValue,
          amountField: amount.sourceField,
          amountRaw: amount.rawValue,
          amountStandard: amount.standardValue,
          amountUnit: amount.standardUnit,
          sourceUserId: this.readString(rawRow, 'user_id'),
          sourceMerchantId,
          mappingConfirmed,
          mappingNotes: mappingNotes.length ? mappingNotes.join(' | ') : null,
          normalizedPayload,
          syncedAt: input.syncedAt,
          syncBatchNo: input.batchNo,
        });

        await this.abcSyncOrderRepository.save(entity);
        createdRecords += 1;
      }
    }

    return {
      targetDomain: input.target.targetDomain,
      sourceTable: input.target.sourceTable,
      rawTableName: input.target.rawTableName,
      targetTable: input.target.targetTable,
      totalRecords: rawRecords.length,
      createdRecords,
      updatedRecords,
      unconfirmedRecords,
      checkpointValue: this.resolveCheckpointValue(rawRecords),
    };
  }

  private async normalizeFundsTarget(
    input: NormalizeTargetInput,
  ): Promise<NormalizeTargetSummary> {
    const config = FUND_TABLE_CONFIGS[input.target.sourceTable];
    const repository =
      input.target.rawTableName === 'abc_raw_transactions'
        ? this.abcRawTransactionRepository
        : this.abcRawOrderRepository;
    const rawRecords = await repository.find({
      where: {
        sourceSystem: input.sourceSystemCode,
        sourceTable: input.target.sourceTable,
      },
      order: {
        id: 'ASC',
      },
    });
    const statusMappings = await this.loadStatusMappings(
      input.sourceSystemCode,
      input.target.sourceTable,
    );
    const amountRules = await this.loadAmountRules(input.sourceSystemCode, input.target.sourceTable);
    const merchantAccountRefs = await this.loadMerchantAccountRefs(input.sourceSystemCode);

    let createdRecords = 0;
    let updatedRecords = 0;
    let unconfirmedRecords = 0;

    for (const rawRecord of rawRecords) {
      const rawRow = rawRecord.rawPayload as RawRow;
      const status = this.resolveMappedValue({
        sourceTable: input.target.sourceTable,
        sourceField: config.statusField,
        rawRow,
        targetDomain: 'fund_status',
        statusMappings,
      });
      const amount = this.normalizeAmount({
        sourceTable: input.target.sourceTable,
        amountField: config.amountField,
        rawRow,
        amountRules,
      });
      const fundType = this.resolveFundType(
        input.target.sourceTable,
        config,
        rawRow,
        statusMappings,
      );
      const direction = this.resolveDirection(fundType.standardValue);
      const mappingNotes = [...status.notes, ...amount.notes, ...fundType.notes];
      const mappingConfirmed = status.confirmed && amount.confirmed && fundType.confirmed;
      const sourceMerchantId = this.readString(rawRow, 'merchant_id');
      const merchantAccountRef = this.resolveMerchantAccountRef(
        merchantAccountRefs,
        sourceMerchantId,
      );

      if (!mappingConfirmed) {
        unconfirmedRecords += 1;
      }

      const normalizedPayload = {
        domain: AbcSyncTargetDomain.FUNDS,
        sourceTable: input.target.sourceTable,
        rawTableName: input.target.rawTableName,
        fundType: {
          raw: fundType.rawValue,
          standard: fundType.standardValue,
          confidenceLevel: fundType.confidenceLevel,
        },
        status: {
          field: status.sourceField,
          raw: status.rawValue,
          standard: status.standardValue,
          confidenceLevel: status.confidenceLevel,
        },
        directionStandard: direction,
        amount: {
          field: amount.sourceField,
          raw: amount.rawValue,
          standard: amount.standardValue,
          unit: amount.standardUnit,
          confidenceLevel: amount.confidenceLevel,
        },
        sourceRefs: {
          userId: this.readString(rawRow, 'user_id'),
          merchantId: sourceMerchantId,
          merchantName: merchantAccountRef?.name ?? null,
          merchantUsername: merchantAccountRef?.username ?? null,
          relatedOrderNo: this.readString(rawRow, config.relatedOrderField),
        },
        mappingConfirmed,
        mappingNotes,
      } as Record<string, unknown>;

      const existing = await this.abcSyncFundRepository.findOne({
        where: {
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
        },
      });

      if (existing) {
        existing.sourceOrderNo = rawRecord.sourceOrderNo;
        existing.sourceUpdatedAt = rawRecord.sourceUpdatedAt;
        existing.rawRecordId = rawRecord.id;
        existing.rawTableName = input.target.rawTableName;
        existing.fundTypeStandard = fundType.standardValue;
        existing.statusField = status.sourceField;
        existing.statusRaw = status.rawValue;
        existing.statusStandard = status.standardValue;
        existing.directionStandard = direction;
        existing.amountField = amount.sourceField;
        existing.amountRaw = amount.rawValue;
        existing.amountStandard = amount.standardValue;
        existing.amountUnit = amount.standardUnit ?? null;
        existing.relatedOrderNo = this.readString(rawRow, config.relatedOrderField);
        existing.sourceUserId = this.readString(rawRow, 'user_id');
        existing.sourceMerchantId = sourceMerchantId;
        existing.mappingConfirmed = mappingConfirmed;
        existing.mappingNotes = mappingNotes.length ? mappingNotes.join(' | ') : null;
        existing.normalizedPayload = normalizedPayload;
        existing.syncedAt = input.syncedAt;
        existing.syncBatchNo = input.batchNo;
        await this.abcSyncFundRepository.save(existing);
        updatedRecords += 1;
      } else {
        const entity = this.abcSyncFundRepository.create({
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
          sourceOrderNo: rawRecord.sourceOrderNo,
          sourceUpdatedAt: rawRecord.sourceUpdatedAt,
          rawRecordId: rawRecord.id,
          rawTableName: input.target.rawTableName,
          fundTypeStandard: fundType.standardValue,
          statusField: status.sourceField,
          statusRaw: status.rawValue,
          statusStandard: status.standardValue,
          directionStandard: direction,
          amountField: amount.sourceField,
          amountRaw: amount.rawValue,
          amountStandard: amount.standardValue,
          amountUnit: amount.standardUnit,
          relatedOrderNo: this.readString(rawRow, config.relatedOrderField),
          sourceUserId: this.readString(rawRow, 'user_id'),
          sourceMerchantId,
          mappingConfirmed,
          mappingNotes: mappingNotes.length ? mappingNotes.join(' | ') : null,
          normalizedPayload,
          syncedAt: input.syncedAt,
          syncBatchNo: input.batchNo,
        });

        await this.abcSyncFundRepository.save(entity);
        createdRecords += 1;
      }
    }

    return {
      targetDomain: input.target.targetDomain,
      sourceTable: input.target.sourceTable,
      rawTableName: input.target.rawTableName,
      targetTable: input.target.targetTable,
      totalRecords: rawRecords.length,
      createdRecords,
      updatedRecords,
      unconfirmedRecords,
      checkpointValue: this.resolveCheckpointValue(rawRecords),
    };
  }

  private async normalizeCardsTarget(
    input: NormalizeTargetInput,
  ): Promise<NormalizeTargetSummary> {
    const config = CARD_TABLE_CONFIGS[input.target.sourceTable];
    const rawRecords = await this.abcRawCardRepository.find({
      where: {
        sourceSystem: input.sourceSystemCode,
        sourceTable: input.target.sourceTable,
      },
      order: {
        id: 'ASC',
      },
    });
    const statusMappings = await this.loadStatusMappings(
      input.sourceSystemCode,
      input.target.sourceTable,
    );
    const amountRules = await this.loadAmountRules(input.sourceSystemCode, input.target.sourceTable);
    const merchantAccountRefs = await this.loadMerchantAccountRefs(input.sourceSystemCode);

    let createdRecords = 0;
    let updatedRecords = 0;
    let unconfirmedRecords = 0;

    for (const rawRecord of rawRecords) {
      const rawRow = this.buildCardRawRow(rawRecord.rawPayload as RawRow);
      const status = this.resolveMappedValue({
        sourceTable: input.target.sourceTable,
        sourceField: config.statusField,
        rawRow,
        targetDomain: 'card_status',
        statusMappings,
      });
      const amount = config.amountField
        ? this.normalizeAmount({
            sourceTable: input.target.sourceTable,
            amountField: config.amountField,
            rawRow,
            amountRules,
          })
        : this.buildNotApplicableAmountResult();
      const extraAmount = config.extraAmountField
        ? this.normalizeAmount({
            sourceTable: input.target.sourceTable,
            amountField: config.extraAmountField,
            rawRow,
            amountRules,
          })
        : this.buildNotApplicableAmountResult();
      const mappingNotes = [...status.notes, ...amount.notes, ...extraAmount.notes];
      const mappingConfirmed = status.confirmed && amount.confirmed && extraAmount.confirmed;
      const sourceMerchantId = config.sourceMerchantIdField
        ? this.readString(rawRow, config.sourceMerchantIdField)
        : null;
      const merchantAccountRef = this.resolveMerchantAccountRef(
        merchantAccountRefs,
        sourceMerchantId,
      );

      if (!mappingConfirmed) {
        unconfirmedRecords += 1;
      }

      const normalizedPayload = {
        domain: AbcSyncTargetDomain.CARDS,
        recordType: 'cards',
        cardObjectType: config.cardObjectType,
        sourceTable: input.target.sourceTable,
        rawTableName: input.target.rawTableName,
        status: {
          field: status.sourceField,
          raw: status.rawValue,
          standard: status.standardValue,
          confidenceLevel: status.confidenceLevel,
        },
        primaryAmount: {
          field: amount.sourceField,
          raw: amount.rawValue,
          standard: amount.standardValue,
          unit: amount.standardUnit,
          confidenceLevel: amount.confidenceLevel,
        },
        extraAmount: config.extraAmountField
          ? {
              field: extraAmount.sourceField,
              raw: extraAmount.rawValue,
              standard: extraAmount.standardValue,
              unit: extraAmount.standardUnit,
              confidenceLevel: extraAmount.confidenceLevel,
            }
          : null,
        sourceRefs: {
          cardId: config.sourceCardIdField
            ? this.readString(rawRow, config.sourceCardIdField)
            : null,
          userId: config.sourceUserIdField
            ? this.readString(rawRow, config.sourceUserIdField)
            : null,
          merchantId: sourceMerchantId,
          merchantName: merchantAccountRef?.name ?? null,
          merchantUsername: merchantAccountRef?.username ?? null,
        },
        cardName: config.cardNameField ? this.readString(rawRow, config.cardNameField) : null,
        cardNumber: config.cardNumberField
          ? this.readString(rawRow, config.cardNumberField)
          : null,
        sourceMeta: this.buildCardSourceMeta(input.target.sourceTable, rawRow),
        mappingConfirmed,
        mappingNotes,
      } as Record<string, unknown>;

      const existing = await this.abcSyncCardRepository.findOne({
        where: {
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
        },
      });

      if (existing) {
        existing.sourceOrderNo = rawRecord.sourceOrderNo;
        existing.sourceUpdatedAt = rawRecord.sourceUpdatedAt;
        existing.rawRecordId = rawRecord.id;
        existing.rawTableName = input.target.rawTableName;
        existing.cardObjectType = config.cardObjectType;
        existing.cardName = config.cardNameField
          ? this.readString(rawRow, config.cardNameField)
          : null;
        existing.cardNumber = config.cardNumberField
          ? this.readString(rawRow, config.cardNumberField)
          : null;
        existing.cardStatusField = status.sourceField;
        existing.cardStatusRaw = status.rawValue;
        existing.cardStatusStandard = status.standardValue;
        existing.amountField = amount.sourceField;
        existing.amountRaw = amount.rawValue;
        existing.amountStandard = amount.standardValue;
        existing.amountUnit = amount.standardUnit ?? null;
        existing.sourceCardId = config.sourceCardIdField
          ? this.readString(rawRow, config.sourceCardIdField)
          : null;
        existing.sourceUserId = config.sourceUserIdField
          ? this.readString(rawRow, config.sourceUserIdField)
          : null;
        existing.sourceMerchantId = sourceMerchantId;
        existing.mappingConfirmed = mappingConfirmed;
        existing.mappingNotes = mappingNotes.length ? mappingNotes.join(' | ') : null;
        existing.normalizedPayload = normalizedPayload;
        existing.syncedAt = input.syncedAt;
        existing.syncBatchNo = input.batchNo;
        await this.abcSyncCardRepository.save(existing);
        updatedRecords += 1;
      } else {
        const entity = this.abcSyncCardRepository.create({
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
          sourceOrderNo: rawRecord.sourceOrderNo,
          sourceUpdatedAt: rawRecord.sourceUpdatedAt,
          rawRecordId: rawRecord.id,
          rawTableName: input.target.rawTableName,
          cardObjectType: config.cardObjectType,
          cardName: config.cardNameField ? this.readString(rawRow, config.cardNameField) : null,
          cardNumber: config.cardNumberField
            ? this.readString(rawRow, config.cardNumberField)
            : null,
          cardStatusField: status.sourceField,
          cardStatusRaw: status.rawValue,
          cardStatusStandard: status.standardValue,
          amountField: amount.sourceField,
          amountRaw: amount.rawValue,
          amountStandard: amount.standardValue,
          amountUnit: amount.standardUnit ?? null,
          sourceCardId: config.sourceCardIdField
            ? this.readString(rawRow, config.sourceCardIdField)
            : null,
          sourceUserId: config.sourceUserIdField
            ? this.readString(rawRow, config.sourceUserIdField)
            : null,
          sourceMerchantId,
          mappingConfirmed,
          mappingNotes: mappingNotes.length ? mappingNotes.join(' | ') : null,
          normalizedPayload,
          syncedAt: input.syncedAt,
          syncBatchNo: input.batchNo,
        });

        await this.abcSyncCardRepository.save(entity);
        createdRecords += 1;
      }
    }

    return {
      targetDomain: input.target.targetDomain,
      sourceTable: input.target.sourceTable,
      rawTableName: input.target.rawTableName,
      targetTable: input.target.targetTable,
      totalRecords: rawRecords.length,
      createdRecords,
      updatedRecords,
      unconfirmedRecords,
      checkpointValue: this.resolveCheckpointValue(rawRecords),
    };
  }

  private async normalizeCardLedgerTarget(
    input: NormalizeTargetInput,
  ): Promise<NormalizeTargetSummary> {
    const config = CARD_LEDGER_TABLE_CONFIGS[input.target.sourceTable];
    const rawRecords = await this.abcRawCardRepository.find({
      where: {
        sourceSystem: input.sourceSystemCode,
        sourceTable: input.target.sourceTable,
      },
      order: {
        id: 'ASC',
      },
    });
    const statusMappings = await this.loadStatusMappings(
      input.sourceSystemCode,
      input.target.sourceTable,
    );
    const amountRules = await this.loadAmountRules(input.sourceSystemCode, input.target.sourceTable);
    const merchantAccountRefs = await this.loadMerchantAccountRefs(input.sourceSystemCode);

    let createdRecords = 0;
    let updatedRecords = 0;
    let unconfirmedRecords = 0;

    for (const rawRecord of rawRecords) {
      const rawRow = this.buildCardRawRow(rawRecord.rawPayload as RawRow);
      const ledgerType = this.resolveCardLedgerType(
        input.target.sourceTable,
        config,
        rawRow,
        statusMappings,
      );
      const status = this.resolveMappedValue({
        sourceTable: input.target.sourceTable,
        sourceField: config.statusField,
        rawRow,
        targetDomain: 'card_status',
        statusMappings,
      });
      const amount = this.normalizeAmount({
        sourceTable: input.target.sourceTable,
        amountField: config.amountField,
        rawRow,
        amountRules,
      });
      const balance = config.balanceField
        ? this.normalizeAmount({
            sourceTable: input.target.sourceTable,
            amountField: config.balanceField,
            rawRow,
            amountRules,
          })
        : this.buildNotApplicableAmountResult();
      const mappingNotes = [...ledgerType.notes, ...status.notes, ...amount.notes, ...balance.notes];
      const mappingConfirmed =
        ledgerType.confirmed && status.confirmed && amount.confirmed && balance.confirmed;
      const sourceMerchantId = config.sourceMerchantIdField
        ? this.readString(rawRow, config.sourceMerchantIdField)
        : null;
      const merchantAccountRef = this.resolveMerchantAccountRef(
        merchantAccountRefs,
        sourceMerchantId,
      );

      if (!mappingConfirmed) {
        unconfirmedRecords += 1;
      }

      const normalizedPayload = {
        domain: AbcSyncTargetDomain.CARDS,
        recordType: 'card_ledger',
        sourceTable: input.target.sourceTable,
        rawTableName: input.target.rawTableName,
        ledgerType: {
          field: config.ledgerTypeField ?? null,
          raw: ledgerType.rawValue,
          standard: ledgerType.standardValue,
          confidenceLevel: ledgerType.confidenceLevel,
        },
        status: {
          field: status.sourceField,
          raw: status.rawValue,
          standard: status.standardValue,
          confidenceLevel: status.confidenceLevel,
        },
        amount: {
          field: amount.sourceField,
          raw: amount.rawValue,
          standard: amount.standardValue,
          unit: amount.standardUnit,
          confidenceLevel: amount.confidenceLevel,
        },
        balance: config.balanceField
          ? {
              field: balance.sourceField,
              raw: balance.rawValue,
              standard: balance.standardValue,
              unit: balance.standardUnit,
              confidenceLevel: balance.confidenceLevel,
            }
          : null,
        sourceRefs: {
          userId: config.sourceUserIdField
            ? this.readString(rawRow, config.sourceUserIdField)
            : null,
          merchantId: sourceMerchantId,
          merchantName: merchantAccountRef?.name ?? null,
          merchantUsername: merchantAccountRef?.username ?? null,
          relatedCardSourceId: config.relatedCardField
            ? this.readString(rawRow, config.relatedCardField)
            : null,
          relatedOrderNo: config.relatedOrderField
            ? this.readString(rawRow, config.relatedOrderField)
            : null,
        },
        sourceMeta: this.buildCardLedgerSourceMeta(input.target.sourceTable, rawRow),
        mappingConfirmed,
        mappingNotes,
      } as Record<string, unknown>;

      const existing = await this.abcSyncCardLedgerRepository.findOne({
        where: {
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
        },
      });

      if (existing) {
        existing.sourceOrderNo = rawRecord.sourceOrderNo;
        existing.sourceUpdatedAt = rawRecord.sourceUpdatedAt;
        existing.rawRecordId = rawRecord.id;
        existing.rawTableName = input.target.rawTableName;
        existing.ledgerTypeStandard = ledgerType.standardValue;
        existing.statusField = status.sourceField;
        existing.statusRaw = status.rawValue;
        existing.statusStandard = status.standardValue;
        existing.amountField = amount.sourceField;
        existing.amountRaw = amount.rawValue;
        existing.amountStandard = amount.standardValue;
        existing.amountUnit = amount.standardUnit ?? null;
        existing.balanceField = balance.sourceField;
        existing.balanceRaw = balance.rawValue;
        existing.balanceStandard = balance.standardValue;
        existing.balanceUnit = balance.standardUnit ?? null;
        existing.relatedCardSourceId = config.relatedCardField
          ? this.readString(rawRow, config.relatedCardField)
          : null;
        existing.relatedOrderNo = config.relatedOrderField
          ? this.readString(rawRow, config.relatedOrderField)
          : null;
        existing.sourceUserId = config.sourceUserIdField
          ? this.readString(rawRow, config.sourceUserIdField)
          : null;
        existing.sourceMerchantId = sourceMerchantId;
        existing.mappingConfirmed = mappingConfirmed;
        existing.mappingNotes = mappingNotes.length ? mappingNotes.join(' | ') : null;
        existing.normalizedPayload = normalizedPayload;
        existing.syncedAt = input.syncedAt;
        existing.syncBatchNo = input.batchNo;
        await this.abcSyncCardLedgerRepository.save(existing);
        updatedRecords += 1;
      } else {
        const entity = this.abcSyncCardLedgerRepository.create({
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
          sourceOrderNo: rawRecord.sourceOrderNo,
          sourceUpdatedAt: rawRecord.sourceUpdatedAt,
          rawRecordId: rawRecord.id,
          rawTableName: input.target.rawTableName,
          ledgerTypeStandard: ledgerType.standardValue,
          statusField: status.sourceField,
          statusRaw: status.rawValue,
          statusStandard: status.standardValue,
          amountField: amount.sourceField,
          amountRaw: amount.rawValue,
          amountStandard: amount.standardValue,
          amountUnit: amount.standardUnit ?? null,
          balanceField: balance.sourceField,
          balanceRaw: balance.rawValue,
          balanceStandard: balance.standardValue,
          balanceUnit: balance.standardUnit ?? null,
          relatedCardSourceId: config.relatedCardField
            ? this.readString(rawRow, config.relatedCardField)
            : null,
          relatedOrderNo: config.relatedOrderField
            ? this.readString(rawRow, config.relatedOrderField)
            : null,
          sourceUserId: config.sourceUserIdField
            ? this.readString(rawRow, config.sourceUserIdField)
            : null,
          sourceMerchantId,
          mappingConfirmed,
          mappingNotes: mappingNotes.length ? mappingNotes.join(' | ') : null,
          normalizedPayload,
          syncedAt: input.syncedAt,
          syncBatchNo: input.batchNo,
        });

        await this.abcSyncCardLedgerRepository.save(entity);
        createdRecords += 1;
      }
    }

    return {
      targetDomain: input.target.targetDomain,
      sourceTable: input.target.sourceTable,
      rawTableName: input.target.rawTableName,
      targetTable: input.target.targetTable,
      totalRecords: rawRecords.length,
      createdRecords,
      updatedRecords,
      unconfirmedRecords,
      checkpointValue: this.resolveCheckpointValue(rawRecords),
    };
  }

  private async normalizeMaterialsTarget(
    input: NormalizeTargetInput,
  ): Promise<NormalizeTargetSummary> {
    const config = INVENTORY_MATERIAL_TABLE_CONFIG;
    const rawRecords = await this.abcRawInventoryRepository.find({
      where: {
        sourceSystem: input.sourceSystemCode,
        sourceTable: input.target.sourceTable,
      },
      order: {
        id: 'ASC',
      },
    });
    const statusMappings = await this.loadStatusMappings(
      input.sourceSystemCode,
      input.target.sourceTable,
    );
    const amountRules = await this.loadAmountRules(input.sourceSystemCode, input.target.sourceTable);

    let createdRecords = 0;
    let updatedRecords = 0;
    let unconfirmedRecords = 0;

    for (const rawRecord of rawRecords) {
      const rawRow = this.buildDerivedStatusRawRow(rawRecord.rawPayload as RawRow);
      const status = this.resolveMappedValue({
        sourceTable: input.target.sourceTable,
        sourceField: config.statusField,
        rawRow,
        targetDomain: 'material_status',
        statusMappings,
      });
      const storageAmount = this.normalizeAmount({
        sourceTable: input.target.sourceTable,
        amountField: config.storageAmountField,
        rawRow,
        amountRules,
      });
      const saleAmount = this.normalizeAmount({
        sourceTable: input.target.sourceTable,
        amountField: config.saleAmountField,
        rawRow,
        amountRules,
      });
      const warningQuantity = this.normalizeQuantityValue({
        sourceTable: input.target.sourceTable,
        quantityField: config.warningQuantityField,
        rawValue: this.readString(rawRow, config.warningQuantityField),
        quantityUnit: config.quantityUnitField
          ? this.readString(rawRow, config.quantityUnitField)
          : null,
      });
      const mappingNotes = [
        ...status.notes,
        ...storageAmount.notes,
        ...saleAmount.notes,
        ...warningQuantity.notes,
      ];
      const mappingConfirmed =
        status.confirmed &&
        storageAmount.confirmed &&
        saleAmount.confirmed &&
        warningQuantity.confirmed;

      if (!mappingConfirmed) {
        unconfirmedRecords += 1;
      }

      const normalizedPayload = {
        domain: AbcSyncTargetDomain.INVENTORY,
        recordType: 'materials',
        sourceTable: input.target.sourceTable,
        rawTableName: input.target.rawTableName,
        status: {
          field: status.sourceField,
          raw: status.rawValue,
          standard: status.standardValue,
          confidenceLevel: status.confidenceLevel,
        },
        warningQuantity: {
          field: warningQuantity.sourceField,
          raw: warningQuantity.rawValue,
          standard: warningQuantity.standardValue,
          unit: warningQuantity.standardUnit,
          confidenceLevel: warningQuantity.confidenceLevel,
        },
        storageAmount: {
          field: storageAmount.sourceField,
          raw: storageAmount.rawValue,
          standard: storageAmount.standardValue,
          unit: storageAmount.standardUnit,
          confidenceLevel: storageAmount.confidenceLevel,
        },
        saleAmount: {
          field: saleAmount.sourceField,
          raw: saleAmount.rawValue,
          standard: saleAmount.standardValue,
          unit: saleAmount.standardUnit,
          confidenceLevel: saleAmount.confidenceLevel,
        },
        sourceRefs: {
          merchantId: config.sourceMerchantIdField
            ? this.readString(rawRow, config.sourceMerchantIdField)
            : null,
          supplierIds: config.supplierIdsField
            ? this.readString(rawRow, config.supplierIdsField)
            : null,
        },
        material: {
          code: this.readString(rawRow, config.codeField),
          name: this.readString(rawRow, config.nameField),
        },
        mappingConfirmed,
        mappingNotes,
      } as Record<string, unknown>;

      const existing = await this.abcSyncMaterialRepository.findOne({
        where: {
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
        },
      });

      if (existing) {
        existing.sourceOrderNo = rawRecord.sourceOrderNo;
        existing.sourceUpdatedAt = rawRecord.sourceUpdatedAt;
        existing.rawRecordId = rawRecord.id;
        existing.rawTableName = input.target.rawTableName;
        existing.materialName = this.readString(rawRow, config.nameField);
        existing.materialCode = this.readString(rawRow, config.codeField);
        existing.materialStatusField = status.sourceField;
        existing.materialStatusRaw = status.rawValue;
        existing.materialStatusStandard = status.standardValue;
        existing.warningQuantityField = warningQuantity.sourceField;
        existing.warningQuantityRaw = warningQuantity.rawValue;
        existing.warningQuantityStandard = warningQuantity.standardValue;
        existing.quantityUnit = warningQuantity.standardUnit ?? null;
        existing.storageAmountField = storageAmount.sourceField;
        existing.storageAmountRaw = storageAmount.rawValue;
        existing.storageAmountStandard = storageAmount.standardValue;
        existing.storageAmountUnit = storageAmount.standardUnit ?? null;
        existing.saleAmountField = saleAmount.sourceField;
        existing.saleAmountRaw = saleAmount.rawValue;
        existing.saleAmountStandard = saleAmount.standardValue;
        existing.saleAmountUnit = saleAmount.standardUnit ?? null;
        existing.supplierIdsRaw = config.supplierIdsField
          ? this.readString(rawRow, config.supplierIdsField)
          : null;
        existing.sourceMerchantId = config.sourceMerchantIdField
          ? this.readString(rawRow, config.sourceMerchantIdField)
          : null;
        existing.mappingConfirmed = mappingConfirmed;
        existing.mappingNotes = mappingNotes.length ? mappingNotes.join(' | ') : null;
        existing.normalizedPayload = normalizedPayload;
        existing.syncedAt = input.syncedAt;
        existing.syncBatchNo = input.batchNo;
        await this.abcSyncMaterialRepository.save(existing);
        updatedRecords += 1;
      } else {
        const entity = this.abcSyncMaterialRepository.create({
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
          sourceOrderNo: rawRecord.sourceOrderNo,
          sourceUpdatedAt: rawRecord.sourceUpdatedAt,
          rawRecordId: rawRecord.id,
          rawTableName: input.target.rawTableName,
          materialName: this.readString(rawRow, config.nameField),
          materialCode: this.readString(rawRow, config.codeField),
          materialStatusField: status.sourceField,
          materialStatusRaw: status.rawValue,
          materialStatusStandard: status.standardValue,
          warningQuantityField: warningQuantity.sourceField,
          warningQuantityRaw: warningQuantity.rawValue,
          warningQuantityStandard: warningQuantity.standardValue,
          quantityUnit: warningQuantity.standardUnit ?? null,
          storageAmountField: storageAmount.sourceField,
          storageAmountRaw: storageAmount.rawValue,
          storageAmountStandard: storageAmount.standardValue,
          storageAmountUnit: storageAmount.standardUnit ?? null,
          saleAmountField: saleAmount.sourceField,
          saleAmountRaw: saleAmount.rawValue,
          saleAmountStandard: saleAmount.standardValue,
          saleAmountUnit: saleAmount.standardUnit ?? null,
          supplierIdsRaw: config.supplierIdsField
            ? this.readString(rawRow, config.supplierIdsField)
            : null,
          sourceMerchantId: config.sourceMerchantIdField
            ? this.readString(rawRow, config.sourceMerchantIdField)
            : null,
          mappingConfirmed,
          mappingNotes: mappingNotes.length ? mappingNotes.join(' | ') : null,
          normalizedPayload,
          syncedAt: input.syncedAt,
          syncBatchNo: input.batchNo,
        });

        await this.abcSyncMaterialRepository.save(entity);
        createdRecords += 1;
      }
    }

    return {
      targetDomain: input.target.targetDomain,
      sourceTable: input.target.sourceTable,
      rawTableName: input.target.rawTableName,
      targetTable: input.target.targetTable,
      totalRecords: rawRecords.length,
      createdRecords,
      updatedRecords,
      unconfirmedRecords,
      checkpointValue: this.resolveCheckpointValue(rawRecords),
    };
  }

  private async normalizeSuppliersTarget(
    input: NormalizeTargetInput,
  ): Promise<NormalizeTargetSummary> {
    const config = INVENTORY_SUPPLIER_TABLE_CONFIG;
    const rawRecords = await this.abcRawInventoryRepository.find({
      where: {
        sourceSystem: input.sourceSystemCode,
        sourceTable: input.target.sourceTable,
      },
      order: {
        id: 'ASC',
      },
    });
    const statusMappings = await this.loadStatusMappings(
      input.sourceSystemCode,
      input.target.sourceTable,
    );

    let createdRecords = 0;
    let updatedRecords = 0;
    let unconfirmedRecords = 0;

    for (const rawRecord of rawRecords) {
      const rawRow = this.buildDerivedStatusRawRow(rawRecord.rawPayload as RawRow);
      const status = this.resolveMappedValue({
        sourceTable: input.target.sourceTable,
        sourceField: config.statusField,
        rawRow,
        targetDomain: 'supplier_status',
        statusMappings,
      });
      const mappingNotes = [...status.notes];
      const mappingConfirmed = status.confirmed;

      if (!mappingConfirmed) {
        unconfirmedRecords += 1;
      }

      const normalizedPayload = {
        domain: AbcSyncTargetDomain.INVENTORY,
        recordType: 'suppliers',
        sourceTable: input.target.sourceTable,
        rawTableName: input.target.rawTableName,
        status: {
          field: status.sourceField,
          raw: status.rawValue,
          standard: status.standardValue,
          confidenceLevel: status.confidenceLevel,
        },
        supplier: {
          name: this.readString(rawRow, config.nameField),
          contact: config.contactField ? this.readString(rawRow, config.contactField) : null,
          phone: config.phoneField ? this.readString(rawRow, config.phoneField) : null,
          email: config.emailField ? this.readString(rawRow, config.emailField) : null,
          companySite: config.companySiteField
            ? this.readString(rawRow, config.companySiteField)
            : null,
        },
        sourceRefs: {
          merchantId: config.sourceMerchantIdField
            ? this.readString(rawRow, config.sourceMerchantIdField)
            : null,
        },
        mappingConfirmed,
        mappingNotes,
      } as Record<string, unknown>;

      const existing = await this.abcSyncSupplierRepository.findOne({
        where: {
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
        },
      });

      if (existing) {
        existing.sourceOrderNo = rawRecord.sourceOrderNo;
        existing.sourceUpdatedAt = rawRecord.sourceUpdatedAt;
        existing.rawRecordId = rawRecord.id;
        existing.rawTableName = input.target.rawTableName;
        existing.supplierName = this.readString(rawRow, config.nameField);
        existing.supplierStatusField = status.sourceField;
        existing.supplierStatusRaw = status.rawValue;
        existing.supplierStatusStandard = status.standardValue;
        existing.contactName = config.contactField
          ? this.readString(rawRow, config.contactField)
          : null;
        existing.contactMobile = config.phoneField
          ? this.readString(rawRow, config.phoneField)
          : null;
        existing.email = config.emailField ? this.readString(rawRow, config.emailField) : null;
        existing.companySite = config.companySiteField
          ? this.readString(rawRow, config.companySiteField)
          : null;
        existing.sourceMerchantId = config.sourceMerchantIdField
          ? this.readString(rawRow, config.sourceMerchantIdField)
          : null;
        existing.mappingConfirmed = mappingConfirmed;
        existing.mappingNotes = mappingNotes.length ? mappingNotes.join(' | ') : null;
        existing.normalizedPayload = normalizedPayload;
        existing.syncedAt = input.syncedAt;
        existing.syncBatchNo = input.batchNo;
        await this.abcSyncSupplierRepository.save(existing);
        updatedRecords += 1;
      } else {
        const entity = this.abcSyncSupplierRepository.create({
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
          sourceOrderNo: rawRecord.sourceOrderNo,
          sourceUpdatedAt: rawRecord.sourceUpdatedAt,
          rawRecordId: rawRecord.id,
          rawTableName: input.target.rawTableName,
          supplierName: this.readString(rawRow, config.nameField),
          supplierStatusField: status.sourceField,
          supplierStatusRaw: status.rawValue,
          supplierStatusStandard: status.standardValue,
          contactName: config.contactField ? this.readString(rawRow, config.contactField) : null,
          contactMobile: config.phoneField ? this.readString(rawRow, config.phoneField) : null,
          email: config.emailField ? this.readString(rawRow, config.emailField) : null,
          companySite: config.companySiteField
            ? this.readString(rawRow, config.companySiteField)
            : null,
          sourceMerchantId: config.sourceMerchantIdField
            ? this.readString(rawRow, config.sourceMerchantIdField)
            : null,
          mappingConfirmed,
          mappingNotes: mappingNotes.length ? mappingNotes.join(' | ') : null,
          normalizedPayload,
          syncedAt: input.syncedAt,
          syncBatchNo: input.batchNo,
        });

        await this.abcSyncSupplierRepository.save(entity);
        createdRecords += 1;
      }
    }

    return {
      targetDomain: input.target.targetDomain,
      sourceTable: input.target.sourceTable,
      rawTableName: input.target.rawTableName,
      targetTable: input.target.targetTable,
      totalRecords: rawRecords.length,
      createdRecords,
      updatedRecords,
      unconfirmedRecords,
      checkpointValue: this.resolveCheckpointValue(rawRecords),
    };
  }

  private async normalizeWarehousesTarget(
    input: NormalizeTargetInput,
  ): Promise<NormalizeTargetSummary> {
    const config = INVENTORY_WAREHOUSE_TABLE_CONFIG;
    const rawRecords = await this.abcRawInventoryRepository.find({
      where: {
        sourceSystem: input.sourceSystemCode,
        sourceTable: input.target.sourceTable,
      },
      order: {
        id: 'ASC',
      },
    });
    const statusMappings = await this.loadStatusMappings(
      input.sourceSystemCode,
      input.target.sourceTable,
    );
    const amountRules = await this.loadAmountRules(input.sourceSystemCode, input.target.sourceTable);

    let createdRecords = 0;
    let updatedRecords = 0;
    let unconfirmedRecords = 0;

    for (const rawRecord of rawRecords) {
      const rawRow = rawRecord.rawPayload as RawRow;
      const status = this.resolveMappedValue({
        sourceTable: input.target.sourceTable,
        sourceField: config.statusField,
        rawRow,
        targetDomain: 'warehouse_status',
        statusMappings,
      });
      const quantity = config.quantityField
        ? this.normalizeQuantityValue({
            sourceTable: input.target.sourceTable,
            quantityField: config.quantityField,
            rawValue: this.readString(rawRow, config.quantityField),
            quantityUnit: config.quantityUnit ?? null,
          })
        : this.buildNotApplicableAmountResult();
      const amount = config.amountField
        ? this.normalizeAmount({
            sourceTable: input.target.sourceTable,
            amountField: config.amountField,
            rawRow,
            amountRules,
          })
        : this.buildNotApplicableAmountResult();
      const warehouseName = this.resolveWarehouseName(rawRow, config.warehouseNameField);
      const mappingNotes = [...status.notes, ...quantity.notes, ...amount.notes, ...warehouseName.notes];
      const mappingConfirmed =
        status.confirmed && quantity.confirmed && amount.confirmed && warehouseName.confirmed;

      if (!mappingConfirmed) {
        unconfirmedRecords += 1;
      }

      const normalizedPayload = {
        domain: AbcSyncTargetDomain.INVENTORY,
        recordType: 'warehouses',
        sourceTable: input.target.sourceTable,
        rawTableName: input.target.rawTableName,
        status: {
          field: status.sourceField,
          raw: status.rawValue,
          standard: status.standardValue,
          confidenceLevel: status.confidenceLevel,
        },
        quantity: {
          field: quantity.sourceField,
          raw: quantity.rawValue,
          standard: quantity.standardValue,
          unit: quantity.standardUnit,
          confidenceLevel: quantity.confidenceLevel,
        },
        amount: {
          field: amount.sourceField,
          raw: amount.rawValue,
          standard: amount.standardValue,
          unit: amount.standardUnit,
          confidenceLevel: amount.confidenceLevel,
        },
        warehouse: {
          sourceId: this.readString(rawRow, config.warehouseSourceIdField),
          name: warehouseName.value,
        },
        sourceRefs: {
          merchantId: config.sourceMerchantIdField
            ? this.readString(rawRow, config.sourceMerchantIdField)
            : null,
          supplierId: config.supplierSourceIdField
            ? this.readString(rawRow, config.supplierSourceIdField)
            : null,
          materialId: config.materialSourceIdField
            ? this.readString(rawRow, config.materialSourceIdField)
            : null,
        },
        mappingConfirmed,
        mappingNotes,
      } as Record<string, unknown>;

      const existing = await this.abcSyncWarehouseRepository.findOne({
        where: {
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
        },
      });

      if (existing) {
        existing.sourceOrderNo = rawRecord.sourceOrderNo;
        existing.sourceUpdatedAt = rawRecord.sourceUpdatedAt;
        existing.rawRecordId = rawRecord.id;
        existing.rawTableName = input.target.rawTableName;
        existing.warehouseSourceId = this.readString(rawRow, config.warehouseSourceIdField);
        existing.warehouseName = warehouseName.value;
        existing.warehouseStatusField = status.sourceField;
        existing.warehouseStatusRaw = status.rawValue;
        existing.warehouseStatusStandard = status.standardValue;
        existing.quantityField = quantity.sourceField;
        existing.quantityRaw = quantity.rawValue;
        existing.quantityStandard = quantity.standardValue;
        existing.quantityUnit = quantity.standardUnit ?? null;
        existing.amountField = amount.sourceField;
        existing.amountRaw = amount.rawValue;
        existing.amountStandard = amount.standardValue;
        existing.amountUnit = amount.standardUnit ?? null;
        existing.sourceMerchantId = config.sourceMerchantIdField
          ? this.readString(rawRow, config.sourceMerchantIdField)
          : null;
        existing.supplierSourceId = config.supplierSourceIdField
          ? this.readString(rawRow, config.supplierSourceIdField)
          : null;
        existing.materialSourceId = config.materialSourceIdField
          ? this.readString(rawRow, config.materialSourceIdField)
          : null;
        existing.mappingConfirmed = mappingConfirmed;
        existing.mappingNotes = mappingNotes.length ? mappingNotes.join(' | ') : null;
        existing.normalizedPayload = normalizedPayload;
        existing.syncedAt = input.syncedAt;
        existing.syncBatchNo = input.batchNo;
        await this.abcSyncWarehouseRepository.save(existing);
        updatedRecords += 1;
      } else {
        const entity = this.abcSyncWarehouseRepository.create({
          sourceSystem: input.sourceSystemCode,
          sourceTable: input.target.sourceTable,
          sourceId: rawRecord.sourceId,
          sourceOrderNo: rawRecord.sourceOrderNo,
          sourceUpdatedAt: rawRecord.sourceUpdatedAt,
          rawRecordId: rawRecord.id,
          rawTableName: input.target.rawTableName,
          warehouseSourceId: this.readString(rawRow, config.warehouseSourceIdField),
          warehouseName: warehouseName.value,
          warehouseStatusField: status.sourceField,
          warehouseStatusRaw: status.rawValue,
          warehouseStatusStandard: status.standardValue,
          quantityField: quantity.sourceField,
          quantityRaw: quantity.rawValue,
          quantityStandard: quantity.standardValue,
          quantityUnit: quantity.standardUnit ?? null,
          amountField: amount.sourceField,
          amountRaw: amount.rawValue,
          amountStandard: amount.standardValue,
          amountUnit: amount.standardUnit ?? null,
          sourceMerchantId: config.sourceMerchantIdField
            ? this.readString(rawRow, config.sourceMerchantIdField)
            : null,
          supplierSourceId: config.supplierSourceIdField
            ? this.readString(rawRow, config.supplierSourceIdField)
            : null,
          materialSourceId: config.materialSourceIdField
            ? this.readString(rawRow, config.materialSourceIdField)
            : null,
          mappingConfirmed,
          mappingNotes: mappingNotes.length ? mappingNotes.join(' | ') : null,
          normalizedPayload,
          syncedAt: input.syncedAt,
          syncBatchNo: input.batchNo,
        });

        await this.abcSyncWarehouseRepository.save(entity);
        createdRecords += 1;
      }
    }

    return {
      targetDomain: input.target.targetDomain,
      sourceTable: input.target.sourceTable,
      rawTableName: input.target.rawTableName,
      targetTable: input.target.targetTable,
      totalRecords: rawRecords.length,
      createdRecords,
      updatedRecords,
      unconfirmedRecords,
      checkpointValue: this.resolveCheckpointValue(rawRecords),
    };
  }

  private async normalizeInventoryLedgerTarget(
    input: NormalizeTargetInput,
  ): Promise<NormalizeTargetSummary> {
    const config = INVENTORY_LEDGER_TABLE_CONFIG;
    const rawRecords = await this.abcRawInventoryRepository.find({
      where: {
        sourceSystem: input.sourceSystemCode,
        sourceTable: input.target.sourceTable,
      },
      order: {
        id: 'ASC',
      },
    });
    const statusMappings = await this.loadStatusMappings(
      input.sourceSystemCode,
      input.target.sourceTable,
    );
    const amountRules = await this.loadAmountRules(input.sourceSystemCode, input.target.sourceTable);

    let createdRecords = 0;
    let updatedRecords = 0;
    let unconfirmedRecords = 0;

    for (const rawRecord of rawRecords) {
      const rawRow = this.buildDerivedStatusRawRow(rawRecord.rawPayload as RawRow);
      const ledgerType = this.resolveMappedValue({
        sourceTable: input.target.sourceTable,
        sourceField: config.ledgerTypeField ?? 'type',
        rawRow,
        targetDomain: 'inventory_ledger_type',
        statusMappings,
      });
      const status = this.resolveMappedValue({
        sourceTable: input.target.sourceTable,
        sourceField: config.statusField,
        rawRow,
        targetDomain: 'inventory_status',
        statusMappings,
      });
      const goodsList = this.parseInventoryGoodsList(this.readString(rawRow, 'goods_list'));
      const goodsRows = goodsList.length ? goodsList : [{}];

      for (let lineIndex = 0; lineIndex < goodsRows.length; lineIndex += 1) {
        const goodsRow = goodsRows[lineIndex] as RawRow;
        const quantity = this.normalizeQuantityValue({
          sourceTable: input.target.sourceTable,
          quantityField: config.quantityField ?? 'goods_list[].num',
          rawValue: this.readString(goodsRow, 'num'),
          quantityUnit: config.quantityUnit ?? null,
        });
        const amount = this.normalizeAmount({
          sourceTable: input.target.sourceTable,
          amountField: config.amountField ?? 'goods_list[].price',
          rawRow: {
            [config.amountField ?? 'goods_list[].price']: this.readString(goodsRow, 'price'),
          },
          amountRules,
        });
        const goodsListNotes = goodsList.length ? [] : ['merchant_warehouse_out.goods_list is missing or empty'];
        const mappingNotes = [
          ...ledgerType.notes,
          ...status.notes,
          ...quantity.notes,
          ...amount.notes,
          ...goodsListNotes,
        ];
        const mappingConfirmed =
          ledgerType.confirmed &&
          status.confirmed &&
          quantity.confirmed &&
          amount.confirmed &&
          goodsListNotes.length === 0;

        if (!mappingConfirmed) {
          unconfirmedRecords += 1;
        }

        const sourceId = goodsList.length ? `${rawRecord.sourceId}:${lineIndex + 1}` : rawRecord.sourceId;
        const sourceOrderNo =
          config.sourceOrderField && this.readString(rawRow, config.sourceOrderField)
            ? this.readString(rawRow, config.sourceOrderField)
            : rawRecord.sourceOrderNo;
        const normalizedPayload = {
          domain: AbcSyncTargetDomain.INVENTORY,
          recordType: 'inventory_ledger',
          sourceTable: input.target.sourceTable,
          rawTableName: input.target.rawTableName,
          lineIndex: goodsList.length ? lineIndex + 1 : null,
          ledgerType: {
            field: ledgerType.sourceField,
            raw: ledgerType.rawValue,
            standard: ledgerType.standardValue,
            confidenceLevel: ledgerType.confidenceLevel,
          },
          status: {
            field: status.sourceField,
            raw: status.rawValue,
            standard: status.standardValue,
            confidenceLevel: status.confidenceLevel,
          },
          quantity: {
            field: quantity.sourceField,
            raw: quantity.rawValue,
            standard: quantity.standardValue,
            unit: quantity.standardUnit,
            confidenceLevel: quantity.confidenceLevel,
          },
          amount: {
            field: amount.sourceField,
            raw: amount.rawValue,
            standard: amount.standardValue,
            unit: amount.standardUnit,
            confidenceLevel: amount.confidenceLevel,
          },
          sourceRefs: {
            merchantId: config.sourceMerchantIdField
              ? this.readString(rawRow, config.sourceMerchantIdField)
              : null,
            orderNo: sourceOrderNo,
            warehouseSourceId: this.readString(goodsRow, 'storeroom_id'),
            materialSourceId: this.readString(goodsRow, 'material_id'),
          },
          headerFields: {
            useName: this.readString(rawRow, 'use_name'),
            useRemark: this.readString(rawRow, 'use_remark'),
            remark: this.readString(rawRow, 'remark'),
            price: this.readString(rawRow, 'price'),
          },
          mappingConfirmed,
          mappingNotes,
        } as Record<string, unknown>;

        const existing = await this.abcSyncInventoryLedgerRepository.findOne({
          where: {
            sourceSystem: input.sourceSystemCode,
            sourceTable: input.target.sourceTable,
            sourceId,
          },
        });

        if (existing) {
          existing.sourceOrderNo = sourceOrderNo;
          existing.sourceUpdatedAt = rawRecord.sourceUpdatedAt;
          existing.rawRecordId = rawRecord.id;
          existing.rawTableName = input.target.rawTableName;
          existing.ledgerTypeStandard = ledgerType.standardValue;
          existing.statusField = status.sourceField;
          existing.statusRaw = status.rawValue;
          existing.statusStandard = status.standardValue;
          existing.quantityField = quantity.sourceField;
          existing.quantityRaw = quantity.rawValue;
          existing.quantityStandard = quantity.standardValue;
          existing.quantityUnit = quantity.standardUnit ?? null;
          existing.amountField = amount.sourceField;
          existing.amountRaw = amount.rawValue;
          existing.amountStandard = amount.standardValue;
          existing.amountUnit = amount.standardUnit ?? null;
          existing.warehouseSourceId = this.readString(goodsRow, 'storeroom_id');
          existing.materialSourceId = this.readString(goodsRow, 'material_id');
          existing.supplierSourceId = null;
          existing.sourceMerchantId = config.sourceMerchantIdField
            ? this.readString(rawRow, config.sourceMerchantIdField)
            : null;
          existing.mappingConfirmed = mappingConfirmed;
          existing.mappingNotes = mappingNotes.length ? mappingNotes.join(' | ') : null;
          existing.normalizedPayload = normalizedPayload;
          existing.syncedAt = input.syncedAt;
          existing.syncBatchNo = input.batchNo;
          await this.abcSyncInventoryLedgerRepository.save(existing);
          updatedRecords += 1;
        } else {
          const entity = this.abcSyncInventoryLedgerRepository.create({
            sourceSystem: input.sourceSystemCode,
            sourceTable: input.target.sourceTable,
            sourceId,
            sourceOrderNo,
            sourceUpdatedAt: rawRecord.sourceUpdatedAt,
            rawRecordId: rawRecord.id,
            rawTableName: input.target.rawTableName,
            ledgerTypeStandard: ledgerType.standardValue,
            statusField: status.sourceField,
            statusRaw: status.rawValue,
            statusStandard: status.standardValue,
            quantityField: quantity.sourceField,
            quantityRaw: quantity.rawValue,
            quantityStandard: quantity.standardValue,
            quantityUnit: quantity.standardUnit ?? null,
            amountField: amount.sourceField,
            amountRaw: amount.rawValue,
            amountStandard: amount.standardValue,
            amountUnit: amount.standardUnit ?? null,
            warehouseSourceId: this.readString(goodsRow, 'storeroom_id'),
            materialSourceId: this.readString(goodsRow, 'material_id'),
            supplierSourceId: null,
            sourceMerchantId: config.sourceMerchantIdField
              ? this.readString(rawRow, config.sourceMerchantIdField)
              : null,
            mappingConfirmed,
            mappingNotes: mappingNotes.length ? mappingNotes.join(' | ') : null,
            normalizedPayload,
            syncedAt: input.syncedAt,
            syncBatchNo: input.batchNo,
          });

          await this.abcSyncInventoryLedgerRepository.save(entity);
          createdRecords += 1;
        }
      }
    }

    return {
      targetDomain: input.target.targetDomain,
      sourceTable: input.target.sourceTable,
      rawTableName: input.target.rawTableName,
      targetTable: input.target.targetTable,
      totalRecords: rawRecords.length,
      createdRecords,
      updatedRecords,
      unconfirmedRecords,
      checkpointValue: this.resolveCheckpointValue(rawRecords),
    };
  }

  private async loadStatusMappings(sourceSystemCode: string, sourceTable: string) {
    const mappings = await this.abcStatusMappingRepository.find({
      where: {
        sourceSystem: sourceSystemCode,
        sourceTable,
        isActive: true,
      },
    });

    return new Map(
      mappings.map((item) => [
        `${item.sourceField}|${item.sourceValue}|${item.targetDomain}`,
        item,
      ]),
    );
  }

  private async loadAmountRules(sourceSystemCode: string, sourceTable: string) {
    const rules = await this.abcAmountRuleRepository.find({
      where: {
        sourceSystem: sourceSystemCode,
        sourceTable,
        isActive: true,
      },
    });

    return new Map(rules.map((item) => [item.amountField, item]));
  }

  private async loadMerchantAccountRefs(sourceSystemCode: string) {
    const records = await this.abcRawInventoryRepository.find({
      where: {
        sourceSystem: sourceSystemCode,
        sourceTable: 'merchant_account',
      },
      order: {
        id: 'ASC',
      },
    });

    return new Map(
      records.map((record) => [record.sourceId, record.rawPayload as RawRow]),
    );
  }

  private resolveMerchantAccountRef(
    merchantAccountRefs: Map<string, RawRow>,
    sourceMerchantId: string | null,
  ) {
    if (!sourceMerchantId) {
      return null;
    }

    const rawRow = merchantAccountRefs.get(sourceMerchantId);
    if (!rawRow) {
      return null;
    }

    return {
      id: sourceMerchantId,
      username: this.readString(rawRow, 'username'),
      name: this.readString(rawRow, 'name'),
      contacts: this.readString(rawRow, 'contacts'),
      mobile: this.readString(rawRow, 'mobile'),
      status: this.readString(rawRow, 'status'),
    };
  }

  private buildOrderSourceMeta(sourceTable: string, rawRow: RawRow) {
    if (sourceTable === 'goods_group_order') {
      return {
        goodsGroupId: this.readString(rawRow, 'goods_group_id'),
        packageName: this.readString(rawRow, 'name'),
        shoppingCardId: this.readString(rawRow, 'shopping_card_id'),
        shoppingCardMoney: this.readString(rawRow, 'shopping_card_money'),
        quantity: this.readString(rawRow, 'quantity'),
        sourceType: this.readString(rawRow, 'source_type'),
        relevanceOrderId: this.readString(rawRow, 'relevance_order_id'),
      };
    }

    return null;
  }

  private buildCardSourceMeta(sourceTable: string, rawRow: RawRow) {
    if (sourceTable === 'goods_group') {
      return {
        typeId: this.readString(rawRow, 'type_id'),
        quantity: this.readString(rawRow, 'quantity'),
        shoppingCardId: this.readString(rawRow, 'shopping_card_id'),
        shoppingCardMoney: this.readString(rawRow, 'shopping_card_money'),
        productOrigin: this.readString(rawRow, 'product_origin'),
      };
    }

    return null;
  }

  private buildCardLedgerSourceMeta(sourceTable: string, rawRow: RawRow) {
    if (sourceTable === 'user_shopping_card_recharge') {
      return {
        status: this.readString(rawRow, 'status'),
        wxOrderNum: this.readString(rawRow, 'wx_order_num'),
      };
    }

    if (sourceTable === 'user_shopping_card_money') {
      return {
        sourceType: this.readString(rawRow, 'source_type'),
        expireTime: this.readString(rawRow, 'expire_time'),
        remark: this.readString(rawRow, 'remark'),
      };
    }

    return null;
  }

  private resolveMappedValue(input: {
    sourceTable: string;
    sourceField: string;
    rawRow: RawRow;
    targetDomain: string;
    statusMappings: Map<string, AbcStatusMapping>;
  }): MappingResult {
    const rawValue = this.readString(input.rawRow, input.sourceField);

    if (!rawValue) {
      return {
        sourceField: input.sourceField,
        rawValue: null,
        standardValue: null,
        confidenceLevel: AbcMappingConfidence.INFERRED,
        notes: [`Missing ${input.sourceField} on ${input.sourceTable}`],
        confirmed: false,
      };
    }

    const key = `${input.sourceField}|${rawValue}|${input.targetDomain}`;
    const mapping = input.statusMappings.get(key);

    if (!mapping) {
      return {
        sourceField: input.sourceField,
        rawValue,
        standardValue: 'unknown',
        confidenceLevel: AbcMappingConfidence.INFERRED,
        notes: [`No ${input.targetDomain} mapping for ${input.sourceTable}.${input.sourceField}=${rawValue}`],
        confirmed: false,
      };
    }

    return {
      sourceField: input.sourceField,
      rawValue,
      standardValue: mapping.targetValue,
      confidenceLevel: mapping.confidenceLevel,
      notes:
        mapping.confidenceLevel === AbcMappingConfidence.DOCUMENTED || !mapping.notes
          ? []
          : [mapping.notes],
      confirmed: mapping.confidenceLevel === AbcMappingConfidence.DOCUMENTED,
    };
  }

  private normalizeAmount(input: {
    sourceTable: string;
    amountField: string;
    rawRow: RawRow;
    amountRules: Map<string, AbcAmountRule>;
  }): MappingResult {
    const rawValue = this.readString(input.rawRow, input.amountField);

    if (rawValue === null) {
      return {
        sourceField: input.amountField,
        rawValue: null,
        standardValue: null,
        confidenceLevel: AbcMappingConfidence.INFERRED,
        standardUnit: null,
        notes: [`Missing ${input.amountField} on ${input.sourceTable}`],
        confirmed: false,
      };
    }

    const amountRule = input.amountRules.get(input.amountField);

    if (!amountRule) {
      return {
        sourceField: input.amountField,
        rawValue,
        standardValue: rawValue,
        confidenceLevel: AbcMappingConfidence.INFERRED,
        standardUnit: 'unknown',
        notes: [`No amount rule for ${input.sourceTable}.${input.amountField}`],
        confirmed: false,
      };
    }

    const numericValue = Number(rawValue);

    if (Number.isNaN(numericValue)) {
      return {
        sourceField: input.amountField,
        rawValue,
        standardValue: null,
        confidenceLevel: amountRule.confidenceLevel,
        standardUnit: amountRule.standardUnit,
        notes: [`Amount field ${input.sourceTable}.${input.amountField} is not numeric`],
        confirmed: false,
      };
    }

    const standardValue = (numericValue * Number(amountRule.conversionRate)).toFixed(
      amountRule.standardScale,
    );

    return {
      sourceField: input.amountField,
      rawValue,
      standardValue,
      standardUnit: amountRule.standardUnit,
      confidenceLevel: amountRule.confidenceLevel,
      notes:
        amountRule.confidenceLevel === AbcMappingConfidence.DOCUMENTED || !amountRule.notes
          ? []
          : [amountRule.notes],
      confirmed: amountRule.confidenceLevel === AbcMappingConfidence.DOCUMENTED,
    };
  }

  private buildNotApplicableAmountResult(): MappingResult {
    return {
      sourceField: null,
      rawValue: null,
      standardValue: null,
      standardUnit: null,
      confidenceLevel: AbcMappingConfidence.DOCUMENTED,
      notes: [],
      confirmed: true,
    };
  }

  private buildDerivedStatusRawRow(rawRow: RawRow): RawRow {
    const deletedAt = this.readString(rawRow, 'deleted_at');

    return {
      ...rawRow,
      derived_status: deletedAt ? 'inactive' : 'active',
    };
  }

  private buildCardRawRow(rawRow: RawRow): RawRow {
    return this.buildDerivedStatusRawRow(rawRow);
  }

  private normalizeQuantityValue(input: {
    sourceTable: string;
    quantityField: string;
    rawValue: string | null;
    quantityUnit?: string | null;
  }): MappingResult {
    if (input.rawValue === null) {
      return {
        sourceField: input.quantityField,
        rawValue: null,
        standardValue: null,
        standardUnit: input.quantityUnit ?? 'unknown',
        confidenceLevel: AbcMappingConfidence.INFERRED,
        notes: [`Missing ${input.quantityField} on ${input.sourceTable}`],
        confirmed: false,
      };
    }

    const numericValue = Number(input.rawValue);

    if (Number.isNaN(numericValue)) {
      return {
        sourceField: input.quantityField,
        rawValue: input.rawValue,
        standardValue: null,
        standardUnit: input.quantityUnit ?? 'unknown',
        confidenceLevel: AbcMappingConfidence.INFERRED,
        notes: [`Quantity field ${input.sourceTable}.${input.quantityField} is not numeric`],
        confirmed: false,
      };
    }

    return {
      sourceField: input.quantityField,
      rawValue: input.rawValue,
      standardValue: numericValue.toFixed(2),
      standardUnit: input.quantityUnit ?? 'count',
      confidenceLevel: AbcMappingConfidence.DOCUMENTED,
      notes: [],
      confirmed: true,
    };
  }

  private resolveWarehouseName(rawRow: RawRow, field?: string) {
    const directName = field ? this.readString(rawRow, field) : null;
    const warehouseSourceId = this.readString(rawRow, 'storeroom_id');

    if (directName) {
      return {
        value: directName,
        notes: [] as string[],
        confirmed: true,
      };
    }

    if (warehouseSourceId) {
      return {
        value: `库房#${warehouseSourceId}`,
        notes: ['Warehouse name is inferred from storeroom_id because create_name is empty'],
        confirmed: false,
      };
    }

    return {
      value: null,
      notes: ['Warehouse source identifier is missing'],
      confirmed: false,
    };
  }

  private parseInventoryGoodsList(rawValue: string | null): RawRow[] {
    if (!rawValue) {
      return [];
    }

    const candidates = [rawValue, rawValue.replace(/\\"/g, '"')];

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);

        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item): item is RawRow => Boolean(item) && typeof item === 'object',
          );
        }

        if (typeof parsed === 'string') {
          const nested = JSON.parse(parsed);
          if (Array.isArray(nested)) {
            return nested.filter(
              (item): item is RawRow => Boolean(item) && typeof item === 'object',
            );
          }
        }
      } catch {
        // Keep trying the fallback candidate.
      }
    }

    return [];
  }

  private resolveCardLedgerType(
    sourceTable: string,
    config: CardLedgerTableConfig,
    rawRow: RawRow,
    statusMappings: Map<string, AbcStatusMapping>,
  ) {
    if (config.ledgerTypeConstant) {
      return {
        sourceField: null,
        rawValue: config.ledgerTypeConstant,
        standardValue: config.ledgerTypeConstant,
        confidenceLevel: AbcMappingConfidence.DOCUMENTED,
        notes: [],
        confirmed: true,
      };
    }

    if (!config.ledgerTypeField) {
      return {
        sourceField: null,
        rawValue: null,
        standardValue: 'unknown',
        confidenceLevel: AbcMappingConfidence.INFERRED,
        notes: [`Ledger type field is not configured for ${sourceTable}`],
        confirmed: false,
      };
    }

    return this.resolveMappedValue({
      sourceTable,
      sourceField: config.ledgerTypeField,
      rawRow,
      targetDomain: 'card_ledger_type',
      statusMappings,
    });
  }

  private resolveFundType(
    sourceTable: string,
    config: FundTableConfig,
    rawRow: RawRow,
    statusMappings: Map<string, AbcStatusMapping>,
  ) {
    if (config.fundTypeConstant) {
      return {
        sourceField: null,
        rawValue: config.fundTypeConstant,
        standardValue: config.fundTypeConstant,
        confidenceLevel: AbcMappingConfidence.DOCUMENTED,
        notes: [],
        confirmed: true,
      };
    }

    if (!config.fundTypeField) {
      return {
        sourceField: null,
        rawValue: null,
        standardValue: 'unknown',
        confidenceLevel: AbcMappingConfidence.INFERRED,
        notes: [`Fund type field is not configured for ${sourceTable}`],
        confirmed: false,
      };
    }

    return this.resolveMappedValue({
      sourceTable,
      sourceField: config.fundTypeField,
      rawRow,
      targetDomain: 'fund_type',
      statusMappings,
    });
  }

  private resolveDirection(fundTypeStandard: string | null) {
    if (fundTypeStandard === 'recharge') return 'in';
    if (fundTypeStandard === 'freeze') return 'hold';
    if (fundTypeStandard === 'unfreeze') return 'release';
    if (fundTypeStandard === 'payment') return 'out';
    if (fundTypeStandard === 'refund') return 'in';
    return 'unknown';
  }

  private resolveCheckpointValue(
    records: Array<{ sourceUpdatedAt: Date | null; sourceId: string }>,
  ): string | null {
    if (!records.length) {
      return null;
    }

    const maxUpdatedAt = records
      .map((record) => record.sourceUpdatedAt?.toISOString())
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);

    if (maxUpdatedAt) {
      return maxUpdatedAt;
    }

    return (
      records
        .map((record) => record.sourceId)
        .sort((left, right) => left.localeCompare(right, 'en'))
        .at(-1) ?? null
    );
  }

  private collectFields(rawRow: RawRow, fields: string[]) {
    return fields.reduce<Record<string, string | null>>((result, field) => {
      result[field] = this.readString(rawRow, field);
      return result;
    }, {});
  }

  private readString(rawRow: RawRow, field: string) {
    const value = rawRow[field];
    if (value === undefined || value === null || value === '') {
      return null;
    }
    return String(value);
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

  private toMappingExceptionItem(
    targetDomain: 'orders' | 'funds',
    record: AbcSyncOrder | AbcSyncFund,
  ): MappingExceptionItem {
    const exceptionTypes: string[] = [];
    const mappingNotes = record.mappingNotes?.trim() || null;
    const amountUnit = 'amountUnit' in record ? record.amountUnit : null;

    if (!record.mappingConfirmed) {
      exceptionTypes.push('mapping_confirmed_false');
    }

    if (!record.statusStandard || record.statusStandard === 'unknown') {
      exceptionTypes.push('missing_status_mapping');
    }

    if (!amountUnit || amountUnit === 'unknown') {
      exceptionTypes.push('missing_amount_rule');
    }

    if (mappingNotes) {
      exceptionTypes.push('mapping_notes_present');
    }

    return {
      targetDomain,
      id: record.id,
      sourceTable: record.sourceTable,
      sourceId: record.sourceId,
      sourceOrderNo: record.sourceOrderNo,
      statusStandard: record.statusStandard,
      mappingConfirmed: record.mappingConfirmed,
      mappingNotes,
      syncedAt: record.syncedAt,
      sourceUpdatedAt: record.sourceUpdatedAt,
      syncBatchNo: record.syncBatchNo,
      exceptionTypes: Array.from(new Set(exceptionTypes)),
      normalizedPayload: record.normalizedPayload ?? {},
    };
  }

  private toCardMappingExceptionItem(
    recordType: 'cards' | 'card_ledger',
    record: AbcSyncCard | AbcSyncCardLedger,
  ): CardMappingExceptionItem {
    const exceptionTypes: string[] = [];
    const mappingNotes = record.mappingNotes?.trim() || null;
    const amountField = record.amountField;
    const amountUnit = record.amountUnit;
    const statusStandard =
      'cardStatusStandard' in record ? record.cardStatusStandard : record.statusStandard;

    if (!record.mappingConfirmed) {
      exceptionTypes.push('mapping_confirmed_false');
    }

    if (!statusStandard || statusStandard === 'unknown') {
      exceptionTypes.push('missing_status_mapping');
    }

    if (amountField && (!amountUnit || amountUnit === 'unknown')) {
      exceptionTypes.push('missing_amount_rule');
    }

    if (mappingNotes) {
      exceptionTypes.push('mapping_notes_present');
    }

    return {
      recordType,
      id: record.id,
      sourceTable: record.sourceTable,
      sourceId: record.sourceId,
      sourceOrderNo: record.sourceOrderNo,
      statusStandard,
      mappingConfirmed: record.mappingConfirmed,
      mappingNotes,
      syncedAt: record.syncedAt,
      sourceUpdatedAt: record.sourceUpdatedAt,
      syncBatchNo: record.syncBatchNo,
      exceptionTypes: Array.from(new Set(exceptionTypes)),
      normalizedPayload: record.normalizedPayload ?? {},
    };
  }

  private toInventoryMappingExceptionItem(
    recordType: 'materials' | 'suppliers' | 'warehouses' | 'inventory_ledger',
    record:
      | AbcSyncMaterial
      | AbcSyncSupplier
      | AbcSyncWarehouse
      | AbcSyncInventoryLedger,
  ): InventoryMappingExceptionItem {
    const exceptionTypes: string[] = [];
    const mappingNotes = record.mappingNotes?.trim() || null;
    const amountField = 'amountField' in record ? record.amountField : null;
    const amountUnit = 'amountUnit' in record ? record.amountUnit : null;
    const statusStandard =
      'materialStatusStandard' in record
        ? record.materialStatusStandard
        : 'supplierStatusStandard' in record
          ? record.supplierStatusStandard
          : 'warehouseStatusStandard' in record
            ? record.warehouseStatusStandard
            : record.statusStandard;

    if (!record.mappingConfirmed) {
      exceptionTypes.push('mapping_confirmed_false');
    }

    if (!statusStandard || statusStandard === 'unknown') {
      exceptionTypes.push('missing_status_mapping');
    }

    if (amountField && (!amountUnit || amountUnit === 'unknown')) {
      exceptionTypes.push('missing_amount_rule');
    }

    if (mappingNotes) {
      exceptionTypes.push('mapping_notes_present');
    }

    return {
      recordType,
      id: record.id,
      sourceTable: record.sourceTable,
      sourceId: record.sourceId,
      sourceOrderNo: record.sourceOrderNo,
      statusStandard,
      mappingConfirmed: record.mappingConfirmed,
      mappingNotes,
      syncedAt: record.syncedAt,
      sourceUpdatedAt: record.sourceUpdatedAt,
      syncBatchNo: record.syncBatchNo,
      exceptionTypes: Array.from(new Set(exceptionTypes)),
      normalizedPayload: record.normalizedPayload ?? {},
    };
  }

  private sortMappingExceptions(
    items: MappingExceptionItem[],
    sortBy: QueryAbcSyncMappingExceptionsDto['sortBy'],
    sortOrder: SortDirection,
  ) {
    const direction = sortOrder === 'ASC' ? 1 : -1;

    return [...items].sort((left, right) => {
      const valueLeft = this.resolveExceptionSortValue(left, sortBy);
      const valueRight = this.resolveExceptionSortValue(right, sortBy);

      if (valueLeft === valueRight) return 0;
      if (valueLeft === null || valueLeft === undefined) return 1 * direction;
      if (valueRight === null || valueRight === undefined) return -1 * direction;
      if (valueLeft instanceof Date && valueRight instanceof Date) {
        return (valueLeft.getTime() - valueRight.getTime()) * direction;
      }
      return String(valueLeft).localeCompare(String(valueRight), 'en') * direction;
    });
  }

  private sortCardMappingExceptions(
    items: CardMappingExceptionItem[],
    sortBy: QueryAbcSyncCardMappingExceptionsDto['sortBy'],
    sortOrder: SortDirection,
  ) {
    const direction = sortOrder === 'ASC' ? 1 : -1;

    return [...items].sort((left, right) => {
      const valueLeft = this.resolveCardExceptionSortValue(left, sortBy);
      const valueRight = this.resolveCardExceptionSortValue(right, sortBy);

      if (valueLeft === valueRight) return 0;
      if (valueLeft === null || valueLeft === undefined) return 1 * direction;
      if (valueRight === null || valueRight === undefined) return -1 * direction;
      if (valueLeft instanceof Date && valueRight instanceof Date) {
        return (valueLeft.getTime() - valueRight.getTime()) * direction;
      }
      return String(valueLeft).localeCompare(String(valueRight), 'en') * direction;
    });
  }

  private sortInventoryMappingExceptions(
    items: InventoryMappingExceptionItem[],
    sortBy: QueryAbcSyncInventoryMappingExceptionsDto['sortBy'],
    sortOrder: SortDirection,
  ) {
    const direction = sortOrder === 'ASC' ? 1 : -1;

    return [...items].sort((left, right) => {
      const valueLeft = this.resolveInventoryExceptionSortValue(left, sortBy);
      const valueRight = this.resolveInventoryExceptionSortValue(right, sortBy);

      if (valueLeft === valueRight) return 0;
      if (valueLeft === null || valueLeft === undefined) return 1 * direction;
      if (valueRight === null || valueRight === undefined) return -1 * direction;
      if (valueLeft instanceof Date && valueRight instanceof Date) {
        return (valueLeft.getTime() - valueRight.getTime()) * direction;
      }
      return String(valueLeft).localeCompare(String(valueRight), 'en') * direction;
    });
  }

  private resolveExceptionSortValue(
    item: MappingExceptionItem,
    sortBy: QueryAbcSyncMappingExceptionsDto['sortBy'],
  ) {
    switch (sortBy) {
      case 'targetDomain':
        return item.targetDomain;
      case 'sourceTable':
        return item.sourceTable;
      case 'sourceOrderNo':
        return item.sourceOrderNo;
      case 'statusStandard':
        return item.statusStandard;
      case 'mappingConfirmed':
        return item.mappingConfirmed ? 1 : 0;
      case 'sourceUpdatedAt':
        return item.sourceUpdatedAt;
      case 'syncedAt':
      case 'updatedAt':
      default:
        return item.syncedAt;
    }
  }

  private resolveCardExceptionSortValue(
    item: CardMappingExceptionItem,
    sortBy: QueryAbcSyncCardMappingExceptionsDto['sortBy'],
  ) {
    switch (sortBy) {
      case 'recordType':
        return item.recordType;
      case 'sourceTable':
        return item.sourceTable;
      case 'sourceOrderNo':
        return item.sourceOrderNo;
      case 'statusStandard':
        return item.statusStandard;
      case 'mappingConfirmed':
        return item.mappingConfirmed ? 1 : 0;
      case 'sourceUpdatedAt':
        return item.sourceUpdatedAt;
      case 'syncedAt':
      case 'updatedAt':
      default:
        return item.syncedAt;
    }
  }

  private resolveInventoryExceptionSortValue(
    item: InventoryMappingExceptionItem,
    sortBy: QueryAbcSyncInventoryMappingExceptionsDto['sortBy'],
  ) {
    switch (sortBy) {
      case 'recordType':
        return item.recordType;
      case 'sourceTable':
        return item.sourceTable;
      case 'sourceOrderNo':
        return item.sourceOrderNo;
      case 'statusStandard':
        return item.statusStandard;
      case 'mappingConfirmed':
        return item.mappingConfirmed ? 1 : 0;
      case 'sourceUpdatedAt':
        return item.sourceUpdatedAt;
      case 'syncedAt':
      case 'updatedAt':
      default:
        return item.syncedAt;
    }
  }

  private buildCountItems<T>(items: T[], resolver: (item: T) => string) {
    const counts = new Map<string, number>();

    for (const item of items) {
      const key = resolver(item) || 'unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key, 'en'));
  }

  private sumDecimal(values: Array<string | number | null | undefined>) {
    const total = values.reduce<number>((sum, value) => {
      const numericValue = Number(value ?? 0);
      return Number.isNaN(numericValue) ? sum : sum + numericValue;
    }, 0);

    return total.toFixed(2);
  }

  private buildBatchNo(sourceSystemCode: string, sourceTable: string) {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');

    return `${sourceSystemCode}_${sourceTable}_${timestamp}`;
  }
}
