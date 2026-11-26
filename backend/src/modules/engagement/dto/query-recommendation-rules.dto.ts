import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryRecommendationRulesDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  recommendationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  subjectType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessDomain?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn([
    'ruleCode',
    'ruleName',
    'recommendationType',
    'subjectType',
    'businessDomain',
    'isActive',
    'updatedAt',
    'createdAt',
  ])
  sortBy?:
    | 'ruleCode'
    | 'ruleName'
    | 'recommendationType'
    | 'subjectType'
    | 'businessDomain'
    | 'isActive'
    | 'updatedAt'
    | 'createdAt';
}
