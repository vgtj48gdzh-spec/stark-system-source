import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessScopeGrant } from '../business-foundation/entities/business-foundation.entities';
import { Employee } from '../performance/entities/employee.entity';
import { RepairWorkOrderProfile } from '../repair-shop/entities/repair-shop.entities';
import { prequoteAdmission } from '../repair-shop/repair-prequote.policy';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { User } from '../users/entities/user.entity';

/**
 * SOURCE-ONLY / PRODUCTION-UNWIRED candidate for repair economic lineage.
 *
 * This file is intentionally not imported by a Nest module, controller,
 * BusinessContributionService, BusinessContributionSourceAuthorityResolver,
 * adapter or work-order create/confirm composer. It owns no production route
 * and cannot make repair a formal contribution adapter. Formal adapters remain
 * 0/4 and repair resolution remains fail-closed.
 */

export const REPAIR_ECONOMIC_LINEAGE_SCHEMA_VERSION =
  'gov1-s2-repair-economic-lineage-source-v1' as const;
export const REPAIR_ECONOMIC_LINEAGE_RULE_VERSION =
  'gov1-s2-repair-economic-lineage-rule-v1' as const;

const PROPOSE_PERMISSION = 'gov1.repair.lineage.propose' as const;
const APPROVE_PERMISSION = 'gov1.repair.lineage.approve' as const;
const WORK_ORDER_REF = /^work-order:([1-9]\d*)$/;
const PROPOSAL_REF = /^lineage-decision:([0-9a-f]{64})$/;
const SAFE_EVIDENCE_REF = /^evidence:[0-9a-f]{64}$/;
const LOWER_HEX_64 = /^[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY = /^lineage-idempotency:[0-9a-f]{64}$/;
const IDEMPOTENCY_CLAIM_UNIQUE = 'uq_repair_lineage_idempotency_claim_key';

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

export type RepairEconomicLineageRelationV1 = 'origin' | 'cancel_recreate';

export interface ProposeRepairEconomicLineageCommandV1 {
  readonly relationType: RepairEconomicLineageRelationV1;
  readonly targetWorkOrderRef: string;
  readonly predecessorWorkOrderRef?: string;
  readonly reasonCode:
    | 'initial_registration'
    | 'cancelled_recreated_same_economic_fact';
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly expectedTargetVersion: number;
  readonly expectedPredecessorVersion?: number;
}

export interface ApproveRepairEconomicLineageCommandV1 {
  readonly proposalRef: string;
  readonly reasonCode: 'lineage_verified';
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly expectedProposalVersion: 1;
}

export interface RepairEconomicLineageProposalReceiptV1 {
  readonly status: 'pending_checker_approval';
  readonly schemaVersion: typeof REPAIR_ECONOMIC_LINEAGE_SCHEMA_VERSION;
  readonly ruleVersion: typeof REPAIR_ECONOMIC_LINEAGE_RULE_VERSION;
  readonly proposalRef: string;
  readonly relationType: RepairEconomicLineageRelationV1;
  readonly targetWorkOrderRef: string;
  readonly predecessorWorkOrderRef: string | null;
  readonly reasonCode: ProposeRepairEconomicLineageCommandV1['reasonCode'];
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly expectedTargetVersion: number;
  readonly expectedPredecessorVersion: number | null;
}

export interface RepairEconomicLineageApprovalReceiptV1 {
  readonly status: 'accepted';
  readonly schemaVersion: typeof REPAIR_ECONOMIC_LINEAGE_SCHEMA_VERSION;
  readonly ruleVersion: typeof REPAIR_ECONOMIC_LINEAGE_RULE_VERSION;
  readonly proposalRef: string;
  readonly approvalRef: string;
  readonly economicRootRef: string;
  readonly relationType: RepairEconomicLineageRelationV1;
  readonly targetWorkOrderRef: string;
  readonly predecessorWorkOrderRef: string | null;
  readonly reasonCode: ApproveRepairEconomicLineageCommandV1['reasonCode'];
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly expectedProposalVersion: 1;
}

interface NormalizedProposalV1 {
  relationType: RepairEconomicLineageRelationV1;
  targetWorkOrderId: number;
  predecessorWorkOrderId: number | null;
  reasonCode: ProposeRepairEconomicLineageCommandV1['reasonCode'];
  evidenceRef: string;
  evidenceHash: string;
  idempotencyKey: string;
  expectedTargetVersion: number;
  expectedPredecessorVersion: number | null;
  requestFingerprint: string;
}

interface NormalizedApprovalV1 {
  proposalDecisionRef: string;
  reasonCode: ApproveRepairEconomicLineageCommandV1['reasonCode'];
  evidenceRef: string;
  evidenceHash: string;
  idempotencyKey: string;
  expectedProposalVersion: 1;
  requestFingerprint: string;
}

interface LocatorScopeV1 {
  companyRef: string;
  businessSectorRef: string;
  storeRef: string;
  customerRef: string;
}

interface LockedActorV1 {
  userId: number;
  employeeId: number;
  roleCodes: string[];
}

interface MinimalProposalLocatorV1 {
  target_work_order_id: string | number;
  predecessor_work_order_id: string | number | null;
}

interface IdempotencyClaimRowV1 {
  idempotency_key: string;
  phase: 'proposal' | 'approval';
  request_fingerprint: string;
}

class IdempotencyClaimRaceV1 extends Error {
  constructor(
    readonly phase: 'proposal' | 'approval',
    readonly idempotencyKey: string,
    readonly requestFingerprint: string,
  ) {
    super('repair_lineage_idempotency_claim_race');
  }
}

interface LineageDecisionRowV1 {
  id: string | number;
  decision_ref: string;
  phase: 'proposal' | 'approval';
  proposal_decision_id: string | number | null;
  relation_type: RepairEconomicLineageRelationV1;
  predecessor_work_order_id: string | number | null;
  target_work_order_id: string | number;
  authorized_company_ref: string;
  authorized_business_sector_ref: string;
  authorized_store_ref: string;
  authorized_customer_ref: string;
  reason_code: string;
  evidence_ref: string;
  evidence_hash: string;
  idempotency_key: string;
  request_fingerprint: string;
  expected_predecessor_version: string | number | null;
  expected_target_version: string | number;
  economic_root_id: string | null;
  actor_user_id: string | number;
  version: string | number;
}

interface LineageBindingRowV1 {
  work_order_id: string | number;
  economic_root_id: string;
  root_origin_work_order_id: string | number;
  lineage_role: 'origin' | 'recreated';
  accepted_phase: 'approval';
  relation_type: RepairEconomicLineageRelationV1;
  predecessor_work_order_id: string | number | null;
  accepted_decision_id: string | number;
}

function failClosed(code: string, message: string): never {
  throw new ConflictException(`[${code}] ${message}`);
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

function assertPositiveMysqlInt(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 2147483647) {
    failClosed('repair_lineage_expected_version_invalid', `${label} 必须是 MySQL 正整数`);
  }
  return Number(value);
}

function parseWorkOrderRef(value: unknown, label: string): number {
  const normalized = String(value ?? '').trim().toLowerCase();
  const match = WORK_ORDER_REF.exec(normalized);
  if (!match) {
    failClosed('repair_lineage_work_order_ref_invalid', `${label} 必须是 work-order:<正整数>`);
  }
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    failClosed('repair_lineage_work_order_ref_invalid', `${label} 超出 MySQL INT 范围`);
  }
  return id;
}

