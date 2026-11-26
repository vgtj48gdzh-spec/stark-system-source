import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CurrentUser } from '../../common/interfaces/current-user.interface';

/**
 * SOURCE-ONLY / PRODUCTION-UNWIRED repair typed correction authority.
 *
 * This contract is intentionally absent from every Nest module, controller,
 * contribution composer, formal resolver and adapter. It writes only the 0070
 * control-plane tables when invoked by the disposable MySQL validator. It
 * never mutates business_contributions, business_contribution_corrections,
 * attribution, payroll, payment, inventory or repair runtime rows.
 *
 * The maker selects an exact source fact and supplies its typed measurements;
 * this contract derives the signed contribution deltas, cumulative balances,
 * economic period and catch-up period server-side. A formal contribution API
 * cannot call this file and never accepts a caller-supplied delta, recognition
 * period or recognition timestamp.
 */

export const REPAIR_TYPED_CORRECTION_SCHEMA_VERSION =
  'gov1-s2-repair-typed-correction-source-v1' as const;
export const REPAIR_TYPED_CORRECTION_RULE_VERSION =
  'gov1-s2-repair-typed-correction-v1' as const;

const DRAFT_PERMISSION = 'gov1.repair.correction.draft' as const;
const SUBMIT_PERMISSION = 'gov1.repair.correction.submit' as const;
const DECIDE_PERMISSION = 'gov1.repair.correction.decide' as const;

const WORK_ORDER_REF = /^work-order:([1-9]\d*)$/;
const CONTRIBUTION_REF = /^business-contribution:([1-9]\d*)$/;
const ASSIGNMENT_AUTHORITY_REF = /^repair-assignment:([0-9a-f]{64})$/;
const BASELINE_AUTHORITY_REF = /^repair-cost-event:([0-9a-f]{64})$/;
const CORRECTION_AUTHORITY_REF = /^repair-correction:([0-9a-f]{64})$/;
const EVIDENCE_REF = /^evidence:[0-9a-f]{64}$/;
const LOWER_HEX_64 = /^[0-9a-f]{64}$/;
const IDEMPOTENCY_KEY = /^repair-correction-idempotency:[0-9a-f]{64}$/;
const STRICT_UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SOURCE_KIND = /^[a-z][a-z0-9_-]{1,63}$/;
const SOURCE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const NON_NEGATIVE_CENTS = /^(0|[1-9]\d*)$/;
const POSITIVE_CENTS = /^[1-9]\d*$/;
const MYSQL_INT_MAX = 2147483647;
const MYSQL_BIGINT_MAX = 9223372036854775807n;
const MAX_PERIOD_SCAN_MONTHS = 120;

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

export const REPAIR_TYPED_CORRECTION_TYPES = [
  'customer_refund',
  'rework_direct_cost',
  'supplier_cost_recovery',
  'direct_cost_adjustment',
  'full_void',
] as const;

export type RepairTypedCorrectionTypeV1 =
  (typeof REPAIR_TYPED_CORRECTION_TYPES)[number];
export type RepairTypedCorrectionDecisionV1 = 'approve' | 'reject';
export type RepairTypedCorrectionAuthorityStatusV1 =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'superseded';
export type RepairTypedCorrectionTargetKindV1 =
  | 'typed_correction'
  | 'full_reversal';
export type RepairTypedCorrectionCatchUpModeV1 =
  | 'same_period'
  | 'locked_period_catch_up';

export interface RepairTypedCorrectionSourceFactInputV1 {
  readonly sourceSystem: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly sourceRecordHash: string;
  readonly occurredAt: string;
  readonly amountCents: string | null;
  readonly previousDirectCostCents: string | null;
  readonly revisedDirectCostCents: string | null;
  readonly primaryEvidenceRef: string;
  readonly primaryEvidenceHash: string;
  readonly secondaryEvidenceRef: string | null;
  readonly secondaryEvidenceHash: string | null;
}

export interface DraftRepairTypedCorrectionAuthorityCommandV1 {
  readonly workOrderRef: string;
  readonly originalContributionRef: string;
  readonly correctionType: RepairTypedCorrectionTypeV1;
  readonly expectedWorkOrderVersion: number;
  readonly expectedOriginalContributionVersion: number;
  readonly expectedEconomicFactKey: string;
  readonly expectedOriginalAuthoritySnapshotHash: string;
  readonly expectedOriginalAttributionSnapshotHash: string;
  readonly expectedAssignmentAuthorityRef: string;
  readonly expectedAssignmentAuthorityVersion: number;
  readonly expectedAssignmentContentHash: string;
  readonly expectedBaselineCostAuthorityRef: string;
  readonly expectedBaselineCostAuthorityVersion: number;
  readonly expectedBaselineCostContentHash: string;
  readonly sourceFact: RepairTypedCorrectionSourceFactInputV1;
  readonly supersedesAuthorityRef: string | null;
  readonly expectedSupersededAuthorityVersion: number | null;
  readonly idempotencyKey: string;
}

