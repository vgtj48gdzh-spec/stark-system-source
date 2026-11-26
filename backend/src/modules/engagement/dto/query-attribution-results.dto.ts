import { IsBooleanString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryAttributionResultsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  attributionStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  evidenceStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  attributedSubjectType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  attributedBusinessType?: string;

  @IsOptional()
  @IsBooleanString()
  hasMerchant?: string;

  @IsOptional()
  @IsBooleanString()
  hasEmployee?: string;

  @IsOptional()
  @IsIn([
    'attributionStatus',
    'evidenceStatus',
    'confidenceScore',
    'merchantId',
    'employeeId',
    'handledAt',
    'createdAt',
    'updatedAt',
  ])
  sortBy?:
    | 'attributionStatus'
    | 'evidenceStatus'
    | 'confidenceScore'
    | 'merchantId'
    | 'employeeId'
    | 'handledAt'
    | 'createdAt'
    | 'updatedAt';
}
