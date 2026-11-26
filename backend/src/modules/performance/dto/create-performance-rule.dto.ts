import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { PerformanceEventSourceDomain } from '../../../shared/enums/performance-event-source-domain.enum';

export class CreatePerformanceRuleDto {
  @IsEnum(PerformanceEventSourceDomain)
  sourceDomain!: PerformanceEventSourceDomain;

  @IsString()
  @Length(1, 100)
  eventType!: string;

  @IsString()
  @Length(1, 100)
  ruleCode!: string;

  @IsString()
  @Length(1, 100)
  ruleName!: string;

  @IsString()
  @Length(1, 100)
  classificationKey!: string;

  @IsOptional()
  @IsBoolean()
  includeInPerformance?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  defaultWeight?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  defaultCoefficient?: string;

  @IsOptional()
  @IsBoolean()
  requiresManualConfirmation?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
