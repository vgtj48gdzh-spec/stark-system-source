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

export class UpdateExecutionPlaybookDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  playbookCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  playbookName?: string;

  @IsOptional()
  @IsIn(['a_wash_card_promo', 'employee_benefit_notice'])
  scenarioCode?: 'a_wash_card_promo' | 'employee_benefit_notice';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  scenarioName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recommendationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  targetSubjectType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessDomain?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  merchantId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recommendationRuleId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultScriptTemplateId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  executionChannel?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown> | null;
}
