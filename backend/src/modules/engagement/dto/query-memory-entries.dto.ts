import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryMemoryEntriesDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsIn(['customer', 'employee'])
  subjectType?: 'customer' | 'employee';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subjectId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  memoryType?: string;

  @IsOptional()
  @IsIn(['confirmed', 'inferred', 'uncertain'])
  evidenceStatus?: 'confirmed' | 'inferred' | 'uncertain';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['subjectType', 'subjectId', 'memoryType', 'evidenceStatus', 'expiresAt', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'subjectType'
    | 'subjectId'
    | 'memoryType'
    | 'evidenceStatus'
    | 'expiresAt'
    | 'createdAt'
    | 'updatedAt';

  @IsOptional()
  dateFrom?: string;

  @IsOptional()
  dateTo?: string;
}
