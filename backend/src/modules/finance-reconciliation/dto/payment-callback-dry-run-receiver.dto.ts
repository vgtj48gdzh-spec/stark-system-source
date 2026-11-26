import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

function trimToUndefined(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
}

export class PaymentCallbackDryRunReceiverDto {
  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @IsIn(['enterprise_wechat_mock', 'enterprise_wechat', 'wechat_pay', 'alipay', 'mock'])
  provider!: string;

  @IsBoolean()
  dryRun!: boolean;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  requestId?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  signature?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsObject()
  payload!: Record<string, unknown>;
}
