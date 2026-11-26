import { Transform } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

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

export class CreatePointsWelfareBatchDraftDto {
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  periodKey!: string;

  @Transform(({ value }) => normalizeInteger(value))
  @IsOptional()
  @IsInt()
  companyId?: number;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @Length(1, 100)
  providerKey?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @Length(1, 150)
  sourceActionId?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @Length(1, 150)
  threadKey?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @Length(1, 500)
  remark?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
