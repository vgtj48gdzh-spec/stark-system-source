import {
  ApprovalWarehouseEvidenceAbcInventoryLedger,
  ApprovalWarehouseEvidenceCandidatePreview,
  ApprovalWarehouseEvidenceCandidateStatus,
  ApprovalWarehouseEvidenceCandidateType,
  ApprovalWarehouseEvidenceIntakeInput,
  ApprovalWarehouseEvidenceLocalInventoryTransaction,
  ApprovalWarehouseEvidenceLocalMaterial,
  ApprovalWarehouseEvidenceLocalMaterialStock,
  ApprovalWarehouseEvidenceLocalSupplier,
  ApprovalWarehouseEvidenceLocalWarehouse,
  ApprovalWarehouseEvidenceLocalWorkOrder,
  ApprovalWarehouseEvidenceLocalWorkOrderMaterial,
  ApprovalWarehouseEvidenceSourceEntityType,
  ApprovalWarehouseEvidenceSummary,
} from './approval-warehouse-evidence-intake.contract';

type PreviewSeed = {
  candidateType: ApprovalWarehouseEvidenceCandidateType;
  sourceSystem: ApprovalWarehouseEvidenceCandidatePreview['sourceSystem'];
  sourceEntityType: ApprovalWarehouseEvidenceSourceEntityType;
  sourceRef: string;
  amount: string | null;
  summary: ApprovalWarehouseEvidenceSummary;
  evidenceCompleteness: {
    amountPresent: boolean;
    warehouseOrMaterialPresent: boolean;
    supplierPresent: boolean;
    workOrderPresent: boolean;
  };
};

