import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWechatSettlementBatchDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId!: number;

  @IsString()
  @MaxLength(100)
  merchantId!: string;

  @IsDateString()
  settlementDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  batchNo?: string;

  @IsOptional()
  @IsNumberString()
  feeAmount?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bankAccountRegistryId?: number;

  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  paymentReceiptIds!: number[];

  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}
