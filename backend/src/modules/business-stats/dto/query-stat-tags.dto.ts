import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

function toOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return value === true || value === 'true';
}

export class QueryStatTagsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  tagCode?: string;

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
  @IsString()
  customerId?: string;

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
  @IsIn(['tagCode', 'sourceTable', 'periodKey', 'merchantId', 'occurredAt', 'updatedAt', 'createdAt'])
  sortBy?: string;
}
