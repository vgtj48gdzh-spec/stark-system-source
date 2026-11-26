import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BusinessContributionCorrection } from './business-contribution-correction.entity';
import { BusinessContributionIdentityAllocation } from './business-contribution-identity-allocation.entity';

export const BUSINESS_CONTRIBUTION_DOMAINS = [
  'fresh',
  'water',
  'repair',
  'software',
] as const;
export type BusinessContributionDomain = (typeof BUSINESS_CONTRIBUTION_DOMAINS)[number];

export const CONTRIBUTION_ATTRIBUTION_ROLES = [
  'lead_originator',
  'business_owner',
  'service_owner',
] as const;
export type ContributionAttributionRole = (typeof CONTRIBUTION_ATTRIBUTION_ROLES)[number];

export type ContributionConfirmationStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'reversed'
  | 'voided';
export type ContributionEvidenceRole = 'revenue' | 'direct_cost' | 'reversal';
export type ContributionEvidenceDisposition = 'included' | 'not_applicable';
export type ContributionAttributionStatus = 'pending' | 'confirmed' | 'reversed' | 'voided';

export const CONTRIBUTION_ANOMALY_TYPES = [
  'similar_economic_fact',
  'cross_business_duplicate',
  'cancel_recreate',
  'split_order_risk',
] as const;
export type ContributionAnomalyType = (typeof CONTRIBUTION_ANOMALY_TYPES)[number];

export const CONTRIBUTION_ANOMALY_STATUSES = [
  'open',
  'resolved_not_duplicate',
  'resolved_duplicate',
] as const;
export type ContributionAnomalyStatus = (typeof CONTRIBUTION_ANOMALY_STATUSES)[number];

export const CONTRIBUTION_ANOMALY_RESOLUTIONS = [
  'not_duplicate',
  'duplicate_void_draft',
] as const;
export type ContributionAnomalyResolution = (typeof CONTRIBUTION_ANOMALY_RESOLUTIONS)[number];

@Entity('business_contribution_similarity_clusters')
export class BusinessContributionSimilarityCluster {
  @PrimaryColumn({ name: 'cluster_key', type: 'char', length: 64 })
  clusterKey!: string;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}

@Entity('contribution_source_authority_versions')
@Index('uq_contribution_authority_rule_version', ['ruleVersionId'], { unique: true })
@Index('uq_contribution_authority_scope_version', ['authorityScopeKey', 'version'], {
  unique: true,
})
@Index('uq_contribution_authority_idempotency', ['idempotencyKey'], { unique: true })
@Index('idx_contribution_authority_lookup', [
  'companyRef',
  'businessDomain',
  'sourceSystem',
  'sourceType',
  'status',
])
export class ContributionSourceAuthorityVersion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rule_version_id', type: 'varchar', length: 100 })
  ruleVersionId!: string;

  @Column({ name: 'authority_scope_key', type: 'char', length: 64 })
  authorityScopeKey!: string;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100, nullable: true })
  businessSectorRef!: string | null;

  @Column({ name: 'store_ref', type: 'varchar', length: 100, nullable: true })
  storeRef!: string | null;

  @Column({ name: 'business_domain', type: 'varchar', length: 24 })
  businessDomain!: BusinessContributionDomain;

  @Column({ name: 'source_system', type: 'varchar', length: 64 })
  sourceSystem!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 64 })
  sourceType!: string;

  @Column({ name: 'adapter_version', type: 'varchar', length: 100 })
  adapterVersion!: string;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ type: 'char', length: 3, default: 'CNY' })
  currency!: 'CNY';

  @Column({ type: 'varchar', length: 24, default: 'approved' })
  status!: 'approved' | 'superseded';

  @Column({ type: 'int' })
  version!: number;

  @Column({ name: 'change_reason', type: 'varchar', length: 500 })
  changeReason!: string;

  @Column({ name: 'source_channel', type: 'varchar', length: 50 })
  sourceChannel!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100 })
  correlationId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'approved_by', type: 'int' })
  approvedBy!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}