function normalizeEvidenceRef(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!SAFE_EVIDENCE_REF.test(normalized)) {
    failClosed(
      'repair_lineage_evidence_ref_invalid',
      '证据引用必须是 evidence:<lowercase-sha256>，不得包含原始业务或个人数据',
    );
  }
  return normalized;
}

function normalizeHash(value: unknown, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!LOWER_HEX_64.test(normalized)) {
    failClosed('repair_lineage_hash_invalid', `${label} 必须是 lowercase SHA-256`);
  }
  return normalized;
}

function normalizeIdempotencyKey(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!IDEMPOTENCY_KEY.test(normalized)) {
    failClosed('repair_lineage_idempotency_key_invalid', '幂等键格式不符合固定安全白名单');
  }
  return normalized;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export function normalizeRepairEconomicLineageProposalCommandV1(
  command: unknown,
): Readonly<NormalizedProposalV1> {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    failClosed('repair_lineage_proposal_shape_invalid', '提议命令必须是固定对象');
  }
  const relationType = String(
    (command as Record<string, unknown>).relationType ?? '',
  ) as RepairEconomicLineageRelationV1;
  const allowedKeys = relationType === 'origin'
    ? [
        'relationType',
        'targetWorkOrderRef',
        'reasonCode',
        'evidenceRef',
        'evidenceHash',
        'idempotencyKey',
        'expectedTargetVersion',
      ]
    : relationType === 'cancel_recreate'
      ? [
          'relationType',
          'targetWorkOrderRef',
          'predecessorWorkOrderRef',
          'reasonCode',
          'evidenceRef',
          'evidenceHash',
          'idempotencyKey',
          'expectedTargetVersion',
          'expectedPredecessorVersion',
        ]
      : [];
  if (!allowedKeys.length) {
    failClosed(
      'repair_lineage_relation_unsupported',
      '首版只接受 origin 或 cancel_recreate；unknown/split/merge 必须 fail closed',
    );
  }
  assertPlainExactObject(command, allowedKeys, 'repair_lineage_proposal_shape_invalid');
  const targetWorkOrderId = parseWorkOrderRef(command.targetWorkOrderRef, 'targetWorkOrderRef');
  const predecessorWorkOrderId = relationType === 'cancel_recreate'
    ? parseWorkOrderRef(command.predecessorWorkOrderRef, 'predecessorWorkOrderRef')
    : null;
  if (predecessorWorkOrderId === targetWorkOrderId) {
    failClosed('repair_lineage_self_relation_rejected', '前序工单与目标工单不得相同');
  }
  const expectedTargetVersion = assertPositiveMysqlInt(
    command.expectedTargetVersion,
    'expectedTargetVersion',
  );
  const expectedPredecessorVersion = predecessorWorkOrderId == null
    ? null
    : assertPositiveMysqlInt(
        command.expectedPredecessorVersion,
        'expectedPredecessorVersion',
      );
  const reasonCode = String(command.reasonCode ?? '');
  const expectedReason = relationType === 'origin'
    ? 'initial_registration'
    : 'cancelled_recreated_same_economic_fact';
  if (reasonCode !== expectedReason) {
    failClosed('repair_lineage_reason_invalid', '关系与固定理由码不一致');
  }
  const normalized = {
    relationType,
    targetWorkOrderId,
    predecessorWorkOrderId,
    reasonCode: reasonCode as NormalizedProposalV1['reasonCode'],
    evidenceRef: normalizeEvidenceRef(command.evidenceRef),
    evidenceHash: normalizeHash(command.evidenceHash, 'evidenceHash'),
    idempotencyKey: normalizeIdempotencyKey(command.idempotencyKey),
    expectedTargetVersion,
    expectedPredecessorVersion,
  };
  return deepFreeze({ ...normalized, requestFingerprint: hashJson(normalized) });
}

export function normalizeRepairEconomicLineageApprovalCommandV1(
  command: unknown,
): Readonly<NormalizedApprovalV1> {
  assertPlainExactObject(
    command,
    [
      'proposalRef',
      'reasonCode',
      'evidenceRef',
      'evidenceHash',
      'idempotencyKey',
      'expectedProposalVersion',
    ],
    'repair_lineage_approval_shape_invalid',
  );
  const proposalRef = String(command.proposalRef ?? '').trim().toLowerCase();
  const match = PROPOSAL_REF.exec(proposalRef);
  if (!match) {
    failClosed('repair_lineage_proposal_ref_invalid', 'proposalRef 格式无效');
  }
  if (command.reasonCode !== 'lineage_verified') {
    failClosed('repair_lineage_reason_invalid', '审批只接受 lineage_verified 固定理由码');
  }
  if (command.expectedProposalVersion !== 1) {
    failClosed('repair_lineage_expected_version_invalid', '首版提议版本必须精确为 1');
  }
  const normalized = {
    proposalDecisionRef: match[1],
    reasonCode: 'lineage_verified' as const,
    evidenceRef: normalizeEvidenceRef(command.evidenceRef),
    evidenceHash: normalizeHash(command.evidenceHash, 'evidenceHash'),
    idempotencyKey: normalizeIdempotencyKey(command.idempotencyKey),
    expectedProposalVersion: 1 as const,
  };
  return deepFreeze({ ...normalized, requestFingerprint: hashJson(normalized) });
}

/** Server-only randomness; no caller, work order, profile or authority input. */
export function issueRepairEconomicRootIdV1(): string {
  return randomBytes(32).toString('hex');
}

function issueDecisionRefV1(): string {
  return randomBytes(32).toString('hex');
}

function assertTrustedBackendDataSource(dataSource: DataSource): void {
  if (
    !(dataSource instanceof DataSource) ||
    !dataSource.isInitialized ||
    dataSource.options.type !== 'mysql' ||
    !(dataSource.manager instanceof EntityManager) ||
    dataSource.manager.connection !== dataSource
  ) {
    failClosed(
      'repair_lineage_data_source_invalid',
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
    failClosed('repair_lineage_transaction_manager_invalid', '事务连接身份无效');
  }
}

function canonicalIsolation(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[-_\s]+/g, ' ');
}

