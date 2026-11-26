import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { QueryPerformanceEventsDto } from './query-performance-events.dto';

function normalizeBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return value;
}

export class QueryPendingPerformanceItemsDto extends QueryPerformanceEventsDto {
  @IsOptional()
  @Transform(({ value }) => normalizeBoolean(value))
  @IsBoolean()
  includeResolved?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : String(value).trim()))
  @IsString()
  performanceBlockReason?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : String(value).trim()))
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : String(value).trim()))
  @IsString()
  sourceClassification?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : String(value).trim()))
  @IsString()
  reconciliationStatus?: string;
}
