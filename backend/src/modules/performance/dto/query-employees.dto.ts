import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

function normalizeString(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

export class QueryEmployeesDto extends PaginationSortQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeString(value))
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsOptional()
  @IsIn(['name', 'mobile', 'status', 'importedAt', 'createdAt', 'updatedAt'])
  sortBy?: 'name' | 'mobile' | 'status' | 'importedAt' | 'createdAt' | 'updatedAt';
}
