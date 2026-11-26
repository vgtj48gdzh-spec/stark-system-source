import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

function toOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return value === true || value === 'true';
}

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeDate(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return date.toISOString();
}

export class QueryBusinessStatSummariesDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  summaryDomain?: string;

  @IsOptional()
  @IsString()
  periodKey?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeDate(value))
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeDate(value))
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  merchantId?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  responsibleEmployeeId?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  confirmedFlag?: boolean;

  @IsOptional()
  @IsIn([
    'a_sales',
    'a_plus_c_linked_sale',
    'b_shopping_card',
    'employee_welfare_card',
    'c_points_redemption',
    'special_business_case',
    'needs_review',
  ])
  businessCategory?: string;

  @IsOptional()
  @IsString()
  payrollDecision?: string;

  @IsOptional()
  @IsString()
  payrollBlockReason?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  sourceClassification?: string;

  @IsOptional()
  @IsString()
  reconciliationStatus?: string;

  @IsOptional()
  @IsIn([
    'summaryDomain',
    'periodKey',
    'rewardEventCount',
    'confirmedRewardEventCount',
    'pendingRewardEventCount',
    'amountTotal',
    'quantityTotal',
    'updatedAt',
    'createdAt',
  ])
  sortBy?: string;
}
