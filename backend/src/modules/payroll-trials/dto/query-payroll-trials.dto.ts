import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

function toOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return value === true || value === 'true';
}

export class QueryPayrollTrialsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  periodKey?: string;

  @IsOptional()
  @IsString()
  summaryDomain?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  employeeId?: number;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  confirmedFlag?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  pendingOnly?: boolean;

  @IsOptional()
  @IsIn([
    'periodKey',
    'summaryDomain',
    'sourceSummaryCount',
    'sourceEventCount',
    'rewardAmountTotal',
    'rewardPointsTotal',
    'pendingCount',
    'ignoredCount',
    'calculatedTotal',
    'updatedAt',
    'createdAt',
  ])
  sortBy?: string;
}