export interface SubmitRepairTypedCorrectionAuthorityCommandV1 {
  readonly authorityRef: string;
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface DecideRepairTypedCorrectionAuthorityCommandV1 {
  readonly authorityRef: string;
  readonly decision: RepairTypedCorrectionDecisionV1;
  readonly reasonCode: 'typed_correction_verified' | 'typed_correction_rejected';
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
}

export interface NormalizedRepairTypedCorrectionSourceFactV1 {
  readonly sourceSystem: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly sourceRecordHash: string;
  readonly occurredAt: string;
  readonly amountCents: string | null;
  readonly previousDirectCostCents: string | null;
  readonly revisedDirectCostCents: string | null;
  readonly primaryEvidenceRef: string;
  readonly primaryEvidenceHash: string;
  readonly secondaryEvidenceRef: string | null;
  readonly secondaryEvidenceHash: string | null;
  readonly sourceFactKey: string;
  readonly sourceFactHash: string;
}

export interface NormalizedDraftRepairTypedCorrectionAuthorityV1 {
  readonly workOrderId: number;
  readonly originalContributionId: number;
  readonly correctionType: RepairTypedCorrectionTypeV1;
  readonly expectedWorkOrderVersion: number;
  readonly expectedOriginalContributionVersion: number;
  readonly expectedEconomicFactKey: string;
  readonly expectedOriginalAuthoritySnapshotHash: string;
  readonly expectedOriginalAttributionSnapshotHash: string;
  readonly expectedAssignmentAuthorityId: string;
  readonly expectedAssignmentAuthorityVersion: number;
  readonly expectedAssignmentContentHash: string;
  readonly expectedBaselineCostAuthorityId: string;
  readonly expectedBaselineCostAuthorityVersion: number;
  readonly expectedBaselineCostContentHash: string;
  readonly sourceFact: Readonly<NormalizedRepairTypedCorrectionSourceFactV1>;
  readonly supersedesAuthorityId: string | null;
  readonly expectedSupersededAuthorityVersion: number | null;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface NormalizedSubmitRepairTypedCorrectionAuthorityV1 {
  readonly authorityId: string;
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface NormalizedDecideRepairTypedCorrectionAuthorityV1 {
  readonly authorityId: string;
  readonly decision: RepairTypedCorrectionDecisionV1;
  readonly reasonCode: 'typed_correction_verified' | 'typed_correction_rejected';
  readonly expectedAuthorityVersion: number;
  readonly expectedContentHash: string;
  readonly evidenceRef: string;
  readonly evidenceHash: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export interface RepairTypedCorrectionBalanceInputV1 {
  readonly remainingRevenueCents: string;
  readonly remainingDirectCostCents: string;
  readonly existingPartialCorrectionCount: number;
  readonly hasFullVoid: boolean;
  readonly hasGenericFullReversal: boolean;
}

export interface RepairTypedCorrectionDerivedDeltaV1 {
  readonly revenueDeltaCents: string;
  readonly directCostDeltaCents: string;
  readonly marginDeltaCents: string;
  readonly cumulativeRevenueAfterCents: string;
  readonly cumulativeDirectCostAfterCents: string;
}

export interface RepairTypedCorrectionAuthorityReceiptV1 {
  readonly status: 'draft' | 'submitted' | 'approved' | 'rejected';
  readonly schemaVersion: typeof REPAIR_TYPED_CORRECTION_SCHEMA_VERSION;
  readonly ruleVersion: typeof REPAIR_TYPED_CORRECTION_RULE_VERSION;
  readonly authorityRef: string;
  readonly correctionRootRef: string;
  readonly authorityVersion: number;
  readonly contentHash: string;
  readonly correctionType: RepairTypedCorrectionTypeV1;
  readonly economicRootRef: string;
  readonly originalContributionRef: string;
  readonly workOrderRef: string;
  readonly sourceFactKey: string;
  readonly sourceFactHash: string;
  readonly occurredAt: string;
  readonly confirmedAt: string | null;
  readonly serverObservedAt: string;
  readonly revenueDeltaCents: string;
  readonly directCostDeltaCents: string;
  readonly marginDeltaCents: string;
  readonly correctionLedgerWatermarkHash: string;
  readonly supersedesAuthorityRef: string | null;
  readonly supersededAuthorityRef: string | null;
  readonly mapping: Readonly<{
    genericTargetKind: RepairTypedCorrectionTargetKindV1;
    genericMappingKey: string;
    correctionSequence: number;
    cumulativeRevenueBeforeCents: string;
    cumulativeDirectCostBeforeCents: string;
    cumulativeRevenueAfterCents: string;
    cumulativeDirectCostAfterCents: string;
    economicPeriod: string;
    recognitionPeriod: string;
    recognitionAt: string;
    deferredFromPeriod: string | null;
    catchUpMode: RepairTypedCorrectionCatchUpModeV1;
    skippedLockedPeriodCount: number;
    skippedLockedPeriodsHash: string;
    mappingHash: string;
    materializationState: 'planned_unwired';
  }> | null;
}

type CorrectionPhaseV1 = 'draft' | 'submit' | 'approve' | 'reject';

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

interface RootRowV1 {
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

interface BaselineRowV1 {
  id: string | number;
  authority_ref: string;
  economic_root_id: string;
  work_order_id: string | number;
  authority_version: string | number;
  assignment_authority_id: string | number;
  assignment_authority_version: string | number;
  assignment_content_hash: string;
  content_hash: string;
  profile_eligibility: string;
  total_direct_cost_cents: string | number;
  status: string;
}

interface ContributionRowV1 {
  id: string | number;
  economic_root_id: string | null;
  business_domain: string;
  company_ref: string;
  business_sector_ref: string | null;
  store_ref: string | null;
  customer_ref: string | null;
  operating_group_id: string | number;
  responsibility_employee_id_snapshot: string | number;
  economic_fact_key: string;
  authority_snapshot_hash: string;
  revenue_cents: string | number;
  direct_cost_total_cents: string | number;
  valid_contribution_margin_cents: string | number;
  currency: string;
  confirmation_status: string;
  reversal_of_contribution_id: string | number | null;
  reversed_by_contribution_id: string | number | null;
  version: string | number;
  confirmed_by: string | number | null;
  confirmed_at: Date | string | null;
}

interface AttributionRowV1 {
  id: string | number;
  contribution_id: string | number;
  role: string;
  origin_business_domain: string;
  employee_id: string | number;
  employee_group_id_snapshot: string | number;
  share_bps: string | number;
  evidence_ref: string;
  evidence_hash: string;
  status: string;
  confirmed_by: string | number | null;
  confirmed_at: Date | string | null;
}

interface GenericCorrectionRowV1 {
  id: string | number;
  original_contribution_id: string | number;
  correction_type: string;
  sequence: string | number;
  revenue_delta_cents: string | number;
  direct_cost_delta_cents: string | number;
  margin_delta_cents: string | number;
  source_system: string;
  source_type: string;
  source_id: string;
  source_version: string;
  source_record_hash: string;
  unique_source_key: string;
  evidence_unique_key: string;
  economic_fact_key: string;
  authority_snapshot_hash: string;
  attribution_snapshot_hash: string;
  occurred_at: Date | string;
  recognition_period: string;
  recognition_at: Date | string;
  currency: string;
}

interface AuthorityRowV1 {
  id: string | number;
  authority_ref: string;
  correction_root_id: string;
  economic_root_id: string;
  original_contribution_id: string | number;
  work_order_id: string | number;
  authorized_company_ref: string;
  authorized_business_sector_ref: string;
  authorized_store_ref: string;
  authorized_customer_ref: string;
  correction_type: RepairTypedCorrectionTypeV1;
  rule_version: string;
  authority_version: string | number;
  supersedes_authority_id: string | number | null;
  assignment_authority_id: string | number;
  assignment_authority_version: string | number;
  assignment_content_hash: string;
  baseline_cost_authority_id: string | number;
  baseline_cost_authority_version: string | number;
  baseline_cost_content_hash: string;
  original_contribution_version: string | number;
  original_economic_fact_key: string;
  original_authority_snapshot_hash: string;
  original_attribution_snapshot_hash: string;
  source_system: string;
  source_type: string;
  source_id: string;
  source_version: string;
  source_record_hash: string;
  source_fact_key: string;
  source_fact_hash: string;
  source_amount_cents: string | number | null;
  source_previous_cost_cents: string | number | null;
  source_revised_cost_cents: string | number | null;
  primary_evidence_ref: string;
  primary_evidence_hash: string;
  secondary_evidence_ref: string | null;
  secondary_evidence_hash: string | null;
  occurred_at: Date | string;
  revenue_delta_cents: string | number;
  direct_cost_delta_cents: string | number;
  margin_delta_cents: string | number;
  correction_ledger_watermark_hash: string;
  content_hash: string;
  expected_work_order_version: string | number;
  status: RepairTypedCorrectionAuthorityStatusV1;
  created_by_user_id: string | number;
  submitted_by_user_id: string | number | null;
  approved_by_user_id: string | number | null;
  rejected_by_user_id: string | number | null;
  superseded_by_user_id: string | number | null;
  server_observed_at: Date | string;
  confirmed_at: Date | string | null;
}

interface MappingRowV1 {
  id: string | number;
  authority_id: string | number;
  correction_root_id: string;
  economic_root_id: string;
  original_contribution_id: string | number;
  correction_type: RepairTypedCorrectionTypeV1;
  generic_target_kind: RepairTypedCorrectionTargetKindV1;
  generic_mapping_key: string;
  correction_sequence: string | number;
  revenue_delta_cents: string | number;
  direct_cost_delta_cents: string | number;
  margin_delta_cents: string | number;
  occurred_at: Date | string;
  cumulative_revenue_before_cents: string | number;
  cumulative_direct_cost_before_cents: string | number;
  cumulative_revenue_after_cents: string | number;
  cumulative_direct_cost_after_cents: string | number;
  economic_period: string;
  recognition_period: string;
  recognition_at: Date | string;
  deferred_from_period: string | null;
  catch_up_mode: RepairTypedCorrectionCatchUpModeV1;
  skipped_locked_period_count: string | number;
  skipped_locked_periods_hash: string;
  ledger_watermark_hash: string;
  mapping_hash: string;
  materialization_state: 'planned_unwired';
  status: 'prepared' | 'active' | 'superseded';
  supersedes_mapping_id: string | number | null;
  superseded_by_mapping_id: string | number | null;
}

interface ClaimRowV1 {
  idempotency_key: string;
  phase: CorrectionPhaseV1;
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
  actor_user_id: string | number;
  evidence_ref: string;
  evidence_hash: string;
  request_fingerprint: string;
  authority_content_hash: string;
  mapping_hash: string | null;
}

interface RecognitionDecisionV1 {
  economicPeriod: string;
  recognitionPeriod: string;
  recognitionAt: string;
  deferredFromPeriod: string | null;
  catchUpMode: RepairTypedCorrectionCatchUpModeV1;
  skippedLockedPeriods: readonly Readonly<{
    recognitionPeriod: string;
    lockedReasons: readonly string[];
  }>[];
  skippedLockedPeriodsHash: string;
}

interface LockedCorrectionGraphV1 {
  profile: ProfileRowV1;
  root: RootRowV1;
  contribution: ContributionRowV1;
  attributions: AttributionRowV1[];
  attributionSnapshotHash: string;
  assignment: AssignmentRowV1;
  baseline: BaselineRowV1;
  authorities: AuthorityRowV1[];
  mappings: MappingRowV1[];
  genericCorrections: GenericCorrectionRowV1[];
  genericReversals: ContributionRowV1[];
  serverObservedAt: string;
  correctionLedgerWatermarkHash: string;
}

interface LedgerBalanceV1 {
  remainingRevenueCents: bigint;
  remainingDirectCostCents: bigint;
  nextSequence: number;
  activePartialCount: number;
  hasActiveFullVoid: boolean;
  hasGenericFullReversal: boolean;
}

class CorrectionIdempotencyRaceV1 extends Error {
  constructor(
    readonly phase: CorrectionPhaseV1,
    readonly idempotencyKey: string,
    readonly requestFingerprint: string,
  ) {
    super('repair_typed_correction_idempotency_claim_race');
  }
}

function failClosed(code: string, message: string): never {
  throw new ConflictException(`[${code}] ${message}`);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function assertPlainExactObject(
  value: unknown,
  keys: readonly string[],
  code: string,
): asserts value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    failClosed(code, '命令必须是普通对象');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    failClosed(code, '命令原型无效');
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failClosed(code, '命令字段缺失或包含未授权字段');
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function positiveMysqlInt(value: unknown, code: string, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > MYSQL_INT_MAX) {
    failClosed(code, `${label}必须是有效正整数`);
  }
  return Number(value);
}

function parseNumericRef(value: unknown, pattern: RegExp, code: string, label: string): number {
  if (typeof value !== 'string') failClosed(code, `${label}格式无效`);
  const match = pattern.exec(value);
  if (!match) failClosed(code, `${label}格式无效`);
  return positiveMysqlInt(Number(match[1]), code, label);
}

function parseOpaqueRef(value: unknown, pattern: RegExp, code: string, label: string): string {
  if (typeof value !== 'string') failClosed(code, `${label}格式无效`);
  const match = pattern.exec(value);
  if (!match) failClosed(code, `${label}格式无效`);
  return match[1];
}

function lowerHash(value: unknown, code: string, label: string): string {
  if (typeof value !== 'string' || !LOWER_HEX_64.test(value)) {
    failClosed(code, `${label}必须是小写 SHA-256`);
  }
  return value;
}

function evidenceRef(value: unknown, code: string): string {
  if (typeof value !== 'string' || !EVIDENCE_REF.test(value)) {
    failClosed(code, '证据引用格式无效');
  }
  return value;
}

function nullableEvidenceRef(value: unknown, code: string): string | null {
  if (value === null) return null;
  return evidenceRef(value, code);
}

function nullableHash(value: unknown, code: string, label: string): string | null {
  if (value === null) return null;
  return lowerHash(value, code, label);
}

function idempotency(value: unknown): string {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY.test(value)) {
    failClosed('repair_typed_correction_idempotency_invalid', '幂等键格式无效');
  }
  return value;
}

function sourceKind(value: unknown, code: string, label: string): string {
  if (typeof value !== 'string') failClosed(code, `${label}格式无效`);
  const normalized = value.trim().toLowerCase();
  if (!SOURCE_KIND.test(normalized)) failClosed(code, `${label}格式无效`);
  return normalized;
}

function sourceToken(value: unknown, code: string, label: string, maxLength: number): string {
  if (typeof value !== 'string') failClosed(code, `${label}格式无效`);
  const normalized = value.trim();
  if (normalized.length > maxLength || !SOURCE_TOKEN.test(normalized)) {
    failClosed(code, `${label}格式无效`);
  }
  return normalized;
}

function utcInstant(value: unknown, code: string, label: string): string {
  if (typeof value !== 'string' || !STRICT_UTC_MILLIS.test(value)) {
    failClosed(code, `${label}必须是毫秒精度 UTC 时间`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    failClosed(code, `${label}不是有效时间`);
  }
  return value;
}

function mysqlUtcMillis(value: string | null): string | null {
  return value == null ? null : value.replace('T', ' ').replace('Z', '');
}

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    failClosed('repair_typed_correction_stored_time_invalid', '数据库时间无效');
  }
  return date.toISOString();
}

function cents(
  value: unknown,
  mode: 'positive' | 'non_negative',
  code: string,
  label: string,
): string {
  const pattern = mode === 'positive' ? POSITIVE_CENTS : NON_NEGATIVE_CENTS;
  if (typeof value !== 'string' || !pattern.test(value)) {
    failClosed(code, `${label}必须是十进制整分字符串`);
  }
  const parsed = BigInt(value);
  if (parsed > MYSQL_BIGINT_MAX) failClosed(code, `${label}超过 BIGINT 上限`);
  return parsed.toString();
}

function nullableCents(
  value: unknown,
  mode: 'positive' | 'non_negative',
  code: string,
  label: string,
): string | null {
  if (value === null) return null;
  return cents(value, mode, code, label);
}

function storedSignedCents(value: unknown, code: string, label: string): bigint {
  const normalized = String(value);
  if (!/^-?(0|[1-9]\d*)$/.test(normalized)) failClosed(code, `${label}不是有效整分`);
  const parsed = BigInt(normalized);
  if (parsed < -MYSQL_BIGINT_MAX - 1n || parsed > MYSQL_BIGINT_MAX) {
    failClosed(code, `${label}超过 BIGINT 范围`);
  }
  return parsed;
}

function normalizeCorrectionType(value: unknown): RepairTypedCorrectionTypeV1 {
  if (
    typeof value !== 'string' ||
    !REPAIR_TYPED_CORRECTION_TYPES.includes(value as RepairTypedCorrectionTypeV1)
  ) {
    failClosed('repair_typed_correction_type_invalid', '更正类型不在封闭枚举内');
  }
  return value as RepairTypedCorrectionTypeV1;
}

function normalizeSourceFact(
  value: unknown,
  correctionType: RepairTypedCorrectionTypeV1,
  expectedEconomicFactKey: string,
): Readonly<NormalizedRepairTypedCorrectionSourceFactV1> {
  assertPlainExactObject(
    value,
    [
      'sourceSystem',
      'sourceType',
      'sourceId',
      'sourceVersion',
      'sourceRecordHash',
      'occurredAt',
      'amountCents',
      'previousDirectCostCents',
      'revisedDirectCostCents',
      'primaryEvidenceRef',
      'primaryEvidenceHash',
      'secondaryEvidenceRef',
      'secondaryEvidenceHash',
    ],
    'repair_typed_correction_source_shape_invalid',
  );
  const sourceSystem = sourceKind(
    value.sourceSystem,
    'repair_typed_correction_source_system_invalid',
    '来源系统',
  );
  const sourceType = sourceKind(
    value.sourceType,
    'repair_typed_correction_source_type_invalid',
    '来源类型',
  );
  const sourceId = sourceToken(
    value.sourceId,
    'repair_typed_correction_source_id_invalid',
    '来源标识',
    120,
  );
  const sourceVersion = sourceToken(
    value.sourceVersion,
    'repair_typed_correction_source_version_invalid',
    '来源版本',
    100,
  );
  const sourceRecordHash = lowerHash(
    value.sourceRecordHash,
    'repair_typed_correction_source_record_hash_invalid',
    '来源记录哈希',
  );
  const occurredAt = utcInstant(
    value.occurredAt,
    'repair_typed_correction_occurred_at_invalid',
    '经济发生时间',
  );
  const primaryEvidenceRef = evidenceRef(
    value.primaryEvidenceRef,
    'repair_typed_correction_primary_evidence_ref_invalid',
  );
  const primaryEvidenceHash = lowerHash(
    value.primaryEvidenceHash,
    'repair_typed_correction_primary_evidence_hash_invalid',
    '主证据哈希',
  );
  const secondaryEvidenceRef = nullableEvidenceRef(
    value.secondaryEvidenceRef,
    'repair_typed_correction_secondary_evidence_ref_invalid',
  );
  const secondaryEvidenceHash = nullableHash(
    value.secondaryEvidenceHash,
    'repair_typed_correction_secondary_evidence_hash_invalid',
    '次证据哈希',
  );
  if ((secondaryEvidenceRef == null) !== (secondaryEvidenceHash == null)) {
    failClosed('repair_typed_correction_secondary_evidence_pair_invalid', '次证据引用与哈希必须成对');
  }

  let amountCents: string | null = null;
  let previousDirectCostCents: string | null = null;
  let revisedDirectCostCents: string | null = null;
  if (
    correctionType === 'customer_refund' ||
    correctionType === 'rework_direct_cost' ||
    correctionType === 'supplier_cost_recovery'
  ) {
    amountCents = nullableCents(
      value.amountCents,
      'positive',
      'repair_typed_correction_source_amount_invalid',
      '来源金额',
    );
    if (
      amountCents == null ||
      value.previousDirectCostCents !== null ||
      value.revisedDirectCostCents !== null ||
      secondaryEvidenceRef !== null
    ) {
      failClosed('repair_typed_correction_source_shape_invalid', '该类型只允许一个正数来源金额');
    }
  } else if (correctionType === 'direct_cost_adjustment') {
    previousDirectCostCents = nullableCents(
      value.previousDirectCostCents,
      'non_negative',
      'repair_typed_correction_previous_cost_invalid',
      '原直接成本',
    );
    revisedDirectCostCents = nullableCents(
      value.revisedDirectCostCents,
      'non_negative',
      'repair_typed_correction_revised_cost_invalid',
      '修订直接成本',
    );
    if (
      value.amountCents !== null ||
      previousDirectCostCents == null ||
      revisedDirectCostCents == null ||
      previousDirectCostCents === revisedDirectCostCents ||
      secondaryEvidenceRef !== null
    ) {
      failClosed(
        'repair_typed_correction_adjustment_shape_invalid',
        '普通成本调整必须提供不同的原值与修订值，且不得伪装为返工或回收',
      );
    }
  } else if (
    value.amountCents !== null ||
    value.previousDirectCostCents !== null ||
    value.revisedDirectCostCents !== null ||
    secondaryEvidenceRef == null ||
    secondaryEvidenceHash == null ||
    secondaryEvidenceRef === primaryEvidenceRef
  ) {
    failClosed(
      'repair_typed_correction_full_void_source_invalid',
      '全额作废金额只从当前余额推导，并要求收入与成本两份不同证据',
    );
  }

  const identity = {
    schemaVersion: REPAIR_TYPED_CORRECTION_SCHEMA_VERSION,
    correctionType,
    economicFactKey: expectedEconomicFactKey,
    sourceSystem,
    sourceType,
    sourceId,
    sourceVersion,
    sourceRecordHash,
  };
  const sourceFactKey = canonicalHash(identity);
  const fact = {
    ...identity,
    occurredAt,
    amountCents,
    previousDirectCostCents,
    revisedDirectCostCents,
    primaryEvidenceRef,
    primaryEvidenceHash,
    secondaryEvidenceRef,
    secondaryEvidenceHash,
  };
  return deepFreeze({
    sourceSystem,
    sourceType,
    sourceId,
    sourceVersion,
    sourceRecordHash,
    occurredAt,
    amountCents,
    previousDirectCostCents,
    revisedDirectCostCents,
    primaryEvidenceRef,
    primaryEvidenceHash,
    secondaryEvidenceRef,
    secondaryEvidenceHash,
    sourceFactKey,
    sourceFactHash: canonicalHash(fact),
  });
}

export function normalizeDraftRepairTypedCorrectionAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedDraftRepairTypedCorrectionAuthorityV1> {
  assertPlainExactObject(
    command,
    [
      'workOrderRef',
      'originalContributionRef',
      'correctionType',
      'expectedWorkOrderVersion',
      'expectedOriginalContributionVersion',
      'expectedEconomicFactKey',
      'expectedOriginalAuthoritySnapshotHash',
      'expectedOriginalAttributionSnapshotHash',
      'expectedAssignmentAuthorityRef',
      'expectedAssignmentAuthorityVersion',
      'expectedAssignmentContentHash',
      'expectedBaselineCostAuthorityRef',
      'expectedBaselineCostAuthorityVersion',
      'expectedBaselineCostContentHash',
      'sourceFact',
      'supersedesAuthorityRef',
      'expectedSupersededAuthorityVersion',
      'idempotencyKey',
    ],
    'repair_typed_correction_draft_shape_invalid',
  );
  const correctionType = normalizeCorrectionType(command.correctionType);
  const expectedEconomicFactKey = lowerHash(
    command.expectedEconomicFactKey,
    'repair_typed_correction_economic_fact_key_invalid',
    '原经济事实键',
  );
  const supersedesAuthorityId = command.supersedesAuthorityRef === null
    ? null
    : parseOpaqueRef(
        command.supersedesAuthorityRef,
        CORRECTION_AUTHORITY_REF,
        'repair_typed_correction_supersedes_ref_invalid',
        '被替代权威',
      );
  const expectedSupersededAuthorityVersion = command.expectedSupersededAuthorityVersion === null
    ? null
    : positiveMysqlInt(
        command.expectedSupersededAuthorityVersion,
        'repair_typed_correction_supersedes_version_invalid',
        '被替代权威版本',
      );
  if ((supersedesAuthorityId == null) !== (expectedSupersededAuthorityVersion == null)) {
    failClosed('repair_typed_correction_supersedes_pair_invalid', '替代引用与版本必须成对');
  }
  const sourceFact = normalizeSourceFact(
    command.sourceFact,
    correctionType,
    expectedEconomicFactKey,
  );
  const base = {
    workOrderId: parseNumericRef(
      command.workOrderRef,
      WORK_ORDER_REF,
      'repair_typed_correction_work_order_ref_invalid',
      '工单引用',
    ),
    originalContributionId: parseNumericRef(
      command.originalContributionRef,
      CONTRIBUTION_REF,
      'repair_typed_correction_contribution_ref_invalid',
      '原贡献引用',
    ),
    correctionType,
    expectedWorkOrderVersion: positiveMysqlInt(
      command.expectedWorkOrderVersion,
      'repair_typed_correction_work_order_version_invalid',
      '工单版本',
    ),
    expectedOriginalContributionVersion: positiveMysqlInt(
      command.expectedOriginalContributionVersion,
      'repair_typed_correction_contribution_version_invalid',
      '原贡献版本',
    ),
    expectedEconomicFactKey,
    expectedOriginalAuthoritySnapshotHash: lowerHash(
      command.expectedOriginalAuthoritySnapshotHash,
      'repair_typed_correction_original_authority_hash_invalid',
      '原权威快照哈希',
    ),
    expectedOriginalAttributionSnapshotHash: lowerHash(
      command.expectedOriginalAttributionSnapshotHash,
      'repair_typed_correction_original_attribution_hash_invalid',
      '原归因快照哈希',
    ),
    expectedAssignmentAuthorityId: parseOpaqueRef(
      command.expectedAssignmentAuthorityRef,
      ASSIGNMENT_AUTHORITY_REF,
      'repair_typed_correction_assignment_ref_invalid',
      '责任归因权威',
    ),
    expectedAssignmentAuthorityVersion: positiveMysqlInt(
      command.expectedAssignmentAuthorityVersion,
      'repair_typed_correction_assignment_version_invalid',
      '责任归因权威版本',
    ),
    expectedAssignmentContentHash: lowerHash(
      command.expectedAssignmentContentHash,
      'repair_typed_correction_assignment_hash_invalid',
      '责任归因内容哈希',
    ),
    expectedBaselineCostAuthorityId: parseOpaqueRef(
      command.expectedBaselineCostAuthorityRef,
      BASELINE_AUTHORITY_REF,
      'repair_typed_correction_baseline_ref_invalid',
      '成本基线权威',
    ),
    expectedBaselineCostAuthorityVersion: positiveMysqlInt(
      command.expectedBaselineCostAuthorityVersion,
      'repair_typed_correction_baseline_version_invalid',
      '成本基线权威版本',
    ),
    expectedBaselineCostContentHash: lowerHash(
      command.expectedBaselineCostContentHash,
      'repair_typed_correction_baseline_hash_invalid',
      '成本基线内容哈希',
    ),
    sourceFact,
    supersedesAuthorityId,
    expectedSupersededAuthorityVersion,
    idempotencyKey: idempotency(command.idempotencyKey),
  };
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

export function normalizeSubmitRepairTypedCorrectionAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedSubmitRepairTypedCorrectionAuthorityV1> {
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
    'repair_typed_correction_submit_shape_invalid',
  );
  const base = {
    authorityId: parseOpaqueRef(
      command.authorityRef,
      CORRECTION_AUTHORITY_REF,
      'repair_typed_correction_authority_ref_invalid',
      '更正权威',
    ),
    expectedAuthorityVersion: positiveMysqlInt(
      command.expectedAuthorityVersion,
      'repair_typed_correction_authority_version_invalid',
      '权威版本',
    ),
    expectedContentHash: lowerHash(
      command.expectedContentHash,
      'repair_typed_correction_content_hash_invalid',
      '内容哈希',
    ),
    evidenceRef: evidenceRef(
      command.evidenceRef,
      'repair_typed_correction_evidence_ref_invalid',
    ),
    evidenceHash: lowerHash(
      command.evidenceHash,
      'repair_typed_correction_evidence_hash_invalid',
      '提交证据哈希',
    ),
    idempotencyKey: idempotency(command.idempotencyKey),
  };
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

export function normalizeDecideRepairTypedCorrectionAuthorityCommandV1(
  command: unknown,
): Readonly<NormalizedDecideRepairTypedCorrectionAuthorityV1> {
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
    'repair_typed_correction_decision_shape_invalid',
  );
  if (command.decision !== 'approve' && command.decision !== 'reject') {
    failClosed('repair_typed_correction_decision_invalid', '审批决定无效');
  }
  const expectedReason = command.decision === 'approve'
    ? 'typed_correction_verified'
    : 'typed_correction_rejected';
  if (command.reasonCode !== expectedReason) {
    failClosed('repair_typed_correction_reason_invalid', '审批原因码与决定不匹配');
  }
  const base = {
    authorityId: parseOpaqueRef(
      command.authorityRef,
      CORRECTION_AUTHORITY_REF,
      'repair_typed_correction_authority_ref_invalid',
      '更正权威',
    ),
    decision: command.decision,
    reasonCode: expectedReason,
    expectedAuthorityVersion: positiveMysqlInt(
      command.expectedAuthorityVersion,
      'repair_typed_correction_authority_version_invalid',
      '权威版本',
    ),
    expectedContentHash: lowerHash(
      command.expectedContentHash,
      'repair_typed_correction_content_hash_invalid',
      '内容哈希',
    ),
    evidenceRef: evidenceRef(
      command.evidenceRef,
      'repair_typed_correction_evidence_ref_invalid',
    ),
    evidenceHash: lowerHash(
      command.evidenceHash,
      'repair_typed_correction_evidence_hash_invalid',
      '审批证据哈希',
    ),
    idempotencyKey: idempotency(command.idempotencyKey),
  } as const;
  return deepFreeze({ ...base, requestFingerprint: canonicalHash(base) });
}

export function deriveRepairTypedCorrectionDeltaV1(
  correctionType: RepairTypedCorrectionTypeV1,
  sourceFact: Readonly<NormalizedRepairTypedCorrectionSourceFactV1>,
  balance: Readonly<RepairTypedCorrectionBalanceInputV1>,
): Readonly<RepairTypedCorrectionDerivedDeltaV1> {
  normalizeCorrectionType(correctionType);
  const remainingRevenue = storedSignedCents(
    balance.remainingRevenueCents,
    'repair_typed_correction_balance_invalid',
    '剩余收入',
  );
  const remainingDirectCost = storedSignedCents(
    balance.remainingDirectCostCents,
    'repair_typed_correction_balance_invalid',
    '剩余直接成本',
  );
  if (
    remainingRevenue < 0n ||
    remainingDirectCost < 0n ||
    !Number.isSafeInteger(balance.existingPartialCorrectionCount) ||
    balance.existingPartialCorrectionCount < 0 ||
    typeof balance.hasFullVoid !== 'boolean' ||
    typeof balance.hasGenericFullReversal !== 'boolean'
  ) {
    failClosed('repair_typed_correction_balance_invalid', '累计余额或更正状态无效');
  }
  if (balance.hasGenericFullReversal) {
    failClosed('repair_typed_correction_generic_reversal_conflict', '原贡献已存在通用全额冲销');
  }
  if (balance.hasFullVoid) {
    failClosed('repair_typed_correction_full_void_partial_conflict', '已有全额作废，不得追加更正');
  }
  if (correctionType === 'full_void' && balance.existingPartialCorrectionCount !== 0) {
    failClosed('repair_typed_correction_full_void_partial_conflict', '全额作废与任何部分更正互斥');
  }

  let revenueDelta = 0n;
  let directCostDelta = 0n;
  if (correctionType === 'customer_refund') {
    revenueDelta = -BigInt(sourceFact.amountCents ?? '0');
  } else if (correctionType === 'rework_direct_cost') {
    directCostDelta = BigInt(sourceFact.amountCents ?? '0');
  } else if (correctionType === 'supplier_cost_recovery') {
    directCostDelta = -BigInt(sourceFact.amountCents ?? '0');
  } else if (correctionType === 'direct_cost_adjustment') {
    directCostDelta =
      BigInt(sourceFact.revisedDirectCostCents ?? '0') -
      BigInt(sourceFact.previousDirectCostCents ?? '0');
    if (directCostDelta === 0n) {
      failClosed('repair_typed_correction_adjustment_zero', '普通成本调整不得为零');
    }
  } else {
    if (remainingRevenue <= 0n) {
      failClosed('repair_typed_correction_full_void_revenue_invalid', '全额作废要求剩余收入大于零');
    }
    revenueDelta = -remainingRevenue;
    directCostDelta = -remainingDirectCost;
  }
  const afterRevenue = remainingRevenue + revenueDelta;
  const afterDirectCost = remainingDirectCost + directCostDelta;
  if (afterRevenue < 0n) {
    failClosed('repair_typed_correction_refund_exceeds_balance', '累计退款超过剩余收入');
  }
  if (afterDirectCost < 0n) {
    failClosed('repair_typed_correction_recovery_exceeds_balance', '成本减少超过剩余直接成本');
  }
  const marginDelta = revenueDelta - directCostDelta;
  return deepFreeze({
    revenueDeltaCents: revenueDelta.toString(),
    directCostDeltaCents: directCostDelta.toString(),
    marginDeltaCents: marginDelta.toString(),
    cumulativeRevenueAfterCents: afterRevenue.toString(),
    cumulativeDirectCostAfterCents: afterDirectCost.toString(),
  });
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
      'repair_typed_correction_data_source_invalid',
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
    failClosed('repair_typed_correction_transaction_manager_invalid', '事务连接身份无效');
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
    ) as Array<{ state?: unknown; isolation_level?: unknown; autocommit?: unknown }>;
  } catch {
    failClosed('repair_typed_correction_transaction_oracle_unavailable', '无法核验当前事务');
  }
  if (
    rows.length !== 1 ||
    String(rows[0].state ?? '').trim().toUpperCase() !== 'ACTIVE' ||
    canonicalIsolation(rows[0].isolation_level) !== canonicalIsolation('REPEATABLE READ') ||
    !['NO', '0'].includes(String(rows[0].autocommit ?? '').trim().toUpperCase())
  ) {
    failClosed(
      'repair_typed_correction_transaction_isolation_invalid',
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
  phase: CorrectionPhaseV1,
  manager: EntityManager,
): Promise<LockedActorV1> {
  if (currentUser.identitySource !== 'trusted_proxy') {
    throw new ForbiddenException(
      '[repair_typed_correction_identity_source_invalid] 非可信代理身份被拒绝',
    );
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
    throw new ForbiddenException(
      '[repair_typed_correction_actor_revoked] 当前人员身份已撤销或变化',
    );
  }
  const bindings = await manager.query(
    `SELECT id, role_id FROM user_roles WHERE user_id = ? ORDER BY role_id, id FOR SHARE`,
    [currentUser.id],
  ) as Array<{ id: number; role_id: number }>;
  const roleIds = bindings.map((row) => Number(row.role_id));
  if (roleIds.length !== new Set(roleIds).size) {
    throw new ForbiddenException(
      '[repair_typed_correction_role_binding_duplicate] 正式角色绑定重复',
    );
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
    throw new ForbiddenException('[repair_typed_correction_role_revoked] 正式角色已撤销');
  }
  const allowedRoles = phase === 'approve' || phase === 'reject' ? checkerRoles : proposerRoles;
  const roleCodes = roles.map((role) => role.code);
  if (!roleCodes.some((role) => allowedRoles.has(role))) {
    throw new ForbiddenException('[repair_typed_correction_role_denied] 当前角色无该阶段权限');
  }
  const employees = await manager.query(
    `SELECT id FROM employees
      WHERE linked_user_id = ? AND status = 1
      ORDER BY id FOR SHARE`,
    [currentUser.id],
  ) as Array<{ id: number }>;
  if (employees.length !== 1) {
    throw new ForbiddenException(
      '[repair_typed_correction_employee_binding_invalid] 缺少唯一有效员工绑定',
    );
  }
  return { userId: currentUser.id, employeeId: Number(employees[0].id), roleCodes };
}

function permissionFor(phase: CorrectionPhaseV1): string {
  if (phase === 'draft') return DRAFT_PERMISSION;
  if (phase === 'submit') return SUBMIT_PERMISSION;
  return DECIDE_PERMISSION;
}

async function assertScopeGrant(
  actor: LockedActorV1,
  phase: CorrectionPhaseV1,
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
  const now = new Date(String(nowRows[0]?.server_now)).getTime();
  if (!Number.isFinite(now)) {
    failClosed('repair_typed_correction_server_time_invalid', '数据库当前时间无效');
  }
  const matching = grants.filter((grant) => {
    const validFrom = new Date(String(grant.valid_from)).getTime();
    const validUntil = grant.valid_until == null
      ? null
      : new Date(String(grant.valid_until)).getTime();
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
    throw new ForbiddenException('[repair_typed_correction_scope_denied] 当前组织范围被明确拒绝');
  }
  if (!matching.some((grant) => grant.effect === 'allow')) {
    throw new ForbiddenException('[repair_typed_correction_scope_missing] 当前组织范围缺少精确授权');
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
    throw new NotFoundException('[repair_typed_correction_profile_missing] 维修工单画像不存在');
  }
  if (
    !rows[0].companyRef ||
    !rows[0].businessSectorRef ||
    !rows[0].storeRef ||
    !rows[0].customerRef
  ) {
    failClosed('repair_typed_correction_profile_scope_incomplete', '维修工单组织范围不完整');
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
    failClosed(
      'repair_typed_correction_locked_scope_tuple_drift',
      '工单授权范围在锁定前后发生变化',
    );
  }
}

function canonicalDbValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function canonicalRows(rows: readonly Record<string, unknown>[]): readonly Record<string, unknown>[] {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, canonicalDbValue(value)]),
  ));
}

