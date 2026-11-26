import { IntersectionType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/date-range-query.dto';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryOperationLogsDto extends IntersectionType(
  PaginationSortQueryDto,
  DateRangeQueryDto,
) {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  module?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  operatorId?: number;

  @IsOptional()
  @IsIn(['human', 'system'])
  actorType?: 'human' | 'system';

  @IsOptional()
  @IsIn(['createdAt', 'module', 'action', 'targetId', 'operatorId'])
  sortBy?: 'createdAt' | 'module' | 'action' | 'targetId' | 'operatorId';
}
