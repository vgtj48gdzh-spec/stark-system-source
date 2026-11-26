import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmPayrollTrialDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
