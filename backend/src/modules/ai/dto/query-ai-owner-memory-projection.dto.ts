import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeCode(value: unknown) {
  return normalizeString(value)?.toLowerCase();
}

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

export class QueryAiOwnerMemoryProjectionDto {
  @IsOptional()
  @Transform(({ value }) => normalizeCode(value))
  @IsIn(['owner_assistant', 'internal_assistant', 'external_assistant'])
  audience?: 'owner_assistant' | 'internal_assistant' | 'external_assistant';

  @IsOptional()
  @Transform(({ value }) => normalizeCode(value))
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  businessDomain?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeCode(value))
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  assistantRole?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeCode(value))
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  scene?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @MaxLength(191)
  @Matches(/^\/[A-Za-z0-9/_-]*$/)
  routePath?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeCode(value))
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_-]*$/)
  entityType?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
