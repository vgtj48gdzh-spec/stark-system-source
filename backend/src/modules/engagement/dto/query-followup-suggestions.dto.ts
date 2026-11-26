import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryFollowupSuggestionsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  subjectType?: string;

  @IsOptional()
  subjectId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  evidenceStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @IsOptional()
  @IsIn(['subjectType', 'subjectId', 'evidenceStatus', 'status', 'createdAt', 'updatedAt'])
  sortBy?: 'subjectType' | 'subjectId' | 'evidenceStatus' | 'status' | 'createdAt' | 'updatedAt';
}
