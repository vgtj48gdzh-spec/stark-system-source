import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryExecutionResultsDto extends PaginationSortQueryDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskItemId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  executedBy?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  merchantId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  resultStatus?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  batchCode?: string;

  @IsOptional()
  @IsIn(['playbookId', 'taskId', 'subjectId', 'executedAt', 'createdAt'])
  sortBy?: 'playbookId' | 'taskId' | 'subjectId' | 'executedAt' | 'createdAt';
}
