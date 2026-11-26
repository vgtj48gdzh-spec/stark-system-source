import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import type { FinanceCollectionOrderPaymentChannel } from '../entities/finance-collection-order.entity';

function trimToUndefined(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
}

export class AttachCollectionPaymentReceiptEvidenceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  collectionOrderId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentReceiptId!: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  settlementBatchId?: number;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)(?:\.\d{1,2})?$/)
  receiptAmount?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsIn(['enterprise_wechat', 'wechat', 'alipay', 'mini_program', 'old_qr', 'other'])
  paymentChannel?: FinanceCollectionOrderPaymentChannel;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  channelTradeNo?: string;

  @IsOptional()
  evidencePayload?: Record<string, unknown>;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
