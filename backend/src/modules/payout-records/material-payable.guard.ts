import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { EntityManager } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { ApprovalRequest } from '../approval-requests/entities/approval-request.entity';
import { ApprovalPaymentIntent } from '../approval-requests/entities/approval-payment-intent.entity';
import { BusinessFoundationService } from '../business-foundation/business-foundation.service';
import { BusinessCompanyRef } from '../business-foundation/entities/business-foundation.entities';
import { RepairPurchaseOrder } from '../repair-shop/entities/repair-shop-procurement.entities';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { BankAccountRegistry } from '../finance-bank-account/entities/bank-account-registry.entity';
import { BankAccountRegistryReviewAuthority } from '../finance-bank-account/entities/bank-account-registry-review-authority.entity';
import { isBankAccountRegistryFormallyEligible } from '../finance-bank-account/bank-account-registry-authority.contract';
import { PayoutRecord } from './entities/payout-record.entity';
import { CreatePayoutRecordDto } from './dto/create-payout-record.dto';
import {
  checkPayableBalances, installmentContent, payableCents, payableHash, payableHold,
  payableMoney, receiptContent, sourceContent,
} from './material-payable.policy';

const hashPattern = /^[a-f0-9]{64}$/;
const readLock = { mode: 'pessimistic_read' as const };

export function validateMaterialPayoutRequest(dto: CreatePayoutRecordDto, actor: CurrentUser) {
  if (!Number.isSafeInteger(actor?.id) || actor.id <= 0 ||
      actor.identitySource !== 'trusted_proxy' || !actor.roleCodes?.includes('finance')) {
    throw new ForbiddenException('[material_payable_formal_finance_required] 需要正式财务身份');
  }
  if (!Number.isSafeInteger(dto?.approvalRequestId) || dto.approvalRequestId <= 0 ||
      !Number.isSafeInteger(dto.materialInstallmentId) || dto.materialInstallmentId <= 0 ||
      typeof dto.requestIdempotencyKey !== 'string' ||
      !/^[A-Za-z0-9_-]{16,96}$/.test(dto.requestIdempotencyKey) ||
      typeof dto.verificationCode !== 'string' || !/^[A-Za-z0-9_-]{1,20}$/.test(dto.verificationCode) ||
      typeof dto.payeeName !== 'string' || !dto.payeeName.trim() || dto.payeeName.length > 100 ||
      dto.paymentMethod !== 'bank_transfer' || typeof dto.paidAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(dto.paidAt) ||
      !Number.isFinite(Date.parse(dto.paidAt)) || Date.parse(dto.paidAt) > Date.now()) {
    throw new BadRequestException('[material_payable_authority_required] 需要已核实的材料分期、幂等键、审批凭证与银行付款证据');
  }
  return payableHash({
    schema: 'material_payout_request_v1', actorId: actor.id,
    approvalRequestId: dto.approvalRequestId, materialInstallmentId: dto.materialInstallmentId,
    amount: payableMoney(dto.amount), payeeName: dto.payeeName,
    paymentMethod: dto.paymentMethod, paidAt: new Date(dto.paidAt).toISOString(),
  }); // Never persist verification codes or raw banking evidence.
}

