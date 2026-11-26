import { createHash } from 'crypto';

export const OTP_OR_VERIFICATION_BLOCK_REASON = 'otp_or_verification_code_blocked';
export const REDACTED_SECURITY_CREDENTIAL_BODY = '[otp_or_verification_code_blocked]';

const SECURITY_CREDENTIAL_TEXT_HINTS = [
  '验证码',
  '动态码',
  '校验码',
  '登录',
  '身份验证',
  '支付确认',
  '转账确认',
];

const SECURITY_CREDENTIAL_PATTERNS = [
  /\botp\b/i,
  /\bcode\b/i,
  /verification\s+code/i,
  /login\s+code/i,
  /payment\s+confirmation/i,
  /transfer\s+confirmation/i,
];

export function isOtpOrVerificationSms(body: string) {
  const normalizedBody = body.trim();
  if (!normalizedBody) {
    return false;
  }

  return (
    SECURITY_CREDENTIAL_TEXT_HINTS.some((hint) => normalizedBody.includes(hint)) ||
    SECURITY_CREDENTIAL_PATTERNS.some((pattern) => pattern.test(normalizedBody))
  );
}

export function hashSmsBody(body: string) {
  return createHash('sha256').update(normalizeSmsBodyForHash(body)).digest('hex');
}

export function hashSmsSender(sender: string) {
  return createHash('sha256').update(sender.trim().toLowerCase()).digest('hex').slice(0, 16);
}

export function maskSmsSender(sender: string) {
  const trimmed = sender.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 7) {
    return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  }
  if (digits.length >= 4) {
    return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
  }
  if (trimmed.length <= 2) {
    return '***';
  }
  return `${trimmed.slice(0, 1)}***${trimmed.slice(-1)}`;
}

export function buildSecurityCredentialBlockedMetadata(input: {
  sender: string;
  body: string;
  deviceId: string;
  receivedAt: Date;
}) {
  return {
    reason: OTP_OR_VERIFICATION_BLOCK_REASON,
    senderMasked: maskSmsSender(input.sender),
    senderHash: hashSmsSender(input.sender),
    bodyHash: hashSmsBody(input.body),
    deviceId: input.deviceId,
    receivedAt: input.receivedAt.toISOString(),
    rawBodyStored: false,
  };
}

function normalizeSmsBodyForHash(body: string) {
  return body.trim().replace(/\s+/g, ' ');
}
