import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';

export function payableHold(code: string): never {
  throw new ConflictException(`[material_payable_${code}] 材料付款证据或可用余额不完整，保持阻断；不会执行付款`);
}

/** Decimal(12,2) cents, never floating-point or caller-driven rounding. */
export function payableCents(value: unknown, positive = true): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)) {
    throw new BadRequestException('[material_payable_money_invalid] 金额必须为最多两位小数的非负十进制数');
  }
  const [whole, part = ''] = value.split('.');
  const result = BigInt(whole) * 100n + BigInt(part.padEnd(2, '0'));
  if (positive && result <= 0n) throw new BadRequestException('[material_payable_money_positive] 金额必须大于零');
  return result;
}

export function payableMoney(value: unknown): string {
  const cents = payableCents(value);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

export function payableHash(value: unknown): string {
  const canonical = (item: any): any => {
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, canonical(item[key])]));
    }
    return item;
  };
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export function sourceContent(order: any, intent: any, companyId: number, evidenceHash: string) {
  return {
    schema: 'material_payable_source_v1', purchaseOrderId: order.id,
    paymentIntentId: intent.id, approvalRequestId: order.paymentApprovalRequestId,
    workOrderId: order.workOrderId, companyId, companyRef: order.companyRef,
    businessSectorRef: order.businessSectorRef, storeRef: order.storeRef,
    customerRef: order.customerRef, supplierId: order.supplierId,
    supplierName: order.supplierNameSnapshot, currency: intent.currency,
    approvedAmount: payableMoney(intent.approvedAmount), totalAmount: payableMoney(order.totalAmount),
    lineSnapshot: order.lineSnapshot, decisionIds: order.decisionIds,
    bankAccountRegistryId: intent.bankAccountRegistryId, evidenceHash,
  };
}

export function receiptContent(receipt: any) {
  return {
    schema: 'material_payment_receipt_v1',
    transactionIdentityHash: receipt.transaction_identity_hash,
    bankAccountRegistryId: receipt.bank_account_registry_id,
    registryAuthorityHash: receipt.registry_authority_hash,
    companyId: receipt.company_id, supplierId: receipt.supplier_id,
    currency: receipt.currency, amount: payableMoney(receipt.amount),
    paidAt: new Date(receipt.paid_at).toISOString(), evidenceHash: receipt.evidence_hash,
  };
}

export function installmentContent(item: any) {
  return {
    schema: 'material_payout_installment_v1', sourceId: item.source_id,
    receiptId: item.receipt_id, installmentRef: item.installment_ref,
    amount: payableMoney(item.amount), state: item.state, evidenceHash: item.evidence_hash,
  };
}

/** Paid is a subset of occupied; unknown and reserved are NOT spare capacity. */
export function checkPayableBalances(
  sourceItems: any[], receiptItems: any[], ceiling: string, receiptAmount: string,
  intent: { paidAmount: unknown; occupiedAmount: unknown; remainingAmount: unknown },
) {
  let occupied = 0n;
  let paid = 0n;
  const receipts = new Set<number>();
  for (const item of sourceItems) {
    if (!['reserved', 'unknown', 'verified'].includes(item.state)) payableHold('installment_state_invalid');
    const amount = payableCents(item.amount);
    occupied += amount;
    if (item.receipt_id != null) {
      if (receipts.has(item.receipt_id)) payableHold('duplicate_source_receipt');
      receipts.add(item.receipt_id);
    }
    if (item.state === 'verified') {
      if (!item.receipt_id) payableHold('verified_receipt_missing');
      paid += amount;
    }
  }
  const approved = payableCents(ceiling);
  if (occupied > approved) payableHold('source_overcommitted');
  if (receiptItems.reduce((sum, item) => sum + payableCents(item.amount), 0n) > payableCents(receiptAmount)) {
    payableHold('receipt_overallocated');
  }
  if (
    payableCents(intent.paidAmount, false) !== paid ||
    payableCents(intent.occupiedAmount, false) !== occupied ||
    payableCents(intent.remainingAmount, false) !== approved - occupied
  ) payableHold('intent_ledger_mismatch');
}
