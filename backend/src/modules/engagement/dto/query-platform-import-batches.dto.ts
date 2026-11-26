import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPlatformImportBatchesDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourcePlatform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  importType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  importStatus?: string;

  @IsOptional()
  @IsIn([
    'sourcePlatform',
    'importType',
    'importStatus',
    'recordCount',
    'successCount',
    'failedCount',
    'startedAt',
    'finishedAt',
    'createdAt',
    'updatedAt',
  ])
  sortBy?:
    | 'sourcePlatform'
    | 'importType'
    | 'importStatus'
    | 'recordCount'
    | 'successCount'
    | 'failedCount'
    | 'startedAt'
    | 'finishedAt'
    | 'createdAt'
    | 'updatedAt';
}
