import { Transform } from 'class-transformer';
import {
  IsDateString,
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

export class MarkAiActionStateDto {
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  actionId!: string;

  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  taskType!: string;

  @Transform(({ value }) => normalizeString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  ownerRole!: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(191)
  sourceKey?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsIn(['active', 'in_progress', 'deferred', 'waiting_review', 'done', 'ignored'])
  processingStatus!: 'active' | 'in_progress' | 'deferred' | 'waiting_review' | 'done' | 'ignored';

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsDateString()
  deferUntil?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsDateString()
  reopenAt?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deferReason?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  statusRemark?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(32)
  timeBucket?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(60)
  bucketLabel?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeAnchorType?: string;

  @Transform(({ value }) => normalizeString(value))
  @IsOptional()
  @IsDateString()
  timeAnchorDate?: string;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
