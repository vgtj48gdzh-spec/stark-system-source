import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  addMoney,
  addQuantity,
  compareMoney,
  compareQuantity,
  normalizeMoney,
  normalizeQuantity,
} from '../../common/utils/decimal.util';

const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeVin(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function assertVinFormat(value: string) {
  const vin = normalizeVin(value);
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    throw new BadRequestException('VIN 必须为 17 位且不能包含 I、O、Q');
  }
  return vin;
}

export function evaluateVinChecksum(value: string): 'valid' | 'invalid' | 'not_applicable' {
  const vin = assertVinFormat(value);
  let sum = 0;
  for (let index = 0; index < vin.length; index += 1) {
    if (index === 8) continue;
    const char = vin[index];
    const numeric = /\d/.test(char) ? Number(char) : VIN_TRANSLITERATION[char];
    if (!Number.isFinite(numeric)) return 'not_applicable';
    sum += numeric * VIN_WEIGHTS[index];
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? 'X' : String(remainder);
  return vin[8] === expected ? 'valid' : 'invalid';
}

const LOCKED_PROCUREMENT_DEMAND_STATUSES = new Set([
  'order_prepared',
  'ordered',
  'fulfilled',
  'cancelled',
]);

export function assertRepairProcurementDemandStillMutable(status: string, action: string) {
  if (LOCKED_PROCUREMENT_DEMAND_STATUSES.has(status)) {
    throw new BadRequestException(`报料已进入 ${status}，不能再${action}`);
  }
}

export interface RepairProcurementDocumentBindingInput {
  planItemRef: string;
  quoteLineRef: string;
  oeNumber: string;
  partName: string;
  quantity: string | number;
  materialId?: number | null;
}

export function assertRepairProcurementDocumentBinding(
  planPayload: unknown,
  quotePayload: unknown,
  input: RepairProcurementDocumentBindingInput,
) {
  const planItems = readPayloadRecords(planPayload, 'items', '维修方案');
  const quoteLines = readPayloadRecords(quotePayload, 'lineItems', '客户报价');
  const planMatches = planItems.filter((item) => item.itemRef === input.planItemRef.trim());
  const quoteMatches = quoteLines.filter((item) => item.lineRef === input.quoteLineRef.trim());
  if (planMatches.length !== 1 || quoteMatches.length !== 1) {
    throw new BadRequestException('报料必须唯一绑定已批准方案项目和报价行');
  }

  const planItem = planMatches[0];
  const quoteLine = quoteMatches[0];
  if (quoteLine.category !== 'part' || quoteLine.planItemRef !== planItem.itemRef) {
    throw new BadRequestException('报料报价行必须是与同一方案项目绑定的配件行');
  }

  const materialNeeds = planItem.materialNeeds;
  if (
    materialNeeds !== undefined &&
    (!Array.isArray(materialNeeds) || materialNeeds.some((item) => !item || typeof item !== 'object' || Array.isArray(item)))
  ) {
    throw new BadRequestException('维修方案项目的 materialNeeds 结构无效');
  }
  const directPlanPart = [planItem.oeNumber, planItem.partName, planItem.quantity]
    .some(isNonEmptyScalar)
    ? [planItem]
    : [];
  const planPartMatches = [
    ...directPlanPart,
    ...((materialNeeds as Array<Record<string, unknown>> | undefined) ?? []),
  ].filter((part) => partRecordMatches(part, input));
  if (planPartMatches.length !== 1) {
    throw new BadRequestException('报料配件必须唯一匹配方案项目中的明确材料需求');
  }
  if (!partRecordMatches(quoteLine, input)) {
    throw new BadRequestException('报料 OE 号、配件名称、数量及材料绑定必须与报价行一致');
  }

  return { planItem, planPart: planPartMatches[0], quoteLine };
}

function readPayloadRecords(payload: unknown, key: string, label: string): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as Record<string, unknown>)[key])) {
    throw new BadRequestException(`${label}缺少结构化 ${key}`);
  }
  const records = (payload as Record<string, unknown>)[key] as unknown[];
  if (records.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new BadRequestException(`${label}的 ${key} 结构无效`);
  }
  return records as Array<Record<string, unknown>>;
}

