import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMobileDiagnosticHeartbeatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  deviceId!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  receiveSmsPermission?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  readSmsPermission?: boolean;

  @IsOptional()
  @IsDateString()
  deviceReportedAt?: string;

  @IsOptional()
  @IsDateString()
  lastBroadcastReceivedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastRawSmsIngestResult?: string;

  @IsOptional()
  @IsDateString()
  lastRawSmsIngestAt?: string;

  @IsOptional()
  @IsDateString()
  lastInboxSyncAt?: string;

  @IsOptional()
  @IsDateString()
  lastCommandPollAt?: string;

  @IsOptional()
  @IsDateString()
  lastLocalSmsReceivedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pendingUploadQueueCount?: number;

  @IsOptional()
  @IsDateString()
  lastTestUploadAt?: string;

  @IsOptional()
  @IsDateString()
  lastUploadSuccessAt?: string;

  @IsOptional()
  @IsDateString()
  lastUploadFailureAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastUploadFailureReason?: string;

  @IsOptional()
  @IsDateString()
  lastApiSuccessAt?: string;

  @IsOptional()
  @IsDateString()
  lastApiFailureAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastApiFailureReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  resolvedBaseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  baseUrlSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  batteryOptimizationStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  appVisibilityStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  serviceRunningStatus?: string;

  @IsOptional()
  @IsObject()
  runtimeSnapshot?: Record<string, unknown>;
}
