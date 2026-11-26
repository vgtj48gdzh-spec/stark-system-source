import { Transform } from 'class-transformer';
import { IsDateString, IsOptional } from 'class-validator';

function normalizeDateQueryValue(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalizedValue = String(value).trim();

  if (!normalizedValue) {
    return undefined;
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return normalizedValue;
  }

  return date.toISOString();
}

export class DateRangeQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeDateQueryValue(value))
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeDateQueryValue(value))
  @IsDateString()
  dateTo?: string;
}