async function assertCurrentActiveRepeatableRead(manager: EntityManager): Promise<void> {
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
    failClosed('repair_lineage_transaction_oracle_unavailable', '无法核验当前事务');
  }
  if (
    rows.length !== 1 ||
    String(rows[0].state ?? '').trim().toUpperCase() !== 'ACTIVE' ||
    canonicalIsolation(rows[0].isolation_level) !== canonicalIsolation('REPEATABLE READ') ||
    !['NO', '0'].includes(String(rows[0].autocommit ?? '').trim().toUpperCase())
  ) {
    failClosed(
      'repair_lineage_transaction_isolation_invalid',
      '当前连接必须是 ACTIVE REPEATABLE READ 非自动提交事务',
    );
  }
}

function normalizeGrantPermissions(value: unknown): string[] {
  let raw = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) && raw.every((item) => typeof item === 'string')
    ? raw
    : [];
}

async function assertCurrentActorRole(
  currentUser: CurrentUser,
  permission: typeof PROPOSE_PERMISSION | typeof APPROVE_PERMISSION,
  manager: EntityManager,
): Promise<LockedActorV1> {
  if (currentUser.identitySource !== 'trusted_proxy') {
    throw new ForbiddenException('[repair_lineage_identity_source_invalid] 非可信代理身份被拒绝');
  }
  const user = await manager.getRepository(User).findOne({
    where: { id: currentUser.id },
    lock: { mode: 'pessimistic_read' },
  });
  if (!user || user.status !== 1 || user.username !== currentUser.username) {
    throw new ForbiddenException('[repair_lineage_actor_revoked] 当前人员身份已撤销或变化');
  }
  const userRoles = await manager.getRepository(UserRole).find({
    where: { userId: user.id },
    order: { roleId: 'ASC', id: 'ASC' },
    lock: { mode: 'pessimistic_read' },
  });
  const roleIds = userRoles.map((item) => item.roleId);
  if (roleIds.length !== new Set(roleIds).size) {
    throw new ForbiddenException('[repair_lineage_role_binding_duplicate] 正式角色绑定重复');
  }
  const roles = roleIds.length
    ? await manager.getRepository(Role).find({
        where: { id: In([...roleIds].sort((a, b) => a - b)) },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_read' },
      })
    : [];
  if (roles.length !== roleIds.length) {
    throw new ForbiddenException('[repair_lineage_role_revoked] 正式角色已撤销');
  }
  const allowedRoles = permission === PROPOSE_PERMISSION ? proposerRoles : checkerRoles;
  const roleCodes = roles.map((role) => role.code);
  if (!roleCodes.some((role) => allowedRoles.has(role))) {
    throw new ForbiddenException('[repair_lineage_role_denied] 当前角色无该阶段权限');
  }
  const employees = await manager.getRepository(Employee).find({
    where: { linkedUserId: user.id, status: 1 },
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_read' },
  });
  if (employees.length !== 1) {
    throw new ForbiddenException('[repair_lineage_employee_binding_invalid] 缺少唯一有效员工绑定');
  }
  return { userId: user.id, employeeId: employees[0].id, roleCodes };
}

async function loadLocatorProfiles(
  workOrderIds: number[],
  manager: EntityManager,
): Promise<Map<number, RepairWorkOrderProfile>> {
  const ids = [...new Set(workOrderIds)].sort((a, b) => a - b);
  const profiles = await manager.getRepository(RepairWorkOrderProfile).find({
    where: { workOrderId: In(ids) },
    select: [
      'id',
      'workOrderId',
      'companyRef',
      'businessSectorRef',
      'storeRef',
      'customerRef',
    ] as never,
    order: { workOrderId: 'ASC' },
  });
  if (profiles.length !== ids.length) {
    throw new NotFoundException('[repair_lineage_profile_missing] 汽修工单档案不存在');
  }
  return new Map(profiles.map((profile) => [profile.workOrderId, profile]));
}

async function loadMinimalProposalLocator(
  proposalDecisionRef: string,
  manager: EntityManager,
): Promise<MinimalProposalLocatorV1 | null> {
  // This is the only proposal read allowed before approval scope authorization.
  // Deliberately excludes evidence, idempotency, actor, fingerprint and versions.
  const rows = await manager.query(
    `SELECT target_work_order_id, predecessor_work_order_id
       FROM repair_economic_lineage_decisions
      WHERE decision_ref = ? AND phase = 'proposal'`,
    [proposalDecisionRef],
  ) as MinimalProposalLocatorV1[];
  if (rows.length > 1) {
    failClosed('repair_lineage_proposal_locator_corrupt', '提议定位记录不唯一');
  }
  return rows[0] ?? null;
}

function scopeOrProposalUnavailable(): never {
  throw new ForbiddenException(
    '[repair_lineage_scope_or_proposal_unavailable] 提议不存在或当前组织范围不可用',
  );
}

function scopeOf(profile: RepairWorkOrderProfile): LocatorScopeV1 {
  return {
    companyRef: profile.companyRef,
    businessSectorRef: profile.businessSectorRef,
    storeRef: profile.storeRef,
    customerRef: profile.customerRef,
  };
}

function assertSameScope(left: RepairWorkOrderProfile, right: RepairWorkOrderProfile): void {
  if (
    left.companyRef !== right.companyRef ||
    left.businessSectorRef !== right.businessSectorRef ||
    left.storeRef !== right.storeRef ||
    left.customerRef !== right.customerRef
  ) {
    failClosed('repair_lineage_cross_scope_rejected', '跨公司/业务/门店/客户关系被拒绝');
  }
}

function assertLockedScopeTupleUnchanged(
  locked: RepairWorkOrderProfile,
  authorized: RepairWorkOrderProfile,
  label: string,
): void {
  if (
    locked.workOrderId !== authorized.workOrderId ||
    locked.companyRef !== authorized.companyRef ||
    locked.businessSectorRef !== authorized.businessSectorRef ||
    locked.storeRef !== authorized.storeRef ||
    locked.customerRef !== authorized.customerRef
  ) {
    failClosed('repair_lineage_locked_scope_tuple_drift', `${label} 授权范围在锁定前后发生变化`);
  }
}

function assertProposalScopeTupleUnchanged(
  proposal: LineageDecisionRowV1,
  authorized: RepairWorkOrderProfile,
): void {
  if (
    proposal.authorized_company_ref !== authorized.companyRef ||
    proposal.authorized_business_sector_ref !== authorized.businessSectorRef ||
    proposal.authorized_store_ref !== authorized.storeRef ||
    proposal.authorized_customer_ref !== authorized.customerRef
  ) {
    failClosed(
      'repair_lineage_proposal_scope_tuple_drift',
      '提议时授权范围与审批时权威范围不一致',
    );
  }
}