function attributionSnapshotHash(rows: readonly AttributionRowV1[]): string {
  if (rows.length !== 3) {
    failClosed('repair_typed_correction_attribution_count_invalid', '原贡献必须有三角色归因');
  }
  const canonical = rows
    .map((row) => {
      if (
        row.status !== 'confirmed' ||
        row.confirmed_by == null ||
        row.confirmed_at == null ||
        row.origin_business_domain !== 'repair'
      ) {
        failClosed('repair_typed_correction_attribution_state_invalid', '原贡献归因尚未正式确认');
      }
      return {
        role: row.role,
        originBusinessDomain: row.origin_business_domain,
        employeeId: Number(row.employee_id),
        employeeGroupIdSnapshot: Number(row.employee_group_id_snapshot),
        shareBps: Number(row.share_bps),
        evidenceRef: row.evidence_ref.trim(),
        evidenceHash: lowerHash(
          row.evidence_hash,
          'repair_typed_correction_attribution_hash_invalid',
          '归因证据哈希',
        ),
      };
    })
    .sort(
      (left, right) =>
        left.role.localeCompare(right.role) ||
        left.employeeId - right.employeeId ||
        left.originBusinessDomain.localeCompare(right.originBusinessDomain) ||
        left.employeeGroupIdSnapshot - right.employeeGroupIdSnapshot ||
        left.shareBps - right.shareBps ||
        left.evidenceRef.localeCompare(right.evidenceRef) ||
        left.evidenceHash.localeCompare(right.evidenceHash),
    );
  if (
    new Set(canonical.map((item) => item.role)).size !== 3 ||
    !['business_owner', 'lead_originator', 'service_owner'].every((role) =>
      canonical.some((item) => item.role === role),
    ) ||
    canonical.reduce((sum, item) => sum + item.shareBps, 0) !== 10000
  ) {
    failClosed('repair_typed_correction_attribution_shape_invalid', '三角色归因或份额不完整');
  }
  return canonicalHash({ attributions: canonical });
}

async function lockSourceGraph(
  workOrderId: number,
  originalContributionId: number,
  actorUserId: number,
  preview: ProfileRowV1,
  manager: EntityManager,
): Promise<LockedCorrectionGraphV1> {
  const locatorRows = await manager.query(
    `SELECT economic_root_id
       FROM repair_work_order_economic_lineages
      WHERE work_order_id = ?`,
    [workOrderId],
  ) as Array<{ economic_root_id: string }>;
  if (locatorRows.length !== 1 || !LOWER_HEX_64.test(locatorRows[0].economic_root_id)) {
    failClosed('repair_typed_correction_lineage_missing', '维修工单缺少唯一经济根绑定');
  }
  const economicRootId = locatorRows[0].economic_root_id;
  await manager.query(
    `INSERT IGNORE INTO repair_correction_authority_mutexes
       (economic_root_id, created_by_user_id) VALUES (?, ?)`,
    [economicRootId, actorUserId],
  );
  const mutexes = await manager.query(
    `SELECT economic_root_id
       FROM repair_correction_authority_mutexes
      WHERE economic_root_id = ? FOR UPDATE`,
    [economicRootId],
  );
  if (mutexes.length !== 1) {
    failClosed('repair_typed_correction_mutex_missing', '更正权威互斥锁缺失');
  }
  const lineages = await manager.query(
    `SELECT work_order_id, economic_root_id
       FROM repair_work_order_economic_lineages
      WHERE work_order_id = ? FOR UPDATE`,
    [workOrderId],
  ) as Array<{ work_order_id: string | number; economic_root_id: string }>;
  if (
    lineages.length !== 1 ||
    lineages[0].economic_root_id !== economicRootId
  ) {
    failClosed('repair_typed_correction_lineage_drift', '经济根绑定在加锁前后漂移');
  }
  const roots = await manager.query(
    `SELECT economic_root_id, business_domain, origin_work_order_id
       FROM business_contribution_economic_fact_roots
      WHERE economic_root_id = ? FOR UPDATE`,
    [economicRootId],
  ) as RootRowV1[];
  if (roots.length !== 1 || roots[0].business_domain !== 'repair') {
    failClosed('repair_typed_correction_root_invalid', '经济根不存在或不属于维修域');
  }
  const profile = await loadProfile(workOrderId, manager, true);
  assertProfileStable(profile, preview);
  const contributions = await manager.query(
    `SELECT id, canonical_economic_fact_root_id AS economic_root_id,
            business_domain, company_ref,
            business_sector_ref, store_ref, customer_ref, operating_group_id,
            responsibility_employee_id_snapshot, economic_fact_key,
            authority_snapshot_hash, revenue_cents, direct_cost_total_cents,
            valid_contribution_margin_cents, currency, confirmation_status,
            reversal_of_contribution_id, reversed_by_contribution_id, version,
            confirmed_by, confirmed_at
       FROM business_contributions
      WHERE id = ? FOR UPDATE`,
    [originalContributionId],
  ) as ContributionRowV1[];
  if (contributions.length !== 1) {
    failClosed('repair_typed_correction_original_missing', '原贡献不存在');
  }
  const contribution = contributions[0];
  if (
    contribution.economic_root_id !== economicRootId ||
    contribution.business_domain !== 'repair' ||
    contribution.company_ref !== profile.companyRef ||
    contribution.business_sector_ref !== profile.businessSectorRef ||
    contribution.store_ref !== profile.storeRef ||
    contribution.customer_ref !== profile.customerRef ||
    contribution.currency !== 'CNY' ||
    contribution.confirmation_status !== 'confirmed' ||
    contribution.reversal_of_contribution_id != null ||
    contribution.reversed_by_contribution_id != null ||
    contribution.confirmed_by == null ||
    contribution.confirmed_at == null
  ) {
    failClosed('repair_typed_correction_original_state_invalid', '原贡献范围或正式状态无效');
  }
  const originalRevenue = storedSignedCents(
    contribution.revenue_cents,
    'repair_typed_correction_original_amount_invalid',
    '原收入',
  );
  const originalCost = storedSignedCents(
    contribution.direct_cost_total_cents,
    'repair_typed_correction_original_amount_invalid',
    '原直接成本',
  );
  const originalMargin = storedSignedCents(
    contribution.valid_contribution_margin_cents,
    'repair_typed_correction_original_amount_invalid',
    '原贡献毛利',
  );
  if (originalRevenue <= 0n || originalCost < 0n || originalMargin !== originalRevenue - originalCost) {
    failClosed('repair_typed_correction_original_amount_invalid', '原贡献金额公式无效');
  }
  const attributions = await manager.query(
    `SELECT id, contribution_id, role, origin_business_domain, employee_id,
            employee_group_id_snapshot, share_bps, evidence_ref, evidence_hash,
            status, confirmed_by, confirmed_at
       FROM business_contribution_attributions
      WHERE contribution_id = ?
      ORDER BY role, employee_id, id FOR UPDATE`,
    [originalContributionId],
  ) as AttributionRowV1[];
  const originalAttributionSnapshotHash = attributionSnapshotHash(attributions);
  const assignments = await manager.query(
    `SELECT id, authority_ref, economic_root_id, work_order_id,
            authority_version, content_hash, status
       FROM repair_contribution_assignment_authorities
      WHERE economic_root_id = ? AND status = 'approved'
      ORDER BY authority_version, id FOR UPDATE`,
    [economicRootId],
  ) as AssignmentRowV1[];
  if (assignments.length !== 1 || Number(assignments[0].work_order_id) !== workOrderId) {
    failClosed('repair_typed_correction_assignment_ambiguous', '当前责任归因权威不唯一');
  }
  const baselines = await manager.query(
    `SELECT id, authority_ref, economic_root_id, work_order_id,
            authority_version, assignment_authority_id,
            assignment_authority_version, assignment_content_hash,
            content_hash, profile_eligibility, total_direct_cost_cents, status
       FROM repair_cost_event_authorities
      WHERE economic_root_id = ? AND status = 'approved'
      ORDER BY authority_version, id FOR UPDATE`,
    [economicRootId],
  ) as BaselineRowV1[];
  if (
    baselines.length !== 1 ||
    Number(baselines[0].work_order_id) !== workOrderId ||
    Number(baselines[0].assignment_authority_id) !== Number(assignments[0].id) ||
    Number(baselines[0].assignment_authority_version) !== Number(assignments[0].authority_version) ||
    baselines[0].assignment_content_hash !== assignments[0].content_hash ||
    baselines[0].profile_eligibility !== 'eligible' ||
    storedSignedCents(
      baselines[0].total_direct_cost_cents,
      'repair_typed_correction_baseline_amount_invalid',
      '基线成本',
    ) !== 0n
  ) {
    failClosed('repair_typed_correction_baseline_invalid', '当前零外部成本基线权威无效');
  }
  const authorities = await manager.query(
    `SELECT id, authority_ref, correction_root_id, economic_root_id,
            original_contribution_id, work_order_id, authorized_company_ref,
            authorized_business_sector_ref, authorized_store_ref,
            authorized_customer_ref, correction_type, rule_version,
            authority_version, supersedes_authority_id,
            assignment_authority_id, assignment_authority_version,
            assignment_content_hash, baseline_cost_authority_id,
            baseline_cost_authority_version, baseline_cost_content_hash,
            original_contribution_version, original_economic_fact_key,
            original_authority_snapshot_hash, original_attribution_snapshot_hash,
            source_system, source_type, source_id, source_version,
            source_record_hash, source_fact_key, source_fact_hash,
            source_amount_cents, source_previous_cost_cents,
            source_revised_cost_cents, primary_evidence_ref,
            primary_evidence_hash, secondary_evidence_ref,
            secondary_evidence_hash, occurred_at, revenue_delta_cents,
            direct_cost_delta_cents, margin_delta_cents,
            correction_ledger_watermark_hash, content_hash,
            expected_work_order_version, status, created_by_user_id,
            submitted_by_user_id, approved_by_user_id, rejected_by_user_id,
            superseded_by_user_id, server_observed_at, confirmed_at
       FROM repair_typed_correction_authorities
      WHERE economic_root_id = ?
      ORDER BY correction_root_id, authority_version, id FOR UPDATE`,
    [economicRootId],
  ) as AuthorityRowV1[];
  const mappings = await manager.query(
    `SELECT id, authority_id, correction_root_id, economic_root_id,
            original_contribution_id, correction_type, generic_target_kind,
            generic_mapping_key, correction_sequence, revenue_delta_cents,
            direct_cost_delta_cents, margin_delta_cents, occurred_at,
            cumulative_revenue_before_cents, cumulative_direct_cost_before_cents,
            cumulative_revenue_after_cents, cumulative_direct_cost_after_cents,
            economic_period, recognition_period, recognition_at,
            deferred_from_period, catch_up_mode, skipped_locked_period_count,
            skipped_locked_periods_hash, ledger_watermark_hash, mapping_hash,
            materialization_state, status, supersedes_mapping_id,
            superseded_by_mapping_id
       FROM repair_typed_correction_mapping_plans
      WHERE economic_root_id = ?
      ORDER BY correction_sequence, id FOR UPDATE`,
    [economicRootId],
  ) as MappingRowV1[];
  const genericCorrections = await manager.query(
    `SELECT id, original_contribution_id, correction_type, sequence,
            revenue_delta_cents, direct_cost_delta_cents, margin_delta_cents,
            source_system, source_type, source_id, source_version,
            source_record_hash, unique_source_key, evidence_unique_key,
            economic_fact_key, authority_snapshot_hash,
            attribution_snapshot_hash, occurred_at, recognition_period,
            recognition_at, currency
       FROM business_contribution_corrections
      WHERE original_contribution_id = ?
      ORDER BY sequence, id FOR UPDATE`,
    [originalContributionId],
  ) as GenericCorrectionRowV1[];
  const genericReversals = await manager.query(
    `SELECT id, canonical_economic_fact_root_id AS economic_root_id,
            business_domain, company_ref,
            business_sector_ref, store_ref, customer_ref, operating_group_id,
            responsibility_employee_id_snapshot, economic_fact_key,
            authority_snapshot_hash, revenue_cents, direct_cost_total_cents,
            valid_contribution_margin_cents, currency, confirmation_status,
            reversal_of_contribution_id, reversed_by_contribution_id, version,
            confirmed_by, confirmed_at
       FROM business_contributions
      WHERE reversal_of_contribution_id = ?
      ORDER BY id FOR UPDATE`,
    [originalContributionId],
  ) as ContributionRowV1[];
  const nowRows = await manager.query(`SELECT CURRENT_TIMESTAMP(6) AS server_observed_at`);
  if (nowRows.length !== 1) {
    failClosed('repair_typed_correction_server_time_invalid', '数据库当前时间缺失');
  }
  const serverObservedAt = toIso(nowRows[0].server_observed_at as Date | string);
  const economicRows = authorities.filter((row) =>
    row.status === 'approved' || row.status === 'superseded',
  );
  const correctionLedgerWatermarkHash = canonicalHash({
    schemaVersion: REPAIR_TYPED_CORRECTION_SCHEMA_VERSION,
    originalContribution: canonicalRows([contribution as unknown as Record<string, unknown>])[0],
    genericCorrections: canonicalRows(
      genericCorrections as unknown as Record<string, unknown>[],
    ),
    genericReversals: canonicalRows(
      genericReversals as unknown as Record<string, unknown>[],
    ),
    typedAuthorities: canonicalRows(
      economicRows as unknown as Record<string, unknown>[],
    ),
    mappingPlans: canonicalRows(mappings as unknown as Record<string, unknown>[]),
  });
  return {
    profile,
    root: roots[0],
    contribution,
    attributions,
    attributionSnapshotHash: originalAttributionSnapshotHash,
    assignment: assignments[0],
    baseline: baselines[0],
    authorities,
    mappings,
    genericCorrections,
    genericReversals,
    serverObservedAt,
    correctionLedgerWatermarkHash,
  };
}