export class ApprovalWarehouseEvidenceIntakeService {
  buildCandidatePreviews(
    input: ApprovalWarehouseEvidenceIntakeInput,
  ): ApprovalWarehouseEvidenceCandidatePreview[] {
    const context = buildContext(input);
    const previews: ApprovalWarehouseEvidenceCandidatePreview[] = [];

    for (const supplier of input.abcSuppliers ?? []) {
      const sourceRef = safeSourceRef(supplier.sourceId, supplier.sourceTable, 'abc-supplier');
      previews.push(
        this.buildPreview({
          candidateType: 'supplier_payment',
          sourceSystem: 'stark_abc_sync',
          sourceEntityType: 'abc_sync_suppliers',
          sourceRef,
          amount: null,
          summary: {
            warehouse: null,
            material: null,
            supplier: {
              sourceRef,
              name: safeLabel(supplier.supplierName),
              status: safeLabel(supplier.supplierStatusStandard),
              mappingConfirmed: Boolean(supplier.mappingConfirmed),
            },
            workOrder: null,
            inventory: null,
            sourceEvidence: ['abc_sync_suppliers'],
          },
          evidenceCompleteness: {
            amountPresent: false,
            warehouseOrMaterialPresent: false,
            supplierPresent: true,
            workOrderPresent: false,
          },
        }),
      );
    }

    for (const material of input.abcMaterials ?? []) {
      const sourceRef = safeSourceRef(material.sourceId, material.sourceTable, 'abc-material');
      const amount =
        normalizeDecimal(material.storageAmountStandard) ?? normalizeDecimal(material.saleAmountStandard);
      previews.push(
        this.buildPreview({
          candidateType: 'payment_request',
          sourceSystem: 'stark_abc_sync',
          sourceEntityType: 'abc_sync_materials',
          sourceRef,
          amount,
          summary: {
            warehouse: null,
            material: {
              sourceRef,
              name: safeLabel(material.materialName),
              code: safeLabel(material.materialCode),
              quantityUnit: safeLabel(material.quantityUnit),
              warningQuantity: normalizeDecimal(material.warningQuantityStandard),
              mappingConfirmed: Boolean(material.mappingConfirmed),
            },
            supplier: material.supplierIdsRaw
              ? {
                  sourceRef: 'abc_sync_materials.supplier_ids_raw',
                  name: 'supplier_reference_present',
                  status: null,
                  mappingConfirmed: Boolean(material.mappingConfirmed),
                }
              : null,
            workOrder: null,
            inventory: {
              amountPolicy: amount
                ? 'abc_sync_material_amount_standard'
                : 'not_safely_derivable_from_material_only',
            },
            sourceEvidence: ['abc_sync_materials'],
          },
          evidenceCompleteness: {
            amountPresent: Boolean(amount),
            warehouseOrMaterialPresent: true,
            supplierPresent: Boolean(material.supplierIdsRaw),
            workOrderPresent: false,
          },
        }),
      );
    }

    for (const warehouse of input.abcWarehouses ?? []) {
      const supplier = stringKeyLookup(context.abcSuppliersBySourceId, warehouse.supplierSourceId);
      const material = stringKeyLookup(context.abcMaterialsBySourceId, warehouse.materialSourceId);
      const sourceRef = safeSourceRef(
        warehouse.warehouseSourceId ?? warehouse.sourceId,
        warehouse.sourceTable,
        'abc-warehouse',
      );
      previews.push(
        this.buildPreview({
          candidateType: supplier ? 'supplier_payment' : 'payment_request',
          sourceSystem: 'stark_abc_sync',
          sourceEntityType: 'abc_sync_warehouses',
          sourceRef,
          amount: normalizeDecimal(warehouse.amountStandard),
          summary: {
            warehouse: {
              sourceRef,
              name: safeLabel(warehouse.warehouseName),
              status: safeLabel(warehouse.warehouseStatusStandard),
              quantity: normalizeDecimal(warehouse.quantityStandard),
              amount: normalizeDecimal(warehouse.amountStandard),
              mappingConfirmed: Boolean(warehouse.mappingConfirmed),
            },
            material: material
              ? {
                  sourceRef: safeSourceRef(material.sourceId, material.sourceTable, 'abc-material'),
                  name: safeLabel(material.materialName),
                  code: safeLabel(material.materialCode),
                }
              : null,
            supplier: supplier
              ? {
                  sourceRef: safeSourceRef(supplier.sourceId, supplier.sourceTable, 'abc-supplier'),
                  name: safeLabel(supplier.supplierName),
                  status: safeLabel(supplier.supplierStatusStandard),
                }
              : null,
            workOrder: null,
            inventory: {
              amountPolicy: warehouse.amountStandard
                ? 'abc_sync_warehouse_amount_standard'
                : 'not_safely_derivable_from_warehouse_only',
            },
            sourceEvidence: [
              'abc_sync_warehouses',
              ...(material ? ['abc_sync_materials'] : []),
              ...(supplier ? ['abc_sync_suppliers'] : []),
            ],
          },
          evidenceCompleteness: {
            amountPresent: Boolean(normalizeDecimal(warehouse.amountStandard)),
            warehouseOrMaterialPresent: true,
            supplierPresent: Boolean(supplier),
            workOrderPresent: false,
          },
        }),
      );
    }

    for (const ledger of input.abcInventoryLedger ?? []) {
      previews.push(this.buildAbcInventoryLedgerPreview(ledger, context));
    }

    for (const warehouse of input.warehouses ?? []) {
      previews.push(
        this.buildPreview({
          candidateType: 'payment_request',
          sourceSystem: 'stark_inventory',
          sourceEntityType: 'warehouses',
          sourceRef: `warehouses:${warehouse.id}`,
          amount: null,
          summary: {
            warehouse: summarizeWarehouse(warehouse),
            material: null,
            supplier: null,
            workOrder: null,
            inventory: {
              amountPolicy: 'not_safely_derivable_from_warehouse_profile_only',
            },
            sourceEvidence: ['warehouses'],
          },
          evidenceCompleteness: {
            amountPresent: false,
            warehouseOrMaterialPresent: true,
            supplierPresent: false,
            workOrderPresent: false,
          },
        }),
      );
    }

    for (const transaction of input.inventoryTransactions ?? []) {
      previews.push(this.buildInventoryTransactionPreview(transaction, context));
    }

    for (const stock of input.materialStocks ?? []) {
      const material = numberKeyLookup(context.materialsById, stock.materialId);
      const warehouse = numberKeyLookup(context.warehousesById, stock.warehouseId);
      const amount = deriveMaterialStockAmount(stock, material);
      previews.push(
        this.buildPreview({
          candidateType: 'payment_request',
          sourceSystem: 'stark_inventory',
          sourceEntityType: 'material_stocks',
          sourceRef: `material_stocks:${stock.id}`,
          amount,
          summary: {
            warehouse: summarizeWarehouse(warehouse),
            material: summarizeMaterial(material, stock.currentQuantity),
            supplier: numberKeyLookup(context.suppliersById, material?.defaultSupplierId)
              ? summarizeSupplier(numberKeyLookup(context.suppliersById, material?.defaultSupplierId))
              : null,
            workOrder: null,
            inventory: {
              materialStockId: stock.id,
              currentQuantity: normalizeDecimal(stock.currentQuantity),
              amountPolicy: amount ? 'estimated_from_stock_and_default_unit_price' : 'not_safely_derivable',
            },
            sourceEvidence: ['material_stocks', 'materials', 'warehouses'],
          },
          evidenceCompleteness: {
            amountPresent: Boolean(amount),
            warehouseOrMaterialPresent: Boolean(warehouse || material),
            supplierPresent: Boolean(material?.defaultSupplierId),
            workOrderPresent: false,
          },
        }),
      );
    }

    for (const item of input.workOrderMaterials ?? []) {
      const material = numberKeyLookup(context.materialsById, item.materialId);
      const warehouse = numberKeyLookup(context.warehousesById, item.warehouseId);
      const workOrder = numberKeyLookup(context.workOrdersById, item.workOrderId);
      previews.push(
        this.buildPreview({
          candidateType: 'reimbursement',
          sourceSystem: 'stark_work_order',
          sourceEntityType: 'work_order_materials',
          sourceRef: `work_order_materials:${item.id}`,
          amount: normalizeDecimal(item.totalPrice),
          summary: {
            warehouse: summarizeWarehouse(warehouse),
            material: summarizeMaterial(material, item.quantity),
            supplier: numberKeyLookup(context.suppliersById, material?.defaultSupplierId)
              ? summarizeSupplier(numberKeyLookup(context.suppliersById, material?.defaultSupplierId))
              : null,
            workOrder: summarizeWorkOrder(workOrder),
            inventory: {
              workOrderMaterialId: item.id,
              sourceType: safeLabel(item.sourceType),
              quantity: normalizeDecimal(item.quantity),
              unitPrice: normalizeDecimal(item.unitPrice),
            },
            sourceEvidence: ['work_order_materials', 'work_orders', 'materials', 'warehouses'],
          },
          evidenceCompleteness: {
            amountPresent: Boolean(normalizeDecimal(item.totalPrice)),
            warehouseOrMaterialPresent: Boolean(warehouse || material),
            supplierPresent: Boolean(material?.defaultSupplierId),
            workOrderPresent: Boolean(workOrder),
          },
        }),
      );
    }

    for (const workOrder of input.workOrders ?? []) {
      previews.push(
        this.buildPreview({
          candidateType: 'reimbursement',
          sourceSystem: 'stark_work_order',
          sourceEntityType: 'work_orders',
          sourceRef: `work_orders:${workOrder.id}`,
          amount: normalizeDecimal(workOrder.materialCostTotal),
          summary: {
            warehouse: null,
            material: null,
            supplier: null,
            workOrder: summarizeWorkOrder(workOrder),
            inventory: {
              amountPolicy: workOrder.materialCostTotal
                ? 'work_order_material_cost_total'
                : 'not_safely_derivable_from_work_order_only',
            },
            sourceEvidence: ['work_orders'],
          },
          evidenceCompleteness: {
            amountPresent: Boolean(normalizeDecimal(workOrder.materialCostTotal)),
            warehouseOrMaterialPresent: false,
            supplierPresent: false,
            workOrderPresent: true,
          },
        }),
      );
    }

    return dedupeAndLimit(previews, input.options?.maxCandidates ?? 50);
  }

