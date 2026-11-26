import type { CaptureFamily, CaptureSnapshot } from './repair-authority-capture';

// Versioned display vocabulary, not a business decision engine. Never render
// arbitrary server/model narrative or turn a next-step code into an action.
export const CHECKLIST_COPY = {
  missing: { label: '缺少此类资料', explanation: '本次授权视图没有此类记录；请核对前置经济事实关联，再由有权限的录单人补录。不能据此认定成本为零。', nextStep: 'open_existing_capture', nextLabel: '核对前置关联，再从本页补录', responsibleRole: 'authorized_maker', roleLabel: '有权限的录单人' },
  draft: { label: '草稿待核对', explanation: '已有草稿，尚未提交独立复核；请由原录单人核对证据和版本。', nextStep: 'review_draft', nextLabel: '由原录单人核对草稿与证据', responsibleRole: 'authorized_maker', roleLabel: '有权限的录单人' },
  pending_independent_review: { label: '待独立复核', explanation: '资料等待有权限且独立于录单／提交人的人员复核；聊天同意和 AI 检查不能代替复核。', nextStep: 'request_independent_review', nextLabel: '请另一位有权限的人员独立复核', responsibleRole: 'independent_authorized_checker', roleLabel: '独立且有权限的复核人' },
  rejected: { label: '已驳回', explanation: '此版本已有驳回记录；请核对驳回事项，通过既有流程修正，不能改写历史结论。', nextStep: 'review_rejected_record', nextLabel: '核对驳回事项，沿原流程修正', responsibleRole: 'authorized_maker', roleLabel: '有权限的录单人' },
  superseded: { label: '已被新版本替代', explanation: '此版本已被替代，只供追溯；请重新查询当前版本及其证据。', nextStep: 'view_current_records', nextLabel: '重新查询当前版本，保留历史', responsibleRole: 'authorized_reviewer', roleLabel: '有权限的核对人员' },
  version_review_required: { label: '工单版本需重新核验', explanation: '资料绑定的工单版本与当前版本不同，适用性需要重新核验；本清单不撤销或改写原审批记录。', nextStep: 'verify_current_version', nextLabel: '重新核验当前版本适用性', responsibleRole: 'authorized_reviewer', roleLabel: '有权限的核对人员' },
  profile_blocked: { label: '成本超出首批范围', explanation: '此记录有非零直接成本或外部成本阻断标记，不符合首批零外部直接成本范围；不得忽略、清零或据此计算工资。', nextStep: 'review_profile_blocker', nextLabel: '核对成本阻断，不能清零或忽略', responsibleRole: 'authorized_reviewer', roleLabel: '有权限的核对人员' },
  recorded_unverified: { label: '已有记录，完整事实链未核验', explanation: '存在已批准或已关联审批的记录；本次单类视图未校验完整事实链、跨类有效版本与工资条件，不代表已可计入工资。', nextStep: 'verify_cross_family_evidence', nextLabel: '继续核对跨类证据，不作工资结论', responsibleRole: 'authorized_reviewer', roleLabel: '有权限的核对人员' },
} as const;

type State = keyof typeof CHECKLIST_COPY;
export interface ReviewChecklistView {
  label: string; workOrderRef: string; profileVersion: number; evidenceFingerprint: string;
  items: Array<{ ref: string | null; version: number | null; evidenceHash: string | null;
    expectedProfileVersion: number; state: State; label: string; explanation: string;
    nextLabel: string; roleLabel: string }>;
}

const FAMILY_LABELS: Record<CaptureFamily, string> = { lineage: '经济事实关联', assignment: '责任员工与三角色归因', baseline: '基线成本与事件声明' };
const NOT_VERIFIED = ['cross_family_current_validity', 'source_content_hash_recomputation', 'formal_contribution', 'wage_readiness'];
const BOUNDARIES = { projectionOnly: true, humanReviewRequired: true, fingerprintIsApprovalToken: false,
  automatedExecutionAllowed: false, formalContributionEnabled: false, wageEnabled: false,
  businessWrites: false, independentReviewBypassed: false };
function invalid(): never { throw new Error('复核清单响应不完整或与当前资料不一致，已隐藏结果；请重新读取，不能据此认定资料齐全。'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: string[]) {
  if (Object.keys(value).length !== expected.length || !expected.every((key) => Object.hasOwn(value, key))) invalid();
}
function positive(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) invalid();
  return value;
}
function digest(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) invalid();
  return value;
}

/** Validate an unsigned, single-family display projection. No hash recomputation,
 * authorization, cross-family verification, persistence or lifecycle mutation.
 * Absence on an older server is visibly unavailable, never an empty/ready result.
 */
