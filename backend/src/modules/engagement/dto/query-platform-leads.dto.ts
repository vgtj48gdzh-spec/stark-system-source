import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPlatformLeadsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  leadStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  evidenceStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  subjectType?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  merchantId?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  importBatchId?: number;

  @IsOptional()
  @IsIn([
    'platform',
    'leadType',
    'leadStatus',
    'evidenceStatus',
    'confidenceScore',
    'merchantId',
    'employeeId',
    'createdAt',
    'updatedAt',
  ])
  sortBy?:
    | 'platform'
    | 'leadType'
    | 'leadStatus'
    | 'evidenceStatus'
    | 'confidenceScore'
    | 'merchantId'
    | 'employeeId'
    | 'createdAt'
    | 'updatedAt';
}
