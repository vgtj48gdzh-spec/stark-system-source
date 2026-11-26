// UI validation is advisory. Immutable server contracts reauthorize every action.
export type CaptureFamily = 'lineage' | 'assignment' | 'baseline';
export type CaptureAction = 'lineage-propose' | 'lineage-approve' | 'assignment-draft' | 'assignment-submit' | 'assignment-decide' | 'baseline-draft' | 'baseline-submit' | 'baseline-decide';
export type Evidence = { evidenceRef: string; evidenceHash: string };
export type Attribution = Evidence & { role: string; employeeRef: string; shareBps: number; effectiveFrom: string; effectiveTo: string | null };
export type Declaration = Evidence & { category: string; disposition: string; amountCents: string; occurredAt: string | null };
export interface CaptureRecord {
  ref: string; status: string; workOrderRef: string;
  authorityVersion?: number; contentHash?: string; expectedWorkOrderVersion?: number;
  supersedesAuthorityRef?: string | null; supersedesAuthorityVersion?: number | null;
  relationType?: string; predecessorWorkOrderRef?: string | null; evidenceHash?: string;
  expectedTargetVersion?: number; expectedPredecessorVersion?: number | null;
  canApprove?: boolean; canSubmit?: boolean; canDecide?: boolean;
  details?: {
    responsibilityEmployeeRef?: string; responsibilityEffectiveFrom?: string | null;
    responsibilityEffectiveTo?: string | null; responsibilityEvidenceHash?: string;
    attributions?: Array<Omit<Attribution, 'evidenceRef'>>;
    totalDirectCostCents?: string; profileEligibility?: string;
    assignmentAuthorityRef?: string; assignmentAuthorityVersion?: number; assignmentContentHash?: string;
    declarations?: Array<Omit<Declaration, 'evidenceRef'>>;
  };
}
export interface CaptureSnapshot {
  workOrderRef: string; profileVersion: number; family: CaptureFamily;
  reviewChecklist?: unknown;
  capabilities: Record<string, boolean>; records: CaptureRecord[];
  boundaries: { projectionOnly: true; formalContributionEnabled: false; wageEnabled: false; nonzeroCostAdmissible: false; firstProfile: string };
}

