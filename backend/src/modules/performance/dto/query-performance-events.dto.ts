import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';
import { PerformanceEventSourceDomain } from '../../../shared/enums/performance-event-source-domain.enum';

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

function normalizeBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return value;
}

export class QueryPerformanceEventsDto extends PaginationSortQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @IsEnum(PerformanceEventSourceDomain)
  sourceDomain?: PerformanceEventSourceDomain;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  eventType?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  sourceTable?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  confirmedFlag?: boolean;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
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
  @IsIn([
    'occurredAt',
    'periodKey',
    'sourceDomain',
    'eventType',
    'amountStandard',
    'quantityStandard',
    'confirmedFlag',
    'createdAt',
    'updatedAt',
  ])
  sortBy?:
    | 'occurredAt'
    | 'periodKey'
    | 'sourceDomain'
    | 'eventType'
    | 'amountStandard'
    | 'quantityStandard'
    | 'confirmedFlag'
    | 'createdAt'
    | 'updatedAt';
}
