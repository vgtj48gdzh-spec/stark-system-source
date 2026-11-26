import { createHash } from 'node:crypto';

/**
 * Single source of truth for bank_account_registry identity, review-content
 * hashing and formal eligibility. Every formal consumer must load the typed
 * immutable review authority and pass through this contract. Legacy mutable
 * review columns are only a cache and can never establish authority alone.
 */

const ACCOUNT_TAIL_PATTERN = /^\d{4}$/;
const HEX64 = /^[0-9a-f]{64}$/;

export interface BankAccountRegistryIdentity {
  companyId: number;
  bankName: string;
  smsSender: string;
  accountTail: string;
}

export interface BankAccountRegistryReviewAuthoritySnapshot {
  id: number;
  registryId: number;
  contentVersion: number;
  contentSnapshotHash: string;
  decision: 'approved' | 'rejected';
  reviewedBy: number;
  reviewedAt: Date;
  remark: string | null;
  authorityHash: string;
}

export interface BankAccountRegistryFormalSnapshot {
  id: number;
  companyId: number;
  bankName: string;
  smsSender: string;
  accountTail: string;
  accountAlias: string;
  accountHolder: string | null;
  virtualLedgerId: number | null;
  accountUse: string | null;
  evidenceSource: string | null;
  evidenceRef: string | null;
  createdBy: number | null;
  lastEditedBy: number | null;
  reviewedBy: number | null;
  reviewStatus: 'pending_review' | 'reviewed' | 'rejected';
  reviewRemark: string | null;
  contentVersion: number;
  formalReviewAuthorityId: number | null;
  formalReviewAuthorityHash: string | null;
  formalReviewAuthority?: BankAccountRegistryReviewAuthoritySnapshot | null;
  deviceId: string | null;
  simSlot: number | null;
  status: 'active' | 'inactive';
  updatedAt: Date;
}

export type BankAccountRegistryEligibilityBlockerCode =
  | 'registry_inactive'
  | 'registry_content_version_missing'
  | 'registry_creator_missing'
  | 'registry_last_editor_missing'
  | 'registry_formal_authority_missing'
  | 'registry_formal_authority_pointer_mismatch'
  | 'registry_formal_authority_registry_mismatch'
  | 'registry_formal_authority_decision_invalid'
  | 'registry_formal_authority_reviewer_missing'
  | 'registry_formal_authority_self_review'
  | 'registry_formal_authority_reviewed_at_invalid'
  | 'registry_formal_authority_content_version_mismatch'
  | 'registry_formal_authority_content_hash_mismatch'
  | 'registry_formal_authority_hash_mismatch'
  | 'registry_review_cache_mismatch'
  | 'registry_evidence_missing';

/** Exact identity; aliases and holders are never accepted as formal identity. */
export function bankAccountRegistryIdentityMatches(
  registry: BankAccountRegistryIdentity,
  identity: BankAccountRegistryIdentity,
): boolean {
  return (
    Number.isInteger(registry.companyId) &&
    registry.companyId === identity.companyId &&
    registry.bankName === identity.bankName &&
    registry.smsSender === identity.smsSender &&
    registry.accountTail === identity.accountTail &&
    ACCOUNT_TAIL_PATTERN.test(registry.accountTail)
  );
}

/** Exact ordinary-edit content reviewed by the independent reviewer. */
export function bankAccountRegistryReviewableSnapshot(
  registry: BankAccountRegistryFormalSnapshot,
) {
  return {
    id: registry.id,
    companyId: registry.companyId,
    bankName: registry.bankName,
    smsSender: registry.smsSender,
    accountTail: registry.accountTail,
    accountAlias: registry.accountAlias,
    accountHolder: registry.accountHolder ?? null,
    virtualLedgerId: registry.virtualLedgerId ?? null,
    accountUse: registry.accountUse ?? null,
    evidenceSource: registry.evidenceSource ?? null,
    evidenceRef: registry.evidenceRef ?? null,
    createdBy: registry.createdBy ?? null,
    lastEditedBy: registry.lastEditedBy ?? null,
    deviceId: registry.deviceId ?? null,
    simSlot: registry.simSlot ?? null,
    status: registry.status,
    contentVersion: registry.contentVersion,
  };
}

export function bankAccountRegistryContentSnapshotHash(
  registry: BankAccountRegistryFormalSnapshot,
): string {
  return createHash('sha256')
    .update(stableStringify(bankAccountRegistryReviewableSnapshot(registry)))
    .digest('hex');
}

