const SENSITIVE_KEY_PATTERN =
  /(api[_-]?v3[_-]?key|private[_-]?key|secret|token|authorization|signature|certificate|cert|platform[_-]?cert|merchant[_-]?key|password)/i;
const PHONE_KEY_PATTERN = /(phone|mobile|payer_phone|customer_phone)/i;

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.length < 7) {
    return '<REDACTED_PHONE>';
  }

  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function redactUrl(value: string) {
  try {
    const parsed = new URL(value);
    const sensitiveParams = ['key', 'token', 'signature', 'secret', 'api_v3_key'];

    for (const param of sensitiveParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '<REDACTED>');
      }
    }

    return parsed.toString();
  } catch {
    return value;
  }
}

export function redactWechatPaySensitiveValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '<REDACTED>';
  }

  if (typeof value === 'string') {
    if (PHONE_KEY_PATTERN.test(key)) {
      return maskPhone(value);
    }

    return redactUrl(value);
  }

  return value;
}

export function redactWechatPayPayload(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactUrl(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactWechatPayPayload(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
        if (SENSITIVE_KEY_PATTERN.test(key) || PHONE_KEY_PATTERN.test(key)) {
          return [key, redactWechatPaySensitiveValue(key, entryValue)];
        }

        return [key, redactWechatPayPayload(entryValue)];
      }),
    );
  }

  return value;
}
