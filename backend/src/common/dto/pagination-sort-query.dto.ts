import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class PaginationSortQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
}