export function buildBankAccountRegistryReviewAuthorityHash(input: {
  registryId: number;
  contentVersion: number;
  contentSnapshotHash: string;
  decision: 'approved' | 'rejected';
  reviewedBy: number;
  reviewedAt: Date;
  remark: string | null;
}): string {
  return createHash('sha256')
    .update(
      stableStringify({
        registryId: input.registryId,
        contentVersion: input.contentVersion,
        contentSnapshotHash: input.contentSnapshotHash,
        decision: input.decision,
        reviewedBy: input.reviewedBy,
        reviewedAt: input.reviewedAt.toISOString(),
        remark: normalizeOptionalString(input.remark),
      }),
    )
    .digest('hex');
}

export function isBankAccountRegistryFormallyEligible(
  registry: BankAccountRegistryFormalSnapshot,
  authority: BankAccountRegistryReviewAuthoritySnapshot | null | undefined =
    registry.formalReviewAuthority,
): boolean {
  return bankAccountRegistryEligibilityBlockerCodes(registry, authority).length === 0;
}

export function bankAccountRegistryEligibilityBlockerCodes(
  registry: BankAccountRegistryFormalSnapshot,
  authority: BankAccountRegistryReviewAuthoritySnapshot | null | undefined =
    registry.formalReviewAuthority,
): BankAccountRegistryEligibilityBlockerCode[] {
  const codes: BankAccountRegistryEligibilityBlockerCode[] = [];
  if (registry.status !== 'active') codes.push('registry_inactive');
  if (!Number.isInteger(registry.contentVersion) || registry.contentVersion <= 0) {
    codes.push('registry_content_version_missing');
  }
  if (!Number.isInteger(registry.createdBy) || Number(registry.createdBy) <= 0) {
    codes.push('registry_creator_missing');
  }
  if (!Number.isInteger(registry.lastEditedBy) || Number(registry.lastEditedBy) <= 0) {
    codes.push('registry_last_editor_missing');
  }
  if (
    !Number.isInteger(registry.formalReviewAuthorityId) ||
    Number(registry.formalReviewAuthorityId) <= 0 ||
    !HEX64.test(registry.formalReviewAuthorityHash ?? '') ||
    !authority
  ) {
    codes.push('registry_formal_authority_missing');
  }
  if (!normalizeOptionalString(registry.evidenceSource) || !normalizeOptionalString(registry.evidenceRef)) {
    codes.push('registry_evidence_missing');
  }
  if (!authority) return uniqueCodes(codes);

  if (authority.id !== registry.formalReviewAuthorityId) {
    codes.push('registry_formal_authority_pointer_mismatch');
  }
  if (authority.registryId !== registry.id) {
    codes.push('registry_formal_authority_registry_mismatch');
  }
  if (authority.decision !== 'approved') {
    codes.push('registry_formal_authority_decision_invalid');
  }
  if (!Number.isInteger(authority.reviewedBy) || authority.reviewedBy <= 0) {
    codes.push('registry_formal_authority_reviewer_missing');
  }
  if (
    Number.isInteger(authority.reviewedBy) &&
    authority.reviewedBy > 0 &&
    (authority.reviewedBy === registry.createdBy ||
      authority.reviewedBy === registry.lastEditedBy)
  ) {
    codes.push('registry_formal_authority_self_review');
  }
  if (!(authority.reviewedAt instanceof Date) || Number.isNaN(authority.reviewedAt.getTime())) {
    codes.push('registry_formal_authority_reviewed_at_invalid');
  }
  if (authority.contentVersion !== registry.contentVersion) {
    codes.push('registry_formal_authority_content_version_mismatch');
  }
  const currentContentHash = bankAccountRegistryContentSnapshotHash(registry);
  if (
    !HEX64.test(authority.contentSnapshotHash ?? '') ||
    authority.contentSnapshotHash !== currentContentHash
  ) {
    codes.push('registry_formal_authority_content_hash_mismatch');
  }
  const expectedAuthorityHash =
    authority.reviewedAt instanceof Date && !Number.isNaN(authority.reviewedAt.getTime())
      ? buildBankAccountRegistryReviewAuthorityHash({
          registryId: authority.registryId,
          contentVersion: authority.contentVersion,
          contentSnapshotHash: authority.contentSnapshotHash,
          decision: authority.decision,
          reviewedBy: authority.reviewedBy,
          reviewedAt: authority.reviewedAt,
          remark: authority.remark,
        })
      : null;
  if (
    !HEX64.test(authority.authorityHash ?? '') ||
    authority.authorityHash !== expectedAuthorityHash ||
    registry.formalReviewAuthorityHash !== authority.authorityHash
  ) {
    codes.push('registry_formal_authority_hash_mismatch');
  }
  if (
    registry.reviewStatus !== 'reviewed' ||
    registry.reviewedBy !== authority.reviewedBy ||
    normalizeOptionalString(registry.reviewRemark) !== normalizeOptionalString(authority.remark)
  ) {
    codes.push('registry_review_cache_mismatch');
  }
  return uniqueCodes(codes);
}

