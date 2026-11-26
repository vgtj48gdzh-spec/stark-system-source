import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
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

export class QueryPerformanceSummariesDto extends PaginationSortQueryDto {
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
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  performanceBlockReason?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  sourceClassification?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  reconciliationStatus?: string;

  @IsOptional()
  @IsIn([
    'periodKey',
    'sourceDomain',
    'eventCount',
    'confirmedEventCount',
    'pendingEventCount',
    'amountTotal',
    'quantityTotal',
    'createdAt',
    'updatedAt',
  ])
  sortBy?:
    | 'periodKey'
    | 'sourceDomain'
    | 'eventCount'
    | 'confirmedEventCount'
    | 'pendingEventCount'
    | 'amountTotal'
    | 'quantityTotal'
    | 'createdAt'
    | 'updatedAt';
}
