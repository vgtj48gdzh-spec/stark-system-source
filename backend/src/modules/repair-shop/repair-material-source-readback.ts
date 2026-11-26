import { centsToDecimal, decimalToCents, multiplyMoney } from '../../common/utils/decimal.util';
import type { ApprovalPaymentIntent } from '../approval-requests/entities/approval-payment-intent.entity';
import type { WorkOrderMaterial } from '../work-order-materials/entities/work-order-material.entity';
import type { FinanceCollectionOrder } from '../finance-reconciliation/entities/finance-collection-order.entity';
import { isCollectionOrderStrictlyConfirmed } from '../finance-reconciliation/collection-order-confirmation.contract';
import type { RepairGoodsReceipt, RepairProcurementAllocation, RepairProcurementDemand, RepairPurchaseOrder } from './entities/repair-shop-procurement.entities';
import { projectPaymentState } from './repair-shop-procurement.policy';

// Read models only. No amount from this file authorizes payment, contribution or payroll.
function amount(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  try {
    const cents = decimalToCents(value);
    return cents >= 0n ? centsToDecimal(cents) : null;
  } catch { return null; }
}

function positive(value: unknown): string | null {
  const result = amount(value);
  return result !== null && decimalToCents(result) > 0n ? result : null;
}

export function repairPurchasePaymentReadback(
  order: Pick<RepairPurchaseOrder, 'paymentIntentId' | 'paymentState' | 'totalAmount'>,
  intent: ApprovalPaymentIntent | undefined,
  bindingConsistent: boolean,
) {
  let state = !intent
    ? order.paymentIntentId ? 'evidence_unavailable' : 'not_bound'
    : !bindingConsistent ? 'binding_mismatch' : projectPaymentState(intent);
  // This GET loads the intent, not the receipt/source/installment authorities.
  // Preserve its reconciliation record without upgrading it to verified bank payment.
  if (state === 'confirmed_external_evidence') {
    state = positive(intent?.paidAmount) ? 'reconciliation_recorded' : 'evidence_unavailable';
  }
  return {
    state,
    purchaseTotal: amount(order.totalAmount),
    registeredPaidAmount: intent && bindingConsistent ? amount(intent.paidAmount) : null,
    verifiedPaidAmount: null,
    paymentVerification: 'not_performed' as const,
    // The current finance schema's occupiedAmount already includes paid amounts.
    // Never subtract paid a second time or present this balance as permission to pay.
    recordedRemainingAmount: intent && bindingConsistent ? amount(intent.remainingAmount) : null,
    readOnly: true as const,
    paymentAllowed: false as const,
  };
}

export type RepairPurchasePaymentReadback = ReturnType<typeof repairPurchasePaymentReadback>;

export function repairCollectionReadback(workOrderId: number, rows: FinanceCollectionOrder[], quoteTotal: unknown) {
  const requiredQuoteTotal = positive(quoteTotal);
  const seen = new Set<string>();
  const issues = new Set<string>();
  const evidenceRefs: string[] = [];
  let total = 0n;
  for (const row of rows) {
    if (row.workOrderId !== workOrderId) continue;
    if (row.status === 'refunded') issues.add('refund_requires_reconciliation');
    if (row.status !== 'completed') continue;
    if (!isCollectionOrderStrictlyConfirmed(row) || row.sourceType !== 'work_order' ||
      row.sourceId !== String(workOrderId) || row.businessType !== 'maintenance' ||
      row.paymentChannel !== 'bank_transfer' || row.paymentReceiptId != null || row.settlementBatchId != null) {
      issues.add('collection_authority_incomplete'); continue;
    }
    const identities = [['order', row.id], ['authority', row.formalConfirmationAuthorityId],
      ['bank', row.bankTransactionId], ['link', row.reconciliationLinkId]] as const;
    if (identities.some(([, id]) => !Number.isInteger(id) || Number(id) <= 0)) {
      issues.add('collection_identity_missing'); continue;
    }
    if (identities.some(([kind, id]) => seen.has(`${kind}:${id}`))) {
      issues.add('duplicate_collection_evidence'); continue;
    }
    const bankAmount = positive(row.bankReceivedAmount);
    const receiptAmount = positive(row.receiptAmount);
    if (!bankAmount || !receiptAmount || bankAmount !== receiptAmount) {
      issues.add('collection_amount_unverified'); continue;
    }
    identities.forEach(([kind, id]) => seen.add(`${kind}:${id}`));
    total += decimalToCents(bankAmount);
    evidenceRefs.push(`finance-collection-order:${row.id}`);
  }
  const amountKnown = issues.size === 0;
  return {
    ready: amountKnown && requiredQuoteTotal !== null && evidenceRefs.length > 0 && total >= decimalToCents(requiredQuoteTotal),
    confirmedAmount: amountKnown ? centsToDecimal(total) : null,
    requiredQuoteTotal,
    evidenceCount: evidenceRefs.length,
    evidenceRefs,
    issues: [...issues],
    readOnly: true as const,
    distributionAllowed: false as const,
  };
}

interface SourceInputs {
  workOrderId: number;
  materials: WorkOrderMaterial[];
  demands: RepairProcurementDemand[];
  orders: Array<Omit<RepairPurchaseOrder, 'paymentState'> & { paymentReadback: RepairPurchasePaymentReadback }>;
  receipts: RepairGoodsReceipt[];
  allocations: RepairProcurementAllocation[];
}

