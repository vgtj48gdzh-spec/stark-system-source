import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateMemoryEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  memoryType?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceId?: string;

  @IsOptional()
  @IsIn(['confirmed', 'inferred', 'uncertain'])
  evidenceStatus?: 'confirmed' | 'inferred' | 'uncertain';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  confidenceScore?: number;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
