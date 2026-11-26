import { BadRequestException } from '@nestjs/common';

const MONEY_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

function parseScaledDecimal(value: string | number, fieldLabel = '数值'): bigint {
  const normalizedInput =
    typeof value === 'number' ? value.toFixed(2) : String(value).trim();

  if (!MONEY_PATTERN.test(normalizedInput)) {
    throw new BadRequestException(`${fieldLabel}格式错误`);
  }

  const [wholePart, decimalPart = ''] = normalizedInput.split('.');
  return BigInt(wholePart) * 100n + BigInt((decimalPart + '00').slice(0, 2));
}

/**
 * Exact integer-cent conversion that NEVER rounds a JS number. `String(number)`
 * yields the shortest round-trip representation, so `1.999`/`1.005` keep their
 * full fractional digits and are rejected by the at-most-two-decimals pattern
 * instead of being silently rounded by `toFixed(2)`.
 */
function strictParseScaledDecimal(value: string | number, fieldLabel = '数值'): bigint {
  const normalizedInput =
    typeof value === 'number' ? String(value) : String(value).trim();

  if (!MONEY_PATTERN.test(normalizedInput)) {
    throw new BadRequestException(`${fieldLabel}格式错误`);
  }

  const [wholePart, decimalPart = ''] = normalizedInput.split('.');
  return BigInt(wholePart) * 100n + BigInt((decimalPart + '00').slice(0, 2));
}

function formatScaledDecimal(value: bigint): string {
  const isNegative = value < 0n;
  const normalizedValue = isNegative ? -value : value;
  const wholePart = normalizedValue / 100n;
  const decimalPart = String(normalizedValue % 100n).padStart(2, '0');
  return `${isNegative ? '-' : ''}${wholePart}.${decimalPart}`;
}

export function normalizeMoney(value: string | number): string {
  return formatScaledDecimal(parseScaledDecimal(value, '金额'));
}

/**
 * Exact integer-cent conversion from a decimal string/number with at most two
 * decimals. Never uses floating-point arithmetic; null/undefined/empty/float
 * errors and values with more than two decimals are rejected.
 */
export function decimalToCents(value: string | number | null | undefined, fieldLabel = '金额'): bigint {
  if (value === null || value === undefined || value === '') {
    throw new BadRequestException(`${fieldLabel}必须存在`);
  }
  return strictParseScaledDecimal(value, fieldLabel);
}

export function assertNonNegativeCents(
  value: string | number | null | undefined,
  fieldLabel = '金额',
): bigint {
  const cents = decimalToCents(value, fieldLabel);
  if (cents < 0n) {
    throw new BadRequestException(`${fieldLabel}不能为负`);
  }
  return cents;
}

export function assertPositiveCents(
  value: string | number | null | undefined,
  fieldLabel = '金额',
): bigint {
  const cents = decimalToCents(value, fieldLabel);
  if (cents <= 0n) {
    throw new BadRequestException(`${fieldLabel}必须大于0`);
  }
  return cents;
}

export function centsToDecimal(cents: bigint): string {
  return formatScaledDecimal(cents);
}

export function addMoney(...values: Array<string | number>): string {
  const totalCents = values.reduce((sum, value) => sum + parseScaledDecimal(value, '金额'), 0n);
  return formatScaledDecimal(totalCents);
}

export function compareMoney(left: string | number, right: string | number): number {
  const difference = parseScaledDecimal(left, '金额') - parseScaledDecimal(right, '金额');
  if (difference === 0n) return 0;
  return difference > 0n ? 1 : -1;
}

export function normalizeQuantity(value: string | number): string {
  return formatScaledDecimal(parseScaledDecimal(value, '数量'));
}

export function addQuantity(...values: Array<string | number>): string {
  const total = values.reduce((sum, value) => sum + parseScaledDecimal(value, '数量'), 0n);
  return formatScaledDecimal(total);
}

export function compareQuantity(left: string | number, right: string | number): number {
  const difference = parseScaledDecimal(left, '数量') - parseScaledDecimal(right, '数量');

  if (difference === 0n) {
    return 0;
  }

  return difference > 0n ? 1 : -1;
}

export function absoluteQuantityDifference(
  left: string | number,
  right: string | number,
): string {
  const difference = parseScaledDecimal(left, '数量') - parseScaledDecimal(right, '数量');
  return formatScaledDecimal(difference >= 0n ? difference : -difference);
}

export function subtractQuantity(minuend: string | number, subtrahend: string | number): string {
  const result = parseScaledDecimal(minuend, '数量') - parseScaledDecimal(subtrahend, '数量');

  if (result < 0n) {
    throw new BadRequestException('库存数量不足');
  }

  return formatScaledDecimal(result);
}

export function multiplyMoney(quantity: string | number, unitPrice: string | number): string {
  const quantityScaled = parseScaledDecimal(quantity, '数量');
  const unitPriceScaled = parseScaledDecimal(unitPrice, '金额');
  return formatScaledDecimal((quantityScaled * unitPriceScaled) / 100n);
}
