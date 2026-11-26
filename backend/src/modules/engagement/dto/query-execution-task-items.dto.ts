import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryExecutionTaskItemsDto extends PaginationSortQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedTo?: number;

  @IsOptional()
  status?: string;

  @IsOptional()
  @IsIn(['taskId', 'status', 'subjectId', 'merchantId', 'updatedAt', 'createdAt'])
  sortBy?: 'taskId' | 'status' | 'subjectId' | 'merchantId' | 'updatedAt' | 'createdAt';
}