async function reviewed(manager: EntityManager, row: any, kind: string, expectedHash: string, actorId: number) {
  const reviewTime = new Date(row.reviewed_at).getTime();
  if ((row.status ?? row.state) !== 'verified' || !hashPattern.test(row.evidence_hash ?? '') ||
      !hashPattern.test(row.content_hash ?? '') || row.content_hash !== expectedHash ||
      !Number.isSafeInteger(row.created_by) || row.created_by <= 0 ||
      !Number.isSafeInteger(row.reviewed_by) || row.reviewed_by <= 0 ||
      row.created_by === row.reviewed_by || row.reviewed_by === actorId ||
      !row.reviewed_at || !Number.isFinite(reviewTime) || reviewTime > Date.now() ||
      !Number.isSafeInteger(row.review_log_id) || row.review_log_id <= 0) {
    payableHold(kind + '_review_missing');
  }
  const [log] = await manager.query(
    'SELECT id, module, target_id, action, operator_id, actor_type, detail_json, created_at FROM operation_logs WHERE id = ? FOR SHARE',
    [row.review_log_id],
  );
  let detail = log?.detail_json;
  if (typeof detail === 'string') {
    try { detail = JSON.parse(detail); } catch { payableHold(kind + '_audit_invalid'); }
  }
  if (!log || log.module !== 'material_payable' || log.target_id !== row.id ||
      log.action !== 'verify_' + kind || log.operator_id !== row.reviewed_by ||
      log.actor_type !== 'human' || detail?.schema !== 'material_payable_review_v1' ||
      detail?.contentHash !== expectedHash || detail?.evidenceHash !== row.evidence_hash ||
      !log.created_at || !Number.isFinite(new Date(log.created_at).getTime()) ||
      Math.abs(new Date(log.created_at).getTime() - reviewTime) >= 1000) {
    payableHold(kind + '_audit_invalid');
  }
}

