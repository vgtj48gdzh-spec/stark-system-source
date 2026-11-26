export interface CurrentUser {
  id: number;
  username: string;
  realName: string;
  roleCodes: string[];
  identitySource?: 'trusted_proxy' | 'development_override' | 'default_user';
}
