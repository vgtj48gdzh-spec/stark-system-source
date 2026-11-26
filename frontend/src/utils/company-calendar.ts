export const COMPANY_TIME_ZONE = 'Asia/Shanghai';

const companyDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: COMPANY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

interface CompanyDateParts {
  year: string;
  month: string;
  day: string;
}

function companyDateParts(instant: Date): CompanyDateParts {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new TypeError('Company calendar requires a valid instant.');
  }

  const values = new Map(
    companyDateFormatter
      .formatToParts(instant)
      .filter((part) => part.type === 'year' || part.type === 'month' || part.type === 'day')
      .map((part) => [part.type, part.value]),
  );
  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');
  if (!year || !month || !day) {
    throw new RangeError('Company calendar could not resolve date parts.');
  }

  return { year, month, day };
}

export function companyDateKey(instant: Date = new Date()): string {
  const { year, month, day } = companyDateParts(instant);
  return `${year}-${month}-${day}`;
}

export function companyPeriodKey(instant: Date = new Date()): string {
  const { year, month } = companyDateParts(instant);
  return `${year}-${month}`;
}
