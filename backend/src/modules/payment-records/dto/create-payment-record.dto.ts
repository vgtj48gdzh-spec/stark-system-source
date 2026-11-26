import { IsDateString, IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaymentStatus } from '../../../shared/enums/payment-status.enum';

export class CreatePaymentRecordDto {
  @IsInt()
  @Min(1)
  workOrderId!: number;

  @IsNumberString({}, { message: '金额格式错误' })
  amount!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  paymentMethod!: string;

  @IsString()
  @IsNotEmpty({ message: '收款状态非法' })
  paymentStatus!: PaymentStatus;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  payerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
