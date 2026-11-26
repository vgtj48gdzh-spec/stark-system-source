import { ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EntityManager, EntityTarget, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { BankSmsTransaction } from '../finance-bank-sms/entities/bank-sms-transaction.entity';
import { FinanceCollectionConfirmationAuthority } from '../finance-reconciliation/entities/finance-collection-confirmation-authority.entity';
import { FinanceCollectionOrder } from '../finance-reconciliation/entities/finance-collection-order.entity';
import { FinanceReconciliationLink } from '../finance-reconciliation/entities/finance-reconciliation-link.entity';
import { collectAuthorityEnvelopeProblems } from '../finance-reconciliation/collection-order-confirmation.contract';
import { quotedScopeSnapshot } from '../repair-shop/repair-prequote.policy';
import {
  RepairConfirmationRequest,
  RepairDeliveryRecord,
  RepairDocumentVersion,
  RepairQualityInspection,
  RepairWorkOrderProfile,
} from '../repair-shop/entities/repair-shop.entities';
import { WorkOrder } from '../work-orders/entities/work-order.entity';
import { BusinessContributionAdapters } from './business-contribution.adapters';
import type {
  ContributionSourceSelection,
} from './business-contribution-source-authority';
import type { ContributionSourceAuthorityVersion } from './entities/business-contribution.entities';
import {
  REPAIR_BASELINE_COST_EVENT_CATEGORIES,
  REPAIR_BASELINE_COST_EVENT_RULE_VERSION,
  REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
  REPAIR_BASELINE_COST_EVENT_TARGET_PROFILE,
} from './repair-baseline-cost-event-authority.contract';
import {
  REPAIR_RESPONSIBILITY_ATTRIBUTION_PROFILE,
  REPAIR_RESPONSIBILITY_ATTRIBUTION_RULE_VERSION,
  REPAIR_RESPONSIBILITY_ATTRIBUTION_SCHEMA_VERSION,
} from './repair-responsibility-attribution-authority.contract';
import {
  buildRepairRevenueAuthorityCandidateV1,
  RepairRevenueAuthorityCandidateInputV1,
} from './repair-revenue-authority.contract';
import {
  REPAIR_TYPED_CORRECTION_RULE_VERSION,
  REPAIR_TYPED_CORRECTION_SCHEMA_VERSION,
} from './repair-typed-correction-authority.contract';
import { GroupOperationsInvariants } from './group-operations.invariants';
import {
  VERIFIED_CONTRIBUTION_AUTHORITY_BUNDLE_SCHEMA_VERSION,
  VerifiedContributionAuthorityBundleV1,
  VerifiedContributionRbacContextV1,
} from './verified-contribution-authority-bundle.contract';

/**
 * Module-private production candidate. It is imported only by
 * BusinessContributionSourceAuthorityResolver and remains behind that
 * resolver's literal false enablement guard. It is not a Nest provider, route,
 * controller or diagnostic-receipt conversion path.
 */
export const REPAIR_FIRST_FORMAL_SOURCE_COMPOSER_RULE_VERSION =
  'gov1-s2-repair-first-formal-source-composer-v1' as const;

const HEX_64 = /^[0-9a-f]{64}$/;
const SAFE_EVIDENCE_REF = /^evidence:[0-9a-f]{64}$/;
const SOURCE_ID = /^work-order:([1-9]\d*)$/;
const REQUIRED_ROLES = ['lead_originator', 'business_owner', 'service_owner'] as const;
const REQUIRED_COST_CATEGORIES = REPAIR_BASELINE_COST_EVENT_CATEGORIES;
const SOURCE_VERSION_PREFIX = 'repair-composer-v1';

interface ScopeV1 {
  companyRef: string;
  businessSectorRef: string;
  storeRef: string;
  customerRef: string;
}

interface ProfileRowV1 extends ScopeV1 {
  work_order_id: string | number;
  lifecycle_status: string;
  customer_confirmation_state: string;
  active_plan_version: string | number | null;
  active_quote_version: string | number | null;
  active_explanation_version: string | number | null;
  vehicle_id: string | number;
  scope_resolved_at: Date | string;
  scope_snapshot_version: Record<string, number> | string;
  version: string | number;
}

interface RootRowV1 extends ScopeV1 {
  economic_root_id: string;
  business_domain: string;
  origin_work_order_id: string | number;
  vehicle_id: string | number;
}

interface AssignmentRowV1 {
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
  status: string;
  created_by_user_id: string | number;
  submitted_by_user_id: string | number | null;
  approved_by_user_id: string | number | null;
  rejected_by_user_id: string | number | null;
  superseded_by_user_id: string | number | null;
  submitted_at: Date | string | null;
  approved_at: Date | string | null;
}

interface AttributionRowV1 {
  id: string | number;
  authority_id: string | number;
  role: (typeof REQUIRED_ROLES)[number];
  employee_id: string | number;
  share_bps: string | number;
  effective_from: Date | string;
  effective_to: Date | string | null;
  rule_version: string;
  evidence_ref: string;
  evidence_hash: string;
  line_hash: string;
}

interface BaselineRowV1 {
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
  profile_eligibility: string;
  content_hash: string;
  expected_work_order_version: string | number;
  status: string;
  created_by_user_id: string | number;
  submitted_by_user_id: string | number | null;
  approved_by_user_id: string | number | null;
  rejected_by_user_id: string | number | null;
  superseded_by_user_id: string | number | null;
  server_observed_at: Date | string;
  submitted_at: Date | string | null;
  approved_at: Date | string | null;
}

interface BaselineLineRowV1 {
  id: string | number;
  authority_id: string | number;
  category: (typeof REQUIRED_COST_CATEGORIES)[number];
  disposition: string;
  amount_cents: string | number;
  occurred_at: Date | string | null;
  source_scope_ref: string;
  source_scope_hash: string;
  close_watermark_hash: string;
  evidence_ref: string;
  evidence_hash: string;
  line_hash: string;
}

interface CollectionTupleV1 {
  id: number;
  bankTransactionId: number;
  reconciliationLinkId: number;
  authorityId: number;
}

interface SourceAuthorityRowV1 {
  id: string | number;
  rule_version_id: string;
  authority_scope_key: string;
  company_ref: string;
  business_sector_ref: string | null;
  store_ref: string | null;
  business_domain: string;
  source_system: string;
  source_type: string;
  adapter_version: string;
  effective_from: string;
  effective_to: string | null;
  currency: string;
  status: string;
  version: string | number;
  change_reason: string;
  source_channel: string;
  correlation_id: string;
  idempotency_key: string;
  request_fingerprint: string;
}

interface AuthorityLifecycleEventRowV1 {
  id: string | number;
  event_ref: string;
  authority_id: string | number;
  event_type: string;
  from_status: string | null;
  to_status: string;
  actor_user_id: string | number;
  reason_code: string;
  evidence_ref: string;
  evidence_hash: string;
  request_fingerprint: string;
  authority_content_hash: string;
  created_at: Date | string;
}

interface AuthorityLifecycleClaimRowV1 {
  idempotency_key: string;
  phase: string;
  request_fingerprint: string;
  actor_user_id: string | number;
  state: string;
  authority_id: string | number | null;
  lifecycle_event_id: string | number | null;
  completed_at: Date | string | null;
}

function failClosed(code: string, message: string): never {
  throw new ConflictException(`[${code}] ${message}`);
}

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

function positiveInt(value: unknown, code: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 2_147_483_647) {
    failClosed(code, `${label} 必须是 MySQL 安全正整数`);
  }
  return parsed;
}

function lowerHash(value: unknown, code: string, label: string): string {
  if (typeof value !== 'string' || !HEX_64.test(value)) failClosed(code, `${label} 必须是 lowercase SHA-256`);
  return value;
}

function toIso(value: Date | string | null | undefined, code = 'repair_formal_composer_time_invalid'): string {
  if (value == null) failClosed(code, '权威时间缺失');
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) failClosed(code, '权威时间无效');
  return date.toISOString();
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

async function reloadLockedEntitiesById<T extends ObjectLiteral & { id: number }>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  ids: readonly number[],
  code: string,
): Promise<T[]> {
  const repository = manager.getRepository(entity);
  const rows: T[] = [];
  for (const id of [...ids].sort((left, right) => left - right)) {
    const row = await repository.findOne({
      where: { id } as FindOptionsWhere<T>,
      lock: { mode: 'pessimistic_write' },
    });
    if (!row) failClosed(code, `${entity instanceof Function ? entity.name : '权威'} 锁内行缺失`);
    rows.push(row);
  }
  return rows;
}

