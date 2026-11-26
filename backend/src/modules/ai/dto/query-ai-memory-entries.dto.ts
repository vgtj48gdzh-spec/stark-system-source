import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
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

function toOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === 0 || value === '0') {
    return false;
  }
  return value;
}

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

export class QueryAiMemoryEntriesDto {
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @MaxLength(64)
  memoryType?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsIn(['founder', 'role', 'global', 'scene', 'route', 'entity_type'])
  scopeType?: 'founder' | 'role' | 'global' | 'scene' | 'route' | 'entity_type';

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @MaxLength(64)
  roleScope?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @MaxLength(64)
  sceneScope?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  enabledFlag?: boolean;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/)
  sortBy?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeString(value)?.toUpperCase())
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
