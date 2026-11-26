import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';

/**
 * SOURCE-ONLY / PRODUCTION-UNWIRED repair baseline cost/event authority.
 *
 * This contract is intentionally absent from every Nest module, controller,
 * formal contribution resolver and adapter. It is a reviewed control-plane
 * candidate only. The public contribution caller cannot provide amounts,
 * timestamps or hashes through this file because there is no production route.
 * The first target profile admits only five explicit not-applicable lines.
 * Cost-bearing line shapes are represented for forward-compatible storage but
 * fail closed until a later installed-parts / direct-cost source Gate exists.
 */

export const REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION =
  'gov1-s2-repair-baseline-cost-event-source-v1' as const;
export const REPAIR_BASELINE_COST_EVENT_RULE_VERSION =
  'gov1-s2-repair-baseline-cost-event-v1' as const;
export const REPAIR_BASELINE_COST_EVENT_TARGET_PROFILE =
  'repair_zero_external_direct_cost_v1' as const;

const DRAFT_PERMISSION = 'gov1.repair.cost_event.draft' as const;
const SUBMIT_PERMISSION = 'gov1.repair.cost_event.submit' as const;
const DECIDE_PERMISSION = 'gov1.repair.cost_event.decide' as const;

const WORK_ORDER_REF = /^work-order:([1-9]\d*)$/;
const AUTHORITY_REF = /^repair-cost-event:([0-9a-f]{64})$/;
const ASSIGNMENT_AUTHORITY_REF = /^repair-assignment:([0-9a-f]{64})$/;
const EVIDENCE_REF = /^evidence:[0-9a-f]{64}$/;
const LOWER_HEX_64 = /^[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY = /^repair-cost-event-idempotency:[0-9a-f]{64}$/;
const STRICT_UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const POSITIVE_INTEGER_CENTS = /^[1-9]\d*$/;
const MYSQL_INT_MAX = 2147483647;
const MYSQL_BIGINT_MAX = 9223372036854775807n;

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

export const REPAIR_BASELINE_COST_EVENT_CATEGORIES = [
  'parts',
  'outsourced',
  'other_direct',
  'refund',
  'rework',
] as const;

export type RepairBaselineCostEventCategoryV1 =
  (typeof REPAIR_BASELINE_COST_EVENT_CATEGORIES)[number];
export type RepairBaselineCostEventDispositionV1 = 'confirmed_cost' | 'not_applicable';
export type RepairBaselineCostEventDecisionV1 = 'approve' | 'reject';
export type RepairBaselineCostEventAuthorityStatusV1 =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'superseded';

export interface RepairBaselineCostEventDeclarationInputV1 {
  readonly category: RepairBaselineCostEventCategoryV1;
  readonly disposition: RepairBaselineCostEventDispositionV1;
  readonly amountCents: string;
  readonly occurredAt: string | null;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
}

export interface DraftRepairBaselineCostEventAuthorityCommandV1 {
  readonly workOrderRef: string;
  readonly expectedWorkOrderVersion: number;
  readonly expectedAssignmentAuthorityRef: string;
  readonly expectedAssignmentAuthorityVersion: number;
  readonly expectedAssignmentContentHash: string;
  readonly declarations: readonly RepairBaselineCostEventDeclarationInputV1[];
  readonly supersedesAuthorityRef: string | null;
  readonly expectedSupersededAuthorityVersion: number | null;
  readonly idempotencyKey: string;
}

export interface SubmitRepairBaselineCostEventAuthorityCommandV1 {
  readonly authorityRef: string;
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface DecideRepairBaselineCostEventAuthorityCommandV1 {
  readonly authorityRef: string;
  readonly decision: RepairBaselineCostEventDecisionV1;
  readonly reasonCode: 'baseline_verified' | 'baseline_rejected';
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface NormalizedRepairBaselineCostEventDeclarationV1 {
  readonly category: RepairBaselineCostEventCategoryV1;
  readonly disposition: RepairBaselineCostEventDispositionV1;
  readonly amountCents: string;
  readonly occurredAt: string | null;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
}

export interface NormalizedDraftRepairBaselineCostEventAuthorityV1 {
  readonly workOrderId: number;
  readonly expectedWorkOrderVersion: number;
  readonly expectedAssignmentAuthorityId: string;
  readonly expectedAssignmentAuthorityVersion: number;
  readonly expectedAssignmentContentHash: string;
  readonly declarations: readonly NormalizedRepairBaselineCostEventDeclarationV1[];
  readonly totalDirectCostCents: string;
  readonly profileEligibility: 'eligible' | 'blocked_external_cost';
  readonly supersedesAuthorityId: string | null;
  readonly expectedSupersededAuthorityVersion: number | null;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface NormalizedSubmitRepairBaselineCostEventAuthorityV1 {
  readonly authorityId: string;
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface NormalizedDecideRepairBaselineCostEventAuthorityV1 {
  readonly authorityId: string;
  readonly decision: RepairBaselineCostEventDecisionV1;
  readonly reasonCode: 'baseline_verified' | 'baseline_rejected';
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface RepairBaselineCostEventAuthorityReceiptV1 {
  readonly status: 'draft' | 'submitted' | 'approved' | 'rejected';
  readonly schemaVersion: typeof REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION;
  readonly ruleVersion: typeof REPAIR_BASELINE_COST_EVENT_RULE_VERSION;
  readonly targetProfileCode: typeof REPAIR_BASELINE_COST_EVENT_TARGET_PROFILE;
  readonly authorityRef: string;
  readonly authorityVersion: number;
  readonly contentHash: string;
  readonly economicRootRef: string;
  readonly workOrderRef: string;
  readonly assignmentAuthorityRef: string;
  readonly assignmentAuthorityVersion: number;
  readonly sourceGraphHash: string;
  readonly costCloseWatermarkHash: string;
  readonly eventCloseWatermarkHash: string;
  readonly totalDirectCostCents: string;
  readonly currency: 'CNY';
  readonly profileEligibility: 'eligible' | 'blocked_external_cost';
  readonly serverObservedAt: string;
  readonly confirmedAt: string | null;
  readonly declarations: readonly Readonly<{
    category: RepairBaselineCostEventCategoryV1;
    disposition: RepairBaselineCostEventDispositionV1;
    amountCents: string;
    occurredAt: string | null;
    sourceScopeRef: string;
    sourceScopeHash: string;
    closeWatermarkHash: string;
  }>[];
  readonly supersedesAuthorityRef: string | null;
  readonly supersededAuthorityRef: string | null;
}

type CostEventPhaseV1 = 'draft' | 'submit' | 'approve' | 'reject';

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

interface RootRowV1 extends ScopeV1 {
  economic_root_id: string;
  business_domain: string;
  origin_work_order_id: string | number;
}

interface AssignmentRowV1 {
  id: string | number;
  authority_ref: string;
  economic_root_id: string;
  work_order_id: string | number;
  authority_version: string | number;
  content_hash: string;
  status: string;
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
  target_profile_code: string;
  rule_version: string;
  authority_version: string | number;
  supersedes_authority_id: string | number | null;
  assignment_authority_id: string | number;
  assignment_authority_version: string | number;
  assignment_content_hash: string;
  source_graph_hash: string;
  cost_close_watermark_hash: string;
  event_close_watermark_hash: string;
  total_direct_cost_cents: string | number;
  currency: string;
  profile_eligibility: 'eligible' | 'blocked_external_cost';
  content_hash: string;
  expected_work_order_version: string | number;
  status: RepairBaselineCostEventAuthorityStatusV1;
  created_by_user_id: string | number;
  submitted_by_user_id: string | number | null;
  approved_by_user_id: string | number | null;
  rejected_by_user_id: string | number | null;
  superseded_by_user_id: string | number | null;
  server_observed_at: Date | string;
  approved_at: Date | string | null;
}

interface LineRowV1 {
  id: string | number;
  authority_id: string | number;
  category: RepairBaselineCostEventCategoryV1;
  disposition: RepairBaselineCostEventDispositionV1;
  amount_cents: string | number;
  occurred_at: Date | string | null;
  source_scope_ref: string;
  source_scope_hash: string;
  close_watermark_hash: string;
  evidence_ref: string;
  evidence_hash: string;
  line_hash: string;
}

interface ClaimRowV1 {
  idempotency_key: string;
  phase: CostEventPhaseV1;
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
  from_status: RepairBaselineCostEventAuthorityStatusV1 | null;
  to_status: RepairBaselineCostEventAuthorityStatusV1;
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

interface LockedBaselineGraphV1 {
  profile: ProfileRowV1;
  root: RootRowV1;
  assignment: AssignmentRowV1;
  serverObservedAt: string;
  sourceGraphHash: string;
  costCloseWatermarkHash: string;
  eventCloseWatermarkHash: string;
  sourceScopeHashes: Readonly<Record<RepairBaselineCostEventCategoryV1, string>>;
  lineWatermarks: Readonly<Record<RepairBaselineCostEventCategoryV1, string>>;
  costBlockers: readonly string[];
  eventBlockers: readonly string[];
}

class CostEventIdempotencyRaceV1 extends Error {
  constructor(
    readonly phase: CostEventPhaseV1,
    readonly idempotencyKey: string,
    readonly requestFingerprint: string,
  ) {
    super('repair_cost_event_idempotency_claim_race');
  }
}

function failClosed(code: string, message: string): never {
  throw new ConflictException(`[${code}] ${message}`);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
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
  return positiveMysqlInt(Number(parseRef(value, pattern, code, label)), code, label);
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
    failClosed('repair_cost_event_idempotency_key_invalid', '幂等键格式不符合固定白名单');
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

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) failClosed('repair_cost_event_time_corrupt', '数据库时间无效');
  return date.toISOString();
}

function mysqlUtcMillis(value: string | null): string | null {
  return value == null ? null : `${value.slice(0, 10)} ${value.slice(11, 23)}`;
}

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function categoryOrder(category: RepairBaselineCostEventCategoryV1): number {
  return REPAIR_BASELINE_COST_EVENT_CATEGORIES.indexOf(category);
}

function normalizeAmount(value: unknown, disposition: RepairBaselineCostEventDispositionV1): string {
  if (typeof value !== 'string') {
    failClosed('repair_cost_event_amount_invalid', '成本金额必须是十进制整数分字符串');
  }
  if (disposition === 'not_applicable') {
    if (value !== '0') failClosed('repair_cost_event_not_applicable_amount_invalid', '不适用项金额必须精确为 0');
    return value;
  }
  if (!POSITIVE_INTEGER_CENTS.test(value) || BigInt(value) > MYSQL_BIGINT_MAX) {
    failClosed('repair_cost_event_amount_invalid', '正式成本必须是 MySQL BIGINT 范围内的正整数分');
  }
  return value;
}

function normalizeDeclarations(
  value: unknown,
): readonly NormalizedRepairBaselineCostEventDeclarationV1[] {
  if (!Array.isArray(value) || value.length !== REPAIR_BASELINE_COST_EVENT_CATEGORIES.length) {
    failClosed('repair_cost_event_declarations_invalid', '必须精确提供五项 baseline 声明');
  }
  const normalized = value.map((raw, index) => {
    assertPlainExactObject(
      raw,
      ['category', 'disposition', 'amountCents', 'occurredAt', 'evidenceRef', 'evidenceHash'],
      'repair_cost_event_declaration_shape_invalid',
    );
    if (!REPAIR_BASELINE_COST_EVENT_CATEGORIES.includes(raw.category as RepairBaselineCostEventCategoryV1)) {
      failClosed('repair_cost_event_category_invalid', `第 ${index + 1} 项类别无效`);
    }
    if (raw.disposition !== 'not_applicable' && raw.disposition !== 'confirmed_cost') {
      failClosed('repair_cost_event_disposition_invalid', `第 ${index + 1} 项处置无效`);
    }
    const category = raw.category as RepairBaselineCostEventCategoryV1;
    const disposition = raw.disposition as RepairBaselineCostEventDispositionV1;
    if ((category === 'refund' || category === 'rework') && disposition !== 'not_applicable') {
      failClosed('repair_cost_event_baseline_event_invalid', 'refund/rework baseline 只允许 not_applicable');
    }
    const occurredAt = raw.occurredAt == null
      ? null
      : utcInstant(raw.occurredAt, 'repair_cost_event_occurred_at_invalid', '成本发生时间');
    if (
      (disposition === 'not_applicable' && occurredAt !== null) ||
      (disposition === 'confirmed_cost' && occurredAt === null)
    ) {
      failClosed('repair_cost_event_occurred_at_invalid', '成本处置与发生时间不一致');
    }
    return {
      category,
      disposition,
      amountCents: normalizeAmount(raw.amountCents, disposition),
      occurredAt,
      evidenceRef: safeEvidence(raw.evidenceRef, 'repair_cost_event_evidence_ref_invalid'),
      evidenceHash: lowerHash(
        raw.evidenceHash,
        'repair_cost_event_evidence_hash_invalid',
        'baseline 证据哈希',
      ),
    };
  });
  normalized.sort((left, right) => categoryOrder(left.category) - categoryOrder(right.category));
  if (new Set(normalized.map((item) => item.category)).size !== normalized.length) {
    failClosed('repair_cost_event_category_duplicate', '五项 baseline 类别不得重复');
  }
  for (const category of REPAIR_BASELINE_COST_EVENT_CATEGORIES) {
    if (!normalized.some((item) => item.category === category)) {
      failClosed('repair_cost_event_category_missing', `缺少 ${category} baseline 声明`);
    }
  }
  return deepFreeze(normalized.map((item) => deepFreeze({ ...item })));
}

export function normalizeDraftRepairBaselineCostEventAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedDraftRepairBaselineCostEventAuthorityV1> {
  assertPlainExactObject(
    command,
    [
      'workOrderRef',
      'expectedWorkOrderVersion',
      'expectedAssignmentAuthorityRef',
      'expectedAssignmentAuthorityVersion',
      'expectedAssignmentContentHash',
      'declarations',
      'supersedesAuthorityRef',
      'expectedSupersededAuthorityVersion',
      'idempotencyKey',
    ],
    'repair_cost_event_draft_shape_invalid',
  );
  const declarations = normalizeDeclarations(command.declarations);
  const total = declarations.reduce((sum, item) => sum + BigInt(item.amountCents), 0n);
  if (total > MYSQL_BIGINT_MAX) {
    failClosed('repair_cost_event_total_overflow', 'baseline 总直接成本超出 MySQL BIGINT 范围');
  }
  const supersedesAuthorityId = command.supersedesAuthorityRef == null
    ? null
    : parseRef(
        command.supersedesAuthorityRef,
        AUTHORITY_REF,
        'repair_cost_event_supersedes_ref_invalid',
        '被替代权威引用',
      );
  const expectedSupersededAuthorityVersion = command.expectedSupersededAuthorityVersion == null
    ? null
    : positiveMysqlInt(
        command.expectedSupersededAuthorityVersion,
        'repair_cost_event_expected_version_invalid',
        '被替代权威版本',
      );
  if ((supersedesAuthorityId == null) !== (expectedSupersededAuthorityVersion == null)) {
    failClosed(
      'repair_cost_event_supersedes_pair_invalid',
      '被替代权威引用与期望版本必须同时为空或同时存在',
    );
  }
  const base = {
    workOrderId: parseNumericRef(
      command.workOrderRef,
      WORK_ORDER_REF,
      'repair_cost_event_work_order_ref_invalid',
      '工单引用',
    ),
    expectedWorkOrderVersion: positiveMysqlInt(
      command.expectedWorkOrderVersion,
      'repair_cost_event_expected_version_invalid',
      '工单版本',
    ),
    expectedAssignmentAuthorityId: parseRef(
      command.expectedAssignmentAuthorityRef,
      ASSIGNMENT_AUTHORITY_REF,
      'repair_cost_event_assignment_ref_invalid',
      '责任归因权威引用',
    ),
    expectedAssignmentAuthorityVersion: positiveMysqlInt(
      command.expectedAssignmentAuthorityVersion,
      'repair_cost_event_expected_version_invalid',
      '责任归因权威版本',
    ),
    expectedAssignmentContentHash: lowerHash(
      command.expectedAssignmentContentHash,
      'repair_cost_event_assignment_hash_invalid',
      '责任归因权威内容哈希',
    ),
    declarations,
    totalDirectCostCents: total.toString(),
    profileEligibility: total === 0n ? 'eligible' as const : 'blocked_external_cost' as const,
    supersedesAuthorityId,
    expectedSupersededAuthorityVersion,
    idempotencyKey: idempotency(command.idempotencyKey),
  };
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

export function normalizeSubmitRepairBaselineCostEventAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedSubmitRepairBaselineCostEventAuthorityV1> {
  assertPlainExactObject(
    command,
    ['authorityRef', 'expectedAuthorityVersion', 'expectedContentHash', 'evidenceRef', 'evidenceHash', 'idempotencyKey'],
    'repair_cost_event_submit_shape_invalid',
  );
  const base = {
    authorityId: parseRef(
      command.authorityRef,
      AUTHORITY_REF,
      'repair_cost_event_authority_ref_invalid',
      '权威引用',
    ),
    expectedAuthorityVersion: positiveMysqlInt(
      command.expectedAuthorityVersion,
      'repair_cost_event_expected_version_invalid',
      '权威版本',
    ),
    expectedContentHash: lowerHash(
      command.expectedContentHash,
      'repair_cost_event_content_hash_invalid',
      '内容哈希',
    ),
    evidenceRef: safeEvidence(command.evidenceRef, 'repair_cost_event_evidence_ref_invalid'),
    evidenceHash: lowerHash(command.evidenceHash, 'repair_cost_event_evidence_hash_invalid', '提交证据哈希'),
    idempotencyKey: idempotency(command.idempotencyKey),
  };
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

export function normalizeDecideRepairBaselineCostEventAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedDecideRepairBaselineCostEventAuthorityV1> {
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
    'repair_cost_event_decision_shape_invalid',
  );
  if (command.decision !== 'approve' && command.decision !== 'reject') {
    failClosed('repair_cost_event_decision_invalid', '决策只能是 approve 或 reject');
  }
  const expectedReason = command.decision === 'approve' ? 'baseline_verified' : 'baseline_rejected';
  if (command.reasonCode !== expectedReason) {
    failClosed('repair_cost_event_reason_invalid', '决策与固定理由码不一致');
  }
  const base = {
    authorityId: parseRef(
      command.authorityRef,
      AUTHORITY_REF,
      'repair_cost_event_authority_ref_invalid',
      '权威引用',
    ),
    decision: command.decision as RepairBaselineCostEventDecisionV1,
    reasonCode: command.reasonCode as 'baseline_verified' | 'baseline_rejected',
    expectedAuthorityVersion: positiveMysqlInt(
      command.expectedAuthorityVersion,
      'repair_cost_event_expected_version_invalid',
      '权威版本',
    ),
    expectedContentHash: lowerHash(
      command.expectedContentHash,
      'repair_cost_event_content_hash_invalid',
      '内容哈希',
    ),
    evidenceRef: safeEvidence(command.evidenceRef, 'repair_cost_event_evidence_ref_invalid'),
    evidenceHash: lowerHash(command.evidenceHash, 'repair_cost_event_evidence_hash_invalid', '决策证据哈希'),
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
      'repair_cost_event_data_source_invalid',
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
    failClosed('repair_cost_event_transaction_manager_invalid', '事务连接身份无效');
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
    failClosed('repair_cost_event_transaction_oracle_unavailable', '无法核验当前事务');
  }
  if (
    rows.length !== 1 ||
    String(rows[0].state ?? '').trim().toUpperCase() !== 'ACTIVE' ||
    canonicalIsolation(rows[0].isolation_level) !== canonicalIsolation('REPEATABLE READ') ||
    !['NO', '0'].includes(String(rows[0].autocommit ?? '').trim().toUpperCase())
  ) {
    failClosed(
      'repair_cost_event_transaction_isolation_invalid',
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
  phase: CostEventPhaseV1,
  manager: EntityManager,
): Promise<LockedActorV1> {
  if (currentUser.identitySource !== 'trusted_proxy') {
    throw new ForbiddenException('[repair_cost_event_identity_source_invalid] 非可信代理身份被拒绝');
  }
  const users = await manager.query(
    `SELECT id, username, status FROM users WHERE id = ? FOR SHARE`,
    [currentUser.id],
  ) as Array<{ id: number; username: string; status: number }>;
  if (
    users.length !== 1 ||
    Number(users[0].status) !== 1 ||
    users[0].username !== currentUser.username
  ) {
    throw new ForbiddenException('[repair_cost_event_actor_revoked] 当前人员身份已撤销或变化');
  }
  const bindings = await manager.query(
    `SELECT id, role_id FROM user_roles WHERE user_id = ? ORDER BY role_id, id FOR SHARE`,
    [currentUser.id],
  ) as Array<{ id: number; role_id: number }>;
  const roleIds = bindings.map((row) => Number(row.role_id));
  if (roleIds.length !== new Set(roleIds).size) {
    throw new ForbiddenException('[repair_cost_event_role_binding_duplicate] 正式角色绑定重复');
  }
  const roles = roleIds.length
    ? await manager.query(
        `SELECT id, code FROM roles
          WHERE id IN (${roleIds.map(() => '?').join(',')})
          ORDER BY id FOR SHARE`,
        [...roleIds].sort((a, b) => a - b),
      ) as Array<{ id: number; code: string }>
    : [];
  if (roles.length !== roleIds.length) {
    throw new ForbiddenException('[repair_cost_event_role_revoked] 正式角色已撤销');
  }
  const allowedRoles = phase === 'approve' || phase === 'reject' ? checkerRoles : proposerRoles;
  const roleCodes = roles.map((role) => role.code);
  if (!roleCodes.some((role) => allowedRoles.has(role))) {
    throw new ForbiddenException('[repair_cost_event_role_denied] 当前角色无该阶段权限');
  }
  const employees = await manager.query(
    `SELECT id FROM employees
      WHERE linked_user_id = ? AND status = 1
      ORDER BY id FOR SHARE`,
    [currentUser.id],
  ) as Array<{ id: number }>;
  if (employees.length !== 1) {
    throw new ForbiddenException('[repair_cost_event_employee_binding_invalid] 缺少唯一有效员工绑定');
  }
  return { userId: currentUser.id, employeeId: Number(employees[0].id), roleCodes };
}

function permissionFor(phase: CostEventPhaseV1): string {
  if (phase === 'draft') return DRAFT_PERMISSION;
  if (phase === 'submit') return SUBMIT_PERMISSION;
  return DECIDE_PERMISSION;
}

async function assertScopeGrant(
  actor: LockedActorV1,
  phase: CostEventPhaseV1,
  scope: ScopeV1,
  manager: EntityManager,
): Promise<void> {
  const grants = await manager.query(
    `SELECT id, business_sector_ref, store_ref, customer_ref,
            effect, permissions, valid_from, valid_until
       FROM business_scope_grants
      WHERE user_id = ? AND employee_id = ? AND company_ref = ? AND status = 'active'
      ORDER BY id FOR SHARE`,
    [actor.userId, actor.employeeId, scope.companyRef],
  ) as Array<Record<string, unknown>>;
  const nowRows = await manager.query(`SELECT CURRENT_TIMESTAMP(6) AS server_now`);
  const now = new Date(nowRows[0]?.server_now).getTime();
  if (!Number.isFinite(now)) failClosed('repair_cost_event_server_time_invalid', '数据库当前时间无效');
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
    throw new ForbiddenException('[repair_cost_event_scope_denied] 当前组织范围被明确拒绝');
  }
  if (!matching.some((grant) => grant.effect === 'allow')) {
    throw new ForbiddenException('[repair_cost_event_scope_missing] 当前组织范围缺少精确授权');
  }
}

async function loadProfile(
  workOrderId: number,
  manager: EntityManager,
  lock = false,
): Promise<ProfileRowV1> {
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
    throw new NotFoundException('[repair_cost_event_profile_missing] 汽修工单档案不存在');
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
    failClosed('repair_cost_event_scope_drift', '授权前后工单组织范围发生变化');
  }
}

function canonicalDbValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (value == null || typeof value === 'string' || typeof value === 'number') return value;
  return String(value);
}

function canonicalRows(rows: readonly Record<string, unknown>[]): readonly Record<string, unknown>[] {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, canonicalDbValue(value)]),
  ));
}

function sourceScopeRef(category: RepairBaselineCostEventCategoryV1, workOrderId: number): string {
  return `scope:repair:${category}:work-order:${workOrderId}`;
}

async function lockSourceGraph(
  workOrderId: number,
  actorUserId: number,
  preview: ProfileRowV1,
  manager: EntityManager,
): Promise<LockedBaselineGraphV1> {
  await manager.query(
    `INSERT IGNORE INTO repair_cost_event_mutexes (work_order_id, created_by_user_id)
     VALUES (?, ?)`,
    [workOrderId, actorUserId],
  );
  const mutex = await manager.query(
    `SELECT work_order_id FROM repair_cost_event_mutexes
      WHERE work_order_id = ? FOR UPDATE`,
    [workOrderId],
  );
  if (mutex.length !== 1) failClosed('repair_cost_event_mutex_missing', 'baseline 权威互斥记录缺失');

  const lineageRows = await manager.query(
    `SELECT work_order_id, economic_root_id, root_origin_work_order_id, accepted_decision_id
       FROM repair_work_order_economic_lineages
      WHERE work_order_id = ? FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown> & { economic_root_id: string }>;
  if (lineageRows.length !== 1) {
    failClosed('repair_cost_event_lineage_missing', '工单缺少唯一已接受经济根绑定');
  }
  const roots = await manager.query(
    `SELECT economic_root_id, business_domain, origin_work_order_id,
            company_ref AS companyRef, business_sector_ref AS businessSectorRef,
            store_ref AS storeRef, customer_ref AS customerRef
       FROM business_contribution_economic_fact_roots
      WHERE economic_root_id = ? FOR UPDATE`,
    [lineageRows[0].economic_root_id],
  ) as RootRowV1[];
  if (roots.length !== 1 || roots[0].business_domain !== 'repair') {
    failClosed('repair_cost_event_root_invalid', '维修经济根缺失或域不匹配');
  }
  const profile = await loadProfile(workOrderId, manager, true);
  assertProfileStable(profile, preview);
  if (profile.lifecycle_status === 'cancelled') {
    failClosed('repair_cost_event_cancelled_work_order', '已取消工单不能创建或变更 baseline 权威');
  }
  const root = roots[0];
  if (
    root.companyRef !== profile.companyRef ||
    root.businessSectorRef !== profile.businessSectorRef ||
    root.storeRef !== profile.storeRef ||
    root.customerRef !== profile.customerRef
  ) {
    failClosed('repair_cost_event_root_scope_mismatch', '经济根与工单组织范围不一致');
  }

  const assignments = await manager.query(
    `SELECT id, authority_ref, economic_root_id, work_order_id,
            authority_version, content_hash, status
       FROM repair_contribution_assignment_authorities
      WHERE economic_root_id = ?
      ORDER BY authority_version, id FOR UPDATE`,
    [root.economic_root_id],
  ) as AssignmentRowV1[];
  if (assignments.some((item) => item.status === 'draft' || item.status === 'submitted')) {
    failClosed('repair_cost_event_assignment_open', '责任归因存在待处理版本');
  }
  const approvedAssignments = assignments.filter((item) => item.status === 'approved');
  if (approvedAssignments.length !== 1 || Number(approvedAssignments[0].work_order_id) !== workOrderId) {
    failClosed('repair_cost_event_assignment_unavailable', '缺少当前唯一已批准责任归因权威');
  }
  const assignment = approvedAssignments[0];

  const materials = await manager.query(
    `SELECT id, deleted_at, updated_at FROM work_order_materials
      WHERE work_order_id = ? ORDER BY deleted_at, id FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown>>;
  const partLinks = await manager.query(
    `SELECT id, work_order_material_id, created_at FROM repair_part_links
      WHERE work_order_id = ? ORDER BY work_order_material_id, id FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown>>;
  const demands = await manager.query(
    `SELECT id, status, version, updated_at FROM repair_procurement_demands
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown>>;
  const purchaseOrders = await manager.query(
    `SELECT id, status, version, updated_at FROM repair_purchase_orders
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown>>;
  const allocations = await manager.query(
    `SELECT id, status, version, installed_at, updated_at
       FROM repair_procurement_allocations
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown>>;
  const supplierClaims = await manager.query(
    `SELECT id, status, updated_at FROM repair_supplier_warranty_claims
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown>>;
  const quality = await manager.query(
    `SELECT id, result, rework_reason, created_at FROM repair_quality_inspections
      WHERE work_order_id = ? ORDER BY created_at, id FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown>>;
  const tasks = await manager.query(
    `SELECT id, rework_of_inspection_id, status, version, updated_at FROM repair_tasks
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown>>;
  const warranties = await manager.query(
    `SELECT id, status, created_at FROM repair_warranty_records
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown>>;
  const collections = await manager.query(
    `SELECT id, status, updated_at FROM finance_collection_order
      WHERE work_order_id = ? ORDER BY id FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown>>;

  const normalizedCostGraph = {
    schemaVersion: REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
    workOrderId,
    coveredTables: [
      'work_order_materials',
      'repair_part_links',
      'repair_procurement_demands',
      'repair_purchase_orders',
      'repair_procurement_allocations',
      'repair_supplier_warranty_claims',
    ],
    excludedSources: ['repair_labor_items', 'repair_purchase_orders.total_amount', 'repair_purchase_orders.payment_state'],
    materials: canonicalRows(materials),
    partLinks: canonicalRows(partLinks),
    demands: canonicalRows(demands),
    purchaseOrders: canonicalRows(purchaseOrders),
    allocations: canonicalRows(allocations),
    supplierClaims: canonicalRows(supplierClaims),
    outsourcedSourceSchema: 'absent_requires_explicit_not_applicable',
    otherDirectSourceSchema: 'absent_requires_explicit_not_applicable',
  };
  const normalizedEventGraph = {
    schemaVersion: REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
    workOrderId,
    coveredTables: [
      'repair_quality_inspections',
      'repair_tasks',
      'repair_warranty_records',
      'finance_collection_order',
    ],
    quality: canonicalRows(quality),
    tasks: canonicalRows(tasks),
    warranties: canonicalRows(warranties),
    collections: canonicalRows(collections),
  };
  const costCloseWatermarkHash = canonicalHash(normalizedCostGraph);
  const eventCloseWatermarkHash = canonicalHash(normalizedEventGraph);
  const sourceGraphHash = canonicalHash({
    schemaVersion: REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
    ruleVersion: REPAIR_BASELINE_COST_EVENT_RULE_VERSION,
    economicRootId: root.economic_root_id,
    lineage: canonicalRows(lineageRows),
    profile: {
      workOrderId,
      lifecycleStatus: profile.lifecycle_status,
      version: Number(profile.version),
      scope: scopeOf(profile),
    },
    assignment: {
      id: Number(assignment.id),
      authorityRef: assignment.authority_ref,
      version: Number(assignment.authority_version),
      contentHash: assignment.content_hash,
    },
    costCloseWatermarkHash,
    eventCloseWatermarkHash,
  });
  const sourceScopeHashes = Object.fromEntries(
    REPAIR_BASELINE_COST_EVENT_CATEGORIES.map((category) => {
      const scopeRef = sourceScopeRef(category, workOrderId);
      return [category, canonicalHash({
        schemaVersion: REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
        ruleVersion: REPAIR_BASELINE_COST_EVENT_RULE_VERSION,
        scopeRef,
        sourceGraphHash,
      })];
    }),
  ) as Record<RepairBaselineCostEventCategoryV1, string>;
  const lineWatermarks = {
    parts: costCloseWatermarkHash,
    outsourced: costCloseWatermarkHash,
    other_direct: costCloseWatermarkHash,
    refund: eventCloseWatermarkHash,
    rework: eventCloseWatermarkHash,
  } as const;
  const costBlockers = [
    ...(materials.length ? ['work_order_materials'] : []),
    ...(partLinks.length ? ['repair_part_links'] : []),
    ...(demands.length ? ['repair_procurement_demands'] : []),
    ...(purchaseOrders.length ? ['repair_purchase_orders'] : []),
    ...(allocations.length ? ['repair_procurement_allocations'] : []),
    ...(supplierClaims.length ? ['repair_supplier_warranty_claims'] : []),
  ];
  const eventBlockers = [
    ...(quality.some((row) => row.result !== 'passed' || String(row.rework_reason ?? '').trim())
      ? ['repair_quality_inspections']
      : []),
    ...(tasks.some((row) => row.rework_of_inspection_id != null) ? ['repair_tasks'] : []),
    ...(warranties.length ? ['repair_warranty_records'] : []),
    ...(collections.some((row) => ['refunded', 'cancelled'].includes(String(row.status)))
      ? ['finance_collection_order']
      : []),
  ];
  const serverTimeRows = await manager.query(`SELECT CURRENT_TIMESTAMP(6) AS server_observed_at`);
  const serverObservedAt = toIso(serverTimeRows[0]?.server_observed_at);
  return deepFreeze({
    profile,
    root,
    assignment,
    serverObservedAt,
    sourceGraphHash,
    costCloseWatermarkHash,
    eventCloseWatermarkHash,
    sourceScopeHashes: deepFreeze(sourceScopeHashes),
    lineWatermarks,
    costBlockers: deepFreeze(costBlockers),
    eventBlockers: deepFreeze(eventBlockers),
  });
}

function assertClosedBaselineGraph(graph: LockedBaselineGraphV1): void {
  if (graph.costBlockers.length) {
    failClosed(
      'repair_cost_event_cost_set_open',
      `外部直接成本集合不是已证明的空闭集: ${graph.costBlockers.join(',')}`,
    );
  }
  if (graph.eventBlockers.length) {
    failClosed(
      'repair_cost_event_event_set_open',
      `退款/返修/质保事件集合不是已证明的空闭集: ${graph.eventBlockers.join(',')}`,
    );
  }
}

function assertAssignmentExpectation(
  normalized: NormalizedDraftRepairBaselineCostEventAuthorityV1,
  assignment: AssignmentRowV1,
): void {
  if (
    normalized.expectedAssignmentAuthorityId !== assignment.authority_ref ||
    normalized.expectedAssignmentAuthorityVersion !== Number(assignment.authority_version) ||
    normalized.expectedAssignmentContentHash !== assignment.content_hash
  ) {
    failClosed('repair_cost_event_assignment_drift', '责任归因权威版本或内容已变化');
  }
}

function assertNoFutureCostTimes(
  declarations: readonly NormalizedRepairBaselineCostEventDeclarationV1[],
  serverObservedAt: string,
): void {
  const observed = Date.parse(serverObservedAt);
  if (
    declarations.some((item) => item.occurredAt != null && Date.parse(item.occurredAt) > observed)
  ) {
    failClosed('repair_cost_event_time_in_future', '成本发生时间晚于服务器观察时间');
  }
}

function isDuplicate(error: unknown): boolean {
  const candidate = error as { code?: string; errno?: number };
  return candidate?.code === 'ER_DUP_ENTRY' || Number(candidate?.errno) === 1062;
}

function mapStorageFailure(error: unknown): never {
  if (
    error instanceof ConflictException ||
    error instanceof ForbiddenException ||
    error instanceof NotFoundException
  ) throw error;
  const candidate = error as { code?: string; errno?: number };
  if (
    candidate?.code === 'ER_LOCK_DEADLOCK' ||
    candidate?.code === 'ER_LOCK_WAIT_TIMEOUT' ||
    Number(candidate?.errno) === 1205 ||
    Number(candidate?.errno) === 1213
  ) {
    failClosed('repair_cost_event_contention', 'baseline 权威正被其他事务处理，请重试');
  }
  throw error;
}

async function claimIdempotency(
  phase: CostEventPhaseV1,
  key: string,
  fingerprint: string,
  actorUserId: number,
  manager: EntityManager,
): Promise<void> {
  try {
    await manager.query(
      `INSERT INTO repair_cost_event_idempotency_claims
         (idempotency_key, phase, request_fingerprint, actor_user_id, state)
       VALUES (?, ?, ?, ?, 'claimed')`,
      [key, phase, fingerprint, actorUserId],
    );
  } catch (error) {
    if (isDuplicate(error)) throw new CostEventIdempotencyRaceV1(phase, key, fingerprint);
    throw error;
  }
}

async function loadCompletedClaim(
  phase: CostEventPhaseV1,
  key: string,
  fingerprint: string,
  actorUserId: number,
  manager: EntityManager,
): Promise<ClaimRowV1> {
  const rows = await manager.query(
    `SELECT idempotency_key, phase, request_fingerprint, actor_user_id,
            state, authority_id, lifecycle_event_id
       FROM repair_cost_event_idempotency_claims
      WHERE idempotency_key = ? FOR UPDATE`,
    [key],
  ) as ClaimRowV1[];
  if (rows.length !== 1) failClosed('repair_cost_event_idempotency_winner_missing', '幂等结果缺失');
  const row = rows[0];
  if (
    row.phase !== phase ||
    row.request_fingerprint !== fingerprint ||
    Number(row.actor_user_id) !== actorUserId
  ) {
    failClosed('repair_cost_event_idempotency_conflict', '幂等键已绑定其他请求或人员');
  }
  if (row.state !== 'completed' || row.authority_id == null || row.lifecycle_event_id == null) {
    failClosed('repair_cost_event_idempotency_incomplete', '幂等结果未完整提交');
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
    `UPDATE repair_cost_event_idempotency_claims
        SET state = 'completed', authority_id = ?, lifecycle_event_id = ?,
            completed_at = CURRENT_TIMESTAMP(6)
      WHERE idempotency_key = ? AND state = 'claimed'
        AND authority_id IS NULL AND lifecycle_event_id IS NULL`,
    [authorityId, eventId, key],
  );
  if (Number(result?.affectedRows ?? -1) !== 1) {
    failClosed('repair_cost_event_idempotency_completion_failed', '幂等结果无法完整封存');
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
            authorized_store_ref, authorized_customer_ref,
            target_profile_code, rule_version, authority_version,
            supersedes_authority_id, assignment_authority_id,
            assignment_authority_version, assignment_content_hash,
            source_graph_hash, cost_close_watermark_hash,
            event_close_watermark_hash, total_direct_cost_cents,
            currency, profile_eligibility, content_hash,
            expected_work_order_version, status, created_by_user_id,
            submitted_by_user_id, approved_by_user_id, rejected_by_user_id,
            superseded_by_user_id, server_observed_at, approved_at
       FROM repair_cost_event_authorities
      WHERE authority_ref = ?${lock ? ' FOR UPDATE' : ''}`,
    [authorityRef],
  ) as AuthorityRowV1[];
  if (rows.length > 1) failClosed('repair_cost_event_authority_corrupt', '权威引用不唯一');
  return rows[0] ?? null;
}

async function loadLines(authorityId: number, manager: EntityManager): Promise<LineRowV1[]> {
  return manager.query(
    `SELECT id, authority_id, category, disposition, amount_cents,
            occurred_at, source_scope_ref, source_scope_hash,
            close_watermark_hash, evidence_ref, evidence_hash, line_hash
       FROM repair_cost_event_authority_lines
      WHERE authority_id = ?
      ORDER BY FIELD(category, 'parts','outsourced','other_direct','refund','rework')
      FOR UPDATE`,
    [authorityId],
  ) as Promise<LineRowV1[]>;
}

function canonicalAuthorityContent(
  authority: Omit<
    AuthorityRowV1,
    | 'id'
    | 'authority_ref'
    | 'content_hash'
    | 'status'
    | 'created_by_user_id'
    | 'submitted_by_user_id'
    | 'approved_by_user_id'
    | 'rejected_by_user_id'
    | 'superseded_by_user_id'
    | 'approved_at'
  >,
  lines: readonly Omit<LineRowV1, 'id' | 'authority_id' | 'line_hash'>[],
): string {
  return canonicalHash({
    schemaVersion: REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
    economicRootId: authority.economic_root_id,
    workOrderId: Number(authority.work_order_id),
    scope: {
      companyRef: authority.authorized_company_ref,
      businessSectorRef: authority.authorized_business_sector_ref,
      storeRef: authority.authorized_store_ref,
      customerRef: authority.authorized_customer_ref,
    },
    targetProfileCode: authority.target_profile_code,
    ruleVersion: authority.rule_version,
    authorityVersion: Number(authority.authority_version),
    supersedesAuthorityId: authority.supersedes_authority_id == null
      ? null
      : Number(authority.supersedes_authority_id),
    assignment: {
      id: Number(authority.assignment_authority_id),
      version: Number(authority.assignment_authority_version),
      contentHash: authority.assignment_content_hash,
    },
    sourceGraphHash: authority.source_graph_hash,
    costCloseWatermarkHash: authority.cost_close_watermark_hash,
    eventCloseWatermarkHash: authority.event_close_watermark_hash,
    totalDirectCostCents: String(authority.total_direct_cost_cents),
    currency: authority.currency,
    profileEligibility: authority.profile_eligibility,
    expectedWorkOrderVersion: Number(authority.expected_work_order_version),
    serverObservedAt: toIso(authority.server_observed_at),
    declarations: lines.map((line) => ({
      category: line.category,
      disposition: line.disposition,
      amountCents: String(line.amount_cents),
      occurredAt: line.occurred_at == null ? null : toIso(line.occurred_at),
      sourceScopeRef: line.source_scope_ref,
      sourceScopeHash: line.source_scope_hash,
      closeWatermarkHash: line.close_watermark_hash,
      evidenceRef: line.evidence_ref,
      evidenceHash: line.evidence_hash,
    })),
  });
}

function assertAuthorityContent(authority: AuthorityRowV1, lines: LineRowV1[]): void {
  if (lines.length !== REPAIR_BASELINE_COST_EVENT_CATEGORIES.length) {
    failClosed('repair_cost_event_line_set_invalid', '数据库 baseline 行数不是精确五项');
  }
  const normalized = normalizeDeclarations(lines.map((line) => ({
    category: line.category,
    disposition: line.disposition,
    amountCents: String(line.amount_cents),
    occurredAt: line.occurred_at == null ? null : toIso(line.occurred_at),
    evidenceRef: line.evidence_ref,
    evidenceHash: line.evidence_hash,
  })));
  const total = normalized.reduce((sum, line) => sum + BigInt(line.amountCents), 0n);
  if (
    authority.target_profile_code !== REPAIR_BASELINE_COST_EVENT_TARGET_PROFILE ||
    authority.rule_version !== REPAIR_BASELINE_COST_EVENT_RULE_VERSION ||
    authority.currency !== 'CNY' ||
    String(authority.total_direct_cost_cents) !== total.toString() ||
    authority.profile_eligibility !== (total === 0n ? 'eligible' : 'blocked_external_cost')
  ) {
    failClosed('repair_cost_event_rule_version_mismatch', 'baseline 规则、币种或金额口径不匹配');
  }
  const actual = canonicalAuthorityContent(authority, lines);
  if (actual !== authority.content_hash) {
    failClosed('repair_cost_event_content_hash_mismatch', '权威内容哈希与数据库事实不一致');
  }
  for (const line of lines) {
    const expectedLineHash = canonicalHash({
      authorityContentHash: authority.content_hash,
      category: line.category,
      disposition: line.disposition,
      amountCents: String(line.amount_cents),
      occurredAt: line.occurred_at == null ? null : toIso(line.occurred_at),
      sourceScopeRef: line.source_scope_ref,
      sourceScopeHash: line.source_scope_hash,
      closeWatermarkHash: line.close_watermark_hash,
      evidenceRef: line.evidence_ref,
      evidenceHash: line.evidence_hash,
    });
    if (line.line_hash !== expectedLineHash) {
      failClosed('repair_cost_event_line_hash_mismatch', 'baseline 行哈希与数据库事实不一致');
    }
  }
}

function assertGraphStillMatches(authority: AuthorityRowV1, graph: LockedBaselineGraphV1): void {
  if (
    authority.source_graph_hash !== graph.sourceGraphHash ||
    authority.cost_close_watermark_hash !== graph.costCloseWatermarkHash ||
    authority.event_close_watermark_hash !== graph.eventCloseWatermarkHash ||
    Number(authority.assignment_authority_id) !== Number(graph.assignment.id) ||
    Number(authority.assignment_authority_version) !== Number(graph.assignment.authority_version) ||
    authority.assignment_content_hash !== graph.assignment.content_hash ||
    Number(authority.expected_work_order_version) !== Number(graph.profile.version)
  ) {
    failClosed('repair_cost_event_source_graph_drift', 'baseline 来源图或闭集 watermark 已变化');
  }
}

async function insertEvent(
  authorityId: number,
  eventType: 'drafted' | 'submitted' | 'approved' | 'rejected' | 'superseded',
  fromStatus: RepairBaselineCostEventAuthorityStatusV1 | null,
  toStatus: RepairBaselineCostEventAuthorityStatusV1,
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
    `INSERT INTO repair_cost_event_lifecycle_events
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
    `SELECT id FROM repair_cost_event_lifecycle_events WHERE event_ref = ? FOR UPDATE`,
    [eventRef],
  );
  if (rows.length !== 1) failClosed('repair_cost_event_lifecycle_insert_missing', '生命周期事件写入后缺失');
  return Number(rows[0].id);
}

async function receiptFor(
  authority: AuthorityRowV1,
  lines: LineRowV1[],
  status: RepairBaselineCostEventAuthorityReceiptV1['status'],
  manager: EntityManager,
): Promise<RepairBaselineCostEventAuthorityReceiptV1> {
  const assignmentRows = await manager.query(
    `SELECT authority_ref FROM repair_contribution_assignment_authorities WHERE id = ?`,
    [authority.assignment_authority_id],
  ) as Array<{ authority_ref: string }>;
  if (assignmentRows.length !== 1) failClosed('repair_cost_event_assignment_missing', '责任归因权威不存在');
  const superseded = authority.supersedes_authority_id == null
    ? null
    : await manager.query(
        `SELECT authority_ref FROM repair_cost_event_authorities WHERE id = ?`,
        [authority.supersedes_authority_id],
      ) as Array<{ authority_ref: string }>;
  if (superseded && superseded.length !== 1) {
    failClosed('repair_cost_event_supersedes_missing', '被替代权威不存在');
  }
  return deepFreeze({
    status,
    schemaVersion: REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
    ruleVersion: REPAIR_BASELINE_COST_EVENT_RULE_VERSION,
    targetProfileCode: REPAIR_BASELINE_COST_EVENT_TARGET_PROFILE,
    authorityRef: `repair-cost-event:${authority.authority_ref}`,
    authorityVersion: Number(authority.authority_version),
    contentHash: authority.content_hash,
    economicRootRef: `economic-root:${authority.economic_root_id}`,
    workOrderRef: `work-order:${Number(authority.work_order_id)}`,
    assignmentAuthorityRef: `repair-assignment:${assignmentRows[0].authority_ref}`,
    assignmentAuthorityVersion: Number(authority.assignment_authority_version),
    sourceGraphHash: authority.source_graph_hash,
    costCloseWatermarkHash: authority.cost_close_watermark_hash,
    eventCloseWatermarkHash: authority.event_close_watermark_hash,
    totalDirectCostCents: String(authority.total_direct_cost_cents),
    currency: 'CNY',
    profileEligibility: authority.profile_eligibility,
    serverObservedAt: toIso(authority.server_observed_at),
    confirmedAt: authority.approved_at == null ? null : toIso(authority.approved_at),
    declarations: lines.map((line) => deepFreeze({
      category: line.category,
      disposition: line.disposition,
      amountCents: String(line.amount_cents),
      occurredAt: line.occurred_at == null ? null : toIso(line.occurred_at),
      sourceScopeRef: line.source_scope_ref,
      sourceScopeHash: line.source_scope_hash,
      closeWatermarkHash: line.close_watermark_hash,
    })),
    supersedesAuthorityRef: superseded == null
      ? null
      : `repair-cost-event:${superseded[0].authority_ref}`,
    supersededAuthorityRef: status === 'approved' && superseded != null
      ? `repair-cost-event:${superseded[0].authority_ref}`
      : null,
  });
}

async function minimalAuthorityLocator(
  authorityRef: string,
  manager: EntityManager,
): Promise<number | null> {
  const rows = await manager.query(
    `SELECT work_order_id FROM repair_cost_event_authorities WHERE authority_ref = ?`,
    [authorityRef],
  ) as Array<{ work_order_id: number }>;
  if (rows.length > 1) failClosed('repair_cost_event_authority_corrupt', '权威引用不唯一');
  return rows.length === 1 ? Number(rows[0].work_order_id) : null;
}

function scopeOrAuthorityUnavailable(): never {
  throw new ForbiddenException(
    '[repair_cost_event_scope_or_authority_unavailable] 权威不存在或当前组织范围不可用',
  );
}

async function replayReceipt(
  phase: CostEventPhaseV1,
  key: string,
  fingerprint: string,
  actorUserId: number,
  expectedEvidenceRef: string,
  expectedEvidenceHash: string,
  expectedTarget: ReplayTargetV1,
  manager: EntityManager,
): Promise<RepairBaselineCostEventAuthorityReceiptV1> {
  const claim = await loadCompletedClaim(phase, key, fingerprint, actorUserId, manager);
  const rows = await manager.query(
    `SELECT authority_ref FROM repair_cost_event_authorities WHERE id = ?`,
    [claim.authority_id],
  ) as Array<{ authority_ref: string }>;
  if (rows.length !== 1) failClosed('repair_cost_event_idempotency_graph_corrupt', '幂等权威结果缺失');
  const authority = await loadAuthorityByOpaqueRef(rows[0].authority_ref, manager, true);
  if (!authority) failClosed('repair_cost_event_idempotency_graph_corrupt', '幂等权威结果缺失');
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
    failClosed('repair_cost_event_idempotency_graph_corrupt', '幂等权威目标或授权范围不一致');
  }
  const lines = await loadLines(Number(authority.id), manager);
  assertAuthorityContent(authority, lines);
  const eventRows = await manager.query(
    `SELECT id, authority_id, event_type, from_status, to_status,
            actor_user_id, reason_code, evidence_ref, evidence_hash,
            request_fingerprint, authority_content_hash
       FROM repair_cost_event_lifecycle_events
      WHERE id = ? FOR UPDATE`,
    [claim.lifecycle_event_id],
  ) as LifecycleEventRowV1[];
  const expectedEvent = phase === 'draft'
    ? { eventType: 'drafted', fromStatus: null, toStatus: 'draft', reasonCode: 'baseline_drafted' }
    : phase === 'submit'
      ? { eventType: 'submitted', fromStatus: 'draft', toStatus: 'submitted', reasonCode: 'baseline_submitted' }
      : phase === 'approve'
        ? { eventType: 'approved', fromStatus: 'submitted', toStatus: 'approved', reasonCode: 'baseline_verified' }
        : { eventType: 'rejected', fromStatus: 'submitted', toStatus: 'rejected', reasonCode: 'baseline_rejected' };
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
    failClosed('repair_cost_event_idempotency_graph_corrupt', '幂等事件与权威结果不一致');
  }
  const actorMatches = phase === 'draft'
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
  if (!actorMatches) {
    failClosed('repair_cost_event_idempotency_graph_corrupt', '幂等权威 maker-checker 图不一致');
  }
  const allowed: Readonly<Record<CostEventPhaseV1, readonly RepairBaselineCostEventAuthorityStatusV1[]>> = {
    draft: ['draft', 'submitted', 'approved', 'rejected', 'superseded'],
    submit: ['submitted', 'approved', 'rejected', 'superseded'],
    approve: ['approved', 'superseded'],
    reject: ['rejected'],
  };
  if (!allowed[phase].includes(authority.status)) {
    failClosed('repair_cost_event_idempotency_graph_corrupt', '幂等结果生命周期不一致');
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

async function runDraft(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedDraftRepairBaselineCostEventAuthorityV1>,
  replayOnly: boolean,
): Promise<RepairBaselineCostEventAuthorityReceiptV1> {
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
    const aggregateEvidenceHash = canonicalHash(
      normalized.declarations.map((item) => ({ category: item.category, evidenceHash: item.evidenceHash })),
    );
    const aggregateEvidenceRef = `evidence:${aggregateEvidenceHash}`;
    if (replayOnly) {
      return replayReceipt(
        'draft',
        normalized.idempotencyKey,
        normalized.requestFingerprint,
        actor.userId,
        aggregateEvidenceRef,
        aggregateEvidenceHash,
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
    const graph = await lockSourceGraph(normalized.workOrderId, actor.userId, preview, manager);
    if (Number(graph.profile.version) !== normalized.expectedWorkOrderVersion) {
      failClosed('repair_cost_event_work_order_version_conflict', '工单版本已变化');
    }
    assertAssignmentExpectation(normalized, graph.assignment);
    assertNoFutureCostTimes(normalized.declarations, graph.serverObservedAt);
    if (normalized.profileEligibility !== 'eligible') {
      failClosed(
        'repair_cost_event_external_cost_profile_blocked',
        '首个 zero-external-direct-cost profile 不接受非零成本；等待独立行级成本来源 Gate',
      );
    }
    assertClosedBaselineGraph(graph);

    const existing = await manager.query(
      `SELECT id, authority_ref, authority_version, supersedes_authority_id, status
         FROM repair_cost_event_authorities
        WHERE economic_root_id = ?
        ORDER BY authority_version, id FOR UPDATE`,
      [graph.root.economic_root_id],
    ) as Array<Pick<AuthorityRowV1,
      'id' | 'authority_ref' | 'authority_version' | 'supersedes_authority_id' | 'status'>>;
    if (existing.some((row) => row.status === 'draft' || row.status === 'submitted')) {
      failClosed('repair_cost_event_open_authority_exists', '同一经济根已有待处理 baseline 版本');
    }
    const approved = existing.filter((row) => row.status === 'approved');
    if (approved.length > 1) failClosed('repair_cost_event_approved_authority_ambiguous', '正式 baseline 权威不唯一');
    const currentApproved = approved[0] ?? null;
    if (currentApproved == null) {
      if (
        normalized.supersedesAuthorityId != null ||
        normalized.expectedSupersededAuthorityVersion != null
      ) {
        failClosed('repair_cost_event_supersedes_mismatch', '当前没有可替代的正式 baseline 权威');
      }
    } else if (
      normalized.supersedesAuthorityId !== currentApproved.authority_ref ||
      normalized.expectedSupersededAuthorityVersion !== Number(currentApproved.authority_version)
    ) {
      failClosed('repair_cost_event_supersedes_mismatch', '被替代 baseline 引用或版本不匹配');
    }
    const authorityVersion = existing.reduce(
      (max, row) => Math.max(max, Number(row.authority_version)),
      0,
    ) + 1;
    const authorityRef = randomBytes(32).toString('hex');
    const authorityShape = {
      economic_root_id: graph.root.economic_root_id,
      work_order_id: normalized.workOrderId,
      authorized_company_ref: graph.profile.companyRef,
      authorized_business_sector_ref: graph.profile.businessSectorRef,
      authorized_store_ref: graph.profile.storeRef,
      authorized_customer_ref: graph.profile.customerRef,
      target_profile_code: REPAIR_BASELINE_COST_EVENT_TARGET_PROFILE,
      rule_version: REPAIR_BASELINE_COST_EVENT_RULE_VERSION,
      authority_version: authorityVersion,
      supersedes_authority_id: currentApproved == null ? null : Number(currentApproved.id),
      assignment_authority_id: Number(graph.assignment.id),
      assignment_authority_version: Number(graph.assignment.authority_version),
      assignment_content_hash: graph.assignment.content_hash,
      source_graph_hash: graph.sourceGraphHash,
      cost_close_watermark_hash: graph.costCloseWatermarkHash,
      event_close_watermark_hash: graph.eventCloseWatermarkHash,
      total_direct_cost_cents: normalized.totalDirectCostCents,
      currency: 'CNY',
      profile_eligibility: normalized.profileEligibility,
      expected_work_order_version: normalized.expectedWorkOrderVersion,
      server_observed_at: graph.serverObservedAt,
    };
    const lineShapes = normalized.declarations.map((item) => ({
      category: item.category,
      disposition: item.disposition,
      amount_cents: item.amountCents,
      occurred_at: item.occurredAt,
      source_scope_ref: sourceScopeRef(item.category, normalized.workOrderId),
      source_scope_hash: graph.sourceScopeHashes[item.category],
      close_watermark_hash: graph.lineWatermarks[item.category],
      evidence_ref: item.evidenceRef,
      evidence_hash: item.evidenceHash,
    }));
    const contentHash = canonicalAuthorityContent(authorityShape, lineShapes);
    await manager.query(
      `INSERT INTO repair_cost_event_authorities (
         authority_ref, economic_root_id, work_order_id,
         authorized_company_ref, authorized_business_sector_ref,
         authorized_store_ref, authorized_customer_ref, target_profile_code,
         rule_version, authority_version, supersedes_authority_id,
         assignment_authority_id, assignment_authority_version,
         assignment_content_hash, source_graph_hash,
         cost_close_watermark_hash, event_close_watermark_hash,
         total_direct_cost_cents, currency, profile_eligibility,
         content_hash, expected_work_order_version, status,
         created_by_user_id, server_observed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        authorityRef,
        authorityShape.economic_root_id,
        authorityShape.work_order_id,
        authorityShape.authorized_company_ref,
        authorityShape.authorized_business_sector_ref,
        authorityShape.authorized_store_ref,
        authorityShape.authorized_customer_ref,
        authorityShape.target_profile_code,
        authorityShape.rule_version,
        authorityShape.authority_version,
        authorityShape.supersedes_authority_id,
        authorityShape.assignment_authority_id,
        authorityShape.assignment_authority_version,
        authorityShape.assignment_content_hash,
        authorityShape.source_graph_hash,
        authorityShape.cost_close_watermark_hash,
        authorityShape.event_close_watermark_hash,
        authorityShape.total_direct_cost_cents,
        authorityShape.currency,
        authorityShape.profile_eligibility,
        contentHash,
        authorityShape.expected_work_order_version,
        actor.userId,
        mysqlUtcMillis(authorityShape.server_observed_at),
      ],
    );
    const inserted = await loadAuthorityByOpaqueRef(authorityRef, manager, true);
    if (!inserted) failClosed('repair_cost_event_authority_insert_missing', 'baseline 草稿写入后缺失');
    for (const line of lineShapes) {
      const lineHash = canonicalHash({
        authorityContentHash: contentHash,
        category: line.category,
        disposition: line.disposition,
        amountCents: line.amount_cents,
        occurredAt: line.occurred_at,
        sourceScopeRef: line.source_scope_ref,
        sourceScopeHash: line.source_scope_hash,
        closeWatermarkHash: line.close_watermark_hash,
        evidenceRef: line.evidence_ref,
        evidenceHash: line.evidence_hash,
      });
      await manager.query(
        `INSERT INTO repair_cost_event_authority_lines (
           authority_id, category, disposition, amount_cents, occurred_at,
           source_scope_ref, source_scope_hash, close_watermark_hash,
           evidence_ref, evidence_hash, line_hash
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inserted.id,
          line.category,
          line.disposition,
          line.amount_cents,
          mysqlUtcMillis(line.occurred_at),
          line.source_scope_ref,
          line.source_scope_hash,
          line.close_watermark_hash,
          line.evidence_ref,
          line.evidence_hash,
          lineHash,
        ],
      );
    }
    const lines = await loadLines(Number(inserted.id), manager);
    assertAuthorityContent(inserted, lines);
    const eventId = await insertEvent(
      Number(inserted.id),
      'drafted',
      null,
      'draft',
      actor.userId,
      'baseline_drafted',
      aggregateEvidenceRef,
      aggregateEvidenceHash,
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
  normalized: Readonly<NormalizedSubmitRepairBaselineCostEventAuthorityV1>,
  replayOnly: boolean,
): Promise<RepairBaselineCostEventAuthorityReceiptV1> {
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
    const graph = await lockSourceGraph(locator, actor.userId, preview, manager);
    assertClosedBaselineGraph(graph);
    const authority = await loadAuthorityByOpaqueRef(normalized.authorityId, manager, true);
    if (!authority || Number(authority.work_order_id) !== locator) scopeOrAuthorityUnavailable();
    const lines = await loadLines(Number(authority.id), manager);
    if (authority.status !== 'draft') {
      failClosed('repair_cost_event_status_conflict', '只有 draft baseline 可以提交');
    }
    if (
      Number(authority.created_by_user_id) !== actor.userId ||
      Number(authority.authority_version) !== normalized.expectedAuthorityVersion ||
      authority.content_hash !== normalized.expectedContentHash
    ) {
      failClosed('repair_cost_event_submit_mismatch', '提交人、版本或内容哈希不匹配');
    }
    if (
      authority.authorized_company_ref !== graph.profile.companyRef ||
      authority.authorized_business_sector_ref !== graph.profile.businessSectorRef ||
      authority.authorized_store_ref !== graph.profile.storeRef ||
      authority.authorized_customer_ref !== graph.profile.customerRef
    ) {
      failClosed('repair_cost_event_authority_scope_drift', '草稿组织范围与当前工单不一致');
    }
    assertAuthorityContent(authority, lines);
    assertGraphStillMatches(authority, graph);
    if (authority.profile_eligibility !== 'eligible') {
      failClosed('repair_cost_event_external_cost_profile_blocked', '非零成本 baseline 不能提交到首个 profile');
    }
    const result = await manager.query(
      `UPDATE repair_cost_event_authorities
          SET status = 'submitted', submitted_by_user_id = ?, submitted_at = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status = 'draft'`,
      [actor.userId, authority.id],
    );
    if (Number(result?.affectedRows ?? -1) !== 1) {
      failClosed('repair_cost_event_status_conflict', 'baseline 提交状态竞争失败');
    }
    authority.status = 'submitted';
    authority.submitted_by_user_id = actor.userId;
    const eventId = await insertEvent(
      Number(authority.id),
      'submitted',
      'draft',
      'submitted',
      actor.userId,
      'baseline_submitted',
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
  normalized: Readonly<NormalizedDecideRepairBaselineCostEventAuthorityV1>,
  replayOnly: boolean,
): Promise<RepairBaselineCostEventAuthorityReceiptV1> {
  const phase: CostEventPhaseV1 = normalized.decision === 'approve' ? 'approve' : 'reject';
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
    const graph = await lockSourceGraph(locator, actor.userId, preview, manager);
    assertClosedBaselineGraph(graph);
    const allAuthorities = await manager.query(
      `SELECT id, authority_ref, economic_root_id, work_order_id,
              authorized_company_ref, authorized_business_sector_ref,
              authorized_store_ref, authorized_customer_ref,
              target_profile_code, rule_version, authority_version,
              supersedes_authority_id, assignment_authority_id,
              assignment_authority_version, assignment_content_hash,
              source_graph_hash, cost_close_watermark_hash,
              event_close_watermark_hash, total_direct_cost_cents,
              currency, profile_eligibility, content_hash,
              expected_work_order_version, status, created_by_user_id,
              submitted_by_user_id, approved_by_user_id, rejected_by_user_id,
              superseded_by_user_id, server_observed_at, approved_at
         FROM repair_cost_event_authorities
        WHERE economic_root_id = ?
        ORDER BY authority_version, id FOR UPDATE`,
      [graph.root.economic_root_id],
    ) as AuthorityRowV1[];
    const authority = allAuthorities.find((row) => row.authority_ref === normalized.authorityId);
    if (!authority || Number(authority.work_order_id) !== locator) scopeOrAuthorityUnavailable();
    const lines = await loadLines(Number(authority.id), manager);
    if (authority.status !== 'submitted') {
      failClosed('repair_cost_event_status_conflict', '只有 submitted baseline 可以审批或拒绝');
    }
    if (
      Number(authority.authority_version) !== normalized.expectedAuthorityVersion ||
      authority.content_hash !== normalized.expectedContentHash
    ) {
      failClosed('repair_cost_event_decision_mismatch', '审批版本或内容哈希不匹配');
    }
    if (
      authority.submitted_by_user_id == null ||
      Number(authority.created_by_user_id) !== Number(authority.submitted_by_user_id)
    ) {
      failClosed('repair_cost_event_maker_graph_corrupt', '草稿人与提交人链不一致');
    }
    if (
      Number(authority.created_by_user_id) === actor.userId ||
      Number(authority.submitted_by_user_id) === actor.userId
    ) {
      throw new ForbiddenException('[repair_cost_event_maker_checker_same_actor] 提交人与审批人不得相同');
    }
    if (
      authority.authorized_company_ref !== graph.profile.companyRef ||
      authority.authorized_business_sector_ref !== graph.profile.businessSectorRef ||
      authority.authorized_store_ref !== graph.profile.storeRef ||
      authority.authorized_customer_ref !== graph.profile.customerRef
    ) {
      failClosed('repair_cost_event_authority_scope_drift', '草稿组织范围与当前工单不一致');
    }
    assertAuthorityContent(authority, lines);
    assertGraphStillMatches(authority, graph);
    if (authority.profile_eligibility !== 'eligible') {
      failClosed('repair_cost_event_external_cost_profile_blocked', '非零成本 baseline 不能批准到首个 profile');
    }

    let supersededAuthorityRef: string | null = null;
    if (normalized.decision === 'approve') {
      const currentlyApproved = allAuthorities.filter((row) => row.status === 'approved');
      if (currentlyApproved.length > 1) {
        failClosed('repair_cost_event_approved_authority_ambiguous', '正式 baseline 权威不唯一');
      }
      const predecessor = authority.supersedes_authority_id == null
        ? null
        : allAuthorities.find((row) => Number(row.id) === Number(authority.supersedes_authority_id)) ?? null;
      if (
        (currentlyApproved[0] == null ? null : Number(currentlyApproved[0].id)) !==
          (predecessor == null ? null : Number(predecessor.id)) ||
        (predecessor != null && Number(predecessor.authority_version) >= Number(authority.authority_version))
      ) {
        failClosed('repair_cost_event_supersedes_drift', '获批前正式 baseline 链发生变化');
      }
      if (predecessor) {
        const oldUpdate = await manager.query(
          `UPDATE repair_cost_event_authorities
              SET status = 'superseded', superseded_by_user_id = ?,
                  superseded_at = CURRENT_TIMESTAMP(6)
            WHERE id = ? AND status = 'approved'`,
          [actor.userId, predecessor.id],
        );
        if (Number(oldUpdate?.affectedRows ?? -1) !== 1) {
          failClosed('repair_cost_event_supersedes_conflict', '旧正式 baseline 无法原子替代');
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
        `UPDATE repair_cost_event_authorities
            SET status = 'approved', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP(6)
          WHERE id = ? AND status = 'submitted'`,
        [actor.userId, authority.id],
      );
      if (Number(update?.affectedRows ?? -1) !== 1) {
        failClosed('repair_cost_event_status_conflict', 'baseline 审批状态竞争失败');
      }
      authority.status = 'approved';
      authority.approved_by_user_id = actor.userId;
      const approvedTimes = await manager.query(
        `SELECT approved_at FROM repair_cost_event_authorities WHERE id = ? FOR UPDATE`,
        [authority.id],
      );
      authority.approved_at = approvedTimes[0]?.approved_at ?? null;
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
        (supersededAuthorityRef == null ? null : `repair-cost-event:${supersededAuthorityRef}`) !==
        receipt.supersededAuthorityRef
      ) {
        failClosed('repair_cost_event_receipt_supersedes_mismatch', '替代回执不一致');
      }
      return receipt;
    }

    const update = await manager.query(
      `UPDATE repair_cost_event_authorities
          SET status = 'rejected', rejected_by_user_id = ?, rejected_at = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status = 'submitted'`,
      [actor.userId, authority.id],
    );
    if (Number(update?.affectedRows ?? -1) !== 1) {
      failClosed('repair_cost_event_status_conflict', 'baseline 拒绝状态竞争失败');
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

export async function draftRepairBaselineCostEventAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairBaselineCostEventAuthorityReceiptV1> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeDraftRepairBaselineCostEventAuthorityCommandV1(command);
  try {
    return await runDraft(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof CostEventIdempotencyRaceV1 &&
      error.phase === 'draft' &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) return runDraft(dataSource, currentUser, normalized, true);
    mapStorageFailure(error);
  }
}

export async function submitRepairBaselineCostEventAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairBaselineCostEventAuthorityReceiptV1> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeSubmitRepairBaselineCostEventAuthorityCommandV1(command);
  try {
    return await runSubmit(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof CostEventIdempotencyRaceV1 &&
      error.phase === 'submit' &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) return runSubmit(dataSource, currentUser, normalized, true);
    mapStorageFailure(error);
  }
}

export async function decideRepairBaselineCostEventAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairBaselineCostEventAuthorityReceiptV1> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeDecideRepairBaselineCostEventAuthorityCommandV1(command);
  const phase = normalized.decision === 'approve' ? 'approve' : 'reject';
  try {
    return await runDecision(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof CostEventIdempotencyRaceV1 &&
      error.phase === phase &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) return runDecision(dataSource, currentUser, normalized, true);
    mapStorageFailure(error);
  }
}
