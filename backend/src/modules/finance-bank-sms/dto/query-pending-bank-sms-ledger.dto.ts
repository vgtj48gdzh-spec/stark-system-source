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

export const PENDING_BANK_SMS_LEDGER_STATUSES = [
  'raw_received',
  'classified_bank_transaction',
  'pending_account_binding',
  'pending_company_binding',
  'pending_reconciliation',
  'ready_for_manual_review',
  'blocked_security_credential',
  'ignored_test',
  'rejected',
] as const;

export type PendingBankSmsLedgerStatus = (typeof PENDING_BANK_SMS_LEDGER_STATUSES)[number];

export class QueryPendingBankSmsLedgerDto extends IntersectionType(
  PaginationSortQueryDto,
  DateRangeQueryDto,
) {
  @IsOptional()
  @IsIn(PENDING_BANK_SMS_LEDGER_STATUSES)
  status?: PendingBankSmsLedgerStatus;

  @IsOptional()
  @IsIn(['income', 'expense'])
  direction?: 'income' | 'expense';

  @IsOptional()
  @IsNumberString()
  minAmount?: string;

  @IsOptional()
  @IsNumberString()
  maxAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  accountTail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rawSmsId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classificationId?: number;

  @IsOptional()
  @IsIn(['receivedAt', 'createdAt', 'amount', 'bankName', 'status'])
  sortBy?: 'receivedAt' | 'createdAt' | 'amount' | 'bankName' | 'status';
}