function assertDraftPins(
  normalized: Readonly<NormalizedDraftRepairTypedCorrectionAuthorityV1>,
  graph: LockedCorrectionGraphV1,
): void {
  const contribution = graph.contribution;
  if (
    Number(graph.profile.work_order_id) !== normalized.workOrderId ||
    Number(graph.profile.version) !== normalized.expectedWorkOrderVersion ||
    Number(contribution.id) !== normalized.originalContributionId ||
    Number(contribution.version) !== normalized.expectedOriginalContributionVersion ||
    contribution.economic_fact_key !== normalized.expectedEconomicFactKey ||
    contribution.authority_snapshot_hash !== normalized.expectedOriginalAuthoritySnapshotHash ||
    graph.attributionSnapshotHash !== normalized.expectedOriginalAttributionSnapshotHash ||
    graph.assignment.authority_ref !== normalized.expectedAssignmentAuthorityId ||
    Number(graph.assignment.authority_version) !== normalized.expectedAssignmentAuthorityVersion ||
    graph.assignment.content_hash !== normalized.expectedAssignmentContentHash ||
    graph.baseline.authority_ref !== normalized.expectedBaselineCostAuthorityId ||
    Number(graph.baseline.authority_version) !== normalized.expectedBaselineCostAuthorityVersion ||
    graph.baseline.content_hash !== normalized.expectedBaselineCostContentHash
  ) {
    failClosed('repair_typed_correction_pinned_graph_drift', '工单、原贡献或前置权威 pin 已漂移');
  }
  if (new Date(normalized.sourceFact.occurredAt).getTime() > new Date(graph.serverObservedAt).getTime()) {
    failClosed('repair_typed_correction_future_source_forbidden', '来源经济发生时间不得晚于数据库观察时间');
  }
}

function assertCorrectionDeltaShape(
  correctionType: RepairTypedCorrectionTypeV1,
  revenueDelta: bigint,
  directCostDelta: bigint,
  marginDelta: bigint,
): void {
  const valid =
    (correctionType === 'customer_refund' && revenueDelta < 0n && directCostDelta === 0n) ||
    (correctionType === 'rework_direct_cost' && revenueDelta === 0n && directCostDelta > 0n) ||
    (correctionType === 'supplier_cost_recovery' && revenueDelta === 0n && directCostDelta < 0n) ||
    (correctionType === 'direct_cost_adjustment' && revenueDelta === 0n && directCostDelta !== 0n) ||
    (correctionType === 'full_void' && revenueDelta < 0n && directCostDelta <= 0n);
  if (!valid || marginDelta !== revenueDelta - directCostDelta) {
    failClosed('repair_typed_correction_delta_shape_invalid', '更正金额方向或毛利公式无效');
  }
}

function assertGenericCorrectionRow(
  row: GenericCorrectionRowV1,
  graph: LockedCorrectionGraphV1,
  expectedSequence: number,
): Readonly<{ revenueDelta: bigint; directCostDelta: bigint }> {
  const allowed = [
    'customer_refund',
    'rework_direct_cost',
    'supplier_cost_recovery',
    'full_void',
  ];
  if (
    Number(row.original_contribution_id) !== Number(graph.contribution.id) ||
    Number(row.sequence) !== expectedSequence ||
    !allowed.includes(row.correction_type) ||
    row.economic_fact_key !== graph.contribution.economic_fact_key ||
    row.attribution_snapshot_hash !== graph.attributionSnapshotHash ||
    row.currency !== 'CNY'
  ) {
    failClosed('repair_typed_correction_generic_ledger_corrupt', '现有通用更正账本绑定或序列无效');
  }
  const revenueDelta = storedSignedCents(
    row.revenue_delta_cents,
    'repair_typed_correction_generic_ledger_corrupt',
    '通用更正收入',
  );
  const directCostDelta = storedSignedCents(
    row.direct_cost_delta_cents,
    'repair_typed_correction_generic_ledger_corrupt',
    '通用更正成本',
  );
  const marginDelta = storedSignedCents(
    row.margin_delta_cents,
    'repair_typed_correction_generic_ledger_corrupt',
    '通用更正毛利',
  );
  assertCorrectionDeltaShape(
    row.correction_type as RepairTypedCorrectionTypeV1,
    revenueDelta,
    directCostDelta,
    marginDelta,
  );
  return { revenueDelta, directCostDelta };
}

function assertActiveMappingRow(
  row: MappingRowV1,
  graph: LockedCorrectionGraphV1,
): Readonly<{ revenueDelta: bigint; directCostDelta: bigint }> {
  const authority = graph.authorities.find((candidate) => Number(candidate.id) === Number(row.authority_id));
  if (
    row.status !== 'active' ||
    row.materialization_state !== 'planned_unwired' ||
    row.economic_root_id !== graph.root.economic_root_id ||
    Number(row.original_contribution_id) !== Number(graph.contribution.id) ||
    !authority ||
    authority.status !== 'approved' ||
    authority.correction_root_id !== row.correction_root_id ||
    authority.correction_type !== row.correction_type ||
    row.generic_target_kind !== (row.correction_type === 'full_void' ? 'full_reversal' : 'typed_correction')
  ) {
    failClosed('repair_typed_correction_mapping_graph_corrupt', '现有唯一映射计划图无效');
  }
  const revenueDelta = storedSignedCents(
    row.revenue_delta_cents,
    'repair_typed_correction_mapping_graph_corrupt',
    '映射收入',
  );
  const directCostDelta = storedSignedCents(
    row.direct_cost_delta_cents,
    'repair_typed_correction_mapping_graph_corrupt',
    '映射成本',
  );
  const marginDelta = storedSignedCents(
    row.margin_delta_cents,
    'repair_typed_correction_mapping_graph_corrupt',
    '映射毛利',
  );
  assertCorrectionDeltaShape(row.correction_type, revenueDelta, directCostDelta, marginDelta);
  if (
    authority.revenue_delta_cents.toString() !== revenueDelta.toString() ||
    authority.direct_cost_delta_cents.toString() !== directCostDelta.toString() ||
    authority.margin_delta_cents.toString() !== marginDelta.toString() ||
    row.ledger_watermark_hash !== authority.correction_ledger_watermark_hash
  ) {
    failClosed('repair_typed_correction_mapping_graph_corrupt', '权威与映射计划金额或 watermark 不一致');
  }
  return { revenueDelta, directCostDelta };
}

function calculateLedgerBalance(
  graph: LockedCorrectionGraphV1,
  excludeCorrectionRootId: string | null,
): LedgerBalanceV1 {
  let remainingRevenueCents = storedSignedCents(
    graph.contribution.revenue_cents,
    'repair_typed_correction_original_amount_invalid',
    '原收入',
  );
  let remainingDirectCostCents = storedSignedCents(
    graph.contribution.direct_cost_total_cents,
    'repair_typed_correction_original_amount_invalid',
    '原直接成本',
  );
  let genericFullVoidCount = 0;
  for (let index = 0; index < graph.genericCorrections.length; index += 1) {
    const row = graph.genericCorrections[index];
    const delta = assertGenericCorrectionRow(row, graph, index + 1);
    if (row.correction_type === 'full_void') genericFullVoidCount += 1;
    remainingRevenueCents += delta.revenueDelta;
    remainingDirectCostCents += delta.directCostDelta;
    if (remainingRevenueCents < 0n || remainingDirectCostCents < 0n) {
      failClosed('repair_typed_correction_generic_ledger_corrupt', '通用更正累计余额小于零');
    }
  }
  if (
    genericFullVoidCount > 1 ||
    (genericFullVoidCount === 1 && graph.genericCorrections.length !== 1)
  ) {
    failClosed('repair_typed_correction_full_void_partial_conflict', '通用 full_void 与部分更正混用');
  }

  const activeMappings = graph.mappings
    .filter((row) => row.status === 'active')
    .sort(
      (left, right) =>
        Number(left.correction_sequence) - Number(right.correction_sequence) ||
        Number(left.id) - Number(right.id),
    );
  const activeSequences = activeMappings.map((row) => Number(row.correction_sequence));
  for (let index = 0; index < activeSequences.length; index += 1) {
    const expected = graph.genericCorrections.length + index + 1;
    if (activeSequences[index] !== expected) {
      failClosed('repair_typed_correction_catch_up_sequence_invalid', '通用更正与映射计划序列不连续');
    }
  }
  let activePartialCount = graph.genericCorrections.filter(
    (row) => row.correction_type !== 'full_void',
  ).length;
  let hasActiveFullVoid = genericFullVoidCount === 1;
  let replacementSequence: number | null = null;
  for (const row of activeMappings) {
    const delta = assertActiveMappingRow(row, graph);
    if (row.correction_root_id === excludeCorrectionRootId) {
      if (replacementSequence != null) {
        failClosed('repair_typed_correction_mapping_graph_corrupt', '替代根存在多个活动映射');
      }
      replacementSequence = Number(row.correction_sequence);
      continue;
    }
    remainingRevenueCents += delta.revenueDelta;
    remainingDirectCostCents += delta.directCostDelta;
    if (remainingRevenueCents < 0n || remainingDirectCostCents < 0n) {
      failClosed('repair_typed_correction_mapping_graph_corrupt', '映射计划累计余额小于零');
    }
    if (row.correction_type === 'full_void') hasActiveFullVoid = true;
    else activePartialCount += 1;
  }
  if (hasActiveFullVoid && activePartialCount !== 0) {
    failClosed('repair_typed_correction_full_void_partial_conflict', 'full_void 与部分更正必须严格互斥');
  }
  if (graph.genericReversals.length > 1) {
    failClosed('repair_typed_correction_generic_reversal_ambiguous', '通用全额冲销不唯一');
  }
  if (graph.genericReversals.length === 1) {
    const reversal = graph.genericReversals[0];
    if (
      Number(reversal.reversal_of_contribution_id) !== Number(graph.contribution.id) ||
      reversal.confirmation_status !== 'confirmed' ||
      reversal.business_domain !== 'repair'
    ) {
      failClosed('repair_typed_correction_generic_reversal_corrupt', '通用全额冲销状态无效');
    }
  }
  return {
    remainingRevenueCents,
    remainingDirectCostCents,
    nextSequence: replacementSequence ??
      graph.genericCorrections.length + activeMappings.length + 1,
    activePartialCount,
    hasActiveFullVoid,
    hasGenericFullReversal: graph.genericReversals.length === 1,
  };
}

function assertSourceFactAvailable(
  sourceFact: Readonly<NormalizedRepairTypedCorrectionSourceFactV1>,
  graph: LockedCorrectionGraphV1,
  allowedCorrectionRootId: string | null,
  currentAuthorityRef: string | null = null,
): void {
  const sameStableSourceIdentity = (row: Readonly<{
    source_system: string;
    source_type: string;
    source_id: string;
  }>): boolean =>
    row.source_system === sourceFact.sourceSystem &&
    row.source_type === sourceFact.sourceType &&
    row.source_id === sourceFact.sourceId;
  if (graph.genericCorrections.some(sameStableSourceIdentity)) {
    failClosed('repair_typed_correction_source_already_generic', '同一来源事实已进入通用更正账本');
  }
  const competing = graph.authorities.filter((row) =>
    row.authority_ref !== currentAuthorityRef &&
    ['draft', 'submitted', 'approved', 'rejected', 'superseded'].includes(row.status) &&
    (
      row.source_fact_key === sourceFact.sourceFactKey ||
      sameStableSourceIdentity(row)
    ) &&
    row.correction_root_id !== allowedCorrectionRootId,
  );
  if (competing.length) {
    failClosed('repair_typed_correction_source_already_claimed', '同一来源事实已被另一更正根占用');
  }
}