function isNonEmptyScalar(value: unknown): value is string | number {
  return (typeof value === 'string' && value.trim().length > 0) || typeof value === 'number';
}

function normalizeComparableText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN');
}

function partRecordMatches(record: Record<string, unknown>, input: RepairProcurementDocumentBindingInput) {
  if (
    !isNonEmptyScalar(record.oeNumber) ||
    !isNonEmptyScalar(record.partName) ||
    !isNonEmptyScalar(record.quantity) ||
    String(record.oeNumber).trim().toUpperCase() !== input.oeNumber.trim().toUpperCase() ||
    normalizeComparableText(record.partName) !== normalizeComparableText(input.partName)
  ) return false;
  try {
    if (compareQuantity(String(record.quantity), String(input.quantity)) !== 0) return false;
  } catch {
    return false;
  }
  if (!input.materialId) return true;
  return Number(record.materialId) === input.materialId;
}

export interface PriceQuoteInput {
  quoteId: number;
  supplierId: number;
  unitPrice: number;
  freightAmount: number;
  quantity: number;
  taxIncluded: boolean;
  leadTimeDays: number;
  returnable: boolean;
  warrantyMonths: number | null;
  supplierScore: number | null;
  sourceRef: string;
}

export interface ExternalPriceCandidate {
  sourceRef: string;
  provider: string;
  collectedAt: string;
  unitPrice: number;
  currency: string;
  licenseBasis: string;
}

export interface RepairProcurementLeaderApprovalBindingInput {
  workOrderId: number;
  demandId: number;
  selectedQuoteId: number;
  supplierId: number;
  planVersion: number;
  authorizedQuoteVersion: number;
  supplierQuoteVersion: number;
  quantity: string | number;
  unitPrice: string | number;
  freightAmount: string | number;
  totalAmount: string | number;
}

export function buildRepairProcurementLeaderApprovalBinding(
  input: RepairProcurementLeaderApprovalBindingInput,
) {
  for (const [label, value] of Object.entries({
    workOrderId: input.workOrderId,
    demandId: input.demandId,
    selectedQuoteId: input.selectedQuoteId,
    supplierId: input.supplierId,
    planVersion: input.planVersion,
    authorizedQuoteVersion: input.authorizedQuoteVersion,
    supplierQuoteVersion: input.supplierQuoteVersion,
  })) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`采购审批绑定字段 ${label} 无效`);
    }
  }
  const snapshot = {
    purpose: 'repair_procurement_decision',
    workOrderId: input.workOrderId,
    demandId: input.demandId,
    selectedQuoteId: input.selectedQuoteId,
    supplierId: input.supplierId,
    planVersion: input.planVersion,
    authorizedQuoteVersion: input.authorizedQuoteVersion,
    supplierQuoteVersion: input.supplierQuoteVersion,
    quantity: normalizeQuantity(input.quantity),
    unitPrice: normalizeMoney(input.unitPrice),
    freightAmount: normalizeMoney(input.freightAmount),
    totalAmount: normalizeMoney(input.totalAmount),
    currency: 'CNY',
  } as const;
  return {
    requestIdempotencyKey: `repair-procurement:${input.workOrderId}:${input.demandId}:${input.selectedQuoteId}`,
    requestFingerprint: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
    snapshot,
  };
}

export interface RepairProcurementPaymentIntentProjectionInput {
  idempotencyKey?: string | null;
  sourceType?: string | null;
  sourceRefType?: string | null;
  sourceRefId?: string | null;
  companyId?: number | null;
  businessUnit?: string | null;
  businessDomain?: string | null;
  responsiblePersonId?: number | null;
  bankAccountRegistryId?: number | null;
  accountBindingSource?: string | null;
  accountBindingStatus?: string | null;
  requestedAmount?: string | null;
  approvedAmount?: string | null;
  plannedPayAmount?: string | null;
  paidAmount?: string | null;
  occupiedAmount?: string | null;
  remainingAmount?: string | null;
  currency?: string | null;
  approvedAt?: Date | string | null;
  plannedPayAt?: Date | string | null;
  paidAt?: Date | string | null;
  statusChangedAt?: Date | string | null;
  intentStatus: string;
  readinessGate?: string | null;
  reconciliationStatus: string;
  confirmedLinkStatus: string;
  occupiedByReconciliation?: boolean;
  workOrderId?: number | null;
  supplierId?: number | null;
  approvalRequestId?: number | null;
  createdBy?: number | null;
  approvedBy?: number | null;
  plannedBy?: number | null;
  paidBy?: number | null;
}

