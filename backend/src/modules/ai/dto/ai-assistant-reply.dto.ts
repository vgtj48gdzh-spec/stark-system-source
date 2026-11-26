import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

export class AiAssistantReplyDto {
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @IsNotEmpty()
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
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  userMessage!: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @MaxLength(191)
  threadKey?: string;

  @IsOptional()
  @IsObject()
  currentFilters?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  currentFocus?: Record<string, unknown>;
}