async function assertCurrentScopeGrant(
  actor: LockedActorV1,
  permission: typeof PROPOSE_PERMISSION | typeof APPROVE_PERMISSION,
  scopes: LocatorScopeV1[],
  manager: EntityManager,
): Promise<void> {
  const now = new Date();
  for (const scope of scopes) {
    const grants = await manager.getRepository(BusinessScopeGrant).find({
      where: {
        userId: actor.userId,
        employeeId: actor.employeeId,
        companyRef: scope.companyRef,
        status: 'active',
      },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_read' },
    });
    const matching = grants.filter((grant) => {
      const permissions = normalizeGrantPermissions(grant.permissions);
      const validFrom = grant.validFrom instanceof Date ? grant.validFrom : new Date(grant.validFrom);
      const validUntil = grant.validUntil == null
        ? null
        : grant.validUntil instanceof Date
          ? grant.validUntil
          : new Date(grant.validUntil);
      return (
        validFrom.getTime() <= now.getTime() &&
        (validUntil == null || validUntil.getTime() >= now.getTime()) &&
        (permissions.includes('*') || permissions.includes(permission)) &&
        (grant.businessSectorRef == null || grant.businessSectorRef === scope.businessSectorRef) &&
        (grant.storeRef == null || grant.storeRef === scope.storeRef) &&
        (grant.customerRef == null || grant.customerRef === scope.customerRef)
      );
    });
    if (matching.some((grant) => grant.effect === 'deny')) {
      throw new ForbiddenException('[repair_lineage_scope_denied] 当前组织范围被明确拒绝');
    }
    if (!matching.some((grant) => grant.effect === 'allow')) {
      throw new ForbiddenException('[repair_lineage_scope_missing] 当前组织范围缺少精确授权');
    }
  }
}

function toProposalReceipt(row: LineageDecisionRowV1): RepairEconomicLineageProposalReceiptV1 {
  return deepFreeze({
    status: 'pending_checker_approval',
    schemaVersion: REPAIR_ECONOMIC_LINEAGE_SCHEMA_VERSION,
    ruleVersion: REPAIR_ECONOMIC_LINEAGE_RULE_VERSION,
    proposalRef: `lineage-decision:${row.decision_ref}`,
    relationType: row.relation_type,
    targetWorkOrderRef: `work-order:${Number(row.target_work_order_id)}`,
    predecessorWorkOrderRef: row.predecessor_work_order_id == null
      ? null
      : `work-order:${Number(row.predecessor_work_order_id)}`,
    reasonCode: row.reason_code as ProposeRepairEconomicLineageCommandV1['reasonCode'],
    evidenceHash: row.evidence_hash,
    idempotencyKey: row.idempotency_key,
    expectedTargetVersion: Number(row.expected_target_version),
    expectedPredecessorVersion: row.expected_predecessor_version == null
      ? null
      : Number(row.expected_predecessor_version),
  });
}

function toApprovalReceipt(
  approval: LineageDecisionRowV1,
  proposal: LineageDecisionRowV1,
): RepairEconomicLineageApprovalReceiptV1 {
  return deepFreeze({
    status: 'accepted',
    schemaVersion: REPAIR_ECONOMIC_LINEAGE_SCHEMA_VERSION,
    ruleVersion: REPAIR_ECONOMIC_LINEAGE_RULE_VERSION,
    proposalRef: `lineage-decision:${proposal.decision_ref}`,
    approvalRef: `lineage-decision:${approval.decision_ref}`,
    economicRootRef: `economic-root:${approval.economic_root_id}`,
    relationType: proposal.relation_type,
    targetWorkOrderRef: `work-order:${Number(proposal.target_work_order_id)}`,
    predecessorWorkOrderRef: proposal.predecessor_work_order_id == null
      ? null
      : `work-order:${Number(proposal.predecessor_work_order_id)}`,
    reasonCode: approval.reason_code as 'lineage_verified',
    evidenceHash: approval.evidence_hash,
    idempotencyKey: approval.idempotency_key,
    expectedProposalVersion: 1,
  });
}

async function findDecisionByIdempotency(
  key: string,
  manager: EntityManager,
): Promise<LineageDecisionRowV1 | null> {
  const rows = await manager.query(
    `SELECT id, decision_ref, phase, proposal_decision_id, relation_type,
            predecessor_work_order_id, target_work_order_id,
            authorized_company_ref, authorized_business_sector_ref,
            authorized_store_ref, authorized_customer_ref, reason_code,
            evidence_ref, evidence_hash, idempotency_key, request_fingerprint,
            expected_predecessor_version, expected_target_version,
            economic_root_id, actor_user_id, version
       FROM repair_economic_lineage_decisions
      WHERE idempotency_key = ?`,
    [key],
  ) as LineageDecisionRowV1[];
  if (rows.length > 1) {
    failClosed('repair_lineage_idempotency_corrupt', '幂等键存在多条记录');
  }
  return rows[0] ?? null;
}

async function findIdempotencyClaim(
  key: string,
  manager: EntityManager,
): Promise<IdempotencyClaimRowV1 | null> {
  const rows = await manager.query(
    `SELECT idempotency_key, phase, request_fingerprint
       FROM repair_economic_lineage_idempotency_claims
      WHERE idempotency_key = ?`,
    [key],
  ) as IdempotencyClaimRowV1[];
  if (rows.length > 1) {
    failClosed('repair_lineage_idempotency_claim_corrupt', '幂等声明存在多条记录');
  }
  return rows[0] ?? null;
}

function mysqlDuplicateConstraint(error: unknown): string | null {
  const typed = error as {
    code?: string;
    errno?: number;
    sqlMessage?: string;
    message?: string;
  };
  if (typed?.code !== 'ER_DUP_ENTRY' && typed?.errno !== 1062) return null;
  const message = String(typed.sqlMessage ?? typed.message ?? '');
  const match = /for key ['`](?:[^.'`]+\.)?([^'`]+)['`]/i.exec(message);
  return match?.[1] ?? '';
}

async function claimIdempotency(
  phase: 'proposal' | 'approval',
  key: string,
  fingerprint: string,
  actorUserId: number,
  manager: EntityManager,
): Promise<'inserted' | 'existing'> {
  const existing = await findIdempotencyClaim(key, manager);
  if (existing) return 'existing';
  try {
    await manager.query(
      `INSERT INTO repair_economic_lineage_idempotency_claims (
        idempotency_key, phase, request_fingerprint, actor_user_id
      ) VALUES (?, ?, ?, ?)`,
      [key, phase, fingerprint, actorUserId],
    );
    return 'inserted';
  } catch (error) {
    const constraint = mysqlDuplicateConstraint(error);
    if (constraint === IDEMPOTENCY_CLAIM_UNIQUE) {
      // The enclosing transaction must roll back completely. The public entry
      // point then opens a fresh RR transaction and repeats current authority,
      // scope and locked tuple checks before reading the winner.
      throw new IdempotencyClaimRaceV1(phase, key, fingerprint);
    }
    if (constraint !== null) {
      failClosed('repair_lineage_duplicate_conflict', '关系记录与现有不可变约束冲突');
    }
    throw error;
  }
}

