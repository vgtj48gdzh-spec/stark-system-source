import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRewardEventRuleDto {
  @IsString()
  @MaxLength(100)
  ruleCode!: string;

  @IsString()
  @MaxLength(100)
  ruleName!: string;

  @IsString()
  @MaxLength(100)
  eventType!: string;

  @IsString()
  @MaxLength(50)
  businessDomain!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  requiredTagCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehicleType?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : value === true || value === 'true'))
  @IsBoolean()
  insuranceFlag?: boolean | null;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  rewardEnabled!: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  requiresManualConfirmation!: boolean;

  @IsOptional()
  @IsString()
  defaultWeight?: string;

  @IsOptional()
  @IsString()
  defaultCoefficient?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string | null;
}
