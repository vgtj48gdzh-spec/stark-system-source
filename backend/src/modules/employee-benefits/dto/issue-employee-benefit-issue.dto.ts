import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class IssueEmployeeBenefitIssueDto {
  @IsOptional()
  @IsDateString()
  issueAt?: string;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
