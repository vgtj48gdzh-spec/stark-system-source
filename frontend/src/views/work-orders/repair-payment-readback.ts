// Readback labels only. Neither old nor new intent status proves bank payment.
export function repairPaymentReadbackLabel(value: unknown): string {
  const labels: Record<string, string> = {
    not_bound: '未关联付款记录',
    evidence_unavailable: '付款证据不可用，待核对',
    binding_mismatch: '付款来源不一致，待核对',
    payment_planned: '付款已计划，实付待核对',
    reconciliation_pending: '已登记付款或部分付款，待核验',
    reconciliation_recorded: '已记录对账，实付待核验',
    // Compatibility with older GET responses during a staggered release.
    confirmed_external_evidence: '已记录对账，实付待核验',
    approval_pending: '审批或付款证据待补齐',
    restricted: '无权查看',
  };
  return typeof value === 'string' && Object.hasOwn(labels, value)
    ? labels[value] : '付款状态待核对';
}

type ReadbackObject = Record<string, unknown>;
type PaymentSnapshot = {
  state: string | null;
  purchaseTotal: string | null;
  registeredPaidAmount: string | null;
  recordedRemainingAmount: string | null;
};
export type PurchasePaymentReadbackGroup = {
  purchaseOrderId: number;
  purchaseOrderNo: string | null;
  supplierName: string | null;
  materialIds: number[];
  issue: 'incomplete' | 'conflict' | null;
  payment: PaymentSnapshot | null;
};

const object = (value: unknown): ReadbackObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ReadbackObject : null;
const id = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
const label = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;
const amount = (value: unknown): string | null =>
  typeof value === 'string' && /^(0|[1-9]\d*)\.\d{2}$/.test(value) ? value : null;
// Preserve differences without serializing arbitrary nested payloads or treating unknown as zero.
const signatureField = (value: unknown): string =>
  typeof value === 'string' ? 'string:' + value : typeof value === 'number' ? 'number:' + String(value)
    : value === null ? 'null' : value === undefined ? 'missing' : 'invalid:' + typeof value;

/**
 * Display projection of the existing scoped GET, NOT a payment/financial authority.
 * No summation: repeated purchase snapshots must agree exactly. Never group by names.
 * Legacy verifiedPaidAmount/paymentVerification fields are deliberately not consumed.
 */
export function groupRepairPurchasePaymentReadback(rows: unknown): {
  groups: PurchasePaymentReadbackGroup[]; unresolvedSourceCount: number;
} {
  type PendingGroup = { view: PurchasePaymentReadbackGroup; signature: string; materialIds: Set<number> };
  const groups = new Map<number, PendingGroup>();
  const allocations = new Map<number, { signature: string; group: PendingGroup }>();
  let unresolvedSourceCount = 0;
  for (const rowValue of Array.isArray(rows) ? rows : []) {
    const row = object(rowValue);
    for (const sourceValue of Array.isArray(row?.sources) ? row.sources : []) {
      const source = object(sourceValue), purchaseId = id(source?.purchaseOrderId);
      if (!source || source.state !== 'source_linked' || purchaseId === null) {
        unresolvedSourceCount++;
        continue;
      }
      const materialId = id(row?.workOrderMaterialId), allocationId = id(source.allocationId);
      const payment = object(source.payment);
      const complete = materialId !== null && allocationId !== null && id(source.supplierId) !== null
        && label(source.supplierName) !== null && label(source.purchaseOrderNo) !== null
        && payment !== null && payment.readOnly === true && payment.paymentAllowed === false;
      const signature = JSON.stringify([
        source.supplierId, source.supplierName, source.purchaseOrderNo,
        payment?.state, payment?.purchaseTotal, payment?.registeredPaidAmount, payment?.recordedRemainingAmount,
      ].map(signatureField));
      let group = groups.get(purchaseId);
      if (!group) {
        group = { signature, materialIds: new Set<number>(), view: {
          purchaseOrderId: purchaseId, purchaseOrderNo: label(source.purchaseOrderNo),
          supplierName: label(source.supplierName), materialIds: [], issue: complete ? null : 'incomplete',
          payment: payment ? {
            state: label(payment.state), purchaseTotal: amount(payment.purchaseTotal),
            registeredPaidAmount: amount(payment.registeredPaidAmount),
            recordedRemainingAmount: amount(payment.recordedRemainingAmount),
          } : null,
        } };
        groups.set(purchaseId, group);
      } else if (group.signature !== signature) {
        group.view.issue = 'conflict';
      } else if (!complete && group.view.issue === null) {
        group.view.issue = 'incomplete';
      }
      if (materialId !== null) group.materialIds.add(materialId);
      if (allocationId !== null) {
        const allocationSignature = JSON.stringify([
          purchaseId, materialId, source.receiptNo, source.allocatedQuantity,
          source.purchaseUnitPrice, source.purchaseReferenceAmount,
        ].map(signatureField));
        const prior = allocations.get(allocationId);
        if (prior && prior.signature !== allocationSignature) {
          prior.group.view.issue = 'conflict';
          group.view.issue = 'conflict';
        } else if (!prior) {
          allocations.set(allocationId, { signature: allocationSignature, group });
        }
      }
    }
  }
  return {
    groups: [...groups.values()].map(({ view, materialIds }) => ({
      ...view,
      // An ambiguous snapshot must not win by arrival order, maximum amount or summation.
      ...(view.issue ? { payment: null, purchaseOrderNo: null, supplierName: null } : {}),
      materialIds: [...materialIds].sort((a, b) => a - b),
    })).sort((a, b) => a.purchaseOrderId - b.purchaseOrderId),
    unresolvedSourceCount,
  };
}
