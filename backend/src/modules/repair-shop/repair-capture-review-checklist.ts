import { ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RepairAuthorityCaptureFamily as Family } from './dto/repair-authority-capture.dto';

type Row = Readonly<Record<string, unknown>>;
type State = 'missing' | 'draft' | 'pending_independent_review' | 'rejected'
  | 'superseded' | 'version_review_required' | 'profile_blocked' | 'recorded_unverified';

interface ChecklistInput {
  readonly workOrderRef: string;
  readonly profileVersion: number;
  readonly family: Family;
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly records: readonly Row[];
}

const LABELS = {
  lineage: '经济事实关联', assignment: '责任员工与三角色归因', baseline: '基线成本与事件声明',
} as const;
const PHASES = {
  lineage: ['propose', 'approve'], assignment: ['draft', 'submit', 'decide'], baseline: ['draft', 'submit', 'decide'],
} as const;
const GUIDANCE: Record<State, { explanation: string; nextStep: string; responsibleRole: string }> = {
  missing: { explanation: '本次授权视图没有此类记录；请核对前置经济事实关联，再由有权限的录单人补录。不能据此认定成本为零。', nextStep: 'open_existing_capture', responsibleRole: 'authorized_maker' },
  draft: { explanation: '已有草稿，尚未提交独立复核；请由原录单人核对证据和版本。', nextStep: 'review_draft', responsibleRole: 'authorized_maker' },
  pending_independent_review: { explanation: '资料等待有权限且独立于录单／提交人的人员复核；聊天同意和 AI 检查不能代替复核。', nextStep: 'request_independent_review', responsibleRole: 'independent_authorized_checker' },
  rejected: { explanation: '此版本已有驳回记录；请核对驳回事项，通过既有流程修正，不能改写历史结论。', nextStep: 'review_rejected_record', responsibleRole: 'authorized_maker' },
  superseded: { explanation: '此版本已被替代，只供追溯；请重新查询当前版本及其证据。', nextStep: 'view_current_records', responsibleRole: 'authorized_reviewer' },
  version_review_required: { explanation: '资料绑定的工单版本与当前版本不同，适用性需要重新核验；本清单不撤销或改写原审批记录。', nextStep: 'verify_current_version', responsibleRole: 'authorized_reviewer' },
  profile_blocked: { explanation: '此记录有非零直接成本或外部成本阻断标记，不符合首批零外部直接成本范围；不得忽略、清零或据此计算工资。', nextStep: 'review_profile_blocker', responsibleRole: 'authorized_reviewer' },
  recorded_unverified: { explanation: '存在已批准或已关联审批的记录；本次单类视图未校验完整事实链、跨类有效版本与工资条件，不代表已可计入工资。', nextStep: 'verify_cross_family_evidence', responsibleRole: 'authorized_reviewer' },
};

function invalid(): never {
  throw new ConflictException('[repair_capture_checklist_invalid] 复核清单证据不完整或不一致，请重新核对资料');
}

function positive(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) invalid();
  return value;
}

function digest(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) invalid();
  return value;
}

function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Row;
}

function cents(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(value)) invalid();
  const amount = BigInt(value);
  if (amount > 9223372036854775807n) invalid();
  return amount;
}

