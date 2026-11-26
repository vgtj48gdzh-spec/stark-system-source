import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

function normalizeInteger(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
}

export class QueryPointsWelfareBatchItemsDto {
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
  @IsIn(['default', 'custom', 'hold', 'excluded'])
  allocationMode?: 'default' | 'custom' | 'hold' | 'excluded';
}