@Entity('business_contributions')
@Index('uq_business_contribution_source', ['uniqueSourceKey'], { unique: true })
@Index('uq_business_contribution_create_idempotency', ['idempotencyKey'], { unique: true })
@Index('uq_business_contribution_confirmation_idempotency', ['confirmationIdempotencyKey'], {
  unique: true,
})
@Index('uq_business_contribution_reversal_idempotency', ['reversalIdempotencyKey'], {
  unique: true,
})
@Index('uq_business_contribution_reversal_of', ['reversalOfContributionId'], { unique: true })
@Index('uq_business_contribution_economic_root', ['canonicalEconomicFactRootId'], {
  unique: true,
})
@Check(
  'chk_business_contribution_economic_root',
  "canonical_economic_fact_root_id IS NULL OR (REGEXP_LIKE(canonical_economic_fact_root_id, '^[0-9a-f]{64}$', 'c') AND reversal_of_contribution_id IS NULL)",
)
@Index('idx_business_contribution_group_period_status', [
  'operatingGroupId',
  'recognitionPeriod',
  'confirmationStatus',
])
@Index('idx_business_contribution_scope', [
  'companyRef',
  'businessSectorRef',
  'storeRef',
  'businessDomain',
])
@Index('idx_business_contribution_similarity_cluster', [
  'similarityClusterKey',
  'confirmationStatus',
])
@Index('idx_business_contribution_responsibility', [
  'responsibilityEmployeeIdSnapshot',
  'recognitionPeriod',
])
export class BusinessContribution {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'business_domain', type: 'varchar', length: 24 })
  businessDomain!: BusinessContributionDomain;

  @Column({ name: 'company_ref', type: 'varchar', length: 100 })
  companyRef!: string;

  @Column({ name: 'business_sector_ref', type: 'varchar', length: 100, nullable: true })
  businessSectorRef!: string | null;

  @Column({ name: 'store_ref', type: 'varchar', length: 100, nullable: true })
  storeRef!: string | null;

  @Column({ name: 'operating_group_id', type: 'int' })
  operatingGroupId!: number;

  @Column({ name: 'responsibility_employee_id_snapshot', type: 'int' })
  responsibilityEmployeeIdSnapshot!: number;

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

  @Column({ name: 'source_record_hash', type: 'char', length: 64 })
  sourceRecordHash!: string;

  @Column({ name: 'unique_source_key', type: 'char', length: 64 })
  uniqueSourceKey!: string;

  @Column({ name: 'similarity_cluster_key', type: 'char', length: 64 })
  similarityClusterKey!: string;

  @Column({ name: 'economic_fact_key', type: 'char', length: 64 })
  economicFactKey!: string;

  /**
   * Nullable 0067 lineage root. Legacy rows remain NULL and are never guessed
   * or backfilled. The unique FK is a database guard for at most one normal
   * contribution per accepted economic root once a future composer is wired.
   */
  @Column({
    name: 'canonical_economic_fact_root_id',
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
    nullable: true,
  })
  canonicalEconomicFactRootId!: string | null;

  @Column({ name: 'authority_snapshot_hash', type: 'char', length: 64 })
  authoritySnapshotHash!: string;

  @Column({ name: 'recognition_period', type: 'char', length: 7 })
  recognitionPeriod!: string;

  @Column({ name: 'recognition_at', type: 'datetime', precision: 6 })
  recognitionAt!: Date;

  @Column({ name: 'customer_ref', type: 'varchar', length: 100, nullable: true })
  customerRef!: string | null;

  @Column({ name: 'revenue_cents', type: 'bigint' })
  revenueCents!: string;

  @Column({ name: 'direct_cost_total_cents', type: 'bigint' })
  directCostTotalCents!: string;

  @Column({ name: 'valid_contribution_margin_cents', type: 'bigint' })
  validContributionMarginCents!: string;

  @Column({ type: 'char', length: 3, default: 'CNY' })
  currency!: 'CNY';

  @Column({ name: 'evidence_bundle_hash', type: 'char', length: 64 })
  evidenceBundleHash!: string;

  @Column({ name: 'attribution_share_total_bps', type: 'int' })
  attributionShareTotalBps!: number;

  @Column({ name: 'confirmation_status', type: 'varchar', length: 32 })
  confirmationStatus!: ContributionConfirmationStatus;

  @Column({ name: 'reversal_of_contribution_id', type: 'int', nullable: true })
  reversalOfContributionId!: number | null;

  @Column({ name: 'reversed_by_contribution_id', type: 'int', nullable: true })
  reversedByContributionId!: number | null;

  @Column({ name: 'change_reason', type: 'varchar', length: 500 })
  changeReason!: string;

  @Column({ name: 'source_channel', type: 'varchar', length: 50 })
  sourceChannel!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 100 })
  correlationId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'confirmation_idempotency_key', type: 'varchar', length: 120, nullable: true })
  confirmationIdempotencyKey!: string | null;

  @Column({ name: 'confirmation_request_fingerprint', type: 'char', length: 64, nullable: true })
  confirmationRequestFingerprint!: string | null;

  @Column({ name: 'confirmation_evidence_ref', type: 'varchar', length: 500, nullable: true })
  confirmationEvidenceRef!: string | null;

  @Column({ name: 'confirmation_evidence_hash', type: 'char', length: 64, nullable: true })
  confirmationEvidenceHash!: string | null;

  @Column({ name: 'reversal_idempotency_key', type: 'varchar', length: 120, nullable: true })
  reversalIdempotencyKey!: string | null;

  @Column({ name: 'reversal_request_fingerprint', type: 'char', length: 64, nullable: true })
  reversalRequestFingerprint!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'confirmed_at', type: 'datetime', precision: 6, nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}