export interface RepairProcurementPaymentOrderBindingInput {
  id: number;
  workOrderId: number;
  supplierId: number;
  paymentApprovalRequestId: number;
  companyRegistryId: number | null;
  businessSectorRef: string;
  totalAmount: string;
}

export function evaluateRepairProcurementPaymentIntentReadiness(
  intent: RepairProcurementPaymentIntentProjectionInput,
  order: RepairProcurementPaymentOrderBindingInput,
) {
  const blockers: string[] = [];
  const requirePositiveInteger = (value: unknown, blocker: string) => {
    if (!Number.isInteger(value) || Number(value) <= 0) blockers.push(blocker);
  };
  const validDate = (value: Date | string | null | undefined) => {
    const parsed = value instanceof Date ? value : value ? new Date(value) : null;
    return Boolean(parsed && !Number.isNaN(parsed.getTime()));
  };
  const moneyEquals = (value: string | null | undefined, expected: string) => {
    if (value === null || value === undefined) return false;
    try {
      return compareMoney(value, expected) === 0;
    } catch {
      return false;
    }
  };
  const moneyInRange = (value: string | null | undefined, upper: string) => {
    if (value === null || value === undefined) return false;
    try {
      return compareMoney(value, '0.00') >= 0 && compareMoney(value, upper) <= 0;
    } catch {
      return false;
    }
  };

  if (intent.workOrderId !== order.workOrderId) blockers.push('work_order_mismatch');
  if (intent.supplierId !== order.supplierId) blockers.push('supplier_mismatch');
  if (intent.approvalRequestId !== order.paymentApprovalRequestId) blockers.push('approval_mismatch');
  if (intent.currency !== 'CNY') blockers.push('currency_mismatch');
  if (order.companyRegistryId === null || intent.companyId !== order.companyRegistryId) {
    blockers.push('company_binding_mismatch');
  }
  if (intent.businessUnit !== order.businessSectorRef || intent.businessDomain !== 'repair_shop') {
    blockers.push('business_binding_mismatch');
  }
  if (
    intent.sourceType !== 'repair_purchase_order' ||
    intent.sourceRefType !== 'repair_purchase_order' ||
    intent.sourceRefId !== String(order.id)
  ) {
    blockers.push('source_binding_mismatch');
  }
  if (!intent.idempotencyKey?.trim()) blockers.push('idempotency_missing');
  if (!['verified', 'owner_confirmed'].includes(intent.accountBindingStatus ?? '')) {
    blockers.push('account_binding_not_confirmed');
  }
  requirePositiveInteger(intent.bankAccountRegistryId, 'bank_account_registry_missing');
  if (!intent.accountBindingSource?.trim()) blockers.push('account_binding_source_missing');
  if (intent.readinessGate !== 'ready_for_owner_approved_runtime_trial') {
    blockers.push('formal_runtime_readiness_missing');
  }
  if (!moneyEquals(intent.requestedAmount, order.totalAmount)) blockers.push('requested_amount_mismatch');
  if (
    ['approved', 'payment_planned', 'partially_paid', 'paid', 'reconciliation_pending', 'reconciliation_confirmed']
      .includes(intent.intentStatus) &&
    !moneyEquals(intent.approvedAmount, order.totalAmount)
  ) {
    blockers.push('approved_amount_mismatch');
  }
  if (
    ['payment_planned', 'partially_paid', 'paid', 'reconciliation_pending', 'reconciliation_confirmed']
      .includes(intent.intentStatus) &&
    !moneyEquals(intent.plannedPayAmount, order.totalAmount)
  ) {
    blockers.push('planned_pay_amount_mismatch');
  }
  if (!moneyInRange(intent.occupiedAmount, order.totalAmount)) blockers.push('occupied_amount_invalid');
  if (!moneyInRange(intent.remainingAmount, order.totalAmount)) blockers.push('remaining_amount_invalid');
  if (
    moneyInRange(intent.occupiedAmount, order.totalAmount) &&
    moneyInRange(intent.remainingAmount, order.totalAmount) &&
    compareMoney(addMoney(intent.occupiedAmount!, intent.remainingAmount!), order.totalAmount) !== 0
  ) {
    blockers.push('occupation_balance_mismatch');
  }
  if (intent.intentStatus === 'approved' || intent.intentStatus === 'payment_planned') {
    if (!moneyEquals(intent.occupiedAmount, '0.00') || !moneyEquals(intent.remainingAmount, order.totalAmount)) {
      blockers.push('prepayment_occupation_invalid');
    }
    if (intent.occupiedByReconciliation) blockers.push('premature_reconciliation_occupation');
  }
  if (!['approved', 'payment_planned', 'partially_paid', 'paid', 'reconciliation_pending', 'reconciliation_confirmed']
    .includes(intent.intentStatus)) {
    blockers.push('intent_status_not_payable');
  }
  requirePositiveInteger(intent.createdBy, 'creator_missing');
  requirePositiveInteger(intent.responsiblePersonId, 'responsible_person_missing');
  if (!validDate(intent.statusChangedAt)) blockers.push('status_changed_at_missing');
  if (['approved', 'payment_planned', 'partially_paid', 'paid', 'reconciliation_pending', 'reconciliation_confirmed']
    .includes(intent.intentStatus)) {
    requirePositiveInteger(intent.approvedBy, 'approver_missing');
    if (!validDate(intent.approvedAt)) blockers.push('approved_at_missing');
  }
  if (['payment_planned', 'partially_paid', 'paid', 'reconciliation_pending', 'reconciliation_confirmed']
    .includes(intent.intentStatus)) {
    requirePositiveInteger(intent.plannedBy, 'planner_missing');
    if (!validDate(intent.plannedPayAt)) blockers.push('planned_pay_at_missing');
  }
  if (['partially_paid', 'paid', 'reconciliation_pending', 'reconciliation_confirmed']
    .includes(intent.intentStatus)) {
    requirePositiveInteger(intent.paidBy, 'payer_missing');
    const paidAmountValid = intent.intentStatus === 'partially_paid'
      ? Boolean(
          intent.paidAmount &&
          compareMoney(intent.paidAmount, '0.00') > 0 &&
          compareMoney(intent.paidAmount, order.totalAmount) < 0
        )
      : moneyEquals(intent.paidAmount, order.totalAmount);
    if (!validDate(intent.paidAt) || !paidAmountValid) {
      blockers.push('paid_evidence_incomplete');
    }
    if (intent.paidAmount) {
      if (
        !moneyEquals(intent.occupiedAmount, intent.paidAmount) ||
        intent.occupiedByReconciliation !== true
      ) {
        blockers.push('paid_occupation_mismatch');
      }
    }
  }
  return { valid: blockers.length === 0, blockers };
}