function settlementPeriodOfInstant(instant: string): string {
  const shanghai = new Date(new Date(instant).getTime() + 8 * 60 * 60 * 1000);
  return `${shanghai.getUTCFullYear().toString().padStart(4, '0')}-${(shanghai.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}`;
}

function assertSettlementPeriod(period: string): void {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) {
    failClosed('repair_typed_correction_period_invalid', '统计周期格式无效');
  }
}

function settlementPeriodStartInstant(period: string): string {
  assertSettlementPeriod(period);
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1) - 8 * 60 * 60 * 1000).toISOString();
}

function nextSettlementPeriod(period: string): string {
  assertSettlementPeriod(period);
  const [year, month] = period.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear().toString().padStart(4, '0')}-${(next.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}`;
}

function assertLockState(
  kind: 'group_target' | 'labor_cost_snapshot',
  id: unknown,
  status: unknown,
  lockedAt: unknown,
): boolean {
  if (!['calculated', 'calculation_blocked', 'recalculation_required', 'locked'].includes(String(status))) {
    failClosed('repair_typed_correction_period_lock_state_unknown', `${kind} ${String(id)} 状态未知`);
  }
  const isLocked = status === 'locked';
  if (isLocked !== (lockedAt != null)) {
    failClosed(
      'repair_typed_correction_period_lock_state_inconsistent',
      `${kind} ${String(id)} 状态与冻结时间不一致`,
    );
  }
  return isLocked;
}

async function inspectPeriodLocks(
  graph: LockedCorrectionGraphV1,
  recognitionPeriod: string,
  manager: EntityManager,
): Promise<string[]> {
  assertSettlementPeriod(recognitionPeriod);
  const groupId = Number(graph.contribution.operating_group_id);
  const targets = await manager.query(
    `SELECT id, calculation_status, locked_at
       FROM group_targets
      WHERE group_id = ? AND settlement_period = ?
      ORDER BY calculation_version, id FOR UPDATE`,
    [groupId, recognitionPeriod],
  ) as Array<{ id: unknown; calculation_status: unknown; locked_at: unknown }>;
  const employeeIds = [...new Set(graph.attributions.map((row) => Number(row.employee_id)))]
    .sort((left, right) => left - right);
  if (!employeeIds.length) {
    failClosed('repair_typed_correction_period_guard_attribution_missing', '期间守卫缺少归因员工');
  }
  const snapshots = await manager.query(
    `SELECT id, snapshot_status, locked_at
       FROM labor_cost_snapshots
      WHERE settlement_period = ?
        AND (group_id = ? OR employee_id IN (${employeeIds.map(() => '?').join(',')}))
      ORDER BY group_id, employee_id, calculation_version, id FOR UPDATE`,
    [recognitionPeriod, groupId, ...employeeIds],
  ) as Array<{ id: unknown; snapshot_status: unknown; locked_at: unknown }>;
  const reasons: string[] = [];
  for (const row of targets) {
    if (assertLockState('group_target', row.id, row.calculation_status, row.locked_at)) {
      reasons.push(`group_target:${String(row.id)}`);
    }
  }
  for (const row of snapshots) {
    if (assertLockState('labor_cost_snapshot', row.id, row.snapshot_status, row.locked_at)) {
      reasons.push(`labor_cost_snapshot:${String(row.id)}`);
    }
  }
  return reasons.sort();
}

async function resolveRecognition(
  graph: LockedCorrectionGraphV1,
  occurredAt: string,
  manager: EntityManager,
): Promise<RecognitionDecisionV1> {
  const economicPeriod = settlementPeriodOfInstant(occurredAt);
  let recognitionPeriod = economicPeriod;
  const serverNow = new Date(graph.serverObservedAt).getTime();
  const skippedLockedPeriods: Array<{
    recognitionPeriod: string;
    lockedReasons: readonly string[];
  }> = [];
  for (let index = 0; index < MAX_PERIOD_SCAN_MONTHS; index += 1) {
    const periodStart = settlementPeriodStartInstant(recognitionPeriod);
    if (new Date(periodStart).getTime() > serverNow) {
      failClosed(
        'repair_typed_correction_open_period_not_started',
        '尚无已开始的后续开放周期',
      );
    }
    const lockedReasons = await inspectPeriodLocks(graph, recognitionPeriod, manager);
    if (!lockedReasons.length) {
      const catchUpMode: RepairTypedCorrectionCatchUpModeV1 =
        recognitionPeriod === economicPeriod ? 'same_period' : 'locked_period_catch_up';
      return {
        economicPeriod,
        recognitionPeriod,
        recognitionAt: recognitionPeriod === economicPeriod ? occurredAt : periodStart,
        deferredFromPeriod: recognitionPeriod === economicPeriod ? null : economicPeriod,
        catchUpMode,
        skippedLockedPeriods,
        skippedLockedPeriodsHash: canonicalHash({
          schemaVersion: REPAIR_TYPED_CORRECTION_SCHEMA_VERSION,
          economicPeriod,
          recognitionPeriod,
          skippedLockedPeriods,
        }),
      };
    }
    skippedLockedPeriods.push({ recognitionPeriod, lockedReasons });
    recognitionPeriod = nextSettlementPeriod(recognitionPeriod);
  }
  failClosed(
    'repair_typed_correction_open_period_not_found',
    `${MAX_PERIOD_SCAN_MONTHS} 个月扫描上限内没有开放周期`,
  );
}

function sourceFactFromAuthority(
  authority: AuthorityRowV1,
): Readonly<NormalizedRepairTypedCorrectionSourceFactV1> {
  const source = normalizeSourceFact(
    {
      sourceSystem: authority.source_system,
      sourceType: authority.source_type,
      sourceId: authority.source_id,
      sourceVersion: authority.source_version,
      sourceRecordHash: authority.source_record_hash,
      occurredAt: toIso(authority.occurred_at),
      amountCents: authority.source_amount_cents == null
        ? null
        : String(authority.source_amount_cents),
      previousDirectCostCents: authority.source_previous_cost_cents == null
        ? null
        : String(authority.source_previous_cost_cents),
      revisedDirectCostCents: authority.source_revised_cost_cents == null
        ? null
        : String(authority.source_revised_cost_cents),
      primaryEvidenceRef: authority.primary_evidence_ref,
      primaryEvidenceHash: authority.primary_evidence_hash,
      secondaryEvidenceRef: authority.secondary_evidence_ref,
      secondaryEvidenceHash: authority.secondary_evidence_hash,
    },
    authority.correction_type,
    authority.original_economic_fact_key,
  );
  if (
    source.sourceFactKey !== authority.source_fact_key ||
    source.sourceFactHash !== authority.source_fact_hash
  ) {
    failClosed('repair_typed_correction_source_fact_hash_mismatch', '来源事实哈希不一致');
  }
  return source;
}

function canonicalAuthorityContent(authority: AuthorityRowV1): Record<string, unknown> {
  return {
    schemaVersion: REPAIR_TYPED_CORRECTION_SCHEMA_VERSION,
    ruleVersion: authority.rule_version,
    authorityRef: authority.authority_ref,
    correctionRootId: authority.correction_root_id,
    economicRootId: authority.economic_root_id,
    originalContributionId: Number(authority.original_contribution_id),
    workOrderId: Number(authority.work_order_id),
    authorizedScope: {
      companyRef: authority.authorized_company_ref,
      businessSectorRef: authority.authorized_business_sector_ref,
      storeRef: authority.authorized_store_ref,
      customerRef: authority.authorized_customer_ref,
    },
    correctionType: authority.correction_type,
    authorityVersion: Number(authority.authority_version),
    supersedesAuthorityId: authority.supersedes_authority_id == null
      ? null
      : Number(authority.supersedes_authority_id),
    assignmentAuthorityId: Number(authority.assignment_authority_id),
    assignmentAuthorityVersion: Number(authority.assignment_authority_version),
    assignmentContentHash: authority.assignment_content_hash,
    baselineCostAuthorityId: Number(authority.baseline_cost_authority_id),
    baselineCostAuthorityVersion: Number(authority.baseline_cost_authority_version),
    baselineCostContentHash: authority.baseline_cost_content_hash,
    originalContributionVersion: Number(authority.original_contribution_version),
    originalEconomicFactKey: authority.original_economic_fact_key,
    originalAuthoritySnapshotHash: authority.original_authority_snapshot_hash,
    originalAttributionSnapshotHash: authority.original_attribution_snapshot_hash,
    sourceFact: {
      sourceSystem: authority.source_system,
      sourceType: authority.source_type,
      sourceId: authority.source_id,
      sourceVersion: authority.source_version,
      sourceRecordHash: authority.source_record_hash,
      sourceFactKey: authority.source_fact_key,
      sourceFactHash: authority.source_fact_hash,
      amountCents: authority.source_amount_cents == null
        ? null
        : String(authority.source_amount_cents),
      previousDirectCostCents: authority.source_previous_cost_cents == null
        ? null
        : String(authority.source_previous_cost_cents),
      revisedDirectCostCents: authority.source_revised_cost_cents == null
        ? null
        : String(authority.source_revised_cost_cents),
      primaryEvidenceRef: authority.primary_evidence_ref,
      primaryEvidenceHash: authority.primary_evidence_hash,
      secondaryEvidenceRef: authority.secondary_evidence_ref,
      secondaryEvidenceHash: authority.secondary_evidence_hash,
      occurredAt: toIso(authority.occurred_at),
    },
    revenueDeltaCents: String(authority.revenue_delta_cents),
    directCostDeltaCents: String(authority.direct_cost_delta_cents),
    marginDeltaCents: String(authority.margin_delta_cents),
    correctionLedgerWatermarkHash: authority.correction_ledger_watermark_hash,
    expectedWorkOrderVersion: Number(authority.expected_work_order_version),
    serverObservedAt: toIso(authority.server_observed_at),
  };
}

function assertAuthorityContent(authority: AuthorityRowV1): void {
  if (
    authority.rule_version !== REPAIR_TYPED_CORRECTION_RULE_VERSION ||
    !LOWER_HEX_64.test(authority.authority_ref) ||
    !LOWER_HEX_64.test(authority.correction_root_id) ||
    !LOWER_HEX_64.test(authority.economic_root_id) ||
    !LOWER_HEX_64.test(authority.original_economic_fact_key) ||
    !LOWER_HEX_64.test(authority.original_authority_snapshot_hash) ||
    !LOWER_HEX_64.test(authority.original_attribution_snapshot_hash) ||
    !LOWER_HEX_64.test(authority.correction_ledger_watermark_hash) ||
    !LOWER_HEX_64.test(authority.content_hash) ||
    Number(authority.authority_version) < 1
  ) {
    failClosed('repair_typed_correction_authority_shape_invalid', '已保存权威基础字段无效');
  }
  sourceFactFromAuthority(authority);
  const revenueDelta = storedSignedCents(
    authority.revenue_delta_cents,
    'repair_typed_correction_authority_amount_invalid',
    '权威收入修正',
  );
  const directCostDelta = storedSignedCents(
    authority.direct_cost_delta_cents,
    'repair_typed_correction_authority_amount_invalid',
    '权威成本修正',
  );
  const marginDelta = storedSignedCents(
    authority.margin_delta_cents,
    'repair_typed_correction_authority_amount_invalid',
    '权威毛利修正',
  );
  assertCorrectionDeltaShape(authority.correction_type, revenueDelta, directCostDelta, marginDelta);
  if (
    new Date(toIso(authority.occurred_at)).getTime() >
      new Date(toIso(authority.server_observed_at)).getTime()
  ) {
    failClosed('repair_typed_correction_time_order_invalid', '经济发生时间晚于服务端观察时间');
  }
  if (
    authority.confirmed_at != null &&
    new Date(toIso(authority.server_observed_at)).getTime() >
      new Date(toIso(authority.confirmed_at)).getTime()
  ) {
    failClosed('repair_typed_correction_time_order_invalid', '审核确认时间早于服务端观察时间');
  }
  if (canonicalHash(canonicalAuthorityContent(authority)) !== authority.content_hash) {
    failClosed('repair_typed_correction_content_hash_mismatch', '权威内容哈希不一致');
  }
}

function canonicalCorrectionRoot(
  graph: LockedCorrectionGraphV1,
  correctionType: RepairTypedCorrectionTypeV1,
  sourceFact: Readonly<NormalizedRepairTypedCorrectionSourceFactV1>,
): string {
  return canonicalHash({
    schemaVersion: REPAIR_TYPED_CORRECTION_SCHEMA_VERSION,
    economicRootId: graph.root.economic_root_id,
    originalContributionId: Number(graph.contribution.id),
    correctionType,
    sourceSystem: sourceFact.sourceSystem,
    sourceType: sourceFact.sourceType,
    sourceId: sourceFact.sourceId,
  });
}

function predecessorFor(
  normalized: Readonly<NormalizedDraftRepairTypedCorrectionAuthorityV1>,
  graph: LockedCorrectionGraphV1,
): AuthorityRowV1 | null {
  if (normalized.supersedesAuthorityId == null) return null;
  const predecessor = graph.authorities.find(
    (row) => row.authority_ref === normalized.supersedesAuthorityId,
  );
  if (
    !predecessor ||
    predecessor.status !== 'approved' ||
    Number(predecessor.authority_version) !== normalized.expectedSupersededAuthorityVersion ||
    predecessor.correction_type !== normalized.correctionType ||
    predecessor.source_system !== normalized.sourceFact.sourceSystem ||
    predecessor.source_type !== normalized.sourceFact.sourceType ||
    predecessor.source_id !== normalized.sourceFact.sourceId
  ) {
    failClosed('repair_typed_correction_supersedes_drift', '被替代权威不是当前同源正式版本');
  }
  const approvedForRoot = graph.authorities.filter(
    (row) => row.correction_root_id === predecessor.correction_root_id && row.status === 'approved',
  );
  const activeMappings = graph.mappings.filter(
    (row) => row.correction_root_id === predecessor.correction_root_id && row.status === 'active',
  );
  const latestActiveSequence = graph.mappings
    .filter((row) => row.status === 'active')
    .reduce((highest, row) => Math.max(highest, Number(row.correction_sequence)), 0);
  if (
    approvedForRoot.length !== 1 ||
    approvedForRoot[0].id.toString() !== predecessor.id.toString() ||
    activeMappings.length !== 1 ||
    activeMappings[0].authority_id.toString() !== predecessor.id.toString() ||
    Number(activeMappings[0].correction_sequence) !== latestActiveSequence
  ) {
    failClosed(
      'repair_typed_correction_supersedes_drift',
      '被替代权威或唯一映射不再是当前尾部版本',
    );
  }
  return predecessor;
}

function assertStoredAuthorityGraph(
  authority: AuthorityRowV1,
  graph: LockedCorrectionGraphV1,
): LedgerBalanceV1 {
  assertAuthorityContent(authority);
  if (
    authority.economic_root_id !== graph.root.economic_root_id ||
    Number(authority.original_contribution_id) !== Number(graph.contribution.id) ||
    Number(authority.work_order_id) !== Number(graph.profile.work_order_id) ||
    authority.authorized_company_ref !== graph.profile.companyRef ||
    authority.authorized_business_sector_ref !== graph.profile.businessSectorRef ||
    authority.authorized_store_ref !== graph.profile.storeRef ||
    authority.authorized_customer_ref !== graph.profile.customerRef ||
    Number(authority.assignment_authority_id) !== Number(graph.assignment.id) ||
    Number(authority.assignment_authority_version) !== Number(graph.assignment.authority_version) ||
    authority.assignment_content_hash !== graph.assignment.content_hash ||
    Number(authority.baseline_cost_authority_id) !== Number(graph.baseline.id) ||
    Number(authority.baseline_cost_authority_version) !== Number(graph.baseline.authority_version) ||
    authority.baseline_cost_content_hash !== graph.baseline.content_hash ||
    Number(authority.original_contribution_version) !== Number(graph.contribution.version) ||
    authority.original_economic_fact_key !== graph.contribution.economic_fact_key ||
    authority.original_authority_snapshot_hash !== graph.contribution.authority_snapshot_hash ||
    authority.original_attribution_snapshot_hash !== graph.attributionSnapshotHash ||
    Number(authority.expected_work_order_version) !== Number(graph.profile.version) ||
    authority.correction_ledger_watermark_hash !== graph.correctionLedgerWatermarkHash
  ) {
    failClosed('repair_typed_correction_source_graph_drift', '更正权威依赖图已漂移');
  }
  const sourceFact = sourceFactFromAuthority(authority);
  if (canonicalCorrectionRoot(graph, authority.correction_type, sourceFact) !== authority.correction_root_id) {
    failClosed('repair_typed_correction_root_hash_mismatch', '更正根哈希不一致');
  }
  assertSourceFactAvailable(
    sourceFact,
    graph,
    authority.correction_root_id,
    authority.authority_ref,
  );
  const balance = calculateLedgerBalance(
    graph,
    authority.supersedes_authority_id == null ? null : authority.correction_root_id,
  );
  const derived = deriveRepairTypedCorrectionDeltaV1(
    authority.correction_type,
    sourceFact,
    {
      remainingRevenueCents: balance.remainingRevenueCents.toString(),
      remainingDirectCostCents: balance.remainingDirectCostCents.toString(),
      existingPartialCorrectionCount: balance.activePartialCount,
      hasFullVoid: balance.hasActiveFullVoid,
      hasGenericFullReversal: balance.hasGenericFullReversal,
    },
  );
  if (
    derived.revenueDeltaCents !== String(authority.revenue_delta_cents) ||
    derived.directCostDeltaCents !== String(authority.direct_cost_delta_cents) ||
    derived.marginDeltaCents !== String(authority.margin_delta_cents)
  ) {
    failClosed('repair_typed_correction_derived_delta_drift', '服务端推导金额与草稿不一致');
  }
  return balance;
}

function isDuplicate(error: unknown): boolean {
  const candidate = error as { code?: unknown; errno?: unknown };
  return candidate?.code === 'ER_DUP_ENTRY' || Number(candidate?.errno) === 1062;
}

function mapStorageFailure(error: unknown): never {
  if (
    error instanceof ConflictException ||
    error instanceof ForbiddenException ||
    error instanceof NotFoundException
  ) {
    throw error;
  }
  if (isDuplicate(error)) {
    failClosed('repair_typed_correction_contention', '唯一约束竞争导致操作回滚');
  }
  throw error;
}

async function claimIdempotency(
  phase: CorrectionPhaseV1,
  key: string,
  fingerprint: string,
  actorUserId: number,
  manager: EntityManager,
): Promise<void> {
  try {
    await manager.query(
      `INSERT INTO repair_typed_correction_idempotency_claims
         (idempotency_key, phase, request_fingerprint, actor_user_id, state)
       VALUES (?, ?, ?, ?, 'claimed')`,
      [key, phase, fingerprint, actorUserId],
    );
  } catch (error) {
    if (isDuplicate(error)) {
      throw new CorrectionIdempotencyRaceV1(phase, key, fingerprint);
    }
    throw error;
  }
}

async function loadCompletedClaim(
  phase: CorrectionPhaseV1,
  key: string,
  fingerprint: string,
  actorUserId: number,
  manager: EntityManager,
): Promise<ClaimRowV1> {
  const rows = await manager.query(
    `SELECT idempotency_key, phase, request_fingerprint, actor_user_id,
            state, authority_id, lifecycle_event_id
       FROM repair_typed_correction_idempotency_claims
      WHERE idempotency_key = ? FOR UPDATE`,
    [key],
  ) as ClaimRowV1[];
  if (rows.length !== 1) {
    failClosed('repair_typed_correction_idempotency_missing', '幂等声明不存在');
  }
  const claim = rows[0];
  if (
    claim.phase !== phase ||
    claim.request_fingerprint !== fingerprint ||
    Number(claim.actor_user_id) !== actorUserId
  ) {
    failClosed('repair_typed_correction_idempotency_conflict', '幂等键对应不同请求或人员');
  }
  if (
    claim.state !== 'completed' ||
    claim.authority_id == null ||
    claim.lifecycle_event_id == null
  ) {
    failClosed('repair_typed_correction_idempotency_incomplete', '幂等声明未形成完整结果');
  }
  return claim;
}

async function completeClaim(
  key: string,
  authorityId: number,
  lifecycleEventId: number,
  manager: EntityManager,
): Promise<void> {
  const result = await manager.query(
    `UPDATE repair_typed_correction_idempotency_claims
        SET state = 'completed', authority_id = ?, lifecycle_event_id = ?,
            completed_at = CURRENT_TIMESTAMP(6)
      WHERE idempotency_key = ? AND state = 'claimed'
        AND authority_id IS NULL AND lifecycle_event_id IS NULL`,
    [authorityId, lifecycleEventId, key],
  );
  if (Number(result?.affectedRows ?? -1) !== 1) {
    failClosed('repair_typed_correction_idempotency_graph_corrupt', '幂等完成状态竞争失败');
  }
}

async function insertEvent(
  authorityId: number,
  eventType: 'drafted' | 'submitted' | 'approved' | 'rejected' | 'superseded',
  fromStatus: RepairTypedCorrectionAuthorityStatusV1 | null,
  toStatus: RepairTypedCorrectionAuthorityStatusV1,
  actorUserId: number,
  reasonCode: string,
  evidenceReference: string,
  evidenceHashValue: string,
  requestFingerprint: string,
  authorityContentHash: string,
  mappingHash: string | null,
  manager: EntityManager,
): Promise<number> {
  const eventRef = randomBytes(32).toString('hex');
  const result = await manager.query(
    `INSERT INTO repair_typed_correction_lifecycle_events
       (event_ref, authority_id, event_type, from_status, to_status,
        actor_user_id, reason_code, evidence_ref, evidence_hash,
        request_fingerprint, authority_content_hash, mapping_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventRef,
      authorityId,
      eventType,
      fromStatus,
      toStatus,
      actorUserId,
      reasonCode,
      evidenceReference,
      evidenceHashValue,
      requestFingerprint,
      authorityContentHash,
      mappingHash,
    ],
  );
  const id = Number(result?.insertId ?? 0);
  if (!Number.isSafeInteger(id) || id < 1) {
    failClosed('repair_typed_correction_event_insert_missing', '生命周期事件写入后缺少标识');
  }
  return id;
}