async function assertSameConnectionRepeatableRead(manager: EntityManager): Promise<void> {
  const runner = manager.queryRunner;
  if (
    !runner ||
    !runner.isTransactionActive ||
    runner.manager !== manager ||
    runner.connection !== manager.connection
  ) {
    failClosed(
      'repair_formal_composer_transaction_manager_invalid',
      'composer 必须使用调用方同一活动 QueryRunner/EntityManager',
    );
  }
  let rows: Array<{ state?: unknown; isolation_level?: unknown; autocommit?: unknown }>;
  try {
    rows = await manager.query(
      `SELECT trx.STATE AS state, trx.ISOLATION_LEVEL AS isolation_level,
              trx.AUTOCOMMIT AS autocommit
         FROM performance_schema.events_transactions_current trx
         JOIN performance_schema.threads th ON th.THREAD_ID = trx.THREAD_ID
        WHERE th.PROCESSLIST_ID = CONNECTION_ID()`,
    ) as typeof rows;
  } catch {
    failClosed('repair_formal_composer_transaction_oracle_unavailable', '无法核验当前事务');
  }
  const isolation = String(rows[0]?.isolation_level ?? '').trim().toUpperCase().replace(/[-_\s]+/g, ' ');
  if (
    rows.length !== 1 ||
    String(rows[0].state ?? '').trim().toUpperCase() !== 'ACTIVE' ||
    isolation !== 'REPEATABLE READ' ||
    !['NO', '0'].includes(String(rows[0].autocommit ?? '').trim().toUpperCase())
  ) {
    failClosed(
      'repair_formal_composer_transaction_isolation_invalid',
      'composer 只接受 ACTIVE REPEATABLE READ 非自动提交事务',
    );
  }
}

function sourceAuthoritySnapshotHash(row: SourceAuthorityRowV1): string {
  return GroupOperationsInvariants.payloadFingerprint({
    id: Number(row.id),
    ruleVersionId: row.rule_version_id,
    authorityScopeKey: row.authority_scope_key,
    companyRef: row.company_ref,
    businessSectorRef: row.business_sector_ref,
    storeRef: row.store_ref,
    businessDomain: row.business_domain,
    sourceSystem: row.source_system,
    sourceType: row.source_type,
    adapterVersion: row.adapter_version,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    currency: row.currency,
    version: Number(row.version),
    requestFingerprint: row.request_fingerprint,
  });
}

function previewAuthoritySnapshotHash(authority: ContributionSourceAuthorityVersion): string {
  return GroupOperationsInvariants.payloadFingerprint({
    id: authority.id,
    ruleVersionId: authority.ruleVersionId,
    authorityScopeKey: authority.authorityScopeKey,
    companyRef: authority.companyRef,
    businessSectorRef: authority.businessSectorRef,
    storeRef: authority.storeRef,
    businessDomain: authority.businessDomain,
    sourceSystem: authority.sourceSystem,
    sourceType: authority.sourceType,
    adapterVersion: authority.adapterVersion,
    effectiveFrom: authority.effectiveFrom,
    effectiveTo: authority.effectiveTo,
    currency: authority.currency,
    version: authority.version,
    requestFingerprint: authority.requestFingerprint,
  });
}

function assertSourceAuthorityIntegrity(
  row: SourceAuthorityRowV1,
  preview: ContributionSourceAuthorityVersion,
): void {
  const ruleVersion = row.rule_version_id.trim();
  if (
    ruleVersion !== row.rule_version_id ||
    Array.from(ruleVersion).length < 2 ||
    Array.from(ruleVersion).length > 100
  ) {
    failClosed('repair_formal_composer_source_authority_rule_invalid', '来源授权规则版本无效');
  }
  const scopeKey = BusinessContributionAdapters.authorityScopeKey({
    companyRef: row.company_ref,
    businessSectorRef: row.business_sector_ref,
    storeRef: row.store_ref,
    businessDomain: 'repair',
    sourceSystem: row.source_system,
    sourceType: row.source_type,
  });
  const fingerprintPayload = {
    ruleVersionId: row.rule_version_id,
    companyRef: row.company_ref,
    businessSectorRef: row.business_sector_ref,
    storeRef: row.store_ref,
    businessDomain: row.business_domain,
    sourceSystem: row.source_system,
    sourceType: row.source_type,
    adapterVersion: row.adapter_version,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    currency: row.currency,
    reason: row.change_reason,
    sourceChannel: row.source_channel,
    correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key,
  };
  const actualFingerprint = lowerHash(
    row.request_fingerprint,
    'repair_formal_composer_source_authority_fingerprint_invalid',
    '来源授权请求指纹',
  );
  const expectedFingerprints = [
    GroupOperationsInvariants.payloadFingerprint({
      ...fingerprintPayload,
      version: Number(row.version),
    }),
    GroupOperationsInvariants.payloadFingerprint(fingerprintPayload),
  ];
  if (
    scopeKey !== row.authority_scope_key ||
    !Number.isSafeInteger(Number(row.version)) ||
    Number(row.version) < 1 ||
    !expectedFingerprints.includes(actualFingerprint) ||
    sourceAuthoritySnapshotHash(row) !== previewAuthoritySnapshotHash(preview)
  ) {
    failClosed('repair_formal_composer_source_authority_integrity_invalid', '来源授权不可变事实已漂移');
  }
}

function parseJsonRecord(value: unknown, code: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to the stable fail-closed code below.
    }
  }
  failClosed(code, 'JSON 审计锚点无效');
}

function assertScope(left: ScopeV1, right: ScopeV1, code: string): void {
  if (
    left.companyRef !== right.companyRef ||
    left.businessSectorRef !== right.businessSectorRef ||
    left.storeRef !== right.storeRef ||
    left.customerRef !== right.customerRef
  ) {
    failClosed(code, '维修权威组织/客户范围发生漂移');
  }
}

function scopeFromProof(proof: VerifiedContributionRbacContextV1): ScopeV1 {
  if (!proof.businessSectorRef || !proof.storeRef || !proof.customerRef) {
    failClosed('repair_formal_composer_scope_incomplete', '首个维修 profile 要求完整公司、板块、门店与客户范围');
  }
  return {
    companyRef: proof.companyRef,
    businessSectorRef: proof.businessSectorRef,
    storeRef: proof.storeRef,
    customerRef: proof.customerRef,
  };
}

function assertMakerChecker(
  row: {
    created_by_user_id: string | number;
    submitted_by_user_id: string | number | null;
    approved_by_user_id: string | number | null;
    rejected_by_user_id: string | number | null;
    superseded_by_user_id: string | number | null;
  },
  code: string,
): void {
  if (
    row.submitted_by_user_id == null ||
    row.approved_by_user_id == null ||
    !Number.isSafeInteger(Number(row.created_by_user_id)) ||
    Number(row.created_by_user_id) <= 0 ||
    !Number.isSafeInteger(Number(row.submitted_by_user_id)) ||
    Number(row.submitted_by_user_id) <= 0 ||
    !Number.isSafeInteger(Number(row.approved_by_user_id)) ||
    Number(row.approved_by_user_id) <= 0 ||
    Number(row.created_by_user_id) !== Number(row.submitted_by_user_id) ||
    Number(row.submitted_by_user_id) === Number(row.approved_by_user_id) ||
    row.rejected_by_user_id != null ||
    row.superseded_by_user_id != null
  ) {
    failClosed(code, 'approved 权威缺少独立 maker-checker');
  }
}

function assertApprovedLifecycle(
  authority: {
    id: string | number;
    content_hash: string;
    created_by_user_id: string | number;
    submitted_by_user_id: string | number | null;
    approved_by_user_id: string | number | null;
    submitted_at: Date | string | null;
    approved_at: Date | string | null;
  },
  events: AuthorityLifecycleEventRowV1[],
  claims: AuthorityLifecycleClaimRowV1[],
  kind: 'assignment' | 'baseline',
  serverObservedAt: string,
): void {
  const prefix = kind === 'assignment' ? 'repair-assignment' : 'repair-cost-event';
  const reasons = kind === 'assignment'
    ? ['assignment_drafted', 'assignment_submitted', 'assignment_verified']
    : ['baseline_drafted', 'baseline_submitted', 'baseline_verified'];
  const expected = [
    { phase: 'draft', eventType: 'drafted', from: null, to: 'draft', actor: Number(authority.created_by_user_id) },
    { phase: 'submit', eventType: 'submitted', from: 'draft', to: 'submitted', actor: Number(authority.submitted_by_user_id) },
    { phase: 'approve', eventType: 'approved', from: 'submitted', to: 'approved', actor: Number(authority.approved_by_user_id) },
  ] as const;
  if (events.length !== expected.length || claims.length !== expected.length) {
    failClosed(`repair_formal_composer_${kind}_lifecycle_incomplete`, '批准权威缺少完整幂等生命周期');
  }
  const eventTimes: number[] = [];
  for (let index = 0; index < expected.length; index += 1) {
    const event = events[index];
    const claim = claims[index];
    const shape = expected[index];
    const eventAt = Date.parse(toIso(event.created_at));
    const completedAt = Date.parse(toIso(claim.completed_at));
    if (
      !Number.isFinite(eventAt) ||
      !Number.isFinite(completedAt) ||
      Number(event.authority_id) !== Number(authority.id) ||
      event.event_type !== shape.eventType ||
      event.from_status !== shape.from ||
      event.to_status !== shape.to ||
      Number(event.actor_user_id) !== shape.actor ||
      event.reason_code !== reasons[index] ||
      !HEX_64.test(event.event_ref) ||
      !SAFE_EVIDENCE_REF.test(event.evidence_ref) ||
      !HEX_64.test(event.evidence_hash) ||
      !HEX_64.test(event.request_fingerprint) ||
      event.authority_content_hash !== authority.content_hash ||
      claim.phase !== shape.phase ||
      claim.state !== 'completed' ||
      !new RegExp(`^${prefix}-idempotency:[0-9a-f]{64}$`).test(claim.idempotency_key) ||
      claim.request_fingerprint !== event.request_fingerprint ||
      Number(claim.actor_user_id) !== shape.actor ||
      Number(claim.authority_id) !== Number(authority.id) ||
      Number(claim.lifecycle_event_id) !== Number(event.id) ||
      completedAt < eventAt
    ) {
      failClosed(`repair_formal_composer_${kind}_lifecycle_invalid`, '批准权威幂等事件链已漂移');
    }
    eventTimes.push(eventAt);
  }
  const submittedAt = Date.parse(toIso(authority.submitted_at));
  const approvedAt = Date.parse(toIso(authority.approved_at));
  const observedAt = Date.parse(serverObservedAt);
  if (
    eventTimes.some((value, index) => index > 0 && value < eventTimes[index - 1]) ||
    eventTimes[0] > submittedAt ||
    eventTimes[1] < submittedAt ||
    eventTimes[1] > approvedAt ||
    eventTimes[2] < approvedAt ||
    eventTimes[2] > observedAt
  ) {
    failClosed(`repair_formal_composer_${kind}_lifecycle_time_invalid`, '批准权威生命周期时点顺序无效');
  }
}

