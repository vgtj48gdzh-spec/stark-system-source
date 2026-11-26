import type { ContributionAttributionDto } from './dto/business-contribution.dto';
import type { VerifiedContributionSourceSnapshot } from './business-contribution-source-authority';

export const VERIFIED_CONTRIBUTION_AUTHORITY_BUNDLE_SCHEMA_VERSION =
  'verified-contribution-authority-bundle-v1' as const;

/**
 * Transaction-current RBAC proof minted only after the fixed User -> UserRole
 * -> Role -> active Employee -> BusinessScopeGrant lock sequence succeeds.
 * It deliberately contains no repository, QueryRunner, callback or caller
 * supplied business fact.
 */
export interface VerifiedContributionRbacContextV1 {
  readonly permission: 'gov1.contribution.draft.write' | 'gov1.contribution.confirm';
  readonly userId: number;
  readonly employeeId: number;
  readonly companyRef: string;
  readonly businessSectorRef: string | null;
  readonly storeRef: string | null;
  readonly customerRef: string | null;
  readonly expectedContributionId: number | null;
}

/** Complete, immutable server authority result; caller attribution is absent. */
export interface VerifiedContributionAuthorityBundleV1 {
  readonly schemaVersion: typeof VERIFIED_CONTRIBUTION_AUTHORITY_BUNDLE_SCHEMA_VERSION;
  readonly ruleVersion: string;
  readonly profileCode: string;
  readonly sourceSnapshot: Readonly<VerifiedContributionSourceSnapshot>;
  readonly attributions: readonly Readonly<ContributionAttributionDto>[];
  readonly authorityPins: Readonly<{
    economicRootId: string;
    assignmentAuthorityRef: string;
    assignmentAuthorityVersion: number;
    assignmentContentHash: string;
    baselineAuthorityRef: string;
    baselineAuthorityVersion: number;
    baselineContentHash: string;
    correctionWatermarkHash: string;
  }>;
  readonly authorityBundleHash: string;
}
