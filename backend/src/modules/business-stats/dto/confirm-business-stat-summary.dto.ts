import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmBusinessStatSummaryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
