export function normalizeVerificationText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function normalizeVerificationPlate(value: unknown): string | null {
  const normalized = normalizeVerificationText(value);
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\s+/g, '').toUpperCase();
}

export function normalizeVerificationDateKey(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const asString = String(value).trim();
  if (!asString) {
    return null;
  }

  const normalized = asString
    .replace(/[年/.]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, ' ');

  const directDateMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (directDateMatch) {
    const [, year, month, day] = directDateMatch;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const pad = (item: number) => String(item).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export function normalizeVerificationPeriodKey(value: unknown): string | null {
  const dateKey = normalizeVerificationDateKey(value);
  return dateKey ? dateKey.slice(0, 7) : null;
}

export function normalizeVerificationAmount(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const raw = String(value).replace(/[,\s，元]/g, '').trim();
  if (!raw) {
    return null;
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric.toFixed(2);
}

export function normalizeVerificationProjectCode(
  value: unknown,
  amount?: unknown,
): string | null {
  const normalized = normalizeVerificationText(value);
  const normalizedAmount = normalizeVerificationAmount(amount);
  if (!normalized && !normalizedAmount) {
    return null;
  }

  const compact = (normalized ?? '')
    .replace(/\s+/g, '')
    .replace(/[()（）【】\[\]，,。.;；:：+＋]/g, '')
    .toUpperCase();

  const amountInt = normalizedAmount ? String(Number(normalizedAmount)) : '';

  if (
    /(18次|洗车卡|洗车套餐)/.test(compact) &&
    (compact.includes('600') || amountInt === '600')
  ) {
    return 'wash_card_18_600';
  }

  if (
    /(定金)/.test(compact) &&
    (compact.includes('100') || amountInt === '100')
  ) {
    return 'deposit_100';
  }

  if (/(抛光|打蜡|内室)/.test(compact)) {
    return 'c_service_bundle';
  }

  return compact || null;
}

export function looksLikeProjectOrPackageName(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const compact = value.replace(/\s+/g, '');
  return Boolean(
    /(洗车|套餐|项目|定金|打蜡|抛光|内室|购物卡|积分|A端|C端|18次|100元|600元|1000元)/i.test(compact),
  );
}

export function compareVerificationDateDistance(
  left: string | null,
  right: string | null,
): number | null {
  if (!left || !right) {
    return null;
  }

  const leftDate = new Date(`${left.slice(0, 10)}T00:00:00`);
  const rightDate = new Date(`${right.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
    return null;
  }

  return Math.abs(Math.round((leftDate.getTime() - rightDate.getTime()) / 86400000));
}

function parseVerificationObjectCandidate(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const candidates = [value, value.replace(/\\"/g, '"')];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }

      if (typeof parsed === 'string') {
        const nested = JSON.parse(parsed);
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          return nested as Record<string, unknown>;
        }
      }
    } catch {
      // Keep trying fallback candidates.
    }
  }

  return null;
}

export function collectVerificationObjectSources(
  ...sources: Array<Record<string, unknown> | null | undefined>
) {
  const result: Array<Record<string, unknown>> = [];

  for (const source of sources) {
    if (!source) {
      continue;
    }

    result.push(source);

    for (const key of ['data', 'payload', 'result']) {
      const nested = parseVerificationObjectCandidate((source as Record<string, unknown>)[key]);
      if (nested) {
        result.push(nested);
      }
    }
  }

  return result;
}
