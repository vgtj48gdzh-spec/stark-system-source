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

export class QueryEvidenceQueueDto extends IntersectionType(
  PaginationSortQueryDto,
  DateRangeQueryDto,
) {
  @IsOptional()
  @IsIn(['pending_account_evidence', 'unmatched_exception', 'pending_binding'])
  type?: 'pending_account_evidence' | 'unmatched_exception' | 'pending_binding';

  @IsOptional()
  @IsIn(['pending_account_evidence', 'unmatched_exception', 'pending_binding'])
  status?: 'pending_account_evidence' | 'unmatched_exception' | 'pending_binding';

  @IsOptional()
  @IsIn(['income', 'expense'])
  direction?: 'income' | 'expense';

  @IsOptional()
  @IsNumberString({}, { message: 'minAmount format is invalid' })
  minAmount?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'maxAmount format is invalid' })
  maxAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId?: number;

  @IsOptional()
  @IsIn(['present', 'missing', 'any'])
  accountTailPresence?: 'present' | 'missing' | 'any';

  @IsOptional()
  @IsString()
  @MaxLength(8)
  accountTail?: string;

  @IsOptional()
  @IsIn(['sourceCreatedAt', 'amount', 'bankName', 'riskLevel'])
  sortBy?: 'sourceCreatedAt' | 'amount' | 'bankName' | 'riskLevel';
}