  private buildAbcInventoryLedgerPreview(
    ledger: ApprovalWarehouseEvidenceAbcInventoryLedger,
    context: IntakeContext,
  ) {
    const material = stringKeyLookup(context.abcMaterialsBySourceId, ledger.materialSourceId);
    const supplier = stringKeyLookup(context.abcSuppliersBySourceId, ledger.supplierSourceId);
    const warehouse = stringKeyLookup(context.abcWarehousesBySourceId, ledger.warehouseSourceId);
    const sourceRef = safeSourceRef(ledger.sourceId, ledger.sourceTable, 'abc-inventory-ledger');
    const amount = normalizeDecimal(ledger.amountStandard);
    const candidateType: ApprovalWarehouseEvidenceCandidateType = supplier
      ? 'supplier_payment'
      : amount
        ? 'payment_request'
        : 'reimbursement';

    return this.buildPreview({
      candidateType,
      sourceSystem: 'stark_abc_sync',
      sourceEntityType: 'abc_sync_inventory_ledger',
      sourceRef,
      amount,
      summary: {
        warehouse: warehouse
          ? {
              sourceRef: safeSourceRef(
                warehouse.warehouseSourceId ?? warehouse.sourceId,
                warehouse.sourceTable,
                'abc-warehouse',
              ),
              name: safeLabel(warehouse.warehouseName),
              status: safeLabel(warehouse.warehouseStatusStandard),
              quantity: normalizeDecimal(warehouse.quantityStandard),
              amount: normalizeDecimal(warehouse.amountStandard),
              mappingConfirmed: Boolean(warehouse.mappingConfirmed),
            }
          : null,
        material: material
          ? {
              sourceRef: safeSourceRef(material.sourceId, material.sourceTable, 'abc-material'),
              name: safeLabel(material.materialName),
              code: safeLabel(material.materialCode),
              quantityUnit: safeLabel(material.quantityUnit),
              mappingConfirmed: Boolean(material.mappingConfirmed),
            }
          : null,
        supplier: supplier
          ? {
              sourceRef: safeSourceRef(supplier.sourceId, supplier.sourceTable, 'abc-supplier'),
              name: safeLabel(supplier.supplierName),
              status: safeLabel(supplier.supplierStatusStandard),
              mappingConfirmed: Boolean(supplier.mappingConfirmed),
            }
          : null,
        workOrder: null,
        inventory: {
          sourceRef,
          ledgerType: safeLabel(ledger.ledgerTypeStandard),
          status: safeLabel(ledger.statusStandard),
          quantity: normalizeDecimal(ledger.quantityStandard),
          amount,
          mappingConfirmed: Boolean(ledger.mappingConfirmed),
        },
        sourceEvidence: [
          'abc_sync_inventory_ledger',
          ...(material ? ['abc_sync_materials'] : []),
          ...(supplier ? ['abc_sync_suppliers'] : []),
          ...(warehouse ? ['abc_sync_warehouses'] : []),
        ],
      },
      evidenceCompleteness: {
        amountPresent: Boolean(amount),
        warehouseOrMaterialPresent: Boolean(warehouse || material),
        supplierPresent: Boolean(supplier),
        workOrderPresent: false,
      },
    });
  }