function assertApprovalTimeline(
  submittedAt: Date | string | null,
  approvedAt: Date | string | null,
  serverObservedAt: string,
  code: string,
  earliestObservedAt?: Date | string,
): void {
  const submitted = Date.parse(toIso(submittedAt, code));
  const approved = Date.parse(toIso(approvedAt, code));
  const observed = Date.parse(serverObservedAt);
  const earliest = earliestObservedAt == null
    ? Number.NEGATIVE_INFINITY
    : Date.parse(toIso(earliestObservedAt, code));
  if (
    !Number.isFinite(submitted) ||
    !Number.isFinite(approved) ||
    !Number.isFinite(observed) ||
    submitted < earliest ||
    approved < submitted ||
    approved > observed
  ) {
    failClosed(code, '权威提交/批准/观察时点顺序无效');
  }
}

function assertAssignmentContent(authority: AssignmentRowV1, lines: AttributionRowV1[]): void {
  if (
    authority.status !== 'approved' ||
    authority.profile_code !== REPAIR_RESPONSIBILITY_ATTRIBUTION_PROFILE ||
    authority.attribution_rule_version !== REPAIR_RESPONSIBILITY_ATTRIBUTION_RULE_VERSION ||
    lines.length < REQUIRED_ROLES.length ||
    lines.length > 30 ||
    !SAFE_EVIDENCE_REF.test(authority.responsibility_evidence_ref) ||
    !HEX_64.test(authority.responsibility_evidence_hash) ||
    lines.some((line) =>
      line.rule_version !== REPAIR_RESPONSIBILITY_ATTRIBUTION_RULE_VERSION ||
      !SAFE_EVIDENCE_REF.test(line.evidence_ref) ||
      !HEX_64.test(line.evidence_hash) ||
      !HEX_64.test(line.line_hash)
    )
  ) {
    failClosed('repair_formal_composer_assignment_invalid', '责任/三角色归因权威不完整');
  }
  assertMakerChecker(authority, 'repair_formal_composer_assignment_maker_checker_invalid');
  const ordered = [...lines].sort(
    (left, right) => REQUIRED_ROLES.indexOf(left.role) - REQUIRED_ROLES.indexOf(right.role) ||
      Number(left.employee_id) - Number(right.employee_id),
  );
  const pairKeys = ordered.map((line) => `${line.role}:${line.employee_id}`);
  if (
    ordered.some((line) =>
      !REQUIRED_ROLES.includes(line.role) ||
      !Number.isSafeInteger(Number(line.employee_id)) ||
      Number(line.employee_id) <= 0 ||
      !Number.isSafeInteger(Number(line.share_bps)) ||
      Number(line.share_bps) <= 0 ||
      Number(line.share_bps) > 10_000
    ) ||
    REQUIRED_ROLES.some((role) => !ordered.some((line) => line.role === role)) ||
    ordered.reduce((sum, line) => sum + Number(line.share_bps), 0) !== 10_000 ||
    new Set(pairKeys).size !== ordered.length
  ) {
    failClosed('repair_formal_composer_attribution_shape_invalid', '三角色或份额不是唯一完整闭集');
  }
  const employeeTotals = new Map<number, number>();
  for (const line of ordered) {
    const employeeId = Number(line.employee_id);
    const total = (employeeTotals.get(employeeId) ?? 0) + Number(line.share_bps);
    if (total > 10_000) {
      failClosed('repair_formal_composer_attribution_shape_invalid', '同一员工合并份额超过 10000 bps');
    }
    employeeTotals.set(employeeId, total);
  }
  const effectiveFrom = toIso(authority.responsibility_effective_from);
  const effectiveTo = authority.responsibility_effective_to == null
    ? null
    : toIso(authority.responsibility_effective_to);
  if (ordered.some((line) =>
    toIso(line.effective_from) !== effectiveFrom ||
    (line.effective_to == null ? null : toIso(line.effective_to)) !== effectiveTo
  )) {
    failClosed('repair_formal_composer_attribution_interval_invalid', '责任与归因有效区间不一致');
  }
  const expectedContentHash = canonicalHash({
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
      effectiveFrom,
      effectiveTo,
      evidenceRef: authority.responsibility_evidence_ref,
      evidenceHash: authority.responsibility_evidence_hash,
    },
    attributionRuleVersion: authority.attribution_rule_version,
    expectedWorkOrderVersion: Number(authority.expected_work_order_version),
    attributions: ordered.map((line) => ({
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
  if (expectedContentHash !== authority.content_hash) {
    failClosed('repair_formal_composer_assignment_hash_mismatch', '责任归因权威内容哈希不一致');
  }
  for (const line of ordered) {
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
      failClosed('repair_formal_composer_assignment_line_hash_mismatch', '归因行哈希不一致');
    }
  }
}

function sourceScopeRef(category: string, workOrderId: number): string {
  return `scope:repair:${category}:work-order:${workOrderId}`;
}

function assertBaselineContent(authority: BaselineRowV1, lines: BaselineLineRowV1[]): void {
  if (
    authority.status !== 'approved' ||
    authority.target_profile_code !== REPAIR_BASELINE_COST_EVENT_TARGET_PROFILE ||
    authority.rule_version !== REPAIR_BASELINE_COST_EVENT_RULE_VERSION ||
    authority.currency !== 'CNY' ||
    authority.profile_eligibility !== 'eligible' ||
    String(authority.total_direct_cost_cents) !== '0' ||
    lines.length !== REQUIRED_COST_CATEGORIES.length ||
    !HEX_64.test(authority.source_graph_hash) ||
    !HEX_64.test(authority.cost_close_watermark_hash) ||
    !HEX_64.test(authority.event_close_watermark_hash) ||
    lines.some((line) =>
      !SAFE_EVIDENCE_REF.test(line.evidence_ref) ||
      !HEX_64.test(line.evidence_hash) ||
      !HEX_64.test(line.source_scope_hash) ||
      !HEX_64.test(line.close_watermark_hash) ||
      !HEX_64.test(line.line_hash)
    )
  ) {
    failClosed('repair_formal_composer_baseline_invalid', '零外部直接成本 baseline 权威不完整');
  }
  assertMakerChecker(authority, 'repair_formal_composer_baseline_maker_checker_invalid');
  const ordered = [...lines].sort(
    (left, right) => REQUIRED_COST_CATEGORIES.indexOf(left.category) - REQUIRED_COST_CATEGORIES.indexOf(right.category),
  );
  if (ordered.some((line, index) =>
    line.category !== REQUIRED_COST_CATEGORIES[index] ||
    line.disposition !== 'not_applicable' ||
    String(line.amount_cents) !== '0' ||
    line.occurred_at != null
  )) {
    failClosed('repair_formal_composer_baseline_line_invalid', '五项 baseline 必须逐项正式 not_applicable');
  }
  const expectedContentHash = canonicalHash({
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
    declarations: ordered.map((line) => ({
      category: line.category,
      disposition: line.disposition,
      amountCents: String(line.amount_cents),
      occurredAt: null,
      sourceScopeRef: line.source_scope_ref,
      sourceScopeHash: line.source_scope_hash,
      closeWatermarkHash: line.close_watermark_hash,
      evidenceRef: line.evidence_ref,
      evidenceHash: line.evidence_hash,
    })),
  });
  if (expectedContentHash !== authority.content_hash) {
    failClosed('repair_formal_composer_baseline_hash_mismatch', 'baseline 权威内容哈希不一致');
  }
  for (const line of ordered) {
    const expectedLineHash = canonicalHash({
      authorityContentHash: authority.content_hash,
      category: line.category,
      disposition: line.disposition,
      amountCents: String(line.amount_cents),
      occurredAt: null,
      sourceScopeRef: line.source_scope_ref,
      sourceScopeHash: line.source_scope_hash,
      closeWatermarkHash: line.close_watermark_hash,
      evidenceRef: line.evidence_ref,
      evidenceHash: line.evidence_hash,
    });
    if (line.line_hash !== expectedLineHash) {
      failClosed('repair_formal_composer_baseline_line_hash_mismatch', 'baseline 行哈希不一致');
    }
  }
}

function latestDiagnosisVersion(documents: RepairDocumentVersion[]): number | null {
  const rows = documents.filter(
    (row) => row.documentType === 'diagnosis' && ['approved', 'authorized'].includes(row.status),
  );
  return rows.length ? Math.max(...rows.map((row) => row.version)) : null;
}

function decisionDocuments(
  documents: RepairDocumentVersion[],
): RepairRevenueAuthorityCandidateInputV1['documents'] {
  return documents
    .filter((row) => ['repair_plan', 'quote', 'customer_explanation'].includes(row.documentType))
    .map((row) => ({
      id: row.id,
      workOrderId: row.workOrderId,
      documentType: row.documentType as 'repair_plan' | 'quote' | 'customer_explanation',
      version: row.version,
      status: row.status,
      payload: row.payload,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
    }));
}

/**
 * Compose the first formal repair source from raw locked facts. This function
 * performs no DML and returns no raw rows or transaction capabilities.
 */
export async function composeRepairFirstFormalSourceBundleV1(
  selection: ContributionSourceSelection,
  sourceAuthority: ContributionSourceAuthorityVersion,
  manager: EntityManager,
  rbac: VerifiedContributionRbacContextV1,
): Promise<VerifiedContributionAuthorityBundleV1> {
  await assertSameConnectionRepeatableRead(manager);
  if (
    selection.businessDomain !== 'repair' ||
    selection.sourceSystem.trim().toLowerCase() !== 'stark_repair' ||
    selection.sourceType.trim().toLowerCase() !== 'repair_delivered_work_order'
  ) {
    failClosed('repair_formal_composer_selection_invalid', '只接受 Stark 汽修已交车工单来源');
  }
  const match = SOURCE_ID.exec(selection.sourceId.trim().toLowerCase());
  if (!match) failClosed('repair_formal_composer_source_id_invalid', '来源必须是 work-order:<正整数>');
  const workOrderId = positiveInt(Number(match[1]), 'repair_formal_composer_source_id_invalid', '工单');
  if (
    !['gov1.contribution.draft.write', 'gov1.contribution.confirm'].includes(rbac.permission) ||
    !Number.isSafeInteger(rbac.userId) || rbac.userId <= 0 ||
    !Number.isSafeInteger(rbac.employeeId) || rbac.employeeId <= 0
  ) {
    failClosed('repair_formal_composer_rbac_context_invalid', '事务当前 RBAC 证明无效');
  }
  const authorizedScope = scopeFromProof(rbac);

  const locator = await manager.query(
    `SELECT economic_root_id FROM repair_work_order_economic_lineages WHERE work_order_id = ?`,
    [workOrderId],
  ) as Array<{ economic_root_id: string }>;
  if (locator.length !== 1 || !HEX_64.test(locator[0].economic_root_id)) {
    failClosed('repair_formal_composer_lineage_missing', '工单缺少唯一经济根绑定');
  }
  const economicRootId = locator[0].economic_root_id;

  // Fixed post-RBAC lock order begins here. The 0068 writer takes the
  // assignment mutex before lineage/root, and the 0069 writer takes the cost
  // mutex before lineage/root. Take both writer mutexes first so the composer
  // can never hold lineage/root while waiting for either writer, which would
  // form a deadlock cycle. Every collection range below names an existing
  // 0005/0046/0058/0059/0067-0070 left-prefix index.
  const assignmentMutex = await manager.query(
    `SELECT work_order_id FROM repair_contribution_assignment_mutexes
      WHERE work_order_id = ? FOR UPDATE`,
    [workOrderId],
  );
  const costEventMutex = await manager.query(
    `SELECT work_order_id FROM repair_cost_event_mutexes
      WHERE work_order_id = ? FOR UPDATE`,
    [workOrderId],
  );
  if (assignmentMutex.length !== 1 || costEventMutex.length !== 1) {
    failClosed(
      'repair_formal_composer_profile_mutex_missing',
      '责任归因或 baseline 互斥记录缺失',
    );
  }

  const sourceMutex = await manager.query(
    `SELECT work_order_id FROM repair_economic_lineage_mutexes
      WHERE work_order_id = ? FOR UPDATE`,
    [workOrderId],
  );
  if (sourceMutex.length !== 1) failClosed('repair_formal_composer_source_mutex_missing', '经济来源互斥记录缺失');
  const lineages = await manager.query(
    `SELECT work_order_id, economic_root_id, root_origin_work_order_id, accepted_decision_id
       FROM repair_work_order_economic_lineages
      WHERE work_order_id = ? FOR UPDATE`,
    [workOrderId],
  ) as Array<Record<string, unknown> & { economic_root_id: string }>;
  if (lineages.length !== 1 || lineages[0].economic_root_id !== economicRootId) {
    failClosed('repair_formal_composer_lineage_drift', '经济根绑定在锁内漂移');
  }
  const roots = await manager.query(
    `SELECT economic_root_id, business_domain, origin_work_order_id, vehicle_id,
            company_ref AS companyRef, business_sector_ref AS businessSectorRef,
            store_ref AS storeRef, customer_ref AS customerRef
       FROM business_contribution_economic_fact_roots
      WHERE economic_root_id = ? FOR UPDATE`,
    [economicRootId],
  ) as RootRowV1[];
  if (roots.length !== 1 || roots[0].business_domain !== 'repair') {
    failClosed('repair_formal_composer_root_invalid', '维修经济根缺失或域不匹配');
  }
  assertScope(roots[0], authorizedScope, 'repair_formal_composer_root_scope_mismatch');

  const authorityRows = await manager.query(
    `SELECT id, rule_version_id, authority_scope_key, company_ref,
            business_sector_ref, store_ref, business_domain, source_system,
            source_type, adapter_version,
            DATE_FORMAT(effective_from, '%Y-%m-%d') AS effective_from,
            IF(effective_to IS NULL, NULL, DATE_FORMAT(effective_to, '%Y-%m-%d')) AS effective_to,
            currency, status, version, change_reason, source_channel,
            correlation_id, idempotency_key, request_fingerprint
       FROM contribution_source_authority_versions
      WHERE id = ? FOR UPDATE`,
    [sourceAuthority.id],
  ) as SourceAuthorityRowV1[];
  if (authorityRows.length !== 1) failClosed('repair_formal_composer_source_authority_missing', '来源授权版本缺失');
  const authorityRow = authorityRows[0];
  if (
    Number(authorityRow.id) !== sourceAuthority.id ||
    authorityRow.status !== 'approved' || authorityRow.business_domain !== 'repair' ||
    authorityRow.source_system !== 'stark_repair' ||
    authorityRow.source_type !== 'repair_delivered_work_order' ||
    authorityRow.adapter_version !== 'gov1-s2-v1' || authorityRow.currency !== 'CNY' ||
    authorityRow.company_ref !== authorizedScope.companyRef ||
    authorityRow.business_sector_ref !== authorizedScope.businessSectorRef ||
    authorityRow.store_ref !== authorizedScope.storeRef
  ) {
    failClosed('repair_formal_composer_source_authority_mismatch', '来源授权版本与维修权威范围不一致');
  }
  assertSourceAuthorityIntegrity(authorityRow, sourceAuthority);
  const authoritySequence = await manager.query(
    `SELECT id, version FROM contribution_source_authority_versions
      FORCE INDEX (uq_contribution_authority_scope_version)
      WHERE authority_scope_key = ? ORDER BY version, id FOR UPDATE`,
    [authorityRow.authority_scope_key],
  ) as Array<{ id: number | string; version: number | string }>;
  if (
    !authoritySequence.length ||
    authoritySequence.some((row, index) => Number(row.version) !== index + 1) ||
    !authoritySequence.some((row) => Number(row.id) === sourceAuthority.id && Number(row.version) === sourceAuthority.version)
  ) {
    failClosed('repair_formal_composer_source_authority_sequence_invalid', '来源授权版本序列无效');
  }
  const anchorRows = await manager.query(
    `SELECT detail_json
       FROM operation_logs FORCE INDEX (idx_operation_logs_module_target_action_id)
      WHERE module = 'group_operations'
        AND target_id = ?
        AND action = 'business_contribution.authority.publish'
      ORDER BY id LIMIT 2 FOR UPDATE`,
    [sourceAuthority.id],
  ) as Array<{ detail_json: unknown }>;
  if (anchorRows.length !== 1) {
    failClosed('repair_formal_composer_source_authority_anchor_invalid', '来源授权发布锚点缺失或重复');
  }
  const anchor = parseJsonRecord(
    anchorRows[0].detail_json,
    'repair_formal_composer_source_authority_anchor_invalid',
  );
  if (
    lowerHash(
      anchor.authorityImmutableSnapshotHash,
      'repair_formal_composer_source_authority_anchor_invalid',
      '来源授权发布锚点',
    ) !== sourceAuthoritySnapshotHash(authorityRow)
  ) {
    failClosed('repair_formal_composer_source_authority_anchor_drift', '来源授权发布锚点与锁内事实不一致');
  }

  const workOrderLocks = await manager.query(`SELECT id FROM work_orders WHERE id = ? FOR UPDATE`, [workOrderId]);
  const profileRows = await manager.query(
    `SELECT work_order_id, lifecycle_status, customer_confirmation_state,
            active_plan_version, active_quote_version, active_explanation_version,
            vehicle_id, scope_resolved_at, scope_snapshot_version, version,
            company_ref AS companyRef, business_sector_ref AS businessSectorRef,
            store_ref AS storeRef, customer_ref AS customerRef
       FROM repair_work_order_profiles FORCE INDEX (uq_repair_work_order_profile_work_order)
      WHERE work_order_id = ? FOR UPDATE`,
    [workOrderId],
  ) as ProfileRowV1[];
  if (workOrderLocks.length !== 1 || profileRows.length !== 1) {
    failClosed('repair_formal_composer_work_order_missing', '工单或维修档案缺失');
  }
  const profileRow = profileRows[0];
  assertScope(profileRow, authorizedScope, 'repair_formal_composer_profile_scope_drift');
  if (Number(profileRow.vehicle_id) !== Number(roots[0].vehicle_id)) {
    failClosed('repair_formal_composer_vehicle_root_drift', '维修车辆与经济根绑定不一致');
  }

  const deliveryIds = await manager.query(
    `SELECT id FROM repair_delivery_records FORCE INDEX (uq_repair_delivery_work_order)
      WHERE work_order_id = ? ORDER BY id FOR UPDATE`,
    [workOrderId],
  ) as Array<{ id: number }>;
  const documentIds = await manager.query(
    `SELECT id FROM repair_document_versions FORCE INDEX (idx_repair_document_lookup)
      WHERE work_order_id = ? ORDER BY document_type, version, id FOR UPDATE`,
    [workOrderId],
  ) as Array<{ id: number }>;
  const confirmationIds = await manager.query(
    `SELECT id FROM repair_confirmation_requests FORCE INDEX (idx_repair_confirmation_work_order)
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`,
    [workOrderId],
  ) as Array<{ id: number }>;
  const qualityIds = await manager.query(
    `SELECT id FROM repair_quality_inspections FORCE INDEX (idx_repair_quality_work_order)
      WHERE work_order_id = ? ORDER BY created_at, id FOR UPDATE`,
    [workOrderId],
  ) as Array<{ id: number }>;
  const collectionTuples = await manager.query(
    `SELECT id, bank_transaction_id AS bankTransactionId,
            reconciliation_link_id AS reconciliationLinkId,
            formal_confirmation_authority_id AS authorityId
       FROM finance_collection_order FORCE INDEX (idx_finance_collection_work_order)
      WHERE work_order_id = ? ORDER BY id FOR UPDATE`,
    [workOrderId],
  ) as CollectionTupleV1[];
  if (deliveryIds.length !== 1 || !documentIds.length || !confirmationIds.length || !qualityIds.length || !collectionTuples.length) {
    failClosed('repair_formal_composer_revenue_graph_incomplete', '报价、确认、交车、质检或收款图不完整');
  }

  const bankIds = [...new Set(collectionTuples.map((row) => Number(row.bankTransactionId)))].sort((a, b) => a - b);
  const linkIds = [...new Set(collectionTuples.map((row) => Number(row.reconciliationLinkId)))].sort((a, b) => a - b);
  const financeAuthorityIds = [...new Set(collectionTuples.map((row) => Number(row.authorityId)))].sort((a, b) => a - b);
  if (
    bankIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    linkIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    financeAuthorityIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    bankIds.length !== collectionTuples.length || linkIds.length !== collectionTuples.length ||
    financeAuthorityIds.length !== collectionTuples.length
  ) {
    failClosed('repair_formal_composer_collection_binding_invalid', '收款、流水、对账链接与正式权威必须一一对应');
  }
  for (const id of bankIds) {
    const rows = await manager.query(
      `SELECT id FROM bank_sms_transaction WHERE id = ? FOR UPDATE`,
      [id],
    );
    if (rows.length !== 1) {
      failClosed('repair_formal_composer_collection_binding_missing', '银行流水权威行缺失');
    }
  }
  for (const id of linkIds) {
    const rows = await manager.query(
      `SELECT id FROM finance_reconciliation_link WHERE id = ? FOR UPDATE`,
      [id],
    );
    if (rows.length !== 1) {
      failClosed('repair_formal_composer_collection_binding_missing', '对账链接权威行缺失');
    }
  }
  for (const id of financeAuthorityIds) {
    const rows = await manager.query(
      `SELECT id FROM finance_collection_confirmation_authorities WHERE id = ? FOR UPDATE`,
      [id],
    );
    if (rows.length !== 1) {
      failClosed('repair_formal_composer_collection_binding_missing', '收款确认权威行缺失');
    }
  }

  const workOrder = await manager.getRepository(WorkOrder).findOne({
    where: { id: workOrderId },
    lock: { mode: 'pessimistic_write' },
  });
  const profile = await manager.getRepository(RepairWorkOrderProfile).findOne({
    where: { workOrderId },
    lock: { mode: 'pessimistic_write' },
  });
  const deliveryRows = await reloadLockedEntitiesById(
    manager,
    RepairDeliveryRecord,
    deliveryIds.map((row) => positiveInt(row.id, 'repair_formal_composer_delivery_id_invalid', '交车记录')),
    'repair_formal_composer_revenue_graph_drift',
  );
  const delivery = deliveryRows[0];
  const documents = await reloadLockedEntitiesById(
    manager,
    RepairDocumentVersion,
    documentIds.map((row) => positiveInt(row.id, 'repair_formal_composer_document_id_invalid', '文档记录')),
    'repair_formal_composer_revenue_graph_drift',
  );
  const confirmations = await reloadLockedEntitiesById(
    manager,
    RepairConfirmationRequest,
    confirmationIds.map((row) => positiveInt(row.id, 'repair_formal_composer_confirmation_id_invalid', '确认记录')),
    'repair_formal_composer_revenue_graph_drift',
  );
  const qualities = await reloadLockedEntitiesById(
    manager,
    RepairQualityInspection,
    qualityIds.map((row) => positiveInt(row.id, 'repair_formal_composer_quality_id_invalid', '质检记录')),
    'repair_formal_composer_revenue_graph_drift',
  );
  const collections = await reloadLockedEntitiesById(
    manager,
    FinanceCollectionOrder,
    collectionTuples.map((row) => positiveInt(row.id, 'repair_formal_composer_collection_id_invalid', '收款记录')),
    'repair_formal_composer_revenue_graph_drift',
  );
  const financeAuthorities = await reloadLockedEntitiesById(
    manager,
    FinanceCollectionConfirmationAuthority,
    financeAuthorityIds,
    'repair_formal_composer_revenue_graph_drift',
  );
  const banks = await reloadLockedEntitiesById(
    manager,
    BankSmsTransaction,
    bankIds,
    'repair_formal_composer_revenue_graph_drift',
  );
  const links = await reloadLockedEntitiesById(
    manager,
    FinanceReconciliationLink,
    linkIds,
    'repair_formal_composer_revenue_graph_drift',
  );
  if (!workOrder || !profile || !delivery) {
    failClosed('repair_formal_composer_revenue_graph_drift', '锁内收入权威图发生漂移');
  }
  const authorityById = new Map(financeAuthorities.map((row) => [row.id, row]));
  const bankById = new Map(banks.map((row) => [row.id, row]));
  const linkById = new Map(links.map((row) => [row.id, row]));
  const collectionById = new Map(collections.map((row) => [row.id, row]));

  const revenueInput: RepairRevenueAuthorityCandidateInputV1 = {
    profile: {
      workOrderId,
      companyRef: profile.companyRef,
      businessSectorRef: profile.businessSectorRef,
      storeRef: profile.storeRef,
      customerRef: profile.customerRef,
      vehicleId: profile.vehicleId,
      lifecycleStatus: profile.lifecycleStatus,
      customerConfirmationState: profile.customerConfirmationState,
      activePlanVersion: profile.activePlanVersion,
      activeQuoteVersion: profile.activeQuoteVersion,
      activeExplanationVersion: profile.activeExplanationVersion,
      latestApprovedDiagnosisVersion: latestDiagnosisVersion(documents),
      scopeResolvedAt: profile.scopeResolvedAt,
      scopeSnapshotVersion: quotedScopeSnapshot(profile),
      version: profile.version,
    },
    workOrder: { id: workOrder.id, workOrderNo: workOrder.workOrderNo },
    delivery: {
      id: delivery.id, workOrderId: delivery.workOrderId,
      planVersion: delivery.planVersion, quoteVersion: delivery.quoteVersion,
      explanationVersion: delivery.explanationVersion,
      financeEvidenceRefs: delivery.financeEvidenceRefs,
      quoteTotalSnapshot: delivery.quoteTotalSnapshot,
      financeReadyAmountSnapshot: delivery.financeReadyAmountSnapshot,
      customerAckEvidenceRef: delivery.customerAckEvidenceRef,
      deliveredByEmployeeId: delivery.deliveredByEmployeeId,
      deliveredAt: delivery.deliveredAt, createdBy: delivery.createdBy, createdAt: delivery.createdAt,
    },
    documents: decisionDocuments(documents),
    confirmationRequests: confirmations.map((row) => ({
      id: row.id, workOrderId: row.workOrderId, planVersion: row.planVersion,
      quoteVersion: row.quoteVersion, explanationVersion: row.explanationVersion,
      requestFingerprint: row.requestFingerprint, status: row.status,
      decisionEvidenceRef: row.decisionEvidenceRef, decidedBy: row.decidedBy,
      decidedAt: row.decidedAt, version: row.version,
    })),
    qualityInspections: qualities.map((row) => ({
      id: row.id, workOrderId: row.workOrderId, result: row.result,
      inspectedByEmployeeId: row.inspectedByEmployeeId, createdBy: row.createdBy,
      createdAt: row.createdAt,
    })),
    collections: collectionTuples.map((tuple) => {
      const order = collectionById.get(Number(tuple.id));
      const financeAuthority = authorityById.get(Number(tuple.authorityId));
      const bank = bankById.get(Number(tuple.bankTransactionId));
      const link = linkById.get(Number(tuple.reconciliationLinkId));
      if (!order || !financeAuthority || !bank || !link) {
        failClosed('repair_formal_composer_collection_binding_missing', '收款正式权威图缺失');
      }
      return {
        collectionOrderId: order.id,
        workOrderId: order.workOrderId!,
        authorityId: financeAuthority.id,
        bankTransactionId: bank.id,
        reconciliationLinkId: link.id,
        grossCents: financeAuthority.grossCents,
        currency: financeAuthority.currency,
        authorityCanonicalSnapshotHash: financeAuthority.canonicalSnapshotHash,
        authorityConfirmedAt: financeAuthority.authorityConfirmedAt,
        sourceOccurredAt: financeAuthority.sourceOccurredAt,
        envelopeProblems: collectAuthorityEnvelopeProblems({ order, authority: financeAuthority, profile, bank, link, workOrder }),
      };
    }),
  };

  const serverNowRows = await manager.query(
    `SELECT CONCAT(LEFT(DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
            AS server_observed_at`,
  );
  if (serverNowRows.length !== 1) failClosed('repair_formal_composer_server_time_invalid', '数据库观察时间缺失');
  const serverObservedAt = toIso(serverNowRows[0].server_observed_at);
  const revenue = buildRepairRevenueAuthorityCandidateV1(revenueInput, new Date(serverObservedAt));
  const recognitionDate = BusinessContributionAdapters.settlementDateOfInstant(
    revenue.recognitionAt,
  );
  if (
    authorityRow.effective_from > recognitionDate ||
    Boolean(authorityRow.effective_to && authorityRow.effective_to < recognitionDate)
  ) {
    failClosed(
      'repair_formal_composer_source_authority_effective_range_invalid',
      '来源授权在维修收入确认日无效',
    );
  }

  const assignments = await manager.query(
    `SELECT id, authority_ref, economic_root_id, work_order_id,
            authorized_company_ref, authorized_business_sector_ref,
            authorized_store_ref, authorized_customer_ref, profile_code,
            authority_version, supersedes_authority_id, responsibility_employee_id,
            CONCAT(LEFT(DATE_FORMAT(responsibility_effective_from, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS responsibility_effective_from,
            CASE WHEN responsibility_effective_to IS NULL THEN NULL
              ELSE CONCAT(LEFT(DATE_FORMAT(responsibility_effective_to, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
            END AS responsibility_effective_to,
            responsibility_evidence_ref, responsibility_evidence_hash,
            attribution_rule_version, content_hash, expected_work_order_version,
            status, created_by_user_id, submitted_by_user_id, approved_by_user_id,
            rejected_by_user_id, superseded_by_user_id,
            CONCAT(LEFT(DATE_FORMAT(submitted_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS submitted_at,
            CONCAT(LEFT(DATE_FORMAT(approved_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS approved_at
       FROM repair_contribution_assignment_authorities
      FORCE INDEX (uq_repair_assignment_root_version)
      WHERE economic_root_id = ? ORDER BY authority_version, id FOR UPDATE`,
    [economicRootId],
  ) as AssignmentRowV1[];
  if (assignments.some((row) => ['draft', 'submitted'].includes(row.status))) {
    failClosed('repair_formal_composer_assignment_open', '责任归因仍有待处理版本');
  }
  const approvedAssignments = assignments.filter((row) => row.status === 'approved');
  if (approvedAssignments.length !== 1) failClosed('repair_formal_composer_assignment_ambiguous', '当前批准责任归因不唯一');
  const assignment = approvedAssignments[0];
  const attributionLines = await manager.query(
    `SELECT id, authority_id, role, employee_id, share_bps,
            CONCAT(LEFT(DATE_FORMAT(effective_from, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS effective_from,
            CASE WHEN effective_to IS NULL THEN NULL
              ELSE CONCAT(LEFT(DATE_FORMAT(effective_to, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
            END AS effective_to,
            rule_version,
            evidence_ref, evidence_hash, line_hash
       FROM repair_contribution_assignment_attributions
      FORCE INDEX (uq_repair_assignment_attribution_line)
      WHERE authority_id = ?
      ORDER BY FIELD(role, 'lead_originator','business_owner','service_owner'), employee_id
      FOR UPDATE`,
    [assignment.id],
  ) as AttributionRowV1[];
  const assignmentEvents = await manager.query(
    `SELECT id, event_ref, authority_id, event_type, from_status, to_status,
            actor_user_id, reason_code, evidence_ref, evidence_hash,
            request_fingerprint, authority_content_hash,
            CONCAT(LEFT(DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS created_at
       FROM repair_contribution_assignment_lifecycle_events
      FORCE INDEX (uq_repair_assignment_event_once)
      WHERE authority_id = ?
      ORDER BY FIELD(event_type, 'drafted','submitted','approved'), id
      FOR UPDATE`,
    [assignment.id],
  ) as AuthorityLifecycleEventRowV1[];
  const assignmentClaims = await manager.query(
    `SELECT idempotency_key, phase, request_fingerprint, actor_user_id,
            state, authority_id, lifecycle_event_id,
            CASE WHEN completed_at IS NULL THEN NULL
              ELSE CONCAT(LEFT(DATE_FORMAT(completed_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
            END AS completed_at
       FROM repair_contribution_assignment_idempotency_claims
      FORCE INDEX (uq_repair_assignment_claim_result)
      WHERE authority_id = ?
      ORDER BY FIELD(phase, 'draft','submit','approve')
      FOR UPDATE`,
    [assignment.id],
  ) as AuthorityLifecycleClaimRowV1[];
  assertAssignmentContent(assignment, attributionLines);
  assertApprovalTimeline(
    assignment.submitted_at,
    assignment.approved_at,
    serverObservedAt,
    'repair_formal_composer_assignment_timeline_invalid',
  );
  assertApprovedLifecycle(
    assignment,
    assignmentEvents,
    assignmentClaims,
    'assignment',
    serverObservedAt,
  );
  assertScope({
    companyRef: assignment.authorized_company_ref,
    businessSectorRef: assignment.authorized_business_sector_ref,
    storeRef: assignment.authorized_store_ref,
    customerRef: assignment.authorized_customer_ref,
  }, authorizedScope, 'repair_formal_composer_assignment_scope_mismatch');
  if (
    assignment.economic_root_id !== economicRootId ||
    Number(assignment.work_order_id) !== workOrderId ||
    Number(assignment.expected_work_order_version) !== Number(profileRow.version)
  ) {
    failClosed('repair_formal_composer_assignment_pin_drift', '责任归因未固定到当前工单/经济根版本');
  }
  const recognitionMs = Date.parse(revenue.recognitionAt);
  const assignmentFrom = Date.parse(toIso(assignment.responsibility_effective_from));
  const assignmentTo = assignment.responsibility_effective_to == null
    ? Number.POSITIVE_INFINITY
    : Date.parse(toIso(assignment.responsibility_effective_to));
  if (recognitionMs < assignmentFrom || recognitionMs > assignmentTo) {
    failClosed('repair_formal_composer_assignment_time_invalid', '责任归因在经济确认时点无效');
  }

  const baselineRows = await manager.query(
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
            superseded_by_user_id,
            CONCAT(LEFT(DATE_FORMAT(server_observed_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS server_observed_at,
            CONCAT(LEFT(DATE_FORMAT(submitted_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS submitted_at,
            CONCAT(LEFT(DATE_FORMAT(approved_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS approved_at
       FROM repair_cost_event_authorities FORCE INDEX (uq_rce_root_version)
      WHERE economic_root_id = ? ORDER BY authority_version, id FOR UPDATE`,
    [economicRootId],
  ) as BaselineRowV1[];
  if (baselineRows.some((row) => ['draft', 'submitted'].includes(row.status))) {
    failClosed('repair_formal_composer_baseline_open', 'baseline 仍有待处理版本');
  }
  const approvedBaselines = baselineRows.filter((row) => row.status === 'approved');
  if (approvedBaselines.length !== 1) failClosed('repair_formal_composer_baseline_ambiguous', '当前批准 baseline 不唯一');
  const baseline = approvedBaselines[0];
  const baselineLines = await manager.query(
    `SELECT id, authority_id, category, disposition, amount_cents,
            CASE WHEN occurred_at IS NULL THEN NULL
              ELSE CONCAT(LEFT(DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
            END AS occurred_at,
            source_scope_ref, source_scope_hash,
            close_watermark_hash, evidence_ref, evidence_hash, line_hash
       FROM repair_cost_event_authority_lines FORCE INDEX (uq_rce_line_category)
      WHERE authority_id = ?
      ORDER BY FIELD(category, 'parts','outsourced','other_direct','refund','rework')
      FOR UPDATE`,
    [baseline.id],
  ) as BaselineLineRowV1[];
  const baselineEvents = await manager.query(
    `SELECT id, event_ref, authority_id, event_type, from_status, to_status,
            actor_user_id, reason_code, evidence_ref, evidence_hash,
            request_fingerprint, authority_content_hash,
            CONCAT(LEFT(DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
              AS created_at
       FROM repair_cost_event_lifecycle_events
      FORCE INDEX (uq_rce_event_once)
      WHERE authority_id = ?
      ORDER BY FIELD(event_type, 'drafted','submitted','approved'), id
      FOR UPDATE`,
    [baseline.id],
  ) as AuthorityLifecycleEventRowV1[];
  const baselineClaims = await manager.query(
    `SELECT idempotency_key, phase, request_fingerprint, actor_user_id,
            state, authority_id, lifecycle_event_id,
            CASE WHEN completed_at IS NULL THEN NULL
              ELSE CONCAT(LEFT(DATE_FORMAT(completed_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z')
            END AS completed_at
       FROM repair_cost_event_idempotency_claims
      FORCE INDEX (uq_rce_claim_result)
      WHERE authority_id = ?
      ORDER BY FIELD(phase, 'draft','submit','approve')
      FOR UPDATE`,
    [baseline.id],
  ) as AuthorityLifecycleClaimRowV1[];
  assertBaselineContent(baseline, baselineLines);
  assertApprovalTimeline(
    baseline.submitted_at,
    baseline.approved_at,
    serverObservedAt,
    'repair_formal_composer_baseline_timeline_invalid',
    baseline.server_observed_at,
  );
  assertApprovedLifecycle(
    baseline,
    baselineEvents,
    baselineClaims,
    'baseline',
    serverObservedAt,
  );
  assertScope({
    companyRef: baseline.authorized_company_ref,
    businessSectorRef: baseline.authorized_business_sector_ref,
    storeRef: baseline.authorized_store_ref,
    customerRef: baseline.authorized_customer_ref,
  }, authorizedScope, 'repair_formal_composer_baseline_scope_mismatch');
  if (
    baseline.economic_root_id !== economicRootId || Number(baseline.work_order_id) !== workOrderId ||
    Number(baseline.assignment_authority_id) !== Number(assignment.id) ||
    Number(baseline.assignment_authority_version) !== Number(assignment.authority_version) ||
    baseline.assignment_content_hash !== assignment.content_hash ||
    Number(baseline.expected_work_order_version) !== Number(profileRow.version)
  ) {
    failClosed('repair_formal_composer_baseline_pin_drift', 'baseline 未固定到当前责任归因/工单版本');
  }

  const materials = await manager.query(
    `SELECT id, deleted_at, updated_at FROM work_order_materials
      FORCE INDEX (idx_work_order_materials_work_order_deleted)
      WHERE work_order_id = ? ORDER BY deleted_at, id FOR UPDATE`, [workOrderId],
  ) as Array<Record<string, unknown>>;
  const partLinks = await manager.query(
    `SELECT id, work_order_material_id, created_at FROM repair_part_links
      FORCE INDEX (uq_repair_part_link_material)
      WHERE work_order_id = ? ORDER BY work_order_material_id, id FOR UPDATE`, [workOrderId],
  ) as Array<Record<string, unknown>>;
  const demands = await manager.query(
    `SELECT id, status, version, updated_at FROM repair_procurement_demands
      FORCE INDEX (idx_repair_procurement_demand_work_order)
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`, [workOrderId],
  ) as Array<Record<string, unknown>>;
  const purchaseOrders = await manager.query(
    `SELECT id, status, version, updated_at FROM repair_purchase_orders
      FORCE INDEX (idx_repair_purchase_order_work_order)
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`, [workOrderId],
  ) as Array<Record<string, unknown>>;
  const allocations = await manager.query(
    `SELECT id, status, version, installed_at, updated_at FROM repair_procurement_allocations
      FORCE INDEX (idx_repair_procurement_allocation_work_order)
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`, [workOrderId],
  ) as Array<Record<string, unknown>>;
  const supplierClaims = await manager.query(
    `SELECT id, status, updated_at FROM repair_supplier_warranty_claims
      FORCE INDEX (idx_repair_supplier_claim_work_order)
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`, [workOrderId],
  ) as Array<Record<string, unknown>>;
  const quality = await manager.query(
    `SELECT id, result, rework_reason, created_at FROM repair_quality_inspections
      FORCE INDEX (idx_repair_quality_work_order)
      WHERE work_order_id = ? ORDER BY created_at, id FOR UPDATE`, [workOrderId],
  ) as Array<Record<string, unknown>>;
  const tasks = await manager.query(
    `SELECT id, rework_of_inspection_id, status, version, updated_at FROM repair_tasks
      FORCE INDEX (idx_repair_tasks_work_order)
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`, [workOrderId],
  ) as Array<Record<string, unknown>>;
  const warranties = await manager.query(
    `SELECT id, status, created_at FROM repair_warranty_records
      FORCE INDEX (idx_repair_warranty_work_order)
      WHERE work_order_id = ? ORDER BY status, id FOR UPDATE`, [workOrderId],
  ) as Array<Record<string, unknown>>;
  const collectionStates = await manager.query(
    `SELECT id, status, updated_at FROM finance_collection_order
      FORCE INDEX (idx_finance_collection_work_order)
      WHERE work_order_id = ? ORDER BY id FOR UPDATE`, [workOrderId],
  ) as Array<Record<string, unknown>>;

  // Child ranges are locked through existing parent-leading indexes. They are
  // expected to be empty because the zero-cost profile rejects every parent.
  for (const demandId of demands.map((row) => Number(row.id)).sort((a, b) => a - b)) {
    await manager.query(`SELECT id FROM repair_supplier_inquiries FORCE INDEX (idx_repair_supplier_inquiry_demand) WHERE demand_id = ? ORDER BY status, id FOR UPDATE`, [demandId]);
    await manager.query(`SELECT id FROM repair_supplier_quotes FORCE INDEX (idx_repair_supplier_quote_demand) WHERE demand_id = ? ORDER BY status, id FOR UPDATE`, [demandId]);
    await manager.query(`SELECT id FROM repair_procurement_decisions FORCE INDEX (uq_repair_procurement_decision_version) WHERE demand_id = ? ORDER BY decision_version, id FOR UPDATE`, [demandId]);
  }
  for (const purchaseOrderId of purchaseOrders.map((row) => Number(row.id)).sort((a, b) => a - b)) {
    await manager.query(`SELECT id FROM repair_supplier_shipments FORCE INDEX (idx_repair_supplier_shipment_order) WHERE purchase_order_id = ? ORDER BY status, id FOR UPDATE`, [purchaseOrderId]);
    await manager.query(`SELECT id FROM repair_goods_receipts FORCE INDEX (idx_repair_goods_receipt_order) WHERE purchase_order_id = ? ORDER BY status, id FOR UPDATE`, [purchaseOrderId]);
  }
  for (const materialId of materials.map((row) => Number(row.id)).sort((a, b) => a - b)) {
    await manager.query(`SELECT id FROM inventory_transactions FORCE INDEX (idx_inventory_transactions_related_work_order_material_id) WHERE related_work_order_material_id = ? ORDER BY id FOR UPDATE`, [materialId]);
  }

  const costGraph = {
    schemaVersion: REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
    workOrderId,
    coveredTables: [
      'work_order_materials', 'repair_part_links', 'repair_procurement_demands',
      'repair_purchase_orders', 'repair_procurement_allocations', 'repair_supplier_warranty_claims',
    ],
    excludedSources: ['repair_labor_items', 'repair_purchase_orders.total_amount', 'repair_purchase_orders.payment_state'],
    materials: canonicalRows(materials), partLinks: canonicalRows(partLinks), demands: canonicalRows(demands),
    purchaseOrders: canonicalRows(purchaseOrders), allocations: canonicalRows(allocations),
    supplierClaims: canonicalRows(supplierClaims),
    outsourcedSourceSchema: 'absent_requires_explicit_not_applicable',
    otherDirectSourceSchema: 'absent_requires_explicit_not_applicable',
  };
  const eventGraph = {
    schemaVersion: REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
    workOrderId,
    coveredTables: ['repair_quality_inspections', 'repair_tasks', 'repair_warranty_records', 'finance_collection_order'],
    quality: canonicalRows(quality), tasks: canonicalRows(tasks), warranties: canonicalRows(warranties),
    collections: canonicalRows(collectionStates),
  };
  const costCloseWatermarkHash = canonicalHash(costGraph);
  const eventCloseWatermarkHash = canonicalHash(eventGraph);
  const sourceGraphHash = canonicalHash({
    schemaVersion: REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
    ruleVersion: REPAIR_BASELINE_COST_EVENT_RULE_VERSION,
    economicRootId,
    lineage: canonicalRows(lineages),
    profile: {
      workOrderId, lifecycleStatus: profileRow.lifecycle_status, version: Number(profileRow.version),
      scope: authorizedScope,
    },
    assignment: {
      id: Number(assignment.id), authorityRef: assignment.authority_ref,
      version: Number(assignment.authority_version), contentHash: assignment.content_hash,
    },
    costCloseWatermarkHash, eventCloseWatermarkHash,
  });
  if (
    materials.length || partLinks.length || demands.length || purchaseOrders.length ||
    allocations.length || supplierClaims.length || warranties.length ||
    quality.some((row) => row.result !== 'passed' || String(row.rework_reason ?? '').trim()) ||
    tasks.some((row) => row.rework_of_inspection_id != null) ||
    collectionStates.some((row) => ['refunded', 'cancelled'].includes(String(row.status)))
  ) {
    failClosed('repair_formal_composer_zero_profile_open', '外部成本/退款/返修/质保集合不是空闭集');
  }
  if (
    baseline.source_graph_hash !== sourceGraphHash ||
    baseline.cost_close_watermark_hash !== costCloseWatermarkHash ||
    baseline.event_close_watermark_hash !== eventCloseWatermarkHash
  ) {
    failClosed('repair_formal_composer_baseline_watermark_drift', 'baseline 闭集 watermark 已漂移');
  }
  for (const line of baselineLines) {
    const expectedScopeRef = sourceScopeRef(line.category, workOrderId);
    const expectedScopeHash = canonicalHash({
      schemaVersion: REPAIR_BASELINE_COST_EVENT_SCHEMA_VERSION,
      ruleVersion: REPAIR_BASELINE_COST_EVENT_RULE_VERSION,
      scopeRef: expectedScopeRef,
      sourceGraphHash,
    });
    const expectedWatermark = ['refund', 'rework'].includes(line.category)
      ? eventCloseWatermarkHash
      : costCloseWatermarkHash;
    if (
      line.source_scope_ref !== expectedScopeRef ||
      line.source_scope_hash !== expectedScopeHash ||
      line.close_watermark_hash !== expectedWatermark
    ) {
      failClosed('repair_formal_composer_baseline_scope_hash_drift', 'baseline 行闭集绑定已漂移');
    }
  }

  const typedCorrections = await manager.query(
    `SELECT * FROM repair_typed_correction_authorities FORCE INDEX (idx_rtc_economic_root)
      WHERE economic_root_id = ? ORDER BY correction_root_id, authority_version, id FOR UPDATE`,
    [economicRootId],
  ) as Array<Record<string, unknown>>;
  const correctionMappings = await manager.query(
    `SELECT * FROM repair_typed_correction_mapping_plans FORCE INDEX (idx_rtc_mapping_economic_root)
      WHERE economic_root_id = ? ORDER BY correction_sequence, id FOR UPDATE`,
    [economicRootId],
  ) as Array<Record<string, unknown>>;
  const genericCorrections = rbac.expectedContributionId == null ? [] : await manager.query(
    `SELECT * FROM business_contribution_corrections FORCE INDEX (idx_bcc_original_period)
      WHERE original_contribution_id = ? ORDER BY sequence, id FOR UPDATE`,
    [rbac.expectedContributionId],
  ) as Array<Record<string, unknown>>;
  const genericReversals = rbac.expectedContributionId == null ? [] : await manager.query(
    `SELECT id FROM business_contributions FORCE INDEX (uq_business_contribution_reversal_of)
      WHERE reversal_of_contribution_id = ? ORDER BY id FOR UPDATE`,
    [rbac.expectedContributionId],
  ) as Array<Record<string, unknown>>;
  if (typedCorrections.length || correctionMappings.length || genericCorrections.length || genericReversals.length) {
    failClosed('repair_formal_composer_correction_required', '已存在更正/冲销事实，首笔 normal contribution 保持关闭');
  }
  const correctionWatermarkHash = stableHash({
    schemaVersion: REPAIR_TYPED_CORRECTION_SCHEMA_VERSION,
    ruleVersion: REPAIR_TYPED_CORRECTION_RULE_VERSION,
    economicRootId,
    typedAuthorities: canonicalRows(typedCorrections), mappingPlans: canonicalRows(correctionMappings),
    genericCorrections: canonicalRows(genericCorrections), genericReversals: canonicalRows(genericReversals),
  });

  const existingContributions = await manager.query(
    `SELECT id, canonical_economic_fact_root_id, confirmation_status
       FROM business_contributions FORCE INDEX (uq_business_contribution_economic_root)
      WHERE canonical_economic_fact_root_id = ? ORDER BY id FOR UPDATE`,
    [economicRootId],
  ) as Array<{ id: number | string; canonical_economic_fact_root_id: string; confirmation_status: string }>;
  if (
    (rbac.expectedContributionId == null && existingContributions.length !== 0) ||
    (rbac.expectedContributionId != null &&
      (existingContributions.length !== 1 || Number(existingContributions[0].id) !== rbac.expectedContributionId))
  ) {
    failClosed('repair_formal_composer_economic_root_claimed', '经济根已被其他 normal contribution 占用或确认目标漂移');
  }

  const sourceVersionGraph = {
    composerRuleVersion: REPAIR_FIRST_FORMAL_SOURCE_COMPOSER_RULE_VERSION,
    revenueSourceVersion: revenue.sourceVersion,
    economicRootId,
    assignmentAuthorityVersion: Number(assignment.authority_version),
    assignmentContentHash: assignment.content_hash,
    baselineAuthorityVersion: Number(baseline.authority_version),
    baselineContentHash: baseline.content_hash,
    correctionWatermarkHash,
  };
  const sourceVersion = `${SOURCE_VERSION_PREFIX}:${stableHash(sourceVersionGraph)}`;
  const sourceRecordHash = stableHash({
    ...sourceVersionGraph,
    revenueSourceRecordHash: revenue.sourceRecordHash,
    sourceGraphHash,
    costCloseWatermarkHash,
    eventCloseWatermarkHash,
  });
  const attributions = attributionLines.map((line) => deepFreeze({
    role: line.role,
    originBusinessDomain: 'repair' as const,
    employeeId: Number(line.employee_id),
    shareBps: Number(line.share_bps),
    evidenceRef: line.evidence_ref,
    evidenceHash: line.evidence_hash,
  }));
  const directCosts = [...baselineLines]
    .sort((left, right) => REQUIRED_COST_CATEGORIES.indexOf(left.category) - REQUIRED_COST_CATEGORIES.indexOf(right.category))
    .map((line) => deepFreeze({
      amountCents: '0',
      sourceSystem: 'stark_repair',
      sourceType: 'repair_delivered_work_order',
      sourceId: selection.sourceId.trim().toLowerCase(),
      sourceVersion,
      sourceAllocationId: `repair-baseline:${baseline.authority_ref}:${line.category}`,
      evidenceRef: line.evidence_ref,
      evidenceHash: line.evidence_hash,
      occurredAt: revenue.recognitionAt,
      costCategory: line.category,
      disposition: 'not_applicable' as const,
    }));
  const sourceSnapshot = deepFreeze({
    businessDomain: 'repair' as const,
    companyRef: authorizedScope.companyRef,
    businessSectorRef: authorizedScope.businessSectorRef,
    storeRef: authorizedScope.storeRef,
    sourceSystem: 'stark_repair',
    sourceType: 'repair_delivered_work_order',
    sourceId: selection.sourceId.trim().toLowerCase(),
    sourceVersion,
    sourceRecordHash,
    recognitionAt: revenue.recognitionAt,
    customerRef: authorizedScope.customerRef,
    currency: 'CNY' as const,
    responsibilityEmployeeId: Number(assignment.responsibility_employee_id),
    canonicalEconomicFactId: economicRootId,
    canonicalSimilaritySubjectId: revenue.canonicalSimilaritySubjectId,
    revenueEvidence: {
      ...revenue.revenueEvidenceCandidate,
      sourceVersion,
    },
    directCosts,
  });
  const authorityPins = deepFreeze({
    economicRootId,
    assignmentAuthorityRef: assignment.authority_ref,
    assignmentAuthorityVersion: Number(assignment.authority_version),
    assignmentContentHash: assignment.content_hash,
    baselineAuthorityRef: baseline.authority_ref,
    baselineAuthorityVersion: Number(baseline.authority_version),
    baselineContentHash: baseline.content_hash,
    correctionWatermarkHash,
  });
  const authorityBundleHash = stableHash({
    schemaVersion: VERIFIED_CONTRIBUTION_AUTHORITY_BUNDLE_SCHEMA_VERSION,
    ruleVersion: REPAIR_FIRST_FORMAL_SOURCE_COMPOSER_RULE_VERSION,
    profileCode: REPAIR_BASELINE_COST_EVENT_TARGET_PROFILE,
    sourceSnapshot,
    attributions,
    authorityPins,
  });
  return deepFreeze({
    schemaVersion: VERIFIED_CONTRIBUTION_AUTHORITY_BUNDLE_SCHEMA_VERSION,
    ruleVersion: REPAIR_FIRST_FORMAL_SOURCE_COMPOSER_RULE_VERSION,
    profileCode: REPAIR_BASELINE_COST_EVENT_TARGET_PROFILE,
    sourceSnapshot,
    attributions,
    authorityPins,
    authorityBundleHash,
  });
}
