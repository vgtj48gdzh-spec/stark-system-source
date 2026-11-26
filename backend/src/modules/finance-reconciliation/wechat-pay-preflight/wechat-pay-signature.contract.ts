import { createHmac, timingSafeEqual } from 'node:crypto';

export type WechatPaySignatureContractMode =
  | 'dummy_fixture'
  | 'real_wechat_pay_v3_placeholder';

export interface WechatPaySignatureContractInput {
  mode: WechatPaySignatureContractMode;
  timestamp: string;
  nonce: string;
  body: string;
  signature: string;
  dummySecret?: string;
  now?: Date;
  maxClockSkewSeconds?: number;
}

export interface WechatPaySignatureContractResult {
  accepted: boolean;
  outcome:
    | 'verified_dummy_signature'
    | 'invalid_signature'
    | 'timestamp_out_of_window'
    | 'missing_signature_fields'
    | 'real_verification_not_implemented';
  algorithm: 'HMAC-SHA256-DUMMY-ONLY' | 'RSA-SHA256-WECHAT-PAY-V3-PLACEHOLDER';
  noExternalNetworkCall: true;
  noRealCredentialRequired: true;
  usedDummyFixture: boolean;
  warnings: string[];
}

function buildWechatPaySignatureMessage(timestamp: string, nonce: string, body: string) {
  return `${timestamp}\n${nonce}\n${body}\n`;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isTimestampFresh(
  timestamp: string,
  now: Date,
  maxClockSkewSeconds: number,
) {
  const numericTimestamp = Number(timestamp);

  if (!Number.isFinite(numericTimestamp)) {
    return false;
  }

  const timestampMs =
    String(Math.trunc(numericTimestamp)).length > 10
      ? numericTimestamp
      : numericTimestamp * 1000;
  const deltaSeconds = Math.abs(now.getTime() - timestampMs) / 1000;

  return deltaSeconds <= maxClockSkewSeconds;
}

export function createDummyWechatPayFixtureSignature(input: {
  timestamp: string;
  nonce: string;
  body: string;
  dummySecret: string;
}) {
  return createHmac('sha256', input.dummySecret)
    .update(buildWechatPaySignatureMessage(input.timestamp, input.nonce, input.body))
    .digest('base64');
}

export function verifyWechatPaySignatureContract(
  input: WechatPaySignatureContractInput,
): WechatPaySignatureContractResult {
  if (input.mode !== 'dummy_fixture') {
    return {
      accepted: false,
      outcome: 'real_verification_not_implemented',
      algorithm: 'RSA-SHA256-WECHAT-PAY-V3-PLACEHOLDER',
      noExternalNetworkCall: true,
      noRealCredentialRequired: true,
      usedDummyFixture: false,
      warnings: [
        'Real WeChat Pay API v3 signature verification is intentionally not implemented in this preflight contract.',
      ],
    };
  }

  if (!input.timestamp || !input.nonce || !input.body || !input.signature || !input.dummySecret) {
    return {
      accepted: false,
      outcome: 'missing_signature_fields',
      algorithm: 'HMAC-SHA256-DUMMY-ONLY',
      noExternalNetworkCall: true,
      noRealCredentialRequired: true,
      usedDummyFixture: true,
      warnings: ['Dummy signature fixture is missing required fields.'],
    };
  }

  const maxClockSkewSeconds = input.maxClockSkewSeconds ?? 300;
  const now = input.now ?? new Date();

  if (!isTimestampFresh(input.timestamp, now, maxClockSkewSeconds)) {
    return {
      accepted: false,
      outcome: 'timestamp_out_of_window',
      algorithm: 'HMAC-SHA256-DUMMY-ONLY',
      noExternalNetworkCall: true,
      noRealCredentialRequired: true,
      usedDummyFixture: true,
      warnings: ['Dummy fixture timestamp is outside the allowed replay window.'],
    };
  }

  const expectedSignature = createDummyWechatPayFixtureSignature({
    timestamp: input.timestamp,
    nonce: input.nonce,
    body: input.body,
    dummySecret: input.dummySecret,
  });
  const accepted = safeEqual(expectedSignature, input.signature);

  return {
    accepted,
    outcome: accepted ? 'verified_dummy_signature' : 'invalid_signature',
    algorithm: 'HMAC-SHA256-DUMMY-ONLY',
    noExternalNetworkCall: true,
    noRealCredentialRequired: true,
    usedDummyFixture: true,
    warnings: [
      'This verifies only the offline dummy fixture contract, not real WeChat Pay API v3 signatures.',
    ],
  };
}
