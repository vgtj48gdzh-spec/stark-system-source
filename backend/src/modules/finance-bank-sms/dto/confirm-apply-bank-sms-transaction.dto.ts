import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class ConfirmApplyBankSmsTransactionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reconciliationLinkId?: number;

  @IsOptional()
  @IsNumberString({}, { message: '确认金额格式错误' })
  confirmedAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  verificationCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