export function validateReviewChecklist(snapshot: CaptureSnapshot): ReviewChecklistView | null {
  if (snapshot.reviewChecklist === undefined) return null;
  const value = object(snapshot.reviewChecklist);
  keys(value, ['contractVersion', 'workOrderRef', 'family', 'profileVersion', 'label', 'evidenceFingerprint', 'sourceRecordCount', 'items', 'validity', 'notVerified', 'boundaries']);
  if (value.contractVersion !== 'repair_capture_review_checklist_v1' || value.workOrderRef !== snapshot.workOrderRef
    || value.family !== snapshot.family || value.profileVersion !== snapshot.profileVersion
    || value.label !== FAMILY_LABELS[snapshot.family] || value.validity !== 'snapshot_only_requery_before_use'
    || !/^work-order:[1-9]\d*$/.test(snapshot.workOrderRef)) invalid();
  positive(snapshot.profileVersion);
  const phases = snapshot.family === 'lineage' ? ['propose', 'approve'] : ['draft', 'submit', 'decide'];
  const capabilities = object(snapshot.capabilities); keys(capabilities, phases);
  if (!phases.every((phase) => typeof capabilities[phase] === 'boolean')
    || !phases.some((phase) => capabilities[phase] === true)) invalid();
  if (snapshot.boundaries.firstProfile !== 'repair_zero_external_direct_cost_v1') invalid();
  const boundary = object(value.boundaries); keys(boundary, Object.keys(BOUNDARIES));
  for (const [key, expected] of Object.entries(BOUNDARIES)) if (boundary[key] !== expected) invalid();
  if (!Array.isArray(value.notVerified) || value.notVerified.length !== NOT_VERIFIED.length
    || !NOT_VERIFIED.every((item) => (value.notVerified as unknown[]).includes(item))) invalid();
  if (!Array.isArray(snapshot.records) || snapshot.records.length > 50 || value.sourceRecordCount !== snapshot.records.length
    || !Array.isArray(value.items) || value.items.length !== Math.max(1, snapshot.records.length)) invalid();
  const fingerprint = digest(value.evidenceFingerprint);
  const prefix = { lineage: 'lineage-decision', assignment: 'repair-assignment', baseline: 'repair-cost-event' }[snapshot.family];
  const records = new Map(snapshot.records.map((record) => [record.ref, record]));
  if (records.size !== snapshot.records.length) invalid();
  const seen = new Set<string>();
  const items = value.items.map((input) => {
    const item = object(input);
    keys(item, ['ref', 'version', 'evidenceHash', 'expectedProfileVersion', 'sourceStatus', 'state', 'explanation', 'nextStep', 'responsibleRole']);
    if (typeof item.state !== 'string' || !Object.hasOwn(CHECKLIST_COPY, item.state)) invalid();
    const state = item.state as State; const copy = CHECKLIST_COPY[state];
    if (item.explanation !== copy.explanation || item.nextStep !== copy.nextStep || item.responsibleRole !== copy.responsibleRole) invalid();
    const expectedProfileVersion = positive(item.expectedProfileVersion);
    if (!snapshot.records.length) {
      if (state !== 'missing' || item.ref !== null || item.version !== null || item.evidenceHash !== null
        || item.sourceStatus !== 'not_observed' || expectedProfileVersion !== snapshot.profileVersion) invalid();
    } else {
      if (typeof item.ref !== 'string' || !item.ref.startsWith(`${prefix}:`) || seen.has(item.ref)) invalid();
      digest(item.ref.slice(prefix.length + 1)); seen.add(item.ref);
      const record = records.get(item.ref);
      if (!record || record.workOrderRef !== snapshot.workOrderRef || item.sourceStatus !== record.status
        || expectedProfileVersion !== (snapshot.family === 'lineage' ? record.expectedTargetVersion : record.expectedWorkOrderVersion)
        || item.evidenceHash !== (snapshot.family === 'lineage' ? record.evidenceHash : record.contentHash)
        || item.version !== (snapshot.family === 'lineage' ? null : record.authorityVersion)) invalid();
      digest(item.evidenceHash);
      if (snapshot.family !== 'lineage') positive(item.version);
      // Consistency checks only: reject contradictory state bindings, never
      // infer a better state or treat a hash/status as business acceptance.
      const allowedStatuses = snapshot.family === 'lineage' ? ['pending_checker_approval', 'approved', 'accepted'] : ['draft', 'submitted', 'approved', 'rejected', 'superseded'];
      if (!allowedStatuses.includes(record.status) || state === 'missing') invalid();
      if (record.status === 'rejected' || record.status === 'superseded') {
        if (state !== record.status) invalid();
      } else if (expectedProfileVersion !== snapshot.profileVersion) {
        if (state !== 'version_review_required') invalid();
      } else if (state === 'profile_blocked') {
        if (snapshot.family !== 'baseline') invalid();
      } else if (state !== ({ draft: 'draft', submitted: 'pending_independent_review', pending_checker_approval: 'pending_independent_review', approved: 'recorded_unverified', accepted: 'recorded_unverified' } as Record<string, State>)[record.status]) invalid();
    }
    return { ref: item.ref as string | null, version: item.version as number | null, evidenceHash: item.evidenceHash as string | null,
      expectedProfileVersion, state, label: copy.label, explanation: copy.explanation, nextLabel: copy.nextLabel, roleLabel: copy.roleLabel };
  });
  return { label: FAMILY_LABELS[snapshot.family], workOrderRef: snapshot.workOrderRef,
    profileVersion: snapshot.profileVersion, evidenceFingerprint: fingerprint, items };
}