async function assertClaimAndLoadWinner(
  phase: 'proposal' | 'approval',
  key: string,
  fingerprint: string,
  manager: EntityManager,
): Promise<LineageDecisionRowV1> {
  const claim = await findIdempotencyClaim(key, manager);
  if (!claim) {
    failClosed('repair_lineage_idempotency_winner_missing', '并发幂等声明缺失');
  }
  if (claim.phase !== phase) {
    failClosed('repair_lineage_idempotency_phase_conflict', '幂等键已用于其他阶段');
  }
  if (claim.request_fingerprint !== fingerprint) {
    failClosed('repair_lineage_idempotency_conflict', '幂等键已绑定不同请求');
  }
  const winner = await findDecisionByIdempotency(key, manager);
  if (!winner) {
    failClosed('repair_lineage_idempotency_winner_missing', '幂等声明没有对应不可变结果');
  }
  assertIdempotencyFingerprint(winner, fingerprint);
  if (winner.phase !== phase) {
    failClosed('repair_lineage_idempotency_phase_conflict', '幂等结果阶段不一致');
  }
  return winner;
}

function assertIdempotencyFingerprint(row: LineageDecisionRowV1, fingerprint: string): void {
  if (row.request_fingerprint !== fingerprint) {
    failClosed('repair_lineage_idempotency_conflict', '幂等键已绑定不同请求');
  }
}

async function loadProposalByRef(
  proposalDecisionRef: string,
  manager: EntityManager,
  forUpdate: boolean,
): Promise<LineageDecisionRowV1> {
  const rows = await manager.query(
    `SELECT id, decision_ref, phase, proposal_decision_id, relation_type,
            predecessor_work_order_id, target_work_order_id,
            authorized_company_ref, authorized_business_sector_ref,
            authorized_store_ref, authorized_customer_ref, reason_code,
            evidence_ref, evidence_hash, idempotency_key, request_fingerprint,
            expected_predecessor_version, expected_target_version,
            economic_root_id, actor_user_id, version
       FROM repair_economic_lineage_decisions
      WHERE decision_ref = ?${forUpdate ? ' FOR UPDATE NOWAIT' : ''}`,
    [proposalDecisionRef],
  ) as LineageDecisionRowV1[];
  if (rows.length !== 1 || rows[0].phase !== 'proposal') {
    throw new NotFoundException('[repair_lineage_proposal_missing] 提议不存在');
  }
  return rows[0];
}

async function lockProfilesInFixedOrder(
  ids: number[],
  manager: EntityManager,
  mode: 'pessimistic_read' | 'pessimistic_write' = 'pessimistic_write',
): Promise<Map<number, RepairWorkOrderProfile>> {
  const ordered = [...new Set(ids)].sort((a, b) => a - b);
  const profiles: RepairWorkOrderProfile[] = [];
  for (const workOrderId of ordered) {
    const profile = await manager.getRepository(RepairWorkOrderProfile).findOne({
      where: { workOrderId },
      lock: { mode, onLocked: 'nowait' },
    });
    if (!profile) {
      throw new NotFoundException('[repair_lineage_profile_missing] 汽修工单档案不存在');
    }
    if (prequoteAdmission(profile)) throw new BadRequestException('[repair_prequote_only] 报价前档案不是经济事实');
    profiles.push(profile);
  }
  return new Map(profiles.map((profile) => [profile.workOrderId, profile]));
}

async function lockMutexesInFixedOrder(ids: number[], actorUserId: number, manager: EntityManager) {
  const ordered = [...new Set(ids)].sort((a, b) => a - b);
  for (const workOrderId of ordered) {
    await manager.query(
      `INSERT IGNORE INTO repair_economic_lineage_mutexes
        (work_order_id, created_by_user_id)
       VALUES (?, ?)`,
      [workOrderId, actorUserId],
    );
  }
  for (const workOrderId of ordered) {
    const rows = await manager.query(
      `SELECT work_order_id
         FROM repair_economic_lineage_mutexes
        WHERE work_order_id = ?
        FOR UPDATE NOWAIT`,
      [workOrderId],
    ) as Array<{ work_order_id: number }>;
    if (rows.length !== 1) {
      failClosed('repair_lineage_mutex_missing', '工单并发锁记录缺失');
    }
  }
}

async function lockBindings(
  ids: number[],
  manager: EntityManager,
): Promise<Map<number, LineageBindingRowV1>> {
  const ordered = [...new Set(ids)].sort((a, b) => a - b);
  const rows = await manager.query(
    `SELECT work_order_id, economic_root_id, root_origin_work_order_id,
            lineage_role, accepted_phase, relation_type,
            predecessor_work_order_id, accepted_decision_id
       FROM repair_work_order_economic_lineages
      WHERE work_order_id IN (${ordered.map(() => '?').join(',')})
      ORDER BY work_order_id
      FOR UPDATE NOWAIT`,
    ordered,
  ) as LineageBindingRowV1[];
  return new Map(rows.map((row) => [Number(row.work_order_id), row]));
}

function nullableMysqlIntKey(value: string | number | null): number {
  return value == null ? 0 : Number(value);
}

function assertApprovalMatchesProposalGraph(
  approval: LineageDecisionRowV1,
  proposal: LineageDecisionRowV1,
): void {
  if (
    approval.phase !== 'approval' ||
    approval.proposal_decision_id == null ||
    Number(approval.proposal_decision_id) !== Number(proposal.id) ||
    approval.relation_type !== proposal.relation_type ||
    nullableMysqlIntKey(approval.predecessor_work_order_id) !==
      nullableMysqlIntKey(proposal.predecessor_work_order_id) ||
    Number(approval.target_work_order_id) !== Number(proposal.target_work_order_id) ||
    approval.authorized_company_ref !== proposal.authorized_company_ref ||
    approval.authorized_business_sector_ref !== proposal.authorized_business_sector_ref ||
    approval.authorized_store_ref !== proposal.authorized_store_ref ||
    approval.authorized_customer_ref !== proposal.authorized_customer_ref ||
    nullableMysqlIntKey(approval.expected_predecessor_version) !==
      nullableMysqlIntKey(proposal.expected_predecessor_version) ||
    Number(approval.expected_target_version) !== Number(proposal.expected_target_version) ||
    approval.reason_code !== 'lineage_verified' ||
    Number(approval.version) !== 1 ||
    !approval.economic_root_id ||
    !LOWER_HEX_64.test(approval.economic_root_id)
  ) {
    failClosed('repair_lineage_idempotency_graph_corrupt', '幂等审批与提议完整语义不一致');
  }
}

