import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
import {
  BUSINESS_CONTRIBUTION_DOMAINS,
  BusinessContributionDomain,
  CONTRIBUTION_ANOMALY_RESOLUTIONS,
  CONTRIBUTION_ANOMALY_STATUSES,
  CONTRIBUTION_ANOMALY_TYPES,
  ContributionAnomalyResolution,
  ContributionAnomalyStatus,
  ContributionAnomalyType,
  CONTRIBUTION_ATTRIBUTION_ROLES,
  ContributionAttributionRole,
  ContributionConfirmationStatus,
} from '../entities/business-contribution.entities';
import {
  BUSINESS_CONTRIBUTION_CORRECTION_REASON_CODES,
  BUSINESS_CONTRIBUTION_CORRECTION_TYPES,
  BusinessContributionCorrectionReasonCode,
  BusinessContributionCorrectionType,
} from '../entities/business-contribution-correction.entity';
import { CommandMetadataDto } from './group-operations.dto';

const NON_NEGATIVE_CENTS = /^(0|[1-9]\d{0,18})$/;
const PERIOD = /^20\d{2}-(0[1-9]|1[0-2])$/;
const CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const HASH = /^[0-9a-f]{64}$/;

export const CONTRIBUTION_COST_CATEGORIES = [
  'product_purchase',
  'direct_loss',
  'attributable_delivery',
  'special_direct',
  'refund',
  'product_cost',
  'barrel_direct',
  'refund_loss',
  'parts',
  'outsourced',
  'other_direct',
  'rework',
  'third_party',
  'dedicated_server',
] as const;

export class PublishContributionSourceAuthorityDto extends CommandMetadataDto {
  @IsString()
  @Length(2, 100)
  ruleVersionId!: string;

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

  @IsIn(BUSINESS_CONTRIBUTION_DOMAINS)
  businessDomain!: BusinessContributionDomain;

  @IsString()
  @Matches(CODE)
  sourceSystem!: string;

  @IsString()
  @Matches(CODE)
  sourceType!: string;

  @IsString()
  @Length(3, 100)
  adapterVersion!: string;

  @IsISO8601({ strict: true })
  effectiveFrom!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveTo?: string;

  @IsIn(['CNY'])
  currency: 'CNY' = 'CNY';
}

export class QueryContributionSourceAuthoritiesDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  companyRef?: string;

  @IsOptional()
  @IsIn(BUSINESS_CONTRIBUTION_DOMAINS)
  businessDomain?: BusinessContributionDomain;

  @IsOptional()
  @IsIn(['approved', 'superseded'])
  status?: 'approved' | 'superseded';
}

export class ContributionRevenueEvidenceDto {
  @IsString()
  @Matches(NON_NEGATIVE_CENTS)
  amountCents!: string;

  @IsString()
  @Matches(CODE)
  sourceSystem!: string;

  @IsString()
  @Matches(CODE)
  sourceType!: string;

  @IsString()
  @Matches(CODE)
  sourceId!: string;

  @IsString()
  @Matches(CODE)
  sourceVersion!: string;

  @IsString()
  @Matches(CODE)
  sourceAllocationId!: string;

  @IsString()
  @Length(3, 500)
  evidenceRef!: string;

  @IsString()
  @Matches(HASH)
  evidenceHash!: string;

  @IsISO8601({ strict: true })
  occurredAt!: string;
}

export class ContributionDirectCostEvidenceDto extends ContributionRevenueEvidenceDto {
  @IsIn(CONTRIBUTION_COST_CATEGORIES)
  costCategory!: (typeof CONTRIBUTION_COST_CATEGORIES)[number];

  @IsIn(['included', 'not_applicable'])
  disposition!: 'included' | 'not_applicable';
}

export class ContributionAttributionDto {
  @IsIn(CONTRIBUTION_ATTRIBUTION_ROLES)
  role!: ContributionAttributionRole;

  @IsIn(BUSINESS_CONTRIBUTION_DOMAINS)
  originBusinessDomain!: BusinessContributionDomain;

  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsInt()
  @Min(1)
  @Max(10_000)
  shareBps!: number;

  @IsString()
  @Length(3, 500)
  evidenceRef!: string;

