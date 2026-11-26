import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
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

export class QueryPerformanceRulesDto extends PaginationSortQueryDto {
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
  classificationKey?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  includeInPerformance?: boolean;

  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  requiresManualConfirmation?: boolean;

  @IsOptional()
  @IsIn([
    'sourceDomain',
    'eventType',
    'ruleCode',
    'classificationKey',
    'isActive',
    'updatedAt',
    'createdAt',
  ])
  sortBy?:
    | 'sourceDomain'
    | 'eventType'
    | 'ruleCode'
    | 'classificationKey'
    | 'isActive'
    | 'updatedAt'
    | 'createdAt';
}
