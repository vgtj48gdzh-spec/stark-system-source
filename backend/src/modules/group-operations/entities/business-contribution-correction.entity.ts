import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const BUSINESS_CONTRIBUTION_CORRECTION_TYPES = [
  'customer_refund',
  'rework_direct_cost',
  'supplier_cost_recovery',
  'full_void',
] as const;
export type BusinessContributionCorrectionType =
  (typeof BUSINESS_CONTRIBUTION_CORRECTION_TYPES)[number];

/**
 * Audit-safe, non-user-authored reason codes. Each correction type has exactly
 * one canonical code so a caller cannot smuggle names, complaints or other
 * free text into the append-only correction row or operation log.
 */
export const BUSINESS_CONTRIBUTION_CORRECTION_REASON_BY_TYPE = {
  customer_refund: 'correction.customer_refund',
  rework_direct_cost: 'correction.rework_direct_cost',
  supplier_cost_recovery: 'correction.supplier_cost_recovery',
  full_void: 'correction.full_void',
} as const satisfies Record<BusinessContributionCorrectionType, string>;

export const BUSINESS_CONTRIBUTION_CORRECTION_REASON_CODES = Object.values(
  BUSINESS_CONTRIBUTION_CORRECTION_REASON_BY_TYPE,
);
export type BusinessContributionCorrectionReasonCode =
  (typeof BUSINESS_CONTRIBUTION_CORRECTION_REASON_BY_TYPE)[BusinessContributionCorrectionType];

/**
 * Model B typed append-only one-to-many correction delta. A correction never
 * mutates the original `business_contributions` row or its attribution rows; it
 * only appends a net delta in a later open settlement period.
 *
 *   - customer_refund:         revenue_delta < 0, direct_cost_delta = 0
 *   - rework_direct_cost:      revenue_delta = 0, direct_cost_delta > 0
 *   - supplier_cost_recovery:  revenue_delta = 0, direct_cost_delta < 0
 *   - full_void:               revenue_delta < 0, direct_cost_delta <= 0
 *
 * `margin_delta_cents` is always `revenue_delta_cents - direct_cost_delta_cents`.
 */
@Entity('business_contribution_corrections')
@Index('uq_bcc_idempotency', ['idempotencyKey'], { unique: true })
@Index('uq_bcc_original_sequence', ['originalContributionId', 'sequence'], { unique: true })
@Index('uq_bcc_source_identity', ['uniqueSourceKey'], { unique: true })
@Index('uq_bcc_evidence', ['evidenceUniqueKey'], { unique: true })
@Index('idx_bcc_original_period', ['originalContributionId', 'recognitionPeriod'])
@Index('idx_bcc_economic_fact', ['economicFactKey', 'correctionType'])
@Index('idx_bcc_group_period', ['operatingGroupId', 'recognitionPeriod', 'id'])
@Index('idx_bcc_authority', ['sourceAuthorityVersionId'])
export class BusinessContributionCorrection {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'original_contribution_id', type: 'int' })
  originalContributionId!: number;

  @Column({
    name: 'correction_type',
    type: 'enum',
    enum: BUSINESS_CONTRIBUTION_CORRECTION_TYPES,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  correctionType!: BusinessContributionCorrectionType;

  @Column({ type: 'int' })
  sequence!: number;

  @Column({ name: 'revenue_delta_cents', type: 'bigint' })
  revenueDeltaCents!: string;

  @Column({ name: 'direct_cost_delta_cents', type: 'bigint' })
  directCostDeltaCents!: string;

  @Column({ name: 'margin_delta_cents', type: 'bigint' })
  marginDeltaCents!: string;

  @Column({
    name: 'business_domain',
    type: 'varchar',
    length: 24,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  businessDomain!: string;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100, nullable: true })
  businessSectorRef!: string | null;

  @Column({ name: 'store_ref', type: 'varchar', length: 100, nullable: true })
  storeRef!: string | null;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100, nullable: true })
  customerRef!: string | null;

  @Column({ name: 'operating_group_id', type: 'int' })
  operatingGroupId!: number;

  @Column({ name: 'source_authority_version_id', type: 'int' })
  sourceAuthorityVersionId!: number;

  @Column({ name: 'adapter_version', type: 'varchar', length: 100 })
  adapterVersion!: string;

  @Column({ name: 'source_system', type: 'varchar', length: 64 })
  sourceSystem!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 64 })
  sourceType!: string;

  @Column({ name: 'source_id', type: 'varchar', length: 120 })
  sourceId!: string;

  @Column({ name: 'source_version', type: 'varchar', length: 100 })
  sourceVersion!: string;

  @Column({
    name: 'source_record_hash',
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  sourceRecordHash!: string;

  @Column({ name: 'source_allocation_id', type: 'varchar', length: 120 })
  sourceAllocationId!: string;

  @Column({
    name: 'unique_source_key',
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  uniqueSourceKey!: string;

  @Column({
    name: 'evidence_unique_key',
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  evidenceUniqueKey!: string;

  @Column({
    name: 'economic_fact_key',
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  economicFactKey!: string;

  @Column({
    name: 'authority_snapshot_hash',
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  authoritySnapshotHash!: string;

  @Column({
    name: 'evidence_hash',
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  evidenceHash!: string;

  @Column({ name: 'evidence_ref', type: 'varchar', length: 500 })
  evidenceRef!: string;

  @Column({
    name: 'attribution_snapshot_hash',
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  attributionSnapshotHash!: string;

  @Column({ name: 'occurred_at', type: 'datetime', precision: 6 })
  occurredAt!: Date;

  @Column({ name: 'recognition_period', type: 'char', length: 7 })
  recognitionPeriod!: string;

  @Column({ name: 'recognition_at', type: 'datetime', precision: 6 })
  recognitionAt!: Date;

  @Column({
    type: 'char',
    length: 3,
    default: 'CNY',
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  currency!: 'CNY';

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({
    name: 'request_fingerprint',
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  requestFingerprint!: string;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({
    name: 'reason',
    type: 'varchar',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  reason!: BusinessContributionCorrectionReasonCode;

  @Column({ name: 'source_channel', type: 'varchar', length: 50 })
  sourceChannel!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100 })
  correlationId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}

export const BUSINESS_CONTRIBUTION_CORRECTION_ENTITIES = [
  BusinessContributionCorrection,
] as const;
