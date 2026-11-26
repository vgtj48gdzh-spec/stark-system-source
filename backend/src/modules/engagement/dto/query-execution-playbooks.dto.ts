import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryExecutionPlaybooksDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  scenarioCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recommendationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessDomain?: string;

  @IsOptional()
  @IsIn(['playbookCode', 'playbookName', 'scenarioCode', 'recommendationType', 'updatedAt', 'createdAt'])
  sortBy?:
    | 'playbookCode'
    | 'playbookName'
    | 'scenarioCode'
    | 'recommendationType'
    | 'updatedAt'
    | 'createdAt';
}
