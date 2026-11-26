export function normalizeMobileSmsSender(sender: string) {
  return sender.trim();
}

export function normalizeMobileSmsBody(body: string) {
  return body.replace(/\s+/g, ' ').trim();
}

export function coerceMobileSmsId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

export function resolveMobileSmsDeviceSmsId(rawPayloadJson?: Record<string, unknown> | null) {
  return coerceMobileSmsId(rawPayloadJson?.deviceSmsId ?? rawPayloadJson?.smsId);
}

export function buildMobileSmsFallbackFingerprint(input: {
  deviceId: string;
  simSlot?: number | null;
  senderAddress: string;
  messageBody: string;
  receivedAtDevice: Date;
}) {
  return [
    'fallback',
    input.deviceId.trim(),
    input.simSlot ?? 'null',
    normalizeMobileSmsSender(input.senderAddress),
    input.receivedAtDevice.toISOString(),
    normalizeMobileSmsBody(input.messageBody),
  ].join('|');
}

export function buildMobileSmsDedupeFingerprint(input: {
  deviceId: string;
  deviceSmsId?: string | null;
  simSlot?: number | null;
  senderAddress: string;
  messageBody: string;
  receivedAtDevice: Date;
}) {
  if (input.deviceSmsId?.trim()) {
    return `deviceSmsId|${input.deviceId.trim()}|${input.deviceSmsId.trim()}`;
  }

  return buildMobileSmsFallbackFingerprint({
    deviceId: input.deviceId,
    simSlot: input.simSlot,
    senderAddress: input.senderAddress,
    messageBody: input.messageBody,
    receivedAtDevice: input.receivedAtDevice,
  });
}

export function readParsedString(parsedJson: Record<string, unknown> | null, key: string) {
  const value = parsedJson?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function readParsedNumber(parsedJson: Record<string, unknown> | null, key: string) {
  const value = parsedJson?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
