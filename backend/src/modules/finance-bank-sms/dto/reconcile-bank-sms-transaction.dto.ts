import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class ReconcileBankSmsTransactionDto {
  @IsOptional()
  @IsIn([
    'receipt_item',
    'approval_order',
    'manual_fee',
    'wechat_settlement_batch',
    'internal_fund_flow',
    'receivable_tracking',
  ])
  linkType?:
    | 'receipt_item'
    | 'approval_order'
    | 'manual_fee'
    | 'wechat_settlement_batch'
    | 'internal_fund_flow'
    | 'receivable_tracking';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  linkId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
