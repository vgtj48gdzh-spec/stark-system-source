import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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

export class QueryPointsWelfarePreviewDto {
  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  periodKey?: string;

  @Transform(({ value }) => normalizeInteger(value))
  @IsOptional()
  @IsInt()
  companyId?: number;
}