export interface FormalStockInventoryTransactionInput {
  transactionType: string;
  entryKind: string;
  warehouseId: number;
  materialId: number;
  quantity: string;
  relatedWorkOrderId: number | null;
  relatedWorkOrderMaterialId: number | null;
  sourceTransactionId?: number | null;
}

export function evaluateFormalStockInventoryTransaction(
  transaction: FormalStockInventoryTransactionInput,
  binding: {
    warehouseId: number | null;
    materialId: number;
    workOrderId: number;
    workOrderMaterialId: number;
  },
) {
  const blockers: string[] = [];
  if (transaction.transactionType !== 'inbound') blockers.push('transaction_not_inbound');
  if (transaction.entryKind !== 'original') blockers.push('transaction_not_original');
  if (transaction.sourceTransactionId !== null && transaction.sourceTransactionId !== undefined) {
    blockers.push('source_transaction_present');
  }
  if (!binding.warehouseId || transaction.warehouseId !== binding.warehouseId) blockers.push('warehouse_mismatch');
  if (transaction.materialId !== binding.materialId) blockers.push('material_mismatch');
  if (transaction.relatedWorkOrderId !== binding.workOrderId) blockers.push('work_order_mismatch');
  if (transaction.relatedWorkOrderMaterialId !== binding.workOrderMaterialId) {
    blockers.push('work_order_material_mismatch');
  }
  try {
    if (compareQuantity(transaction.quantity, '0.00') <= 0) blockers.push('transaction_quantity_invalid');
  } catch {
    blockers.push('transaction_quantity_invalid');
  }
  return { valid: blockers.length === 0, blockers };
}

