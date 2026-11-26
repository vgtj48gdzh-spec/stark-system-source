import { CurrentUser } from '../interfaces/current-user.interface';

export const FULL_CONTACT_VIEW_ROLE_CODES = ['owner', 'admin', 'super_admin'] as const;

export function canViewFullContact(currentUser: CurrentUser | null | undefined) {
  if (!currentUser) {
    return false;
  }
  return FULL_CONTACT_VIEW_ROLE_CODES.some((roleCode) => currentUser.roleCodes.includes(roleCode));
}

export function maskPhoneNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return '****';
  }
  if (digits.length <= 4) {
    return '****';
  }
  if (digits.length < 11) {
    const visibleDigitCount = digits.length - 4;
    const prefixLength = Math.min(3, Math.ceil(visibleDigitCount / 2));
    const suffixLength = visibleDigitCount - prefixLength;
    const suffix = suffixLength > 0 ? digits.slice(-suffixLength) : '';
    return `${digits.slice(0, prefixLength)}****${suffix}`;
  }
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}
