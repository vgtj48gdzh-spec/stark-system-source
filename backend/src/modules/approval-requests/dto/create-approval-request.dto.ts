import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateApprovalRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  relatedWorkOrderId!: number;

  @IsNumberString({}, { message: '金额格式错误' })
  amount!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  verificationCode?: string;
}
