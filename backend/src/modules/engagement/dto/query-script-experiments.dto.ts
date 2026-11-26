import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryScriptExperimentsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  experimentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recommendationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessDomain?: string;

  @IsOptional()
  @IsIn([
    'experimentCode',
    'experimentName',
    'experimentType',
    'recommendationType',
    'status',
    'templateCount',
    'updatedAt',
    'createdAt',
  ])
  sortBy?:
    | 'experimentCode'
    | 'experimentName'
    | 'experimentType'
    | 'recommendationType'
    | 'status'
    | 'templateCount'
    | 'updatedAt'
    | 'createdAt';
}