  @IsString()
  @Matches(HASH)
  evidenceHash!: string;
}

export class CreateBusinessContributionDto extends CommandMetadataDto {
  @IsIn(BUSINESS_CONTRIBUTION_DOMAINS)
  businessDomain!: BusinessContributionDomain;

  @IsInt()
  @Min(1)
  sourceAuthorityVersionId!: number;

  @IsString()
  @Matches(CODE)
  sourceSystem!: string;

  @IsString()
  @Matches(CODE)
  sourceType!: string;

  @IsString()
  @Matches(CODE)
  sourceId!: string;

  @IsString()
  @Matches(CODE)
  sourceVersion!: string;

  @IsString()
  @Matches(HASH)
  sourceRecordHash!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ContributionAttributionDto)
  attributions!: ContributionAttributionDto[];
}

export class ConfirmBusinessContributionDto extends CommandMetadataDto {
  @IsInt()
  @Min(1)
  expectedContributionVersion!: number;

  @IsString()
  @Matches(HASH)
  expectedEvidenceBundleHash!: string;

  @IsString()
  @Length(3, 500)
  confirmationEvidenceRef!: string;

  @IsString()
  @Matches(HASH)
  confirmationEvidenceHash!: string;
}

export class ReverseBusinessContributionDto extends CommandMetadataDto {
  @IsInt()
  @Min(1)
  expectedContributionVersion!: number;
}

/**
 * Selects a server-owned formal correction event. Amount, occurredAt,
 * recognitionPeriod, recognitionAt and sequence are deliberately absent: the
 * resolver and transaction derive all of them from authoritative persisted
 * facts.
 */
export class CreateBusinessContributionCorrectionDto extends CommandMetadataDto {
  @IsString()
  @IsIn(BUSINESS_CONTRIBUTION_CORRECTION_REASON_CODES)
  override reason!: BusinessContributionCorrectionReasonCode;

  @IsIn(BUSINESS_CONTRIBUTION_CORRECTION_TYPES)
  correctionType!: BusinessContributionCorrectionType;

  @IsInt()
  @Min(1)
  expectedContributionVersion!: number;

  @IsInt()
  @Min(1)
  sourceAuthorityVersionId!: number;

  @IsString()
  @Matches(CODE)
  sourceSystem!: string;

  @IsString()
  @Matches(CODE)
  sourceType!: string;

  @IsString()
  @Matches(CODE)
  sourceId!: string;

  @IsString()
  @Matches(CODE)
  sourceVersion!: string;

  @IsString()
  @Matches(HASH)
  sourceRecordHash!: string;
}

export class QueryBusinessContributionsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  operatingGroupId?: number;

  @IsOptional()
  @IsString()
  @Matches(PERIOD)
  recognitionPeriod?: string;

  @IsOptional()
  @IsIn(BUSINESS_CONTRIBUTION_DOMAINS)
  businessDomain?: BusinessContributionDomain;

  @IsOptional()
  @IsIn(['pending_confirmation', 'confirmed', 'reversed', 'voided'])
  confirmationStatus?: ContributionConfirmationStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  beforeId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit: number = 100;
}

export class QueryContributionAnomaliesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  contributionId?: number;

  @IsOptional()
  @IsIn(CONTRIBUTION_ANOMALY_TYPES)
  anomalyType?: ContributionAnomalyType;

  @IsOptional()
  @IsIn(CONTRIBUTION_ANOMALY_STATUSES)
  status?: ContributionAnomalyStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  beforeId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit: number = 100;
}

export class ResolveBusinessContributionAnomalyDto extends CommandMetadataDto {
  @IsInt()
  @Min(1)
  expectedAnomalyVersion!: number;

  @IsIn(CONTRIBUTION_ANOMALY_RESOLUTIONS)
  resolution!: ContributionAnomalyResolution;

  @IsOptional()
  @IsInt()
  @Min(1)
  canonicalContributionId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  duplicateContributionId?: number;

  @IsString()
  @Length(3, 500)
  resolutionEvidenceRef!: string;

  @IsString()
  @Matches(HASH)
  resolutionEvidenceHash!: string;
}
