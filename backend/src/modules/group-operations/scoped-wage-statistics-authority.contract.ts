import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';
import { BusinessContributionAdapters } from './business-contribution.adapters';

/**
 * SOURCE-ONLY / PRODUCTION-UNWIRED scoped wage-statistics authority.
 *
 * This contract is deliberately not imported by a Nest module, controller,
 * production composer or formal adapter. It establishes reviewable authority
 * semantics only. The four formal adapters remain blocked, so neither this
 * authority nor a complete watermark can produce a wage conclusion today.
 * Enterprise 4-domain coverage is diagnostic: a later group-scoped repair/fresh
 * authority may become usable once every domain required by that group is
 * formally ready, without pretending that water/software are enterprise-ready.
 */

export const SCOPED_WAGE_STATISTICS_SCHEMA_VERSION =
  'gov1-s2-repair-fresh-scoped-wage-statistics-v1' as const;
export const SCOPED_WAGE_STATISTICS_RULE_VERSION =
  'gov1-s2-required-business-domains-v1' as const;
export const SCOPED_WAGE_STATISTICS_ALLOWED_DOMAINS = ['fresh', 'repair'] as const;
export const SCOPED_WAGE_STATISTICS_ENTERPRISE_DOMAINS = [
  'fresh',
  'water',
  'repair',
  'software',
] as const;

const DRAFT_PERMISSION = 'gov1.wage.statistics.scope.draft' as const;
const SUBMIT_PERMISSION = 'gov1.wage.statistics.scope.submit' as const;
const DECIDE_PERMISSION = 'gov1.wage.statistics.scope.decide' as const;
const FREEZE_PERMISSION = 'gov1.wage.statistics.scope.freeze' as const;
const SUPERSEDE_PERMISSION = 'gov1.wage.statistics.scope.supersede' as const;

const GROUP_REF = /^group:([1-9]\d*)$/;
const SETTLEMENT_PERIOD = /^20\d{2}-(0[1-9]|1[0-2])$/;
const LOWER_HEX_64 = /^[0-9a-f]{64}$/;
const EVIDENCE_REF = /^evidence:[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY = /^wage-scope-idempotency:[0-9a-f]{64}$/;
const STRICT_UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MYSQL_DATETIME_UTC =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/;
const SAFE_SOURCE_CURSOR = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
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
const checkerRoles = new Set(['admin', 'finance', 'founder', 'super_admin', 'owner']);

export type ScopedWageStatisticsBusinessDomainV1 =
  (typeof SCOPED_WAGE_STATISTICS_ALLOWED_DOMAINS)[number];
export type ScopedWageStatisticsAuthorityStatusV1 =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'frozen'
  | 'superseded';
export type ScopedWageStatisticsPhaseV1 =
  | 'draft'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'freeze'
  | 'supersede';
export type ScopedWageStatisticsCoverageStatusV1 = 'incomplete' | 'complete';
export type ScopedWageStatisticsGroupTargetStatusV1 =
  | 'calculated'
  | 'calculation_blocked'
  | 'recalculation_required'
  | 'locked';
export type ScopedWageStatisticsGroupTargetAuthorizationV1 =
  | 'approve'
  | 'freeze'
  | 'resolve';

export interface ScopedWageStatisticsDomainWatermarkInputV1 {
  readonly businessDomain: ScopedWageStatisticsBusinessDomainV1;
  readonly sourceCursor: string;
  readonly dataCompleteThroughAt: string;
  readonly unresolvedCostCount: number;
  readonly unresolvedRefundCount: number;
  readonly unresolvedAttributionCount: number;
  readonly unresolvedDuplicateCount: number;
}

export interface DraftScopedWageStatisticsAuthorityCommandV1 {
  readonly groupRef: string;
  readonly settlementPeriod: string;
  readonly expectedGroupTargetCalculationVersion: number;
  readonly requiredBusinessDomains: readonly ScopedWageStatisticsBusinessDomainV1[];
  readonly domainWatermarks: readonly ScopedWageStatisticsDomainWatermarkInputV1[];
  readonly supersedesAuthorityRef: string | null;
  readonly expectedSupersededAuthorityVersion: number | null;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface SubmitScopedWageStatisticsAuthorityCommandV1 {
  readonly authorityRef: string;
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface DecideScopedWageStatisticsAuthorityCommandV1 {
  readonly authorityRef: string;
  readonly decision: 'approve' | 'reject';
  readonly reasonCode: 'scope_verified' | 'scope_rejected';
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface FreezeScopedWageStatisticsAuthorityCommandV1 {
  readonly authorityRef: string;
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly reasonCode: 'settlement_scope_frozen';
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface SupersedeScopedWageStatisticsAuthorityCommandV1 {
  readonly replacementAuthorityRef: string;
  readonly expectedReplacementAuthorityVersion: number;
  readonly expectedReplacementContentHash: string;
  readonly supersededAuthorityRef: string;
  readonly expectedSupersededAuthorityVersion: number;
  readonly expectedSupersededContentHash: string;
  readonly reasonCode: 'scope_replaced';
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface NormalizedScopedWageStatisticsDomainWatermarkV1 {
  readonly businessDomain: ScopedWageStatisticsBusinessDomainV1;
  readonly domainOrder: number;
  readonly adapterContractVersion: string;
  readonly sourceCursor: string;
  readonly sourceCursorHash: string;
  readonly dataCompleteThroughAt: string;
  readonly unresolvedCostCount: number;
  readonly unresolvedRefundCount: number;
  readonly unresolvedAttributionCount: number;
  readonly unresolvedDuplicateCount: number;
  readonly completenessStatus: ScopedWageStatisticsCoverageStatusV1;
  readonly watermarkHash: string;
  readonly lineHash: string;
}

export interface NormalizedDraftScopedWageStatisticsAuthorityV1 {
  readonly groupId: number;
  readonly settlementPeriod: string;
  readonly expectedGroupTargetCalculationVersion: number;
  readonly requiredBusinessDomains: readonly ScopedWageStatisticsBusinessDomainV1[];
  readonly requiredDomainsHash: string;
  readonly domainWatermarks: readonly NormalizedScopedWageStatisticsDomainWatermarkV1[];
  readonly dataCompletenessWatermarkHash: string;
  readonly supersedesAuthorityRef: string | null;
  readonly expectedSupersededAuthorityVersion: number | null;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

interface NormalizedAuthorityActionV1 {
  readonly authorityRef: string;
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

interface NormalizedDecisionV1 extends NormalizedAuthorityActionV1 {
  readonly decision: 'approve' | 'reject';
  readonly reasonCode: 'scope_verified' | 'scope_rejected';
}

interface NormalizedFreezeV1 extends NormalizedAuthorityActionV1 {
  readonly reasonCode: 'settlement_scope_frozen';
}

interface NormalizedSupersedeV1 {
  readonly replacementAuthorityRef: string;
  readonly expectedReplacementAuthorityVersion: number;
  readonly expectedReplacementContentHash: string;
  readonly supersededAuthorityRef: string;
  readonly expectedSupersededAuthorityVersion: number;
  readonly expectedSupersededContentHash: string;
  readonly reasonCode: 'scope_replaced';
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface ScopedWageStatisticsDualCoverageV1 {
  readonly requiredDomainCount: number;
  readonly dataCompleteDomainCount: number;
  readonly settlementCompleteDomainCount: number;
  readonly settlementCoverageStatus: ScopedWageStatisticsCoverageStatusV1;
  readonly enterpriseFormalDomainCount: 4;
  readonly enterpriseReadyDomainCount: number;
  readonly enterpriseCoverageStatus: ScopedWageStatisticsCoverageStatusV1;
  readonly scopedBlockers: readonly string[];
  readonly enterpriseBlockers: readonly string[];
}

export interface ScopedWageStatisticsCoverageSnapshotV1 {
  readonly requiredDomainCount: number;
  readonly dataCompleteDomainCount: number;
  readonly settlementCompleteDomainCount: number;
  readonly settlementCoverageStatus: ScopedWageStatisticsCoverageStatusV1;
  readonly enterpriseFormalDomainCount: 4;
  readonly enterpriseReadyDomainCount: number;
  readonly enterpriseCoverageStatus: ScopedWageStatisticsCoverageStatusV1;
}

export interface ScopedWageStatisticsAdapterReadinessV1 {
  readonly businessDomain: 'fresh' | 'water' | 'repair' | 'software';
  readonly adapterVersion: string;
  readonly formalAuthorityReadiness: 'blocked' | 'ready';
  readonly formalAuthorityBlocker: string;
}

export interface ScopedWageStatisticsAuthorityReceiptV1 {
  readonly schemaVersion: typeof SCOPED_WAGE_STATISTICS_SCHEMA_VERSION;
  readonly ruleVersion: typeof SCOPED_WAGE_STATISTICS_RULE_VERSION;
  readonly authorityRef: string;
  readonly authorityVersion: number;
  readonly status: ScopedWageStatisticsAuthorityStatusV1;
  readonly groupRef: string;
  readonly settlementPeriod: string;
  readonly groupTargetId: number;
  readonly groupTargetCalculationVersion: number;
  readonly groupTargetScopeHash: string;
  readonly requiredBusinessDomains: readonly ScopedWageStatisticsBusinessDomainV1[];
  readonly requiredDomainsHash: string;
  readonly dataCompletenessWatermarkHash: string;
  readonly contentHash: string;
  /** Immutable coverage fields committed into contentHash at authority creation. */
  readonly coverage: ScopedWageStatisticsCoverageSnapshotV1;
  /** Current adapter diagnostic; explicitly not part of the immutable receipt fingerprint. */
  readonly currentCoverage: ScopedWageStatisticsDualCoverageV1;
  readonly supersedesAuthorityRef: string | null;
  readonly supersededAuthorityRef: string | null;
}

interface GroupScopeV1 {
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  customerRef: null;
}

interface GroupRowV1 {
  id: string | number;
  companyRef: string;
  businessSectorRef: string | null;
  storeRef: string | null;
  status: string;
}

export interface GroupTargetScopeBindingV1 {
  readonly id: number;
  readonly groupId: number;
  readonly settlementPeriod: string;
  readonly calculationVersion: number;
  readonly calculationStatus: ScopedWageStatisticsGroupTargetStatusV1;
  readonly lockedAt: string | null;
  readonly requestFingerprint: string;
  readonly groupTargetScopeHash: string;
}

export interface ScopedWageStatisticsGroupTargetCurrentStateV1 {
  readonly id: number;
  readonly groupId: number;
  readonly settlementPeriod: string;
  readonly calculationVersion: number;
  readonly calculationStatus: ScopedWageStatisticsGroupTargetStatusV1;
  readonly lockedAt: string | null;
  readonly requestFingerprint: string;
}

interface VerifiedScopedWageStatisticsAuthorityGraphV1 {
  readonly lines: readonly NormalizedScopedWageStatisticsDomainWatermarkV1[];
  readonly domains: readonly ScopedWageStatisticsBusinessDomainV1[];
  readonly target: Readonly<GroupTargetScopeBindingV1>;
  readonly coverage: Readonly<ScopedWageStatisticsCoverageSnapshotV1>;
  readonly currentCoverage: Readonly<ScopedWageStatisticsDualCoverageV1>;
}

interface GroupTargetRowV1 {
  id: string | number;
  group_id: string | number;
  settlement_period: string;
  calculation_version: string | number;
  calculation_status: string;
  locked_at: Date | string | null;
  request_fingerprint: string;
}

interface AuthorityRowV1 {
  id: string | number;
  authority_ref: string;
  group_id: string | number;
  settlement_period: string;
  authority_version: string | number;
  supersedes_authority_id: string | number | null;
  group_target_id: string | number;
  group_target_calculation_version: string | number;
  required_domain_count: string | number;
  required_domains_hash: string;
  data_completeness_watermark_hash: string;
  settlement_complete_domain_count: string | number;
  settlement_coverage_status: ScopedWageStatisticsCoverageStatusV1;
  enterprise_formal_domain_count: string | number;
  enterprise_ready_domain_count: string | number;
  enterprise_coverage_status: ScopedWageStatisticsCoverageStatusV1;
  group_target_scope_hash: string;
  content_hash: string;
  status: ScopedWageStatisticsAuthorityStatusV1;
  created_by_user_id: string | number;
  submitted_by_user_id: string | number | null;
  approved_by_user_id: string | number | null;
  rejected_by_user_id: string | number | null;
  frozen_by_user_id: string | number | null;
  superseded_by_user_id: string | number | null;
}

interface DomainLineRowV1 {
  id: string | number;
  authority_id: string | number;
  group_id: string | number;
  settlement_period: string;
  business_domain: ScopedWageStatisticsBusinessDomainV1;
  domain_order: string | number;
  adapter_contract_version: string;
  source_cursor: string;
  source_cursor_hash: string;
  data_complete_through_at: Date | string;
  unresolved_cost_count: string | number;
  unresolved_refund_count: string | number;
  unresolved_attribution_count: string | number;
  unresolved_duplicate_count: string | number;
  completeness_status: ScopedWageStatisticsCoverageStatusV1;
  watermark_hash: string;
  line_hash: string;
}

interface LockedActorV1 {
  userId: number;
  employeeId: number;
  roleCodes: readonly string[];
}

interface ClaimRowV1 {
  phase: ScopedWageStatisticsPhaseV1;
  request_fingerprint: string;
  actor_user_id: string | number;
  state: 'claimed' | 'completed';
  authority_id: string | number | null;
  lifecycle_event_id: string | number | null;
}

interface LifecycleEventRowV1 {
  id: string | number;
  event_ref: string;
  authority_id: string | number;
  event_type: 'drafted' | 'submitted' | 'approved' | 'rejected' | 'frozen' | 'superseded';
  from_status: ScopedWageStatisticsAuthorityStatusV1 | null;
  to_status: ScopedWageStatisticsAuthorityStatusV1;
  actor_user_id: string | number;
  reason_code: string;
  evidence_ref: string;
  evidence_hash: string;
  request_fingerprint: string;
  authority_content_hash: string;
}

class WageScopeIdempotencyRaceV1 extends Error {
  constructor(
    readonly phase: ScopedWageStatisticsPhaseV1,
    readonly idempotencyKey: string,
    readonly requestFingerprint: string,
  ) {
    super('wage_scope_idempotency_claim_race');
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

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
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
  const actual = Object.keys(value as Record<string, unknown>).sort();
  const expected = [...allowedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    failClosed(code, '命令字段不符合固定白名单');
  }
}

function positiveMysqlInt(value: unknown, code: string, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > MYSQL_INT_MAX) {
    failClosed(code, `${label} 必须是 MySQL 正整数`);
  }
  return Number(value);
}

function nonNegativeMysqlInt(value: unknown, code: string, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > MYSQL_INT_MAX) {
    failClosed(code, `${label} 必须是 MySQL 非负整数`);
  }
  return Number(value);
}

function lowerHash(value: unknown, code: string, label: string): string {
  if (typeof value !== 'string' || !LOWER_HEX_64.test(value)) {
    failClosed(code, `${label} 必须是 lowercase SHA-256`);
  }
  return value;
}

function evidenceRef(value: unknown): string {
  if (typeof value !== 'string' || !EVIDENCE_REF.test(value)) {
    failClosed('wage_scope_evidence_ref_invalid', '证据引用必须是固定脱敏 SHA-256 引用');
  }
  return value;
}

function idempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY.test(value)) {
    failClosed('wage_scope_idempotency_key_invalid', '幂等键格式不符合固定白名单');
  }
  return value;
}

function authorityRef(value: unknown): string {
  return lowerHash(value, 'wage_scope_authority_ref_invalid', '权威引用');
}

function groupIdFromRef(value: unknown): number {
  if (typeof value !== 'string') failClosed('wage_scope_group_ref_invalid', '经营组引用无效');
  const match = GROUP_REF.exec(value);
  if (!match) failClosed('wage_scope_group_ref_invalid', '经营组引用无效');
  return positiveMysqlInt(Number(match[1]), 'wage_scope_group_ref_invalid', '经营组引用');
}

function settlementPeriod(value: unknown): string {
  if (typeof value !== 'string' || !SETTLEMENT_PERIOD.test(value)) {
    failClosed('wage_scope_settlement_period_invalid', '结算期必须为 20xx-MM');
  }
  return value;
}

function utcInstant(value: unknown, code: string): string {
  if (typeof value !== 'string' || !STRICT_UTC_MILLIS.test(value)) {
    failClosed(code, '时间必须是毫秒精度 UTC ISO 时间');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    failClosed(code, '时间不是有效 UTC 时点');
  }
  return value;
}

export function mysqlDateParameterFromUtcInstantV1(value: string): Date {
  const normalized = utcInstant(value, 'wage_scope_storage_time_invalid');
  return new Date(normalized);
}

export function normalizeStoredMysqlUtcInstantV1(value: Date | string | null): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    if (STRICT_UTC_MILLIS.test(value)) return utcInstant(value, 'wage_scope_storage_time_invalid');
    const match = MYSQL_DATETIME_UTC.exec(value);
    if (!match) failClosed('wage_scope_storage_time_invalid', '持久化时间格式无效');
    const milliseconds = (match[3] ?? '').padEnd(3, '0').slice(0, 3);
    return utcInstant(
      `${match[1]}T${match[2]}.${milliseconds}Z`,
      'wage_scope_storage_time_invalid',
    );
  }
  const date = value;
  if (!Number.isFinite(date.getTime())) failClosed('wage_scope_storage_time_invalid', '持久化时间无效');
  return date.toISOString();
}

const toIso = normalizeStoredMysqlUtcInstantV1;

export function normalizeDatabaseCurrentTimestampRowsV1(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length !== 1) {
    failClosed('wage_scope_database_time_invalid', '数据库当前时间必须恰好返回一行');
  }
  const row = rows[0];
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    failClosed('wage_scope_database_time_invalid', '数据库当前时间返回值无效');
  }
  const keys = Object.keys(row as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== 'database_current_timestamp') {
    failClosed('wage_scope_database_time_invalid', '数据库当前时间必须恰好返回一个固定字段');
  }
  let normalized: string | null;
  try {
    normalized = normalizeStoredMysqlUtcInstantV1(
      (row as Record<string, unknown>).database_current_timestamp as Date | string | null,
    );
  } catch {
    failClosed('wage_scope_database_time_invalid', '数据库当前时间不可解析');
  }
  if (normalized == null) {
    failClosed('wage_scope_database_time_invalid', '数据库当前时间不能为空');
  }
  const epochMillis = Date.parse(normalized);
  if (!Number.isFinite(epochMillis)) {
    failClosed('wage_scope_database_time_invalid', '数据库当前时间不可解析');
  }
  return epochMillis;
}

function normalizeGrantBoundaryMillisV1(value: unknown, nullable: boolean): number | null {
  if (value == null) {
    if (nullable) return null;
    failClosed('wage_scope_grant_time_invalid', '授权生效时间不能为空');
  }
  let normalized: string | null;
  try {
    normalized = normalizeStoredMysqlUtcInstantV1(value as Date | string | null);
  } catch {
    failClosed('wage_scope_grant_time_invalid', '授权有效期不可解析');
  }
  if (normalized == null) {
    failClosed('wage_scope_grant_time_invalid', '授权有效期不可解析');
  }
  const epochMillis = Date.parse(normalized);
  if (!Number.isFinite(epochMillis)) {
    failClosed('wage_scope_grant_time_invalid', '授权有效期不可解析');
  }
  return epochMillis;
}

function periodEndInclusiveInstant(period: string): string {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, month, 1) - 8 * 60 * 60 * 1000 - 1).toISOString();
}

