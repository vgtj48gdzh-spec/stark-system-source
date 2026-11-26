export function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatMoney(value?: string | number | null) {
  if (value === undefined || value === null || value === '') {
    return '0.00';
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized.toFixed(2) : String(value);
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}
