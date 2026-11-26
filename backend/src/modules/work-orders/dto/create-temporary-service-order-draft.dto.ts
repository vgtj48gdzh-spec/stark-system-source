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
  TemporaryServiceSourceChannel,
  TemporaryServiceType,
} from '../entities/temporary-service-order.entity';

function trimToUndefined(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
}

export class CreateTemporaryServiceOrderDraftDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId!: number;

  @Transform(({ value }) => trimToUndefined(value))
  @IsIn(['wash_single', 'inspection', 'simple_repair', 'other'])
  serviceType!: TemporaryServiceType;

  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @MaxLength(120)
  serviceTitle!: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @Matches(/^(0|[1-9]\d*)(?:\.\d{1,2})?$/)
  serviceAmount!: string;

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

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(30)
  vehiclePlate?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsIn(['enterprise_wechat', 'wechat', 'mini_program', 'manual', 'other'])
  sourceChannel?: TemporaryServiceSourceChannel;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  responsibleEmployeeId?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  relatedWorkOrderId?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  collectionOrderId?: number;

  @IsOptional()
  evidencePayload?: Record<string, unknown>;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