  private buildInventoryTransactionPreview(
    transaction: ApprovalWarehouseEvidenceLocalInventoryTransaction,
    context: IntakeContext,
  ) {
    const material = numberKeyLookup(context.materialsById, transaction.materialId);
    const warehouse = numberKeyLookup(context.warehousesById, transaction.warehouseId);
    const workOrder = numberKeyLookup(context.workOrdersById, transaction.relatedWorkOrderId);
    const supplier = numberKeyLookup(context.suppliersById, material?.defaultSupplierId);
    const amount = normalizeDecimal(transaction.totalPrice);
    const candidateType: ApprovalWarehouseEvidenceCandidateType = transaction.relatedWorkOrderId
      ? 'reimbursement'
      : supplier
        ? 'supplier_payment'
        : 'payment_request';

    return this.buildPreview({
      candidateType,
      sourceSystem: 'stark_inventory',
      sourceEntityType: 'inventory_transactions',
      sourceRef: `inventory_transactions:${transaction.id}`,
      amount,
      summary: {
        warehouse: summarizeWarehouse(warehouse),
        material: summarizeMaterial(material, transaction.quantity),
        supplier: summarizeSupplier(supplier),
        workOrder: summarizeWorkOrder(workOrder),
        inventory: {
          inventoryTransactionId: transaction.id,
          transactionNo: safeLabel(transaction.transactionNo),
          transactionType: safeLabel(transaction.transactionType),
          quantity: normalizeDecimal(transaction.quantity),
          unitPrice: normalizeDecimal(transaction.unitPrice),
          relatedPreparationId: transaction.relatedPreparationId ?? null,
          relatedWorkOrderMaterialId: transaction.relatedWorkOrderMaterialId ?? null,
        },
        sourceEvidence: [
          'inventory_transactions',
          'warehouses',
          'materials',
          ...(supplier ? ['suppliers'] : []),
          ...(workOrder ? ['work_orders'] : []),
        ],
      },
      evidenceCompleteness: {
        amountPresent: Boolean(amount),
        warehouseOrMaterialPresent: Boolean(warehouse || material),
        supplierPresent: Boolean(supplier),
        workOrderPresent: Boolean(workOrder),
      },
    });
  }

