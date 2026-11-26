import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  FinanceCollectionOrderBusinessType,
  FinanceCollectionOrderPaymentChannel,
  FinanceCollectionOrderSourceType,
} from '../entities/finance-collection-order.entity';

function trimToUndefined(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
}

export class CreateCollectionOrderDraftDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId!: number;

  @Transform(({ value }) => trimToUndefined(value))
  @IsIn(['temporary_service', 'work_order', 'mini_program', 'enterprise_wechat', 'manual'])
  sourceType!: FinanceCollectionOrderSourceType;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceId?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsIn(['wash_single', 'maintenance', 'deposit', 'other'])
  businessType!: FinanceCollectionOrderBusinessType;

  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @Matches(/^(0|[1-9]\d*)(?:\.\d{1,2})?$/)
  businessAmount!: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsIn(['enterprise_wechat', 'wechat', 'alipay', 'mini_program', 'old_qr', 'bank_transfer', 'other'])
  paymentChannel?: FinanceCollectionOrderPaymentChannel;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  channelTradeNo?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  workOrderId?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  temporaryServiceOrderId?: number;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerId?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerPhone?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsBoolean()
  temporaryCustomerFlag?: boolean;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  responsibleEmployeeId?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  sourceEmployeeId?: number;

  @IsOptional()
  evidencePayload?: Record<string, unknown>;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
