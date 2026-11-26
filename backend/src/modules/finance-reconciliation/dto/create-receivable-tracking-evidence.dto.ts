import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

function trimToUndefined(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : undefined;
}

export class CreateReceivableTrackingEvidenceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId!: number;

  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @MaxLength(200)
  counterpartyName!: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNo?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsString()
  @Matches(/^-?\d+(?:\.\d{1,2})?$/)
  invoiceAmount!: string;

  @Type(() => Date)
  @IsDate()
  invoiceIssuedAt!: Date;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsIn([
    'manual_invoice',
    'manual_receivable_evidence',
    'work_order_reference',
    'abc_sync_order',
  ])
  sourceType!:
    | 'manual_invoice'
    | 'manual_receivable_evidence'
    | 'work_order_reference'
    | 'abc_sync_order';

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceId?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceRefNo?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsIn(['pending', 'supported'])
  evidenceStatus?: 'pending' | 'supported';

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsIn(['invoice_issued', 'receivable_open'])
  currentStatus?: 'invoice_issued' | 'receivable_open';

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidenceNote?: string;
}
