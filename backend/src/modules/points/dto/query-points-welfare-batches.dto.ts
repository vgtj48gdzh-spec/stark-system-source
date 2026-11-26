import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches } from 'class-validator';

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

export class QueryPointsWelfareBatchesDto {
  @Transform(({ value }) => normalizeInteger(value))
  @IsOptional()
  @IsInt()
  page?: number;

  @Transform(({ value }) => normalizeInteger(value))
  @IsOptional()
  @IsInt()
  pageSize?: number;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  periodKey?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  batchStatus?: string;

  @Transform(({ value }) => normalizeInteger(value))
  @IsOptional()
  @IsInt()
  companyId?: number;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsIn(['createdAt', 'requestedAt', 'periodKey', 'targetEmployeeCount', 'targetTotalAmount'])
  sortBy?: 'createdAt' | 'requestedAt' | 'periodKey' | 'targetEmployeeCount' | 'targetTotalAmount';

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
}
