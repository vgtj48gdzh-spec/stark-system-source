import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryProfileSnapshotsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsIn(['displayName', 'mobile', 'interactionCount', 'memoryCount', 'attributedBusinessCount', 'latestInteractionAt', 'updatedAt'])
  sortBy?:
    | 'displayName'
    | 'mobile'
    | 'interactionCount'
    | 'memoryCount'
    | 'attributedBusinessCount'
    | 'latestInteractionAt'
    | 'updatedAt';
}
