import http, { gov1AcceptanceHttp } from './http';

export type AuthenticatedIdentityScope = 'application' | 'gov1_acceptance';

export interface AuthenticatedUserResponse {
  id: number;
  username: string;
  realName: string;
  roleCodes: string[];
  identitySource: 'trusted_proxy' | 'development_override' | 'default_user';
  formalIdentityBound: boolean;
}

export function getAuthenticatedUser(scope: AuthenticatedIdentityScope = 'application', signal?: AbortSignal) {
  const client = scope === 'gov1_acceptance' ? gov1AcceptanceHttp : http;

  return client.get<{
    success: boolean;
    message: string;
    data: AuthenticatedUserResponse;
  }>('/auth/current-user', {
    signal,
    headers: { 'x-suppress-global-error': '1' },
  });
}
