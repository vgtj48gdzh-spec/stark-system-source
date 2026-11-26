import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { JobLevel } from '../entities/group-operations.entities';

const NON_NEGATIVE_CENTS = /^(0|[1-9]\d{0,17})$/;
const ZERO_CENTS = /^0$/;
const PERIOD = /^20\d{2}-(0[1-9]|1[0-2])$/;
const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const COMMAND_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;

export class CommandMetadataDto {
  @IsString()
  @Length(3, 500)
  @Matches(/\S/)
  reason!: string;

  @IsString()
  @Length(2, 50)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{1,49}$/)
  sourceChannel!: string;

  @IsString()
  @Length(8, 100)
  @Matches(COMMAND_KEY)
  correlationId!: string;

  @IsString()
  @Length(8, 120)
  @Matches(COMMAND_KEY)
  idempotencyKey!: string;
}

export class LaborCostComponentsDto {
  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  baseGuaranteeCents!: string;

  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  positionPerformanceBudgetCents!: string;

  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  employerSocialCostCents!: string;

  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  fixedBenefitCostCents!: string;

  @IsString()
  @Matches(ZERO_CENTS)
  benefitCashOffsetCents!: string;

  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  otherFixedEmploymentCostCents!: string;
}

export class CreateOrganizationGroupDto extends CommandMetadataDto {
  @IsString()
  @Matches(CODE)
  groupCode!: string;

  @IsString()
  @Length(2, 160)
  @Matches(/\S/)
  groupName!: string;

  @IsString()
  @Length(2, 100)
  companyRef!: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  businessSectorRef?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  storeRef?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  leaderEmployeeId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  businessOwnerEmployeeId?: number;

  @IsISO8601({ strict: true })
  establishedAt!: string;

  @IsString()
  @Length(2, 100)
  safetyFactorPolicyVersionId!: string;

  @IsString()
  @Length(2, 100)
  rampUpPolicyVersionId!: string;
}

export class QueryOrganizationGroupsDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  companyRef?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  businessSectorRef?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  storeRef?: string;

  @IsOptional()
  @IsIn(['active', 'closed'])
  status?: 'active' | 'closed';
}

export class AddGroupMemberDto extends CommandMetadataDto {
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsIn(['L0', 'L1', 'L2', 'L3'])
  jobLevel!: JobLevel;

  @IsString()
  @Matches(CODE)
  roleCode!: string;

  @IsISO8601({ strict: true })
  effectiveFrom!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveTo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  responsibilityWeightBps?: number;
}

export class EndGroupMemberDto extends CommandMetadataDto {
  @IsISO8601({ strict: true })
  effectiveTo!: string;
}

export class CreateCompensationProfileDto
  extends CommandMetadataDto
  implements LaborCostComponentsDto
{
  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  baseGuaranteeCents!: string;

  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  positionPerformanceBudgetCents!: string;

  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  employerSocialCostCents!: string;

  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  fixedBenefitCostCents!: string;

  @IsString()
  @Matches(ZERO_CENTS)
  benefitCashOffsetCents!: string;

  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  otherFixedEmploymentCostCents!: string;

  @IsString()
  @IsIn(['CNY'])
  currency = 'CNY';

  @IsISO8601({ strict: true })
  effectiveFrom!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  benefitRuleVersionId?: string;
}

export class MarginalTargetPreviewDto extends LaborCostComponentsDto {
  @IsInt()
  @Min(1)
  @Max(100_000)
  safetyFactorBps!: number;

  @IsInt()
  @Min(1)
  @Max(10_000)
  rampFactorBps = 10_000;
}

export class GroupHiringImpactPreviewDto extends LaborCostComponentsDto {}

export class GroupTargetCalculationInputPreviewDto {
  @IsString()
  @Length(2, 100)
  targetPolicyVersionId!: string;
}

export class CreatePayrollCalendarRuleDto extends CommandMetadataDto {
  @IsString()
  @Length(2, 100)
  companyRef!: string;

  @IsString()
  @Matches(PERIOD)
  settlementPeriod!: string;

  @IsString()
  @Length(2, 100)
  calendarRuleVersionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @ArrayUnique()
  @IsISO8601({ strict: true }, { each: true })
  payrollDates!: string[];
}

export class CreateGroupTargetPolicyDto extends CommandMetadataDto {
  @IsString()
  @Matches(PERIOD)
  settlementPeriod!: string;

  @IsString()
  @Length(2, 100)
  policyVersionId!: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  safetyFactorBps!: number;

  @IsInt()
  @Min(1)
  @Max(10_000)
  rampFactorBps!: number;

  @IsInt()
  @Min(1)
  standardPayrollDays!: number;

  @IsString()
  @Length(2, 100)
  calendarRuleVersionId!: string;

  @IsString()
  @Length(2, 100)
  safetyFactorPolicyVersionId!: string;

  @IsString()
  @Length(2, 100)
  rampUpPolicyVersionId!: string;

  @IsIn(['CNY'])
  currency: 'CNY' = 'CNY';
}

export class MemberPayrollDaysDto {
  @IsInt()
  @Min(1)
  groupMemberId!: number;

  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsInt()
  @Min(0)
  activePayrollDays!: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompensationProfilePayrollDaysDto)
  profileSegments?: CompensationProfilePayrollDaysDto[];
}

export class CompensationProfilePayrollDaysDto {
  @IsInt()
  @Min(1)
  compensationProfileId!: number;

  @IsInt()
  @Min(0)
  activePayrollDays!: number;
}

export class CalculateGroupTargetDto extends CommandMetadataDto {
  @IsString()
  @Matches(PERIOD)
  settlementPeriod!: string;

  @IsString()
  @Length(2, 100)
  targetPolicyVersionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MemberPayrollDaysDto)
  members!: MemberPayrollDaysDto[];
}
