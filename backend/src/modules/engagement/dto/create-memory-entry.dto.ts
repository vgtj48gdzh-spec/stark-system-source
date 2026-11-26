import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMemoryEntryDto {
  @IsIn(['customer', 'employee'])
  subjectType!: 'customer' | 'employee';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  subjectId!: number;

  @IsString()
  @MaxLength(50)
  memoryType!: string;

  @IsString()
  content!: string;

  @IsString()
  @MaxLength(50)
  sourceType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceId?: string;

  @IsIn(['confirmed', 'inferred', 'uncertain'])
  evidenceStatus!: 'confirmed' | 'inferred' | 'uncertain';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  confidenceScore!: number;

  @IsOptional()
  @Type(() => String)
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
