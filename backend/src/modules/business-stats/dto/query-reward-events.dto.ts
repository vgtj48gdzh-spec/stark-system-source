import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

function toOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return value === true || value === 'true';
}

export class QueryRewardEventsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  sourceTable?: string;

  @IsOptional()
  @IsString()
  periodKey?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  confirmedFlag?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  ignoredFlag?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  merchantId?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
  responsibleEmployeeId?: number;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsIn([
    'eventType',
    'sourceTable',
    'periodKey',
    'amountStandard',
    'quantityStandard',
    'confirmedFlag',
    'ignoredFlag',
    'occurredAt',
    'updatedAt',
    'createdAt',
  ])
  sortBy?: string;
}
