import { createHash } from 'node:crypto';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { RepairWorkOrderProfile } from '../repair-shop/entities/repair-shop.entities';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { assertPositiveCents, decimalToCents } from '../../common/utils/decimal.util';
import {
  capturedRegistryConfirmationAnchor,
  isValidAuthorityRegistryAnchor,
  type RegistryConfirmationAnchor,
} from '../finance-bank-account/bank-account-registry-authority.contract';
import { FinanceCollectionOrder } from './entities/finance-collection-order.entity';
import { FinanceCollectionConfirmationAuthority } from './entities/finance-collection-confirmation-authority.entity';
import { FinanceReconciliationLink } from './entities/finance-reconciliation-link.entity';

export const SOURCE_MODE_BANK_TRANSFER_ONE_TO_ONE_V1 = 'bank_transfer_one_to_one_v1';

/**
 * Single shared strict confirmation predicate used by finance, repair and the
 * group contribution resolver. It requires the five terminal facts AND a valid
 * typed formal authority id, so a legacy hand-written terminal row without an
 * authority row can never pass.
 */
export function isCollectionOrderStrictlyConfirmed(order: FinanceCollectionOrder): boolean {
  return (
    order.status === 'completed' &&
    order.evidenceStatus === 'confirmed' &&
    order.reconcileStatus === 'confirmed' &&
    Number.isInteger(Number(order.confirmedBy)) &&
    Number(order.confirmedBy) > 0 &&
    order.confirmedAt instanceof Date &&
    !Number.isNaN(order.confirmedAt.getTime()) &&
    Number.isInteger(order.formalConfirmationAuthorityId) &&
    Number(order.formalConfirmationAuthorityId) > 0
  );
}

export type CollectionOrderConfirmationBlockerCode =
  | 'already_confirmed'
  | 'unsupported_authority_mode'
  | 'missing_work_order_source'
  | 'missing_bank_transaction'
  | 'missing_reconciliation_link'
  | 'cancelled_or_refunded'
  | 'unreachable_prestate';

export interface CollectionOrderConfirmationBlocker {
  code: CollectionOrderConfirmationBlockerCode;
  message: string;
}

/**
 * Order-level blockers derivable without loading external source rows.
 * Source-level (bank/link/work-order) validation happens in the service and
 * fails closed before any authority insert.
 */
export function collectionOrderConfirmationBlockers(
  order: FinanceCollectionOrder,
): CollectionOrderConfirmationBlocker[] {
  const blockers: CollectionOrderConfirmationBlocker[] = [];

  if (order.status === 'cancelled' || order.status === 'refunded') {
    blockers.push({ code: 'cancelled_or_refunded', message: 'collection order is cancelled or refunded' });
  }

  // Reachable prestate for the one-to-one direct bank transfer path. The
  // already-confirmed idempotency branch is handled by the service BEFORE this
  // function, so a same-authority replay returns zero-write rather than being
  // blocked here.
  const reachableStatus = order.status === 'bank_matched' || order.status === 'completed_candidate';
  const reachableEvidence =
    order.evidenceStatus === 'bank_only' || order.evidenceStatus === 'matched_pending_confirmation';
  const reachableReconcile =
    order.reconcileStatus === 'matched' || order.reconcileStatus === 'partially_matched';
  if (!reachableStatus || !reachableEvidence || !reachableReconcile) {
    blockers.push({
      code: 'unreachable_prestate',
      message: 'collection order is not in the reachable direct-bank matched prestate',
    });
  }

  const isBankTransfer =
    order.paymentChannel === 'bank_transfer' &&
    order.sourceType === 'work_order' &&
    order.businessType === 'maintenance' &&
    order.sourceId != null &&
    order.sourceId === String(order.workOrderId) &&
    order.paymentReceiptId == null &&
    order.settlementBatchId == null;
  if (!isBankTransfer) {
    blockers.push({
      code: 'unsupported_authority_mode',
      message: 'only bank_transfer_one_to_one_v1 repair maintenance work_order is supported',
    });
  }

  if (!order.workOrderId) {
    blockers.push({ code: 'missing_work_order_source', message: 'missing work order source' });
  }
  if (!order.bankTransactionId) {
    blockers.push({ code: 'missing_bank_transaction', message: 'missing bank transaction evidence' });
  }
  if (!order.reconciliationLinkId) {
    blockers.push({ code: 'missing_reconciliation_link', message: 'missing reconciliation link evidence' });
  }

  return blockers;
}

export interface ConfirmationSourceFacts {
  order: FinanceCollectionOrder;
  bank: BankSmsTransaction;
  link: FinanceReconciliationLink;
  workOrder: WorkOrder;
  profile: RepairWorkOrderProfile;
  registry: RegistryConfirmationAnchor;
}

