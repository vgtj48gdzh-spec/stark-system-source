import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExecutionPlaybookDto {
  @IsString()
  @MaxLength(100)
  playbookCode!: string;

  @IsString()
  @MaxLength(120)
  playbookName!: string;

  @IsIn(['a_wash_card_promo', 'employee_benefit_notice'])
  scenarioCode!: 'a_wash_card_promo' | 'employee_benefit_notice';

  @IsString()
  @MaxLength(80)
  scenarioName!: string;

  @IsString()
  @MaxLength(50)
  recommendationType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  targetSubjectType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessDomain?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  merchantId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recommendationRuleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultScriptTemplateId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  executionChannel?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
