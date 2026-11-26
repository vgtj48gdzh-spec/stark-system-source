import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

function normalizeString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeStringArray(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return value;
}

export class UpdateAiMemoryEntryDto {
  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn([
    'founder_principle',
    'founder_preference',
    'role_playbook',
    'reasoning_pattern',
    'rule_exception',
    'do_not_generalize_case',
    'language_style',
    'term_definition',
  ])
  memoryType?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn(['founder', 'role', 'global', 'scene', 'route', 'entity_type'])
  scopeType?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(191)
  scopeKey?: string;

  @Transform(({ value }) => normalizeStringArray(value))
  @IsOptional()
  @IsArray()
  roleScope?: string[];

  @Transform(({ value }) => normalizeStringArray(value))
  @IsOptional()
  @IsArray()
  sceneScope?: string[];

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(191)
  title?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  content?: string;

  @Transform(({ value }) => normalizeStringArray(value))
  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  priorityLevel?: number;

  @IsOptional()
  @IsBoolean()
  enabledFlag?: boolean;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceType?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn(['case_only', 'same_pattern', 'role_only', 'global_reference', 'do_not_apply'])
  generalizationMode?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn(['must_consider', 'suggest_only', 'cite_when_relevant', 'never_auto_apply'])
  aiUsageMode?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
