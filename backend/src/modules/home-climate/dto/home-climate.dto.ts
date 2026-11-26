import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DEVICE_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const PRESET_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const DID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export class RegisterHomeClimateDeviceDto {
  @IsString()
  @Matches(DEVICE_CODE_PATTERN)
  deviceCode!: string;

  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name!: string;

  @IsString()
  @Matches(DID_PATTERN)
  did!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;
}

export class UpdateHomeClimateDeviceDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateHomeClimatePresetDto {
  @IsString()
  @Matches(PRESET_CODE_PATTERN)
  presetCode!: string;

  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  presetName!: string;

  @IsObject()
  properties!: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class UpdateHomeClimatePresetDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  presetName?: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class ControlHomeClimateDeviceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  presetId!: number;

  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,80}$/)
  requestIdempotencyKey!: string;
}

export class LobsterHomeClimateControlDto {
  @IsString()
  @Matches(DEVICE_CODE_PATTERN)
  deviceCode!: string;

  @IsString()
  @Matches(PRESET_CODE_PATTERN)
  presetCode!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(17)
  @Max(30)
  temperature?: number;
}

export class LobsterHomeClimateContextControlDto {
  @IsString()
  @IsIn(['on', 'off', 'cool', 'dry', 'heat'])
  intent!: 'on' | 'off' | 'cool' | 'dry' | 'heat';
}

export class ListHomeClimateControlLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deviceId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
