import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { assertWorkOrderNotUnquoted } from '../work-orders/work-order-intake.policy';
import type { RepairWorkOrderProfile } from './entities/repair-shop.entities';

export interface PrequoteAdmissionV1 {
  contract: 'repair_prequote_admission_v1';
  actorId: number;
  requestId: string;
  requestHash: string;
  authorityHash: string;
  dataHash: string;
  intakeRevision: number;
  vehicleCustomerLinkId: number;
}
export const PREQUOTE_STATES = ['intake_draft', 'intake_checked', 'diagnosed', 'quote_pending_customer'];
export function prequoteHash(value: unknown): string {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical)
    : v && typeof v === 'object' && !(v instanceof Date)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function prequoteAdmission(profile: RepairWorkOrderProfile): PrequoteAdmissionV1 | null {
  const value = profile.scopeSnapshotVersion?.prequoteAdmission;
  if (value === undefined) return null;
  const v = value as PrequoteAdmissionV1;
  if (!v || typeof v !== 'object' || Array.isArray(v)
    || Object.keys(v).sort().join(',') !== 'actorId,authorityHash,contract,dataHash,intakeRevision,requestHash,requestId,vehicleCustomerLinkId'
    || v.contract !== 'repair_prequote_admission_v1'
    || ![v.actorId, v.intakeRevision, v.vehicleCustomerLinkId].every((n) => Number.isSafeInteger(n) && n > 0)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.requestId)
    || ![v.requestHash, v.authorityHash, v.dataHash].every((h) => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h))) {
    throw new ConflictException('[repair_prequote_snapshot_invalid] 报价前接入快照需要核验');
  }
  return v;
}

/** Default deny for every downstream writer, independent of a forged lifecycle. */
export async function assertQuotedRepairRoot(workOrderId: number, manager: EntityManager) {
  const root = await manager.getRepository(WorkOrder).findOne({
    where: { id: workOrderId },
    ...(manager.queryRunner?.isTransactionActive ? { lock: { mode: 'pessimistic_read' as const } } : {}),
  });
  if (!root) throw new NotFoundException('工单不存在');
  assertWorkOrderNotUnquoted(root);
  return root;
}
export function assertPrequoteLifecycle(profile: RepairWorkOrderProfile) {
  if (!PREQUOTE_STATES.includes(profile.lifecycleStatus) || !['not_requested', 'rejected'].includes(profile.customerConfirmationState)) {
    throw new BadRequestException('[repair_prequote_only] 未报价接车仅允许检查、诊断和报价版本，不允许客户决定或施工');
  }
}

/** Only ordinary numeric foundation snapshots can enter formal revenue authority. */
export function quotedScopeSnapshot(profile: RepairWorkOrderProfile): Record<string, number> {
  if (prequoteAdmission(profile) || !profile.scopeSnapshotVersion || Array.isArray(profile.scopeSnapshotVersion)
    || Object.keys(profile.scopeSnapshotVersion).length === 0
    || !Object.values(profile.scopeSnapshotVersion).every((v) => Number.isSafeInteger(v) && Number(v) > 0)) {
    throw new BadRequestException('[repair_prequote_only] 报价前档案不是正式经济或工资依据');
  }
  return profile.scopeSnapshotVersion as Record<string, number>;
}