// Hash only the bounded, server-built safe projection. No raw command, model
// narrative, credential, caller context or free-text explanation is returned.
function canonical(value: unknown, depth = 0): string {
  if (depth > 8) invalid();
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item, depth + 1)).join(',')}]`;
  const row = object(value);
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key], depth + 1)}`).join(',')}}`;
}

function baselineBlocked(row: Row): boolean {
  const details = object(row.details);
  if (!['eligible', 'blocked_external_cost'].includes(String(details.profileEligibility))) invalid();
  if (!Array.isArray(details.declarations) || details.declarations.length !== 5) invalid();
  const total = cents(details.totalDirectCostCents);
  const amounts = details.declarations.map((line) => cents(object(line).amountCents));
  return details.profileEligibility === 'blocked_external_cost' || total > 0n || amounts.some((amount) => amount > 0n);
}

/** Internal projection only. The capture service must authenticate and authorize
 * the current person/family in its existing snapshot BEFORE calling this helper.
 * Its fingerprint is NOT evidence verification, authorization or an action token.
 */
export function buildRepairCaptureReviewChecklistV1(input: ChecklistInput, currentActorId: number) {
  positive(currentActorId);
  positive(input.profileVersion);
  if (!Object.values(Family).includes(input.family) || typeof input.workOrderRef !== 'string'
    || !/^work-order:[1-9]\d*$/.test(input.workOrderRef)) invalid();
  positive(Number(input.workOrderRef.slice('work-order:'.length)));
  if (!Array.isArray(input.records) || input.records.length > 50) invalid();
  const phases = PHASES[input.family];
  const capabilities = object(input.capabilities);
  if (Object.keys(capabilities).length !== phases.length
    || !phases.every((phase) => typeof capabilities[phase] === 'boolean')
    || !phases.some((phase) => capabilities[phase] === true)) invalid();

  const seen = new Set<string>();
  const bindings = input.records.map((value) => {
    const row = object(value);
    const prefix = input.family === Family.Lineage ? 'lineage-decision' : input.family === Family.Assignment ? 'repair-assignment' : 'repair-cost-event';
    if (typeof row.ref !== 'string' || !row.ref.startsWith(`${prefix}:`) || seen.has(row.ref)) invalid();
    digest(row.ref.slice(prefix.length + 1));
    seen.add(row.ref);
    if (row.workOrderRef !== input.workOrderRef) invalid();
    const expectedVersion = positive(input.family === Family.Lineage ? row.expectedTargetVersion : row.expectedWorkOrderVersion);
    const version = input.family === Family.Lineage ? null : positive(row.authorityVersion);
    const evidenceHash = digest(input.family === Family.Lineage ? row.evidenceHash : row.contentHash);
    const status = row.status;
    const allowed = input.family === Family.Lineage
      ? ['pending_checker_approval', 'approved', 'accepted']
      : ['draft', 'submitted', 'approved', 'rejected', 'superseded'];
    if (typeof status !== 'string' || !allowed.includes(status)) invalid();
    let state: State;
    if (status === 'superseded' || status === 'rejected') state = status;
    else if (expectedVersion !== input.profileVersion) state = 'version_review_required';
    else if (input.family === Family.Baseline && baselineBlocked(row)) state = 'profile_blocked';
    else if (status === 'draft') state = 'draft';
    else if (status === 'submitted' || status === 'pending_checker_approval') state = 'pending_independent_review';
    else state = 'recorded_unverified';
    return { ref: row.ref, version, evidenceHash, expectedProfileVersion: expectedVersion, sourceStatus: status, state };
  });

  // Scope, current subject and capabilities are included so a different person
  // or changed source projection never inherits another checklist fingerprint.
  // This deliberately does not choose a highest version as the formal truth.
  const fingerprint = createHash('sha256').update(canonical({
    contractVersion: 'repair_capture_review_checklist_v1', currentActorId,
    workOrderRef: input.workOrderRef, profileVersion: input.profileVersion,
    family: input.family, capabilities,
    records: [...input.records].sort((left, right) => String(left.ref).localeCompare(String(right.ref))),
  })).digest('hex');
  const items = bindings.length ? bindings : [{
    ref: null, version: null, evidenceHash: null, expectedProfileVersion: input.profileVersion,
    sourceStatus: 'not_observed', state: 'missing' as const,
  }];
  return {
    contractVersion: 'repair_capture_review_checklist_v1' as const,
    workOrderRef: input.workOrderRef, family: input.family, profileVersion: input.profileVersion,
    label: LABELS[input.family], evidenceFingerprint: fingerprint,
    sourceRecordCount: bindings.length,
    items: items.map((item) => ({ ...item, ...GUIDANCE[item.state] })),
    validity: 'snapshot_only_requery_before_use' as const,
    notVerified: ['cross_family_current_validity', 'source_content_hash_recomputation', 'formal_contribution', 'wage_readiness'],
    boundaries: {
      projectionOnly: true, humanReviewRequired: true, fingerprintIsApprovalToken: false,
      automatedExecutionAllowed: false, formalContributionEnabled: false, wageEnabled: false,
      businessWrites: false, independentReviewBypassed: false,
    },
  };
}
