export function normalizeMainlandMobile(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  let digits = raw.replace(/[^0-9+]/g, '');
  if (!digits) {
    return null;
  }

  if (digits.startsWith('+86')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0086')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('86') && digits.length > 11) {
    digits = digits.slice(2);
  }

  digits = digits.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  const exactMobile = digits.match(/1\d{10}/g);
  if (exactMobile?.length) {
    return exactMobile[exactMobile.length - 1];
  }

  return /^\d{11}$/.test(digits) ? digits : null;
}
