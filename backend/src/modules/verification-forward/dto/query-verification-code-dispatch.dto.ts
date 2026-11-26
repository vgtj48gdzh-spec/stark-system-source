import { IntersectionType } from '@nestjs/mapped-types';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/date-range-query.dto';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryVerificationCodeDispatchDto extends IntersectionType(
  PaginationSortQueryDto,
  DateRangeQueryDto,
) {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sender?: string;

  @IsOptional()
  @IsIn(['ai_alert', 'email'])
  channel?: 'ai_alert' | 'email';

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;
}
