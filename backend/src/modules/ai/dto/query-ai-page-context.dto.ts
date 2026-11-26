import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeInteger(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

export class QueryAiPageContextDto {
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @MaxLength(191)
  routePath!: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityId?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsIn([
    'admin',
    'finance',
    'approver',
    'founder',
    'operator',
    'store_manager',
    'customer_service',
  ])
  role?:
    | 'admin'
    | 'finance'
    | 'approver'
    | 'founder'
    | 'operator'
    | 'store_manager'
    | 'customer_service';

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsIn([
    'global',
    'customer_binding',
    'sheet_repair',
    'performance_confirmation',
    'data_cleanup',
  ])
  scene?:
    | 'global'
    | 'customer_binding'
    | 'sheet_repair'
    | 'performance_confirmation'
    | 'data_cleanup';

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @MaxLength(191)
  sourceActionId?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @MaxLength(20)
  periodKey?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @MaxLength(40)
  dateFrom?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @MaxLength(40)
  dateTo?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @MaxLength(4000)
  pageQuery?: string;

  @Transform(({ value }) => normalizeInteger(value))
  @IsOptional()
  @IsInt()
  sourceSummaryId?: number;
}
