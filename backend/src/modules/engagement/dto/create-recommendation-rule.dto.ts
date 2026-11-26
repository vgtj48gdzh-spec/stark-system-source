import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRecommendationRuleDto {
  @IsString()
  @MaxLength(100)
  ruleCode!: string;

  @IsString()
  @MaxLength(120)
  ruleName!: string;

  @IsIn([
    'content_recommendation',
    'followup_recommendation',
    'script_recommendation',
    'benefit_reminder_recommendation',
    'customer_interest_recommendation',
  ])
  recommendationType!:
    | 'content_recommendation'
    | 'followup_recommendation'
    | 'script_recommendation'
    | 'benefit_reminder_recommendation'
    | 'customer_interest_recommendation';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  subjectType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessDomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  triggerMemoryType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  triggerInteractionType?: string;

  @IsIn(['confirmed', 'inferred', 'uncertain'])
  evidenceStatus!: 'confirmed' | 'inferred' | 'uncertain';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  confidenceScore!: number;

  @IsIn(['strong', 'weak'])
  ruleStrength!: 'strong' | 'weak';

  @IsOptional()
  @IsObject()
  matchConditions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  recommendationTemplate?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
