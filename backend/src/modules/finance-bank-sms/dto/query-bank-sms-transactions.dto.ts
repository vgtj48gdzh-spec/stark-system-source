import { IntersectionType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/date-range-query.dto';
import { PaginationSortQueryDto } from '../../../common/dto/pagination-sort-query.dto';

export class QueryBankSmsTransactionsDto extends IntersectionType(
  PaginationSortQueryDto,
  DateRangeQueryDto,
) {
  @IsOptional()
  @IsIn(['income', 'expense'])
  direction?: 'income' | 'expense';

  @IsOptional()
  @IsNumberString({}, { message: '最小金额格式错误' })
  minAmount?: string;

  @IsOptional()
  @IsNumberString({}, { message: '最大金额格式错误' })
  maxAmount?: string;

  @IsOptional()
  @IsIn(['pending_binding', 'pending', 'pending_evidence', 'suggested', 'confirmed', 'ignored'])
  reconcileStatus?:
    | 'pending_binding'
    | 'pending'
    | 'pending_evidence'
    | 'suggested'
    | 'confirmed'
    | 'ignored';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  counterparty?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rawSmsId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  accountTail?: string;

  @IsOptional()
  @IsIn(['smsReceivedAt', 'bankBusinessDate', 'amount', 'reconcileStatus', 'companyId'])
  sortBy?: 'smsReceivedAt' | 'bankBusinessDate' | 'amount' | 'reconcileStatus' | 'companyId';
}
