import { Type } from 'class-transformer';
import {
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

export class CreateAiRecommendationDto {
  @IsString()
  @MaxLength(30)
  subjectType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  subjectId!: number;

  @IsString()
  @MaxLength(50)
  recommendationType!: string;

  @IsString()
  recommendationText!: string;

  @IsOptional()
  @IsString()
  recommendationReason?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recommendationRuleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  matchedMemoryEntryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  matchedInteractionId?: number;

  @IsOptional()
  @IsObject()
  sourceContext?: Record<string, unknown>;

  @IsIn(['confirmed', 'inferred', 'uncertain'])
  evidenceStatus!: 'confirmed' | 'inferred' | 'uncertain';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  confidenceScore!: number;

  @IsOptional()
  @IsIn(['strong', 'weak'])
  ruleStrength?: 'strong' | 'weak';

  @IsString()
  @MaxLength(30)
  status!: string;
}
