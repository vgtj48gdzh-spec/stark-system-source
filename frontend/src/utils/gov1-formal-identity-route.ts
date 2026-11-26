export const GOV1_FORMAL_IDENTITY_ROUTE_META_KEY = 'requiresGov1FormalIdentity';

export interface Gov1FormalIdentityRouteRecordLike {
  meta: Record<string, unknown>;
}

export function requiresGov1FormalIdentity(
  matched: readonly Gov1FormalIdentityRouteRecordLike[],
): boolean {
  return matched.some(
    (record) => record.meta[GOV1_FORMAL_IDENTITY_ROUTE_META_KEY] === true,
  );
}

export interface Gov1FormalIdentityBase {
  formalIdentityBound: boolean;
  roleCodes: string[];
}

export type Gov1FormalIdentityRouteDecision<TIdentity extends Gov1FormalIdentityBase> =
  | {
      applies: false;
      admitted: true;
      identity: null;
      reason: 'not_applicable';
    }
  | {
      applies: true;
      admitted: boolean;
      identity: TIdentity | null;
      reason: 'allowed' | 'identity_unavailable' | 'role_denied';
    };

export async function evaluateGov1FormalIdentityRoute<
  TIdentity extends Gov1FormalIdentityBase,
>(
  applies: boolean,
  allowedRoles: readonly string[],
  loadIdentity: () => Promise<TIdentity>,
): Promise<Gov1FormalIdentityRouteDecision<TIdentity>> {
  if (!applies) {
    return {
      applies: false,
      admitted: true,
      identity: null,
      reason: 'not_applicable',
    };
  }

  try {
    const identity = await loadIdentity();
    if (!identity.formalIdentityBound) {
      return {
        applies: true,
        admitted: false,
        identity: null,
        reason: 'identity_unavailable',
      };
    }

    const admitted = identity.roleCodes.some((role) => allowedRoles.includes(role));
    return {
      applies: true,
      admitted,
      identity,
      reason: admitted ? 'allowed' : 'role_denied',
    };
  } catch {
    return {
      applies: true,
      admitted: false,
      identity: null,
      reason: 'identity_unavailable',
    };
  }
}
