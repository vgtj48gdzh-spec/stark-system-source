import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryInteractionLinksDto extends PaginationSortQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  interactionId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  linkedSubjectType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  linkedSubjectId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  linkedBusinessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  linkedBusinessId?: string;

  @IsOptional()
  @IsIn(['confirmed', 'inferred', 'unknown'])
  attributionStatus?: 'confirmed' | 'inferred' | 'unknown';

  @IsOptional()
  @IsIn(['interactionId', 'linkedSubjectType', 'linkedSubjectId', 'linkedBusinessType', 'attributionStatus', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'interactionId'
    | 'linkedSubjectType'
    | 'linkedSubjectId'
    | 'linkedBusinessType'
    | 'attributionStatus'
    | 'createdAt'
    | 'updatedAt';
}