const CREDENTIAL_QUERY_KEYS = new Set([
  'token', 'accesstoken', 'refreshtoken', 'idtoken', 'securitytoken', 'sessiontoken',
  'secret', 'key', 'accesskey', 'secretkey', 'clientsecret', 'apikey', 'privatekey',
  'password', 'passwd', 'credential',
  'authorization', 'authorizationheader', 'signature', 'sig', 'signedurl',
  'xamzsignature', 'xamzcredential', 'xamzsecuritytoken',
]);

function canonicalCredentialKey(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isCredentialKey(value: string) {
  const canonical = canonicalCredentialKey(value);
  return CREDENTIAL_QUERY_KEYS.has(canonical) ||
    /(?:token|secret|password|passwd|credential|apikey|privatekey|signature|signedurl)$/.test(canonical);
}

function containsCredentialBearingText(value: string) {
  if (/(?:bearer|basic)\s+[a-z0-9._~+/=-]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/i.test(value)) return true;
  if (/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/.test(value)) return true;
  if (/(?:^|[?&\s;,])(?:access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|token|secret|password|signature|sig|x-amz-(?:signature|credential|security-token))\s*[=:]/i.test(value)) {
    return true;
  }
  const urls = value.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  return urls.some((candidate) => {
    try {
      const parsed = new URL(candidate);
      if (parsed.username || parsed.password) return true;
      return [...parsed.searchParams.keys()]
        .some((key) => isCredentialKey(key));
    } catch {
      return /[?&](?:access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|token|secret|password|signature|sig|x-amz-(?:signature|credential|security-token))=/i
        .test(candidate);
    }
  });
}

export function assertSafeRepairEvidenceRef(value: string, label: string) {
  const ref = value.trim();
  if (ref.length < 3 || containsCredentialBearingText(ref)) {
    throw new BadRequestException(`${label}必须是脱敏、不可携带密钥的证据引用`);
  }
  return ref;
}

export function assertSafeRepairEvidenceSnapshot(value: unknown, label: string) {
  if (value === undefined || value === null) return;
  const serialized = JSON.stringify(value);
  if (serialized.length > 50_000) throw new BadRequestException(`${label}不能超过 50000 个字符`);
  const visit = (item: unknown, depth: number): void => {
    if (depth > 12) throw new BadRequestException(`${label}嵌套层级过深`);
    if (typeof item === 'string') {
      if (containsCredentialBearingText(item)) {
        throw new BadRequestException(`${label}不得包含凭据、密钥或带密钥的链接`);
      }
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child) => visit(child, depth + 1));
      return;
    }
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
      if (isCredentialKey(key)) {
        throw new BadRequestException(`${label}不得包含凭据字段`);
      }
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
}

