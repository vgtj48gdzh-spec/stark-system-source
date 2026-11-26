import { CurrentUser } from '../../common/interfaces/current-user.interface';

export type ContributionWritePermission =
  | 'gov1.contribution.rule.write'
  | 'gov1.contribution.draft.write'
  | 'gov1.contribution.confirm'
  | 'gov1.contribution.reverse'
  | 'gov1.contribution.anomaly.resolve';

export interface ContributionReadFacts {
  linkedEmployeeId: number | null;
  leaderEmployeeId: number | null;
  businessOwnerEmployeeId: number | null;
  activeMemberEmployeeIds: number[];
  attributionEmployeeIds: number[];
  scopeGranted: boolean;
  scopeDenied: boolean;
}

export type ContributionReadAccess = 'none' | 'own_attribution' | 'full';

export class BusinessContributionAccessPolicy {
  private static readonly draftRoles = new Set([
    'group_leader',
    'business_owner',
    'admin',
    'finance',
    'founder',
    'super_admin',
    'owner',
  ]);

  private static readonly controlRoles = new Set([
    'admin',
    'finance',
    'founder',
    'super_admin',
    'owner',
  ]);

  static canUseWritePermission(
    currentUser: CurrentUser,
    permission: ContributionWritePermission,
  ): boolean {
    const roles = permission === 'gov1.contribution.draft.write'
      ? this.draftRoles
      : this.controlRoles;
    return (
      currentUser.identitySource === 'trusted_proxy' &&
      currentUser.roleCodes.some((role) => roles.has(role))
    );
  }

  static contributionReadAccess(
    currentUser: CurrentUser,
    facts: ContributionReadFacts,
  ): ContributionReadAccess {
    if (facts.scopeDenied) return 'none';
    if (facts.scopeGranted) return 'full';
    if (!facts.linkedEmployeeId) return 'none';
    if (
      facts.leaderEmployeeId === facts.linkedEmployeeId ||
      facts.businessOwnerEmployeeId === facts.linkedEmployeeId
    ) {
      return 'full';
    }
    return facts.attributionEmployeeIds.includes(facts.linkedEmployeeId)
      ? 'own_attribution'
      : 'none';
  }

  static canReadContribution(currentUser: CurrentUser, facts: ContributionReadFacts): boolean {
    return this.contributionReadAccess(currentUser, facts) !== 'none';
  }

  static canReadGroupSummary(currentUser: CurrentUser, facts: ContributionReadFacts): boolean {
    if (facts.scopeDenied) return false;
    if (facts.scopeGranted) return true;
    if (!facts.linkedEmployeeId) return false;
    return (
      facts.leaderEmployeeId === facts.linkedEmployeeId ||
      facts.businessOwnerEmployeeId === facts.linkedEmployeeId ||
      facts.activeMemberEmployeeIds.includes(facts.linkedEmployeeId)
    );
  }
}
