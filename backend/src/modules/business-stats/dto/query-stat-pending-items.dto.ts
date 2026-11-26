import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

function toOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return value === true || value === 'true';
}

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeDate(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return date.toISOString();
}

export class QueryStatPendingItemsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  type?: 'reward' | 'tag';

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeResolved?: boolean;

  @IsOptional()
  @IsString()
  periodKey?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeDate(value))
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeDate(value))
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  sourceTable?: string;

  @IsOptional()
  @IsString()
  performanceBlockReason?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  sourceClassification?: string;

  @IsOptional()
  @IsString()
  reconciliationStatus?: string;

  @IsOptional()
  @IsIn(['occurredAt', 'updatedAt', 'createdAt'])
  sortBy?: string;
}
