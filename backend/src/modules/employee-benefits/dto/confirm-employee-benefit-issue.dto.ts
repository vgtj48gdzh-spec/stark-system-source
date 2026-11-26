import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmEmployeeBenefitIssueDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