async function assertApprovalReplayGraph(
  approval: LineageDecisionRowV1,
  proposal: LineageDecisionRowV1,
  target: RepairWorkOrderProfile,
  predecessor: RepairWorkOrderProfile | null,
  bindings: ReadonlyMap<number, LineageBindingRowV1>,
  manager: EntityManager,
): Promise<void> {
  assertApprovalMatchesProposalGraph(approval, proposal);
  const targetBinding = bindings.get(target.workOrderId);
  if (
    !targetBinding ||
    Number(targetBinding.accepted_decision_id) !== Number(approval.id) ||
    targetBinding.accepted_phase !== 'approval' ||
    targetBinding.economic_root_id !== approval.economic_root_id ||
    targetBinding.relation_type !== proposal.relation_type ||
    nullableMysqlIntKey(targetBinding.predecessor_work_order_id) !==
      nullableMysqlIntKey(proposal.predecessor_work_order_id)
  ) {
    failClosed('repair_lineage_idempotency_graph_corrupt', '幂等审批缺少精确接受绑定');
  }
  if (proposal.relation_type === 'origin') {
    if (
      predecessor ||
      targetBinding.lineage_role !== 'origin' ||
      Number(targetBinding.root_origin_work_order_id) !== target.workOrderId
    ) {
      failClosed('repair_lineage_idempotency_graph_corrupt', 'origin 幂等绑定图已损坏');
    }
  } else if (proposal.relation_type === 'cancel_recreate') {
    const predecessorBinding = predecessor ? bindings.get(predecessor.workOrderId) : null;
    if (
      !predecessor ||
      !predecessorBinding ||
      targetBinding.lineage_role !== 'recreated' ||
      targetBinding.economic_root_id !== predecessorBinding.economic_root_id ||
      Number(targetBinding.root_origin_work_order_id) !==
        Number(predecessorBinding.root_origin_work_order_id)
    ) {
      failClosed('repair_lineage_idempotency_graph_corrupt', '重建幂等绑定图已损坏');
    }
  } else {
    failClosed('repair_lineage_idempotency_graph_corrupt', '幂等审批关系类型无效');
  }

  const roots = await manager.query(
    `SELECT economic_root_id, origin_work_order_id, company_ref,
            business_sector_ref, store_ref, customer_ref, vehicle_id
       FROM business_contribution_economic_fact_roots
      WHERE economic_root_id = ? FOR UPDATE NOWAIT`,
    [approval.economic_root_id],
  ) as Array<Record<string, unknown>>;
  if (
    roots.length !== 1 ||
    String(roots[0].economic_root_id) !== approval.economic_root_id ||
    Number(roots[0].origin_work_order_id) !== Number(targetBinding.root_origin_work_order_id) ||
    roots[0].company_ref !== target.companyRef ||
    roots[0].business_sector_ref !== target.businessSectorRef ||
    roots[0].store_ref !== target.storeRef ||
    roots[0].customer_ref !== target.customerRef ||
    Number(roots[0].vehicle_id) !== target.vehicleId
  ) {
    failClosed('repair_lineage_idempotency_graph_corrupt', '幂等审批经济根图已损坏');
  }
}

function assertProfileVersion(profile: RepairWorkOrderProfile, expected: number, label: string) {
  if (profile.version !== expected) {
    failClosed('repair_lineage_profile_version_conflict', `${label} 版本已变化`);
  }
}

function mapContention(error: unknown): never {
  const typed = error as { code?: string; errno?: number };
  if (typed?.code === 'ER_LOCK_NOWAIT' || typed?.errno === 3572) {
    failClosed('repair_lineage_contention_nowait', '关系记录正被其他事务处理，请重试');
  }
  if (typed?.code === 'ER_LOCK_WAIT_TIMEOUT' || typed?.errno === 1205) {
    failClosed('repair_lineage_contention_timeout', '关系锁等待超时，请重试');
  }
  if (typed?.code === 'ER_LOCK_DEADLOCK' || typed?.errno === 1213) {
    failClosed('repair_lineage_contention_deadlock', '关系事务发生死锁回滚，请重试');
  }
  if (mysqlDuplicateConstraint(error) !== null) {
    failClosed('repair_lineage_duplicate_conflict', '关系记录与现有不可变约束冲突');
  }
  throw error;
}

async function withLineageTransaction<T>(
  dataSource: DataSource,
  operation: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  assertTrustedBackendDataSource(dataSource);
  try {
    return await dataSource.transaction('REPEATABLE READ', async (manager) => {
      assertTransactionManager(manager, dataSource);
      await assertCurrentActiveRepeatableRead(manager);
      return operation(manager);
    });
  } catch (error) {
    return mapContention(error);
  }
}

