import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';

/**
 * SOURCE-ONLY / PRODUCTION-UNWIRED repair responsibility and attribution authority.
 *
 * This file is deliberately not imported by a Nest module, controller, the
 * contribution service, the production source resolver or an adapter. It may
 * only be exercised by bounded tests until later composer and enablement Gates.
 * It does not make repair a formal contribution source; adapters remain 0/4 and
 * resolveRepair continues to fail closed.
 */

export const REPAIR_RESPONSIBILITY_ATTRIBUTION_SCHEMA_VERSION =
  'gov1-s2-repair-responsibility-attribution-source-v1' as const;
export const REPAIR_RESPONSIBILITY_ATTRIBUTION_RULE_VERSION =
  'gov1-s2-repair-three-role-attribution-v1' as const;
export const REPAIR_RESPONSIBILITY_ATTRIBUTION_PROFILE =
  'repair_zero_external_direct_cost_v1' as const;

const DRAFT_PERMISSION = 'gov1.repair.assignment.draft' as const;
const SUBMIT_PERMISSION = 'gov1.repair.assignment.submit' as const;
const DECIDE_PERMISSION = 'gov1.repair.assignment.decide' as const;

const WORK_ORDER_REF = /^work-order:([1-9]\d*)$/;
const EMPLOYEE_REF = /^employee:([1-9]\d*)$/;
const AUTHORITY_REF = /^repair-assignment:([0-9a-f]{64})$/;
const EVIDENCE_REF = /^evidence:[0-9a-f]{64}$/;
const LOWER_HEX_64 = /^[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY = /^repair-assignment-idempotency:[0-9a-f]{64}$/;
const STRICT_UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MYSQL_INT_MAX = 2147483647;

const proposerRoles = new Set([
  'group_leader',
  'business_owner',
  'admin',
  'finance',
  'founder',
  'super_admin',
  'owner',
]);
const checkerRoles = new Set([
  'admin',
  'finance',
  'founder',
  'super_admin',
  'owner',
]);

export const REPAIR_ATTRIBUTION_ROLES = [
  'lead_originator',
  'business_owner',
  'service_owner',
] as const;

export type RepairAttributionRoleV1 = (typeof REPAIR_ATTRIBUTION_ROLES)[number];
export type RepairAssignmentDecisionV1 = 'approve' | 'reject';
export type RepairAssignmentAuthorityStatusV1 =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'superseded';

export interface RepairAttributionInputV1 {
  readonly role: RepairAttributionRoleV1;
  readonly employeeRef: string;
  readonly shareBps: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
}

export interface DraftRepairResponsibilityAttributionAuthorityCommandV1 {
  readonly workOrderRef: string;
  readonly expectedWorkOrderVersion: number;
  readonly responsibilityEmployeeRef: string;
  readonly responsibilityEffectiveFrom: string;
  readonly responsibilityEffectiveTo: string | null;
  readonly responsibilityEvidenceRef: string;
  readonly responsibilityEvidenceHash: string;
  readonly attributions: readonly RepairAttributionInputV1[];
  readonly supersedesAuthorityRef: string | null;
  readonly expectedSupersededAuthorityVersion: number | null;
  readonly idempotencyKey: string;
}

export interface SubmitRepairResponsibilityAttributionAuthorityCommandV1 {
  readonly authorityRef: string;
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface DecideRepairResponsibilityAttributionAuthorityCommandV1 {
  readonly authorityRef: string;
  readonly decision: RepairAssignmentDecisionV1;
  readonly reasonCode: 'assignment_verified' | 'assignment_rejected';
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface RepairResponsibilityAttributionAuthorityReceiptV1 {
  readonly status: 'draft' | 'submitted' | 'approved' | 'rejected';
  readonly schemaVersion: typeof REPAIR_RESPONSIBILITY_ATTRIBUTION_SCHEMA_VERSION;
  readonly ruleVersion: typeof REPAIR_RESPONSIBILITY_ATTRIBUTION_RULE_VERSION;
  readonly profileCode: typeof REPAIR_RESPONSIBILITY_ATTRIBUTION_PROFILE;
  readonly authorityRef: string;
  readonly authorityVersion: number;
  readonly contentHash: string;
  readonly economicRootRef: string;
  readonly workOrderRef: string;
  readonly responsibilityEmployeeRef: string;
  readonly responsibilityEffectiveFrom: string;
  readonly responsibilityEffectiveTo: string | null;
  readonly attributions: readonly Readonly<{
    role: RepairAttributionRoleV1;
    employeeRef: string;
    shareBps: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>[];
  readonly supersedesAuthorityRef: string | null;
  readonly supersededAuthorityRef: string | null;
}

export interface NormalizedRepairAttributionV1 {
  readonly role: RepairAttributionRoleV1;
  readonly employeeId: number;
  readonly shareBps: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
}

export interface NormalizedDraftRepairResponsibilityAttributionAuthorityV1 {
  readonly workOrderId: number;
  readonly expectedWorkOrderVersion: number;
  readonly responsibilityEmployeeId: number;
  readonly responsibilityEffectiveFrom: string;
  readonly responsibilityEffectiveTo: string | null;
  readonly responsibilityEvidenceRef: string;
  readonly responsibilityEvidenceHash: string;
  readonly attributions: readonly NormalizedRepairAttributionV1[];
  readonly supersedesAuthorityId: string | null;
  readonly expectedSupersededAuthorityVersion: number | null;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface NormalizedSubmitRepairResponsibilityAttributionAuthorityV1 {
  readonly authorityId: string;
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface NormalizedDecideRepairResponsibilityAttributionAuthorityV1 {
  readonly authorityId: string;
  readonly decision: RepairAssignmentDecisionV1;
  readonly reasonCode: 'assignment_verified' | 'assignment_rejected';
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

type AssignmentPhaseV1 = 'draft' | 'submit' | 'approve' | 'reject';

interface ScopeV1 {
  companyRef: string;
  businessSectorRef: string;
  storeRef: string;
  customerRef: string;
}

interface ProfileRowV1 extends ScopeV1 {
  work_order_id: string | number;
  lifecycle_status: string;
  version: string | number;
}

interface LockedActorV1 {
  userId: number;
  employeeId: number;
  roleCodes: string[];
}

interface LineageRowV1 {
  work_order_id: string | number;
  economic_root_id: string;
  root_origin_work_order_id: string | number;
  accepted_decision_id: string | number;
}

interface RootRowV1 extends ScopeV1 {
  economic_root_id: string;
  business_domain: string;
  origin_work_order_id: string | number;
}

interface AuthorityRowV1 {
  id: string | number;
  authority_ref: string;
  economic_root_id: string;
  work_order_id: string | number;
  authorized_company_ref: string;
  authorized_business_sector_ref: string;
  authorized_store_ref: string;
  authorized_customer_ref: string;
  profile_code: string;
  authority_version: string | number;
  supersedes_authority_id: string | number | null;
  responsibility_employee_id: string | number;
  responsibility_effective_from: Date | string;
  responsibility_effective_to: Date | string | null;
  responsibility_evidence_ref: string;
  responsibility_evidence_hash: string;
  attribution_rule_version: string;
  content_hash: string;
  expected_work_order_version: string | number;
  status: RepairAssignmentAuthorityStatusV1;
  created_by_user_id: string | number;
  submitted_by_user_id: string | number | null;
  approved_by_user_id: string | number | null;
  rejected_by_user_id: string | number | null;
  superseded_by_user_id: string | number | null;
}

interface AttributionRowV1 {
  id: string | number;
  authority_id: string | number;
  role: RepairAttributionRoleV1;
  employee_id: string | number;
  share_bps: string | number;
  effective_from: Date | string;
  effective_to: Date | string | null;
  rule_version: string;
  evidence_ref: string;
  evidence_hash: string;
  line_hash: string;
}

interface ClaimRowV1 {
  idempotency_key: string;
  phase: AssignmentPhaseV1;
  request_fingerprint: string;
  actor_user_id: string | number;
  state: 'claimed' | 'completed';
  authority_id: string | number | null;
  lifecycle_event_id: string | number | null;
}

interface LifecycleEventRowV1 {
  id: string | number;
  authority_id: string | number;
  event_type: 'drafted' | 'submitted' | 'approved' | 'rejected';
  from_status: RepairAssignmentAuthorityStatusV1 | null;
  to_status: RepairAssignmentAuthorityStatusV1;
  actor_user_id: string | number;
  reason_code: string;
  evidence_ref: string;
  evidence_hash: string;
  request_fingerprint: string;
  authority_content_hash: string;
}

interface ReplayTargetV1 extends ScopeV1 {
  workOrderId: number;
  authorityRef: string | null;
  authorityVersion: number | null;
  contentHash: string | null;
}

class AssignmentIdempotencyRaceV1 extends Error {
  constructor(
    readonly phase: AssignmentPhaseV1,
    readonly idempotencyKey: string,
    readonly requestFingerprint: string,
  ) {
    super('repair_assignment_idempotency_claim_race');
  }
}

function failClosed(code: string, message: string): never {
  throw new ConflictException(`[${code}] ${message}`);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function assertPlainExactObject(
  value: unknown,
  allowedKeys: readonly string[],
  code: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    failClosed(code, '命令必须是普通对象');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    failClosed(code, '命令对象原型不受信任');
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const expected = [...allowedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    failClosed(code, '命令字段不符合固定白名单');
  }
}

function positiveMysqlInt(value: unknown, code: string, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > MYSQL_INT_MAX) {
    failClosed(code, `${label} 必须是 MySQL 正整数`);
  }
  return Number(value);
}

function parseRef(value: unknown, pattern: RegExp, code: string, label: string): string {
  if (typeof value !== 'string') failClosed(code, `${label} 格式无效`);
  const match = pattern.exec(value);
  if (!match) failClosed(code, `${label} 格式无效`);
  return match[1];
}

function parseNumericRef(value: unknown, pattern: RegExp, code: string, label: string): number {
  const raw = parseRef(value, pattern, code, label);
  return positiveMysqlInt(Number(raw), code, label);
}

function safeEvidence(value: unknown, code: string): string {
  if (typeof value !== 'string' || !EVIDENCE_REF.test(value)) {
    failClosed(code, '证据引用必须是固定、脱敏且不可执行的 evidence SHA-256 引用');
  }
  return value;
}

function lowerHash(value: unknown, code: string, label: string): string {
  if (typeof value !== 'string' || !LOWER_HEX_64.test(value)) {
    failClosed(code, `${label} 必须是 lowercase SHA-256`);
  }
  return value;
}

function idempotency(value: unknown): string {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY.test(value)) {
    failClosed('repair_assignment_idempotency_key_invalid', '幂等键格式不符合固定白名单');
  }
  return value;
}

function utcInstant(value: unknown, code: string, label: string): string {
  if (typeof value !== 'string' || !STRICT_UTC_MILLIS.test(value)) {
    failClosed(code, `${label} 必须是毫秒精度 UTC ISO 时间`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    failClosed(code, `${label} 不是有效 UTC 时间`);
  }
  return value;
}

function nullableUtcInstant(value: unknown, code: string, label: string): string | null {
  return value == null ? null : utcInstant(value, code, label);
}

function mysqlUtcMillis(value: string | null): string | null {
  return value == null ? null : `${value.slice(0, 10)} ${value.slice(11, 23)}`;
}

function assertInterval(from: string, to: string | null, code: string): void {
  if (to != null && Date.parse(to) <= Date.parse(from)) {
    failClosed(code, '有效区间结束时间必须晚于开始时间');
  }
}

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function roleOrder(role: RepairAttributionRoleV1): number {
  return REPAIR_ATTRIBUTION_ROLES.indexOf(role);
}

function normalizeAttributions(value: unknown): readonly NormalizedRepairAttributionV1[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 30) {
    failClosed(
      'repair_assignment_attributions_invalid',
      '三角色归因必须包含 3 至 30 条固定结构记录',
    );
  }
  const normalized = value.map((raw, index) => {
    assertPlainExactObject(
      raw,
      [
        'role',
        'employeeRef',
        'shareBps',
        'effectiveFrom',
        'effectiveTo',
        'evidenceRef',
        'evidenceHash',
      ],
      'repair_assignment_attribution_shape_invalid',
    );
    if (!REPAIR_ATTRIBUTION_ROLES.includes(raw.role as RepairAttributionRoleV1)) {
      failClosed('repair_assignment_attribution_role_invalid', `第 ${index + 1} 条归因角色无效`);
    }
    const shareBps = positiveMysqlInt(
      raw.shareBps,
      'repair_assignment_attribution_share_invalid',
      `第 ${index + 1} 条份额`,
    );
    if (shareBps > 10000) {
      failClosed('repair_assignment_attribution_share_invalid', '单条归因份额不得超过 10000 bps');
    }
    const effectiveFrom = utcInstant(
      raw.effectiveFrom,
      'repair_assignment_attribution_interval_invalid',
      `第 ${index + 1} 条开始时间`,
    );
    const effectiveTo = nullableUtcInstant(
      raw.effectiveTo,
      'repair_assignment_attribution_interval_invalid',
      `第 ${index + 1} 条结束时间`,
    );
    assertInterval(effectiveFrom, effectiveTo, 'repair_assignment_attribution_interval_invalid');
    return {
      role: raw.role as RepairAttributionRoleV1,
      employeeId: parseNumericRef(
        raw.employeeRef,
        EMPLOYEE_REF,
        'repair_assignment_employee_ref_invalid',
        '归因员工引用',
      ),
      shareBps,
      effectiveFrom,
      effectiveTo,
      evidenceRef: safeEvidence(raw.evidenceRef, 'repair_assignment_evidence_ref_invalid'),
      evidenceHash: lowerHash(
        raw.evidenceHash,
        'repair_assignment_evidence_hash_invalid',
        '归因证据哈希',
      ),
    };
  });
  normalized.sort((left, right) =>
    roleOrder(left.role) - roleOrder(right.role) ||
    left.employeeId - right.employeeId ||
    left.effectiveFrom.localeCompare(right.effectiveFrom) ||
    String(left.effectiveTo ?? '').localeCompare(String(right.effectiveTo ?? '')),
  );

  const pairKeys = normalized.map((item) => `${item.role}:${item.employeeId}`);
  if (new Set(pairKeys).size !== pairKeys.length) {
    failClosed('repair_assignment_attribution_duplicate', '同一角色与员工只能出现一次');
  }
  for (const role of REPAIR_ATTRIBUTION_ROLES) {
    if (!normalized.some((item) => item.role === role)) {
      failClosed('repair_assignment_attribution_role_missing', `缺少 ${role} 正式归因`);
    }
  }
  const total = normalized.reduce((sum, item) => sum + item.shareBps, 0);
  if (total !== 10000) {
    failClosed('repair_assignment_attribution_total_invalid', '归因份额合计必须精确为 10000 bps');
  }
  const employeeTotals = new Map<number, number>();
  for (const item of normalized) {
    const next = (employeeTotals.get(item.employeeId) ?? 0) + item.shareBps;
    if (next > 10000) {
      failClosed('repair_assignment_employee_share_invalid', '同一员工合并份额不得超过 10000 bps');
    }
    employeeTotals.set(item.employeeId, next);
  }
  return deepFreeze(normalized.map((item) => deepFreeze({ ...item })));
}

export function normalizeDraftRepairResponsibilityAttributionAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedDraftRepairResponsibilityAttributionAuthorityV1> {
  assertPlainExactObject(
    command,
    [
      'workOrderRef',
      'expectedWorkOrderVersion',
      'responsibilityEmployeeRef',
      'responsibilityEffectiveFrom',
      'responsibilityEffectiveTo',
      'responsibilityEvidenceRef',
      'responsibilityEvidenceHash',
      'attributions',
      'supersedesAuthorityRef',
      'expectedSupersededAuthorityVersion',
      'idempotencyKey',
    ],
    'repair_assignment_draft_shape_invalid',
  );
  const responsibilityEffectiveFrom = utcInstant(
    command.responsibilityEffectiveFrom,
    'repair_assignment_responsibility_interval_invalid',
    '责任开始时间',
  );
  const responsibilityEffectiveTo = nullableUtcInstant(
    command.responsibilityEffectiveTo,
    'repair_assignment_responsibility_interval_invalid',
    '责任结束时间',
  );
  assertInterval(
    responsibilityEffectiveFrom,
    responsibilityEffectiveTo,
    'repair_assignment_responsibility_interval_invalid',
  );
  const supersedesAuthorityId = command.supersedesAuthorityRef == null
    ? null
    : parseRef(
        command.supersedesAuthorityRef,
        AUTHORITY_REF,
        'repair_assignment_supersedes_ref_invalid',
        '被替代权威引用',
      );
  const expectedSupersededAuthorityVersion = command.expectedSupersededAuthorityVersion == null
    ? null
    : positiveMysqlInt(
        command.expectedSupersededAuthorityVersion,
        'repair_assignment_expected_version_invalid',
        '被替代权威版本',
      );
  if ((supersedesAuthorityId == null) !== (expectedSupersededAuthorityVersion == null)) {
    failClosed(
      'repair_assignment_supersedes_pair_invalid',
      '被替代权威引用与期望版本必须同时为空或同时存在',
    );
  }
  const base = {
    workOrderId: parseNumericRef(
      command.workOrderRef,
      WORK_ORDER_REF,
      'repair_assignment_work_order_ref_invalid',
      '工单引用',
    ),
    expectedWorkOrderVersion: positiveMysqlInt(
      command.expectedWorkOrderVersion,
      'repair_assignment_expected_version_invalid',
      '工单版本',
    ),
    responsibilityEmployeeId: parseNumericRef(
      command.responsibilityEmployeeRef,
      EMPLOYEE_REF,
      'repair_assignment_employee_ref_invalid',
      '责任员工引用',
    ),
    responsibilityEffectiveFrom,
    responsibilityEffectiveTo,
    responsibilityEvidenceRef: safeEvidence(
      command.responsibilityEvidenceRef,
      'repair_assignment_evidence_ref_invalid',
    ),
    responsibilityEvidenceHash: lowerHash(
      command.responsibilityEvidenceHash,
      'repair_assignment_evidence_hash_invalid',
      '责任证据哈希',
    ),
    attributions: normalizeAttributions(command.attributions),
    supersedesAuthorityId,
    expectedSupersededAuthorityVersion,
    idempotencyKey: idempotency(command.idempotencyKey),
  };
  if (
    base.attributions.some(
      (item) =>
        item.effectiveFrom !== responsibilityEffectiveFrom ||
        item.effectiveTo !== responsibilityEffectiveTo,
    )
  ) {
    failClosed(
      'repair_assignment_attribution_interval_scope_invalid',
      '首版三角色归因区间必须与责任员工区间完全一致',
    );
  }
  return deepFreeze({
    ...base,
    requestFingerprint: canonicalHash(base),
  });
}

export function normalizeSubmitRepairResponsibilityAttributionAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedSubmitRepairResponsibilityAttributionAuthorityV1> {
  assertPlainExactObject(
    command,
    [
      'authorityRef',
      'expectedAuthorityVersion',
      'expectedContentHash',
      'evidenceRef',
      'evidenceHash',
      'idempotencyKey',
    ],
    'repair_assignment_submit_shape_invalid',
  );
  const base = {
    authorityId: parseRef(
      command.authorityRef,
      AUTHORITY_REF,
      'repair_assignment_authority_ref_invalid',
      '权威引用',
    ),
    expectedAuthorityVersion: positiveMysqlInt(
      command.expectedAuthorityVersion,
      'repair_assignment_expected_version_invalid',
      '权威版本',
    ),
    expectedContentHash: lowerHash(
      command.expectedContentHash,
      'repair_assignment_content_hash_invalid',
      '内容哈希',
    ),
    evidenceRef: safeEvidence(command.evidenceRef, 'repair_assignment_evidence_ref_invalid'),
    evidenceHash: lowerHash(
      command.evidenceHash,
      'repair_assignment_evidence_hash_invalid',
      '提交证据哈希',
    ),
    idempotencyKey: idempotency(command.idempotencyKey),
  };
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

export function normalizeDecideRepairResponsibilityAttributionAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedDecideRepairResponsibilityAttributionAuthorityV1> {
  assertPlainExactObject(
    command,
    [
      'authorityRef',
      'decision',
      'reasonCode',
      'expectedAuthorityVersion',
      'expectedContentHash',
      'evidenceRef',
      'evidenceHash',
      'idempotencyKey',
    ],
    'repair_assignment_decision_shape_invalid',
  );
  if (command.decision !== 'approve' && command.decision !== 'reject') {
    failClosed('repair_assignment_decision_invalid', '决策只能是 approve 或 reject');
  }
  const expectedReason = command.decision === 'approve'
    ? 'assignment_verified'
    : 'assignment_rejected';
  if (command.reasonCode !== expectedReason) {
    failClosed('repair_assignment_reason_invalid', '决策与固定理由码不一致');
  }
  const base = {
    authorityId: parseRef(
      command.authorityRef,
      AUTHORITY_REF,
      'repair_assignment_authority_ref_invalid',
      '权威引用',
    ),
    decision: command.decision as RepairAssignmentDecisionV1,
    reasonCode: command.reasonCode as 'assignment_verified' | 'assignment_rejected',
    expectedAuthorityVersion: positiveMysqlInt(
      command.expectedAuthorityVersion,
      'repair_assignment_expected_version_invalid',
      '权威版本',
    ),
    expectedContentHash: lowerHash(
      command.expectedContentHash,
      'repair_assignment_content_hash_invalid',
      '内容哈希',
    ),
    evidenceRef: safeEvidence(command.evidenceRef, 'repair_assignment_evidence_ref_invalid'),
    evidenceHash: lowerHash(
      command.evidenceHash,
      'repair_assignment_evidence_hash_invalid',
      '决策证据哈希',
    ),
    idempotencyKey: idempotency(command.idempotencyKey),
  };
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

function assertTrustedDataSource(dataSource: DataSource): void {
  if (
    !(dataSource instanceof DataSource) ||
    !dataSource.isInitialized ||
    dataSource.options.type !== 'mysql' ||
    !(dataSource.manager instanceof EntityManager) ||
    dataSource.manager.connection !== dataSource
  ) {
    failClosed(
      'repair_assignment_data_source_invalid',
      '只接受后端依赖注入的已初始化 MySQL TypeORM DataSource',
    );
  }
}

function assertTransactionManager(manager: EntityManager, dataSource: DataSource): void {
  const runner = manager.queryRunner;
  if (
    !(manager instanceof EntityManager) ||
    manager.connection !== dataSource ||
    !runner ||
    runner.connection !== dataSource ||
    runner.manager !== manager ||
    !runner.isTransactionActive
  ) {
    failClosed('repair_assignment_transaction_manager_invalid', '事务连接身份无效');
  }
}

function canonicalIsolation(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[-_\s]+/g, ' ');
}

async function assertRepeatableRead(manager: EntityManager): Promise<void> {
  let rows: Array<{ state?: unknown; isolation_level?: unknown; autocommit?: unknown }>;
  try {
    rows = await manager.query(
      `SELECT trx.STATE AS state,
              trx.ISOLATION_LEVEL AS isolation_level,
              trx.AUTOCOMMIT AS autocommit
         FROM performance_schema.events_transactions_current trx
         JOIN performance_schema.threads th ON th.THREAD_ID = trx.THREAD_ID
        WHERE th.PROCESSLIST_ID = CONNECTION_ID()`,
    );
  } catch {
    failClosed('repair_assignment_transaction_oracle_unavailable', '无法核验当前事务');
  }
  if (
    rows.length !== 1 ||
    String(rows[0].state ?? '').trim().toUpperCase() !== 'ACTIVE' ||
    canonicalIsolation(rows[0].isolation_level) !== canonicalIsolation('REPEATABLE READ') ||
    !['NO', '0'].includes(String(rows[0].autocommit ?? '').trim().toUpperCase())
  ) {
    failClosed(
      'repair_assignment_transaction_isolation_invalid',
      '当前连接必须是 ACTIVE REPEATABLE READ 非自动提交事务',
    );
  }
}

function normalizePermissions(value: unknown): string[] {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
    ? parsed
    : [];
}

async function lockCurrentActor(
  currentUser: CurrentUser,
  phase: AssignmentPhaseV1,
  manager: EntityManager,
): Promise<LockedActorV1> {
  if (currentUser.identitySource !== 'trusted_proxy') {
    throw new ForbiddenException('[repair_assignment_identity_source_invalid] 非可信代理身份被拒绝');
  }
  const users = await manager.query(
    `SELECT id, username, status
       FROM users
      WHERE id = ?
      FOR SHARE`,
    [currentUser.id],
  ) as Array<{ id: number; username: string; status: number }>;
  if (
    users.length !== 1 ||
    Number(users[0].status) !== 1 ||
    users[0].username !== currentUser.username
  ) {
    throw new ForbiddenException('[repair_assignment_actor_revoked] 当前人员身份已撤销或变化');
  }
  const bindings = await manager.query(
    `SELECT id, role_id
       FROM user_roles
      WHERE user_id = ?
      ORDER BY role_id, id
      FOR SHARE`,
    [currentUser.id],
  ) as Array<{ id: number; role_id: number }>;
  const roleIds = bindings.map((row) => Number(row.role_id));
  if (roleIds.length !== new Set(roleIds).size) {
    throw new ForbiddenException('[repair_assignment_role_binding_duplicate] 正式角色绑定重复');
  }
  const roles = roleIds.length
    ? await manager.query(
        `SELECT id, code
           FROM roles
          WHERE id IN (${roleIds.map(() => '?').join(',')})
          ORDER BY id
          FOR SHARE`,
        [...roleIds].sort((a, b) => a - b),
      ) as Array<{ id: number; code: string }>
    : [];
  if (roles.length !== roleIds.length) {
    throw new ForbiddenException('[repair_assignment_role_revoked] 正式角色已撤销');
  }
  const allowedRoles = phase === 'approve' || phase === 'reject' ? checkerRoles : proposerRoles;
  const roleCodes = roles.map((role) => role.code);
  if (!roleCodes.some((role) => allowedRoles.has(role))) {
    throw new ForbiddenException('[repair_assignment_role_denied] 当前角色无该阶段权限');
  }
  const employees = await manager.query(
    `SELECT id
       FROM employees
      WHERE linked_user_id = ? AND status = 1
      ORDER BY id
      FOR SHARE`,
    [currentUser.id],
  ) as Array<{ id: number }>;
  if (employees.length !== 1) {
    throw new ForbiddenException('[repair_assignment_employee_binding_invalid] 缺少唯一有效员工绑定');
  }
  return { userId: currentUser.id, employeeId: Number(employees[0].id), roleCodes };
}

function permissionFor(phase: AssignmentPhaseV1): string {
  if (phase === 'draft') return DRAFT_PERMISSION;
  if (phase === 'submit') return SUBMIT_PERMISSION;
  return DECIDE_PERMISSION;
}

async function assertScopeGrant(
  actor: LockedActorV1,
  phase: AssignmentPhaseV1,
  scope: ScopeV1,
  manager: EntityManager,
): Promise<void> {
  const grants = await manager.query(
    `SELECT id, business_sector_ref, store_ref, customer_ref,
            effect, permissions, valid_from, valid_until
       FROM business_scope_grants
      WHERE user_id = ? AND employee_id = ? AND company_ref = ? AND status = 'active'
      ORDER BY id
      FOR SHARE`,
    [actor.userId, actor.employeeId, scope.companyRef],
  ) as Array<Record<string, unknown>>;
  const now = Date.now();
  const matching = grants.filter((grant) => {
    const validFrom = new Date(String(grant.valid_from)).getTime();
    const validUntil = grant.valid_until == null ? null : new Date(String(grant.valid_until)).getTime();
    const permissions = normalizePermissions(grant.permissions);
    return (
      Number.isFinite(validFrom) &&
      validFrom <= now &&
      (validUntil == null || (Number.isFinite(validUntil) && validUntil >= now)) &&
      (permissions.includes('*') || permissions.includes(permissionFor(phase))) &&
      (grant.business_sector_ref == null || grant.business_sector_ref === scope.businessSectorRef) &&
      (grant.store_ref == null || grant.store_ref === scope.storeRef) &&
      (grant.customer_ref == null || grant.customer_ref === scope.customerRef)
    );
  });
  if (matching.some((grant) => grant.effect === 'deny')) {
    throw new ForbiddenException('[repair_assignment_scope_denied] 当前组织范围被明确拒绝');
  }
  if (!matching.some((grant) => grant.effect === 'allow')) {
    throw new ForbiddenException('[repair_assignment_scope_missing] 当前组织范围缺少精确授权');
  }
}

async function loadProfile(workOrderId: number, manager: EntityManager, lock = false): Promise<ProfileRowV1> {
  const rows = await manager.query(
    `SELECT work_order_id, company_ref AS companyRef,
            business_sector_ref AS businessSectorRef,
            store_ref AS storeRef, customer_ref AS customerRef,
            lifecycle_status, version
       FROM repair_work_order_profiles
      WHERE work_order_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [workOrderId],
  ) as ProfileRowV1[];
  if (rows.length !== 1) {
    throw new NotFoundException('[repair_assignment_profile_missing] 汽修工单档案不存在');
  }
  return rows[0];
}

function scopeOf(profile: ProfileRowV1): ScopeV1 {
  return {
    companyRef: profile.companyRef,
    businessSectorRef: profile.businessSectorRef,
    storeRef: profile.storeRef,
    customerRef: profile.customerRef,
  };
}

function assertProfileStable(locked: ProfileRowV1, preview: ProfileRowV1): void {
  if (
    Number(locked.work_order_id) !== Number(preview.work_order_id) ||
    locked.companyRef !== preview.companyRef ||
    locked.businessSectorRef !== preview.businessSectorRef ||
    locked.storeRef !== preview.storeRef ||
    locked.customerRef !== preview.customerRef
  ) {
    failClosed('repair_assignment_scope_drift', '授权前后工单组织范围发生变化');
  }
}

async function lockSourceGraph(
  workOrderId: number,
  actorUserId: number,
  preview: ProfileRowV1,
  manager: EntityManager,
): Promise<{ profile: ProfileRowV1; lineage: LineageRowV1; root: RootRowV1 }> {
  await manager.query(
    `INSERT IGNORE INTO repair_contribution_assignment_mutexes
       (work_order_id, created_by_user_id)
     VALUES (?, ?)`,
    [workOrderId, actorUserId],
  );
  const mutex = await manager.query(
    `SELECT work_order_id
       FROM repair_contribution_assignment_mutexes
      WHERE work_order_id = ?
      FOR UPDATE`,
    [workOrderId],
  ) as Array<{ work_order_id: number }>;
  if (mutex.length !== 1) failClosed('repair_assignment_mutex_missing', '来源权威互斥记录缺失');

  const lineageRows = await manager.query(
    `SELECT work_order_id, economic_root_id, root_origin_work_order_id, accepted_decision_id
       FROM repair_work_order_economic_lineages
      WHERE work_order_id = ?
      FOR UPDATE`,
    [workOrderId],
  ) as LineageRowV1[];
  if (lineageRows.length !== 1) {
    failClosed('repair_assignment_lineage_missing', '工单缺少唯一已接受经济根绑定');
  }
  const lineage = lineageRows[0];
  const roots = await manager.query(
    `SELECT economic_root_id, business_domain, origin_work_order_id,
            company_ref AS companyRef,
            business_sector_ref AS businessSectorRef,
            store_ref AS storeRef, customer_ref AS customerRef
       FROM business_contribution_economic_fact_roots
      WHERE economic_root_id = ?
      FOR UPDATE`,
    [lineage.economic_root_id],
  ) as RootRowV1[];
  if (roots.length !== 1 || roots[0].business_domain !== 'repair') {
    failClosed('repair_assignment_root_invalid', '维修经济根缺失或域不匹配');
  }
  const profile = await loadProfile(workOrderId, manager, true);
  assertProfileStable(profile, preview);
  if (profile.lifecycle_status === 'cancelled') {
    failClosed('repair_assignment_cancelled_work_order', '已取消工单不能创建或变更责任归因权威');
  }
  const root = roots[0];
  if (
    root.companyRef !== profile.companyRef ||
    root.businessSectorRef !== profile.businessSectorRef ||
    root.storeRef !== profile.storeRef ||
    root.customerRef !== profile.customerRef
  ) {
    failClosed('repair_assignment_root_scope_mismatch', '经济根与工单组织范围不一致');
  }
  return { profile, lineage, root };
}

async function lockEmployees(employeeIds: number[], manager: EntityManager): Promise<void> {
  const ids = [...new Set(employeeIds)].sort((a, b) => a - b);
  const rows = await manager.query(
    `SELECT id, status
       FROM employees
      WHERE id IN (${ids.map(() => '?').join(',')})
      ORDER BY id
      FOR SHARE`,
    ids,
  ) as Array<{ id: number; status: number }>;
  if (
    rows.length !== ids.length ||
    rows.some((row, index) => Number(row.id) !== ids[index] || Number(row.status) !== 1)
  ) {
    failClosed('repair_assignment_employee_inactive', '责任或归因员工缺失、重复或已停用');
  }
}

function isDuplicate(error: unknown): boolean {
  const candidate = error as { code?: unknown; errno?: unknown };
  return candidate?.code === 'ER_DUP_ENTRY' || Number(candidate?.errno) === 1062;
}

function mapStorageFailure(error: unknown): never {
  const candidate = error as { code?: unknown; errno?: unknown };
  if (isDuplicate(error)) {
    failClosed('repair_assignment_storage_conflict', '责任归因权威与当前不可变约束冲突');
  }
  if (
    candidate?.code === 'ER_LOCK_WAIT_TIMEOUT' ||
    Number(candidate?.errno) === 1205 ||
    candidate?.code === 'ER_LOCK_DEADLOCK' ||
    Number(candidate?.errno) === 1213
  ) {
    failClosed('repair_assignment_contention', '责任归因权威正被其他事务处理，请重试');
  }
  throw error;
}

async function claimIdempotency(
  phase: AssignmentPhaseV1,
  key: string,
  fingerprint: string,
  actorUserId: number,
  manager: EntityManager,
): Promise<void> {
  try {
    await manager.query(
      `INSERT INTO repair_contribution_assignment_idempotency_claims
         (idempotency_key, phase, request_fingerprint, actor_user_id, state)
       VALUES (?, ?, ?, ?, 'claimed')`,
      [key, phase, fingerprint, actorUserId],
    );
  } catch (error) {
    if (isDuplicate(error)) {
      throw new AssignmentIdempotencyRaceV1(phase, key, fingerprint);
    }
    throw error;
  }
}

async function loadCompletedClaim(
  phase: AssignmentPhaseV1,
  key: string,
  fingerprint: string,
  actorUserId: number,
  manager: EntityManager,
): Promise<ClaimRowV1> {
  const rows = await manager.query(
    `SELECT idempotency_key, phase, request_fingerprint, actor_user_id,
            state, authority_id, lifecycle_event_id
       FROM repair_contribution_assignment_idempotency_claims
      WHERE idempotency_key = ?
      FOR UPDATE`,
    [key],
  ) as ClaimRowV1[];
  if (rows.length !== 1) failClosed('repair_assignment_idempotency_winner_missing', '幂等结果缺失');
  const row = rows[0];
  if (
    row.phase !== phase ||
    row.request_fingerprint !== fingerprint ||
    Number(row.actor_user_id) !== actorUserId
  ) {
    failClosed('repair_assignment_idempotency_conflict', '幂等键已绑定其他请求或人员');
  }
  if (row.state !== 'completed' || row.authority_id == null || row.lifecycle_event_id == null) {
    failClosed('repair_assignment_idempotency_incomplete', '幂等结果未完整提交');
  }
  return row;
}

async function completeClaim(
  key: string,
  authorityId: number,
  eventId: number,
  manager: EntityManager,
): Promise<void> {
  const result = await manager.query(
    `UPDATE repair_contribution_assignment_idempotency_claims
        SET state = 'completed', authority_id = ?, lifecycle_event_id = ?,
            completed_at = CURRENT_TIMESTAMP(6)
      WHERE idempotency_key = ? AND state = 'claimed'
        AND authority_id IS NULL AND lifecycle_event_id IS NULL`,
    [authorityId, eventId, key],
  );
  if (Number(result?.affectedRows ?? -1) !== 1) {
    failClosed('repair_assignment_idempotency_completion_failed', '幂等结果无法完整封存');
  }
}

async function loadAuthorityByOpaqueRef(
  authorityRef: string,
  manager: EntityManager,
  lock = false,
): Promise<AuthorityRowV1 | null> {
  const rows = await manager.query(
    `SELECT id, authority_ref, economic_root_id, work_order_id,
            authorized_company_ref, authorized_business_sector_ref,
            authorized_store_ref, authorized_customer_ref, profile_code,
            authority_version, supersedes_authority_id,
            responsibility_employee_id,
            CONCAT(LEFT(DATE_FORMAT(responsibility_effective_from, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS responsibility_effective_from,
            CASE WHEN responsibility_effective_to IS NULL THEN NULL
              ELSE CONCAT(LEFT(DATE_FORMAT(responsibility_effective_to, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
            END AS responsibility_effective_to,
            responsibility_evidence_ref,
            responsibility_evidence_hash, attribution_rule_version,
            content_hash, expected_work_order_version, status,
            created_by_user_id, submitted_by_user_id, approved_by_user_id,
            rejected_by_user_id, superseded_by_user_id
       FROM repair_contribution_assignment_authorities
      WHERE authority_ref = ?${lock ? ' FOR UPDATE' : ''}`,
    [authorityRef],
  ) as AuthorityRowV1[];
  if (rows.length > 1) failClosed('repair_assignment_authority_corrupt', '权威引用不唯一');
  return rows[0] ?? null;
}

async function loadAttributions(authorityId: number, manager: EntityManager): Promise<AttributionRowV1[]> {
  return manager.query(
    `SELECT id, authority_id, role, employee_id, share_bps,
            CONCAT(LEFT(DATE_FORMAT(effective_from, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS effective_from,
            CASE WHEN effective_to IS NULL THEN NULL
              ELSE CONCAT(LEFT(DATE_FORMAT(effective_to, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
            END AS effective_to,
            rule_version,
            evidence_ref, evidence_hash, line_hash
       FROM repair_contribution_assignment_attributions
      WHERE authority_id = ?
      ORDER BY FIELD(role, 'lead_originator', 'business_owner', 'service_owner'), employee_id
      FOR UPDATE`,
    [authorityId],
  ) as Promise<AttributionRowV1[]>;
}

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) failClosed('repair_assignment_time_corrupt', '数据库时间无效');
  return date.toISOString();
}

function canonicalAuthorityContent(
  authority: Omit<AuthorityRowV1, 'id' | 'authority_ref' | 'content_hash' | 'status' |
    'created_by_user_id' | 'submitted_by_user_id' | 'approved_by_user_id' |
    'rejected_by_user_id' | 'superseded_by_user_id'>,
  attributions: readonly Omit<AttributionRowV1, 'id' | 'authority_id' | 'line_hash'>[],
): string {
  return canonicalHash({
    schemaVersion: REPAIR_RESPONSIBILITY_ATTRIBUTION_SCHEMA_VERSION,
    economicRootId: authority.economic_root_id,
    workOrderId: Number(authority.work_order_id),
    scope: {
      companyRef: authority.authorized_company_ref,
      businessSectorRef: authority.authorized_business_sector_ref,
      storeRef: authority.authorized_store_ref,
      customerRef: authority.authorized_customer_ref,
    },
    profileCode: authority.profile_code,
    authorityVersion: Number(authority.authority_version),
    supersedesAuthorityId: authority.supersedes_authority_id == null
      ? null
      : Number(authority.supersedes_authority_id),
    responsibility: {
      employeeId: Number(authority.responsibility_employee_id),
      effectiveFrom: toIso(authority.responsibility_effective_from),
      effectiveTo: authority.responsibility_effective_to == null
        ? null
        : toIso(authority.responsibility_effective_to),
      evidenceRef: authority.responsibility_evidence_ref,
      evidenceHash: authority.responsibility_evidence_hash,
    },
    attributionRuleVersion: authority.attribution_rule_version,
    expectedWorkOrderVersion: Number(authority.expected_work_order_version),
    attributions: attributions.map((line) => ({
      role: line.role,
      employeeId: Number(line.employee_id),
      shareBps: Number(line.share_bps),
      effectiveFrom: toIso(line.effective_from),
      effectiveTo: line.effective_to == null ? null : toIso(line.effective_to),
      ruleVersion: line.rule_version,
      evidenceRef: line.evidence_ref,
      evidenceHash: line.evidence_hash,
    })),
  });
}

function assertAuthorityContent(authority: AuthorityRowV1, lines: AttributionRowV1[]): void {
  const normalizedLines = lines.map((line) => ({
    role: line.role,
    employeeId: Number(line.employee_id),
    shareBps: Number(line.share_bps),
    effectiveFrom: toIso(line.effective_from),
    effectiveTo: line.effective_to == null ? null : toIso(line.effective_to),
    evidenceRef: line.evidence_ref,
    evidenceHash: line.evidence_hash,
  }));
  normalizeAttributions(normalizedLines.map((line) => ({
    role: line.role,
    employeeRef: `employee:${line.employeeId}`,
    shareBps: line.shareBps,
    effectiveFrom: line.effectiveFrom,
    effectiveTo: line.effectiveTo,
    evidenceRef: line.evidenceRef,
    evidenceHash: line.evidenceHash,
  })));
  if (
    authority.profile_code !== REPAIR_RESPONSIBILITY_ATTRIBUTION_PROFILE ||
    authority.attribution_rule_version !== REPAIR_RESPONSIBILITY_ATTRIBUTION_RULE_VERSION ||
    lines.some((line) => line.rule_version !== REPAIR_RESPONSIBILITY_ATTRIBUTION_RULE_VERSION)
  ) {
    failClosed('repair_assignment_rule_version_mismatch', '责任归因规则版本不匹配');
  }
  const responsibilityEffectiveFrom = toIso(authority.responsibility_effective_from);
  const responsibilityEffectiveTo = authority.responsibility_effective_to == null
    ? null
    : toIso(authority.responsibility_effective_to);
  if (
    lines.some(
      (line) =>
        toIso(line.effective_from) !== responsibilityEffectiveFrom ||
        (line.effective_to == null ? null : toIso(line.effective_to)) !==
          responsibilityEffectiveTo,
    )
  ) {
    failClosed(
      'repair_assignment_attribution_interval_scope_invalid',
      '数据库三角色归因区间与责任员工区间不一致',
    );
  }
  const actual = canonicalAuthorityContent(authority, lines);
  if (actual !== authority.content_hash) {
    failClosed('repair_assignment_content_hash_mismatch', '权威内容哈希与数据库事实不一致');
  }
  for (const line of lines) {
    const expectedLineHash = canonicalHash({
      authorityContentHash: authority.content_hash,
      role: line.role,
      employeeId: Number(line.employee_id),
      shareBps: Number(line.share_bps),
      effectiveFrom: toIso(line.effective_from),
      effectiveTo: line.effective_to == null ? null : toIso(line.effective_to),
      ruleVersion: line.rule_version,
      evidenceRef: line.evidence_ref,
      evidenceHash: line.evidence_hash,
    });
    if (line.line_hash !== expectedLineHash) {
      failClosed('repair_assignment_line_hash_mismatch', '归因行哈希与数据库事实不一致');
    }
  }
}

async function insertEvent(
  authorityId: number,
  eventType: 'drafted' | 'submitted' | 'approved' | 'rejected' | 'superseded',
  fromStatus: RepairAssignmentAuthorityStatusV1 | null,
  toStatus: RepairAssignmentAuthorityStatusV1,
  actorUserId: number,
  reasonCode: string,
  evidenceRef: string,
  evidenceHash: string,
  requestFingerprint: string,
  authorityContentHash: string,
  manager: EntityManager,
): Promise<number> {
  const eventRef = randomBytes(32).toString('hex');
  await manager.query(
    `INSERT INTO repair_contribution_assignment_lifecycle_events
       (event_ref, authority_id, event_type, from_status, to_status,
        actor_user_id, reason_code, evidence_ref, evidence_hash,
        request_fingerprint, authority_content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventRef,
      authorityId,
      eventType,
      fromStatus,
      toStatus,
      actorUserId,
      reasonCode,
      evidenceRef,
      evidenceHash,
      requestFingerprint,
      authorityContentHash,
    ],
  );
  const rows = await manager.query(
    `SELECT id
       FROM repair_contribution_assignment_lifecycle_events
      WHERE event_ref = ?`,
    [eventRef],
  ) as Array<{ id: number }>;
  if (rows.length !== 1) failClosed('repair_assignment_event_missing', '生命周期事件写入后无法唯一读取');
  return Number(rows[0].id);
}

async function receiptFor(
  authority: AuthorityRowV1,
  lines: AttributionRowV1[],
  status: RepairResponsibilityAttributionAuthorityReceiptV1['status'],
  manager: EntityManager,
): Promise<RepairResponsibilityAttributionAuthorityReceiptV1> {
  const superseded = authority.supersedes_authority_id == null
    ? null
    : await manager.query(
        `SELECT authority_ref
           FROM repair_contribution_assignment_authorities
          WHERE id = ?`,
        [authority.supersedes_authority_id],
      ) as Array<{ authority_ref: string }>;
  if (superseded && superseded.length !== 1) {
    failClosed('repair_assignment_supersedes_missing', '被替代权威不存在');
  }
  return deepFreeze({
    status,
    schemaVersion: REPAIR_RESPONSIBILITY_ATTRIBUTION_SCHEMA_VERSION,
    ruleVersion: REPAIR_RESPONSIBILITY_ATTRIBUTION_RULE_VERSION,
    profileCode: REPAIR_RESPONSIBILITY_ATTRIBUTION_PROFILE,
    authorityRef: `repair-assignment:${authority.authority_ref}`,
    authorityVersion: Number(authority.authority_version),
    contentHash: authority.content_hash,
    economicRootRef: `economic-root:${authority.economic_root_id}`,
    workOrderRef: `work-order:${Number(authority.work_order_id)}`,
    responsibilityEmployeeRef: `employee:${Number(authority.responsibility_employee_id)}`,
    responsibilityEffectiveFrom: toIso(authority.responsibility_effective_from),
    responsibilityEffectiveTo: authority.responsibility_effective_to == null
      ? null
      : toIso(authority.responsibility_effective_to),
    attributions: lines.map((line) => deepFreeze({
      role: line.role,
      employeeRef: `employee:${Number(line.employee_id)}`,
      shareBps: Number(line.share_bps),
      effectiveFrom: toIso(line.effective_from),
      effectiveTo: line.effective_to == null ? null : toIso(line.effective_to),
    })),
    supersedesAuthorityRef: superseded == null
      ? null
      : `repair-assignment:${superseded[0].authority_ref}`,
    supersededAuthorityRef: status === 'approved' && superseded != null
      ? `repair-assignment:${superseded[0].authority_ref}`
      : null,
  });
}

async function replayReceipt(
  phase: AssignmentPhaseV1,
  key: string,
  fingerprint: string,
  actorUserId: number,
  expectedEvidenceRef: string,
  expectedEvidenceHash: string,
  expectedTarget: ReplayTargetV1,
  manager: EntityManager,
): Promise<RepairResponsibilityAttributionAuthorityReceiptV1> {
  const claim = await loadCompletedClaim(phase, key, fingerprint, actorUserId, manager);
  const rows = await manager.query(
    `SELECT authority_ref
       FROM repair_contribution_assignment_authorities
      WHERE id = ?`,
    [claim.authority_id],
  ) as Array<{ authority_ref: string }>;
  if (rows.length !== 1) failClosed('repair_assignment_idempotency_graph_corrupt', '幂等权威结果缺失');
  const authority = await loadAuthorityByOpaqueRef(rows[0].authority_ref, manager, true);
  if (!authority) failClosed('repair_assignment_idempotency_graph_corrupt', '幂等权威结果缺失');
  if (
    Number(authority.work_order_id) !== expectedTarget.workOrderId ||
    authority.authorized_company_ref !== expectedTarget.companyRef ||
    authority.authorized_business_sector_ref !== expectedTarget.businessSectorRef ||
    authority.authorized_store_ref !== expectedTarget.storeRef ||
    authority.authorized_customer_ref !== expectedTarget.customerRef ||
    (expectedTarget.authorityRef != null && authority.authority_ref !== expectedTarget.authorityRef) ||
    (expectedTarget.authorityVersion != null &&
      Number(authority.authority_version) !== expectedTarget.authorityVersion) ||
    (expectedTarget.contentHash != null && authority.content_hash !== expectedTarget.contentHash)
  ) {
    failClosed('repair_assignment_idempotency_graph_corrupt', '幂等权威目标或授权范围不一致');
  }
  const lines = await loadAttributions(Number(authority.id), manager);
  assertAuthorityContent(authority, lines);
  const eventRows = await manager.query(
    `SELECT id, authority_id, event_type, from_status, to_status,
            actor_user_id, reason_code, evidence_ref, evidence_hash,
            request_fingerprint, authority_content_hash
       FROM repair_contribution_assignment_lifecycle_events
      WHERE id = ?
      FOR UPDATE`,
    [claim.lifecycle_event_id],
  ) as LifecycleEventRowV1[];
  const expectedEvent = phase === 'draft'
    ? {
        eventType: 'drafted',
        fromStatus: null,
        toStatus: 'draft',
        reasonCode: 'assignment_drafted',
      }
    : phase === 'submit'
      ? {
          eventType: 'submitted',
          fromStatus: 'draft',
          toStatus: 'submitted',
          reasonCode: 'assignment_submitted',
        }
      : phase === 'approve'
        ? {
            eventType: 'approved',
            fromStatus: 'submitted',
            toStatus: 'approved',
            reasonCode: 'assignment_verified',
          }
        : {
            eventType: 'rejected',
            fromStatus: 'submitted',
            toStatus: 'rejected',
            reasonCode: 'assignment_rejected',
          };
  const event = eventRows[0];
  if (
    eventRows.length !== 1 ||
    Number(event.authority_id) !== Number(authority.id) ||
    event.event_type !== expectedEvent.eventType ||
    event.from_status !== expectedEvent.fromStatus ||
    event.to_status !== expectedEvent.toStatus ||
    Number(event.actor_user_id) !== actorUserId ||
    event.reason_code !== expectedEvent.reasonCode ||
    event.evidence_ref !== expectedEvidenceRef ||
    event.evidence_hash !== expectedEvidenceHash ||
    event.request_fingerprint !== fingerprint ||
    event.authority_content_hash !== authority.content_hash
  ) {
    failClosed('repair_assignment_idempotency_graph_corrupt', '幂等事件与权威结果不一致');
  }
  const authorityActorMatches = phase === 'draft'
    ? Number(authority.created_by_user_id) === actorUserId
    : phase === 'submit'
      ? Number(authority.created_by_user_id) === actorUserId &&
        Number(authority.submitted_by_user_id) === actorUserId
      : phase === 'approve'
        ? Number(authority.approved_by_user_id) === actorUserId &&
          Number(authority.created_by_user_id) !== actorUserId &&
          Number(authority.submitted_by_user_id) !== actorUserId
        : Number(authority.rejected_by_user_id) === actorUserId &&
          Number(authority.created_by_user_id) !== actorUserId &&
          Number(authority.submitted_by_user_id) !== actorUserId;
  if (!authorityActorMatches) {
    failClosed('repair_assignment_idempotency_graph_corrupt', '幂等权威 maker-checker 图不一致');
  }
  const allowedCurrentStatuses: Readonly<Record<AssignmentPhaseV1, readonly RepairAssignmentAuthorityStatusV1[]>> = {
    draft: ['draft', 'submitted', 'approved', 'rejected', 'superseded'],
    submit: ['submitted', 'approved', 'rejected', 'superseded'],
    approve: ['approved', 'superseded'],
    reject: ['rejected'],
  };
  if (!allowedCurrentStatuses[phase].includes(authority.status)) {
    failClosed('repair_assignment_idempotency_graph_corrupt', '幂等结果生命周期不一致');
  }
  const status = phase === 'draft'
    ? 'draft'
    : phase === 'submit'
      ? 'submitted'
      : phase === 'approve'
        ? 'approved'
        : 'rejected';
  return receiptFor(authority, lines, status, manager);
}

async function minimalAuthorityLocator(
  authorityRef: string,
  manager: EntityManager,
): Promise<number | null> {
  const rows = await manager.query(
    `SELECT work_order_id
       FROM repair_contribution_assignment_authorities
      WHERE authority_ref = ?`,
    [authorityRef],
  ) as Array<{ work_order_id: number }>;
  if (rows.length > 1) failClosed('repair_assignment_authority_corrupt', '权威引用不唯一');
  return rows.length === 1 ? Number(rows[0].work_order_id) : null;
}

function scopeOrAuthorityUnavailable(): never {
  throw new ForbiddenException(
    '[repair_assignment_scope_or_authority_unavailable] 权威不存在或当前组织范围不可用',
  );
}

async function runDraft(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedDraftRepairResponsibilityAttributionAuthorityV1>,
  replayOnly: boolean,
): Promise<RepairResponsibilityAttributionAuthorityReceiptV1> {
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, 'draft', manager);
    let preview: ProfileRowV1;
    try {
      preview = await loadProfile(normalized.workOrderId, manager);
      await assertScopeGrant(actor, 'draft', scopeOf(preview), manager);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        scopeOrAuthorityUnavailable();
      }
      throw error;
    }
    if (replayOnly) {
      return replayReceipt(
        'draft',
        normalized.idempotencyKey,
        normalized.requestFingerprint,
        actor.userId,
        normalized.responsibilityEvidenceRef,
        normalized.responsibilityEvidenceHash,
        {
          ...scopeOf(preview),
          workOrderId: normalized.workOrderId,
          authorityRef: null,
          authorityVersion: null,
          contentHash: null,
        },
        manager,
      );
    }
    await claimIdempotency(
      'draft',
      normalized.idempotencyKey,
      normalized.requestFingerprint,
      actor.userId,
      manager,
    );
    const { profile, root } = await lockSourceGraph(
      normalized.workOrderId,
      actor.userId,
      preview,
      manager,
    );
    if (Number(profile.version) !== normalized.expectedWorkOrderVersion) {
      failClosed('repair_assignment_work_order_version_conflict', '工单版本已变化');
    }
    const existing = await manager.query(
      `SELECT id, authority_ref, authority_version, supersedes_authority_id, status
         FROM repair_contribution_assignment_authorities
        WHERE economic_root_id = ?
        ORDER BY authority_version, id
        FOR UPDATE`,
      [root.economic_root_id],
    ) as Array<Pick<AuthorityRowV1,
      'id' | 'authority_ref' | 'authority_version' | 'supersedes_authority_id' | 'status'>>;
    if (existing.some((row) => row.status === 'draft' || row.status === 'submitted')) {
      failClosed('repair_assignment_open_authority_exists', '同一经济根已有待处理责任归因版本');
    }
    const approved = existing.filter((row) => row.status === 'approved');
    if (approved.length > 1) failClosed('repair_assignment_approved_authority_ambiguous', '正式权威不唯一');
    const currentApproved = approved[0] ?? null;
    if (currentApproved == null) {
      if (
        normalized.supersedesAuthorityId != null ||
        normalized.expectedSupersededAuthorityVersion != null
      ) {
        failClosed('repair_assignment_supersedes_mismatch', '当前没有可替代的正式权威');
      }
    } else if (
      normalized.supersedesAuthorityId !== currentApproved.authority_ref ||
      normalized.expectedSupersededAuthorityVersion !== Number(currentApproved.authority_version)
    ) {
      failClosed('repair_assignment_supersedes_mismatch', '被替代权威引用或版本不匹配');
    }
    const authorityVersion = existing.reduce(
      (max, row) => Math.max(max, Number(row.authority_version)),
      0,
    ) + 1;
    const employeeIds = [
      normalized.responsibilityEmployeeId,
      ...normalized.attributions.map((item) => item.employeeId),
    ];
    await lockEmployees(employeeIds, manager);

    const authorityRef = randomBytes(32).toString('hex');
    const authorityShape = {
      economic_root_id: root.economic_root_id,
      work_order_id: normalized.workOrderId,
      authorized_company_ref: profile.companyRef,
      authorized_business_sector_ref: profile.businessSectorRef,
      authorized_store_ref: profile.storeRef,
      authorized_customer_ref: profile.customerRef,
      profile_code: REPAIR_RESPONSIBILITY_ATTRIBUTION_PROFILE,
      authority_version: authorityVersion,
      supersedes_authority_id: currentApproved == null ? null : Number(currentApproved.id),
      responsibility_employee_id: normalized.responsibilityEmployeeId,
      responsibility_effective_from: normalized.responsibilityEffectiveFrom,
      responsibility_effective_to: normalized.responsibilityEffectiveTo,
      responsibility_evidence_ref: normalized.responsibilityEvidenceRef,
      responsibility_evidence_hash: normalized.responsibilityEvidenceHash,
      attribution_rule_version: REPAIR_RESPONSIBILITY_ATTRIBUTION_RULE_VERSION,
      expected_work_order_version: normalized.expectedWorkOrderVersion,
    };
    const lineShapes = normalized.attributions.map((item) => ({
      role: item.role,
      employee_id: item.employeeId,
      share_bps: item.shareBps,
      effective_from: item.effectiveFrom,
      effective_to: item.effectiveTo,
      rule_version: REPAIR_RESPONSIBILITY_ATTRIBUTION_RULE_VERSION,
      evidence_ref: item.evidenceRef,
      evidence_hash: item.evidenceHash,
    }));
    const contentHash = canonicalAuthorityContent(authorityShape, lineShapes);
    await manager.query(
      `INSERT INTO repair_contribution_assignment_authorities (
         authority_ref, economic_root_id, work_order_id,
         authorized_company_ref, authorized_business_sector_ref,
         authorized_store_ref, authorized_customer_ref, profile_code,
         authority_version, supersedes_authority_id,
         responsibility_employee_id, responsibility_effective_from,
         responsibility_effective_to, responsibility_evidence_ref,
         responsibility_evidence_hash, attribution_rule_version,
         content_hash, expected_work_order_version, status, created_by_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
        authorityRef,
        authorityShape.economic_root_id,
        authorityShape.work_order_id,
        authorityShape.authorized_company_ref,
        authorityShape.authorized_business_sector_ref,
        authorityShape.authorized_store_ref,
        authorityShape.authorized_customer_ref,
        authorityShape.profile_code,
        authorityShape.authority_version,
        authorityShape.supersedes_authority_id,
        authorityShape.responsibility_employee_id,
        mysqlUtcMillis(authorityShape.responsibility_effective_from),
        mysqlUtcMillis(authorityShape.responsibility_effective_to),
        authorityShape.responsibility_evidence_ref,
        authorityShape.responsibility_evidence_hash,
        authorityShape.attribution_rule_version,
        contentHash,
        authorityShape.expected_work_order_version,
        actor.userId,
      ],
    );
    const inserted = await loadAuthorityByOpaqueRef(authorityRef, manager, true);
    if (!inserted) failClosed('repair_assignment_authority_insert_missing', '权威草稿写入后缺失');
    for (const line of lineShapes) {
      const lineHash = canonicalHash({
        authorityContentHash: contentHash,
        role: line.role,
        employeeId: line.employee_id,
        shareBps: line.share_bps,
        effectiveFrom: line.effective_from,
        effectiveTo: line.effective_to,
        ruleVersion: line.rule_version,
        evidenceRef: line.evidence_ref,
        evidenceHash: line.evidence_hash,
      });
      await manager.query(
        `INSERT INTO repair_contribution_assignment_attributions (
           authority_id, role, employee_id, share_bps, effective_from,
           effective_to, rule_version, evidence_ref, evidence_hash, line_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inserted.id,
          line.role,
          line.employee_id,
          line.share_bps,
          mysqlUtcMillis(line.effective_from),
          mysqlUtcMillis(line.effective_to),
          line.rule_version,
          line.evidence_ref,
          line.evidence_hash,
          lineHash,
        ],
      );
    }
    const lines = await loadAttributions(Number(inserted.id), manager);
    assertAuthorityContent(inserted, lines);
    const eventId = await insertEvent(
      Number(inserted.id),
      'drafted',
      null,
      'draft',
      actor.userId,
      'assignment_drafted',
      normalized.responsibilityEvidenceRef,
      normalized.responsibilityEvidenceHash,
      normalized.requestFingerprint,
      contentHash,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, Number(inserted.id), eventId, manager);
    return receiptFor(inserted, lines, 'draft', manager);
  });
}

async function runSubmit(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedSubmitRepairResponsibilityAttributionAuthorityV1>,
  replayOnly: boolean,
): Promise<RepairResponsibilityAttributionAuthorityReceiptV1> {
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, 'submit', manager);
    const locator = await minimalAuthorityLocator(normalized.authorityId, manager);
    if (locator == null) scopeOrAuthorityUnavailable();
    let preview: ProfileRowV1;
    try {
      preview = await loadProfile(locator, manager);
      await assertScopeGrant(actor, 'submit', scopeOf(preview), manager);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        scopeOrAuthorityUnavailable();
      }
      throw error;
    }
    if (replayOnly) {
      return replayReceipt(
        'submit',
        normalized.idempotencyKey,
        normalized.requestFingerprint,
        actor.userId,
        normalized.evidenceRef,
        normalized.evidenceHash,
        {
          ...scopeOf(preview),
          workOrderId: locator,
          authorityRef: normalized.authorityId,
          authorityVersion: normalized.expectedAuthorityVersion,
          contentHash: normalized.expectedContentHash,
        },
        manager,
      );
    }
    await claimIdempotency(
      'submit',
      normalized.idempotencyKey,
      normalized.requestFingerprint,
      actor.userId,
      manager,
    );
    const { profile } = await lockSourceGraph(locator, actor.userId, preview, manager);
    const authority = await loadAuthorityByOpaqueRef(normalized.authorityId, manager, true);
    if (!authority || Number(authority.work_order_id) !== locator) scopeOrAuthorityUnavailable();
    const lines = await loadAttributions(Number(authority.id), manager);
    if (authority.status !== 'draft') {
      failClosed('repair_assignment_status_conflict', '只有 draft 权威可以提交');
    }
    if (
      Number(authority.created_by_user_id) !== actor.userId ||
      Number(authority.authority_version) !== normalized.expectedAuthorityVersion ||
      authority.content_hash !== normalized.expectedContentHash
    ) {
      failClosed('repair_assignment_submit_mismatch', '提交人、版本或内容哈希不匹配');
    }
    if (Number(profile.version) !== Number(authority.expected_work_order_version)) {
      failClosed('repair_assignment_work_order_version_conflict', '工单版本已变化');
    }
    if (
      authority.authorized_company_ref !== profile.companyRef ||
      authority.authorized_business_sector_ref !== profile.businessSectorRef ||
      authority.authorized_store_ref !== profile.storeRef ||
      authority.authorized_customer_ref !== profile.customerRef
    ) {
      failClosed('repair_assignment_authority_scope_drift', '草稿组织范围与当前工单不一致');
    }
    assertAuthorityContent(authority, lines);
    await lockEmployees([
      Number(authority.responsibility_employee_id),
      ...lines.map((line) => Number(line.employee_id)),
    ], manager);
    const result = await manager.query(
      `UPDATE repair_contribution_assignment_authorities
          SET status = 'submitted', submitted_by_user_id = ?, submitted_at = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status = 'draft'`,
      [actor.userId, authority.id],
    );
    if (Number(result?.affectedRows ?? -1) !== 1) {
      failClosed('repair_assignment_status_conflict', '权威提交状态竞争失败');
    }
    authority.status = 'submitted';
    authority.submitted_by_user_id = actor.userId;
    const eventId = await insertEvent(
      Number(authority.id),
      'submitted',
      'draft',
      'submitted',
      actor.userId,
      'assignment_submitted',
      normalized.evidenceRef,
      normalized.evidenceHash,
      normalized.requestFingerprint,
      authority.content_hash,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, Number(authority.id), eventId, manager);
    return receiptFor(authority, lines, 'submitted', manager);
  });
}

async function runDecision(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedDecideRepairResponsibilityAttributionAuthorityV1>,
  replayOnly: boolean,
): Promise<RepairResponsibilityAttributionAuthorityReceiptV1> {
  const phase: AssignmentPhaseV1 = normalized.decision === 'approve' ? 'approve' : 'reject';
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, phase, manager);
    const locator = await minimalAuthorityLocator(normalized.authorityId, manager);
    if (locator == null) scopeOrAuthorityUnavailable();
    let preview: ProfileRowV1;
    try {
      preview = await loadProfile(locator, manager);
      await assertScopeGrant(actor, phase, scopeOf(preview), manager);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        scopeOrAuthorityUnavailable();
      }
      throw error;
    }
    if (replayOnly) {
      return replayReceipt(
        phase,
        normalized.idempotencyKey,
        normalized.requestFingerprint,
        actor.userId,
        normalized.evidenceRef,
        normalized.evidenceHash,
        {
          ...scopeOf(preview),
          workOrderId: locator,
          authorityRef: normalized.authorityId,
          authorityVersion: normalized.expectedAuthorityVersion,
          contentHash: normalized.expectedContentHash,
        },
        manager,
      );
    }
    await claimIdempotency(
      phase,
      normalized.idempotencyKey,
      normalized.requestFingerprint,
      actor.userId,
      manager,
    );
    const { profile, root } = await lockSourceGraph(locator, actor.userId, preview, manager);
    const allAuthorities = await manager.query(
      `SELECT id, authority_ref, economic_root_id, work_order_id,
              authorized_company_ref, authorized_business_sector_ref,
              authorized_store_ref, authorized_customer_ref, profile_code,
              authority_version, supersedes_authority_id,
              responsibility_employee_id,
              CONCAT(LEFT(DATE_FORMAT(responsibility_effective_from, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
                AS responsibility_effective_from,
              CASE WHEN responsibility_effective_to IS NULL THEN NULL
                ELSE CONCAT(LEFT(DATE_FORMAT(responsibility_effective_to, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              END AS responsibility_effective_to,
              responsibility_evidence_ref,
              responsibility_evidence_hash, attribution_rule_version,
              content_hash, expected_work_order_version, status,
              created_by_user_id, submitted_by_user_id, approved_by_user_id,
              rejected_by_user_id, superseded_by_user_id
         FROM repair_contribution_assignment_authorities
        WHERE economic_root_id = ?
        ORDER BY authority_version, id
        FOR UPDATE`,
      [root.economic_root_id],
    ) as AuthorityRowV1[];
    const authority = allAuthorities.find((row) => row.authority_ref === normalized.authorityId);
    if (!authority || Number(authority.work_order_id) !== locator) scopeOrAuthorityUnavailable();
    const lines = await loadAttributions(Number(authority.id), manager);
    if (authority.status !== 'submitted') {
      failClosed('repair_assignment_status_conflict', '只有 submitted 权威可以审批或拒绝');
    }
    if (
      Number(authority.authority_version) !== normalized.expectedAuthorityVersion ||
      authority.content_hash !== normalized.expectedContentHash
    ) {
      failClosed('repair_assignment_decision_mismatch', '审批版本或内容哈希不匹配');
    }
    if (
      authority.submitted_by_user_id == null ||
      Number(authority.created_by_user_id) !== Number(authority.submitted_by_user_id)
    ) {
      failClosed('repair_assignment_maker_graph_corrupt', '草稿人与提交人链不一致');
    }
    if (
      Number(authority.created_by_user_id) === actor.userId ||
      Number(authority.submitted_by_user_id) === actor.userId
    ) {
      throw new ForbiddenException('[repair_assignment_maker_checker_same_actor] 提交人与审批人不得相同');
    }
    if (Number(profile.version) !== Number(authority.expected_work_order_version)) {
      failClosed('repair_assignment_work_order_version_conflict', '工单版本已变化');
    }
    if (
      authority.authorized_company_ref !== profile.companyRef ||
      authority.authorized_business_sector_ref !== profile.businessSectorRef ||
      authority.authorized_store_ref !== profile.storeRef ||
      authority.authorized_customer_ref !== profile.customerRef
    ) {
      failClosed('repair_assignment_authority_scope_drift', '草稿组织范围与当前工单不一致');
    }
    assertAuthorityContent(authority, lines);
    await lockEmployees([
      Number(authority.responsibility_employee_id),
      ...lines.map((line) => Number(line.employee_id)),
    ], manager);

    let supersededAuthorityRef: string | null = null;
    if (normalized.decision === 'approve') {
      const currentlyApproved = allAuthorities.filter((row) => row.status === 'approved');
      if (currentlyApproved.length > 1) {
        failClosed('repair_assignment_approved_authority_ambiguous', '正式权威不唯一');
      }
      const predecessor = authority.supersedes_authority_id == null
        ? null
        : allAuthorities.find((row) => Number(row.id) === Number(authority.supersedes_authority_id)) ?? null;
      if (
        (currentlyApproved[0] == null ? null : Number(currentlyApproved[0].id)) !==
          (predecessor == null ? null : Number(predecessor.id)) ||
        (predecessor != null && Number(predecessor.authority_version) >= Number(authority.authority_version))
      ) {
        failClosed('repair_assignment_supersedes_drift', '获批前正式权威链发生变化');
      }
      if (predecessor) {
        const oldUpdate = await manager.query(
          `UPDATE repair_contribution_assignment_authorities
              SET status = 'superseded', superseded_by_user_id = ?,
                  superseded_at = CURRENT_TIMESTAMP(6)
            WHERE id = ? AND status = 'approved'`,
          [actor.userId, predecessor.id],
        );
        if (Number(oldUpdate?.affectedRows ?? -1) !== 1) {
          failClosed('repair_assignment_supersedes_conflict', '旧正式权威无法原子替代');
        }
        await insertEvent(
          Number(predecessor.id),
          'superseded',
          'approved',
          'superseded',
          actor.userId,
          'superseded_by_approved_replacement',
          normalized.evidenceRef,
          normalized.evidenceHash,
          normalized.requestFingerprint,
          predecessor.content_hash,
          manager,
        );
        supersededAuthorityRef = predecessor.authority_ref;
      }
      const update = await manager.query(
        `UPDATE repair_contribution_assignment_authorities
            SET status = 'approved', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP(6)
          WHERE id = ? AND status = 'submitted'`,
        [actor.userId, authority.id],
      );
      if (Number(update?.affectedRows ?? -1) !== 1) {
        failClosed('repair_assignment_status_conflict', '权威审批状态竞争失败');
      }
      authority.status = 'approved';
      authority.approved_by_user_id = actor.userId;
      const eventId = await insertEvent(
        Number(authority.id),
        'approved',
        'submitted',
        'approved',
        actor.userId,
        normalized.reasonCode,
        normalized.evidenceRef,
        normalized.evidenceHash,
        normalized.requestFingerprint,
        authority.content_hash,
        manager,
      );
      await completeClaim(normalized.idempotencyKey, Number(authority.id), eventId, manager);
      const receipt = await receiptFor(authority, lines, 'approved', manager);
      if (
        (supersededAuthorityRef == null ? null : `repair-assignment:${supersededAuthorityRef}`) !==
        receipt.supersededAuthorityRef
      ) {
        failClosed('repair_assignment_receipt_supersedes_mismatch', '替代回执不一致');
      }
      return receipt;
    }

    const update = await manager.query(
      `UPDATE repair_contribution_assignment_authorities
          SET status = 'rejected', rejected_by_user_id = ?, rejected_at = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status = 'submitted'`,
      [actor.userId, authority.id],
    );
    if (Number(update?.affectedRows ?? -1) !== 1) {
      failClosed('repair_assignment_status_conflict', '权威拒绝状态竞争失败');
    }
    authority.status = 'rejected';
    authority.rejected_by_user_id = actor.userId;
    const eventId = await insertEvent(
      Number(authority.id),
      'rejected',
      'submitted',
      'rejected',
      actor.userId,
      normalized.reasonCode,
      normalized.evidenceRef,
      normalized.evidenceHash,
      normalized.requestFingerprint,
      authority.content_hash,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, Number(authority.id), eventId, manager);
    return receiptFor(authority, lines, 'rejected', manager);
  });
}

export async function draftRepairResponsibilityAttributionAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairResponsibilityAttributionAuthorityReceiptV1> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeDraftRepairResponsibilityAttributionAuthorityCommandV1(command);
  try {
    return await runDraft(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof AssignmentIdempotencyRaceV1 &&
      error.phase === 'draft' &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) {
      return runDraft(dataSource, currentUser, normalized, true);
    }
    return mapStorageFailure(error);
  }
}

export async function submitRepairResponsibilityAttributionAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairResponsibilityAttributionAuthorityReceiptV1> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeSubmitRepairResponsibilityAttributionAuthorityCommandV1(command);
  try {
    return await runSubmit(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof AssignmentIdempotencyRaceV1 &&
      error.phase === 'submit' &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) {
      return runSubmit(dataSource, currentUser, normalized, true);
    }
    return mapStorageFailure(error);
  }
}

export async function decideRepairResponsibilityAttributionAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairResponsibilityAttributionAuthorityReceiptV1> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeDecideRepairResponsibilityAttributionAuthorityCommandV1(command);
  const phase: AssignmentPhaseV1 = normalized.decision === 'approve' ? 'approve' : 'reject';
  try {
    return await runDecision(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof AssignmentIdempotencyRaceV1 &&
      error.phase === phase &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) {
      return runDecision(dataSource, currentUser, normalized, true);
    }
    return mapStorageFailure(error);
  }
}
