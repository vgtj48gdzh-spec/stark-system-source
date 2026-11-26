import { IsOptional, IsString, MaxLength } from 'class-validator';

export class IgnoreBankSmsTransactionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
