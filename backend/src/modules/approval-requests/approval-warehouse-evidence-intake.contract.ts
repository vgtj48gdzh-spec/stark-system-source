export const APPROVAL_WAREHOUSE_EVIDENCE_CANDIDATE_TYPES = [
  'supplier_payment',
  'reimbursement',
  'payment_request',
] as const;

export type ApprovalWarehouseEvidenceCandidateType =
  (typeof APPROVAL_WAREHOUSE_EVIDENCE_CANDIDATE_TYPES)[number];

export const APPROVAL_WAREHOUSE_EVIDENCE_CANDIDATE_STATUSES = [
  'discovered',
  'evidence_ready',
  'owner_review_required',
] as const;

export type ApprovalWarehouseEvidenceCandidateStatus =
  (typeof APPROVAL_WAREHOUSE_EVIDENCE_CANDIDATE_STATUSES)[number];

export const APPROVAL_WAREHOUSE_EVIDENCE_SOURCE_ENTITY_TYPES = [
  'abc_sync_materials',
  'abc_sync_suppliers',
  'abc_sync_warehouses',
  'abc_sync_inventory_ledger',
  'warehouses',
  'material_stocks',
  'inventory_transactions',
  'work_order_materials',
  'work_orders',
] as const;

export type ApprovalWarehouseEvidenceSourceEntityType =
  (typeof APPROVAL_WAREHOUSE_EVIDENCE_SOURCE_ENTITY_TYPES)[number];

export interface ApprovalWarehouseEvidenceAbcMaterial {
  sourceSystem?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  materialName?: string | null;
  materialCode?: string | null;
  warningQuantityStandard?: string | number | null;
  storageAmountStandard?: string | number | null;
  saleAmountStandard?: string | number | null;
  quantityUnit?: string | null;
  supplierIdsRaw?: string | null;
  mappingConfirmed?: boolean | null;
}

export interface ApprovalWarehouseEvidenceAbcSupplier {
  sourceSystem?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  supplierName?: string | null;
  supplierStatusStandard?: string | null;
  mappingConfirmed?: boolean | null;
}

export interface ApprovalWarehouseEvidenceAbcWarehouse {
  sourceSystem?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  warehouseSourceId?: string | null;
  warehouseName?: string | null;
  warehouseStatusStandard?: string | null;
  quantityStandard?: string | number | null;
  amountStandard?: string | number | null;
  supplierSourceId?: string | null;
  materialSourceId?: string | null;
  mappingConfirmed?: boolean | null;
}

export interface ApprovalWarehouseEvidenceAbcInventoryLedger {
  sourceSystem?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  ledgerTypeStandard?: string | null;
  statusStandard?: string | null;
  quantityStandard?: string | number | null;
  amountStandard?: string | number | null;
  warehouseSourceId?: string | null;
  materialSourceId?: string | null;
  supplierSourceId?: string | null;
  mappingConfirmed?: boolean | null;
}

export interface ApprovalWarehouseEvidenceLocalWarehouse {
  id: number;
  warehouseNo?: string | null;
  name?: string | null;
  code?: string | null;
  status?: string | null;
}

export interface ApprovalWarehouseEvidenceLocalMaterial {
  id: number;
  materialNo?: string | null;
  name?: string | null;
  unit?: string | null;
  defaultSupplierId?: number | null;
  defaultUnitPrice?: string | number | null;
  warningQuantity?: string | number | null;
  status?: string | null;
}

export interface ApprovalWarehouseEvidenceLocalSupplier {
  id: number;
  supplierNo?: string | null;
  name?: string | null;
  status?: string | null;
}

export interface ApprovalWarehouseEvidenceLocalMaterialStock {
  id: number;
  warehouseId?: number | null;
  materialId?: number | null;
  currentQuantity?: string | number | null;
}

export interface ApprovalWarehouseEvidenceLocalInventoryTransaction {
  id: number;
  transactionNo?: string | null;
  transactionType?: string | null;
  warehouseId?: number | null;
  materialId?: number | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  totalPrice?: string | number | null;
  relatedWorkOrderId?: number | null;
  relatedPreparationId?: number | null;
  relatedWorkOrderMaterialId?: number | null;
}

export interface ApprovalWarehouseEvidenceLocalWorkOrderMaterial {
  id: number;
  workOrderId?: number | null;
  materialId?: number | null;
  warehouseId?: number | null;
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  totalPrice?: string | number | null;
  sourceType?: string | null;
}

export interface ApprovalWarehouseEvidenceLocalWorkOrder {
  id: number;
  workOrderNo?: string | null;
  title?: string | null;
  materialCostTotal?: string | number | null;
  status?: string | null;
}

export interface ApprovalWarehouseEvidenceIntakeInput {
  abcMaterials?: ApprovalWarehouseEvidenceAbcMaterial[];
  abcSuppliers?: ApprovalWarehouseEvidenceAbcSupplier[];
  abcWarehouses?: ApprovalWarehouseEvidenceAbcWarehouse[];
  abcInventoryLedger?: ApprovalWarehouseEvidenceAbcInventoryLedger[];
  warehouses?: ApprovalWarehouseEvidenceLocalWarehouse[];
  materials?: ApprovalWarehouseEvidenceLocalMaterial[];
  suppliers?: ApprovalWarehouseEvidenceLocalSupplier[];
  materialStocks?: ApprovalWarehouseEvidenceLocalMaterialStock[];
  inventoryTransactions?: ApprovalWarehouseEvidenceLocalInventoryTransaction[];
  workOrderMaterials?: ApprovalWarehouseEvidenceLocalWorkOrderMaterial[];
  workOrders?: ApprovalWarehouseEvidenceLocalWorkOrder[];
  options?: {
    maxCandidates?: number;
  };
}

export interface ApprovalWarehouseEvidenceSummary {
  warehouse: Record<string, unknown> | null;
  material: Record<string, unknown> | null;
  supplier: Record<string, unknown> | null;
  workOrder: Record<string, unknown> | null;
  inventory: Record<string, unknown> | null;
  sourceEvidence: string[];
}

export interface ApprovalWarehouseEvidenceCandidatePreview {
  candidateRef: string;
  candidateType: ApprovalWarehouseEvidenceCandidateType;
  sourceSystem: 'stark_abc_sync' | 'stark_inventory' | 'stark_work_order';
  sourceEntityType: ApprovalWarehouseEvidenceSourceEntityType;
  sourceRef: string;
  evidenceSummary: ApprovalWarehouseEvidenceSummary;
  amount: string | null;
  status: ApprovalWarehouseEvidenceCandidateStatus;
  requiredGuards: string[];
  redactionPolicy: 'metadata_only_no_raw_pii';
  auditPolicy: 'append_only_candidate_preview_audit_required';
  idempotencyKey: string;
  boundary: {
    previewOnly: true;
    oldAbcReadonly: true;
    writesOldAbc: false;
    writesStark: false;
    createsApprovalRequest: false;
    createsPaymentIntent: false;
    confirmsBankSms: false;
    createsSuggestedLink: false;
    mutatesVirtualLedger: false;
  };
}