  private buildPreview(seed: PreviewSeed): ApprovalWarehouseEvidenceCandidatePreview {
    const candidateRef = `APP-WH-${seed.candidateType}-${shortHash([
      seed.sourceSystem,
      seed.sourceEntityType,
      seed.sourceRef,
    ])}`;
    const status = deriveStatus(seed.candidateType, seed.evidenceCompleteness);
    const requiredGuards = requiredGuardsFor(seed.candidateType, status);
    const evidenceVersion = shortHash([
      seed.amount ?? '',
      status,
      stableSerialize(seed.summary),
      stableSerialize(requiredGuards),
    ]);

    return {
      candidateRef,
      candidateType: seed.candidateType,
      sourceSystem: seed.sourceSystem,
      sourceEntityType: seed.sourceEntityType,
      sourceRef: seed.sourceRef,
      evidenceSummary: seed.summary,
      amount: seed.amount,
      status,
      requiredGuards,
      redactionPolicy: 'metadata_only_no_raw_pii',
      auditPolicy: 'append_only_candidate_preview_audit_required',
      idempotencyKey: [
        'approval_warehouse_evidence_intake',
        seed.candidateType,
        seed.sourceSystem,
        seed.sourceEntityType,
        seed.sourceRef,
        `evidence_${evidenceVersion}`,
      ].join(':'),
      boundary: {
        previewOnly: true,
        oldAbcReadonly: true,
        writesOldAbc: false,
        writesStark: false,
        createsApprovalRequest: false,
        createsPaymentIntent: false,
        confirmsBankSms: false,
        createsSuggestedLink: false,
        mutatesVirtualLedger: false,
      },
    };
  }
}

type IntakeContext = ReturnType<typeof buildContext>;

