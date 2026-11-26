import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class GenerateBusinessStatSummariesDto {
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  summaryDomains?: string[];

  @IsOptional()
  @IsString()
  periodKey?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  forceRegenerate?: boolean;
}
