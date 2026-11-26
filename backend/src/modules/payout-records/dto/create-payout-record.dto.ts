import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsNumberString, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreatePayoutRecordDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  materialInstallmentId!: number;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,96}$/)
  requestIdempotencyKey!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,20}$/)
  verificationCode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  approvalRequestId!: number;

  @IsNumberString({}, { message: '金额格式错误' })
  amount!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  payeeName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  paymentMethod!: string;

  @IsDateString()
  paidAt!: string;
}