export function assertWatermarkCoversSettlementPeriodV1(
  dataCompleteThroughAt: string,
  period: string,
): void {
  const normalizedPeriod = settlementPeriod(period);
  const normalizedInstant = utcInstant(
    dataCompleteThroughAt,
    'wage_scope_complete_through_invalid',
  );
  if (Date.parse(normalizedInstant) < Date.parse(periodEndInclusiveInstant(normalizedPeriod))) {
    failClosed('wage_scope_watermark_before_period_end', 'watermark 尚未覆盖完整结算期');
  }
}

function normalizeRequiredDomains(
  value: unknown,
): readonly ScopedWageStatisticsBusinessDomainV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) {
    failClosed('wage_scope_required_domains_invalid', 'requiredBusinessDomains 必须包含 1 至 2 个域');
  }
  for (const domain of value) {
    if (domain === 'water' || domain === 'software') {
      failClosed('wage_scope_domain_not_allowed', '首批仅允许 fresh 与 repair，water/software 保持未接入');
    }
    if (!SCOPED_WAGE_STATISTICS_ALLOWED_DOMAINS.includes(domain as ScopedWageStatisticsBusinessDomainV1)) {
      failClosed('wage_scope_domain_invalid', 'requiredBusinessDomains 包含未知域');
    }
  }
  if (new Set(value).size !== value.length) {
    failClosed('wage_scope_required_domain_duplicate', 'requiredBusinessDomains 不得重复');
  }
  return deepFreeze(
    [...value].sort(
      (left, right) =>
        SCOPED_WAGE_STATISTICS_ALLOWED_DOMAINS.indexOf(left) -
        SCOPED_WAGE_STATISTICS_ALLOWED_DOMAINS.indexOf(right),
    ) as ScopedWageStatisticsBusinessDomainV1[],
  );
}

function adapterContracts(
  supplied?: readonly ScopedWageStatisticsAdapterReadinessV1[],
): readonly ScopedWageStatisticsAdapterReadinessV1[] {
  const contracts = supplied ?? BusinessContributionAdapters.listContracts();
  const domains = contracts.map((item) => item.businessDomain);
  if (
    contracts.length !== 4 ||
    new Set(domains).size !== 4 ||
    SCOPED_WAGE_STATISTICS_ENTERPRISE_DOMAINS.some((domain) => !domains.includes(domain))
  ) {
    failClosed('wage_scope_adapter_registry_invalid', '正式贡献适配器注册表不是固定四域');
  }
  for (const contract of contracts) {
    if (
      typeof contract.adapterVersion !== 'string' ||
      contract.adapterVersion.length < 1 ||
      contract.adapterVersion.length > 64 ||
      !['blocked', 'ready'].includes(contract.formalAuthorityReadiness) ||
      typeof contract.formalAuthorityBlocker !== 'string'
    ) {
      failClosed('wage_scope_adapter_registry_invalid', '正式贡献适配器契约字段无效');
    }
  }
  return contracts;
}

function normalizeDomainWatermarks(
  value: unknown,
  domains: readonly ScopedWageStatisticsBusinessDomainV1[],
  period: string,
): readonly NormalizedScopedWageStatisticsDomainWatermarkV1[] {
  if (!Array.isArray(value) || value.length !== domains.length) {
    failClosed('wage_scope_watermarks_invalid', '每个 requiredBusinessDomain 必须且只能有一条 watermark');
  }
  const contracts = adapterContracts();
  const normalized = value.map((raw) => {
    assertPlainExactObject(
      raw,
      [
        'businessDomain',
        'sourceCursor',
        'dataCompleteThroughAt',
        'unresolvedCostCount',
        'unresolvedRefundCount',
        'unresolvedAttributionCount',
        'unresolvedDuplicateCount',
      ],
      'wage_scope_watermark_shape_invalid',
    );
    if (!domains.includes(raw.businessDomain as ScopedWageStatisticsBusinessDomainV1)) {
      if (raw.businessDomain === 'water' || raw.businessDomain === 'software') {
        failClosed('wage_scope_domain_not_allowed', 'water/software 不在首批工资统计范围');
      }
      failClosed('wage_scope_watermark_domain_invalid', 'watermark 域不在 requiredBusinessDomains 中');
    }
    const businessDomain = raw.businessDomain as ScopedWageStatisticsBusinessDomainV1;
    if (typeof raw.sourceCursor !== 'string' || !SAFE_SOURCE_CURSOR.test(raw.sourceCursor)) {
      failClosed('wage_scope_source_cursor_invalid', 'sourceCursor 必须是 1 至 191 位安全 ASCII 游标');
    }
    const dataCompleteThroughAt = utcInstant(
      raw.dataCompleteThroughAt,
      'wage_scope_complete_through_invalid',
    );
    assertWatermarkCoversSettlementPeriodV1(dataCompleteThroughAt, period);
    const counts = {
      unresolvedCostCount: nonNegativeMysqlInt(
        raw.unresolvedCostCount,
        'wage_scope_unresolved_count_invalid',
        '未决成本数',
      ),
      unresolvedRefundCount: nonNegativeMysqlInt(
        raw.unresolvedRefundCount,
        'wage_scope_unresolved_count_invalid',
        '未决退款数',
      ),
      unresolvedAttributionCount: nonNegativeMysqlInt(
        raw.unresolvedAttributionCount,
        'wage_scope_unresolved_count_invalid',
        '未决归因数',
      ),
      unresolvedDuplicateCount: nonNegativeMysqlInt(
        raw.unresolvedDuplicateCount,
        'wage_scope_unresolved_count_invalid',
        '未决重复数',
      ),
    };
    const contract = contracts.find((item) => item.businessDomain === businessDomain);
    if (!contract) failClosed('wage_scope_adapter_contract_missing', `${businessDomain} 适配器契约缺失`);
    const sourceCursorHash = canonicalHash({ businessDomain, sourceCursor: raw.sourceCursor });
    const completenessStatus: ScopedWageStatisticsCoverageStatusV1 =
      Object.values(counts).every((count) => count === 0) ? 'complete' : 'incomplete';
    const domainOrder = domains.indexOf(businessDomain) + 1;
    const watermark = {
      businessDomain,
      domainOrder,
      adapterContractVersion: contract.adapterVersion,
      sourceCursor: raw.sourceCursor,
      sourceCursorHash,
      dataCompleteThroughAt,
      ...counts,
      completenessStatus,
    };
    const watermarkHash = canonicalHash({
      schemaVersion: SCOPED_WAGE_STATISTICS_SCHEMA_VERSION,
      ruleVersion: SCOPED_WAGE_STATISTICS_RULE_VERSION,
      ...watermark,
    });
    return deepFreeze({
      ...watermark,
      watermarkHash,
      lineHash: canonicalHash({ ...watermark, watermarkHash }),
    });
  });
  normalized.sort((left, right) => left.domainOrder - right.domainOrder);
  if (new Set(normalized.map((line) => line.businessDomain)).size !== domains.length) {
    failClosed('wage_scope_watermark_duplicate', '同一业务域只能有一条 watermark');
  }
  if (normalized.some((line, index) => line.businessDomain !== domains[index])) {
    failClosed('wage_scope_watermark_coverage_invalid', 'watermark 必须精确覆盖全部 requiredBusinessDomains');
  }
  return deepFreeze(normalized);
}

export function normalizeDraftScopedWageStatisticsAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedDraftScopedWageStatisticsAuthorityV1> {
  assertPlainExactObject(
    command,
    [
      'groupRef',
      'settlementPeriod',
      'expectedGroupTargetCalculationVersion',
      'requiredBusinessDomains',
      'domainWatermarks',
      'supersedesAuthorityRef',
      'expectedSupersededAuthorityVersion',
      'evidenceRef',
      'evidenceHash',
      'idempotencyKey',
    ],
    'wage_scope_draft_shape_invalid',
  );
  const period = settlementPeriod(command.settlementPeriod);
  const requiredBusinessDomains = normalizeRequiredDomains(command.requiredBusinessDomains);
  const domainWatermarks = normalizeDomainWatermarks(
    command.domainWatermarks,
    requiredBusinessDomains,
    period,
  );
  const supersedes = command.supersedesAuthorityRef == null
    ? null
    : authorityRef(command.supersedesAuthorityRef);
  const expectedSupersededAuthorityVersion = command.expectedSupersededAuthorityVersion == null
    ? null
    : positiveMysqlInt(
        command.expectedSupersededAuthorityVersion,
        'wage_scope_expected_version_invalid',
        '被替代权威版本',
      );
  if ((supersedes == null) !== (expectedSupersededAuthorityVersion == null)) {
    failClosed('wage_scope_supersedes_pair_invalid', '被替代引用与期望版本必须同时为空或同时存在');
  }
  const requiredDomainsHash = canonicalHash({
    ruleVersion: SCOPED_WAGE_STATISTICS_RULE_VERSION,
    requiredBusinessDomains,
  });
  const dataCompletenessWatermarkHash = canonicalHash({
    schemaVersion: SCOPED_WAGE_STATISTICS_SCHEMA_VERSION,
    settlementPeriod: period,
    watermarks: domainWatermarks.map((line) => ({
      businessDomain: line.businessDomain,
      watermarkHash: line.watermarkHash,
    })),
  });
  const base = {
    groupId: groupIdFromRef(command.groupRef),
    settlementPeriod: period,
    expectedGroupTargetCalculationVersion: positiveMysqlInt(
      command.expectedGroupTargetCalculationVersion,
      'wage_scope_expected_target_version_invalid',
      '经营目标计算版本',
    ),
    requiredBusinessDomains,
    requiredDomainsHash,
    domainWatermarks,
    dataCompletenessWatermarkHash,
    supersedesAuthorityRef: supersedes,
    expectedSupersededAuthorityVersion,
    evidenceRef: evidenceRef(command.evidenceRef),
    evidenceHash: lowerHash(command.evidenceHash, 'wage_scope_evidence_hash_invalid', '证据哈希'),
    idempotencyKey: idempotencyKey(command.idempotencyKey),
  };
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

function normalizeAuthorityAction(
  command: unknown,
  shapeCode: string,
): Readonly<NormalizedAuthorityActionV1> {
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
    shapeCode,
  );
  const base = {
    authorityRef: authorityRef(command.authorityRef),
    expectedAuthorityVersion: positiveMysqlInt(
      command.expectedAuthorityVersion,
      'wage_scope_expected_version_invalid',
      '权威版本',
    ),
    expectedContentHash: lowerHash(
      command.expectedContentHash,
      'wage_scope_content_hash_invalid',
      '内容哈希',
    ),
    evidenceRef: evidenceRef(command.evidenceRef),
    evidenceHash: lowerHash(command.evidenceHash, 'wage_scope_evidence_hash_invalid', '证据哈希'),
    idempotencyKey: idempotencyKey(command.idempotencyKey),
  };
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

export function normalizeSubmitScopedWageStatisticsAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedAuthorityActionV1> {
  return normalizeAuthorityAction(command, 'wage_scope_submit_shape_invalid');
}

export function normalizeDecideScopedWageStatisticsAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedDecisionV1> {
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
    'wage_scope_decision_shape_invalid',
  );
  if (command.decision !== 'approve' && command.decision !== 'reject') {
    failClosed('wage_scope_decision_invalid', '决策只能是 approve 或 reject');
  }
  const reasonCode = command.decision === 'approve' ? 'scope_verified' : 'scope_rejected';
  if (command.reasonCode !== reasonCode) {
    failClosed('wage_scope_reason_invalid', '决策与固定理由码不一致');
  }
  const action = normalizeAuthorityAction(
    {
      authorityRef: command.authorityRef,
      expectedAuthorityVersion: command.expectedAuthorityVersion,
      expectedContentHash: command.expectedContentHash,
      evidenceRef: command.evidenceRef,
      evidenceHash: command.evidenceHash,
      idempotencyKey: command.idempotencyKey,
    },
    'wage_scope_decision_shape_invalid',
  );
  const base = { ...action, decision: command.decision, reasonCode } as const;
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

export function normalizeFreezeScopedWageStatisticsAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedFreezeV1> {
  assertPlainExactObject(
    command,
    [
      'authorityRef',
      'expectedAuthorityVersion',
      'expectedContentHash',
      'reasonCode',
      'evidenceRef',
      'evidenceHash',
      'idempotencyKey',
    ],
    'wage_scope_freeze_shape_invalid',
  );
  if (command.reasonCode !== 'settlement_scope_frozen') {
    failClosed('wage_scope_reason_invalid', '冻结理由码无效');
  }
  const action = normalizeAuthorityAction(
    {
      authorityRef: command.authorityRef,
      expectedAuthorityVersion: command.expectedAuthorityVersion,
      expectedContentHash: command.expectedContentHash,
      evidenceRef: command.evidenceRef,
      evidenceHash: command.evidenceHash,
      idempotencyKey: command.idempotencyKey,
    },
    'wage_scope_freeze_shape_invalid',
  );
  const base = { ...action, reasonCode: 'settlement_scope_frozen' as const };
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

export function normalizeSupersedeScopedWageStatisticsAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedSupersedeV1> {
  assertPlainExactObject(
    command,
    [
      'replacementAuthorityRef',
      'expectedReplacementAuthorityVersion',
      'expectedReplacementContentHash',
      'supersededAuthorityRef',
      'expectedSupersededAuthorityVersion',
      'expectedSupersededContentHash',
      'reasonCode',
      'evidenceRef',
      'evidenceHash',
      'idempotencyKey',
    ],
    'wage_scope_supersede_shape_invalid',
  );
  if (command.reasonCode !== 'scope_replaced') {
    failClosed('wage_scope_reason_invalid', '替代理由码无效');
  }
  const base = {
    replacementAuthorityRef: authorityRef(command.replacementAuthorityRef),
    expectedReplacementAuthorityVersion: positiveMysqlInt(
      command.expectedReplacementAuthorityVersion,
      'wage_scope_expected_version_invalid',
      '替代权威版本',
    ),
    expectedReplacementContentHash: lowerHash(
      command.expectedReplacementContentHash,
      'wage_scope_content_hash_invalid',
      '替代权威内容哈希',
    ),
    supersededAuthorityRef: authorityRef(command.supersededAuthorityRef),
    expectedSupersededAuthorityVersion: positiveMysqlInt(
      command.expectedSupersededAuthorityVersion,
      'wage_scope_expected_version_invalid',
      '被替代权威版本',
    ),
    expectedSupersededContentHash: lowerHash(
      command.expectedSupersededContentHash,
      'wage_scope_content_hash_invalid',
      '被替代权威内容哈希',
    ),
    reasonCode: 'scope_replaced' as const,
    evidenceRef: evidenceRef(command.evidenceRef),
    evidenceHash: lowerHash(command.evidenceHash, 'wage_scope_evidence_hash_invalid', '证据哈希'),
    idempotencyKey: idempotencyKey(command.idempotencyKey),
  };
  if (base.replacementAuthorityRef === base.supersededAuthorityRef) {
    failClosed('wage_scope_self_supersede', '权威不能替代自身');
  }
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

export function evaluateScopedWageStatisticsDualCoverageV1(
  requiredBusinessDomains: readonly ScopedWageStatisticsBusinessDomainV1[],
  domainWatermarks: readonly NormalizedScopedWageStatisticsDomainWatermarkV1[],
): Readonly<ScopedWageStatisticsDualCoverageV1> {
  return evaluateScopedWageStatisticsDualCoverageWithAdaptersV1(
    requiredBusinessDomains,
    domainWatermarks,
    BusinessContributionAdapters.listContracts(),
  );
}

export function evaluateScopedWageStatisticsDualCoverageWithAdaptersV1(
  requiredBusinessDomains: readonly ScopedWageStatisticsBusinessDomainV1[],
  domainWatermarks: readonly NormalizedScopedWageStatisticsDomainWatermarkV1[],
  suppliedContracts: readonly ScopedWageStatisticsAdapterReadinessV1[],
): Readonly<ScopedWageStatisticsDualCoverageV1> {
  const domains = normalizeRequiredDomains(requiredBusinessDomains);
  if (
    domainWatermarks.length !== domains.length ||
    domainWatermarks.some((line, index) => line.businessDomain !== domains[index])
  ) {
    failClosed('wage_scope_coverage_lines_invalid', '覆盖计算必须精确匹配 requiredBusinessDomains');
  }
  const contracts = adapterContracts(suppliedContracts);
  const enterpriseReady = contracts.filter((contract) => contract.formalAuthorityReadiness === 'ready');
  const dataCompleteDomainCount = domainWatermarks.filter(
    (line) => line.completenessStatus === 'complete',
  ).length;
  const scopedReady = domainWatermarks.filter((line) => {
    const contract = contracts.find((candidate) => candidate.businessDomain === line.businessDomain);
    return (
      line.completenessStatus === 'complete' &&
      contract?.formalAuthorityReadiness === 'ready' &&
      contract.adapterVersion === line.adapterContractVersion
    );
  });
  const scopedBlockers = domainWatermarks
    .filter((line) => !scopedReady.some((ready) => ready.businessDomain === line.businessDomain))
    .map((line) => {
      const contract = contracts.find((candidate) => candidate.businessDomain === line.businessDomain);
      if (line.completenessStatus !== 'complete') return `${line.businessDomain}:watermark_incomplete`;
      if (!contract) return `${line.businessDomain}:adapter_contract_missing`;
      if (contract.adapterVersion !== line.adapterContractVersion) {
        return `${line.businessDomain}:adapter_contract_version_drift`;
      }
      return `${line.businessDomain}:${contract.formalAuthorityBlocker}`;
    });
  const enterpriseBlockers = contracts
    .filter((contract) => contract.formalAuthorityReadiness !== 'ready')
    .map((contract) => `${contract.businessDomain}:${contract.formalAuthorityBlocker}`);
  return deepFreeze({
    requiredDomainCount: domains.length,
    dataCompleteDomainCount,
    settlementCompleteDomainCount: scopedReady.length,
    settlementCoverageStatus: scopedReady.length === domains.length ? 'complete' : 'incomplete',
    enterpriseFormalDomainCount: 4 as const,
    enterpriseReadyDomainCount: enterpriseReady.length,
    enterpriseCoverageStatus: enterpriseReady.length === 4 ? 'complete' : 'incomplete',
    scopedBlockers: deepFreeze(scopedBlockers),
    enterpriseBlockers: deepFreeze(enterpriseBlockers),
  });
}

/** Enterprise coverage is diagnostic; only the exact group-period scope is an authorization input. */
export function isScopedWageStatisticsCoverageReadyV1(
  coverage: Readonly<ScopedWageStatisticsDualCoverageV1>,
): boolean {
  return (
    coverage.settlementCoverageStatus === 'complete' &&
    coverage.settlementCompleteDomainCount === coverage.requiredDomainCount
  );
}

export function snapshotScopedWageStatisticsCoverageV1(
  coverage: Readonly<ScopedWageStatisticsDualCoverageV1>,
): Readonly<ScopedWageStatisticsCoverageSnapshotV1> {
  return deepFreeze({
    requiredDomainCount: coverage.requiredDomainCount,
    dataCompleteDomainCount: coverage.dataCompleteDomainCount,
    settlementCompleteDomainCount: coverage.settlementCompleteDomainCount,
    settlementCoverageStatus: coverage.settlementCoverageStatus,
    enterpriseFormalDomainCount: coverage.enterpriseFormalDomainCount,
    enterpriseReadyDomainCount: coverage.enterpriseReadyDomainCount,
    enterpriseCoverageStatus: coverage.enterpriseCoverageStatus,
  });
}

export function assertCurrentScopedCoverageMatchesSnapshotV1(
  snapshot: Readonly<ScopedWageStatisticsCoverageSnapshotV1>,
  current: Readonly<ScopedWageStatisticsDualCoverageV1>,
): void {
  if (
    snapshot.requiredDomainCount !== current.requiredDomainCount ||
    snapshot.dataCompleteDomainCount !== current.dataCompleteDomainCount ||
    snapshot.settlementCompleteDomainCount !== current.settlementCompleteDomainCount ||
    snapshot.settlementCoverageStatus !== current.settlementCoverageStatus
  ) {
    failClosed(
      'wage_scope_required_domain_readiness_drift',
      'requiredBusinessDomains 当前适配器/完整性状态与权威快照不一致',
    );
  }
}

export function deriveGroupTargetScopeHashV1(input: {
  readonly id: number;
  readonly groupId: number;
  readonly settlementPeriod: string;
  readonly calculationVersion: number;
  readonly requestFingerprint: string;
  readonly requiredDomainsHash: string;
}): string {
  return canonicalHash({
    schemaVersion: SCOPED_WAGE_STATISTICS_SCHEMA_VERSION,
    groupTargetId: positiveMysqlInt(input.id, 'wage_scope_target_invalid', '经营目标 ID'),
    groupId: positiveMysqlInt(input.groupId, 'wage_scope_group_invalid', '经营组 ID'),
    settlementPeriod: settlementPeriod(input.settlementPeriod),
    calculationVersion: positiveMysqlInt(
      input.calculationVersion,
      'wage_scope_target_invalid',
      '经营目标版本',
    ),
    requestFingerprint: lowerHash(
      input.requestFingerprint,
      'wage_scope_target_fingerprint_invalid',
      '经营目标请求指纹',
    ),
    requiredDomainsHash: lowerHash(
      input.requiredDomainsHash,
      'wage_scope_required_domains_hash_invalid',
      'requiredBusinessDomains 哈希',
    ),
  });
}

export function assertNoFrozenOrLockedScopeShrinkV1(
  previousDomains: readonly ScopedWageStatisticsBusinessDomainV1[],
  replacementDomains: readonly ScopedWageStatisticsBusinessDomainV1[],
  previousAuthorityStatus: ScopedWageStatisticsAuthorityStatusV1,
  previousTargetCalculationStatus: string,
  previousTargetLockedAt: string | null,
): void {
  const previous = normalizeRequiredDomains(previousDomains);
  const replacement = normalizeRequiredDomains(replacementDomains);
  const targetLocked = previousTargetCalculationStatus === 'locked';
  if (
    !['calculated', 'calculation_blocked', 'recalculation_required', 'locked'].includes(
      previousTargetCalculationStatus,
    ) ||
    targetLocked !== (previousTargetLockedAt != null)
  ) {
    failClosed('wage_scope_target_lock_state_invalid', '经营目标状态与锁定时间不一致');
  }
  if (
    (previousAuthorityStatus === 'frozen' || targetLocked) &&
    previous.some((domain) => !replacement.includes(domain))
  ) {
    failClosed('wage_scope_locked_scope_shrink_denied', '冻结或锁定后只允许保持或扩大业务域范围');
  }
}

export function assertFrozenGroupTargetBindingStillLockedV1(
  target: Pick<GroupTargetScopeBindingV1, 'calculationStatus' | 'lockedAt'>,
): void {
  if (target.calculationStatus !== 'locked' || target.lockedAt == null) {
    failClosed(
      'wage_scope_frozen_target_unlock_drift',
      'frozen 工资范围绑定的经营目标已解锁或状态漂移',
    );
  }
}

function assertTrustedDataSource(dataSource: DataSource): void {
  if (
    !(dataSource instanceof DataSource) ||
    !dataSource.isInitialized ||
    dataSource.options.type !== 'mysql' ||
    !(dataSource.manager instanceof EntityManager) ||
    dataSource.manager.connection !== dataSource
  ) {
    failClosed('wage_scope_data_source_invalid', '只接受后端注入的已初始化 MySQL TypeORM DataSource');
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
    failClosed('wage_scope_transaction_manager_invalid', '事务连接身份无效');
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
    failClosed('wage_scope_transaction_oracle_unavailable', '无法核验当前事务');
  }
  if (
    rows.length !== 1 ||
    String(rows[0].state ?? '').trim().toUpperCase() !== 'ACTIVE' ||
    canonicalIsolation(rows[0].isolation_level) !== 'REPEATABLE READ' ||
    !['NO', '0'].includes(String(rows[0].autocommit ?? '').trim().toUpperCase())
  ) {
    failClosed('wage_scope_transaction_isolation_invalid', '连接必须是 ACTIVE REPEATABLE READ 非自动提交事务');
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
  return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
}

function rolesForPhase(phase: ScopedWageStatisticsPhaseV1): ReadonlySet<string> {
  return phase === 'draft' || phase === 'submit' ? proposerRoles : checkerRoles;
}

function permissionFor(phase: ScopedWageStatisticsPhaseV1): string {
  if (phase === 'draft') return DRAFT_PERMISSION;
  if (phase === 'submit') return SUBMIT_PERMISSION;
  if (phase === 'freeze') return FREEZE_PERMISSION;
  if (phase === 'supersede') return SUPERSEDE_PERMISSION;
  return DECIDE_PERMISSION;
}

async function lockCurrentActor(
  currentUser: CurrentUser,
  phase: ScopedWageStatisticsPhaseV1,
  manager: EntityManager,
): Promise<LockedActorV1> {
  if (currentUser.identitySource !== 'trusted_proxy') {
    throw new ForbiddenException('[wage_scope_identity_source_invalid] 非可信代理身份被拒绝');
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
    throw new ForbiddenException('[wage_scope_actor_revoked] 当前人员身份已撤销或变化');
  }
  const bindings = await manager.query(
    `SELECT id, role_id FROM user_roles WHERE user_id = ? ORDER BY role_id, id FOR SHARE`,
    [currentUser.id],
  ) as Array<{ id: number; role_id: number }>;
  const roleIds = bindings.map((row) => Number(row.role_id));
  if (roleIds.length !== new Set(roleIds).size) {
    throw new ForbiddenException('[wage_scope_role_binding_duplicate] 正式角色绑定重复');
  }
  const roles = roleIds.length
    ? await manager.query(
        `SELECT id, code FROM roles
          WHERE id IN (${roleIds.map(() => '?').join(',')})
          ORDER BY id FOR SHARE`,
        [...roleIds].sort((left, right) => left - right),
      ) as Array<{ id: number; code: string }>
    : [];
  if (roles.length !== roleIds.length) {
    throw new ForbiddenException('[wage_scope_role_revoked] 正式角色已撤销');
  }
  const roleCodes = roles.map((role) => role.code);
  if (!roleCodes.some((role) => rolesForPhase(phase).has(role))) {
    throw new ForbiddenException('[wage_scope_role_denied] 当前角色无该阶段权限');
  }
  const employees = await manager.query(
    `SELECT id FROM employees
      WHERE linked_user_id = ? AND status = 1
      ORDER BY id FOR SHARE`,
    [currentUser.id],
  ) as Array<{ id: number }>;
  if (employees.length !== 1) {
    throw new ForbiddenException('[wage_scope_employee_binding_invalid] 缺少唯一有效员工绑定');
  }
  return deepFreeze({ userId: currentUser.id, employeeId: Number(employees[0].id), roleCodes });
}

async function loadGroup(groupId: number, manager: EntityManager, lock: boolean): Promise<GroupRowV1> {
  const rows = await manager.query(
    `SELECT id, company_ref AS companyRef,
            business_sector_ref AS businessSectorRef,
            store_ref AS storeRef, status
       FROM organization_groups
      WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [groupId],
  ) as GroupRowV1[];
  if (rows.length !== 1) throw new NotFoundException('[wage_scope_group_missing] 经营组不存在');
  if (rows[0].status !== 'active') failClosed('wage_scope_group_inactive', '经营组不是 active 状态');
  return rows[0];
}

function scopeOf(group: GroupRowV1): GroupScopeV1 {
  return {
    companyRef: group.companyRef,
    businessSectorRef: group.businessSectorRef,
    storeRef: group.storeRef,
    customerRef: null,
  };
}

function assertGroupStable(preview: GroupRowV1, locked: GroupRowV1): void {
  if (
    Number(preview.id) !== Number(locked.id) ||
    preview.companyRef !== locked.companyRef ||
    preview.businessSectorRef !== locked.businessSectorRef ||
    preview.storeRef !== locked.storeRef
  ) {
    failClosed('wage_scope_group_scope_drift', '权限核验前后经营组组织范围发生变化');
  }
}

async function assertScopeGrant(
  actor: LockedActorV1,
  phase: ScopedWageStatisticsPhaseV1,
  scope: GroupScopeV1,
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
  const currentTimestampRows = await manager.query(
    `SELECT CURRENT_TIMESTAMP(6) AS database_current_timestamp`,
  ) as unknown;
  const now = normalizeDatabaseCurrentTimestampRowsV1(currentTimestampRows);
  const matching = grants.filter((grant) => {
    const from = normalizeGrantBoundaryMillisV1(grant.valid_from, false);
    const until = normalizeGrantBoundaryMillisV1(grant.valid_until, true);
    const permissions = normalizePermissions(grant.permissions);
    return (
      from != null &&
      from <= now &&
      (until == null || until >= now) &&
      (permissions.includes('*') || permissions.includes(permissionFor(phase))) &&
      (grant.business_sector_ref == null || grant.business_sector_ref === scope.businessSectorRef) &&
      (grant.store_ref == null || grant.store_ref === scope.storeRef) &&
      (grant.customer_ref == null || grant.customer_ref === scope.customerRef)
    );
  });
  if (matching.some((grant) => grant.effect === 'deny')) {
    throw new ForbiddenException('[wage_scope_scope_denied] 当前经营组范围被明确拒绝');
  }
  if (!matching.some((grant) => grant.effect === 'allow')) {
    throw new ForbiddenException('[wage_scope_scope_missing] 当前经营组范围缺少精确授权');
  }
}

function targetStateOf(row: GroupTargetRowV1): {
  status: ScopedWageStatisticsGroupTargetStatusV1;
  lockedAt: string | null;
} {
  const lockedAt = toIso(row.locked_at);
  if (
    !['calculated', 'calculation_blocked', 'recalculation_required', 'locked'].includes(
      row.calculation_status,
    )
  ) {
    failClosed('wage_scope_target_state_invalid', '经营目标状态不在固定白名单');
  }
  if ((row.calculation_status === 'locked') !== (lockedAt != null)) {
    failClosed('wage_scope_target_lock_state_invalid', '经营目标状态与锁定时间不一致');
  }
  return {
    status: row.calculation_status as ScopedWageStatisticsGroupTargetStatusV1,
    lockedAt,
  };
}

function targetCurrentStateOf(
  row: GroupTargetRowV1,
): Readonly<ScopedWageStatisticsGroupTargetCurrentStateV1> {
  const state = targetStateOf(row);
  return deepFreeze({
    id: positiveMysqlInt(Number(row.id), 'wage_scope_target_invalid', '经营目标 ID'),
    groupId: positiveMysqlInt(Number(row.group_id), 'wage_scope_target_invalid', '经营组 ID'),
    settlementPeriod: settlementPeriod(row.settlement_period),
    calculationVersion: positiveMysqlInt(
      Number(row.calculation_version),
      'wage_scope_target_invalid',
      '经营目标版本',
    ),
    calculationStatus: state.status,
    lockedAt: state.lockedAt,
    requestFingerprint: lowerHash(
      row.request_fingerprint,
      'wage_scope_target_fingerprint_invalid',
      '经营目标请求指纹',
    ),
  });
}

function assertUniqueLatestTargetRows(rows: readonly GroupTargetRowV1[]): void {
  if (!rows.length) throw new NotFoundException('[wage_scope_target_missing] 经营组结算目标不存在');
  if (
    rows.length > 1 &&
    Number(rows[0].calculation_version) === Number(rows[1].calculation_version)
  ) {
    failClosed('wage_scope_target_latest_ambiguous', '经营组结算期存在重复 latest 经营目标版本');
  }
}

export function assertBoundGroupTargetCurrentEligibilityV1(
  bound: Pick<
    GroupTargetScopeBindingV1,
    'id' | 'groupId' | 'settlementPeriod' | 'calculationVersion' | 'requestFingerprint'
  >,
  latest: Readonly<ScopedWageStatisticsGroupTargetCurrentStateV1>,
  authorization: ScopedWageStatisticsGroupTargetAuthorizationV1,
): void {
  if (
    bound.id !== latest.id ||
    bound.groupId !== latest.groupId ||
    bound.settlementPeriod !== latest.settlementPeriod ||
    bound.calculationVersion !== latest.calculationVersion ||
    bound.requestFingerprint !== latest.requestFingerprint
  ) {
    failClosed('wage_scope_target_not_latest', '权威绑定不再是经营组结算期的唯一 latest 目标');
  }
  if (authorization === 'approve') {
    if (!['calculated', 'locked'].includes(latest.calculationStatus)) {
      failClosed('wage_scope_target_not_bindable', '批准时经营目标必须仍为 calculated/locked');
    }
    return;
  }
  assertFrozenGroupTargetBindingStillLockedV1(latest);
}

async function assertBoundGroupTargetCurrentEligibilityInTransactionV1(
  bound: Readonly<GroupTargetScopeBindingV1>,
  manager: EntityManager,
  authorization: ScopedWageStatisticsGroupTargetAuthorizationV1,
): Promise<void> {
  const rows = await manager.query(
    `SELECT id, group_id, settlement_period, calculation_version,
            calculation_status, locked_at, request_fingerprint
       FROM group_targets
      WHERE group_id = ? AND settlement_period = ?
      ORDER BY calculation_version DESC, id DESC
      LIMIT 2 FOR UPDATE`,
    [bound.groupId, bound.settlementPeriod],
  ) as GroupTargetRowV1[];
  assertUniqueLatestTargetRows(rows);
  assertBoundGroupTargetCurrentEligibilityV1(
    bound,
    targetCurrentStateOf(rows[0]),
    authorization,
  );
}

export async function resolveCurrentGroupTargetScopeBindingV1(
  manager: EntityManager,
  groupId: number,
  period: string,
  expectedCalculationVersion: number,
  requiredDomainsHash: string,
): Promise<Readonly<GroupTargetScopeBindingV1>> {
  const rows = await manager.query(
    `SELECT id, group_id, settlement_period, calculation_version,
            calculation_status, locked_at, request_fingerprint
       FROM group_targets
      WHERE group_id = ? AND settlement_period = ?
      ORDER BY calculation_version DESC, id DESC
      LIMIT 2 FOR UPDATE`,
    [groupId, period],
  ) as GroupTargetRowV1[];
  assertUniqueLatestTargetRows(rows);
  const row = rows[0];
  if (Number(row.calculation_version) !== expectedCalculationVersion) {
    failClosed('wage_scope_target_version_stale', '期望版本不是服务端当前经营目标版本');
  }
  const base = targetCurrentStateOf(row);
  if (base.groupId !== groupId || base.settlementPeriod !== period) {
    failClosed('wage_scope_target_scope_mismatch', '经营目标与要求范围不一致');
  }
  if (!['calculated', 'locked'].includes(base.calculationStatus)) {
    failClosed('wage_scope_target_not_bindable', '仅 calculated/locked latest 经营目标可建立工资范围权威');
  }
  return deepFreeze({
    ...base,
    groupTargetScopeHash: deriveGroupTargetScopeHashV1({ ...base, requiredDomainsHash }),
  });
}

async function lockScopeGraph(
  groupId: number,
  period: string,
  actorUserId: number,
  preview: GroupRowV1,
  manager: EntityManager,
): Promise<GroupRowV1> {
  await manager.query(
    `INSERT IGNORE INTO wage_statistics_scope_mutexes
       (group_id, settlement_period, created_by_user_id)
     VALUES (?, ?, ?)`,
    [groupId, period, actorUserId],
  );
  const mutex = await manager.query(
    `SELECT group_id, settlement_period
       FROM wage_statistics_scope_mutexes
      WHERE group_id = ? AND settlement_period = ? FOR UPDATE`,
    [groupId, period],
  ) as Array<{ group_id: number; settlement_period: string }>;
  if (mutex.length !== 1) failClosed('wage_scope_mutex_missing', '范围互斥记录缺失');
  const group = await loadGroup(groupId, manager, true);
  assertGroupStable(preview, group);
  await manager.query(
    `SELECT id, authority_version
       FROM wage_statistics_scope_authorities
      WHERE group_id = ? AND settlement_period = ?
      ORDER BY authority_version, id FOR UPDATE`,
    [groupId, period],
  );
  return group;
}

async function loadAuthorityByRef(
  ref: string,
  manager: EntityManager,
  lock: boolean,
): Promise<AuthorityRowV1> {
  const rows = await manager.query(
    `SELECT id, authority_ref, group_id, settlement_period, authority_version,
            supersedes_authority_id, group_target_id, group_target_calculation_version,
            required_domain_count, required_domains_hash,
            data_completeness_watermark_hash, settlement_complete_domain_count,
            settlement_coverage_status, enterprise_formal_domain_count,
            enterprise_ready_domain_count, enterprise_coverage_status,
            group_target_scope_hash, content_hash, status,
            created_by_user_id, submitted_by_user_id, approved_by_user_id,
            rejected_by_user_id, frozen_by_user_id, superseded_by_user_id
       FROM wage_statistics_scope_authorities
      WHERE authority_ref = ?${lock ? ' FOR UPDATE' : ''}`,
    [ref],
  ) as AuthorityRowV1[];
  if (rows.length !== 1) throw new NotFoundException('[wage_scope_authority_missing] 工资范围权威不存在');
  return rows[0];
}

async function loadDomainLines(
  authorityId: string | number,
  manager: EntityManager,
  lock: boolean,
): Promise<DomainLineRowV1[]> {
  return manager.query(
    `SELECT id, authority_id, group_id, settlement_period, business_domain,
            domain_order, adapter_contract_version, source_cursor, source_cursor_hash,
            data_complete_through_at, unresolved_cost_count, unresolved_refund_count,
            unresolved_attribution_count, unresolved_duplicate_count,
            completeness_status, watermark_hash, line_hash
       FROM wage_statistics_required_domain_lines
      WHERE authority_id = ?
      ORDER BY domain_order, id${lock ? ' FOR UPDATE' : ''}`,
    [authorityId],
  ) as Promise<DomainLineRowV1[]>;
}

function normalizeStoredLines(
  authority: AuthorityRowV1,
  rows: readonly DomainLineRowV1[],
): readonly NormalizedScopedWageStatisticsDomainWatermarkV1[] {
  const lines = rows.map((row, index) => {
    const businessDomain = row.business_domain;
    if (!SCOPED_WAGE_STATISTICS_ALLOWED_DOMAINS.includes(businessDomain)) {
      failClosed('wage_scope_storage_domain_invalid', '持久化业务域不在首批白名单');
    }
    const counts = {
      unresolvedCostCount: nonNegativeMysqlInt(
        Number(row.unresolved_cost_count),
        'wage_scope_storage_count_invalid',
        '未决成本数',
      ),
      unresolvedRefundCount: nonNegativeMysqlInt(
        Number(row.unresolved_refund_count),
        'wage_scope_storage_count_invalid',
        '未决退款数',
      ),
      unresolvedAttributionCount: nonNegativeMysqlInt(
        Number(row.unresolved_attribution_count),
        'wage_scope_storage_count_invalid',
        '未决归因数',
      ),
      unresolvedDuplicateCount: nonNegativeMysqlInt(
        Number(row.unresolved_duplicate_count),
        'wage_scope_storage_count_invalid',
        '未决重复数',
      ),
    };
    const completenessStatus = Object.values(counts).every((count) => count === 0)
      ? 'complete'
      : 'incomplete';
    const dataCompleteThroughAt = toIso(row.data_complete_through_at);
    if (!dataCompleteThroughAt) failClosed('wage_scope_storage_time_invalid', 'watermark 时间缺失');
    assertWatermarkCoversSettlementPeriodV1(
      dataCompleteThroughAt,
      authority.settlement_period,
    );
    if (!SAFE_SOURCE_CURSOR.test(row.source_cursor)) {
      failClosed('wage_scope_storage_cursor_invalid', '持久化 sourceCursor 不符合安全白名单');
    }
    const base = {
      businessDomain,
      domainOrder: positiveMysqlInt(Number(row.domain_order), 'wage_scope_storage_order_invalid', '域顺序'),
      adapterContractVersion: row.adapter_contract_version,
      sourceCursor: row.source_cursor,
      sourceCursorHash: row.source_cursor_hash,
      dataCompleteThroughAt,
      ...counts,
      completenessStatus: completenessStatus as ScopedWageStatisticsCoverageStatusV1,
    };
    const expectedCursorHash = canonicalHash({ businessDomain, sourceCursor: row.source_cursor });
    const expectedWatermarkHash = canonicalHash({
      schemaVersion: SCOPED_WAGE_STATISTICS_SCHEMA_VERSION,
      ruleVersion: SCOPED_WAGE_STATISTICS_RULE_VERSION,
      ...base,
    });
    if (
      Number(row.authority_id) !== Number(authority.id) ||
      Number(row.group_id) !== Number(authority.group_id) ||
      row.settlement_period !== authority.settlement_period ||
      base.domainOrder !== index + 1 ||
      row.completeness_status !== completenessStatus ||
      row.source_cursor_hash !== expectedCursorHash ||
      row.watermark_hash !== expectedWatermarkHash ||
      row.line_hash !== canonicalHash({ ...base, watermarkHash: expectedWatermarkHash })
    ) {
      failClosed('wage_scope_line_hash_mismatch', 'required domain line 图或哈希不一致');
    }
    return deepFreeze({ ...base, watermarkHash: expectedWatermarkHash, lineHash: row.line_hash });
  });
  if (lines.length !== Number(authority.required_domain_count)) {
    failClosed('wage_scope_line_count_mismatch', 'required domain line 数量不一致');
  }
  return deepFreeze(lines);
}

function canonicalAuthorityContent(input: {
  groupId: number;
  settlementPeriod: string;
  authorityVersion: number;
  supersedesAuthorityRef: string | null;
  target: GroupTargetScopeBindingV1;
  requiredDomainsHash: string;
  dataCompletenessWatermarkHash: string;
  lines: readonly NormalizedScopedWageStatisticsDomainWatermarkV1[];
  coverage: ScopedWageStatisticsCoverageSnapshotV1;
}): Record<string, unknown> {
  return {
    schemaVersion: SCOPED_WAGE_STATISTICS_SCHEMA_VERSION,
    ruleVersion: SCOPED_WAGE_STATISTICS_RULE_VERSION,
    groupId: input.groupId,
    settlementPeriod: input.settlementPeriod,
    authorityVersion: input.authorityVersion,
    supersedesAuthorityRef: input.supersedesAuthorityRef,
    groupTargetId: input.target.id,
    groupTargetCalculationVersion: input.target.calculationVersion,
    groupTargetScopeHash: input.target.groupTargetScopeHash,
    requiredDomainsHash: input.requiredDomainsHash,
    dataCompletenessWatermarkHash: input.dataCompletenessWatermarkHash,
    lines: input.lines.map((line) => ({
      businessDomain: line.businessDomain,
      domainOrder: line.domainOrder,
      lineHash: line.lineHash,
    })),
    settlementCompleteDomainCount: input.coverage.settlementCompleteDomainCount,
    settlementCoverageStatus: input.coverage.settlementCoverageStatus,
    enterpriseFormalDomainCount: input.coverage.enterpriseFormalDomainCount,
    enterpriseReadyDomainCount: input.coverage.enterpriseReadyDomainCount,
    enterpriseCoverageStatus: input.coverage.enterpriseCoverageStatus,
  };
}

function assertExpectedAuthority(
  row: AuthorityRowV1,
  expectedVersion: number,
  expectedContentHash: string,
): void {
  if (Number(row.authority_version) !== expectedVersion || row.content_hash !== expectedContentHash) {
    failClosed('wage_scope_authority_stale', '权威版本或内容哈希已变化');
  }
}

function storedCoverageSnapshot(
  authority: AuthorityRowV1,
  lines: readonly NormalizedScopedWageStatisticsDomainWatermarkV1[],
): Readonly<ScopedWageStatisticsCoverageSnapshotV1> {
  const requiredDomainCount = Number(authority.required_domain_count);
  const dataCompleteDomainCount = lines.filter(
    (line) => line.completenessStatus === 'complete',
  ).length;
  const settlementCompleteDomainCount = Number(authority.settlement_complete_domain_count);
  const enterpriseFormalDomainCount = Number(authority.enterprise_formal_domain_count);
  const enterpriseReadyDomainCount = Number(authority.enterprise_ready_domain_count);
  const settlementStatusValid =
    (authority.settlement_coverage_status === 'complete' &&
      settlementCompleteDomainCount === requiredDomainCount) ||
    (authority.settlement_coverage_status === 'incomplete' &&
      settlementCompleteDomainCount < requiredDomainCount);
  const enterpriseStatusValid =
    (authority.enterprise_coverage_status === 'complete' && enterpriseReadyDomainCount === 4) ||
    (authority.enterprise_coverage_status === 'incomplete' && enterpriseReadyDomainCount < 4);
  if (
    requiredDomainCount !== lines.length ||
    requiredDomainCount < 1 ||
    requiredDomainCount > 2 ||
    settlementCompleteDomainCount < 0 ||
    settlementCompleteDomainCount > dataCompleteDomainCount ||
    !settlementStatusValid ||
    enterpriseFormalDomainCount !== 4 ||
    enterpriseReadyDomainCount < 0 ||
    enterpriseReadyDomainCount > 4 ||
    !enterpriseStatusValid
  ) {
    failClosed('wage_scope_stored_coverage_invalid', '持久化双层覆盖快照结构不一致');
  }
  return deepFreeze({
    requiredDomainCount,
    dataCompleteDomainCount,
    settlementCompleteDomainCount,
    settlementCoverageStatus: authority.settlement_coverage_status,
    enterpriseFormalDomainCount: 4 as const,
    enterpriseReadyDomainCount,
    enterpriseCoverageStatus: authority.enterprise_coverage_status,
  });
}

async function verifyAuthorityGraph(
  authority: AuthorityRowV1,
  manager: EntityManager,
  lock: boolean,
): Promise<VerifiedScopedWageStatisticsAuthorityGraphV1> {
  const lines = normalizeStoredLines(authority, await loadDomainLines(authority.id, manager, lock));
  const domains = deepFreeze(lines.map((line) => line.businessDomain));
  const requiredDomainsHash = canonicalHash({
    ruleVersion: SCOPED_WAGE_STATISTICS_RULE_VERSION,
    requiredBusinessDomains: domains,
  });
  const watermarkHash = canonicalHash({
    schemaVersion: SCOPED_WAGE_STATISTICS_SCHEMA_VERSION,
    settlementPeriod: authority.settlement_period,
    watermarks: lines.map((line) => ({
      businessDomain: line.businessDomain,
      watermarkHash: line.watermarkHash,
    })),
  });
  if (
    requiredDomainsHash !== authority.required_domains_hash ||
    watermarkHash !== authority.data_completeness_watermark_hash
  ) {
    failClosed('wage_scope_authority_hash_mismatch', '权威范围或 watermark 聚合哈希不一致');
  }
  const targetRows = await manager.query(
    `SELECT id, group_id, settlement_period, calculation_version,
            calculation_status, locked_at, request_fingerprint
       FROM group_targets
      WHERE id = ? AND group_id = ? AND settlement_period = ?
        AND calculation_version = ?${lock ? ' FOR UPDATE' : ''}`,
    [
      authority.group_target_id,
      authority.group_id,
      authority.settlement_period,
      authority.group_target_calculation_version,
    ],
  ) as GroupTargetRowV1[];
  if (targetRows.length !== 1) failClosed('wage_scope_target_binding_missing', '经营目标精确绑定缺失');
  const targetRow = targetRows[0];
  const targetBase = targetCurrentStateOf(targetRow);
  const target = deepFreeze({
    ...targetBase,
    groupTargetScopeHash: deriveGroupTargetScopeHashV1({
      ...targetBase,
      requiredDomainsHash,
    }),
  });
  if (target.groupTargetScopeHash !== authority.group_target_scope_hash) {
    failClosed('wage_scope_target_scope_hash_mismatch', '经营目标范围绑定哈希不一致');
  }
  const coverage = storedCoverageSnapshot(authority, lines);
  const currentCoverage = evaluateScopedWageStatisticsDualCoverageV1(domains, lines);
  const supersedesRef = authority.supersedes_authority_id == null
    ? null
    : (await manager.query(
        `SELECT authority_ref FROM wage_statistics_scope_authorities WHERE id = ?`,
        [authority.supersedes_authority_id],
      ) as Array<{ authority_ref: string }>)[0]?.authority_ref ?? null;
  const expectedContentHash = canonicalHash(
    canonicalAuthorityContent({
      groupId: Number(authority.group_id),
      settlementPeriod: authority.settlement_period,
      authorityVersion: Number(authority.authority_version),
      supersedesAuthorityRef: supersedesRef,
      target,
      requiredDomainsHash,
      dataCompletenessWatermarkHash: watermarkHash,
      lines,
      coverage,
    }),
  );
  if (expectedContentHash !== authority.content_hash) {
    failClosed('wage_scope_content_hash_mismatch', '权威内容哈希不一致');
  }
  return { lines, domains, target, coverage, currentCoverage };
}

function isDuplicate(error: unknown): boolean {
  const candidate = error as { code?: unknown; errno?: unknown };
  return candidate?.code === 'ER_DUP_ENTRY' || Number(candidate?.errno) === 1062;
}

function mapStorageFailure(error: unknown): never {
  const candidate = error as { code?: unknown; errno?: unknown };
  if (isDuplicate(error)) failClosed('wage_scope_storage_conflict', '权威与当前不可变约束冲突');
  if (
    candidate?.code === 'ER_LOCK_WAIT_TIMEOUT' ||
    Number(candidate?.errno) === 1205 ||
    candidate?.code === 'ER_LOCK_DEADLOCK' ||
    Number(candidate?.errno) === 1213
  ) {
    failClosed('wage_scope_contention', '工资范围权威正被其他事务处理，请重试');
  }
  throw error;
}

async function claimIdempotency(
  phase: ScopedWageStatisticsPhaseV1,
  key: string,
  fingerprint: string,
  actorUserId: number,
  manager: EntityManager,
): Promise<void> {
  try {
    await manager.query(
      `INSERT INTO wage_statistics_scope_idempotency_claims
         (idempotency_key, phase, request_fingerprint, actor_user_id, state)
       VALUES (?, ?, ?, ?, 'claimed')`,
      [key, phase, fingerprint, actorUserId],
    );
  } catch (error) {
    if (isDuplicate(error)) throw new WageScopeIdempotencyRaceV1(phase, key, fingerprint);
    throw error;
  }
}

async function completeClaim(
  key: string,
  authorityId: string | number,
  eventId: string | number,
  manager: EntityManager,
): Promise<void> {
  const result = await manager.query(
    `UPDATE wage_statistics_scope_idempotency_claims
        SET state = 'completed', authority_id = ?, lifecycle_event_id = ?,
            completed_at = CURRENT_TIMESTAMP(6)
      WHERE idempotency_key = ? AND state = 'claimed'
        AND authority_id IS NULL AND lifecycle_event_id IS NULL`,
    [authorityId, eventId, key],
  );
  if (Number(result?.affectedRows ?? -1) !== 1) {
    failClosed('wage_scope_idempotency_completion_failed', '幂等结果无法完整封存');
  }
}

async function appendEvent(
  authority: AuthorityRowV1,
  eventType: 'drafted' | 'submitted' | 'approved' | 'rejected' | 'frozen' | 'superseded',
  fromStatus: ScopedWageStatisticsAuthorityStatusV1 | null,
  toStatus: ScopedWageStatisticsAuthorityStatusV1,
  actor: LockedActorV1,
  reasonCode: string,
  evidence: { evidenceRef: string; evidenceHash: string; requestFingerprint: string },
  manager: EntityManager,
): Promise<string | number> {
  const eventRef = canonicalHash({
    schemaVersion: SCOPED_WAGE_STATISTICS_SCHEMA_VERSION,
    authorityRef: authority.authority_ref,
    eventType,
    fromStatus,
    toStatus,
    actorUserId: actor.userId,
    reasonCode,
    requestFingerprint: evidence.requestFingerprint,
  });
  const result = await manager.query(
    `INSERT INTO wage_statistics_scope_lifecycle_events
       (event_ref, authority_id, event_type, from_status, to_status,
        actor_user_id, reason_code, evidence_ref, evidence_hash,
        request_fingerprint, authority_content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventRef,
      authority.id,
      eventType,
      fromStatus,
      toStatus,
      actor.userId,
      reasonCode,
      evidence.evidenceRef,
      evidence.evidenceHash,
      evidence.requestFingerprint,
      authority.content_hash,
    ],
  );
  const eventId = result?.insertId;
  if (eventId == null) failClosed('wage_scope_event_insert_failed', '生命周期事件写入失败');
  return eventId as string | number;
}

async function receiptFor(
  authority: AuthorityRowV1,
  manager: EntityManager,
  status: ScopedWageStatisticsAuthorityStatusV1 = authority.status,
  verifiedGraph?: VerifiedScopedWageStatisticsAuthorityGraphV1,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  const graph = verifiedGraph ?? await verifyAuthorityGraph(authority, manager, false);
  const refs = authority.supersedes_authority_id == null
    ? []
    : await manager.query(
        `SELECT authority_ref FROM wage_statistics_scope_authorities WHERE id = ?`,
        [authority.supersedes_authority_id],
      ) as Array<{ authority_ref: string }>;
  const supersededAuthorityRef =
    ['approved', 'frozen', 'superseded'].includes(status) && refs.length === 1
      ? refs[0].authority_ref
      : null;
  return deepFreeze({
    schemaVersion: SCOPED_WAGE_STATISTICS_SCHEMA_VERSION,
    ruleVersion: SCOPED_WAGE_STATISTICS_RULE_VERSION,
    authorityRef: authority.authority_ref,
    authorityVersion: Number(authority.authority_version),
    status,
    groupRef: `group:${Number(authority.group_id)}`,
    settlementPeriod: authority.settlement_period,
    groupTargetId: Number(authority.group_target_id),
    groupTargetCalculationVersion: Number(authority.group_target_calculation_version),
    groupTargetScopeHash: authority.group_target_scope_hash,
    requiredBusinessDomains: graph.domains,
    requiredDomainsHash: authority.required_domains_hash,
    dataCompletenessWatermarkHash: authority.data_completeness_watermark_hash,
    contentHash: authority.content_hash,
    coverage: graph.coverage,
    currentCoverage: graph.currentCoverage,
    supersedesAuthorityRef: refs[0]?.authority_ref ?? null,
    supersededAuthorityRef,
  });
}

async function replayCompletedClaim(
  dataSource: DataSource,
  currentUser: CurrentUser,
  phase: ScopedWageStatisticsPhaseV1,
  key: string,
  fingerprint: string,
  expectedEvidenceRef: string,
  expectedEvidenceHash: string,
  expectedAuthorityRef: string | null,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, phase, manager);
    const rows = await manager.query(
      `SELECT phase, request_fingerprint, actor_user_id, state,
              authority_id, lifecycle_event_id
         FROM wage_statistics_scope_idempotency_claims
        WHERE idempotency_key = ? FOR UPDATE`,
      [key],
    ) as ClaimRowV1[];
    if (rows.length !== 1) failClosed('wage_scope_idempotency_winner_missing', '幂等结果缺失');
    const claim = rows[0];
    if (
      claim.phase !== phase ||
      claim.request_fingerprint !== fingerprint ||
      Number(claim.actor_user_id) !== actor.userId
    ) {
      failClosed('wage_scope_idempotency_conflict', '幂等键已绑定其他请求或人员');
    }
    if (claim.state !== 'completed' || claim.authority_id == null || claim.lifecycle_event_id == null) {
      failClosed('wage_scope_idempotency_incomplete', '幂等结果尚未完整提交');
    }
    const authority = await loadAuthorityById(claim.authority_id, manager, false);
    if (expectedAuthorityRef != null && authority.authority_ref !== expectedAuthorityRef) {
      failClosed('wage_scope_idempotency_graph_corrupt', '幂等结果指向其他权威');
    }
    const group = await loadGroup(Number(authority.group_id), manager, false);
    await assertScopeGrant(actor, phase, scopeOf(group), manager);
    const eventRows = await manager.query(
      `SELECT id, event_ref, authority_id, event_type, from_status, to_status,
              actor_user_id, reason_code, evidence_ref, evidence_hash,
              request_fingerprint, authority_content_hash
         FROM wage_statistics_scope_lifecycle_events
        WHERE id = ? FOR UPDATE`,
      [claim.lifecycle_event_id],
    ) as LifecycleEventRowV1[];
    const expectedEvent = phase === 'draft'
      ? { eventType: 'drafted', fromStatus: null, toStatus: 'draft', reasonCode: 'scope_drafted' }
      : phase === 'submit'
        ? { eventType: 'submitted', fromStatus: 'draft', toStatus: 'submitted', reasonCode: 'scope_submitted' }
        : phase === 'approve'
          ? { eventType: 'approved', fromStatus: 'submitted', toStatus: 'approved', reasonCode: 'scope_verified' }
          : phase === 'reject'
            ? { eventType: 'rejected', fromStatus: 'submitted', toStatus: 'rejected', reasonCode: 'scope_rejected' }
            : phase === 'freeze'
              ? { eventType: 'frozen', fromStatus: 'approved', toStatus: 'frozen', reasonCode: 'settlement_scope_frozen' }
              : { eventType: 'approved', fromStatus: 'submitted', toStatus: 'approved', reasonCode: 'scope_replacement_verified' };
    const event = eventRows[0];
    const expectedEventRef = event == null
      ? ''
      : canonicalHash({
          schemaVersion: SCOPED_WAGE_STATISTICS_SCHEMA_VERSION,
          authorityRef: authority.authority_ref,
          eventType: expectedEvent.eventType,
          fromStatus: expectedEvent.fromStatus,
          toStatus: expectedEvent.toStatus,
          actorUserId: actor.userId,
          reasonCode: expectedEvent.reasonCode,
          requestFingerprint: fingerprint,
        });
    if (
      eventRows.length !== 1 ||
      Number(event.authority_id) !== Number(authority.id) ||
      event.event_ref !== expectedEventRef ||
      event.event_type !== expectedEvent.eventType ||
      event.from_status !== expectedEvent.fromStatus ||
      event.to_status !== expectedEvent.toStatus ||
      Number(event.actor_user_id) !== actor.userId ||
      event.reason_code !== expectedEvent.reasonCode ||
      event.evidence_ref !== expectedEvidenceRef ||
      event.evidence_hash !== expectedEvidenceHash ||
      event.request_fingerprint !== fingerprint ||
      event.authority_content_hash !== authority.content_hash
    ) {
      failClosed('wage_scope_idempotency_graph_corrupt', '幂等生命周期事件与权威结果不一致');
    }
    const maker = Number(authority.created_by_user_id);
    const submitter = Number(authority.submitted_by_user_id);
    const actorMatches = phase === 'draft'
      ? maker === actor.userId
      : phase === 'submit'
        ? maker === actor.userId && submitter === actor.userId
        : phase === 'approve' || phase === 'supersede'
          ? Number(authority.approved_by_user_id) === actor.userId &&
            maker !== actor.userId && submitter !== actor.userId
          : phase === 'reject'
            ? Number(authority.rejected_by_user_id) === actor.userId &&
              maker !== actor.userId && submitter !== actor.userId
            : Number(authority.frozen_by_user_id) === actor.userId &&
              maker !== actor.userId && submitter !== actor.userId;
    if (!actorMatches) {
      failClosed('wage_scope_idempotency_graph_corrupt', '幂等权威 maker-checker 图不一致');
    }
    const allowedCurrentStatuses: Readonly<
      Record<ScopedWageStatisticsPhaseV1, readonly ScopedWageStatisticsAuthorityStatusV1[]>
    > = {
      draft: ['draft', 'submitted', 'approved', 'rejected', 'frozen', 'superseded'],
      submit: ['submitted', 'approved', 'rejected', 'frozen', 'superseded'],
      approve: ['approved', 'frozen', 'superseded'],
      reject: ['rejected'],
      freeze: ['frozen', 'superseded'],
      supersede: ['approved', 'frozen', 'superseded'],
    };
    if (!allowedCurrentStatuses[phase].includes(authority.status)) {
      failClosed('wage_scope_idempotency_graph_corrupt', '幂等结果生命周期不一致');
    }
    if (phase === 'supersede') {
      if (authority.supersedes_authority_id == null) {
        failClosed('wage_scope_idempotency_graph_corrupt', '替代权威缺少原权威绑定');
      }
      const previous = await loadAuthorityById(authority.supersedes_authority_id, manager, true);
      await verifyAuthorityGraph(previous, manager, true);
      const previousEvents = await manager.query(
        `SELECT id, event_ref, authority_id, event_type, from_status, to_status,
                actor_user_id, reason_code, evidence_ref, evidence_hash,
                request_fingerprint, authority_content_hash
           FROM wage_statistics_scope_lifecycle_events
          WHERE authority_id = ? AND event_type = 'superseded'
            AND request_fingerprint = ? FOR UPDATE`,
        [previous.id, fingerprint],
      ) as LifecycleEventRowV1[];
      const previousEvent = previousEvents[0];
      const expectedPreviousEventRef = previousEvent == null
        ? ''
        : canonicalHash({
            schemaVersion: SCOPED_WAGE_STATISTICS_SCHEMA_VERSION,
            authorityRef: previous.authority_ref,
            eventType: 'superseded',
            fromStatus: previousEvent.from_status,
            toStatus: 'superseded',
            actorUserId: actor.userId,
            reasonCode: 'scope_replaced',
            requestFingerprint: fingerprint,
          });
      if (
        previous.status !== 'superseded' ||
        Number(previous.superseded_by_user_id) !== actor.userId ||
        previousEvents.length !== 1 ||
        previousEvent.event_ref !== expectedPreviousEventRef ||
        previousEvent.to_status !== 'superseded' ||
        !['approved', 'frozen'].includes(String(previousEvent.from_status)) ||
        Number(previousEvent.actor_user_id) !== actor.userId ||
        previousEvent.reason_code !== 'scope_replaced' ||
        previousEvent.evidence_ref !== expectedEvidenceRef ||
        previousEvent.evidence_hash !== expectedEvidenceHash ||
        previousEvent.authority_content_hash !== previous.content_hash
      ) {
        failClosed('wage_scope_idempotency_graph_corrupt', '原子替代事件图不完整');
      }
    }
    return receiptFor(authority, manager, expectedEvent.toStatus as ScopedWageStatisticsAuthorityStatusV1);
  });
}

async function loadAuthorityById(
  id: string | number,
  manager: EntityManager,
  lock: boolean,
): Promise<AuthorityRowV1> {
  const rows = await manager.query(
    `SELECT id, authority_ref, group_id, settlement_period, authority_version,
            supersedes_authority_id, group_target_id, group_target_calculation_version,
            required_domain_count, required_domains_hash,
            data_completeness_watermark_hash, settlement_complete_domain_count,
            settlement_coverage_status, enterprise_formal_domain_count,
            enterprise_ready_domain_count, enterprise_coverage_status,
            group_target_scope_hash, content_hash, status,
            created_by_user_id, submitted_by_user_id, approved_by_user_id,
            rejected_by_user_id, frozen_by_user_id, superseded_by_user_id
       FROM wage_statistics_scope_authorities
      WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
    [id],
  ) as AuthorityRowV1[];
  if (rows.length !== 1) failClosed('wage_scope_authority_missing', '工资范围权威不存在');
  return rows[0];
}

async function prepareAuthorizedGraph(
  authorityRefValue: string,
  actor: LockedActorV1,
  phase: ScopedWageStatisticsPhaseV1,
  manager: EntityManager,
): Promise<{ authority: AuthorityRowV1; preview: GroupRowV1 }> {
  const previewAuthority = await loadAuthorityByRef(authorityRefValue, manager, false);
  const preview = await loadGroup(Number(previewAuthority.group_id), manager, false);
  await assertScopeGrant(actor, phase, scopeOf(preview), manager);
  await lockScopeGraph(
    Number(previewAuthority.group_id),
    previewAuthority.settlement_period,
    actor.userId,
    preview,
    manager,
  );
  const authority = await loadAuthorityByRef(authorityRefValue, manager, true);
  if (
    Number(authority.group_id) !== Number(previewAuthority.group_id) ||
    authority.settlement_period !== previewAuthority.settlement_period
  ) {
    failClosed('wage_scope_authority_scope_drift', '权威范围在授权期间发生变化');
  }
  return { authority, preview };
}

async function runDraft(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedDraftScopedWageStatisticsAuthorityV1>,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, 'draft', manager);
    const preview = await loadGroup(normalized.groupId, manager, false);
    await assertScopeGrant(actor, 'draft', scopeOf(preview), manager);
    await claimIdempotency(
      'draft',
      normalized.idempotencyKey,
      normalized.requestFingerprint,
      actor.userId,
      manager,
    );
    await lockScopeGraph(
      normalized.groupId,
      normalized.settlementPeriod,
      actor.userId,
      preview,
      manager,
    );
    const target = await resolveCurrentGroupTargetScopeBindingV1(
      manager,
      normalized.groupId,
      normalized.settlementPeriod,
      normalized.expectedGroupTargetCalculationVersion,
      normalized.requiredDomainsHash,
    );
    const open = await manager.query(
      `SELECT id FROM wage_statistics_scope_authorities
        WHERE group_id = ? AND settlement_period = ?
          AND status IN ('draft', 'submitted') FOR UPDATE`,
      [normalized.groupId, normalized.settlementPeriod],
    ) as Array<{ id: string | number }>;
    if (open.length) failClosed('wage_scope_open_authority_exists', '同一经营组结算期已有待处理权威');

    let supersedes: AuthorityRowV1 | null = null;
    let previousLines: readonly NormalizedScopedWageStatisticsDomainWatermarkV1[] = [];
    if (normalized.supersedesAuthorityRef) {
      supersedes = await loadAuthorityByRef(normalized.supersedesAuthorityRef, manager, true);
      if (
        Number(supersedes.group_id) !== normalized.groupId ||
        supersedes.settlement_period !== normalized.settlementPeriod ||
        !['approved', 'frozen'].includes(supersedes.status) ||
        Number(supersedes.authority_version) !== normalized.expectedSupersededAuthorityVersion
      ) {
        failClosed('wage_scope_superseded_authority_invalid', '被替代权威不属于同一 active 范围或版本不符');
      }
      previousLines = (await verifyAuthorityGraph(supersedes, manager, true)).lines;
      const previousTargetRows = await manager.query(
        `SELECT id, group_id, settlement_period, calculation_version,
                calculation_status, locked_at, request_fingerprint
           FROM group_targets WHERE id = ? FOR UPDATE`,
        [supersedes.group_target_id],
      ) as GroupTargetRowV1[];
      if (previousTargetRows.length !== 1) failClosed('wage_scope_previous_target_missing', '原经营目标缺失');
      assertNoFrozenOrLockedScopeShrinkV1(
        previousLines.map((line) => line.businessDomain),
        normalized.requiredBusinessDomains,
        supersedes.status,
        previousTargetRows[0].calculation_status,
        toIso(previousTargetRows[0].locked_at),
      );
    } else {
      const active = await manager.query(
        `SELECT id FROM wage_statistics_scope_authorities
          WHERE group_id = ? AND settlement_period = ?
            AND status IN ('approved', 'frozen') FOR UPDATE`,
        [normalized.groupId, normalized.settlementPeriod],
      ) as Array<{ id: string | number }>;
      if (active.length) failClosed('wage_scope_supersedes_required', '已有 active 权威，必须显式版本化替代');
    }
    const versionRows = await manager.query(
      `SELECT authority_version
         FROM wage_statistics_scope_authorities
        WHERE group_id = ? AND settlement_period = ?
        ORDER BY authority_version DESC, id DESC LIMIT 1 FOR UPDATE`,
      [normalized.groupId, normalized.settlementPeriod],
    ) as Array<{ authority_version: string | number }>;
    const authorityVersion = Number(versionRows[0]?.authority_version ?? 0) + 1;
    const coverage = evaluateScopedWageStatisticsDualCoverageV1(
      normalized.requiredBusinessDomains,
      normalized.domainWatermarks,
    );
    const contentHash = canonicalHash(
      canonicalAuthorityContent({
        groupId: normalized.groupId,
        settlementPeriod: normalized.settlementPeriod,
        authorityVersion,
        supersedesAuthorityRef: normalized.supersedesAuthorityRef,
        target,
        requiredDomainsHash: normalized.requiredDomainsHash,
        dataCompletenessWatermarkHash: normalized.dataCompletenessWatermarkHash,
        lines: normalized.domainWatermarks,
        coverage,
      }),
    );
    const ref = randomBytes(32).toString('hex');
    let inserted: { insertId?: string | number };
    try {
      inserted = await manager.query(
        `INSERT INTO wage_statistics_scope_authorities
           (authority_ref, group_id, settlement_period, authority_version,
            supersedes_authority_id, group_target_id, group_target_calculation_version,
            required_domain_count, required_domains_hash,
            data_completeness_watermark_hash, settlement_complete_domain_count,
            settlement_coverage_status, enterprise_formal_domain_count,
            enterprise_ready_domain_count, enterprise_coverage_status,
            group_target_scope_hash, content_hash, status, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
        [
          ref,
          normalized.groupId,
          normalized.settlementPeriod,
          authorityVersion,
          supersedes?.id ?? null,
          target.id,
          target.calculationVersion,
          coverage.requiredDomainCount,
          normalized.requiredDomainsHash,
          normalized.dataCompletenessWatermarkHash,
          coverage.settlementCompleteDomainCount,
          coverage.settlementCoverageStatus,
          coverage.enterpriseFormalDomainCount,
          coverage.enterpriseReadyDomainCount,
          coverage.enterpriseCoverageStatus,
          target.groupTargetScopeHash,
          contentHash,
          actor.userId,
        ],
      );
    } catch (error) {
      mapStorageFailure(error);
    }
    if (inserted.insertId == null) failClosed('wage_scope_authority_insert_failed', '权威写入失败');
    const authorityId = inserted.insertId;
    for (const line of normalized.domainWatermarks) {
      await manager.query(
        `INSERT INTO wage_statistics_required_domain_lines
           (authority_id, group_id, settlement_period, business_domain, domain_order,
            adapter_contract_version, source_cursor, source_cursor_hash,
            data_complete_through_at, unresolved_cost_count, unresolved_refund_count,
            unresolved_attribution_count, unresolved_duplicate_count,
            completeness_status, watermark_hash, line_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          authorityId,
          normalized.groupId,
          normalized.settlementPeriod,
          line.businessDomain,
          line.domainOrder,
          line.adapterContractVersion,
          line.sourceCursor,
          line.sourceCursorHash,
          mysqlDateParameterFromUtcInstantV1(line.dataCompleteThroughAt),
          line.unresolvedCostCount,
          line.unresolvedRefundCount,
          line.unresolvedAttributionCount,
          line.unresolvedDuplicateCount,
          line.completenessStatus,
          line.watermarkHash,
          line.lineHash,
        ],
      );
    }
    const authority = await loadAuthorityById(authorityId, manager, true);
    const eventId = await appendEvent(
      authority,
      'drafted',
      null,
      'draft',
      actor,
      'scope_drafted',
      normalized,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, authority.id, eventId, manager);
    return receiptFor(authority, manager);
  });
}

async function runSubmit(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedAuthorityActionV1>,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, 'submit', manager);
    const { authority } = await prepareAuthorizedGraph(normalized.authorityRef, actor, 'submit', manager);
    await claimIdempotency(
      'submit',
      normalized.idempotencyKey,
      normalized.requestFingerprint,
      actor.userId,
      manager,
    );
    assertExpectedAuthority(authority, normalized.expectedAuthorityVersion, normalized.expectedContentHash);
    await verifyAuthorityGraph(authority, manager, true);
    if (authority.status !== 'draft') failClosed('wage_scope_submit_state_invalid', '仅 draft 可提交');
    if (Number(authority.created_by_user_id) !== actor.userId) {
      throw new ForbiddenException('[wage_scope_maker_mismatch] 起草人与提交人必须是同一 maker');
    }
    const result = await manager.query(
      `UPDATE wage_statistics_scope_authorities
          SET status = 'submitted', submitted_by_user_id = ?,
              submitted_at = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status = 'draft' AND submitted_by_user_id IS NULL`,
      [actor.userId, authority.id],
    );
    if (Number(result?.affectedRows ?? -1) !== 1) failClosed('wage_scope_submit_race', '提交状态竞争');
    authority.status = 'submitted';
    authority.submitted_by_user_id = actor.userId;
    const eventId = await appendEvent(
      authority,
      'submitted',
      'draft',
      'submitted',
      actor,
      'scope_submitted',
      normalized,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, authority.id, eventId, manager);
    return receiptFor(authority, manager);
  });
}

async function runDecision(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedDecisionV1>,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  const phase = normalized.decision === 'approve' ? 'approve' : 'reject';
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, phase, manager);
    const { authority } = await prepareAuthorizedGraph(normalized.authorityRef, actor, phase, manager);
    await claimIdempotency(
      phase,
      normalized.idempotencyKey,
      normalized.requestFingerprint,
      actor.userId,
      manager,
    );
    assertExpectedAuthority(authority, normalized.expectedAuthorityVersion, normalized.expectedContentHash);
    const graph = await verifyAuthorityGraph(authority, manager, true);
    if (authority.status !== 'submitted') failClosed('wage_scope_decision_state_invalid', '仅 submitted 可决策');
    if (
      Number(authority.created_by_user_id) === actor.userId ||
      Number(authority.submitted_by_user_id) === actor.userId
    ) {
      throw new ForbiddenException('[wage_scope_maker_checker_same] checker 必须与 creator/submitter 不同');
    }
    if (normalized.decision === 'approve' && authority.supersedes_authority_id != null) {
      failClosed('wage_scope_replacement_requires_supersede', '替代版本必须使用原子 supersede 动作批准');
    }
    if (normalized.decision === 'approve') {
      await assertBoundGroupTargetCurrentEligibilityInTransactionV1(
        graph.target,
        manager,
        'approve',
      );
      assertCurrentScopedCoverageMatchesSnapshotV1(graph.coverage, graph.currentCoverage);
      const active = await manager.query(
        `SELECT id FROM wage_statistics_scope_authorities
          WHERE group_id = ? AND settlement_period = ?
            AND status IN ('approved', 'frozen') FOR UPDATE`,
        [authority.group_id, authority.settlement_period],
      ) as Array<{ id: string | number }>;
      if (active.length) failClosed('wage_scope_active_authority_exists', '同范围已有 active 权威');
    }
    const targetStatus = normalized.decision === 'approve' ? 'approved' : 'rejected';
    const actorColumn = normalized.decision === 'approve' ? 'approved_by_user_id' : 'rejected_by_user_id';
    const timeColumn = normalized.decision === 'approve' ? 'approved_at' : 'rejected_at';
    const result = await manager.query(
      `UPDATE wage_statistics_scope_authorities
          SET status = ?, ${actorColumn} = ?, ${timeColumn} = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status = 'submitted' AND ${actorColumn} IS NULL`,
      [targetStatus, actor.userId, authority.id],
    );
    if (Number(result?.affectedRows ?? -1) !== 1) failClosed('wage_scope_decision_race', '决策状态竞争');
    authority.status = targetStatus;
    if (normalized.decision === 'approve') authority.approved_by_user_id = actor.userId;
    else authority.rejected_by_user_id = actor.userId;
    const eventId = await appendEvent(
      authority,
      normalized.decision === 'approve' ? 'approved' : 'rejected',
      'submitted',
      targetStatus,
      actor,
      normalized.reasonCode,
      normalized,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, authority.id, eventId, manager);
    return receiptFor(authority, manager);
  });
}

async function runFreeze(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedFreezeV1>,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, 'freeze', manager);
    const { authority } = await prepareAuthorizedGraph(normalized.authorityRef, actor, 'freeze', manager);
    await claimIdempotency(
      'freeze',
      normalized.idempotencyKey,
      normalized.requestFingerprint,
      actor.userId,
      manager,
    );
    assertExpectedAuthority(authority, normalized.expectedAuthorityVersion, normalized.expectedContentHash);
    const graph = await verifyAuthorityGraph(authority, manager, true);
    if (authority.status !== 'approved') failClosed('wage_scope_freeze_state_invalid', '仅 approved 可冻结');
    await assertBoundGroupTargetCurrentEligibilityInTransactionV1(
      graph.target,
      manager,
      'freeze',
    );
    assertCurrentScopedCoverageMatchesSnapshotV1(graph.coverage, graph.currentCoverage);
    if (
      graph.currentCoverage.settlementCoverageStatus !== 'complete' ||
      !isScopedWageStatisticsCoverageReadyV1(graph.currentCoverage)
    ) {
      failClosed('wage_scope_coverage_incomplete', '本组 requiredBusinessDomains 覆盖未完成，禁止冻结');
    }
    if (
      Number(authority.created_by_user_id) === actor.userId ||
      Number(authority.submitted_by_user_id) === actor.userId
    ) {
      throw new ForbiddenException('[wage_scope_maker_checker_same] freezer 必须与 maker 不同');
    }
    const result = await manager.query(
      `UPDATE wage_statistics_scope_authorities
          SET status = 'frozen', frozen_by_user_id = ?, frozen_at = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status = 'approved' AND frozen_by_user_id IS NULL`,
      [actor.userId, authority.id],
    );
    if (Number(result?.affectedRows ?? -1) !== 1) failClosed('wage_scope_freeze_race', '冻结状态竞争');
    authority.status = 'frozen';
    authority.frozen_by_user_id = actor.userId;
    const eventId = await appendEvent(
      authority,
      'frozen',
      'approved',
      'frozen',
      actor,
      normalized.reasonCode,
      normalized,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, authority.id, eventId, manager);
    return receiptFor(authority, manager);
  });
}

async function runSupersede(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedSupersedeV1>,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, 'supersede', manager);
    const previewReplacement = await loadAuthorityByRef(normalized.replacementAuthorityRef, manager, false);
    const preview = await loadGroup(Number(previewReplacement.group_id), manager, false);
    await assertScopeGrant(actor, 'supersede', scopeOf(preview), manager);
    await claimIdempotency(
      'supersede',
      normalized.idempotencyKey,
      normalized.requestFingerprint,
      actor.userId,
      manager,
    );
    await lockScopeGraph(
      Number(previewReplacement.group_id),
      previewReplacement.settlement_period,
      actor.userId,
      preview,
      manager,
    );
    const replacement = await loadAuthorityByRef(normalized.replacementAuthorityRef, manager, true);
    const previous = await loadAuthorityByRef(normalized.supersededAuthorityRef, manager, true);
    assertExpectedAuthority(
      replacement,
      normalized.expectedReplacementAuthorityVersion,
      normalized.expectedReplacementContentHash,
    );
    assertExpectedAuthority(
      previous,
      normalized.expectedSupersededAuthorityVersion,
      normalized.expectedSupersededContentHash,
    );
    if (
      replacement.status !== 'submitted' ||
      !['approved', 'frozen'].includes(previous.status) ||
      Number(replacement.supersedes_authority_id) !== Number(previous.id) ||
      Number(replacement.group_id) !== Number(previous.group_id) ||
      replacement.settlement_period !== previous.settlement_period
    ) {
      failClosed('wage_scope_supersede_graph_invalid', '替代权威图、状态或范围不一致');
    }
    if (
      Number(replacement.created_by_user_id) === actor.userId ||
      Number(replacement.submitted_by_user_id) === actor.userId
    ) {
      throw new ForbiddenException('[wage_scope_maker_checker_same] supersede checker 必须与 maker 不同');
    }
    const replacementGraph = await verifyAuthorityGraph(replacement, manager, true);
    const previousGraph = await verifyAuthorityGraph(previous, manager, true);
    await assertBoundGroupTargetCurrentEligibilityInTransactionV1(
      replacementGraph.target,
      manager,
      'approve',
    );
    assertCurrentScopedCoverageMatchesSnapshotV1(
      replacementGraph.coverage,
      replacementGraph.currentCoverage,
    );
    assertNoFrozenOrLockedScopeShrinkV1(
      previousGraph.domains,
      replacementGraph.domains,
      previous.status,
      previousGraph.target.calculationStatus,
      previousGraph.target.lockedAt,
    );
    if (
      Number(previous.created_by_user_id) === actor.userId ||
      Number(previous.submitted_by_user_id) === actor.userId
    ) {
      throw new ForbiddenException('[wage_scope_maker_checker_same] supersede actor 必须与原权威 maker 不同');
    }
    const previousStatus = previous.status as 'approved' | 'frozen';
    const previousResult = await manager.query(
      `UPDATE wage_statistics_scope_authorities
          SET status = 'superseded', superseded_by_user_id = ?,
              superseded_at = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status IN ('approved', 'frozen')
          AND superseded_by_user_id IS NULL`,
      [actor.userId, previous.id],
    );
    if (Number(previousResult?.affectedRows ?? -1) !== 1) {
      failClosed('wage_scope_supersede_race', '被替代权威状态竞争');
    }
    previous.status = 'superseded';
    previous.superseded_by_user_id = actor.userId;
    await appendEvent(
      previous,
      'superseded',
      previousStatus,
      'superseded',
      actor,
      normalized.reasonCode,
      normalized,
      manager,
    );
    const replacementResult = await manager.query(
      `UPDATE wage_statistics_scope_authorities
          SET status = 'approved', approved_by_user_id = ?, approved_at = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status = 'submitted' AND approved_by_user_id IS NULL`,
      [actor.userId, replacement.id],
    );
    if (Number(replacementResult?.affectedRows ?? -1) !== 1) {
      failClosed('wage_scope_supersede_race', '替代权威批准状态竞争');
    }
    replacement.status = 'approved';
    replacement.approved_by_user_id = actor.userId;
    const eventId = await appendEvent(
      replacement,
      'approved',
      'submitted',
      'approved',
      actor,
      'scope_replacement_verified',
      normalized,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, replacement.id, eventId, manager);
    return receiptFor(replacement, manager);
  });
}

async function executeWithReplay(
  dataSource: DataSource,
  currentUser: CurrentUser,
  phase: ScopedWageStatisticsPhaseV1,
  key: string,
  fingerprint: string,
  expectedEvidenceRef: string,
  expectedEvidenceHash: string,
  expectedAuthorityRef: string | null,
  execute: () => Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>>,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  try {
    return await execute();
  } catch (error) {
    if (
      error instanceof WageScopeIdempotencyRaceV1 &&
      error.phase === phase &&
      error.idempotencyKey === key &&
      error.requestFingerprint === fingerprint
    ) {
      return replayCompletedClaim(
        dataSource,
        currentUser,
        phase,
        key,
        fingerprint,
        expectedEvidenceRef,
        expectedEvidenceHash,
        expectedAuthorityRef,
      );
    }
    mapStorageFailure(error);
  }
}

export async function draftScopedWageStatisticsAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: DraftScopedWageStatisticsAuthorityCommandV1,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeDraftScopedWageStatisticsAuthorityCommandV1(command);
  return executeWithReplay(
    dataSource,
    currentUser,
    'draft',
    normalized.idempotencyKey,
    normalized.requestFingerprint,
    normalized.evidenceRef,
    normalized.evidenceHash,
    null,
    () => runDraft(dataSource, currentUser, normalized),
  );
}

export async function submitScopedWageStatisticsAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: SubmitScopedWageStatisticsAuthorityCommandV1,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeSubmitScopedWageStatisticsAuthorityCommandV1(command);
  return executeWithReplay(
    dataSource,
    currentUser,
    'submit',
    normalized.idempotencyKey,
    normalized.requestFingerprint,
    normalized.evidenceRef,
    normalized.evidenceHash,
    normalized.authorityRef,
    () => runSubmit(dataSource, currentUser, normalized),
  );
}

export async function decideScopedWageStatisticsAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: DecideScopedWageStatisticsAuthorityCommandV1,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeDecideScopedWageStatisticsAuthorityCommandV1(command);
  const phase = normalized.decision === 'approve' ? 'approve' : 'reject';
  return executeWithReplay(
    dataSource,
    currentUser,
    phase,
    normalized.idempotencyKey,
    normalized.requestFingerprint,
    normalized.evidenceRef,
    normalized.evidenceHash,
    normalized.authorityRef,
    () => runDecision(dataSource, currentUser, normalized),
  );
}

export async function freezeScopedWageStatisticsAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: FreezeScopedWageStatisticsAuthorityCommandV1,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeFreezeScopedWageStatisticsAuthorityCommandV1(command);
  return executeWithReplay(
    dataSource,
    currentUser,
    'freeze',
    normalized.idempotencyKey,
    normalized.requestFingerprint,
    normalized.evidenceRef,
    normalized.evidenceHash,
    normalized.authorityRef,
    () => runFreeze(dataSource, currentUser, normalized),
  );
}

export async function supersedeScopedWageStatisticsAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: SupersedeScopedWageStatisticsAuthorityCommandV1,
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeSupersedeScopedWageStatisticsAuthorityCommandV1(command);
  return executeWithReplay(
    dataSource,
    currentUser,
    'supersede',
    normalized.idempotencyKey,
    normalized.requestFingerprint,
    normalized.evidenceRef,
    normalized.evidenceHash,
    normalized.replacementAuthorityRef,
    () => runSupersede(dataSource, currentUser, normalized),
  );
}

/**
 * Module-private future composer hook. It must be called inside the caller's
 * already-active REPEATABLE READ transaction. With the current 0/4 adapter
 * registry it fails closed before returning a formal wage scope. Enterprise
 * coverage remains a separate diagnostic and is not an extra authorization
 * condition for a group whose exact required domain set is complete.
 */
export async function resolveFrozenScopedWageStatisticsAuthorityForGroupTargetV1(
  manager: EntityManager,
  input: {
    readonly groupId: number;
    readonly settlementPeriod: string;
    readonly groupTargetId: number;
    readonly groupTargetCalculationVersion: number;
  },
): Promise<Readonly<ScopedWageStatisticsAuthorityReceiptV1>> {
  if (!(manager instanceof EntityManager) || !manager.queryRunner?.isTransactionActive) {
    failClosed('wage_scope_resolver_transaction_invalid', 'resolver 必须复用 active 事务连接');
  }
  await assertRepeatableRead(manager);
  const rows = await manager.query(
    `SELECT id, authority_ref, group_id, settlement_period, authority_version,
            supersedes_authority_id, group_target_id, group_target_calculation_version,
            required_domain_count, required_domains_hash,
            data_completeness_watermark_hash, settlement_complete_domain_count,
            settlement_coverage_status, enterprise_formal_domain_count,
            enterprise_ready_domain_count, enterprise_coverage_status,
            group_target_scope_hash, content_hash, status,
            created_by_user_id, submitted_by_user_id, approved_by_user_id,
            rejected_by_user_id, frozen_by_user_id, superseded_by_user_id
       FROM wage_statistics_scope_authorities
      WHERE group_id = ? AND settlement_period = ?
        AND group_target_id = ? AND group_target_calculation_version = ?
        AND status = 'frozen'
      FOR SHARE`,
    [
      input.groupId,
      input.settlementPeriod,
      input.groupTargetId,
      input.groupTargetCalculationVersion,
    ],
  ) as AuthorityRowV1[];
  if (rows.length !== 1) failClosed('wage_scope_frozen_authority_missing', '目标缺少唯一 frozen 范围权威');
  const graph = await verifyAuthorityGraph(rows[0], manager, true);
  await assertBoundGroupTargetCurrentEligibilityInTransactionV1(
    graph.target,
    manager,
    'resolve',
  );
  const receipt = await receiptFor(rows[0], manager, rows[0].status, graph);
  if (
    receipt.currentCoverage.settlementCoverageStatus !== 'complete' ||
    !isScopedWageStatisticsCoverageReadyV1(receipt.currentCoverage)
  ) {
    failClosed('wage_scope_formal_coverage_incomplete', '本组正式覆盖未完成，工资统计继续 fail closed');
  }
  return receipt;
}
