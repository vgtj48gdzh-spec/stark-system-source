import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryPlatformInteractionsDto extends PaginationSortQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  interactionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceUserRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceContactRef?: string;

  @IsOptional()
  @IsIn(['platform', 'accountId', 'contentId', 'interactionType', 'interactionTime', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'platform'
    | 'accountId'
    | 'contentId'
    | 'interactionType'
    | 'interactionTime'
    | 'createdAt'
    | 'updatedAt';

  @IsOptional()
  dateFrom?: string;

  @IsOptional()
  dateTo?: string;
}
