import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPlatformImportRecordsDto extends PaginationSortQueryDto {
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
  @IsIn(['recordIndex', 'importStatus', 'targetTable', 'createdAt', 'updatedAt'])
  sortBy?: 'recordIndex' | 'importStatus' | 'targetTable' | 'createdAt' | 'updatedAt';
}
