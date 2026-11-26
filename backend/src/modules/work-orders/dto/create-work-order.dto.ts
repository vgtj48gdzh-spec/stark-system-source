import { IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateWorkOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerMobile?: string;

  @IsNumberString({}, { message: '金额格式错误' })
  amountDue!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  responsibleUserId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
