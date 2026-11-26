import { IntersectionType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/date-range-query.dto';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryWechatPaymentReceiptsDto extends IntersectionType(
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workOrderId?: number;

  @IsOptional()
  @IsIn(['paid_confirmed', 'refunded', 'closed'])
  paymentStatus?: 'paid_confirmed' | 'refunded' | 'closed';

  @IsOptional()
  @IsIn(['pending_settlement', 'batched', 'settled', 'exception'])
  settlementStatus?: 'pending_settlement' | 'batched' | 'settled' | 'exception';
}