const HASH = /^[0-9a-f]{64}$/;
export function evidence(value: Evidence): Evidence {
  if (!/^evidence:[0-9a-f]{64}$/.test(value.evidenceRef) || !HASH.test(value.evidenceHash)) throw new Error('请填写已有证据的不透明引用及 SHA-256 摘要；不要填写原文或自行编造。');
  return { evidenceRef: value.evidenceRef, evidenceHash: value.evidenceHash };
}
function positive(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) throw new Error('编号和版本必须是正整数。');
  return value;
}
function employee(value: string): string {
  if (!/^employee:[1-9]\d*$/.test(value)) throw new Error('员工引用格式为 employee:员工编号。');
  positive(Number(value.split(':')[1])); return value;
}
function instant(value: string | null, nullable = false): string | null {
  if ((value == null || value === '') && nullable) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error('时间请填写 UTC ISO 格式，例如 2026-09-01T00:00:00.000Z。');
  return value;
}
function interval(from: string, to: string | null) {
  const effectiveFrom = instant(from)!; const effectiveTo = instant(to, true);
  if (effectiveTo && effectiveTo <= effectiveFrom) throw new Error('结束时间必须晚于开始时间。');
  return { effectiveFrom, effectiveTo };
}
export function validateSnapshot(value: CaptureSnapshot, workOrderRef: string, family: CaptureFamily): CaptureSnapshot {
  if (!value || value.workOrderRef !== workOrderRef || value.family !== family || !Array.isArray(value.records) || value.records.length > 50 || !value.capabilities || !value.boundaries || value.boundaries.projectionOnly !== true || value.boundaries.formalContributionEnabled !== false || value.boundaries.wageEnabled !== false || value.boundaries.nonzeroCostAdmissible !== false) throw new Error('正式资料响应与当前工单或安全边界不一致，请重新读取。');
  positive(value.profileVersion);
  return value;
}
export function newIdempotencyKey(family: CaptureFamily): string {
  const prefix = { lineage: 'lineage', assignment: 'repair-assignment', baseline: 'repair-cost-event' }[family];
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `${prefix}-idempotency:${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
function supersede(snapshot: CaptureSnapshot, selectedRef: string) {
  const approved = snapshot.records.filter((record) => record.status === 'approved');
  if (snapshot.records.some((record) => ['draft', 'submitted'].includes(record.status))) throw new Error('已有草稿或待复核版本，请先处理该版本。');
  if (approved.length > 1 || (approved.length === 1 && approved[0].ref !== selectedRef) || (approved.length === 0 && selectedRef)) throw new Error('请明确选择要替代的当前已通过版本；不能覆盖历史。');
  return { supersedesAuthorityRef: approved[0]?.ref ?? null, expectedSupersededAuthorityVersion: approved.length ? positive(approved[0].authorityVersion!) : null };
}
export function lineageProposal(snapshot: CaptureSnapshot, input: Evidence & { relationType: 'origin' | 'cancel_recreate'; predecessorId: number; predecessorVersion: number }) {
  if (snapshot.family !== 'lineage' || snapshot.capabilities.propose !== true) throw new Error('缺少提议权限，请重新读取。');
  const base = { relationType: input.relationType, targetWorkOrderRef: snapshot.workOrderRef, expectedTargetVersion: snapshot.profileVersion, ...evidence(input) };
  if (input.relationType === 'origin') return { ...base, reasonCode: 'initial_registration' };
  if (input.relationType !== 'cancel_recreate') throw new Error('关联类型无效。');
  const predecessorWorkOrderRef = `work-order:${positive(input.predecessorId)}`;
  if (predecessorWorkOrderRef === snapshot.workOrderRef) throw new Error('前序工单不能是当前工单。');
  return { ...base, predecessorWorkOrderRef, expectedPredecessorVersion: positive(input.predecessorVersion), reasonCode: 'cancelled_recreated_same_economic_fact' };
}
export function assignmentDraft(snapshot: CaptureSnapshot, input: { responsibilityEmployeeRef: string; responsibilityEffectiveFrom: string; responsibilityEffectiveTo: string | null; responsibilityEvidence: Evidence; attributions: Attribution[]; supersedes: string }) {
  if (snapshot.family !== 'assignment' || snapshot.capabilities.draft !== true) throw new Error('缺少责任归因录入权限。');
  const dates = interval(input.responsibilityEffectiveFrom, input.responsibilityEffectiveTo);
  if (input.attributions.length < 3 || input.attributions.length > 30) throw new Error('三角色归因必须包含 3 至 30 项。');
  const attributions = input.attributions.map((line) => {
    if (!['lead_originator', 'business_owner', 'service_owner'].includes(line.role) || positive(line.shareBps) > 10000) throw new Error('角色或份额无效。');
    return { role: line.role, employeeRef: employee(line.employeeRef), shareBps: line.shareBps, ...interval(line.effectiveFrom, line.effectiveTo), ...evidence(line) };
  });
  if (new Set(attributions.map((line) => line.role)).size !== 3 || new Set(attributions.map((line) => `${line.role}:${line.employeeRef}`)).size !== attributions.length || attributions.reduce((sum, line) => sum + line.shareBps, 0) !== 10000) throw new Error('三个角色都必须填写，同角色员工不得重复，全部份额合计必须为 10000 bps（100%）。');
  const proof = evidence(input.responsibilityEvidence);
  return { workOrderRef: snapshot.workOrderRef, expectedWorkOrderVersion: snapshot.profileVersion, responsibilityEmployeeRef: employee(input.responsibilityEmployeeRef), responsibilityEffectiveFrom: dates.effectiveFrom, responsibilityEffectiveTo: dates.effectiveTo, responsibilityEvidenceRef: proof.evidenceRef, responsibilityEvidenceHash: proof.evidenceHash, attributions, ...supersede(snapshot, input.supersedes) };
}
export function baselineDraft(snapshot: CaptureSnapshot, assignment: CaptureRecord | undefined, input: { declarations: Declaration[]; supersedes: string }) {
  if (snapshot.family !== 'baseline' || snapshot.capabilities.draft !== true) throw new Error('缺少成本声明录入权限。');
  if (!assignment || assignment.status !== 'approved' || assignment.workOrderRef !== snapshot.workOrderRef || !/^repair-assignment:[0-9a-f]{64}$/.test(assignment.ref) || !HASH.test(assignment.contentHash ?? '')) throw new Error('请先读取并选择本工单已通过的责任归因版本。');
  const categories = ['parts', 'outsourced', 'other_direct', 'refund', 'rework'];
  if (input.declarations.length !== 5 || new Set(input.declarations.map((line) => line.category)).size !== 5) throw new Error('五项声明必须完整且不重复。');
  const declarations = input.declarations.map((line) => {
    if (!categories.includes(line.category) || !['not_applicable', 'confirmed_cost'].includes(line.disposition)) throw new Error('请选择每项声明的实际处置。');
    if (!/^(0|[1-9]\d{0,18})$/.test(line.amountCents) || BigInt(line.amountCents) > 9223372036854775807n) throw new Error('金额必须填写整数分，不能使用小数或科学计数法。');
    if (line.disposition === 'not_applicable' && (line.amountCents !== '0' || line.occurredAt)) throw new Error('不适用声明必须为零且无发生时间。');
    if (line.disposition === 'confirmed_cost' && (line.amountCents === '0' || ['refund', 'rework'].includes(line.category))) throw new Error('实际成本必须大于零；退款和返工不在本 baseline 入口处理。');
    return { category: line.category, disposition: line.disposition, amountCents: line.amountCents, occurredAt: instant(line.occurredAt, line.disposition === 'not_applicable'), ...evidence(line) };
  });
  if (declarations.reduce((sum, line) => sum + BigInt(line.amountCents), 0n) > 9223372036854775807n) throw new Error('成本合计超出安全范围。');
  return { workOrderRef: snapshot.workOrderRef, expectedWorkOrderVersion: snapshot.profileVersion, expectedAssignmentAuthorityRef: assignment.ref, expectedAssignmentAuthorityVersion: positive(assignment.authorityVersion!), expectedAssignmentContentHash: assignment.contentHash, declarations, ...supersede(snapshot, input.supersedes) };
}
export function reviewCommand(snapshot: CaptureSnapshot, record: CaptureRecord, phase: 'approve' | 'submit' | 'decide', proof: Evidence, decision: string) {
  if (!snapshot.records.includes(record) || record.workOrderRef !== snapshot.workOrderRef) throw new Error('请重新读取当前记录。');
  if (snapshot.family === 'lineage') {
    if (phase !== 'approve' || !record.canApprove) throw new Error('需由另一位有权限的人员复核提议。');
    return { proposalRef: record.ref, expectedProposalVersion: 1, reasonCode: 'lineage_verified', ...evidence(proof) };
  }
  if ((phase === 'submit' && !record.canSubmit) || (phase === 'decide' && !record.canDecide) || !['submit', 'decide'].includes(phase) || !HASH.test(record.contentHash ?? '')) throw new Error('当前人员或阶段不能执行此操作。');
  const base = { authorityRef: record.ref, expectedAuthorityVersion: positive(record.authorityVersion!), expectedContentHash: record.contentHash, ...evidence(proof) };
  if (phase === 'submit') return base;
  if (!['approve', 'reject'].includes(decision)) throw new Error('请明确选择通过或驳回。');
  const prefix = snapshot.family === 'assignment' ? 'assignment' : 'baseline';
  return { ...base, decision, reasonCode: `${prefix}_${decision === 'approve' ? 'verified' : 'rejected'}` };
}

// Memory-only immutable request. An uncertain response retains the exact key
// and payload; manual retry never silently turns into a new logical request.
export function createCaptureSession() {
  let generation = 0;
  let pending: Readonly<{ action: CaptureAction; command: Readonly<Record<string, unknown>>; generation: number }> | null = null;
  return {
    reset() { generation++; pending = null; },
    get generation() { return generation; },
    get pending() { return pending; },
    prepare(action: CaptureAction, command: Record<string, unknown>) {
      if (pending) throw new Error('仍有结果待核对的请求，请先重试或放弃重试并重新读取。');
      const freeze = (value: any): any => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
      pending = Object.freeze({ action, command: freeze(JSON.parse(JSON.stringify(command))), generation }); return pending;
    },
    complete(request: typeof pending) { if (request === pending) pending = null; },
  };
}