const AUTHORITY_SELECT_COLUMNS = `
  id, authority_ref, correction_root_id, economic_root_id,
  original_contribution_id, work_order_id, authorized_company_ref,
  authorized_business_sector_ref, authorized_store_ref,
  authorized_customer_ref, correction_type, rule_version,
  authority_version, supersedes_authority_id, assignment_authority_id,
  assignment_authority_version, assignment_content_hash,
  baseline_cost_authority_id, baseline_cost_authority_version,
  baseline_cost_content_hash, original_contribution_version,
  original_economic_fact_key, original_authority_snapshot_hash,
  original_attribution_snapshot_hash, source_system, source_type,
  source_id, source_version, source_record_hash, source_fact_key,
  source_fact_hash, source_amount_cents, source_previous_cost_cents,
  source_revised_cost_cents, primary_evidence_ref, primary_evidence_hash,
  secondary_evidence_ref, secondary_evidence_hash, occurred_at,
  revenue_delta_cents, direct_cost_delta_cents, margin_delta_cents,
  correction_ledger_watermark_hash, content_hash,
  expected_work_order_version, status, created_by_user_id,
  submitted_by_user_id, approved_by_user_id, rejected_by_user_id,
  superseded_by_user_id, server_observed_at, confirmed_at`;

const MAPPING_SELECT_COLUMNS = `
  id, authority_id, correction_root_id, economic_root_id,
  original_contribution_id, correction_type, generic_target_kind,
  generic_mapping_key, correction_sequence, revenue_delta_cents,
  direct_cost_delta_cents, margin_delta_cents, occurred_at,
  cumulative_revenue_before_cents, cumulative_direct_cost_before_cents,
  cumulative_revenue_after_cents, cumulative_direct_cost_after_cents,
  economic_period, recognition_period, recognition_at,
  deferred_from_period, catch_up_mode, skipped_locked_period_count,
  skipped_locked_periods_hash, ledger_watermark_hash, mapping_hash,
  materialization_state, status, supersedes_mapping_id,
  superseded_by_mapping_id`;

async function loadAuthorityByOpaqueRef(
  authorityRef: string,
  manager: EntityManager,
  lock = false,
): Promise<AuthorityRowV1 | null> {
  const rows = await manager.query(
    `SELECT ${AUTHORITY_SELECT_COLUMNS}
       FROM repair_typed_correction_authorities
      WHERE authority_ref = ?${lock ? ' FOR UPDATE' : ''}`,
    [authorityRef],
  ) as AuthorityRowV1[];
  if (rows.length > 1) {
    failClosed('repair_typed_correction_authority_ambiguous', '更正权威引用不唯一');
  }
  return rows[0] ?? null;
}

async function minimalAuthorityLocator(
  authorityRef: string,
  manager: EntityManager,
): Promise<Readonly<{ workOrderId: number; originalContributionId: number }> | null> {
  const rows = await manager.query(
    `SELECT work_order_id, original_contribution_id
       FROM repair_typed_correction_authorities
      WHERE authority_ref = ?`,
    [authorityRef],
  ) as Array<{ work_order_id: string | number; original_contribution_id: string | number }>;
  if (rows.length > 1) {
    failClosed('repair_typed_correction_authority_ambiguous', '更正权威引用不唯一');
  }
  return rows[0]
    ? {
        workOrderId: Number(rows[0].work_order_id),
        originalContributionId: Number(rows[0].original_contribution_id),
      }
    : null;
}