function buildContext(input: ApprovalWarehouseEvidenceIntakeInput) {
  return {
    abcMaterialsBySourceId: mapBy(input.abcMaterials ?? [], (item) => item.sourceId),
    abcSuppliersBySourceId: mapBy(input.abcSuppliers ?? [], (item) => item.sourceId),
    abcWarehousesBySourceId: mapBy(input.abcWarehouses ?? [], (item) => item.warehouseSourceId ?? item.sourceId),
    warehousesById: mapBy(input.warehouses ?? [], (item) => item.id),
    materialsById: mapBy(input.materials ?? [], (item) => item.id),
    suppliersById: mapBy(input.suppliers ?? [], (item) => item.id),
    workOrdersById: mapBy(input.workOrders ?? [], (item) => item.id),
  };
}

function deriveStatus(
  candidateType: ApprovalWarehouseEvidenceCandidateType,
  evidence: PreviewSeed['evidenceCompleteness'],
): ApprovalWarehouseEvidenceCandidateStatus {
  if (!evidence.amountPresent) {
    return 'discovered';
  }

  if (candidateType === 'supplier_payment') {
    return evidence.supplierPresent && evidence.warehouseOrMaterialPresent
      ? 'evidence_ready'
      : 'owner_review_required';
  }

  if (candidateType === 'reimbursement') {
    return evidence.workOrderPresent && evidence.warehouseOrMaterialPresent
      ? 'evidence_ready'
      : 'owner_review_required';
  }

  return evidence.warehouseOrMaterialPresent ? 'evidence_ready' : 'owner_review_required';
}

function requiredGuardsFor(
  candidateType: ApprovalWarehouseEvidenceCandidateType,
  status: ApprovalWarehouseEvidenceCandidateStatus,
) {
  const common = [
    'source_authority_guard',
    'redaction_guard',
    'audit_guard',
    'idempotency_guard',
    'bank_confirmation_guard',
    'virtual_ledger_guard',
  ];
  const ownerReview = status === 'owner_review_required' ? ['owner_review_guard'] : [];

  if (candidateType === 'supplier_payment') {
    return [
      ...common,
      'supplier_identity_guard',
      'warehouse_material_guard',
      'supplier_invoice_guard',
      'amount_consistency_guard',
      'bank_account_registry_guard',
      ...ownerReview,
    ];
  }

  if (candidateType === 'reimbursement') {
    return [
      ...common,
      'work_order_guard',
      'warehouse_material_guard',
      'material_usage_guard',
      'amount_consistency_guard',
      ...ownerReview,
    ];
  }

  return [
    ...common,
    'warehouse_material_guard',
    'supplier_identity_guard',
    'amount_consistency_guard',
    'owner_review_guard',
  ];
}

function summarizeWarehouse(warehouse?: ApprovalWarehouseEvidenceLocalWarehouse) {
  if (!warehouse) {
    return null;
  }

  return {
    warehouseId: warehouse.id,
    warehouseNo: safeLabel(warehouse.warehouseNo),
    name: safeLabel(warehouse.name),
    code: safeLabel(warehouse.code),
    status: safeLabel(warehouse.status),
  };
}

function summarizeMaterial(
  material?: ApprovalWarehouseEvidenceLocalMaterial,
  quantity?: string | number | null,
) {
  if (!material) {
    return null;
  }

  return {
    materialId: material.id,
    materialNo: safeLabel(material.materialNo),
    name: safeLabel(material.name),
    unit: safeLabel(material.unit),
    quantity: normalizeDecimal(quantity),
    defaultUnitPrice: normalizeDecimal(material.defaultUnitPrice),
    warningQuantity: normalizeDecimal(material.warningQuantity),
    status: safeLabel(material.status),
  };
}

function summarizeSupplier(supplier?: ApprovalWarehouseEvidenceLocalSupplier) {
  if (!supplier) {
    return null;
  }

  return {
    supplierId: supplier.id,
    supplierNo: safeLabel(supplier.supplierNo),
    name: safeLabel(supplier.name),
    status: safeLabel(supplier.status),
  };
}