/** Immutable formal source snapshot bound into downstream confirmation hashes. */
export function bankAccountRegistrySourceSnapshot(registry: BankAccountRegistryFormalSnapshot) {
  const authority = registry.formalReviewAuthority ?? null;
  return {
    ...bankAccountRegistryReviewableSnapshot(registry),
    reviewedBy: registry.reviewedBy ?? null,
    reviewStatus: registry.reviewStatus,
    reviewRemark: registry.reviewRemark ?? null,
    formalReviewAuthorityId: registry.formalReviewAuthorityId ?? null,
    formalReviewAuthorityHash: registry.formalReviewAuthorityHash ?? null,
    formalReviewAuthority: authority
      ? {
          id: authority.id,
          registryId: authority.registryId,
          contentVersion: authority.contentVersion,
          contentSnapshotHash: authority.contentSnapshotHash,
          decision: authority.decision,
          reviewedBy: authority.reviewedBy,
          reviewedAt: authority.reviewedAt?.toISOString() ?? null,
          remark: authority.remark ?? null,
          authorityHash: authority.authorityHash,
        }
      : null,
    updatedAt: registry.updatedAt?.toISOString() ?? null,
  };
}

export function hashBankAccountRegistrySnapshot(registry: BankAccountRegistryFormalSnapshot): string {
  return createHash('sha256')
    .update(stableStringify(bankAccountRegistrySourceSnapshot(registry)))
    .digest('hex');
}

export interface RegistryConfirmationAnchor {
  id: number;
  companyId: number;
  bankName: string;
  smsSender: string;
  accountTail: string;
  updatedAtIso: string;
  snapshotHash: string;
}

export function buildRegistryConfirmationAnchor(
  registry: BankAccountRegistryFormalSnapshot,
): RegistryConfirmationAnchor {
  if (!Number.isInteger(registry.id) || registry.id <= 0) {
    throw new Error('registry.id must be a positive integer');
  }
  if (!(registry.updatedAt instanceof Date) || Number.isNaN(registry.updatedAt.getTime())) {
    throw new Error('registry.updatedAt must be a valid date');
  }
  return {
    id: registry.id,
    companyId: registry.companyId,
    bankName: registry.bankName,
    smsSender: registry.smsSender,
    accountTail: registry.accountTail,
    updatedAtIso: registry.updatedAt.toISOString(),
    snapshotHash: hashBankAccountRegistrySnapshot(registry),
  };
}

export interface CapturedRegistryAnchorSource {
  bankAccountRegistryId: number;
  bankAccountRegistryUpdatedAt: Date;
  bankAccountRegistrySnapshotHash: string;
}

export function isValidAuthorityRegistryAnchor(source: CapturedRegistryAnchorSource): boolean {
  return (
    Number.isInteger(source.bankAccountRegistryId) &&
    Number(source.bankAccountRegistryId) > 0 &&
    source.bankAccountRegistryUpdatedAt instanceof Date &&
    !Number.isNaN(source.bankAccountRegistryUpdatedAt.getTime()) &&
    HEX64.test(source.bankAccountRegistrySnapshotHash ?? '')
  );
}

/** Reconstruct an immutable captured registry anchor for idempotent replay. */
export function capturedRegistryConfirmationAnchor(
  captured: CapturedRegistryAnchorSource,
  identity: BankAccountRegistryIdentity,
): RegistryConfirmationAnchor | null {
  if (!isValidAuthorityRegistryAnchor(captured)) return null;
  if (!Number.isInteger(identity.companyId) || identity.companyId <= 0) return null;
  return {
    id: captured.bankAccountRegistryId,
    companyId: identity.companyId,
    bankName: identity.bankName,
    smsSender: identity.smsSender,
    accountTail: identity.accountTail,
    updatedAtIso: captured.bankAccountRegistryUpdatedAt.toISOString(),
    snapshotHash: captured.bankAccountRegistrySnapshotHash,
  };
}

function normalizeOptionalString(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniqueCodes<T extends string>(codes: T[]): T[] {
  return Array.from(new Set(codes));
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