/** Same transaction only. No source/receipt issuer, provider call or automatic release. */
export async function guardMaterialPayout(
  manager: EntityManager, scopeService: BusinessFoundationService,
  dto: CreatePayoutRecordDto, actor: CurrentUser, fingerprint: string,
): Promise<{ replay: PayoutRecord | null; amount: string }> {
  if (!manager.queryRunner?.isTransactionActive) payableHold('active_transaction_required');
  // Current RBAC first; roleCodes in a request is never persisted authority.
  const [user] = await manager.query('SELECT id, status FROM users WHERE id = ? FOR SHARE', [actor.id]);
  const roles = await manager.query(
    'SELECT ur.id, r.code FROM user_roles ur INNER JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY ur.id FOR SHARE',
    [actor.id],
  );
  if (!user || user.status !== 1 || !roles.some((role: any) => role.code === 'finance')) {
    throw new ForbiddenException('[material_payable_current_role_missing] 当前财务权限无效');
  }
  // Nonlocking hint only: recheck all identities after authority locks.
  const [hint] = await manager.query(
    'SELECT i.source_id, s.purchase_order_id FROM material_payout_installments i INNER JOIN material_payable_source_guards s ON s.id = i.source_id WHERE i.id = ?',
    [dto.materialInstallmentId],
  );
  if (!hint) payableHold('source_unavailable');
  const orderRepo = manager.getRepository(RepairPurchaseOrder);
  const orderHint = await orderRepo.findOne({ where: { id: hint.purchase_order_id } });
  if (!orderHint) payableHold('purchase_missing');
  await scopeService.assertAccess(actor, orderHint!, 'finance.payout.record', manager, { lockAuthorityRows: true });
  const supplier = await manager.getRepository(Supplier).findOne({ where: { id: orderHint!.supplierId }, lock: readLock });
  if (!supplier || supplier.status !== 'active') payableHold('supplier_inactive');
  const order = await orderRepo.findOne({ where: { id: hint.purchase_order_id }, lock: { mode: 'pessimistic_write' } });
  const scopeKeys = ['companyRef', 'businessSectorRef', 'storeRef', 'customerRef'] as const;
  if (!order || scopeKeys.some((key) => order[key] !== orderHint![key]) ||
      order.supplierId !== orderHint!.supplierId || order.paymentIntentId !== orderHint!.paymentIntentId ||
      order.paymentApprovalRequestId !== orderHint!.paymentApprovalRequestId ||
      order.workOrderId !== orderHint!.workOrderId) payableHold('scope_changed');
  const [source] = await manager.query('SELECT * FROM material_payable_source_guards WHERE id = ? FOR UPDATE', [hint.source_id]);
  if (!source || source.purchase_order_id !== order!.id || source.payment_intent_id !== order!.paymentIntentId) {
    payableHold('source_binding_changed');
  }
  const approval = await manager.getRepository(ApprovalRequest).findOne({
    where: { id: dto.approvalRequestId }, lock: { mode: 'pessimistic_write' },
  });
  if (!approval || approval.currentStatus !== 'approved' || approval.approvalType !== 'payout' ||
      approval.id !== order!.paymentApprovalRequestId || approval.relatedWorkOrderId !== order!.workOrderId ||
      !approval.finalApproverId || approval.finalApproverId === approval.applicantUserId ||
      approval.finalApproverId === actor.id || !approval.verificationCode) payableHold('approval_invalid');
  const expectedCode = Buffer.from(approval!.verificationCode!);
  const suppliedCode = Buffer.from(dto.verificationCode);
  if (expectedCode.length !== suppliedCode.length || !timingSafeEqual(expectedCode, suppliedCode)) {
    throw new ForbiddenException('[material_payable_verification_failed] 审批凭证不匹配');
  }
  const intent = await manager.getRepository(ApprovalPaymentIntent).findOne({
    where: { id: source.payment_intent_id }, lock: { mode: 'pessimistic_write' },
  });
  const company = await manager.getRepository(BusinessCompanyRef).findOne({
    where: { companyRef: order!.companyRef, status: 'active' }, lock: readLock,
  });
  if (!intent || !company || !['issued', 'partially_received', 'received'].includes(order!.status) ||
      intent.sourceType !== 'repair_purchase_order' || intent.sourceRefType !== 'repair_purchase_order' ||
      intent.sourceRefId !== String(order!.id) || intent.approvalRequestId !== approval!.id ||
      intent.companyId !== company.companyRegistryId || intent.supplierId !== order!.supplierId ||
      intent.workOrderId !== order!.workOrderId || intent.businessDomain !== 'repair_shop' ||
      intent.businessUnit !== order!.businessSectorRef || intent.currency !== 'CNY' ||
      intent.specialFlag || intent.specialApprovalRequired ||
      !intent.idempotencyKey || !intent.bankAccountRegistryId ||
      !['verified', 'owner_confirmed'].includes(intent.accountBindingStatus ?? '') ||
      !intent.accountBindingSource || intent.readinessGate !== 'ready_for_owner_approved_runtime_trial' ||
      !['partially_paid', 'paid', 'reconciliation_pending', 'reconciliation_confirmed'].includes(intent.intentStatus) ||
      intent.createdBy !== source.created_by || intent.approvedBy !== source.reviewed_by ||
      intent.approvedBy !== approval!.finalApproverId ||
      payableCents(intent.approvedAmount) !== payableCents(order!.totalAmount) ||
      payableCents(intent.requestedAmount) !== payableCents(order!.totalAmount) ||
      payableCents(approval!.amount) < payableCents(order!.totalAmount) ||
      !Array.isArray(order!.lineSnapshot) || !order!.lineSnapshot.length ||
      dto.payeeName !== order!.supplierNameSnapshot) payableHold('intent_source_mismatch');
  const [itemHint] = await manager.query('SELECT * FROM material_payout_installments WHERE id = ?', [dto.materialInstallmentId]);
  if (!itemHint || itemHint.source_id !== source.id || itemHint.state !== 'verified' || !itemHint.receipt_id) payableHold('installment_unverified');
  // Receipt BEFORE installment: a grouped receipt spans several payable roots.
  // Locking each root's installment first would invert the receipt-total scan.
  const [receipt] = await manager.query('SELECT * FROM material_payment_receipt_guards WHERE id = ? FOR UPDATE', [itemHint.receipt_id]);
  const [item] = await manager.query('SELECT * FROM material_payout_installments WHERE id = ? FOR UPDATE', [dto.materialInstallmentId]);
  if (!item || item.source_id !== source.id || item.receipt_id !== itemHint.receipt_id || item.state !== 'verified') payableHold('installment_changed');
  if (!receipt || receipt.company_id !== intent!.companyId || receipt.supplier_id !== intent!.supplierId ||
      receipt.currency !== 'CNY' || receipt.bank_account_registry_id !== intent!.bankAccountRegistryId ||
      !hashPattern.test(receipt.transaction_identity_hash ?? '') ||
      !receipt.paid_at || !Number.isFinite(new Date(receipt.paid_at).getTime()) ||
      new Date(receipt.paid_at).getTime() !== new Date(dto.paidAt).getTime() ||
      new Date(receipt.paid_at).getTime() > Date.now()) payableHold('receipt_binding_mismatch');
  const registry = await manager.getRepository(BankAccountRegistry).findOne({
    where: { id: receipt.bank_account_registry_id }, lock: readLock,
  });
  const registryAuthority = registry?.formalReviewAuthorityId
    ? await manager.getRepository(BankAccountRegistryReviewAuthority).findOne({
        where: { id: registry.formalReviewAuthorityId }, lock: readLock,
      }) : null;
  if (!registry || registry.companyId !== intent!.companyId ||
      !isBankAccountRegistryFormallyEligible(registry, registryAuthority) ||
      registry.formalReviewAuthorityHash !== receipt.registry_authority_hash) payableHold('bank_authority_invalid');
  await reviewed(manager, source, 'source', payableHash(sourceContent(order, intent, company!.companyRegistryId, source.evidence_hash)), actor.id);
  await reviewed(manager, receipt, 'receipt', payableHash(receiptContent(receipt)), actor.id);
  await reviewed(manager, item, 'installment', payableHash(installmentContent(item)), actor.id);
  if (new Date(receipt.reviewed_at).getTime() < new Date(receipt.paid_at).getTime() ||
      new Date(item.reviewed_at).getTime() < new Date(receipt.reviewed_at).getTime()) payableHold('review_time_invalid');
  if (!hashPattern.test(item.installment_ref ?? '') || payableCents(dto.amount) !== payableCents(item.amount)) payableHold('installment_amount_mismatch');
  const sourceItems = await manager.query('SELECT id, receipt_id, amount, state FROM material_payout_installments WHERE source_id = ? ORDER BY id FOR SHARE', [source.id]);
  const receiptItems = await manager.query('SELECT id, source_id, amount, state FROM material_payout_installments WHERE receipt_id = ? ORDER BY id FOR SHARE', [receipt.id]);
  checkPayableBalances(sourceItems, receiptItems, order!.totalAmount, receipt.amount, intent!);
  const repo = manager.getRepository(PayoutRecord);
  const existing = await repo.find({ where: { approvalRequestId: approval!.id }, order: { id: 'ASC' }, lock: readLock });
  if (existing.some((record) => !record.materialInstallmentId || !record.requestIdempotencyKey || !record.requestFingerprint ||
      !sourceItems.some((entry: any) => entry.id === record.materialInstallmentId &&
        entry.state === 'verified' && payableCents(entry.amount) === payableCents(record.amount)))) payableHold('legacy_or_unreconciled_records');
  const replay = await repo.findOne({ where: { requestIdempotencyKey: dto.requestIdempotencyKey }, lock: readLock });
  if (replay) {
    if (replay.requestFingerprint !== fingerprint || replay.createdBy !== actor.id ||
        replay.materialInstallmentId !== item.id || replay.approvalRequestId !== approval!.id ||
        replay.payeeName !== dto.payeeName || replay.paymentMethod !== dto.paymentMethod ||
        new Date(replay.paidAt).getTime() !== new Date(dto.paidAt).getTime() ||
        payableCents(replay.amount) !== payableCents(item.amount)) payableHold('request_payload_conflict');
    return { replay, amount: payableMoney(item.amount) };
  }
  if (existing.some((record) => record.materialInstallmentId === item.id)) payableHold('installment_already_recorded');
  if (existing.reduce((sum, record) => sum + payableCents(record.amount), 0n) + payableCents(item.amount) >
      payableCents(order!.totalAmount)) payableHold('recording_ceiling_exceeded');
  return { replay: null, amount: payableMoney(item.amount) };
}