async function runProposalTransactionV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedProposalV1>,
  raceReplayOnly: boolean,
): Promise<RepairEconomicLineageProposalReceiptV1> {
  return withLineageTransaction(dataSource, async (manager) => {
    const actor = await assertCurrentActorRole(currentUser, PROPOSE_PERMISSION, manager);
    const ids = normalized.predecessorWorkOrderId == null
      ? [normalized.targetWorkOrderId]
      : [normalized.predecessorWorkOrderId, normalized.targetWorkOrderId];
    const locatorProfiles = await loadLocatorProfiles(ids, manager);
    const targetLocator = locatorProfiles.get(normalized.targetWorkOrderId)!;
    const predecessorLocator = normalized.predecessorWorkOrderId == null
      ? null
      : locatorProfiles.get(normalized.predecessorWorkOrderId)!;
    if (predecessorLocator) assertSameScope(predecessorLocator, targetLocator);
    await assertCurrentScopeGrant(actor, PROPOSE_PERMISSION, [scopeOf(targetLocator)], manager);

    const claimState = await claimIdempotency(
      'proposal',
      normalized.idempotencyKey,
      normalized.requestFingerprint,
      actor.userId,
      manager,
    );

    // Proposal also locks every profile, validates transaction-current versions,
    // and compares the locked tuple to the tuple used for scope authorization.
    const profiles = await lockProfilesInFixedOrder(ids, manager, 'pessimistic_read');
    const target = profiles.get(normalized.targetWorkOrderId)!;
    const predecessor = normalized.predecessorWorkOrderId == null
      ? null
      : profiles.get(normalized.predecessorWorkOrderId)!;
    assertLockedScopeTupleUnchanged(target, targetLocator, '目标工单');
    assertProfileVersion(target, normalized.expectedTargetVersion, '目标工单');
    if (predecessor && predecessorLocator) {
      assertLockedScopeTupleUnchanged(predecessor, predecessorLocator, '前序工单');
      assertProfileVersion(predecessor, Number(normalized.expectedPredecessorVersion), '前序工单');
      assertSameScope(predecessor, target);
      if (predecessor.vehicleId !== target.vehicleId) {
        failClosed('repair_lineage_cross_vehicle_rejected', '取消重建必须属于同一车辆');
      }
    }

    if (raceReplayOnly || claimState === 'existing') {
      const winner = await assertClaimAndLoadWinner(
        'proposal',
        normalized.idempotencyKey,
        normalized.requestFingerprint,
        manager,
      );
      return toProposalReceipt(winner);
    }

    const decisionRef = issueDecisionRefV1();
    await manager.query(
      `INSERT INTO repair_economic_lineage_decisions (
        decision_ref, phase, proposal_decision_id, relation_type,
        predecessor_work_order_id, target_work_order_id,
        authorized_company_ref, authorized_business_sector_ref,
        authorized_store_ref, authorized_customer_ref, reason_code,
        evidence_ref, evidence_hash, idempotency_key, request_fingerprint,
        expected_predecessor_version, expected_target_version,
        economic_root_id, actor_user_id, version
      ) VALUES (?, 'proposal', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1)`,
      [
        decisionRef,
        normalized.relationType,
        normalized.predecessorWorkOrderId,
        normalized.targetWorkOrderId,
        target.companyRef,
        target.businessSectorRef,
        target.storeRef,
        target.customerRef,
        normalized.reasonCode,
        normalized.evidenceRef,
        normalized.evidenceHash,
        normalized.idempotencyKey,
        normalized.requestFingerprint,
        normalized.expectedPredecessorVersion,
        normalized.expectedTargetVersion,
        actor.userId,
      ],
    );
    const inserted = await findDecisionByIdempotency(normalized.idempotencyKey, manager);
    if (!inserted) failClosed('repair_lineage_proposal_insert_missing', '提议写入后无法唯一读取');
    return toProposalReceipt(inserted);
  });
}

export async function proposeRepairEconomicLineageV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairEconomicLineageProposalReceiptV1> {
  const normalized = normalizeRepairEconomicLineageProposalCommandV1(command);
  try {
    return await runProposalTransactionV1(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof IdempotencyClaimRaceV1 &&
      error.phase === 'proposal' &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) {
      return runProposalTransactionV1(dataSource, currentUser, normalized, true);
    }
    throw error;
  }
}