export function buildRepairMaterialSourceReadback(input: SourceInputs) {
  const active = input.allocations.filter((row) => row.workOrderId === input.workOrderId &&
    ['linked', 'installed'].includes(row.status));
  const exactlyOne = <T>(rows: T[]): T | undefined => rows.length === 1 ? rows[0] : undefined;
  return input.materials.filter((row) => row.workOrderId === input.workOrderId && !row.deletedAt).map((material) => {
    const allocations = active.filter((row) => row.workOrderMaterialId === material.id);
    const materialQuantity = positive(material.quantity);
    const allocationQuantities = allocations.map((row) => positive(row.quantity));
    const linkedQuantity = allocationQuantities.every((value) => value !== null)
      ? centsToDecimal(allocationQuantities.reduce((sum, value) => sum + decimalToCents(value!), 0n))
      : null;
    const quantityValid = materialQuantity !== null && linkedQuantity !== null &&
      decimalToCents(linkedQuantity) <= decimalToCents(materialQuantity);
    const sources = allocations.map((allocation) => {
      const receipt = exactlyOne(input.receipts.filter((row) => row.id === allocation.receiptId && row.workOrderId === input.workOrderId));
      const order = receipt && exactlyOne(input.orders.filter((row) => row.id === receipt.purchaseOrderId && row.workOrderId === input.workOrderId));
      const demand = exactlyOne(input.demands.filter((row) => row.id === allocation.demandId && row.workOrderId === input.workOrderId));
      const lines = Array.isArray(order?.lineSnapshot) ? order.lineSnapshot : [];
      const line = exactlyOne(lines.filter((row) => row && typeof row === 'object' && Number(row.demandId) === allocation.demandId));
      const receivedLines = Array.isArray(receipt?.inspectionSnapshot?.receivedLines)
        ? receipt.inspectionSnapshot.receivedLines as Array<Record<string, unknown>> : [];
      const receivedLine = exactlyOne(receivedLines.filter((row) => row && typeof row === 'object' && Number(row.demandId) === allocation.demandId && row.status === 'accepted'));
      const allocatedQuantity = positive(allocation.quantity);
      const purchaseQuantity = positive(line?.quantity);
      const receivedQuantity = positive(receivedLine?.quantity);
      const purchaseUnitPrice = amount(line?.unitPrice);
      const blockers: string[] = [];
      if (!quantityValid || !allocatedQuantity) blockers.push('material_quantity_invalid');
      if (!receipt || !['accepted', 'partial'].includes(receipt.status) || !receivedLine) blockers.push('receipt_not_accepted');
      if (!order || !['issued', 'partially_received', 'received'].includes(order.status)) blockers.push('purchase_not_issued');
      if (!demand || !line || !['ordered', 'fulfilled'].includes(demand.status)) blockers.push('demand_source_missing');
      if (allocation.materialId !== material.materialId || demand?.materialId !== material.materialId ||
        Number(line?.materialId) !== material.materialId || demand?.quoteLineRef !== line?.quoteLineRef) {
        blockers.push('material_source_mismatch');
      }
      if (!purchaseQuantity || !receivedQuantity || !allocatedQuantity ||
        decimalToCents(allocatedQuantity) > decimalToCents(purchaseQuantity) ||
        decimalToCents(allocatedQuantity) > decimalToCents(receivedQuantity)) blockers.push('source_quantity_invalid');
      if (!order || !Number.isInteger(order.supplierId) || order.supplierId <= 0 || !order.supplierNameSnapshot?.trim()) blockers.push('supplier_source_missing');
      if (purchaseUnitPrice === null) blockers.push('purchase_price_unknown');
      if (!allocation.linkEvidenceRef?.trim()) blockers.push('link_evidence_missing');
      const matched = blockers.length === 0;
      return {
        allocationId: allocation.id,
        state: matched ? 'source_linked' as const : 'source_incomplete' as const,
        blockers,
        purchaseOrderId: matched ? order!.id : null,
        purchaseOrderNo: matched ? order!.orderNo : null,
        supplierId: matched ? order!.supplierId : null,
        supplierName: matched ? order!.supplierNameSnapshot : null,
        receiptNo: matched ? receipt!.receiptNo : null,
        allocatedQuantity,
        purchaseUnitPrice: matched ? purchaseUnitPrice : null,
        purchaseReferenceAmount: matched ? multiplyMoney(allocatedQuantity!, purchaseUnitPrice!) : null,
        purchaseFreightAmount: matched ? amount(line!.freightAmount) : null,
        payment: matched ? order!.paymentReadback : null,
      };
    });
    return {
      workOrderMaterialId: material.id,
      materialId: material.materialId,
      materialName: material.material?.name ?? `材料 #${material.materialId}`,
      specification: material.material?.specification ?? null,
      unit: material.material?.unit ?? null,
      quantity: materialQuantity,
      linkedQuantity,
      linkState: !allocations.length ? 'unlinked' : quantityValid && sources.every((source) => source.state === 'source_linked')
        ? linkedQuantity === materialQuantity ? 'linked' : 'partially_linked' : 'incomplete',
      // Legacy caller-provided material prices and procurement quotes are not a verified cost authority.
      recordedMaterialAmount: amount(material.totalPrice),
      verifiedCostAmount: null,
      costState: 'verification_pending' as const,
      sources,
      paymentAllowed: false as const,
      distributionAllowed: false as const,
    };
  });
}