async function loadMappingForAuthority(
  authorityId: number,
  manager: EntityManager,
  lock = false,
): Promise<MappingRowV1 | null> {
  const rows = await manager.query(
    `SELECT ${MAPPING_SELECT_COLUMNS}
       FROM repair_typed_correction_mapping_plans
      WHERE authority_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [authorityId],
  ) as MappingRowV1[];
  if (rows.length > 1) {
    failClosed('repair_typed_correction_mapping_ambiguous', '单一权威存在多个通用映射计划');
  }
  return rows[0] ?? null;
}

function genericMappingKeyFor(
  authority: AuthorityRowV1,
  correctionSequence: number,
): string {
  return canonicalHash({
    schemaVersion: REPAIR_TYPED_CORRECTION_SCHEMA_VERSION,
    authorityRef: authority.authority_ref,
    correctionRootId: authority.correction_root_id,
    economicRootId: authority.economic_root_id,
    originalContributionId: Number(authority.original_contribution_id),
    correctionType: authority.correction_type,
    genericTargetKind: authority.correction_type === 'full_void'
      ? 'full_reversal'
      : 'typed_correction',
    correctionSequence,
  });
}

function canonicalMappingContent(
  mapping: MappingRowV1,
  authority: AuthorityRowV1,
): Record<string, unknown> {
  return {
    schemaVersion: REPAIR_TYPED_CORRECTION_SCHEMA_VERSION,
    authorityRef: authority.authority_ref,
    authorityContentHash: authority.content_hash,
    correctionRootId: mapping.correction_root_id,
    economicRootId: mapping.economic_root_id,
    originalContributionId: Number(mapping.original_contribution_id),
    correctionType: mapping.correction_type,
    genericTargetKind: mapping.generic_target_kind,
    genericMappingKey: mapping.generic_mapping_key,
    correctionSequence: Number(mapping.correction_sequence),
    revenueDeltaCents: String(mapping.revenue_delta_cents),
    directCostDeltaCents: String(mapping.direct_cost_delta_cents),
    marginDeltaCents: String(mapping.margin_delta_cents),
    occurredAt: toIso(mapping.occurred_at),
    cumulativeRevenueBeforeCents: String(mapping.cumulative_revenue_before_cents),
    cumulativeDirectCostBeforeCents: String(mapping.cumulative_direct_cost_before_cents),
    cumulativeRevenueAfterCents: String(mapping.cumulative_revenue_after_cents),
    cumulativeDirectCostAfterCents: String(mapping.cumulative_direct_cost_after_cents),
    economicPeriod: mapping.economic_period,
    recognitionPeriod: mapping.recognition_period,
    recognitionAt: toIso(mapping.recognition_at),
    deferredFromPeriod: mapping.deferred_from_period,
    catchUpMode: mapping.catch_up_mode,
    skippedLockedPeriodCount: Number(mapping.skipped_locked_period_count),
    skippedLockedPeriodsHash: mapping.skipped_locked_periods_hash,
    ledgerWatermarkHash: mapping.ledger_watermark_hash,
    materializationState: mapping.materialization_state,
    supersedesMappingId: mapping.supersedes_mapping_id == null
      ? null
      : Number(mapping.supersedes_mapping_id),
  };
}

function assertMappingContent(mapping: MappingRowV1, authority: AuthorityRowV1): void {
  const revenueDelta = storedSignedCents(
    mapping.revenue_delta_cents,
    'repair_typed_correction_mapping_amount_invalid',
    '映射收入修正',
  );
  const directCostDelta = storedSignedCents(
    mapping.direct_cost_delta_cents,
    'repair_typed_correction_mapping_amount_invalid',
    '映射成本修正',
  );
  const marginDelta = storedSignedCents(
    mapping.margin_delta_cents,
    'repair_typed_correction_mapping_amount_invalid',
    '映射毛利修正',
  );
  const beforeRevenue = storedSignedCents(
    mapping.cumulative_revenue_before_cents,
    'repair_typed_correction_mapping_balance_invalid',
    '映射前收入余额',
  );
  const beforeCost = storedSignedCents(
    mapping.cumulative_direct_cost_before_cents,
    'repair_typed_correction_mapping_balance_invalid',
    '映射前成本余额',
  );
  const afterRevenue = storedSignedCents(
    mapping.cumulative_revenue_after_cents,
    'repair_typed_correction_mapping_balance_invalid',
    '映射后收入余额',
  );
  const afterCost = storedSignedCents(
    mapping.cumulative_direct_cost_after_cents,
    'repair_typed_correction_mapping_balance_invalid',
    '映射后成本余额',
  );
  assertCorrectionDeltaShape(mapping.correction_type, revenueDelta, directCostDelta, marginDelta);
  if (
    Number(mapping.authority_id) !== Number(authority.id) ||
    mapping.correction_root_id !== authority.correction_root_id ||
    mapping.economic_root_id !== authority.economic_root_id ||
    Number(mapping.original_contribution_id) !== Number(authority.original_contribution_id) ||
    mapping.correction_type !== authority.correction_type ||
    mapping.generic_target_kind !==
      (authority.correction_type === 'full_void' ? 'full_reversal' : 'typed_correction') ||
    mapping.generic_mapping_key !==
      genericMappingKeyFor(authority, Number(mapping.correction_sequence)) ||
    String(mapping.revenue_delta_cents) !== String(authority.revenue_delta_cents) ||
    String(mapping.direct_cost_delta_cents) !== String(authority.direct_cost_delta_cents) ||
    String(mapping.margin_delta_cents) !== String(authority.margin_delta_cents) ||
    toIso(mapping.occurred_at) !== toIso(authority.occurred_at) ||
    beforeRevenue + revenueDelta !== afterRevenue ||
    beforeCost + directCostDelta !== afterCost ||
    beforeRevenue < 0n ||
    beforeCost < 0n ||
    afterRevenue < 0n ||
    afterCost < 0n ||
    mapping.ledger_watermark_hash !== authority.correction_ledger_watermark_hash ||
    mapping.materialization_state !== 'planned_unwired' ||
    !LOWER_HEX_64.test(mapping.skipped_locked_periods_hash) ||
    !LOWER_HEX_64.test(mapping.mapping_hash)
  ) {
    failClosed('repair_typed_correction_mapping_hash_mismatch', '通用修正唯一映射内容无效');
  }
  if (
    mapping.catch_up_mode === 'same_period'
      ? (
          mapping.economic_period !== mapping.recognition_period ||
          mapping.deferred_from_period !== null ||
          Number(mapping.skipped_locked_period_count) !== 0
        )
      : (
          mapping.deferred_from_period !== mapping.economic_period ||
          mapping.recognition_period <= mapping.economic_period ||
          Number(mapping.skipped_locked_period_count) < 1
        )
  ) {
    failClosed('repair_typed_correction_mapping_period_invalid', '锁期追加或 catch-up 期间无效');
  }
  if (
    authority.correction_type === 'full_void' &&
    (afterRevenue !== 0n || afterCost !== 0n)
  ) {
    failClosed('repair_typed_correction_full_void_amount_mismatch', 'full_void 未精确抵消剩余余额');
  }
  if (canonicalHash(canonicalMappingContent(mapping, authority)) !== mapping.mapping_hash) {
    failClosed('repair_typed_correction_mapping_hash_mismatch', '通用修正唯一映射哈希不一致');
  }
}

async function authorityRelationRefs(
  authority: AuthorityRowV1,
  manager: EntityManager,
): Promise<Readonly<{ supersedes: string | null; supersededBy: string | null }>> {
  let supersedes: string | null = null;
  if (authority.supersedes_authority_id != null) {
    const rows = await manager.query(
      `SELECT authority_ref FROM repair_typed_correction_authorities WHERE id = ?`,
      [authority.supersedes_authority_id],
    ) as Array<{ authority_ref: string }>;
    if (rows.length !== 1) {
      failClosed('repair_typed_correction_supersedes_graph_corrupt', '被替代权威引用缺失');
    }
    supersedes = `repair-correction:${rows[0].authority_ref}`;
  }
  const successors = await manager.query(
    `SELECT authority_ref
       FROM repair_typed_correction_authorities
      WHERE supersedes_authority_id = ? AND status IN ('approved','superseded')
      ORDER BY authority_version, id`,
    [authority.id],
  ) as Array<{ authority_ref: string }>;
  if (successors.length > 1) {
    failClosed('repair_typed_correction_supersedes_graph_corrupt', '权威替代链发生分叉');
  }
  return {
    supersedes,
    supersededBy: successors[0] ? `repair-correction:${successors[0].authority_ref}` : null,
  };
}

async function receiptFor(
  authority: AuthorityRowV1,
  reportedStatus: 'draft' | 'submitted' | 'approved' | 'rejected',
  manager: EntityManager,
): Promise<RepairTypedCorrectionAuthorityReceiptV1> {
  assertAuthorityContent(authority);
  const relations = await authorityRelationRefs(authority, manager);
  let mapping: MappingRowV1 | null = null;
  if (reportedStatus === 'approved') {
    mapping = await loadMappingForAuthority(Number(authority.id), manager);
    if (!mapping || !['active', 'superseded'].includes(mapping.status)) {
      failClosed('repair_typed_correction_mapping_missing', '正式权威缺少唯一映射计划');
    }
    assertMappingContent(mapping, authority);
  }
  const result: RepairTypedCorrectionAuthorityReceiptV1 = {
    status: reportedStatus,
    schemaVersion: REPAIR_TYPED_CORRECTION_SCHEMA_VERSION,
    ruleVersion: REPAIR_TYPED_CORRECTION_RULE_VERSION,
    authorityRef: `repair-correction:${authority.authority_ref}`,
    correctionRootRef: `repair-correction-root:${authority.correction_root_id}`,
    authorityVersion: Number(authority.authority_version),
    contentHash: authority.content_hash,
    correctionType: authority.correction_type,
    economicRootRef: `economic-root:${authority.economic_root_id}`,
    originalContributionRef: `business-contribution:${authority.original_contribution_id}`,
    workOrderRef: `work-order:${authority.work_order_id}`,
    sourceFactKey: authority.source_fact_key,
    sourceFactHash: authority.source_fact_hash,
    occurredAt: toIso(authority.occurred_at),
    confirmedAt: reportedStatus === 'approved' && authority.confirmed_at != null
      ? toIso(authority.confirmed_at)
      : null,
    serverObservedAt: toIso(authority.server_observed_at),
    revenueDeltaCents: String(authority.revenue_delta_cents),
    directCostDeltaCents: String(authority.direct_cost_delta_cents),
    marginDeltaCents: String(authority.margin_delta_cents),
    correctionLedgerWatermarkHash: authority.correction_ledger_watermark_hash,
    supersedesAuthorityRef: relations.supersedes,
    supersededAuthorityRef: relations.supersededBy,
    mapping: mapping
      ? {
          genericTargetKind: mapping.generic_target_kind,
          genericMappingKey: mapping.generic_mapping_key,
          correctionSequence: Number(mapping.correction_sequence),
          cumulativeRevenueBeforeCents: String(mapping.cumulative_revenue_before_cents),
          cumulativeDirectCostBeforeCents: String(mapping.cumulative_direct_cost_before_cents),
          cumulativeRevenueAfterCents: String(mapping.cumulative_revenue_after_cents),
          cumulativeDirectCostAfterCents: String(mapping.cumulative_direct_cost_after_cents),
          economicPeriod: mapping.economic_period,
          recognitionPeriod: mapping.recognition_period,
          recognitionAt: toIso(mapping.recognition_at),
          deferredFromPeriod: mapping.deferred_from_period,
          catchUpMode: mapping.catch_up_mode,
          skippedLockedPeriodCount: Number(mapping.skipped_locked_period_count),
          skippedLockedPeriodsHash: mapping.skipped_locked_periods_hash,
          mappingHash: mapping.mapping_hash,
          materializationState: 'planned_unwired',
        }
      : null,
  };
  return deepFreeze(result);
}

function scopeOrAuthorityUnavailable(): never {
  throw new NotFoundException(
    '[repair_typed_correction_scope_or_authority_unavailable] 权威不存在或当前人员不可见',
  );
}

async function replayReceipt(
  phase: CorrectionPhaseV1,
  key: string,
  fingerprint: string,
  actorUserId: number,
  expectedEvidenceRef: string,
  expectedEvidenceHash: string,
  expected: Readonly<{
    authorityRef: string | null;
    authorityVersion: number | null;
    contentHash: string | null;
    workOrderId: number;
    originalContributionId: number;
  }>,
  manager: EntityManager,
): Promise<RepairTypedCorrectionAuthorityReceiptV1> {
  const claim = await loadCompletedClaim(phase, key, fingerprint, actorUserId, manager);
  const authorityRows = await manager.query(
    `SELECT ${AUTHORITY_SELECT_COLUMNS}
       FROM repair_typed_correction_authorities
      WHERE id = ? FOR UPDATE`,
    [claim.authority_id],
  ) as AuthorityRowV1[];
  if (authorityRows.length !== 1) {
    failClosed('repair_typed_correction_idempotency_graph_corrupt', '幂等结果权威缺失');
  }
  const authority = authorityRows[0];
  const events = await manager.query(
    `SELECT id, authority_id, event_type, actor_user_id, evidence_ref,
            evidence_hash, request_fingerprint, authority_content_hash, mapping_hash
       FROM repair_typed_correction_lifecycle_events
      WHERE id = ? FOR UPDATE`,
    [claim.lifecycle_event_id],
  ) as LifecycleEventRowV1[];
  const expectedEvent = phase === 'draft'
    ? 'drafted'
    : phase === 'submit'
      ? 'submitted'
      : phase === 'approve'
        ? 'approved'
        : 'rejected';
  if (
    events.length !== 1 ||
    Number(events[0].authority_id) !== Number(authority.id) ||
    events[0].event_type !== expectedEvent ||
    Number(events[0].actor_user_id) !== actorUserId ||
    events[0].evidence_ref !== expectedEvidenceRef ||
    events[0].evidence_hash !== expectedEvidenceHash ||
    events[0].request_fingerprint !== fingerprint ||
    events[0].authority_content_hash !== authority.content_hash ||
    Number(authority.work_order_id) !== expected.workOrderId ||
    Number(authority.original_contribution_id) !== expected.originalContributionId ||
    (expected.authorityRef != null && authority.authority_ref !== expected.authorityRef) ||
    (expected.authorityVersion != null &&
      Number(authority.authority_version) !== expected.authorityVersion) ||
    (expected.contentHash != null && authority.content_hash !== expected.contentHash)
  ) {
    failClosed('repair_typed_correction_idempotency_graph_corrupt', '幂等回执图不一致');
  }
  if (phase === 'approve') {
    const mapping = await loadMappingForAuthority(Number(authority.id), manager, true);
    if (!mapping || mapping.mapping_hash !== events[0].mapping_hash) {
      failClosed('repair_typed_correction_idempotency_graph_corrupt', '批准回执映射哈希不一致');
    }
  } else if (events[0].mapping_hash != null) {
    failClosed('repair_typed_correction_idempotency_graph_corrupt', '非批准回执不得携带映射');
  }
  const status = phase === 'draft'
    ? 'draft'
    : phase === 'submit'
      ? 'submitted'
      : phase === 'approve'
        ? 'approved'
        : 'rejected';
  return receiptFor(authority, status, manager);
}

async function runDraft(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedDraftRepairTypedCorrectionAuthorityV1>,
  replayOnly: boolean,
): Promise<RepairTypedCorrectionAuthorityReceiptV1> {
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
        normalized.sourceFact.primaryEvidenceRef,
        normalized.sourceFact.primaryEvidenceHash,
        {
          authorityRef: null,
          authorityVersion: null,
          contentHash: null,
          workOrderId: normalized.workOrderId,
          originalContributionId: normalized.originalContributionId,
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
    const graph = await lockSourceGraph(
      normalized.workOrderId,
      normalized.originalContributionId,
      actor.userId,
      preview,
      manager,
    );
    assertDraftPins(normalized, graph);
    const correctionRootId = canonicalCorrectionRoot(
      graph,
      normalized.correctionType,
      normalized.sourceFact,
    );
    const predecessor = predecessorFor(normalized, graph);
    if (predecessor && predecessor.correction_root_id !== correctionRootId) {
      failClosed('repair_typed_correction_supersedes_root_mismatch', '替代版本改变了稳定更正根');
    }
    const rootAuthorities = graph.authorities.filter(
      (row) => row.correction_root_id === correctionRootId,
    );
    if (rootAuthorities.some((row) => row.status === 'draft' || row.status === 'submitted')) {
      failClosed('repair_typed_correction_open_authority_exists', '稳定更正根已有开放版本');
    }
    const approved = rootAuthorities.filter((row) => row.status === 'approved');
    if (
      (predecessor == null && approved.length !== 0) ||
      (predecessor != null &&
        (approved.length !== 1 || approved[0].id.toString() !== predecessor.id.toString()))
    ) {
      failClosed('repair_typed_correction_supersedes_required', '当前正式版本必须通过精确 supersede 替代');
    }
    assertSourceFactAvailable(
      normalized.sourceFact,
      graph,
      predecessor?.correction_root_id ?? correctionRootId,
    );
    const balance = calculateLedgerBalance(
      graph,
      predecessor == null ? null : correctionRootId,
    );
    const derived = deriveRepairTypedCorrectionDeltaV1(
      normalized.correctionType,
      normalized.sourceFact,
      {
        remainingRevenueCents: balance.remainingRevenueCents.toString(),
        remainingDirectCostCents: balance.remainingDirectCostCents.toString(),
        existingPartialCorrectionCount: balance.activePartialCount,
        hasFullVoid: balance.hasActiveFullVoid,
        hasGenericFullReversal: balance.hasGenericFullReversal,
      },
    );
    const authorityVersion = rootAuthorities.reduce(
      (highest, row) => Math.max(highest, Number(row.authority_version)),
      0,
    ) + 1;
    if (
      predecessor != null &&
      authorityVersion !== Number(predecessor.authority_version) + 1
    ) {
      failClosed('repair_typed_correction_version_chain_invalid', '替代权威版本链不连续');
    }
    const authorityRef = randomBytes(32).toString('hex');
    const authorityShape: AuthorityRowV1 = {
      id: 0,
      authority_ref: authorityRef,
      correction_root_id: correctionRootId,
      economic_root_id: graph.root.economic_root_id,
      original_contribution_id: Number(graph.contribution.id),
      work_order_id: normalized.workOrderId,
      authorized_company_ref: graph.profile.companyRef,
      authorized_business_sector_ref: graph.profile.businessSectorRef,
      authorized_store_ref: graph.profile.storeRef,
      authorized_customer_ref: graph.profile.customerRef,
      correction_type: normalized.correctionType,
      rule_version: REPAIR_TYPED_CORRECTION_RULE_VERSION,
      authority_version: authorityVersion,
      supersedes_authority_id: predecessor?.id ?? null,
      assignment_authority_id: graph.assignment.id,
      assignment_authority_version: graph.assignment.authority_version,
      assignment_content_hash: graph.assignment.content_hash,
      baseline_cost_authority_id: graph.baseline.id,
      baseline_cost_authority_version: graph.baseline.authority_version,
      baseline_cost_content_hash: graph.baseline.content_hash,
      original_contribution_version: graph.contribution.version,
      original_economic_fact_key: graph.contribution.economic_fact_key,
      original_authority_snapshot_hash: graph.contribution.authority_snapshot_hash,
      original_attribution_snapshot_hash: graph.attributionSnapshotHash,
      source_system: normalized.sourceFact.sourceSystem,
      source_type: normalized.sourceFact.sourceType,
      source_id: normalized.sourceFact.sourceId,
      source_version: normalized.sourceFact.sourceVersion,
      source_record_hash: normalized.sourceFact.sourceRecordHash,
      source_fact_key: normalized.sourceFact.sourceFactKey,
      source_fact_hash: normalized.sourceFact.sourceFactHash,
      source_amount_cents: normalized.sourceFact.amountCents,
      source_previous_cost_cents: normalized.sourceFact.previousDirectCostCents,
      source_revised_cost_cents: normalized.sourceFact.revisedDirectCostCents,
      primary_evidence_ref: normalized.sourceFact.primaryEvidenceRef,
      primary_evidence_hash: normalized.sourceFact.primaryEvidenceHash,
      secondary_evidence_ref: normalized.sourceFact.secondaryEvidenceRef,
      secondary_evidence_hash: normalized.sourceFact.secondaryEvidenceHash,
      occurred_at: normalized.sourceFact.occurredAt,
      revenue_delta_cents: derived.revenueDeltaCents,
      direct_cost_delta_cents: derived.directCostDeltaCents,
      margin_delta_cents: derived.marginDeltaCents,
      correction_ledger_watermark_hash: graph.correctionLedgerWatermarkHash,
      content_hash: '',
      expected_work_order_version: normalized.expectedWorkOrderVersion,
      status: 'draft',
      created_by_user_id: actor.userId,
      submitted_by_user_id: null,
      approved_by_user_id: null,
      rejected_by_user_id: null,
      superseded_by_user_id: null,
      server_observed_at: graph.serverObservedAt,
      confirmed_at: null,
    };
    const contentHash = canonicalHash(canonicalAuthorityContent(authorityShape));
    authorityShape.content_hash = contentHash;
    await manager.query(
      `INSERT INTO repair_typed_correction_authorities (
         authority_ref, correction_root_id, economic_root_id,
         original_contribution_id, work_order_id, authorized_company_ref,
         authorized_business_sector_ref, authorized_store_ref,
         authorized_customer_ref, correction_type, rule_version,
         authority_version, supersedes_authority_id, assignment_authority_id,
         assignment_authority_version, assignment_content_hash,
         baseline_cost_authority_id, baseline_cost_authority_version,
         baseline_cost_content_hash, original_contribution_version,
         original_economic_fact_key, original_authority_snapshot_hash,
         original_attribution_snapshot_hash, source_system, source_type,
         source_id, source_version, source_record_hash, source_fact_key,
         source_fact_hash, source_amount_cents, source_previous_cost_cents,
         source_revised_cost_cents, primary_evidence_ref, primary_evidence_hash,
         secondary_evidence_ref, secondary_evidence_hash, occurred_at,
         revenue_delta_cents, direct_cost_delta_cents, margin_delta_cents,
         correction_ledger_watermark_hash, content_hash,
         expected_work_order_version, status, created_by_user_id,
         server_observed_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         'draft', ?, ?
       )`,
      [
        authorityShape.authority_ref,
        authorityShape.correction_root_id,
        authorityShape.economic_root_id,
        authorityShape.original_contribution_id,
        authorityShape.work_order_id,
        authorityShape.authorized_company_ref,
        authorityShape.authorized_business_sector_ref,
        authorityShape.authorized_store_ref,
        authorityShape.authorized_customer_ref,
        authorityShape.correction_type,
        authorityShape.rule_version,
        authorityShape.authority_version,
        authorityShape.supersedes_authority_id,
        authorityShape.assignment_authority_id,
        authorityShape.assignment_authority_version,
        authorityShape.assignment_content_hash,
        authorityShape.baseline_cost_authority_id,
        authorityShape.baseline_cost_authority_version,
        authorityShape.baseline_cost_content_hash,
        authorityShape.original_contribution_version,
        authorityShape.original_economic_fact_key,
        authorityShape.original_authority_snapshot_hash,
        authorityShape.original_attribution_snapshot_hash,
        authorityShape.source_system,
        authorityShape.source_type,
        authorityShape.source_id,
        authorityShape.source_version,
        authorityShape.source_record_hash,
        authorityShape.source_fact_key,
        authorityShape.source_fact_hash,
        authorityShape.source_amount_cents,
        authorityShape.source_previous_cost_cents,
        authorityShape.source_revised_cost_cents,
        authorityShape.primary_evidence_ref,
        authorityShape.primary_evidence_hash,
        authorityShape.secondary_evidence_ref,
        authorityShape.secondary_evidence_hash,
        mysqlUtcMillis(toIso(authorityShape.occurred_at)),
        authorityShape.revenue_delta_cents,
        authorityShape.direct_cost_delta_cents,
        authorityShape.margin_delta_cents,
        authorityShape.correction_ledger_watermark_hash,
        authorityShape.content_hash,
        authorityShape.expected_work_order_version,
        actor.userId,
        mysqlUtcMillis(graph.serverObservedAt),
      ],
    );
    const inserted = await loadAuthorityByOpaqueRef(authorityRef, manager, true);
    if (!inserted) {
      failClosed('repair_typed_correction_authority_insert_missing', '更正权威草稿写入后缺失');
    }
    assertAuthorityContent(inserted);
    const eventId = await insertEvent(
      Number(inserted.id),
      'drafted',
      null,
      'draft',
      actor.userId,
      'typed_correction_drafted',
      normalized.sourceFact.primaryEvidenceRef,
      normalized.sourceFact.primaryEvidenceHash,
      normalized.requestFingerprint,
      inserted.content_hash,
      null,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, Number(inserted.id), eventId, manager);
    return receiptFor(inserted, 'draft', manager);
  });
}

async function runSubmit(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedSubmitRepairTypedCorrectionAuthorityV1>,
  replayOnly: boolean,
): Promise<RepairTypedCorrectionAuthorityReceiptV1> {
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, 'submit', manager);
    const locator = await minimalAuthorityLocator(normalized.authorityId, manager);
    if (!locator) scopeOrAuthorityUnavailable();
    let preview: ProfileRowV1;
    try {
      preview = await loadProfile(locator.workOrderId, manager);
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
          authorityRef: normalized.authorityId,
          authorityVersion: normalized.expectedAuthorityVersion,
          contentHash: normalized.expectedContentHash,
          workOrderId: locator.workOrderId,
          originalContributionId: locator.originalContributionId,
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
    const graph = await lockSourceGraph(
      locator.workOrderId,
      locator.originalContributionId,
      actor.userId,
      preview,
      manager,
    );
    const authority = graph.authorities.find((row) => row.authority_ref === normalized.authorityId);
    if (!authority) scopeOrAuthorityUnavailable();
    if (authority.status !== 'draft') {
      failClosed('repair_typed_correction_status_conflict', '只有 draft 权威可以提交');
    }
    if (
      Number(authority.created_by_user_id) !== actor.userId ||
      Number(authority.authority_version) !== normalized.expectedAuthorityVersion ||
      authority.content_hash !== normalized.expectedContentHash
    ) {
      failClosed('repair_typed_correction_submit_mismatch', '提交人、版本或内容哈希不匹配');
    }
    assertStoredAuthorityGraph(authority, graph);
    if (authority.supersedes_authority_id != null) {
      const predecessor = graph.authorities.find(
        (row) => Number(row.id) === Number(authority.supersedes_authority_id),
      );
      if (!predecessor || predecessor.status !== 'approved') {
        failClosed('repair_typed_correction_supersedes_drift', '被替代权威已漂移');
      }
    }
    const update = await manager.query(
      `UPDATE repair_typed_correction_authorities
          SET status = 'submitted', submitted_by_user_id = ?,
              submitted_at = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status = 'draft'`,
      [actor.userId, authority.id],
    );
    if (Number(update?.affectedRows ?? -1) !== 1) {
      failClosed('repair_typed_correction_status_conflict', '提交状态竞争失败');
    }
    authority.status = 'submitted';
    authority.submitted_by_user_id = actor.userId;
    const eventId = await insertEvent(
      Number(authority.id),
      'submitted',
      'draft',
      'submitted',
      actor.userId,
      'typed_correction_submitted',
      normalized.evidenceRef,
      normalized.evidenceHash,
      normalized.requestFingerprint,
      authority.content_hash,
      null,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, Number(authority.id), eventId, manager);
    return receiptFor(authority, 'submitted', manager);
  });
}

async function runDecision(
  dataSource: DataSource,
  currentUser: CurrentUser,
  normalized: Readonly<NormalizedDecideRepairTypedCorrectionAuthorityV1>,
  replayOnly: boolean,
): Promise<RepairTypedCorrectionAuthorityReceiptV1> {
  const phase: CorrectionPhaseV1 = normalized.decision === 'approve' ? 'approve' : 'reject';
  return dataSource.transaction('REPEATABLE READ', async (manager) => {
    assertTransactionManager(manager, dataSource);
    await assertRepeatableRead(manager);
    const actor = await lockCurrentActor(currentUser, phase, manager);
    const locator = await minimalAuthorityLocator(normalized.authorityId, manager);
    if (!locator) scopeOrAuthorityUnavailable();
    let preview: ProfileRowV1;
    try {
      preview = await loadProfile(locator.workOrderId, manager);
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
          authorityRef: normalized.authorityId,
          authorityVersion: normalized.expectedAuthorityVersion,
          contentHash: normalized.expectedContentHash,
          workOrderId: locator.workOrderId,
          originalContributionId: locator.originalContributionId,
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
    const graph = await lockSourceGraph(
      locator.workOrderId,
      locator.originalContributionId,
      actor.userId,
      preview,
      manager,
    );
    const authority = graph.authorities.find((row) => row.authority_ref === normalized.authorityId);
    if (!authority) scopeOrAuthorityUnavailable();
    if (authority.status !== 'submitted') {
      failClosed('repair_typed_correction_status_conflict', '只有 submitted 权威可以审批或拒绝');
    }
    if (
      Number(authority.authority_version) !== normalized.expectedAuthorityVersion ||
      authority.content_hash !== normalized.expectedContentHash
    ) {
      failClosed('repair_typed_correction_decision_mismatch', '审批版本或内容哈希不匹配');
    }
    if (
      authority.submitted_by_user_id == null ||
      Number(authority.created_by_user_id) !== Number(authority.submitted_by_user_id)
    ) {
      failClosed('repair_typed_correction_maker_graph_corrupt', '草稿人与提交人链不一致');
    }
    if (
      Number(authority.created_by_user_id) === actor.userId ||
      Number(authority.submitted_by_user_id) === actor.userId
    ) {
      throw new ForbiddenException(
        '[repair_typed_correction_maker_checker_same_actor] 提交人与审批人不得相同',
      );
    }
    const balance = assertStoredAuthorityGraph(authority, graph);
    const predecessor = authority.supersedes_authority_id == null
      ? null
      : graph.authorities.find(
          (row) => Number(row.id) === Number(authority.supersedes_authority_id),
        ) ?? null;
    const approvedForRoot = graph.authorities.filter(
      (row) => row.correction_root_id === authority.correction_root_id && row.status === 'approved',
    );
    if (
      (predecessor == null && approvedForRoot.length !== 0) ||
      (predecessor != null &&
        (
          predecessor.status !== 'approved' ||
          approvedForRoot.length !== 1 ||
          approvedForRoot[0].id.toString() !== predecessor.id.toString() ||
          Number(predecessor.authority_version) + 1 !== Number(authority.authority_version)
        ))
    ) {
      failClosed('repair_typed_correction_supersedes_drift', '批准前正式权威替代链发生变化');
    }

    if (normalized.decision === 'reject') {
      const update = await manager.query(
        `UPDATE repair_typed_correction_authorities
            SET status = 'rejected', rejected_by_user_id = ?,
                rejected_at = CURRENT_TIMESTAMP(6)
          WHERE id = ? AND status = 'submitted'`,
        [actor.userId, authority.id],
      );
      if (Number(update?.affectedRows ?? -1) !== 1) {
        failClosed('repair_typed_correction_status_conflict', '拒绝状态竞争失败');
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
        null,
        manager,
      );
      await completeClaim(normalized.idempotencyKey, Number(authority.id), eventId, manager);
      return receiptFor(authority, 'rejected', manager);
    }

    const predecessorMapping = predecessor == null
      ? null
      : graph.mappings.find(
          (row) =>
            row.status === 'active' &&
            row.correction_root_id === authority.correction_root_id &&
            Number(row.authority_id) === Number(predecessor.id),
        ) ?? null;
    if (predecessor != null && predecessorMapping == null) {
      failClosed('repair_typed_correction_supersedes_mapping_missing', '被替代权威缺少活动映射');
    }
    const sourceFact = sourceFactFromAuthority(authority);
    const derived = deriveRepairTypedCorrectionDeltaV1(
      authority.correction_type,
      sourceFact,
      {
        remainingRevenueCents: balance.remainingRevenueCents.toString(),
        remainingDirectCostCents: balance.remainingDirectCostCents.toString(),
        existingPartialCorrectionCount: balance.activePartialCount,
        hasFullVoid: balance.hasActiveFullVoid,
        hasGenericFullReversal: balance.hasGenericFullReversal,
      },
    );
    const recognition = await resolveRecognition(graph, sourceFact.occurredAt, manager);
    const correctionSequence = predecessorMapping == null
      ? balance.nextSequence
      : Number(predecessorMapping.correction_sequence);
    if (correctionSequence !== balance.nextSequence) {
      failClosed('repair_typed_correction_catch_up_sequence_invalid', '替代映射序列发生变化');
    }
    const genericTargetKind: RepairTypedCorrectionTargetKindV1 =
      authority.correction_type === 'full_void' ? 'full_reversal' : 'typed_correction';
    const genericMappingKey = genericMappingKeyFor(authority, correctionSequence);
    const mappingShape: MappingRowV1 = {
      id: 0,
      authority_id: authority.id,
      correction_root_id: authority.correction_root_id,
      economic_root_id: authority.economic_root_id,
      original_contribution_id: authority.original_contribution_id,
      correction_type: authority.correction_type,
      generic_target_kind: genericTargetKind,
      generic_mapping_key: genericMappingKey,
      correction_sequence: correctionSequence,
      revenue_delta_cents: derived.revenueDeltaCents,
      direct_cost_delta_cents: derived.directCostDeltaCents,
      margin_delta_cents: derived.marginDeltaCents,
      occurred_at: sourceFact.occurredAt,
      cumulative_revenue_before_cents: balance.remainingRevenueCents.toString(),
      cumulative_direct_cost_before_cents: balance.remainingDirectCostCents.toString(),
      cumulative_revenue_after_cents: derived.cumulativeRevenueAfterCents,
      cumulative_direct_cost_after_cents: derived.cumulativeDirectCostAfterCents,
      economic_period: recognition.economicPeriod,
      recognition_period: recognition.recognitionPeriod,
      recognition_at: recognition.recognitionAt,
      deferred_from_period: recognition.deferredFromPeriod,
      catch_up_mode: recognition.catchUpMode,
      skipped_locked_period_count: recognition.skippedLockedPeriods.length,
      skipped_locked_periods_hash: recognition.skippedLockedPeriodsHash,
      ledger_watermark_hash: authority.correction_ledger_watermark_hash,
      mapping_hash: '',
      materialization_state: 'planned_unwired',
      status: 'prepared',
      supersedes_mapping_id: predecessorMapping?.id ?? null,
      superseded_by_mapping_id: null,
    };
    const mappingHash = canonicalHash(canonicalMappingContent(mappingShape, authority));
    mappingShape.mapping_hash = mappingHash;
    await manager.query(
      `INSERT INTO repair_typed_correction_mapping_plans (
         authority_id, correction_root_id, economic_root_id,
         original_contribution_id, correction_type, generic_target_kind,
         generic_mapping_key, correction_sequence, revenue_delta_cents,
         direct_cost_delta_cents, margin_delta_cents, occurred_at,
         cumulative_revenue_before_cents, cumulative_direct_cost_before_cents,
         cumulative_revenue_after_cents, cumulative_direct_cost_after_cents,
         economic_period, recognition_period, recognition_at,
         deferred_from_period, catch_up_mode, skipped_locked_period_count,
         skipped_locked_periods_hash, ledger_watermark_hash, mapping_hash,
         materialization_state, status, supersedes_mapping_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 'planned_unwired', 'prepared', ?)`,
      [
        mappingShape.authority_id,
        mappingShape.correction_root_id,
        mappingShape.economic_root_id,
        mappingShape.original_contribution_id,
        mappingShape.correction_type,
        mappingShape.generic_target_kind,
        mappingShape.generic_mapping_key,
        mappingShape.correction_sequence,
        mappingShape.revenue_delta_cents,
        mappingShape.direct_cost_delta_cents,
        mappingShape.margin_delta_cents,
        mysqlUtcMillis(toIso(mappingShape.occurred_at)),
        mappingShape.cumulative_revenue_before_cents,
        mappingShape.cumulative_direct_cost_before_cents,
        mappingShape.cumulative_revenue_after_cents,
        mappingShape.cumulative_direct_cost_after_cents,
        mappingShape.economic_period,
        mappingShape.recognition_period,
        mysqlUtcMillis(toIso(mappingShape.recognition_at)),
        mappingShape.deferred_from_period,
        mappingShape.catch_up_mode,
        mappingShape.skipped_locked_period_count,
        mappingShape.skipped_locked_periods_hash,
        mappingShape.ledger_watermark_hash,
        mappingShape.mapping_hash,
        mappingShape.supersedes_mapping_id,
      ],
    );
    const mapping = await loadMappingForAuthority(Number(authority.id), manager, true);
    if (!mapping || mapping.status !== 'prepared') {
      failClosed('repair_typed_correction_mapping_insert_missing', '唯一映射计划写入后缺失');
    }
    assertMappingContent(mapping, authority);

    if (predecessor && predecessorMapping) {
      const oldAuthorityUpdate = await manager.query(
        `UPDATE repair_typed_correction_authorities
            SET status = 'superseded', superseded_by_user_id = ?,
                superseded_at = CURRENT_TIMESTAMP(6)
          WHERE id = ? AND status = 'approved'`,
        [actor.userId, predecessor.id],
      );
      if (Number(oldAuthorityUpdate?.affectedRows ?? -1) !== 1) {
        failClosed('repair_typed_correction_supersedes_conflict', '旧正式权威无法原子替代');
      }
      const oldMappingUpdate = await manager.query(
        `UPDATE repair_typed_correction_mapping_plans
            SET status = 'superseded', superseded_by_mapping_id = ?,
                superseded_at = CURRENT_TIMESTAMP(6)
          WHERE id = ? AND status = 'active' AND superseded_by_mapping_id IS NULL`,
        [mapping.id, predecessorMapping.id],
      );
      if (Number(oldMappingUpdate?.affectedRows ?? -1) !== 1) {
        failClosed('repair_typed_correction_supersedes_mapping_conflict', '旧活动映射无法原子替代');
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
        predecessorMapping.mapping_hash,
        manager,
      );
    }
    const authorityUpdate = await manager.query(
      `UPDATE repair_typed_correction_authorities
          SET status = 'approved', approved_by_user_id = ?,
              confirmed_at = CURRENT_TIMESTAMP(6)
        WHERE id = ? AND status = 'submitted'`,
      [actor.userId, authority.id],
    );
    if (Number(authorityUpdate?.affectedRows ?? -1) !== 1) {
      failClosed('repair_typed_correction_status_conflict', '批准状态竞争失败');
    }
    const mappingUpdate = await manager.query(
      `UPDATE repair_typed_correction_mapping_plans
          SET status = 'active'
        WHERE id = ? AND status = 'prepared'`,
      [mapping.id],
    );
    if (Number(mappingUpdate?.affectedRows ?? -1) !== 1) {
      failClosed('repair_typed_correction_mapping_activation_conflict', '唯一映射计划激活失败');
    }
    const confirmedRows = await manager.query(
      `SELECT confirmed_at FROM repair_typed_correction_authorities WHERE id = ? FOR UPDATE`,
      [authority.id],
    ) as Array<{ confirmed_at: Date | string | null }>;
    if (confirmedRows.length !== 1 || confirmedRows[0].confirmed_at == null) {
      failClosed('repair_typed_correction_confirmed_at_missing', '批准时间缺失');
    }
    authority.status = 'approved';
    authority.approved_by_user_id = actor.userId;
    authority.confirmed_at = confirmedRows[0].confirmed_at;
    mapping.status = 'active';
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
      mapping.mapping_hash,
      manager,
    );
    await completeClaim(normalized.idempotencyKey, Number(authority.id), eventId, manager);
    return receiptFor(authority, 'approved', manager);
  });
}

export async function draftRepairTypedCorrectionAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairTypedCorrectionAuthorityReceiptV1> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeDraftRepairTypedCorrectionAuthorityCommandV1(command);
  try {
    return await runDraft(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof CorrectionIdempotencyRaceV1 &&
      error.phase === 'draft' &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) {
      return runDraft(dataSource, currentUser, normalized, true);
    }
    mapStorageFailure(error);
  }
}

export async function submitRepairTypedCorrectionAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairTypedCorrectionAuthorityReceiptV1> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeSubmitRepairTypedCorrectionAuthorityCommandV1(command);
  try {
    return await runSubmit(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof CorrectionIdempotencyRaceV1 &&
      error.phase === 'submit' &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) {
      return runSubmit(dataSource, currentUser, normalized, true);
    }
    mapStorageFailure(error);
  }
}

export async function decideRepairTypedCorrectionAuthorityV1(
  dataSource: DataSource,
  currentUser: CurrentUser,
  command: unknown,
): Promise<RepairTypedCorrectionAuthorityReceiptV1> {
  assertTrustedDataSource(dataSource);
  const normalized = normalizeDecideRepairTypedCorrectionAuthorityCommandV1(command);
  const phase: CorrectionPhaseV1 = normalized.decision === 'approve' ? 'approve' : 'reject';
  try {
    return await runDecision(dataSource, currentUser, normalized, false);
  } catch (error) {
    if (
      error instanceof CorrectionIdempotencyRaceV1 &&
      error.phase === phase &&
      error.idempotencyKey === normalized.idempotencyKey &&
      error.requestFingerprint === normalized.requestFingerprint
    ) {
      return runDecision(dataSource, currentUser, normalized, true);
    }
    mapStorageFailure(error);
  }
}