function summarizeWorkOrder(workOrder?: ApprovalWarehouseEvidenceLocalWorkOrder) {
  if (!workOrder) {
    return null;
  }

  return {
    workOrderId: workOrder.id,
    workOrderNo: safeLabel(workOrder.workOrderNo),
    title: safeLabel(workOrder.title),
    materialCostTotal: normalizeDecimal(workOrder.materialCostTotal),
    status: safeLabel(workOrder.status),
  };
}

function deriveMaterialStockAmount(
  stock: ApprovalWarehouseEvidenceLocalMaterialStock,
  material?: ApprovalWarehouseEvidenceLocalMaterial,
) {
  const quantity = numberValue(stock.currentQuantity);
  const unitPrice = numberValue(material?.defaultUnitPrice);
  if (quantity === null || unitPrice === null || quantity <= 0 || unitPrice <= 0) {
    return null;
  }

  return formatMoney(quantity * unitPrice);
}

function normalizeDecimal(value: string | number | null | undefined) {
  const numeric = numberValue(value);
  return numeric === null ? null : formatMoney(numeric);
}

function numberValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

const SAFE_TEXT_MAX_LENGTH = 80;
const MAINLAND_PHONE_PATTERN = /\b1[3-9]\d{9}\b/g;
const ACCOUNT_LIKE_NUMBER_PATTERN = /\b\d{16,19}\b/g;
const SECRET_MARKER_PATTERN = /BEGIN PRIVATE KEY|private\s+key|password|token|secret/gi;
const REDACTED_TEXT = '<redacted>';

function safeLabel(value: string | null | undefined) {
  return safeText(value);
}

function safeText(value: string | number | null | undefined, maxLength = SAFE_TEXT_MAX_LENGTH) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  const redacted = redactSensitiveText(normalized);
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength - 3)}...` : redacted;
}

function redactSensitiveText(value: string) {
  return value
    .replace(MAINLAND_PHONE_PATTERN, REDACTED_TEXT)
    .replace(ACCOUNT_LIKE_NUMBER_PATTERN, REDACTED_TEXT)
    .replace(SECRET_MARKER_PATTERN, REDACTED_TEXT);
}

function safeSourceRef(
  sourceId: string | number | null | undefined,
  sourceTable: string | null | undefined,
  fallback: string,
) {
  const rawId = sourceId === null || sourceId === undefined || sourceId === '' ? fallback : sourceId;
  const id = safeText(rawId) ?? safeText(fallback) ?? 'unknown-source';
  const table = safeText(sourceTable);
  return table ? `${table}:${id}` : id;
}

function mapBy<T, K extends string | number>(
  values: T[],
  getKey: (value: T) => K | null | undefined,
) {
  const mapped = new Map<K, T>();
  for (const value of values) {
    const key = getKey(value);
    if (key !== null && key !== undefined && key !== '') {
      mapped.set(key, value);
    }
  }
  return mapped;
}

function stringKeyLookup<T>(map: Map<string, T>, key: string | null | undefined) {
  return key ? map.get(key) : undefined;
}

function numberKeyLookup<T>(map: Map<number, T>, key: number | null | undefined) {
  return typeof key === 'number' ? map.get(key) : undefined;
}

function shortHash(parts: string[]) {
  const text = parts.join('|');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0');
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value) ?? 'undefined';
}

function dedupeAndLimit(
  previews: ApprovalWarehouseEvidenceCandidatePreview[],
  maxCandidates: number,
) {
  const seen = new Set<string>();
  const result: ApprovalWarehouseEvidenceCandidatePreview[] = [];
  for (const preview of previews) {
    if (seen.has(preview.idempotencyKey)) {
      continue;
    }
    seen.add(preview.idempotencyKey);
    result.push(preview);
    if (result.length >= maxCandidates) {
      break;
    }
  }

  return result;
}
