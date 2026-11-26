import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

function trimToUndefined(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
}

export class AttachCollectionBankTransactionEvidenceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  collectionOrderId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  bankTransactionId!: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  reconciliationLinkId?: number;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)(?:\.\d{1,2})?$/)
  bankReceivedAmount?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)(?:\.\d{1,2})?$/)
  channelFeeAmount?: string;

  @IsOptional()
  evidencePayload?: Record<string, unknown>;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
