import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryExecutionTasksDto extends PaginationSortQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  playbookId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  scenarioCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedTo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  merchantId?: number;

  @IsOptional()
  @IsIn(['taskCode', 'taskName', 'scenarioCode', 'status', 'targetCount', 'updatedAt', 'createdAt'])
  sortBy?:
    | 'taskCode'
    | 'taskName'
    | 'scenarioCode'
    | 'status'
    | 'targetCount'
    | 'updatedAt'
    | 'createdAt';
}
