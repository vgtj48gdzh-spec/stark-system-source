import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryAiRecommendationsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  subjectType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subjectId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recommendationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @IsOptional()
  @IsIn(['confirmed', 'inferred', 'uncertain'])
  evidenceStatus?: 'confirmed' | 'inferred' | 'uncertain';

  @IsOptional()
  @IsIn(['subjectType', 'subjectId', 'recommendationType', 'status', 'evidenceStatus', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'subjectType'
    | 'subjectId'
    | 'recommendationType'
    | 'status'
    | 'evidenceStatus'
    | 'createdAt'
    | 'updatedAt';
}