@Entity('business_contribution_evidence')
@Index('uq_business_contribution_evidence_key', ['evidenceUniqueKey'], { unique: true })
@Index('idx_business_contribution_evidence_contribution', ['contributionId', 'evidenceRole'])
export class BusinessContributionEvidence {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'contribution_id', type: 'int' })
  contributionId!: number;

  @Column({ name: 'evidence_role', type: 'varchar', length: 24 })
  evidenceRole!: ContributionEvidenceRole;

  @Column({ name: 'cost_category', type: 'varchar', length: 64, nullable: true })
  costCategory!: string | null;

  @Column({ type: 'varchar', length: 24 })
  disposition!: ContributionEvidenceDisposition;

  @Column({ name: 'amount_cents', type: 'bigint' })
  amountCents!: string;

  @Column({ name: 'source_system', type: 'varchar', length: 64 })
  sourceSystem!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 64 })
  sourceType!: string;

  @Column({ name: 'source_id', type: 'varchar', length: 120 })
  sourceId!: string;

  @Column({ name: 'source_version', type: 'varchar', length: 100 })
  sourceVersion!: string;

  @Column({ name: 'source_allocation_id', type: 'varchar', length: 120 })
  sourceAllocationId!: string;

  @Column({ name: 'evidence_ref', type: 'varchar', length: 500 })
  evidenceRef!: string;

  @Column({ name: 'evidence_hash', type: 'char', length: 64 })
  evidenceHash!: string;

  @Column({ name: 'evidence_unique_key', type: 'char', length: 64 })
  evidenceUniqueKey!: string;

  @Column({ name: 'occurred_at', type: 'datetime', precision: 6 })
  occurredAt!: Date;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}