/**
 * Canonical fingerprint derived strictly from the real source rows (never from
 * caller amount/time/source-id). It binds all formal source facts plus the
 * integer-cent amounts (gross = net, fee = 0).
 */
export function collectionOrderConfirmationFingerprint(
  input: ConfirmationSourceFacts,
  capturedProfileScopeVersion = input.profile.version,
): string {
  const grossCents = assertPositiveCents(input.bank.amount, 'bank.amount');
  const linkCents = decimalToCents(input.link.confirmedAmount, 'link.confirmedAmount');
  if (!Number.isInteger(capturedProfileScopeVersion) || capturedProfileScopeVersion <= 0) {
    throw new Error('capturedProfileScopeVersion must be a positive integer');
  }
  const snapshot = {
    object: 'finance_collection_confirmation_authority',
    source_mode: SOURCE_MODE_BANK_TRANSFER_ONE_TO_ONE_V1,
    source_version: 'v1',
    currency: 'CNY',
    gross_cents: grossCents.toString(),
    net_cents: grossCents.toString(),
    fee_cents: '0',
    collection: {
      id: input.order.id,
      collectionNo: input.order.collectionNo,
      companyId: input.order.companyId,
      sourceType: input.order.sourceType,
      sourceId: input.order.sourceId,
      businessType: input.order.businessType,
      paymentChannel: input.order.paymentChannel,
    },
    bank: {
      id: input.bank.id,
      rawSmsId: input.bank.rawSmsId,
      fingerprint: input.bank.fingerprint,
      companyId: input.bank.companyId,
      bankName: input.bank.bankName,
      sender: input.bank.sender,
      accountTail: input.bank.accountTail,
      direction: input.bank.direction,
      amountCents: grossCents.toString(),
      reconcileStatus: input.bank.reconcileStatus,
      parserPolicyVersion: input.bank.parserPolicyVersion,
      promotionPolicyVersion: input.bank.promotionPolicyVersion,
      promotionAdmissionKey: input.bank.promotionAdmissionKey,
      promotionEvidenceFingerprint: input.bank.promotionEvidenceFingerprint,
      promotionDecisionFingerprint: input.bank.promotionDecisionFingerprint,
      bankBusinessDate: input.bank.bankBusinessDate?.toISOString() ?? null,
    },
    link: {
      id: input.link.id,
      linkType: input.link.linkType,
      linkId: input.link.linkId,
      status: input.link.status,
      confirmedAmountCents: linkCents.toString(),
      confirmedBy: input.link.confirmedBy,
      confirmedAt: input.link.confirmedAt?.toISOString() ?? null,
    },
    workOrder: {
      id: input.workOrder.id,
      workOrderNo: input.workOrder.workOrderNo,
    },
    profile: {
      companyRef: input.profile.companyRef,
      businessSectorRef: input.profile.businessSectorRef,
      storeRef: input.profile.storeRef,
      customerRef: input.profile.customerRef,
      scopeResolvedAt: input.profile.scopeResolvedAt?.toISOString() ?? null,
      scopeSnapshotVersion: input.profile.scopeSnapshotVersion ?? null,
      capturedProfileScopeVersion,
    },
    registry: {
      id: input.registry.id,
      companyId: input.registry.companyId,
      bankName: input.registry.bankName,
      smsSender: input.registry.smsSender,
      accountTail: input.registry.accountTail,
      updatedAt: input.registry.updatedAtIso,
      snapshotHash: input.registry.snapshotHash,
    },
  };
  return createHash('sha256').update(stableStringify(snapshot)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const UNSIGNED_CENTS = /^(0|[1-9]\d*)$/;

function parseUnsignedCents(value: string): bigint | null {
  if (!UNSIGNED_CENTS.test(value)) return null;
  return BigInt(value);
}

export function bankSourceSnapshot(bank: BankSmsTransaction) {
  return {
    id: bank.id,
    rawSmsId: bank.rawSmsId,
    fingerprint: bank.fingerprint,
    companyId: bank.companyId,
    bankName: bank.bankName,
    sender: bank.sender,
    accountTail: bank.accountTail,
    direction: bank.direction,
    amount: bank.amount,
    reconcileStatus: bank.reconcileStatus,
    parserPolicyVersion: bank.parserPolicyVersion,
    promotionPolicyVersion: bank.promotionPolicyVersion,
    promotionAdmissionKey: bank.promotionAdmissionKey,
    promotionEvidenceFingerprint: bank.promotionEvidenceFingerprint,
    promotionDecisionFingerprint: bank.promotionDecisionFingerprint,
    bankBusinessDate: bank.bankBusinessDate?.toISOString() ?? null,
  };
}

export function linkSourceSnapshot(link: FinanceReconciliationLink) {
  return {
    id: link.id,
    bankSmsTransactionId: link.bankSmsTransactionId,
    linkType: link.linkType,
    linkId: link.linkId,
    status: link.status,
    confirmedAmount: link.confirmedAmount,
    confirmedBy: link.confirmedBy,
    confirmedAt: link.confirmedAt?.toISOString() ?? null,
  };
}

export function workOrderSourceSnapshot(workOrder: WorkOrder) {
  return {
    id: workOrder.id,
    workOrderNo: workOrder.workOrderNo,
  };
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/**
 * Shared authority envelope verifier used by finance preview/replay, repair
 * createDelivery and the group contribution resolver. Returns a list of
 * machine-checkable problems (empty = consistent). It never inspects lifecycle
 * status or the incrementing profile.version, so a legitimate delivery
 * transition after confirmation does not invalidate the authority.
 */
export function collectAuthorityEnvelopeProblems(input: {
  order: FinanceCollectionOrder;
  authority: FinanceCollectionConfirmationAuthority;
  profile: RepairWorkOrderProfile;
  bank?: BankSmsTransaction;
  link?: FinanceReconciliationLink;
  workOrder?: WorkOrder;
  registry?: RegistryConfirmationAnchor;
}): string[] {
  const problems: string[] = [];
  const { order, authority: a, profile: p } = input;

  if (!isCollectionOrderStrictlyConfirmed(order)) {
    problems.push('collection_order_not_strictly_confirmed');
  }
  if (a.collectionOrderId !== order.id) problems.push('authority_collection_order_mismatch');
  if (order.formalConfirmationAuthorityId !== a.id) problems.push('order_authority_anchor_mismatch');
  if (a.sourceMode !== SOURCE_MODE_BANK_TRANSFER_ONE_TO_ONE_V1) problems.push('authority_source_mode_invalid');
  if (a.sourceVersion !== 'v1') problems.push('authority_source_version_invalid');
  if (a.reasonCode !== 'repair_bank_collection_confirmed') problems.push('authority_reason_code_invalid');
  if (a.currency !== 'CNY') problems.push('authority_currency_invalid');
  if (a.companyId !== order.companyId) problems.push('authority_company_mismatch');
  if (a.workOrderId !== order.workOrderId) problems.push('authority_work_order_mismatch');
  if (a.bankTransactionId !== order.bankTransactionId) problems.push('authority_bank_mismatch');
  if (a.reconciliationLinkId !== order.reconciliationLinkId) problems.push('authority_link_mismatch');
  if (a.companyRef !== p.companyRef) problems.push('authority_company_ref_mismatch');
  if (a.businessSectorRef !== p.businessSectorRef) problems.push('authority_sector_mismatch');
  if (a.storeRef !== p.storeRef) problems.push('authority_store_mismatch');
  if (a.customerRef !== p.customerRef) problems.push('authority_customer_mismatch');

  const gross = parseUnsignedCents(a.grossCents);
  if (gross == null || gross <= 0n) problems.push('authority_gross_not_positive');
  const net = parseUnsignedCents(a.netCents);
  if (net == null || net !== gross) problems.push('authority_gross_net_mismatch');
  const fee = parseUnsignedCents(a.feeCents);
  if (fee == null || fee !== 0n) problems.push('authority_fee_not_zero');
  if (!Number.isInteger(a.profileScopeVersion) || a.profileScopeVersion <= 0) {
    problems.push('authority_profile_scope_version_invalid');
  }
  if (order.confirmedBy == null || Number(order.confirmedBy) <= 0) problems.push('order_actor_invalid');
  if (a.confirmedBy !== order.confirmedBy) problems.push('authority_actor_mismatch');
  if (order.confirmedAt == null) problems.push('order_confirmed_at_missing');

  if (order.sourceType !== 'work_order') problems.push('order_source_type_invalid');
  if (order.sourceId !== String(order.workOrderId)) problems.push('order_source_id_invalid');
  if (order.businessType !== 'maintenance') problems.push('order_business_type_invalid');
  if (order.paymentChannel !== 'bank_transfer') problems.push('order_payment_channel_invalid');
  for (const [label, value] of [
    ['business', order.businessAmount],
    ['receipt', order.receiptAmount],
    ['bank_received', order.bankReceivedAmount],
  ] as Array<[string, string | null]>) {
    let cents: bigint | null = null;
    try {
      cents = decimalToCents(value, label);
    } catch {
      cents = null;
    }
    if (cents == null || cents !== gross) problems.push(`order_${label}_amount_mismatch`);
  }
  let orderFee: bigint | null = null;
  try {
    orderFee = decimalToCents(order.channelFeeAmount, 'channel_fee');
  } catch {
    orderFee = null;
  }
  if (orderFee == null || orderFee !== 0n) problems.push('order_channel_fee_not_zero');

  // Envelope amount binding: the typed authority gross must equal the locked
  // bank amount and the locked reconciliation link confirmed amount, so a
  // synchronized tamper of authority gross/net + order amounts that keeps the
  // original source/canonical hashes still fails closed.
  if (input.bank) {
    let bankCents: bigint | null = null;
    try {
      bankCents = decimalToCents(input.bank.amount, 'bank.amount');
    } catch {
      bankCents = null;
    }
    if (bankCents == null || bankCents !== gross) problems.push('authority_bank_amount_mismatch');
  }
  if (input.link) {
    let linkCents: bigint | null = null;
    try {
      linkCents = decimalToCents(input.link.confirmedAmount, 'link.confirmedAmount');
    } catch {
      linkCents = null;
    }
    if (linkCents == null || linkCents !== gross) problems.push('authority_link_amount_mismatch');
  }

  if (order.confirmedAt == null || a.authorityConfirmedAt == null) {
    problems.push('authority_time_invalid');
  } else if (order.confirmedAt.getTime() !== a.authorityConfirmedAt.getTime()) {
    problems.push('authority_time_mismatch');
  }
  if (a.sourceOccurredAt == null || Number.isNaN(a.sourceOccurredAt.getTime())) {
    problems.push('authority_source_time_invalid');
  } else if (input.bank && a.sourceOccurredAt.getTime() !== input.bank.bankBusinessDate.getTime()) {
    problems.push('authority_source_occurred_at_mismatch');
  }

  const hex64 = /^[0-9a-f]{64}$/;
  for (const [label, value] of [
    ['canonical', a.canonicalSnapshotHash],
    ['bank', a.bankSnapshotHash],
    ['link', a.linkSnapshotHash],
    ['work_order', a.workOrderSnapshotHash],
    ['profile_scope', a.profileScopeSnapshotHash],
  ] as Array<[string, string]>) {
    if (!hex64.test(value ?? '')) problems.push(`authority_${label}_hash_invalid`);
  }

  // The bank_account_registry authority source is immutable captured evidence.
  if (!Number.isInteger(a.bankAccountRegistryId) || Number(a.bankAccountRegistryId) <= 0) {
    problems.push('authority_registry_id_invalid');
  }
  if (
    a.bankAccountRegistryUpdatedAt == null ||
    !(a.bankAccountRegistryUpdatedAt instanceof Date) ||
    Number.isNaN(a.bankAccountRegistryUpdatedAt.getTime())
  ) {
    problems.push('authority_registry_updated_at_invalid');
  }
  if (!hex64.test(a.bankAccountRegistrySnapshotHash ?? '')) {
    problems.push('authority_registry_snapshot_hash_invalid');
  }

  const profileScopeHash = hashJson({
    companyRef: p.companyRef,
    businessSectorRef: p.businessSectorRef,
    storeRef: p.storeRef,
    customerRef: p.customerRef,
    scopeResolvedAt: p.scopeResolvedAt?.toISOString() ?? null,
    scopeSnapshotVersion: p.scopeSnapshotVersion ?? null,
  });
  if (a.profileScopeSnapshotHash !== profileScopeHash) problems.push('authority_profile_scope_drift');
  if (input.bank && a.bankSnapshotHash !== hashJson(bankSourceSnapshot(input.bank))) {
    problems.push('authority_bank_snapshot_drift');
  }
  if (input.link && a.linkSnapshotHash !== hashJson(linkSourceSnapshot(input.link))) {
    problems.push('authority_link_snapshot_drift');
  }
  if (input.workOrder && a.workOrderSnapshotHash !== hashJson(workOrderSourceSnapshot(input.workOrder))) {
    problems.push('authority_work_order_snapshot_drift');
  }

  if (input.bank && input.link && input.workOrder) {
    // Idempotent replay must verify the immutable captured registry anchor, not
    // the current registry row (which may have legitimately changed). When the
    // caller did not supply an anchor, reconstruct it from the authority plus
    // the locked bank identity.
    const registryAnchor =
      input.registry ??
      capturedRegistryConfirmationAnchor(a, {
        companyId: a.companyId,
        bankName: input.bank.bankName,
        smsSender: input.bank.sender,
        accountTail: input.bank.accountTail,
      });
    if (registryAnchor && isValidAuthorityRegistryAnchor(a)) {
      const recomputed = collectionOrderConfirmationFingerprint({
        order,
        bank: input.bank,
        link: input.link,
        workOrder: input.workOrder,
        profile: p,
        registry: registryAnchor,
      }, a.profileScopeVersion);
      if (recomputed !== a.canonicalSnapshotHash) {
        problems.push('authority_canonical_mismatch');
      }
    }
  }

  return problems;
}
