import { parseBoc95566Sms } from '../../finance-bank-sms/utils/boc-bank-sms.util';
import { BANK_SMS_PARSER_POLICY_VERSION } from '../../finance-bank-sms/utils/bank-sms-promotion-policy.constants';
import {
  hashSmsBody,
  hashSmsSender,
  isOtpOrVerificationSms,
  OTP_OR_VERIFICATION_BLOCK_REASON,
} from './sms-security.util';

export type SmsClassificationType = 'verification_code' | 'bank_transaction' | 'other';

export interface ClassifiedSmsMessageResult {
  classifyType: SmsClassificationType;
  confidence: string;
  parsedJson: Record<string, unknown> | null;
  parserPolicyVersion: string | null;
}

const CHINESE_VERIFICATION_HINTS = [
  '\u9a8c\u8bc1\u7801',
  '\u6821\u9a8c\u7801',
  '\u52a8\u6001\u7801',
  '\u767b\u5f55',
  '\u8eab\u4efd\u9a8c\u8bc1',
  '\u652f\u4ed8\u786e\u8ba4',
  '\u8f6c\u8d26\u786e\u8ba4',
];

function normalizeConfidence(value: number) {
  return Math.max(0, Math.min(1, value)).toFixed(2);
}

function classifySecurityCredential(sender: string, body: string, receivedAt: Date) {
  const loweredBody = body.toLowerCase();
  const hasVerificationHint =
    CHINESE_VERIFICATION_HINTS.some((hint) => body.includes(hint)) ||
    loweredBody.includes('otp') ||
    loweredBody.includes('verification code') ||
    /\bcode\b/i.test(body) ||
    isOtpOrVerificationSms(body);

  if (!hasVerificationHint) {
    return null;
  }

  return {
    classifyType: 'verification_code' as const,
    confidence: normalizeConfidence(0.98),
    parserPolicyVersion: null,
    parsedJson: {
      reason: OTP_OR_VERIFICATION_BLOCK_REASON,
      senderHash: hashSmsSender(sender),
      bodyHash: hashSmsBody(body),
      receivedAt: receivedAt.toISOString(),
      rawBodyStored: false,
    },
  };
}

export function classifySmsMessage(input: {
  sender: string;
  body: string;
  receivedAt: Date;
}): ClassifiedSmsMessageResult {
  const sender = input.sender.trim();
  const body = input.body.trim();

  const securityCredential = classifySecurityCredential(sender, body, input.receivedAt);
  if (securityCredential) {
    return securityCredential;
  }

  if (sender === '95566') {
    const parsedBankSms = parseBoc95566Sms(body, input.receivedAt);
    if (parsedBankSms.parseStatus === 'parsed' || parsedBankSms.parseStatus === 'partial') {
      return {
        classifyType: 'bank_transaction',
        confidence: parsedBankSms.parseConfidence,
        parserPolicyVersion: BANK_SMS_PARSER_POLICY_VERSION,
        parsedJson: {
          parseStatus: parsedBankSms.parseStatus,
          parserPolicyVersion: BANK_SMS_PARSER_POLICY_VERSION,
          bankName: parsedBankSms.bankName,
          sender,
          accountTail: parsedBankSms.accountTail,
          accountAlias: parsedBankSms.accountAlias,
          bankBusinessDate: parsedBankSms.bankBusinessDate?.toISOString() ?? null,
          smsReceivedAt: parsedBankSms.smsReceivedAt.toISOString(),
          direction: parsedBankSms.direction,
          amount: parsedBankSms.amount,
          balanceAfter: parsedBankSms.balanceAfter,
          counterparty: parsedBankSms.counterparty,
          normalizedBody: parsedBankSms.normalizedBody,
          parseNote: parsedBankSms.parseNote,
        },
      };
    }
  }

  return {
    classifyType: 'other',
    confidence: normalizeConfidence(0.10),
    parsedJson: null,
    parserPolicyVersion: null,
  };
}
