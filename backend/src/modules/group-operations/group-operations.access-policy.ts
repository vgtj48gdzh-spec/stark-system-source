import { CurrentUser } from '../../common/interfaces/current-user.interface';

export interface GroupAccessFacts {
  leaderEmployeeId: number | null;
  businessOwnerEmployeeId: number | null;
  linkedEmployeeId: number | null;
  activeMemberEmployeeIds: number[];
  scopeGranted: boolean;
  scopeDenied: boolean;
}

export interface CompensationAccessFacts {
  linkedEmployeeId: number | null;
  targetEmployeeId: number;
  leadsTargetGroup: boolean;
  scopeGranted: boolean;
  scopeDenied: boolean;
}

export interface TargetInputCostAccessFacts {
  leaderEmployeeId: number | null;
  businessOwnerEmployeeId: number | null;
  linkedEmployeeId: number | null;
  scopeGranted: boolean;
  scopeDenied: boolean;
}

export interface ManagementScopeFacts {
  scopeGranted: boolean;
  scopeDenied: boolean;
}

export class GroupOperationsAccessPolicy {
  private static readonly highestReadRoles = new Set(['founder', 'super_admin', 'owner']);

  private static readonly managementWriteRoles = new Set([
    'admin',
    'founder',
    'super_admin',
    'owner',
  ]);

  static canReadAggregate(currentUser: CurrentUser, facts: GroupAccessFacts): boolean {
    if (facts.scopeDenied) return false;
    if (currentUser.roleCodes.some((role) => this.highestReadRoles.has(role))) return true;
    if (!facts.linkedEmployeeId) return false;
    return (
      facts.scopeGranted ||
      facts.leaderEmployeeId === facts.linkedEmployeeId ||
      facts.businessOwnerEmployeeId === facts.linkedEmployeeId ||
      facts.activeMemberEmployeeIds.includes(facts.linkedEmployeeId)
    );
  }

  static canManage(currentUser: CurrentUser): boolean {
    return currentUser.roleCodes.some((role) => this.managementWriteRoles.has(role));
  }

  static canManageScope(currentUser: CurrentUser, facts: ManagementScopeFacts): boolean {
    return this.canManage(currentUser) && facts.scopeGranted && !facts.scopeDenied;
  }

  static canReadCompensationProfiles(
    currentUser: CurrentUser,
    facts: CompensationAccessFacts,
  ): boolean {
    if (facts.scopeDenied) return false;
    if (facts.linkedEmployeeId === facts.targetEmployeeId) return true;
    if (currentUser.roleCodes.some((role) => this.highestReadRoles.has(role))) return true;
    if (
      facts.leadsTargetGroup &&
      currentUser.roleCodes.some((role) => role === 'group_leader' || role === 'business_owner')
    ) {
      return true;
    }
    return facts.scopeGranted;
  }

  static canReadTargetInputCosts(
    currentUser: CurrentUser,
    facts: TargetInputCostAccessFacts,
  ): boolean {
    if (facts.scopeDenied) return false;
    if (currentUser.roleCodes.some((role) => this.highestReadRoles.has(role))) return true;
    if (!facts.linkedEmployeeId) return false;
    if (
      currentUser.roleCodes.includes('group_leader') &&
      facts.leaderEmployeeId === facts.linkedEmployeeId
    ) {
      return true;
    }
    if (
      currentUser.roleCodes.includes('business_owner') &&
      facts.businessOwnerEmployeeId === facts.linkedEmployeeId
    ) {
      return true;
    }
    return facts.scopeGranted;
  }

  static dateRangesOverlap(
    leftFrom: string,
    leftTo: string | null,
    rightFrom: string,
    rightTo: string | null,
  ): boolean {
    const leftEnd = leftTo ?? '9999-12-31';
    const rightEnd = rightTo ?? '9999-12-31';
    return leftFrom <= rightEnd && rightFrom <= leftEnd;
  }
}