export function buildPriceReasonablenessSnapshot(input: {
  selectedQuoteId: number;
  quotes: PriceQuoteInput[];
  materialDefaultUnitPrice: number | null;
  historicalUnitPrices: number[];
  externalCandidates: ExternalPriceCandidate[];
}) {
  if (input.quotes.length < 1) throw new BadRequestException('至少需要一份供应商报价');
  const selected = input.quotes.find((quote) => quote.quoteId === input.selectedQuoteId);
  if (!selected) throw new BadRequestException('选中报价不属于当前报料需求');

  const normalizedTotals = input.quotes.map((quote) => ({
    ...quote,
    normalizedUnitCost:
      quote.quantity > 0
        ? roundMoney(quote.unitPrice + quote.freightAmount / quote.quantity)
        : Number.POSITIVE_INFINITY,
  }));
  const marketValues = [
    ...normalizedTotals.map((quote) => quote.normalizedUnitCost),
    ...input.historicalUnitPrices.filter((value) => Number.isFinite(value) && value >= 0),
    ...input.externalCandidates
      .filter((item) => item.currency === 'CNY')
      .map((item) => item.unitPrice)
      .filter((value) => Number.isFinite(value) && value >= 0),
    ...(input.materialDefaultUnitPrice === null ? [] : [input.materialDefaultUnitPrice]),
  ].sort((a, b) => a - b);
  const median = medianOf(marketValues);
  const selectedNormalized = normalizedTotals.find((quote) => quote.quoteId === selected.quoteId)!;
  const deviation = median > 0 ? (selectedNormalized.normalizedUnitCost - median) / median : 0;
  const riskFlags: string[] = [];
  if (deviation > 0.2) riskFlags.push('price_above_reference_20_percent');
  if (!selected.taxIncluded) riskFlags.push('tax_not_included');
  if (!selected.returnable) riskFlags.push('not_returnable');
  if ((selected.warrantyMonths ?? 0) < 3) riskFlags.push('short_or_missing_warranty');
  if (selected.leadTimeDays > 7) riskFlags.push('long_lead_time');
  if ((selected.supplierScore ?? 0) < 70) riskFlags.push('supplier_score_below_70');

  return {
    conclusion:
      deviation > 0.2 ? 'review_required' : deviation < -0.2 ? 'low_price_verify_quality' : 'within_reference_range',
    selectedQuoteId: selected.quoteId,
    selectedNormalizedUnitCost: selectedNormalized.normalizedUnitCost,
    referenceMedianUnitCost: roundMoney(median),
    deviationRatio: Number(deviation.toFixed(4)),
    quoteComparison: normalizedTotals,
    historicalSampleCount: input.historicalUnitPrices.length,
    externalCandidates: input.externalCandidates.map((item) => ({ ...item, evidenceClass: 'reference_only' })),
    riskFlags,
    requiresHumanReview: true,
    authorityBoundary: {
      aiMay: ['compare_prices', 'explain_risk', 'recommend_candidate'],
      aiMayNot: ['confirm_fitment', 'select_supplier', 'approve_payment', 'confirm_bank_evidence'],
    },
  };
}

export function projectPaymentState(intent: {
  intentStatus: string;
  reconciliationStatus: string;
  confirmedLinkStatus: string;
  confirmedBy?: number | null;
  reconciledAt?: Date | string | null;
  redactedEvidenceRef?: string | null;
}) {
  const reconciledAt = intent.reconciledAt instanceof Date
    ? intent.reconciledAt
    : intent.reconciledAt ? new Date(intent.reconciledAt) : null;
  if (
    intent.intentStatus === 'reconciliation_confirmed' &&
    intent.reconciliationStatus === 'confirmed' &&
    intent.confirmedLinkStatus === 'confirmed' &&
    Number.isInteger(intent.confirmedBy) &&
    Number(intent.confirmedBy) > 0 &&
    reconciledAt !== null &&
    !Number.isNaN(reconciledAt.getTime()) &&
    Boolean(intent.redactedEvidenceRef?.trim())
  ) {
    return 'confirmed_external_evidence' as const;
  }
  if (intent.intentStatus === 'payment_planned' || intent.intentStatus === 'approved') {
    return 'payment_planned' as const;
  }
  if (
    ['partially_paid', 'paid', 'reconciliation_pending'].includes(intent.intentStatus) ||
    ['candidate', 'suggested'].includes(intent.reconciliationStatus)
  ) {
    return 'reconciliation_pending' as const;
  }
  return 'approval_pending' as const;
}

export function addQuantityWithinLimit(
  existing: string | number,
  incoming: string | number,
  limit: string | number,
  label = '累计数量',
) {
  const cumulative = addQuantity(normalizeQuantity(existing), normalizeQuantity(incoming));
  if (compareQuantity(cumulative, normalizeQuantity(limit)) > 0) {
    throw new BadRequestException(`${label}不能超过授权数量`);
  }
  return cumulative;
}

export function isQuantityCovered(actual: string | number, required: string | number) {
  return compareQuantity(normalizeQuantity(actual), normalizeQuantity(required)) >= 0;
}

function medianOf(values: number[]) {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}
