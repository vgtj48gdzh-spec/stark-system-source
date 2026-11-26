import { createHash } from 'node:crypto';
import { normalizeMoney, normalizeQuantity } from '../../../common/utils/decimal.util';
import { InventoryMasterDataImportPreflightDto } from '../dto/inventory-master-data-import-preflight.dto';

export interface ExistingInventoryMasterDataSnapshot {
  warehouses: Array<{ id: number; code: string; name: string }>;
  suppliers: Array<{ id: number; name: string }>;
  materials: Array<{
    id: number;
    name: string;
    specification: string | null;
    unit: string;
  }>;
}

export interface PreflightIssue {
  code: string;
  scope: string;
  sourceRef?: string;
}

function normalizedText(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function addDuplicateIssues(
  rows: Array<{ sourceRef: string }>,
  scope: string,
  issues: PreflightIssue[],
) {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = normalizedText(row.sourceRef);
    if (seen.has(key)) {
      issues.push({ code: 'duplicate_source_ref', scope, sourceRef: row.sourceRef });
    }
    seen.add(key);
  }
}

function stableSort<T extends Record<string, unknown>>(rows: T[]) {
  return [...rows].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

export function assessInventoryMasterDataImportPreflight(
  input: InventoryMasterDataImportPreflightDto,
  existing: ExistingInventoryMasterDataSnapshot,
) {
  const blockers: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];

  const inputRowCount =
    input.warehouses.length +
    input.suppliers.length +
    input.materials.length +
    input.openingStocks.length;
  if (inputRowCount === 0) {
    blockers.push({ code: 'empty_import_payload', scope: 'request' });
  }

  addDuplicateIssues(input.warehouses, 'warehouses', blockers);
  addDuplicateIssues(input.suppliers, 'suppliers', blockers);
  addDuplicateIssues(input.materials, 'materials', blockers);

  const warehouseRefs = new Set(input.warehouses.map((item) => normalizedText(item.sourceRef)));
  const supplierRefs = new Set(input.suppliers.map((item) => normalizedText(item.sourceRef)));
  const materialRefs = new Set(input.materials.map((item) => normalizedText(item.sourceRef)));
  const existingWarehouseCodes = new Set(existing.warehouses.map((item) => normalizedText(item.code)));
  const existingSupplierNames = new Set(existing.suppliers.map((item) => normalizedText(item.name)));
  const existingMaterialKeys = new Set(
    existing.materials.map((item) =>
      [item.name, item.specification ?? '', item.unit].map(normalizedText).join('|'),
    ),
  );

  for (const warehouse of input.warehouses) {
    if (existingWarehouseCodes.has(normalizedText(warehouse.code))) {
      blockers.push({
        code: 'warehouse_code_already_exists',
        scope: 'warehouses',
        sourceRef: warehouse.sourceRef,
      });
    }
  }

  for (const supplier of input.suppliers) {
    if (existingSupplierNames.has(normalizedText(supplier.name))) {
      warnings.push({
        code: 'supplier_name_possible_match',
        scope: 'suppliers',
        sourceRef: supplier.sourceRef,
      });
    }
  }

  for (const material of input.materials) {
    if (
      material.defaultSupplierRef &&
      !supplierRefs.has(normalizedText(material.defaultSupplierRef))
    ) {
      blockers.push({
        code: 'default_supplier_ref_missing',
        scope: 'materials',
        sourceRef: material.sourceRef,
      });
    }
    const materialKey = [material.name, material.specification ?? '', material.unit]
      .map(normalizedText)
      .join('|');
    if (existingMaterialKeys.has(materialKey)) {
      warnings.push({
        code: 'material_possible_match',
        scope: 'materials',
        sourceRef: material.sourceRef,
      });
    }
  }

  const openingStockKeys = new Set<string>();
  const normalizedOpeningStocks = input.openingStocks.map((stock) => {
    const key = `${normalizedText(stock.warehouseRef)}|${normalizedText(stock.materialRef)}`;
    if (openingStockKeys.has(key)) {
      blockers.push({ code: 'duplicate_opening_stock_pair', scope: 'openingStocks' });
    }
    openingStockKeys.add(key);
    if (!warehouseRefs.has(normalizedText(stock.warehouseRef))) {
      blockers.push({ code: 'opening_stock_warehouse_ref_missing', scope: 'openingStocks' });
    }
    if (!materialRefs.has(normalizedText(stock.materialRef))) {
      blockers.push({ code: 'opening_stock_material_ref_missing', scope: 'openingStocks' });
    }

    const quantity = normalizeQuantity(stock.quantity);
    const unitPrice = normalizeMoney(stock.unitPrice);
    if (quantity === '0.00') {
      blockers.push({ code: 'opening_stock_quantity_must_be_positive', scope: 'openingStocks' });
    }

    return {
      warehouseRef: normalizedText(stock.warehouseRef),
      materialRef: normalizedText(stock.materialRef),
      quantity,
      unitPrice,
    };
  });

  const fingerprintInput = {
    warehouses: stableSort(
      input.warehouses.map((item) => ({
        sourceRef: normalizedText(item.sourceRef),
        code: normalizedText(item.code),
        name: normalizedText(item.name),
      })),
    ),
    suppliers: stableSort(
      input.suppliers.map((item) => ({
        sourceRef: normalizedText(item.sourceRef),
        name: normalizedText(item.name),
      })),
    ),
    materials: stableSort(
      input.materials.map((item) => ({
        sourceRef: normalizedText(item.sourceRef),
        name: normalizedText(item.name),
        specification: normalizedText(item.specification),
        unit: normalizedText(item.unit),
        defaultSupplierRef: normalizedText(item.defaultSupplierRef),
      })),
    ),
    openingStocks: stableSort(normalizedOpeningStocks),
  };

  return {
    status:
      blockers.length === 0 && warnings.length === 0
        ? ('ready' as const)
        : ('blocked' as const),
    previewOnly: true,
    databaseWriteCount: 0,
    importExecuted: false,
    inputFingerprint: createHash('sha256')
      .update(JSON.stringify(fingerprintInput))
      .digest('hex'),
    counts: {
      warehouses: input.warehouses.length,
      suppliers: input.suppliers.length,
      materials: input.materials.length,
      openingStocks: input.openingStocks.length,
    },
    blockers,
    warnings,
  };
}