@Entity('business_contribution_attributions')
@Index('uq_business_contribution_attribution_role_employee', [
  'contributionId',
  'role',
  'employeeId',
], { unique: true })
@Index('idx_business_contribution_attribution_employee', [
  'employeeId',
  'status',
  'contributionId',
])
export class BusinessContributionAttribution {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'contribution_id', type: 'int' })
  contributionId!: number;

  @Column({ type: 'varchar', length: 32 })
  role!: ContributionAttributionRole;

  @Column({ name: 'origin_business_domain', type: 'varchar', length: 24 })
  originBusinessDomain!: BusinessContributionDomain;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId!: number;

  @Column({ name: 'employee_group_id_snapshot', type: 'int' })
  employeeGroupIdSnapshot!: number;

  @Column({ name: 'share_bps', type: 'int' })
  shareBps!: number;

  @Column({ name: 'evidence_ref', type: 'varchar', length: 500 })
  evidenceRef!: string;

  @Column({ name: 'evidence_hash', type: 'char', length: 64 })
  evidenceHash!: string;

  @Column({ type: 'varchar', length: 24 })
  status!: ContributionAttributionStatus;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy!: number | null;

  @Column({ name: 'confirmed_at', type: 'datetime', precision: 6, nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}

@Entity('business_contribution_anomalies')
@Index('uq_business_contribution_anomaly_pair', ['pairKey'], { unique: true })
@Index('uq_business_contribution_anomaly_resolution_idempotency', ['resolutionIdempotencyKey'], {
  unique: true,
})
@Index('idx_business_contribution_anomaly_queue', [
  'status',
  'anomalyType',
  'contributionId',
])
@Index('idx_business_contribution_anomaly_candidate_queue', [
  'status',
  'candidateContributionId',
])
export class BusinessContributionAnomaly {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'contribution_id', type: 'int' })
  contributionId!: number;

  @Column({ name: 'candidate_contribution_id', type: 'int' })
  candidateContributionId!: number;

  @Column({ name: 'anomaly_type', type: 'varchar', length: 40 })
  anomalyType!: ContributionAnomalyType;

  @Column({ name: 'pair_key', type: 'char', length: 64 })
  pairKey!: string;

  @Column({ name: 'similarity_cluster_key', type: 'char', length: 64 })
  similarityClusterKey!: string;

  @Column({ name: 'economic_fact_key', type: 'char', length: 64 })
  economicFactKey!: string;

  @Column({ name: 'detection_rule_version', type: 'varchar', length: 100 })
  detectionRuleVersion!: string;

  @Column({ name: 'detected_payload_hash', type: 'char', length: 64 })
  detectedPayloadHash!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: ContributionAnomalyStatus;

  @Column({ name: 'resolution', type: 'varchar', length: 32, nullable: true })
  resolution!: ContributionAnomalyResolution | null;

  @Column({ name: 'canonical_contribution_id', type: 'int', nullable: true })
  canonicalContributionId!: number | null;

  @Column({ name: 'duplicate_contribution_id', type: 'int', nullable: true })
  duplicateContributionId!: number | null;

  @Column({ name: 'resolution_reason', type: 'varchar', length: 500, nullable: true })
  resolutionReason!: string | null;

  @Column({ name: 'resolution_evidence_ref', type: 'varchar', length: 500, nullable: true })
  resolutionEvidenceRef!: string | null;

  @Column({ name: 'resolution_evidence_hash', type: 'char', length: 64, nullable: true })
  resolutionEvidenceHash!: string | null;

  @Column({ name: 'resolution_idempotency_key', type: 'varchar', length: 120, nullable: true })
  resolutionIdempotencyKey!: string | null;

  @Column({ name: 'resolution_request_fingerprint', type: 'char', length: 64, nullable: true })
  resolutionRequestFingerprint!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'int' })
  createdBy!: number;

  @Column({ name: 'resolved_by', type: 'int', nullable: true })
  resolvedBy!: number | null;

  @Column({ name: 'resolved_at', type: 'datetime', precision: 6, nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}

export const BUSINESS_CONTRIBUTION_ENTITIES = [
  BusinessContributionSimilarityCluster,
  ContributionSourceAuthorityVersion,
  BusinessContribution,
  BusinessContributionEvidence,
  BusinessContributionAttribution,
  BusinessContributionAnomaly,
  BusinessContributionCorrection,
  BusinessContributionIdentityAllocation,
] as const;
