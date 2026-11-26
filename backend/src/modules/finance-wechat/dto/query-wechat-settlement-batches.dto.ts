import { IntersectionType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/date-range-query.dto';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryWechatSettlementBatchesDto extends IntersectionType(
  PaginationSortQueryDto,
  DateRangeQueryDto,
) {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  merchantId?: string;

  @IsOptional()
  @IsIn(['pending_bank_match', 'suggested', 'confirmed', 'exception'])
  matchStatus?: 'pending_bank_match' | 'suggested' | 'confirmed' | 'exception';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bankAccountRegistryId?: number;
}
