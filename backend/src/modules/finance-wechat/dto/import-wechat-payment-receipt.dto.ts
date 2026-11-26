import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class ImportWechatPaymentReceiptDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId!: number;

  @IsString()
  @MaxLength(100)
  merchantId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workOrderId?: number;

  @IsString()
  @MaxLength(100)
  outTradeNo!: string;

  @IsString()
  @MaxLength(100)
  transactionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  payerRef?: string;

  @IsNumberString()
  amountPaid!: string;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsIn(['paid_confirmed', 'refunded', 'closed'])
  paymentStatus?: 'paid_confirmed' | 'refunded' | 'closed';

  @IsOptional()
  @IsIn(['pending_settlement', 'batched', 'settled', 'exception'])
  settlementStatus?: 'pending_settlement' | 'batched' | 'settled' | 'exception';

  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}
