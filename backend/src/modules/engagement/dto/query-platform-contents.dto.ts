import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPlatformContentsDto extends PaginationSortQueryDto {
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
  @MaxLength(100)
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contentType?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsInt()
  @Min(1)
  importBatchId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceFile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @IsOptional()
  @IsIn(['platform', 'accountId', 'campaignId', 'contentType', 'status', 'publishedAt', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'platform'
    | 'accountId'
    | 'campaignId'
    | 'contentType'
    | 'status'
    | 'publishedAt'
    | 'createdAt'
    | 'updatedAt';

  @IsOptional()
  dateFrom?: string;

  @IsOptional()
  dateTo?: string;
}
