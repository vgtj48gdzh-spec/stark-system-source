import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

function normalizeString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeDateQueryValue(value: unknown) {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    return undefined;
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return normalizedValue;
  }

  return date.toISOString();
}

function normalizeBooleanQueryValue(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'true' || normalized === '1') {
    return true;
  }

  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return value;
}

export class AbcSyncQueryBaseDto extends PaginationSortQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  sourceTable?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  batchNo?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  statusStandard?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeBooleanQueryValue(value))
  mappingConfirmed?: boolean;

  @IsOptional()
  @Transform(({ value }) => normalizeDateQueryValue(value))
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeDateQueryValue(value))
  @IsDateString()
  dateTo?: string;
}

export class AbcRuleQueryBaseDto extends PaginationSortQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  sourceTable?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeBooleanQueryValue(value))
  isActive?: boolean;
}
