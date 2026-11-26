import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RepairConfirmationRequest, RepairDocumentType, RepairDocumentVersion, RepairWorkOrderProfile } from './entities/repair-shop.entities';
import { assertPrequoteLifecycle, prequoteAdmission, prequoteHash } from './repair-prequote.policy';

const TYPES: RepairDocumentType[] = ['intake_inspection', 'diagnosis', 'repair_plan', 'quote', 'customer_explanation'];
const EXECUTION_STATES = ['authorized', 'repair_scheduled', 'repairing', 'qc_pending', 'rework_required', 'ready_for_delivery'];
interface IntakeExecutionBinding {
  contract: 'repair_intake_execution_v1';
  admissionDataHash: string;
  requestId: number;
  packageHash: string;
}

/** Server-derived binding only. No new root/table, no money or payroll authority. */
export function intakeExecutionBinding(profile: RepairWorkOrderProfile): IntakeExecutionBinding | null {
  const value = profile.scopeSnapshotVersion?.intakeExecution as IntakeExecutionBinding | undefined;
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'admissionDataHash,contract,packageHash,requestId'
    || value.contract !== 'repair_intake_execution_v1'
    || !Number.isSafeInteger(value.requestId) || value.requestId <= 0
    || ![value.admissionDataHash, value.packageHash].every(h => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h))) {
    throw new ConflictException('[intake_execution_binding_invalid] 施工确认依据无效');
  }
  return value;
}

/** Read under the already locked current actor/scope/root/profile, in fixed document order. */
export async function intakeDecisionPackage(profile: RepairWorkOrderProfile, manager: EntityManager) {
  const docs = await manager.getRepository(RepairDocumentVersion).find({
    where: { workOrderId: profile.workOrderId }, order: { documentType: 'ASC', version: 'DESC' },
    lock: { mode: 'pessimistic_read' },
  });
  const selected = TYPES.map(type => {
    const latest = docs.filter(d => d.documentType === type).sort((a,b) => b.version - a.version)[0];
    const expected = ['repair_plan', 'quote', 'customer_explanation'].includes(type)
      && profile.customerConfirmationState === 'confirmed' ? 'authorized' : 'approved';
    if (!latest || latest.status !== expected || latest.generatedBy !== 'human'
      || !Number.isSafeInteger(latest.createdBy) || latest.createdBy <= 0
      || !Number.isSafeInteger(latest.reviewedBy) || latest.reviewedBy! <= 0
      || latest.createdBy === latest.reviewedBy || !latest.reviewedAt
      || !Number.isFinite(new Date(latest.reviewedAt).getTime())) {
      throw new ConflictException('[intake_execution_package_incomplete] 五份当前资料必须由独立人员复核后再请求客户确认');
    }
    return latest;
  });
  const [inspection, diagnosis, plan, quote, explanation] = selected;
  if (diagnosis.payload.inspectionVersion !== inspection.version
    || plan.payload.diagnosisVersion !== diagnosis.version
    || quote.payload.planVersion !== plan.version
    || explanation.payload.planVersion !== plan.version || explanation.payload.quoteVersion !== quote.version
    || profile.activePlanVersion !== plan.version || profile.activeQuoteVersion !== quote.version
    || profile.activeExplanationVersion !== explanation.version) {
    throw new ConflictException('[intake_execution_package_stale] 检查、诊断、方案、报价与解释不是同一套当前版本');
  }
  const packageHash = prequoteHash(selected.map(d => ({ id:d.id, type:d.documentType, version:d.version,
    payload:d.payload, sourceReferences:d.sourceReferences, summary:d.summary, createdBy:d.createdBy,
    reviewedBy:d.reviewedBy, reviewedAt:d.reviewedAt })));
  return { documents: selected, packageHash };
}

export async function assertIntakeExecutionStage(profile: RepairWorkOrderProfile, manager: EntityManager,
  stage: 'read' | 'confirmation' | 'execution') {
  const admission = prequoteAdmission(profile);
  if (!admission) throw new ConflictException('[intake_execution_admission_required] 缺少核实接入依据');
  const binding = intakeExecutionBinding(profile);
  if (!binding) {
    if (stage === 'execution') throw new BadRequestException('[intake_execution_confirmation_required] 必须先记录客户对当前报价的明确同意');
    assertPrequoteLifecycle(profile);
    return;
  }
  if (binding.admissionDataHash !== admission.dataHash) throw new ConflictException('[intake_execution_binding_stale] 接入依据已变化');
  const request = await manager.getRepository(RepairConfirmationRequest).findOne({
    where: { id:binding.requestId, workOrderId:profile.workOrderId }, lock:{ mode:'pessimistic_read' },
  });
  if (!request || !['pending','confirmed'].includes(request.status)
    || request.planVersion !== profile.activePlanVersion || request.quoteVersion !== profile.activeQuoteVersion
    || request.explanationVersion !== profile.activeExplanationVersion
    || (request.status === 'pending' && (request.version !== 1 || request.decidedBy != null
      || request.decidedAt != null || request.decisionEvidenceRef != null))
    || (request.status === 'confirmed' && (!request.decidedBy || !request.decidedAt || !request.decisionEvidenceRef
      || request.version !== 2 || profile.customerConfirmationState !== 'confirmed' || !EXECUTION_STATES.includes(profile.lifecycleStatus)))) {
    throw new ConflictException('[intake_execution_confirmation_stale] 客户确认记录已失效');
  }
  if (request.status === 'pending') {
    assertPrequoteLifecycle(profile);
    if (stage === 'execution') throw new BadRequestException('[intake_execution_confirmation_required] 待确认请求不等于客户同意');
  }
  if ((await intakeDecisionPackage(profile, manager)).packageHash !== binding.packageHash) {
    throw new ConflictException('[intake_execution_package_changed] 客户确认绑定的资料内容已变化');
  }
}

export function bindIntakeConfirmation(profile: RepairWorkOrderProfile, requestId: number, packageHash: string) {
  profile.scopeSnapshotVersion = { ...profile.scopeSnapshotVersion, intakeExecution: {
    contract:'repair_intake_execution_v1', admissionDataHash:prequoteAdmission(profile)!.dataHash, requestId, packageHash,
  } };
}
export function clearIntakeConfirmation(profile: RepairWorkOrderProfile) {
  const { intakeExecution, ...snapshot } = profile.scopeSnapshotVersion;
  profile.scopeSnapshotVersion = snapshot;
}