async function runApprovalTransactionV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedApprovalV1>,
  raceReplayOnly: boolean,
): Promise<RepairEconomicLineageApprovalReceiptV1> {
  return withLineageTransaction(dataSource, async (manager) => {
    // Only actor authority and the two-column proposal locator are read before
    // scope. Proposal absence and scope denial intentionally share one boundary.
    const actor = await assertCurrentActorRole(currentUser, APPROVE_PERMISSION, manager);
    const proposalLocator = await loadMinimalProposalLocator(
      normalized.proposalDecisionRef,
      manager,
    );
    if (!proposalLocator) scopeOrProposalUnavailable();
    const ids = proposalLocator.predecessor_work_order_id == null
      ? [Number(proposalLocator.target_work_order_id)]
      : [
          Number(proposalLocator.predecessor_work_order_id),
          Number(proposalLocator.target_work_order_id),
        ];
    let locatorProfiles: Map<number, RepairWorkOrderProfile>;
    let targetLocator: RepairWorkOrderProfile;
    let predecessorLocator: RepairWorkOrderProfile | null;
    try {
      locatorProfiles = await loadLocatorProfiles(ids, manager);
      targetLocator = locatorProfiles.get(Number(proposalLocator.target_work_order_id))!;
      predecessorLocator = proposalLocator.predecessor_work_order_id == null
        ? null
        : locatorProfiles.get(Number(proposalLocator.predecessor_work_order_id))!;
      if (predecessorLocator) assertSameScope(predecessorLocator, targetLocator);
      await assertCurrentScopeGrant(actor, APPROVE_PERMISSION, [scopeOf(targetLocator)], manager);
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        scopeOrProposalUnavailable();
      }
      throw error;
    }

    const claimState = await claimIdempotency(
      'approval',
      normalized.idempotencyKey,
      normalized.requestFingerprint,
      actor.userId,
      manager,
    );

    // Fixed business lock order: proposal -> sorted mutexes -> sorted profiles
    // -> sorted bindings. The idempotency claim is an authority-independent
    // append guard and is acquired before these mutation locks.
    const proposal = await loadProposalByRef(normalized.proposalDecisionRef, manager, true);
    if (
      Number(proposal.target_work_order_id) !== Number(proposalLocator.target_work_order_id) ||
      Number(proposal.predecessor_work_order_id ?? 0) !==
        Number(proposalLocator.predecessor_work_order_id ?? 0)
    ) {
      failClosed('repair_lineage_proposal_locator_drift', '提议定位字段在授权后发生变化');
    }
    assertProposalScopeTupleUnchanged(proposal, targetLocator);
    if (Number(proposal.version) !== normalized.expectedProposalVersion) {
      failClosed('repair_lineage_proposal_version_conflict', '提议版本已变化');
    }
    if (Number(proposal.actor_user_id) === actor.userId) {
      throw new ForbiddenException('[repair_lineage_maker_checker_same_actor] 提议人与审批人不得相同');
    }

    await lockMutexesInFixedOrder(ids, actor.userId, manager);
    const profiles = await lockProfilesInFixedOrder(ids, manager);
    const target = profiles.get(Number(proposal.target_work_order_id))!;
    const predecessor = proposal.predecessor_work_order_id == null
      ? null
      : profiles.get(Number(proposal.predecessor_work_order_id))!;
    assertLockedScopeTupleUnchanged(target, targetLocator, '目标工单');
    assertProfileVersion(target, Number(proposal.expected_target_version), '目标工单');
    if (predecessor && predecessorLocator) {
      assertLockedScopeTupleUnchanged(predecessor, predecessorLocator, '前序工单');
      assertProfileVersion(predecessor, Number(proposal.expected_predecessor_version), '前序工单');
      assertSameScope(predecessor, target);
      if (predecessor.vehicleId !== target.vehicleId) {
        failClosed('repair_lineage_cross_vehicle_rejected', '取消重建必须属于同一车辆');
      }
    }
    const bindings = await lockBindings(ids, manager);

    if (raceReplayOnly || claimState === 'existing') {
      const winner = await assertClaimAndLoadWinner(
        'approval',
        normalized.idempotencyKey,
        normalized.requestFingerprint,
        manager,
      );
      if (winner.proposal_decision_id == null || Number(winner.proposal_decision_id) !== Number(proposal.id)) {
        failClosed('repair_lineage_idempotency_proposal_conflict', '幂等键已绑定另一提议');
      }
      await assertApprovalReplayGraph(
        winner,
        proposal,
        target,
        predecessor,
        bindings,
        manager,
      );
      return toApprovalReceipt(winner, proposal);
    }

    const existingResolution = await manager.query(
      `SELECT id FROM repair_economic_lineage_decisions
        WHERE proposal_decision_id = ? LIMIT 2`,
      [proposal.id],
    ) as Array<{ id: number }>;
    if (existingResolution.length) {
      failClosed('repair_lineage_proposal_already_resolved', '提议已有不可变审批结果');
    }
    if (bindings.has(target.workOrderId)) {
      failClosed('repair_lineage_target_already_bound', '目标工单已绑定经济根');
    }

    let economicRootId: string;
    let rootOriginWorkOrderId: number;
    if (proposal.relation_type === 'origin') {
      if (predecessor || proposal.predecessor_work_order_id != null) {
        failClosed('repair_lineage_origin_predecessor_rejected', 'origin 不得包含前序工单');
      }
      if (target.lifecycleStatus === 'cancelled') {
        failClosed('repair_lineage_cancelled_origin_rejected', '已取消工单不能新建 origin');
      }
      economicRootId = issueRepairEconomicRootIdV1();
      rootOriginWorkOrderId = target.workOrderId;
      await manager.query(
        `INSERT INTO business_contribution_economic_fact_roots (
          economic_root_id, business_domain, origin_work_order_id,
          company_ref, business_sector_ref, store_ref, customer_ref,
          vehicle_id, created_by_user_id
        ) VALUES (?, 'repair', ?, ?, ?, ?, ?, ?, ?)`,
        [
          economicRootId,
          rootOriginWorkOrderId,
          target.companyRef,
          target.businessSectorRef,
          target.storeRef,
          target.customerRef,
          target.vehicleId,
          actor.userId,
        ],
      );
    } else if (proposal.relation_type === 'cancel_recreate') {
      if (!predecessor || predecessor.lifecycleStatus !== 'cancelled') {
        failClosed('repair_lineage_predecessor_not_cancelled', '前序工单必须已正式取消');
      }
      if (target.lifecycleStatus === 'cancelled') {
        failClosed('repair_lineage_target_cancelled', '重建目标工单不能已取消');
      }
      const predecessorBinding = bindings.get(predecessor.workOrderId);
      if (!predecessorBinding) {
        failClosed('repair_lineage_predecessor_unbound', '前序工单没有已接受经济根');
      }
      economicRootId = predecessorBinding.economic_root_id;
      rootOriginWorkOrderId = Number(predecessorBinding.root_origin_work_order_id);
      const roots = await manager.query(
        `SELECT economic_root_id, origin_work_order_id, company_ref,
                business_sector_ref, store_ref, customer_ref, vehicle_id
           FROM business_contribution_economic_fact_roots
          WHERE economic_root_id = ? FOR UPDATE NOWAIT`,
        [economicRootId],
      ) as Array<Record<string, unknown>>;
      if (
        roots.length !== 1 ||
        Number(roots[0].origin_work_order_id) !== rootOriginWorkOrderId ||
        roots[0].company_ref !== target.companyRef ||
        roots[0].business_sector_ref !== target.businessSectorRef ||
        roots[0].store_ref !== target.storeRef ||
        roots[0].customer_ref !== target.customerRef ||
        Number(roots[0].vehicle_id) !== target.vehicleId
      ) {
        failClosed('repair_lineage_cross_root_rejected', '前序经济根与目标权威范围不一致');
      }
    } else {
      failClosed('repair_lineage_relation_unsupported', '未知/split/merge 关系被拒绝');
    }

    const approvalRef = issueDecisionRefV1();
    await manager.query(
      `INSERT INTO repair_economic_lineage_decisions (
        decision_ref, phase, proposal_decision_id, relation_type,
        predecessor_work_order_id, target_work_order_id,
        authorized_company_ref, authorized_business_sector_ref,
        authorized_store_ref, authorized_customer_ref, reason_code,
        evidence_ref, evidence_hash, idempotency_key, request_fingerprint,
        expected_predecessor_version, expected_target_version,
        economic_root_id, actor_user_id, version
      ) VALUES (?, 'approval', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        approvalRef,
        proposal.id,
        proposal.relation_type,
        proposal.predecessor_work_order_id,
        proposal.target_work_order_id,
        proposal.authorized_company_ref,
        proposal.authorized_business_sector_ref,
        proposal.authorized_store_ref,
        proposal.authorized_customer_ref,
        normalized.reasonCode,
        normalized.evidenceRef,
        normalized.evidenceHash,
        normalized.idempotencyKey,
        normalized.requestFingerprint,
        proposal.expected_predecessor_version,
        proposal.expected_target_version,
        economicRootId,
        actor.userId,
      ],
    );
    const approvals = await manager.query(
      `SELECT id, decision_ref, phase, proposal_decision_id, relation_type,
              predecessor_work_order_id, target_work_order_id,
              authorized_company_ref, authorized_business_sector_ref,
              authorized_store_ref, authorized_customer_ref, reason_code,
              evidence_ref, evidence_hash, idempotency_key, request_fingerprint,
              expected_predecessor_version, expected_target_version,
              economic_root_id, actor_user_id, version
         FROM repair_economic_lineage_decisions
        WHERE decision_ref = ?`,
      [approvalRef],
    ) as LineageDecisionRowV1[];
    if (approvals.length !== 1) {
      failClosed('repair_lineage_approval_insert_missing', '审批写入后无法唯一读取');
    }
    await manager.query(
      `INSERT INTO repair_work_order_economic_lineages (
        work_order_id, economic_root_id, root_origin_work_order_id,
        lineage_role, accepted_phase, relation_type,
        predecessor_work_order_id, accepted_decision_id
      ) VALUES (?, ?, ?, ?, 'approval', ?, ?, ?)`,
      [
        target.workOrderId,
        economicRootId,
        rootOriginWorkOrderId,
        proposal.relation_type === 'origin' ? 'origin' : 'recreated',
        proposal.relation_type,
        proposal.predecessor_work_order_id,
        approvals[0].id,
      ],
    );
    return toApprovalReceipt(approvals[0], proposal);
  });
}

export async function approveRepairEconomicLineageV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairEconomicLineageApprovalReceiptV1> {
  const normalized = normalizeRepairEconomicLineageApprovalCommandV1(command);
  try {
    return await runApprovalTransactionV1(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof IdempotencyClaimRaceV1 &&
      error.phase === 'approval' &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) {
      return runApprovalTransactionV1(dataSource, currentUser, normalized, true);
    }
    throw error;
  }
}
