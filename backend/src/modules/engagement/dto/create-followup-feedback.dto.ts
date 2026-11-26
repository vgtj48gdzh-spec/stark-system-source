import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateFollowupFeedbackDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recommendationId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recommendationRuleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scriptTemplateId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scriptExperimentId?: number;

  @IsString()
  @MaxLength(30)
  subjectType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  subjectId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  merchantId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessId?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  followedUpFlag!: boolean;

  @IsOptional()
  followupAt?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  customerRepliedFlag!: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  convertedFlag!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nonConversionReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  employeeRemark?: string;

  @IsOptional()
  @IsIn(['recorded', 'ignored', 'reviewed'])
  feedbackStatus?: 'recorded' | 'ignored' | 'reviewed';

  @IsOptional()
  @IsObject()
  normalizedPayload?: Record<string, unknown>;
}
